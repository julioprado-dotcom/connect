/**
 * Scraper completo: 13 medios con URLs corregidas
 * Pipeline 3 fases: Links → Triaje keywords → Clasificación LLM
 * DECODEX Bolivia
 */
import { PrismaClient } from '@prisma/client';
import { extraerLinksDeNoticias, extraerLeadDeBloque, type NotaLink } from '../src/lib/jobs/link-extractor';

const prisma = new PrismaClient();
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

const MEDIOS = [
  { nombre: "La Patria", medioId: "cmoxh9w8d0022nh4e0e8pse6r", url: "https://lapatria.bo/" },
  { nombre: "La Estrella", medioId: "cmoxh9w8h0027nh4ehd8ceifm", url: "https://www.leo.bo/" },
  { nombre: "El Potosí", medioId: "cmoxh9w8c0021nh4ekjbyutxv", url: "https://elpotosi.net" },
  { nombre: "ABI", medioId: "cmoxh9w8b0020nh4es3cbo80s", url: "https://abi.bo/" },
  { nombre: "ANF (Agencia Fides)", medioId: "cmoxh9w85001snh4epjri4v2o", url: "https://www.noticiasfides.com/" },
  { nombre: "ATB", medioId: "cmoxh9w89001ynh4eudg365g9", url: "https://www.atb.com.bo/" },
  { nombre: "Bolivia TV", medioId: "cmoxh9w8a001znh4e2difil9v", url: "https://www.boliviatv.bo/" },
  { nombre: "RTP Bolivia", medioId: "med_1778634868333_rtp", url: "https://rtpbolivia.com.bo/" },
  { nombre: "Unitel", medioId: "cmoxh9w88001wnh4esijokkd2", url: "https://unitel.bo/" },
  { nombre: "Red Uno", medioId: "cmoxh9w88001xnh4eqs30p6lv", url: "https://www.reduno.com.bo/" },
  { nombre: "El Deber", medioId: "cmoxh9w81001nnh4efazns1qc", url: "https://eldeber.com.bo/" },
  { nombre: "Los Tiempos", medioId: "cmoxh9w82001onh4e5dv2b7ja", url: "https://www.lostiempos.com/" },
  { nombre: "El Diario", medioId: "cmoxh9w83001pnh4e8344fjk3", url: "https://www.eldiario.net" }
];

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const MAX_NOTAS_CLASIFICAR = 5; // Top 5 por medio para optimizar tiempo
const DELAY_NOTA = 2000;
const DELAY_MEDIO = 3000;

async function fetchHtml(url: string, timeoutMs = 20000) {
  try {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, 'Accept': 'text/html', 'Accept-Language': 'es-BO,es;q=0.9' }, signal: ctrl.signal, redirect: 'follow' });
    clearTimeout(tid);
    return { html: await res.text(), status: res.status };
  } catch (e: any) { return { html: '', status: 0, error: e.message }; }
}

function extractText(html: string) {
  return html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style[^>]*>[\s\S]*?<\/style>/gi,'').replace(/<br\s*\/?>/gi,'\n').replace(/<\/p>/gi,'\n\n').replace(/<\/h[1-6]>/gi,'\n').replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#(\d+);/g,(_,c)=>String.fromCharCode(parseInt(c))).replace(/\s+/g,' ').trim();
}

async function main() {
  const log: string[] = [];
  const logFn = (s: string) => { console.log(s); log.push(s); };

  logFn(`SCRAPING 13 MEDIOS — ${new Date().toISOString()}`);

  // Diccionario
  const [personas, ejes] = await Promise.all([
    prisma.persona.findMany({ where: { activa: true }, select: { id: true, nombre: true } }),
    prisma.ejeTematico.findMany({ where: { activo: true }, select: { slug: true, keywords: true } }),
  ]);
  const asmMap = new Map<string,string>();
  for (const p of personas) { const n = p.nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''); if(n.length>=3) asmMap.set(n, p.id); }
  const kwMap = new Map<string,string[]>();
  for (const e of ejes) { if(!e.keywords) continue; for(const k of e.keywords.split(',')) { const n=k.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''); if(n.length>=3) kwMap.set(n,[...(kwMap.get(n)||[]),e.slug]); }}
  logFn(`Diccionario: ${asmMap.size} asm, ${kwMap.size} kw`);

  const resumen: Record<string, { fase1: number; fase2: number; fase3: number; menciones: number; ok: boolean; error?: string }> = {};
  let totalMencionesGlobal = 0;

  for (let idx = 0; idx < MEDIOS.length; idx++) {
    const medio = MEDIOS[idx];
    const startTime = Date.now();
    logFn(`\n[${idx+1}/13] ${medio.nombre} — ${medio.url}`);

    // FASE 1: Homepage
    const { html, status, error } = await fetchHtml(medio.url);
    if (!html || html.length < 500) {
      logFn(`  ❌ FAIL: ${error || 'HTTP '+status+' ('+html.length+'B)'}`);
      await prisma.capturaLog.create({ data: { id: `clog_${Date.now()}_${Math.random().toString(36).substring(2,8)}`, medioId: medio.medioId, nivel: 'nacional', exitosa: false, totalArticulos: 0, mencionesEncontradas: 0, errores: error || `HTTP ${status}` } }).catch(()=>{});
      resumen[medio.nombre] = { fase1: 0, fase2: 0, fase3: 0, menciones: 0, ok: false, error: error || `HTTP ${status}` };
      if (idx < MEDIOS.length - 1) await sleep(DELAY_MEDIO);
      continue;
    }
    logFn(`  ✅ HTML: ${(html.length/1024).toFixed(0)}KB`);

    const notas = extraerLinksDeNoticias(html, medio.url, 40);
    for (const n of notas) n.lead = extraerLeadDeBloque(html, n.url);
    logFn(`  📰 FASE1: ${notas.length} links`);

    // FASE 2: Triaje
    const seleccionadas: (NotaLink & { puntaje: number; razon: string })[] = [];
    for (const nota of notas) {
      const txt = `${nota.titulo} ${nota.lead||''}`.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
      let pts = 0, razon = '';
      for (const [n] of asmMap) { if(txt.includes(n)) { pts+=3; razon=n; break; } }
      for (const [k] of kwMap) { if(txt.includes(k)) { pts+=1; if(!razon) razon=k; } }
      if (pts >= 3) seleccionadas.push({ ...nota, puntaje: pts, razon });
    }
    seleccionadas.sort((a,b) => b.puntaje - a.puntaje);
    logFn(`  🔍 FASE2: ${seleccionadas.length} relevantes`);

    let mencionesCreadas = 0;
    const top = seleccionadas.slice(0, MAX_NOTAS_CLASIFICAR);

    // FASE 3: Clasificar con LLM
    if (top.length > 0) {
      logFn(`  🤖 FASE3: Clasificando ${top.length} notas...`);
      for (let i = 0; i < top.length; i++) {
        const nota = top[i];
        if (i > 0) await sleep(DELAY_NOTA);

        const nr = await fetchHtml(nota.url);
        if (!nr.html || nr.html.length < 200) { logFn(`    ❌ No descargada: ${nota.url.substring(0,50)}`); continue; }
        const texto = extractText(nr.html);
        if (texto.length < 100) continue;

        try {
          const ZAIConstructor = (await import('z-ai-web-dev-sdk')).default;
          const zai = await ZAIConstructor.create();
          const completion = await zai.chat.completions.create({
            messages: [
              { role: 'system', content: 'Analista de medios boliviano. Responde SOLO JSON válido sin markdown.' },
              { role: 'user', content: `Analiza esta noticia boliviana.\n\nTítulo: ${nota.titulo}\nTexto: ${texto.substring(0,2500)}\n\nJSON: {"es_relevante":bool,"personas_mencionadas":[],"tratamiento_periodistico":"neutral|favorable|critico","eje_tematico":"economia|politica|...","sentimiento":"positivo|negativo|neutro","resumen":"..."}` }
            ],
            temperature: 0.2, max_tokens: 400,
          });
          const resp = completion.choices[0]?.message?.content || '';
          const jsonMatch = resp.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const p = JSON.parse(jsonMatch[0]);
            if (p.es_relevante) {
              const fm = nota.url.match(/\/(\d{4})\/(\d{2})\/(\d{2})/);
              await prisma.mencion.create({
                data: {
                  id: `menc_${Date.now()}_${Math.random().toString(36).substring(2,8)}`,
                  titulo: nota.titulo, texto: texto.substring(0,500), textoCompleto: texto,
                  url: nota.url, fechaPublicacion: fm ? new Date(`${fm[1]}-${fm[2]}-${fm[3]}`) : new Date(),
                  tipoMencion: 'noticia', sentimiento: p.sentimiento||'neutro',
                  tratamientoPeriodistico: p.tratamiento_periodistico||'neutral',
                  medioId: medio.medioId,
                }
              });
              mencionesCreadas++;
              totalMencionesGlobal++;
              logFn(`    ✅ "${nota.titulo.substring(0,45)}" → ${p.eje_tematico}, ${p.sentimiento}`);
            } else {
              logFn(`    ⏭️ No relevante`);
            }
          }
        } catch (err: any) { logFn(`    ❌ LLM: ${err.message?.substring(0,60)}`); }
      }
    }

    // CapturaLog
    await prisma.capturaLog.create({
      data: { id: `clog_${Date.now()}_${Math.random().toString(36).substring(2,8)}`, medioId: medio.medioId, nivel: 'nacional', exitosa: true, totalArticulos: notas.length, mencionesEncontradas: mencionesCreadas }
    }).catch(()=>{});

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
    logFn(`  ✅ ${medio.nombre}: ${notas.length}→${seleccionadas.length}→${mencionesCreadas} menciones [${elapsed}s]`);
    resumen[medio.nombre] = { fase1: notas.length, fase2: seleccionadas.length, fase3: top.length, menciones: mencionesCreadas, ok: true };

    if (idx < MEDIOS.length - 1) await sleep(DELAY_MEDIO);
  }

  // RESUMEN FINAL
  logFn(`\n${'═'.repeat(70)}`);
  logFn(`RESUMEN FINAL`);
  logFn(`${'═'.repeat(70)}`);
  logFn(`${'MEDIO'.padEnd(25)} | F1 | F2 | F3 | MENC | STATUS`);
  logFn(`${'─'.repeat(65)}`);
  for (const [nombre, r] of Object.entries(resumen)) {
    if (r.ok) logFn(`${nombre.padEnd(25)} | ${(r.fase1+'').padStart(3)} | ${(r.fase2+'').padStart(3)} | ${(r.fase3+'').padStart(3)} | ${(r.menciones+'').padStart(3)} | ✅`);
    else logFn(`${nombre.padEnd(25)} |   - |   - |   - |   0 | ❌ ${(r.error||'').substring(0,20)}`);
  }
  logFn(`${'─'.repeat(65)}`);
  logFn(`TOTAL: ${totalMencionesGlobal} menciones nuevas creadas en la DB`);

  // Guardar log en archivo
  const fs = await import('fs');
  fs.writeFileSync('/home/z/my-project/download/scraping-13-medios.log', log.join('\n'));
  logFn(`\nLog guardado en /home/z/my-project/download/scraping-13-medios.log`);

  await prisma.$disconnect();
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
