/**
 * Scraper completo: Pipeline 3 fases para los 13 medios con URLs corregidas
 * FASE 1: Extraer links de homepage
 * FASE 2: Triaje por keywords (asambleistas + ejes temáticos)
 * FASE 3: Clasificar notas relevantes con LLM y crear menciones
 * 
 * DECODEX Bolivia
 */

import { PrismaClient } from '@prisma/client';

// Imports directos (evitar alias @/ que puede fallar fuera de Next.js)
import { extraerLinksDeNoticias, extraerLeadDeBloque, type NotaLink } from '../src/lib/jobs/link-extractor';

const prisma = new PrismaClient();

// ─── Configuración ───────────────────────────────────────────

const MAX_LINKS = 40;
const MAX_NOTAS_A_CLASIFICAR = 10; // Reducido para test
const MAX_NOTAS_A_DESCARGAR = 10;
const DELAY_ENTRE_NOTAS = 2000;
const DELAY_ENTRE_MEDIOS = 3000;
const TIMEOUT_FETCH = 20000;

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

interface MedioToScrape {
  nombre: string;
  medioId: string;
  fuenteId: string;
  url: string;
}

const MEDIOS: MedioToScrape[] = [
  { nombre: "La Patria", medioId: "cmoxh9w8d0022nh4e0e8pse6r", fuenteId: "cmoxh9wcm0089nh4eiu2uk6cf", url: "https://lapatria.bo/" },
  { nombre: "La Estrella", medioId: "cmoxh9w8h0027nh4ehd8ceifm", fuenteId: "fe-cmoxh9w8h0027nh4ehd8ceifm", url: "https://www.leo.bo/" },
  { nombre: "El Potosí", medioId: "cmoxh9w8c0021nh4ekjbyutxv", fuenteId: "cmoxh9wcl0087nh4eiumjm7g1", url: "https://elpotosi.net" },
  { nombre: "ABI", medioId: "cmoxh9w8b0020nh4es3cbo80s", fuenteId: "cmoxh9wck0085nh4eioit3hyb", url: "https://abi.bo/" },
  { nombre: "ANF (Agencia Fides)", medioId: "cmoxh9w85001snh4epjri4v2o", fuenteId: "cmoxh9wcd007pnh4eu3r1yl3k", url: "https://www.noticiasfides.com/" },
  { nombre: "ATB", medioId: "cmoxh9w89001ynh4eudg365g9", fuenteId: "cmoxh9wci0081nh4eqjdqrpk8", url: "https://www.atb.com.bo/" },
  { nombre: "Bolivia TV", medioId: "cmoxh9w8a001znh4e2difil9v", fuenteId: "cmoxh9wcj0083nh4ekc28dj3j", url: "https://www.boliviatv.bo/" },
  { nombre: "RTP Bolivia", medioId: "med_1778634868333_rtp", fuenteId: "fe-med_1778634868333_rtp", url: "https://rtpbolivia.com.bo/" },
  { nombre: "Unitel", medioId: "cmoxh9w88001wnh4esijokkd2", fuenteId: "cmoxh9wch007xnh4e75x098gc", url: "https://unitel.bo/" },
  { nombre: "Red Uno", medioId: "cmoxh9w88001xnh4eqs30p6lv", fuenteId: "cmoxh9wci007znh4eufmu5p3b", url: "https://www.reduno.com.bo/" },
  { nombre: "El Deber", medioId: "cmoxh9w81001nnh4efazns1qc", fuenteId: "cmoxh9wc9007fnh4edbwonbzh", url: "https://eldeber.com.bo/" },
  { nombre: "Los Tiempos", medioId: "cmoxh9w82001onh4e5dv2b7ja", fuenteId: "cmoxh9wca007hnh4emvwail2y", url: "https://www.lostiempos.com/" },
  { nombre: "El Diario", medioId: "cmoxh9w83001pnh4e8344fjk3", fuenteId: "cmoxh9wcb007jnh4egw8h6jo4", url: "https://www.eldiario.net" }
];

// ─── Helpers ─────────────────────────────────────────────────

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function fetchHtml(url: string): Promise<{ html: string; status: number; error?: string }> {
  try {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), TIMEOUT_FETCH);
    const res = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-BO,es;q=0.9,en;q=0.8',
      },
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(tid);
    const html = await res.text();
    return { html, status: res.status };
  } catch (e: any) {
    return { html: '', status: 0, error: e.message?.substring(0, 100) };
  }
}

function extractTextFromHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, c) => String.fromCharCode(parseInt(c)))
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── Diccionario de triaje local ─────────────────────────────

async function cargarDiccionario() {
  const [personas, ejes] = await Promise.all([
    prisma.persona.findMany({ where: { activa: true }, select: { id: true, nombre: true } }),
    prisma.ejeTematico.findMany({ where: { activo: true }, select: { id: true, slug: true, keywords: true } }),
  ]);

  const asambleistas = new Map<string, string>();
  for (const p of personas) {
    const norm = p.nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9áéíóúñü\s]/g, '').replace(/\s+/g, ' ').trim();
    if (norm.length >= 3) asambleistas.set(norm, p.id);
  }

  const keywords = new Map<string, string[]>();
  for (const eje of ejes) {
    if (!eje.keywords) continue;
    const kws = eje.keywords.split(',').map(k => k.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9áéíóúñü\s]/g, '').replace(/\s+/g, ' ').trim()).filter(k => k.length >= 3);
    for (const kw of kws) {
      keywords.set(kw, [...(keywords.get(kw) || []), eje.slug]);
    }
  }

  const indicadoresKeywords = [
    ['tipo de cambio', 'dolar', 'dolar oficial', 'dolar paralelo', 'brecha cambiaria', 'devaluacion', 'devaluación'],
    ['reservas internacionales', 'reservas netas', 'rin', 'divisas'],
    ['inflacion', 'ipc', 'indice de precios', 'canasta familiar'],
    ['litio', 'carbonato de litio', 'ylb', 'salar de uyuni', 'baterias'],
    ['gas natural', 'gnp', 'exportacion de gas', 'ypfb', 'volumen de gas'],
    ['zinc', 'estaño', 'plata', 'lme', 'precio del zinc', 'precio minero', 'comibol', 'huanuni'],
    ['deficit fiscal', 'presupuesto', 'tgn', 'gasto fiscal', 'financiamiento'],
    ['pib', 'producto interno bruto', 'crecimiento economico', 'recesion'],
  ];
  const indicadores = new Map<string, string>();
  for (const [slugs] of indicadoresKeywords) {
    for (const kw of slugs) {
      indicadores.set(kw, slugs[0]);
    }
  }

  console.log(`[Diccionario] ${asambleistas.size} asambleistas, ${keywords.size} keywords de ejes, ${indicadores.size} indicadores`);
  return { asambleistas, keywords, indicadores };
}

function trijarNotaLocal(nota: NotaLink, lead: string, dict: any): { match: boolean; puntaje: number; razon: string } {
  const texto = `${nota.titulo} ${lead}`.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9áéíóúñü\s-]/g, ' ').replace(/\s+/g, ' ').trim();
  if (texto.length < 10) return { match: false, puntaje: 0, razon: '' };

  let puntaje = 0;
  const matchedPersonas: string[] = [];
  const matchedKeywords: string[] = [];

  // Asambleistas
  for (const [nombre, id] of dict.asambleistas as Map<string, string>) {
    if (texto.includes(nombre)) {
      matchedPersonas.push(nombre);
      puntaje += 3;
    } else {
      const partes = nombre.split(' ');
      if (partes.length >= 2) {
        const apellidos = partes.slice(1).join(' ');
        if (apellidos.length >= 6 && texto.includes(apellidos)) {
          matchedPersonas.push(nombre);
          puntaje += 2;
        }
      }
    }
  }

  // Keywords de ejes
  for (const [kw, ejes] of dict.keywords as Map<string, string[]>) {
    if (texto.includes(kw)) {
      matchedKeywords.push(kw);
      puntaje += 1;
    }
  }

  // Keywords de indicadores
  for (const [kw] of dict.indicadores as Map<string, string>) {
    if (texto.includes(kw)) {
      matchedKeywords.push(kw);
      puntaje += 1;
    }
  }

  let razon = '';
  if (matchedPersonas.length > 0) razon = `Asambleista: ${matchedPersonas[0]}`;
  else if (matchedKeywords.length > 0) razon = `Keywords: ${matchedKeywords.slice(0, 3).join(', ')}`;

  return { match: puntaje >= 1, puntaje, razon };
}

// ─── Pipeline principal ──────────────────────────────────────

async function scrapeMedio(medio: MedioToScrape, dict: any) {
  const startTime = Date.now();
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`📋 ${medio.nombre} — ${medio.url}`);
  console.log(`${'═'.repeat(70)}`);

  // FASE 1: Descargar homepage
  console.log(`\n📥 FASE 1: Descargando homepage...`);
  const { html, status, error } = await fetchHtml(medio.url);

  if (!html || html.length < 500) {
    console.log(`  ❌ No se pudo obtener HTML: ${error || `HTTP ${status} (${html.length}B)`}`);
    
    // Registrar captura fallida
    await prisma.capturaLog.create({
      data: {
        medioId: medio.medioId,
        nivel: 'nacional',
        exitosa: false,
        totalArticulos: 0,
        mencionesEncontradas: 0,
        errores: error || `HTTP ${status} - HTML vacío`,
      }
    }).catch(() => {});

    return { ok: false, error: error || `HTTP ${status}` };
  }

  console.log(`  ✅ HTML descargado: ${(html.length / 1024).toFixed(0)} KB (HTTP ${status})`);

  // Extraer links
  const notas = extraerLinksDeNoticias(html, medio.url, MAX_LINKS);
  console.log(`  📰 ${notas.length} links de notas extraídos`);

  if (notas.length > 0) {
    for (let i = 0; i < Math.min(5, notas.length); i++) {
      console.log(`     ${i + 1}. "${notas[i].titulo.substring(0, 60)}"`);
    }
    if (notas.length > 5) console.log(`     ... y ${notas.length - 5} más`);
  }

  // Enriquecer con leads
  for (const nota of notas) {
    nota.lead = extraerLeadDeBloque(html, nota.url);
  }

  // FASE 2: Triaje por keywords
  console.log(`\n🔍 FASE 2: Triaje por keywords...`);
  const seleccionadas: (NotaLink & { puntaje: number; razon: string })[] = [];

  for (const nota of notas) {
    const result = trijarNotaLocal(nota, nota.lead || '', dict);
    if (result.match) {
      seleccionadas.push({ ...nota, puntaje: result.puntaje, razon: result.razon });
      console.log(`  ✅ "${nota.titulo.substring(0, 50)}" — ${result.razon} (${result.puntaje}pts)`);
    }
  }

  seleccionadas.sort((a, b) => b.puntaje - a.puntaje);
  console.log(`  📊 ${seleccionadas.length} de ${notas.length} notas pasaron el triaje`);

  if (seleccionadas.length === 0) {
    console.log(`  ⏭️ Sin notas relevantes — registrando y avanzando...`);
    
    await prisma.capturaLog.create({
      data: {
        medioId: medio.medioId,
        nivel: 'nacional',
        exitosa: true,
        totalArticulos: notas.length,
        mencionesEncontradas: 0,
        errores: `Triaje: 0 de ${notas.length} notas relevantes`,
      }
    }).catch(() => {});

    return { ok: true, fase1: notas.length, fase2: 0, fase3: 0, menciones: 0 };
  }

  // FASE 3: Descargar y clasificar con LLM
  const aClasificar = seleccionadas.slice(0, MAX_NOTAS_A_CLASIFICAR);
  console.log(`\n🤖 FASE 3: Clasificando ${aClasificar.length} notas con LLM...`);

  let totalMenciones = 0;

  for (let i = 0; i < aClasificar.length; i++) {
    const nota = aClasificar[i];
    if (i > 0) await sleep(DELAY_ENTRE_NOTAS);

    console.log(`\n  📄 Nota ${i + 1}/${aClasificar.length}: "${nota.titulo.substring(0, 60)}"`);
    console.log(`     URL: ${nota.url}`);

    // Descargar nota individual
    const notaResult = await fetchHtml(nota.url);
    if (!notaResult.html || notaResult.html.length < 200) {
      console.log(`     ❌ No se pudo descargar la nota (HTTP ${notaResult.status})`);
      continue;
    }

    const texto = extractTextFromHtml(notaResult.html);
    console.log(`     📝 Texto extraído: ${texto.length} chars`);

    if (texto.length < 100) {
      console.log(`     ⏭️ Texto muy corto — saltando`);
      continue;
    }

    // Clasificar con LLM (usando la API de Z.ai)
    try {
      const ZAIConstructor = (await import('z-ai-web-dev-sdk')).default;
      const zai = await ZAIConstructor.create();

      const prompt = `Eres un analista de medios de Bolivia. Analiza esta noticia y determina:

1. ¿Es relevante para el monitoreo legislativo/parlamentario de Bolivia?
2. Menciona a algún asambleista, diputado, senador o autoridad gubernamental?
3. ¿Qué tratamiento periodístico tiene? (neutral, favorable, crítico, alarmista)
4. ¿A qué eje temático pertenece? (economía, política, hidrocarburos, minería, medio ambiente, etc.)

NOTICIA:
---
Título: ${nota.titulo}
Texto: ${texto.substring(0, 3000)}
---

Responde en JSON:
{
  "es_relevante": true/false,
  "personas_mencionadas": ["nombre1", "nombre2"],
  "tratamiento_periodistico": "neutral|favorable|critico|alarmista",
  "eje_tematico": "economia|politica|...",
  "resumen": "resumen de 1 línea",
  "sentimiento": "positivo|negativo|neutro|mixto"
}`;

      const completion = await zai.chat.completions.create({
        messages: [
          { role: 'system', content: 'Eres un analista de medios de Bolivia, experto en política y economía boliviana. Respondes solo en JSON válido.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 500,
      });

      const responseText = completion.choices[0]?.message?.content || '';
      console.log(`     🤖 LLM: ${responseText.substring(0, 150)}...`);

      // Parsear respuesta del LLM
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          
          if (parsed.es_relevante) {
            // Crear mención en la DB
            const fechaMatch = nota.url.match(/\/(\d{4})\/(\d{2})\/(\d{2})/);
            const fechaPublicacion = fechaMatch ? new Date(`${fechaMatch[1]}-${fechaMatch[2]}-${fechaMatch[3]}`) : new Date();
            
            await prisma.mencion.create({
              data: {
                titulo: nota.titulo,
                texto: texto.substring(0, 500),
                textoCompleto: texto,
                url: nota.url,
                fechaPublicacion,
                tipoMencion: 'noticia',
                sentimiento: parsed.sentimiento || 'neutro',
                tratamientoPeriodistico: parsed.tratamiento_periodistico || 'neutral',
                medioId: medio.medioId,
                activa: true,
                createdAt: new Date(),
              }
            });
            
            totalMenciones++;
            console.log(`     ✅ MENCION CREADA (${parsed.eje_tematico}, ${parsed.sentimiento})`);
          } else {
            console.log(`     ⏭️ No relevante según LLM`);
          }
        } catch (parseErr) {
          console.log(`     ⚠️ Error parseando JSON del LLM`);
        }
      }
    } catch (llmErr: any) {
      console.log(`     ❌ Error LLM: ${llmErr.message?.substring(0, 80)}`);
    }
  }

  // Registrar captura log
  await prisma.capturaLog.create({
    data: {
      medioId: medio.medioId,
      nivel: 'nacional',
      exitosa: true,
      totalArticulos: notas.length,
      mencionesEncontradas: totalMenciones,
    }
  }).catch(() => {});

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
  console.log(`\n✅ ${medio.nombre}: ${notas.length} notas → ${seleccionadas.length} triaje → ${totalMenciones} menciones [${elapsed}s]`);

  return { ok: true, fase1: notas.length, fase2: seleccionadas.length, fase3: aClasificar.length, menciones: totalMenciones, elapsed: `${elapsed}s` };
}

// ─── Main ────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║   SCRAPING COMPLETO — 13 MEDIOS CORREGIDOS                  ║');
  console.log('║   Pipeline 3 fases: Links → Triaje → LLM                    ║');
  console.log(`║   Fecha: ${new Date().toISOString()}            ║`);
  console.log('╚══════════════════════════════════════════════════════════════╝');

  // Cargar diccionario de keywords
  const dict = await cargarDiccionario();

  const resultados: Record<string, any> = {};
  let totalGlobalMenciones = 0;

  for (let i = 0; i < MEDIOS.length; i++) {
    const medio = MEDIOS[i];
    console.log(`\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`MEDIOS ${i + 1}/${MEDIOS.length}: ${medio.nombre}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    try {
      const result = await scrapeMedio(medio, dict);
      resultados[medio.nombre] = result;
      if (result.menciones) totalGlobalMenciones += result.menciones;
    } catch (err: any) {
      console.log(`  💥 ERROR GLOBAL: ${err.message?.substring(0, 100)}`);
      resultados[medio.nombre] = { ok: false, error: err.message };
    }

    // Rate limit entre medios
    if (i < MEDIOS.length - 1) {
      console.log(`\n  ⏳ Esperando ${DELAY_ENTRE_MEDIOS / 1000}s antes del siguiente medio...`);
      await sleep(DELAY_ENTRE_MEDIOS);
    }
  }

  // ─── Resumen final ──────────────────────────────────────────
  console.log(`\n\n${'═'.repeat(70)}`);
  console.log('📊 RESUMEN FINAL');
  console.log(`${'═'.repeat(70)}`);
  console.log(`\n${'MEDIO'.padEnd(25)} | FASE1 | FASE2 | FASE3 | MENCIONES | STATUS`);
  console.log(`${'─'.repeat(70)}`);

  let ok = 0, fail = 0, mencionesTotales = 0;
  for (const [nombre, r] of Object.entries(resultados)) {
    if (r.ok) {
      ok++;
      mencionesTotales += r.menciones || 0;
      console.log(`${nombre.padEnd(25)} | ${(r.fase1 ?? '-').toString().padStart(5)} | ${(r.fase2 ?? '-').toString().padStart(5)} | ${(r.fase3 ?? '-').toString().padStart(5)} | ${(r.menciones ?? 0).toString().padStart(8)} | ✅ ${r.elapsed || ''}`);
    } else {
      fail++;
      console.log(`${nombre.padEnd(25)} | ${'—'.padStart(5)} | ${'—'.padStart(5)} | ${'—'.padStart(5)} | ${'0'.padStart(8)} | ❌ ${r.error?.substring(0, 30) || 'fail'}`);
    }
  }

  console.log(`${'─'.repeat(70)}`);
  console.log(`${'TOTAL'.padEnd(25)} |         |         |         | ${mencionesTotales.toString().padStart(8)} | ${ok} OK / ${fail} FAIL`);
  console.log(`\n✅ Scraping completado: ${mencionesTotales} menciones nuevas creadas en la base de datos`);

  await prisma.$disconnect();
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
