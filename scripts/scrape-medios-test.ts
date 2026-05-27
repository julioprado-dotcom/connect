/**
 * Scraper test: Solo 3 medios para validar el pipeline completo
 */
import { PrismaClient } from '@prisma/client';
import { extraerLinksDeNoticias, extraerLeadDeBloque, type NotaLink } from '../src/lib/jobs/link-extractor';

const prisma = new PrismaClient();
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

const MEDIOS = [
  { nombre: "La Patria", medioId: "cmoxh9w8d0022nh4e0e8pse6r", url: "https://lapatria.bo/" },
  { nombre: "Los Tiempos", medioId: "cmoxh9w82001onh4e5dv2b7ja", url: "https://www.lostiempos.com/" },
  { nombre: "Unitel", medioId: "cmoxh9w88001wnh4esijokkd2", url: "https://unitel.bo/" },
];

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

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
  // Cargar diccionario
  const [personas, ejes] = await Promise.all([
    prisma.persona.findMany({ where: { activa: true }, select: { id: true, nombre: true } }),
    prisma.ejeTematico.findMany({ where: { activo: true }, select: { slug: true, keywords: true } }),
  ]);
  const asmMap = new Map<string,string>();
  for (const p of personas) { const n = p.nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''); if(n.length>=3) asmMap.set(n, p.id); }
  const kwMap = new Map<string,string[]>();
  for (const e of ejes) { if(!e.keywords) continue; for(const k of e.keywords.split(',')) { const n=k.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''); if(n.length>=3) kwMap.set(n,[...(kwMap.get(n)||[]),e.slug]); }}
  console.log(`Diccionario: ${asmMap.size} asm, ${kwMap.size} kw`);

  for (const medio of MEDIOS) {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`📋 ${medio.nombre} — ${medio.url}`);
    
    const { html, status } = await fetchHtml(medio.url);
    if (!html || html.length < 500) { console.log(`❌ HTTP ${status}`); continue; }
    console.log(`✅ HTML: ${(html.length/1024).toFixed(0)}KB`);

    const notas = extraerLinksDeNoticias(html, medio.url, 40);
    for (const n of notas) n.lead = extraerLeadDeBloque(html, n.url);
    console.log(`📰 ${notas.length} links extraídos`);

    // Triaje
    const seleccionadas: typeof notas[number] & { puntaje: number; razon: string }[] = [];
    for (const nota of notas) {
      const txt = `${nota.titulo} ${nota.lead||''}`.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
      let pts = 0, razon = '';
      for (const [n] of asmMap) { if(txt.includes(n)) { pts+=3; razon=n; break; } }
      for (const [k, es] of kwMap) { if(txt.includes(k)) { pts+=1; if(!razon) razon=k; } }
      if (pts >= 3) seleccionadas.push({ ...nota, puntaje: pts, razon });
    }
    seleccionadas.sort((a,b) => b.puntaje - a.puntaje);
    console.log(`🔍 Triaje: ${seleccionadas.length} relevantes (umbral >= 3 pts)`);

    // Clasificar top 3 con LLM
    const top3 = seleccionadas.slice(0, 3);
    if (top3.length === 0) { console.log('⏭️ Sin notas para clasificar'); continue; }
    
    console.log(`🤖 Clasificando ${top3.length} notas con LLM...`);
    for (const nota of top3) {
      console.log(`\n  📄 "${nota.titulo.substring(0,55)}" (${nota.puntaje}pts)`);
      const nr = await fetchHtml(nota.url);
      if (!nr.html || nr.html.length < 200) { console.log(`     ❌ No se pudo descargar`); continue; }
      const texto = extractText(nr.html);
      console.log(`     📝 ${texto.length} chars`);

      try {
        const ZAIConstructor = (await import('z-ai-web-dev-sdk')).default;
        const zai = await ZAIConstructor.create();
        const completion = await zai.chat.completions.create({
          messages: [
            { role: 'system', content: 'Analista de medios boliviano. Responde SOLO JSON válido, sin markdown.' },
            { role: 'user', content: `Analiza esta noticia boliviana. Título: ${nota.titulo}\n\nTexto: ${texto.substring(0,2500)}\n\nResponde JSON: {"es_relevante":true/false,"personas_mencionadas":[""],"tratamiento_periodistico":"neutral|favorable|critico","eje_tematico":"economia|politica|...","sentimiento":"positivo|negativo|neutro","resumen":"..."}` }
          ],
          temperature: 0.2, max_tokens: 400,
        });
        const resp = completion.choices[0]?.message?.content || '';
        console.log(`     🤖 LLM: ${resp.substring(0,120)}`);
        
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
            console.log(`     ✅ MENCION CREADA → ${p.eje_tematico}, ${p.sentimiento}`);
          } else {
            console.log(`     ⏭️ No relevante`);
          }
        }
      } catch (err: any) { console.log(`     ❌ ${err.message?.substring(0,80)}`); }
      await sleep(1500);
    }

    // CapturaLog
    const mencCount = await prisma.mencion.count({ where: { medioId: medio.medioId, fechaCaptura: { gte: new Date(Date.now() - 300000) } } });
    await prisma.capturaLog.create({ data: { id: `clog_${Date.now()}_${Math.random().toString(36).substring(2,8)}`, medioId: medio.medioId, nivel: 'nacional', exitosa: true, totalArticulos: notas.length, mencionesEncontradas: mencCount } }).catch(()=>{});
    console.log(`\n✅ ${medio.nombre} completado`);
    await sleep(2000);
  }
  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
