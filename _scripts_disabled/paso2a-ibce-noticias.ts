/**
 * PASO 2A: Captura Retroactiva — IBCE Notas de Prensa
 * =====================================================
 * - Scraper de noticias-detalle.php?idNot=XXX (IDs 60-967)
 * - Scoring por keywords de DB (713 keywords, 9 lentes, 9 ejes)
 * - SIN IA/LLM — solo keyword matching
 * - Delays conservadores: 8-10s entre requests
 * - Máx 15 artículos por ejecución
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasourceUrl: 'file:/home/z/my-project/prisma/db/custom.db',
});

// ─── Config ─────────────────────────────────────────────────────
const BASE_URL = 'https://ibce.org.bo';
const DELAY_MS = 8000;         // 8s entre requests
const MAX_ARTICLES = 15;       // Max por ejecución
const MIN_SCORE = 1;           // Score mínimo de keywords para aceptar
const START_ID = 967;          // Empezar desde ID más reciente
const END_ID = 950;            // Bajar hasta este ID

// ─── Helpers ────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms + Math.random() * 3000));
}

function getRandomUA(): string {
  const uas = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
    'Mozilla/5.0 (X11; Linux x86_64; rv:126.0) Gecko/20100101 Firefox/126.0',
  ];
  return uas[Math.floor(Math.random() * uas.length)];
}

function normalize(text: string): string {
  return text.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<aside[\s\S]*?<\/aside>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#039;/g, "'")
    .replace(/&mdash;/g, '—').replace(/&ndash;/g, '–')
    .replace(/&oacute;/g, 'ó').replace(/&iacute;/g, 'í').replace(/&aacute;/g, 'á')
    .replace(/&eacute;/g, 'é').replace(/&uacute;/g, 'ú').replace(/&ntilde;/g, 'ñ')
    .replace(/&ldquo;/g, '"').replace(/&rdquo;/g, '"')
    .replace(/&#(\d+);/g, '')
    .replace(/\s+/g, ' ').trim();
}

async function fetchPage(url: string, ms = 25000): Promise<string> {
  try {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), ms);
    const res = await fetch(url, {
      headers: {
        'User-Agent': getRandomUA(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-BO,es;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      signal: ctrl.signal,
      redirect: 'follow',
    });
    clearTimeout(tid);
    if (res.ok) {
      const text = await res.text();
      return text.length > 300 ? text : '';
    }
    return '';
  } catch { return ''; }
}

interface IBCEArticle {
  id: number;
  title: string;
  date: string;
  body: string;
  url: string;
}

function parseIBCEArticle(html: string, id: number): IBCEArticle | null {
  // Extract title from <title> tag
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  if (!titleMatch) return null;
  let title = stripHtml(titleMatch[1]);
  
  // Check if article exists — empty articles have title = "- IBCE" or just "IBCE"
  const cleanTitle = title.replace(/\s*[-–—]\s*IBCE\s*$/i, '').trim();
  if (!cleanTitle || cleanTitle.length < 10) return null;

  // Extract date from date-wrap div
  const dateMatch = html.match(/class="date">(\d{1,2})<\/span>[\s\S]*?class="month">([^<]+)/i);
  let dateStr = '';
  if (dateMatch) {
    const day = dateMatch[1].padStart(2, '0');
    const monthRaw = dateMatch[2].replace(/<br\s*\/?>/gi, ' ').replace(/<strong>/gi, '').replace(/<\/strong>/gi, '').trim();
    const yearMatch = monthRaw.match(/(\d{4})/);
    const year = yearMatch ? yearMatch[1] : '2025';
    const monthPart = monthRaw.replace(/\d{4}/g, '').trim();
    const months: Record<string, string> = {
      'enero': '01', 'febrero': '02', 'marzo': '03', 'abril': '04',
      'mayo': '05', 'junio': '06', 'julio': '07', 'agosto': '08',
      'septiembre': '09', 'octubre': '10', 'noviembre': '11', 'diciembre': '12',
    };
    const monthNum = months[monthPart.toLowerCase()] || '01';
    dateStr = `${year}-${monthNum}-${day}`;
  }

  // Extract body: find the blog container and get all <p> tags
  const bodyRegex = /class="blog"[\s\S]*?<\/div>/gi;
  const blogMatch = bodyRegex.exec(html);
  let body = '';
  if (blogMatch) {
    body = stripHtml(blogMatch[0]);
  } else {
    // Fallback: get all paragraphs in main content
    const paragraphs: string[] = [];
    const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
    let pm: RegExpExecArray | null;
    while ((pm = pRegex.exec(html)) !== null) {
      const pText = stripHtml(pm[1]).trim();
      if (pText.length > 30) paragraphs.push(pText);
    }
    body = paragraphs.join(' ');
  }

  return {
    id,
    title: cleanTitle,
    date: dateStr,
    body,
    url: `${BASE_URL}/noticias-detalle.php?idNot=${id}`,
  };
}

// ─── Keyword Scoring ────────────────────────────────────────────

interface LensKeyword {
  lenteId: string;
  lenteNombre: string;
  termino: string;
}

interface EjeKeyword {
  ejeId: string;
  ejeNombre: string;
  termino: string;
}

async function loadKeywords() {
  const lensKw = await prisma.$queryRawUnsafe(`
    SELECT k.termino, k.lenteId, l.nombre as lenteNombre
    FROM Keyword k
    JOIN Lente l ON l.id = k.lenteId
    WHERE k.activo = 1 AND k.lenteId IS NOT NULL
  `) as LensKeyword[];

  const ejeKw = await prisma.$queryRawUnsafe(`
    SELECT k.termino, k.ejeId, e.nombre as ejeNombre
    FROM Keyword k
    JOIN EjeTematico e ON e.id = k.ejeId
    WHERE k.activo = 1 AND k.ejeId IS NOT NULL
  `) as EjeKeyword[];

  return { lensKw, ejeKw };
}

function scoreText(text: string, keywords: { termino: string }[]): Map<string, number> {
  const norm = normalize(text);
  const scores = new Map<string, number>();
  for (const kw of keywords) {
    const kwNorm = normalize(kw.termino);
    if (kwNorm.length < 3) continue;
    // Count occurrences
    let count = 0;
    let idx = norm.indexOf(kwNorm);
    while (idx !== -1) {
      count++;
      idx = norm.indexOf(kwNorm, idx + 1);
    }
    if (count > 0) {
      scores.set(kw.termino, (scores.get(kw.termino) || 0) + count);
    }
  }
  return scores;
}

// ─── MAIN ───────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  PASO 2A: CAPTURA IBCE NOTAS DE PRENSA');
  console.log('  Delays: 12-15s | Max: ' + MAX_ARTICLES + ' artículos | IDs: ' + START_ID + '-' + END_ID);
  console.log('  Scoring: Keywords ONLY (sin IA/LLM)');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Load keywords from DB
  const { lensKw, ejeKw } = await loadKeywords();
  console.log(`Keywords cargados: ${lensKw.length} lentes, ${ejeKw.length} ejes`);

  // Group by lente/eje for reporting
  const lentes = new Map<string, { nombre: string; terminos: string[] }>();
  for (const kw of lensKw) {
    if (!lentes.has(kw.lenteId)) lentes.set(kw.lenteId, { nombre: kw.lenteNombre, terminos: [] });
    lentes.get(kw.lenteId)!.terminos.push(kw.termino);
  }
  const ejes = new Map<string, { nombre: string; terminos: string[] }>();
  for (const kw of ejeKw) {
    if (!ejes.has(kw.ejeId)) ejes.set(kw.ejeId, { nombre: kw.ejeNombre, terminos: [] });
    ejes.get(kw.ejeId)!.terminos.push(kw.termino);
  }

  console.log(`Lentes: ${lentes.size}, Ejes: ${ejes.size}\n`);

  // Get IBCE medio
  const ibceMedio = await prisma.medio.findFirst({ where: { nombre: { contains: 'IBCE' } } });
  if (!ibceMedio) {
    console.log('❌ Medio IBCE no encontrado en DB');
    await prisma.$disconnect();
    return;
  }
  console.log(`Medio IBCE: ${ibceMedio.id} (${ibceMedio.nombre})\n`);

  // Get existing IBCE URLs to avoid duplicates
  const existingUrls = new Set<string>();
  const existing = await prisma.mencion.findMany({
    where: { medioId: ibceMedio.id },
    select: { url: true },
  });
  for (const e of existing) existingUrls.add(e.url);
  console.log(`Menciones IBCE existentes: ${existingUrls.size}\n`);

  // Count before
  const beforeCount = await prisma.mencion.count();
  console.log(`Menciones totales antes: ${beforeCount}\n`);

  // ─── Scrape articles ─────────────────────────────────────────
  const results: {
    id: number; title: string; date: string; status: string;
    lensMatches: string[]; ejeMatches: string[]; score: number;
  }[] = [];

  let processed = 0;
  let validArticles = 0;
  let created = 0;
  let skippedDup = 0;
  let skippedScore = 0;

  for (let id = START_ID; id >= END_ID && processed < MAX_ARTICLES; id--) {
    processed++;
    const url = `${BASE_URL}/noticias-detalle.php?idNot=${id}`;
    
    // Progress
    const pct = Math.round(((START_ID - id) / (START_ID - END_ID)) * 100);
    process.stdout.write(`  [${pct}%] ID ${id}... `);

    // Check duplicate
    if (existingUrls.has(url)) {
      process.stdout.write('duplicado\n');
      skippedDup++;
      await delay(DELAY_MS);
      continue;
    }

    await delay(DELAY_MS);

    // Fetch article
    const html = await fetchPage(url, 25000);
    if (!html) {
      process.stdout.write('sin HTML\n');
      results.push({ id, title: '', date: '', status: 'sin_html', lensMatches: [], ejeMatches: [], score: 0 });
      continue;
    }

    // Parse article
    const article = parseIBCEArticle(html, id);
    if (!article) {
      process.stdout.write('vacío/inválido\n');
      results.push({ id, title: '', date: '', status: 'vacio', lensMatches: [], ejeMatches: [], score: 0 });
      continue;
    }

    validArticles++;
    const fullText = (article.title + ' ' + article.body).substring(0, 6000);

    // Score against lens keywords
    const lensScores = new Map<string, number>();
    for (const [lenteId, info] of lentes) {
      let score = 0;
      for (const term of info.terminos) {
        const normTerm = normalize(term);
        if (normTerm.length < 3) continue;
        if (normalize(fullText).includes(normTerm)) score++;
      }
      if (score > 0) lensScores.set(lenteId, score);
    }

    // Score against eje keywords
    const ejeScores = new Map<string, number>();
    for (const [ejeId, info] of ejes) {
      let score = 0;
      for (const term of info.terminos) {
        const normTerm = normalize(term);
        if (normTerm.length < 3) continue;
        if (normalize(fullText).includes(normTerm)) score++;
      }
      if (score > 0) ejeScores.set(ejeId, score);
    }

    // Total score
    const totalScore = lensScores.size + ejeScores.size;
    const matchedLentes = Array.from(lensScores.entries())
      .map(([id, s]) => `${lentes.get(id)?.nombre || id}(${s})`);
    const matchedEjes = Array.from(ejeScores.entries())
      .map(([id, s]) => `${ejes.get(id)?.nombre || id}(${s})`);

    // Skip if no keywords match
    if (totalScore < MIN_SCORE && article.body.length < 500) {
      process.stdout.write(`score ${totalScore} < ${MIN_SCORE}, corto\n`);
      skippedScore++;
      results.push({ id, title: article.title, date: article.date, status: 'bajo_score', lensMatches: matchedLentes, ejeMatches: matchedEjes, score: totalScore });
      continue;
    }

    // Accept article (even with score 0 if body is substantial — IBCE is a trusted source)
    if (totalScore === 0 && article.body.length < 800) {
      process.stdout.write(`score 0, cuerpo ${article.body.length} < 800\n`);
      skippedScore++;
      results.push({ id, title: article.title, date: article.date, status: 'bajo_score', lensMatches: [], ejeMatches: [], score: 0 });
      continue;
    }

    // Parse date
    let pubDate: Date | null = null;
    if (article.date) {
      pubDate = new Date(article.date + 'T12:00:00');
      if (isNaN(pubDate.getTime())) pubDate = null;
    }

    // Create mention
    try {
      const menc = await prisma.mencion.create({
        data: {
          medioId: ibceMedio.id,
          titulo: article.title.substring(0, 300),
          texto: article.body.substring(0, 1000),
          textoCompleto: article.body.substring(0, 8000),
          url: article.url,
          fechaCaptura: new Date(),
          fechaPublicacion: pubDate || undefined,
          tipoMencion: 'mencion_pasiva',
          enlaceActivo: true,
          temas: matchedLentes.join(',').substring(0, 200),
        },
      });

      // Link to matched lenses
      for (const [lenteId] of lensScores) {
        await prisma.mencionLente.create({
          data: { mencionId: menc.id, lenteId },
        }).catch(() => {});
      }

      // Link to matched ejes
      for (const [ejeId] of ejeScores) {
        await prisma.mencionTema.create({
          data: { mencionId: menc.id, ejeTematicoId: ejeId },
        }).catch(() => {});
      }

      created++;
      const scoreStr = totalScore > 0 ? `✅ score:${totalScore} lentes:[${matchedLentes.join(',')}]` : '✅ sin keywords (cuerpo largo)';
      process.stdout.write(`${scoreStr}\n`);
      
      results.push({
        id, title: article.title, date: article.date, status: 'creado',
        lensMatches: matchedLentes, ejeMatches: matchedEjes, score: totalScore,
      });
    } catch (e: any) {
      process.stdout.write(`error DB: ${e.message?.substring(0, 50)}\n`);
      results.push({ id, title: article.title, date: article.date, status: 'error_db', lensMatches: matchedLentes, ejeMatches: matchedEjes, score: totalScore });
    }
  }

  // ─── Summary ─────────────────────────────────────────────────
  const afterCount = await prisma.mencion.count();
  const newTotal = afterCount - beforeCount;

  console.log('\n' + '═'.repeat(60));
  console.log('  RESULTADO PASO 2A — IBCE NOTICIAS');
  console.log('═'.repeat(60));
  console.log(`  Procesados: ${processed} IDs (${START_ID}→${END_ID})`);
  console.log(`  Artículos válidos: ${validArticles}`);
  console.log(`  Duplicados (saltados): ${skippedDup}`);
  console.log(`  Score bajo (saltados): ${skippedScore}`);
  console.log(`  Creados: ${created}`);
  console.log(`  Total DB: ${beforeCount} → ${afterCount} (+${newTotal})`);
  console.log('');

  // Created articles detail
  const createdResults = results.filter(r => r.status === 'creado');
  if (createdResults.length > 0) {
    console.log('  ─── Artículos creados ───');
    for (const r of createdResults) {
      const lenses = r.lensMatches.length > 0 ? ` [${r.lensMatches.join(', ')}]` : '';
      const ejes = r.ejeMatches.length > 0 ? ` ${r.ejeMatches.join(', ')}` : '';
      console.log(`  📰 #${r.id} (${r.date}) ${r.title.substring(0, 55)}${lenses}${ejes}`);
    }
  }

  // Lens distribution of new mentions
  console.log('\n  ─── Distribución por Lente (nuevos) ───');
  const lensDist = new Map<string, number>();
  for (const r of createdResults) {
    for (const l of r.lensMatches) {
      const name = l.split('(')[0];
      lensDist.set(name, (lensDist.get(name) || 0) + 1);
    }
  }
  for (const [name, count] of Array.from(lensDist.entries()).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${name}: ${count}`);
  }

  // Eje distribution
  console.log('\n  ─── Distribución por Eje (nuevos) ───');
  const ejeDist = new Map<string, number>();
  for (const r of createdResults) {
    for (const e of r.ejeMatches) {
      const name = e.split('(')[0];
      ejeDist.set(name, (ejeDist.get(name) || 0) + 1);
    }
  }
  for (const [name, count] of Array.from(ejeDist.entries()).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${name}: ${count}`);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
