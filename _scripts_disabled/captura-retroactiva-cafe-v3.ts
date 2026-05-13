/**
 * Limpieza + Captura Retroactiva v3.1 — Café
 * =============================================
 * PASO A: Eliminar menciones de café de baja calidad
 * PASO B: Re-capturar con RSS feeds + scoring estricto
 * 
 * Criterios de eliminación:
 * - Páginas de navegación (login, faq, about, contact, membership)
 * - Título < 20 caracteres
 * - Texto < 500 caracteres
 * - Score café < 3 en texto completo
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasourceUrl: 'file:/home/z/my-project/prisma/db/custom.db',
});

// ─── Nav/spam patterns ─────────────────────────────────────────────

const NAV_PATTERNS = [
  'login', 'register', 'signup', 'sign-up', 'contact', 'contacto',
  'about', 'about-us', 'faq', 'membership', 'volunteer', 'work-with',
  'board', 'governance', 'secretariat', 'director', 'careers',
  'privacy', 'terms', 'cookies', 'sitemap', 'search',
  'wp-login', 'wp-admin', 'xmlrpc', 'feed',
  'descarga.php', 'formulario.php',
  'Área Nacional', 'Área de Registro',
];

// High-signal keywords (must score ≥ 3 to keep)
const COFFEE_KW = [
  'coffee', 'café', 'cafe', 'cafetalero', 'cafetero', 'caficultura',
  'arabica', 'robusta', 'espresso', 'barista', 'torrefaccion', 'tueste', 'cata', 'cupping',
  'fermentacion', 'procesamiento', 'grano verde',
  'yungas', 'caranavi', 'sud yungas', 'nor yungas',
  'cenaproc', 'coaine', 'coabol',
  'c-market', 'coffee price', 'coffee market',
  'specialty coffee', 'coffee beans', 'green coffee',
  'coffee harvest', 'coffee season', 'coffee yield',
  'coffee export', 'coffee trade', 'coffee industry',
  'cup of excellence', 'fair trade', 'organic coffee',
  'coffee certification', 'coffee leaf rust', 'roya',
  'sca', 'ico', 'international coffee',
  'coffee farmer', 'coffee farming', 'coffee production',
  'coffee consumption', 'coffee demand', 'coffee supply',
  'coffee futures', 'coffee commodities', 'commodities',
  'ibce', 'senasag', 'eudr',
  'bolivia coffee', 'bolivian coffee',
  'cafetal', 'cafetales', 'cosecha', 'floracion',
  'precios del cafe', 'precio del cafe', 'mercado del cafe',
  'produccion de cafe', 'exportacion de cafe',
  'fermentacion anaerobica', 'fermentacion controlada',
  'third wave', 'single origin', 'direct trade',
  'cafe de especialidad', 'cafe de altura', 'cafe organico',
  'coffee shop', 'latte art', 'coffee roasting',
  'lactic fermentation', 'regenerative coffee',
  'coffee processing', 'washed coffee', 'honey process',
  'cafe artesanal', 'trazabilidad', 'puntaje',
];

function normalize(text: string): string {
  return text.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function scoreCoffee(text: string): number {
  const norm = normalize(text);
  let score = 0;
  for (const kw of COFFEE_KW) {
    if (norm.includes(kw)) score++;
  }
  return score;
}

function isNavPage(url: string, title: string): boolean {
  const check = (url + ' ' + title).toLowerCase();
  return NAV_PATTERNS.some(p => check.includes(p));
}

// ─── PASO A: CLEANUP ─────────────────────────────────────────────

async function cleanup() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  PASO A: LIMPIEZA DE MENCIONES DE CAFÉ');
  console.log('═══════════════════════════════════════════════════\n');

  const lente9 = await prisma.lente.findFirst({ where: { slug: 'cafe-economicas-regionales' } });
  if (!lente9) { console.log('❌ Lente 9 no encontrado'); return 0; }

  // Get all coffee mentions
  const menciones = await prisma.$queryRawUnsafe(
    `SELECT m.id, m.titulo, m.textoCompleto, m.url, m2.nombre as medio
     FROM Mencion m
     JOIN MencionLente ml ON ml.mencionId = m.id
     JOIN Medio m2 ON m2.id = m.medioId
     WHERE ml.lenteId = '${lente9.id}'`
  );

  console.log(`Total menciones Lente 9: ${menciones.length}\n`);

  let eliminated = 0;
  let kept = 0;
  const toDelete: string[] = [];

  for (const m of (menciones as any[])) {
    const title = m.titulo || '';
    const url = m.url || '';
    const text = m.textoCompleto || '';

    // Check nav patterns
    if (isNavPage(url, title)) {
      console.log(`  🗑️ NAV: ${title.substring(0, 60)} | ${m.medio}`);
      toDelete.push(m.id);
      eliminated++;
      continue;
    }

    // Check short text
    if (text.length < 500) {
      console.log(`  🗑️ CORTO(${text.length}): ${title.substring(0, 60)} | ${m.medio}`);
      toDelete.push(m.id);
      eliminated++;
      continue;
    }

    // Check short title
    if (title.replace(/<[^>]+>/g, '').trim().length < 20) {
      console.log(`  🗑️ TÍTULO CORTO: ${title.substring(0, 60)} | ${m.medio}`);
      toDelete.push(m.id);
      eliminated++;
      continue;
    }

    // Check coffee score on full text
    const score = scoreCoffee(text);
    if (score < 3) {
      console.log(`  🗑️ SCORE ${score}: ${title.substring(0, 60)} | ${m.medio}`);
      toDelete.push(m.id);
      eliminated++;
      continue;
    }

    kept++;
    console.log(`  ✅ KEEP (${score}): ${title.substring(0, 60)} | ${m.medio}`);
  }

  // Delete bad mentions
  if (toDelete.length > 0) {
    console.log(`\nEliminando ${toDelete.length} menciones de baja calidad...`);
    
    // Delete MencionLente records first
    for (const id of toDelete) {
      await prisma.mencionLente.deleteMany({ where: { mencionId: id } });
    }
    // Delete the mentions
    const result = await prisma.mencion.deleteMany({
      where: { id: { in: toDelete } },
    });
    console.log(`✅ Eliminadas: ${result.count} menciones`);
  }

  console.log(`\n📊 Resultado limpieza: ${eliminated} eliminadas, ${kept} mantenidas`);
  return kept;
}

// ─── PASO B: RE-CAPTURE ──────────────────────────────────────────

function getRandomUA(): string {
  const uas = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
    'Mozilla/5.0 (X11; Linux x86_64; rv:126.0) Gecko/20100101 Firefox/126.0',
  ];
  return uas[Math.floor(Math.random() * uas.length)];
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

interface RSSItem {
  url: string; title: string; pubDate?: Date; description?: string;
}

function parseRSS(xml: string, baseUrl: string): RSSItem[] {
  const items: RSSItem[] = [];
  const itemRegex = /<item[\s\S]*?<\/item>/gi;
  let m: RegExpExecArray | null;
  while ((m = itemRegex.exec(xml)) !== null) {
    const block = m[0];
    const titleMatch = block.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>|<title>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? (titleMatch[1] || titleMatch[2] || '').replace(/<[^>]+>/g, '').trim() : '';
    const linkMatch = block.match(/<link><!\[CDATA\[([\s\S]*?)\]\]><\/link>|<link>([\s\S]*?)<\/link>/i);
    let link = linkMatch ? (linkMatch[1] || linkMatch[2] || '').trim() : '';
    if (link.startsWith('/')) { try { link = new URL(link, baseUrl).href; } catch { continue; } }
    const dateMatch = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/i);
    let pubDate: Date | undefined;
    if (dateMatch) { const p = new Date(dateMatch[1].trim()); if (!isNaN(p.getTime())) pubDate = p; }
    const descMatch = block.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>|<description>([\s\S]*?)<\/description>/i);
    const description = descMatch ? (descMatch[1] || descMatch[2] || '').replace(/<[^>]+>/g, '').trim() : '';
    if (title && link && link.startsWith('http')) items.push({ url: link, title, pubDate, description });
  }
  return items;
}

interface ArticleLink {
  url: string; title: string; pubDate?: Date;
}

function extractArticleLinks(html: string, baseUrl: string): ArticleLink[] {
  const links: ArticleLink[] = [];
  const seen = new Set<string>();
  const pattern = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(html)) !== null) {
    let href = m[1];
    const innerHtml = m[2].replace(/<[^>]+>/g, '').trim();
    if (href.startsWith('/')) { try { href = new URL(href, baseUrl).href; } catch { continue; } }
    if (!href.startsWith('http') || href.includes('javascript:') || href.includes('#')) continue;
    let title = innerHtml.length > 8 ? innerHtml.substring(0, 200) : '';
    if (!title) { const slug = href.split('/').filter(Boolean).pop() || ''; title = slug.replace(/[-_]/g, ' ').replace(/\.\w+$/, '').trim(); }

    // Extract date from URL
    const datePatterns = [/\/(\d{4})\/(\d{2})\/(\d{2})/, /\/(\d{4})-(\d{2})-(\d{2})/, /\/(\d{4})\/(\d{2})\//];
    let pubDate: Date | undefined;
    for (const dp of datePatterns) {
      const dm = href.match(dp);
      if (dm) {
        const year = parseInt(dm[1]), month = parseInt(dm[2]) - 1, day = dm[3] ? parseInt(dm[3]) : 1;
        if (year >= 2024) { pubDate = new Date(year, month, day); break; }
      }
    }
    const key = href.split('?')[0];
    if (seen.has(key)) continue;
    seen.add(key);
    links.push({ url: href, title, pubDate });
  }
  return links;
}

function extractDateFromHTML(html: string): Date | undefined {
  const timeMatch = html.match(/<time[^>]+datetime=["']([^"']+)["']/i);
  if (timeMatch) { const d = new Date(timeMatch[1]); if (!isNaN(d.getTime())) return d; }
  const metaMatch = html.match(/<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)["']/i);
  if (metaMatch) { const d = new Date(metaMatch[1]); if (!isNaN(d.getTime())) return d; }
  const jsonldMatch = html.match(/"datePublished"\s*:\s*"([^"]+)"/i);
  if (jsonldMatch) { const d = new Date(jsonldMatch[1]); if (!isNaN(d.getTime())) return d; }
  return undefined;
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
    .replace(/&mdash;/g, '—').replace(/&ndash;/g, '–').replace(/&#(\d+);/g, '')
    .replace(/\s+/g, ' ').trim();
}

interface SourceConfig {
  nombre: string;
  urls: string[];
  rssUrls?: string[];
  maxArticles: number;
  delayMs: number;
}

const SOURCES: SourceConfig[] = [
  {
    nombre: 'Perfect Daily Grind',
    urls: ['https://perfectdailygrind.com/category/origins/', 'https://perfectdailygrind.com/'],
    rssUrls: ['https://perfectdailygrind.com/feed/'],
    maxArticles: 15, delayMs: 3000,
  },
  {
    nombre: 'Minuta de Café',
    urls: ['https://minutadecafe.com/', 'https://www.minutadecafe.com/'],
    rssUrls: ['https://minutadecafe.com/feed/', 'https://www.minutadecafe.com/feed/'],
    maxArticles: 10, delayMs: 4000,
  },
  {
    nombre: 'OIC Café',
    urls: ['https://ico.org/new/', 'https://ico.org/about-us/press-releases/'],
    rssUrls: ['https://ico.org/feed/'],
    maxArticles: 10, delayMs: 4000,
  },
  {
    nombre: 'SCA',
    urls: ['https://sca.coffee/news/', 'https://sca.coffee/'],
    rssUrls: ['https://sca.coffee/feed/'],
    maxArticles: 8, delayMs: 4000,
  },
  {
    nombre: 'Coffee Review',
    urls: ['https://www.coffeereview.com/reviews/', 'https://coffeereview.com/'],
    rssUrls: ['https://www.coffeereview.com/feed/'],
    maxArticles: 8, delayMs: 4000,
  },
  {
    nombre: 'Investing.com Café',
    urls: ['https://www.investing.com/news/commodities/'],
    rssUrls: ['https://www.investing.com/rss/news_301.xml'],
    maxArticles: 10, delayMs: 4000, 
  },
  {
    nombre: 'TradingView Café',
    urls: ['https://www.tradingview.com/news/'],
    maxArticles: 8, delayMs: 4000,
  },
  {
    nombre: 'Reuters Commodities',
    urls: ['https://www.reuters.com/business/commodities/'],
    maxArticles: 8, delayMs: 4000,
  },
  {
    nombre: 'World Coffee Research',
    urls: ['https://worldcoffeeresearch.org/news/'],
    rssUrls: ['https://worldcoffeeresearch.org/feed/'],
    maxArticles: 5, delayMs: 4000,
  },
  {
    nombre: 'Coffee Universe',
    urls: ['https://www.coffeeuniverse.com/'],
    rssUrls: ['https://www.coffeeuniverse.com/feed/'],
    maxArticles: 5, delayMs: 4000,
  },
  {
    nombre: 'Sprudge Coffee',
    urls: ['https://sprudge.com/'],
    rssUrls: ['https://sprudge.com/feed/'],
    maxArticles: 5, delayMs: 4000,
  },
];

async function recapture(existingCount: number) {
  console.log('\n═══════════════════════════════════════════════════');
  console.log('  PASO B: RE-CAPTURA CON RSS + SCORING ESTRICTO');
  console.log('═══════════════════════════════════════════════════\n');

  const lente9 = await prisma.lente.findFirst({ where: { slug: 'cafe-economicas-regionales' } });
  if (!lente9) { console.log('❌ Lente 9 no encontrado'); return; }

  const medios = await prisma.medio.findMany({
    where: { nombre: { in: SOURCES.map(s => s.nombre) } },
    select: { id: true, nombre: true },
  });
  const medioMap: Record<string, string> = {};
  for (const m of medios) medioMap[m.nombre] = m.id;

  const stats: Record<string, { rss: boolean; links: number; processed: number; created: number; errors: string[] }> = {};

  for (const source of SOURCES) {
    const medioId = medioMap[source.nombre];
    if (!medioId) {
      console.log(`❌ ${source.nombre}: no medioId`);
      continue;
    }
    stats[source.nombre] = { rss: false, links: 0, processed: 0, created: 0, errors: [] };

    console.log(`${'─'.repeat(55)}`);
    console.log(`📡 ${source.nombre}`);

    let articlesToProcess: ArticleLink[] = [];
    let usedRSS = false;

    // Try RSS first
    if (source.rssUrls?.length) {
      for (const rssUrl of source.rssUrls) {
        const xml = await fetchPage(rssUrl, 20000);
        if (xml.length > 200) {
          const items = parseRSS(xml, rssUrl);
          console.log(`   RSS: ${items.length} items`);
          for (const item of items) {
            const score = scoreCoffee(item.title + ' ' + (item.description || '') + ' ' + item.url);
            if (score >= 2 && !isNavPage(item.url, item.title)) {
              articlesToProcess.push({ url: item.url, title: item.title, pubDate: item.pubDate });
            }
          }
          if (items.length > 0) { usedRSS = true; break; }
        }
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    // HTML fallback
    if (!usedRSS) {
      for (const url of source.urls) {
        const html = await fetchPage(url, 25000);
        if (html.length > 500) {
          const links = extractArticleLinks(html, url);
          for (const link of links) {
            if (!isNavPage(link.url, link.title)) {
              const score = scoreCoffee(link.title + ' ' + link.url);
              if (score >= 2) articlesToProcess.push(link);
            }
          }
          if (links.length > 0) break;
        }
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    stats[source.nombre].rss = usedRSS;
    stats[source.nombre].links = articlesToProcess.length;

    if (articlesToProcess.length === 0) {
      stats[source.nombre].errors.push('Sin links relevantes');
      console.log(`   ⚠️ Sin artículos relevantes\n`);
      continue;
    }

    console.log(`   Candidatos: ${articlesToProcess.length}, Max: ${source.maxArticles}`);

    const toProcess = articlesToProcess.slice(0, source.maxArticles);
    for (let i = 0; i < toProcess.length; i++) {
      const art = toProcess[i];
      console.log(`   [${i+1}/${toProcess.length}] ${art.title.substring(0,65)}`);

      // Dedup check
      const exists = await prisma.mencion.count({ where: { url: art.url } });
      if (exists > 0) { console.log(`     → duplicado`); stats[source.nombre].processed++; continue; }
      stats[source.nombre].processed++;

      await new Promise(r => setTimeout(r, source.delayMs));
      const artHtml = await fetchPage(art.url, 20000);
      if (!artHtml) { console.log(`     → no HTML`); continue; }

      const artText = stripHtml(artHtml);
      if (artText.length < 500) { console.log(`     → corto (${artText.length})`); continue; }

      const artScore = scoreCoffee(artText.substring(0, 4000));
      if (artScore < 3) { console.log(`     → score ${artScore} < 3`); continue; }

      // Skip nav pages in article content
      const cleanTitle = art.title.replace(/<[^>]+>/g, '').trim();
      if (cleanTitle.length < 20 || isNavPage(art.url, cleanTitle)) {
        console.log(`     → nav/página no válida`);
        continue;
      }

      let pubDate = art.pubDate || extractDateFromHTML(artHtml);
      if (!pubDate || isNaN(pubDate.getTime())) pubDate = new Date();

      try {
        const menc = await prisma.mencion.create({
          data: {
            medioId,
            titulo: cleanTitle.substring(0, 300),
            texto: artText.substring(0, 1000),
            textoCompleto: artText.substring(0, 8000),
            url: art.url,
            fechaCaptura: new Date(),
            fechaPublicacion: pubDate,
            tipoMencion: 'mencion_pasiva',
            enlaceActivo: true,
            temas: 'cafe,especialidad,mercado',
          },
        });
        await prisma.mencionLente.create({ data: { mencionId: menc.id, lenteId: lente9.id } }).catch(() => {});
        stats[source.nombre].created++;
        console.log(`     ✅ (${menc.id.substring(0,8)}) score:${artScore} fecha:${pubDate.toISOString().split('T')[0]}`);
      } catch (e: any) {
        console.log(`     ✗ ${e.message?.substring(0,60)}`);
      }
    }
    console.log('');
  }

  // Final summary
  const despues = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as c FROM MencionLente WHERE lenteId='${lente9.id}'`);
  const total = Number(despues[0].c);
  const nuevas = total - existingCount;

  console.log(`${'═'.repeat(55)}`);
  console.log('  RESULTADO FINAL');
  console.log('═'.repeat(55));
  console.log(`  Mantenidas: ${existingCount} | Nuevas: ${nuevas} | Total: ${total}`);
  console.log(`  Estado: ${total >= 15 ? '✅ SUFICIENTE para boletín' : '⚠️ INSUFICIENTE'}`);
  console.log('');
  for (const [name, s] of Object.entries(stats)) {
    const icon = s.created > 0 ? '✅' : '❌';
    const mode = s.rss ? 'RSS' : 'HTML';
    console.log(`  ${icon} ${name}: +${s.created} | ${mode} | ${s.links} candidatos | ${s.processed} procesados`);
  }
  console.log('');
}

// ─── MAIN ──────────────────────────────────────────────────────────

async function main() {
  const kept = await cleanup();
  await recapture(kept);
  await prisma.$disconnect();
}

main().catch(console.error);
