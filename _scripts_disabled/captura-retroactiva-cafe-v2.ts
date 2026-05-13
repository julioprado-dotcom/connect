// Captura Retroactiva v2 — Fuentes de Café
// Estrategia: Fetch homepage → extraer artículos → filtrar por coffee keywords
// Para fuentes Cloudflare: intentar URLs alternativas y con mayor timeout

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasourceUrl: 'file:/home/z/my-project/prisma/db/custom.db',
});

const COFFEE_KW = [
  'coffee', 'café', 'cafe', 'cafetalero', 'cafetero', 'caficultura',
  'arabica', 'robusta', 'espresso', 'latte', 'cappuccino',
  'barista', 'torrefacción', 'tueste', 'cata', 'cupping',
  'fermentación', 'procesamiento', 'grano verde',
  'yungas', 'caranavi', 'sud yungas', 'nor yungas',
  'cenaproc', 'coaine', 'coabol',
  'c-market', 'coffee price', 'coffee market',
  'specialty coffee', 'coffee beans', 'green coffee',
  'coffee harvest', 'coffee season', 'coffee yield',
  'coffee export', 'coffee trade', 'coffee industry',
  'cup of excellence', 'fair trade coffee', 'organic coffee',
  'coffee certification', 'coffee leaf rust', 'roya',
  'sca', 'ico', 'international coffee organization',
  'coffee farmer', 'coffee farming', 'coffee production',
  'coffee consumption', 'coffee demand', 'coffee supply',
  'coffee futures', 'coffee commodities', 'commodities',
  'ibce', 'senasag', 'eudr',
  'minutadecafe', 'perfectdailygrind',
  'bolivia coffee', 'bolivian coffee',
  'orígenes', 'origins',
  'cafetal', 'cafetales',
  'cosecha', 'floración',
];

function normalize(text: string): string {
  return text.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9áéíóúñü\s-]/g, ' ')
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

async function fetchPage(url: string, ms = 20000): Promise<string> {
  const uas = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/115.0',
  ];
  const ua = uas[Math.floor(Math.random() * uas.length)];
  try {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), ms);
    const res = await fetch(url, {
      headers: {
        'User-Agent': ua,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-BO,es;q=0.9,en-US;q=0.8,en;q=0.7',
        'Cache-Control': 'no-cache',
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
  } catch (e) {
    return '';
  }
}

function extractArticleLinks(html: string, baseUrl: string): Array<{ url: string; title: string }> {
  const links: Array<{ url: string; title: string }> = [];
  const seen = new Set<string>();

  // Match <a href="URL">TITLE</a> patterns
  const pattern = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(html)) !== null) {
    let href = m[1];
    const innerHtml = m[2].replace(/<[^>]+>/g, '').trim();

    if (href.startsWith('/')) {
      try { href = new URL(href, baseUrl).href; } catch { continue; }
    }
    if (!href.startsWith('http') || href.includes('javascript:') || href.includes('#')) continue;

    // Extract title: prefer innerHTML, fallback to URL slug
    let title = innerHtml.length > 8 ? innerHtml.substring(0, 200) : '';
    if (!title) {
      const slug = href.split('/').filter(Boolean).pop() || '';
      title = slug.replace(/[-_]/g, ' ').replace(/\.\w+$/, '').trim();
    }

    // Deduplicate by URL
    const key = href.split('?')[0];
    if (seen.has(key)) continue;
    seen.add(key);

    links.push({ url: href, title });
  }
  return links;
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── Main ────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  CAPTURA RETROACTIVA v2 — FUENTES DE CAFÉ');
  console.log('═══════════════════════════════════════════════════\n');

  // Resolve medios
  const medios = await prisma.medio.findMany({
    where: { nombre: { in: [
      'Perfect Daily Grind', 'Minuta de Café', 'OIC Café', 'SCA',
      'Coffee Review', 'IBCE', 'SENASAG', 'Investing.com Café',
      'TradingView Café', 'Reuters Commodities',
    ]}},
    select: { id: true, nombre: true },
  });
  const medioMap: Record<string, string> = {};
  for (const m of medios) medioMap[m.nombre] = m.id;

  const lente9 = await prisma.lente.findFirst({ where: { slug: 'cafe-economicas-regionales' } });
  if (!lente9) { console.log('ERROR: Lente 9'); return; }

  const antes = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as c FROM MencionLente WHERE lenteId='${lente9.id}'`);
  console.log(`Lente 9: ${lente9.id} | Menciones antes: ${Number(antes[0].c)}\n`);

  // Source configs with multiple URL strategies
  const sources: Array<{
    nombre: string; urls: string[]; maxArticles: number; delayMs: number;
  }> = [
    {
      nombre: 'Perfect Daily Grind',
      urls: [
        'https://perfectdailygrind.com/category/origins/',
        'https://perfectdailygrind.com/',
        'https://perfectdailygrind.com/category/news/',
      ],
      maxArticles: 15,
      delayMs: 5000,
    },
    {
      nombre: 'Minuta de Café',
      urls: [
        'https://minutadecafe.com/',
        'https://www.minutadecafe.com/',
      ],
      maxArticles: 10,
      delayMs: 5000,
    },
    {
      nombre: 'OIC Café',
      urls: [
        'https://ico.org/new/',
        'https://ico.org/about-us/press-releases/',
      ],
      maxArticles: 8,
      delayMs: 5000,
    },
    {
      nombre: 'SCA',
      urls: [
        'https://sca.coffee/news/',
        'https://sca.coffee/',
      ],
      maxArticles: 8,
      delayMs: 5000,
    },
    {
      nombre: 'Coffee Review',
      urls: [
        'https://www.coffeereview.com/reviews/',
        'https://coffeereview.com/',
      ],
      maxArticles: 8,
      delayMs: 5000,
    },
    {
      nombre: 'IBCE',
      urls: [
        'https://ibce.org.bo/',
        'https://www.ibce.org.bo/',
      ],
      maxArticles: 5,
      delayMs: 5000,
    },
    {
      nombre: 'SENASAG',
      urls: [
        'https://senasag.gob.bo/',
      ],
      maxArticles: 5,
      delayMs: 5000,
    },
    {
      nombre: 'Investing.com Café',
      urls: [
        'https://www.investing.com/news/commodities/',
        'https://www.investing.com/commodities/coffee-news',
      ],
      maxArticles: 8,
      delayMs: 5000,
    },
    {
      nombre: 'TradingView Café',
      urls: [
        'https://www.tradingview.com/news/',
      ],
      maxArticles: 8,
      delayMs: 5000,
    },
    {
      nombre: 'Reuters Commodities',
      urls: [
        'https://www.reuters.com/business/commodities/',
        'https://www.reuters.com/markets/commodities/coffee/',
      ],
      maxArticles: 8,
      delayMs: 5000,
    },
  ];

  const stats: Record<string, { fetched: number; articles: number; mentions: number; error?: string }> = {};

  for (const source of sources) {
    const medioId = medioMap[source.nombre];
    if (!medioId) {
      console.log(`❌ ${source.nombre}: medioId not found`);
      stats[source.nombre] = { fetched: 0, articles: 0, mentions: 0, error: 'no medioId' };
      continue;
    }

    stats[source.nombre] = { fetched: 0, articles: 0, mentions: 0 };
    console.log(`\n${'─'.repeat(50)}`);
    console.log(`📡 ${source.nombre}`);
    console.log(`   URLs: ${source.urls.length} | Max: ${source.maxArticles} artículos`);

    let allLinks: Array<{ url: string; title: string }> = [];

    // Try each URL until we get HTML
    for (const url of source.urls) {
      console.log(`   Fetching: ${url}`);
      const html = await fetchPage(url, 25000);
      if (html.length > 500) {
        stats[source.nombre].fetched = html.length;
        console.log(`   ✓ HTML: ${(html.length/1024).toFixed(1)} KB`);

        // Extract article links
        const links = extractArticleLinks(html, url);
        console.log(`   Links: ${links.length}`);

        // Score titles for coffee relevance
        for (const link of links) {
          const score = scoreCoffee(link.title + ' ' + link.url);
          if (score >= 2) {
            allLinks.push({ ...link, title: link.title + ` [score:${score}]` });
          }
        }
        console.log(`   Coffee-relevant: ${allLinks.length}`);

        // Also try homepage as a mention if high score
        const homeScore = scoreCoffee(stripHtml(html));
        if (homeScore >= 3) {
          const existing = await prisma.mencion.count({ where: { url } });
          if (existing === 0) {
            try {
              const menc = await prisma.mencion.create({
                data: {
                  medioId,
                  titulo: `[${source.nombre}] Homepage — ${new Date().toISOString().split('T')[0]}`,
                  texto: stripHtml(html).substring(0, 1000),
                  textoCompleto: stripHtml(html).substring(0, 6000),
                  url,
                  fechaCaptura: new Date(),
                  fechaPublicacion: new Date(),
                  tipoMencion: 'mencion_pasiva',
                  enlaceActivo: true,
                },
              });
              await prisma.mencionLente.create({ data: { mencionId: menc.id, lenteId: lente9.id } }).catch(() => {});
              stats[source.nombre].articles++;
              stats[source.nombre].mentions++;
              console.log(`   ✓ Homepage mención creada (score:${homeScore})`);
            } catch (e: any) { console.log(`   ✗ ${e.message?.substring(0, 80)}`); }
          }
        }
        break; // Got HTML, no need to try other URLs
      } else {
        console.log(`   ✗ Failed (${html.length} bytes)`);
      }
      await new Promise(r => setTimeout(r, 3000));
    }

    if (allLinks.length === 0) {
      stats[source.nombre].error = 'no coffee links';
      continue;
    }

    // Process top articles
    const toProcess = allLinks.slice(0, source.maxArticles);
    console.log(`   Procesando ${toProcess.length} artículos...`);

    for (let i = 0; i < toProcess.length; i++) {
      const link = toProcess[i];
      const cleanUrl = link.url.replace(/ \[score:\d+\]$/, '');
      console.log(`   [${i+1}/${toProcess.length}] ${link.title.substring(0, 70)}`);

      // Check duplicate
      const exists = await prisma.mencion.count({ where: { url: cleanUrl } });
      if (exists > 0) { console.log(`     → duplicado`); continue; }

      // Fetch article
      await new Promise(r => setTimeout(r, source.delayMs));
      const artHtml = await fetchPage(cleanUrl, 20000);
      if (!artHtml) { console.log(`     → no HTML`); continue; }

      const artText = stripHtml(artHtml);
      if (artText.length < 150) { console.log(`     → muy corto (${artText.length})`); continue; }

      const artScore = scoreCoffee(artText.substring(0, 3000));
      if (artScore < 2) { console.log(`     → score ${artScore} < 2`); continue; }

      // Create mention
      const cleanTitle = link.title.replace(/ \[score:\d+\]$/, '');
      try {
        const menc = await prisma.mencion.create({
          data: {
            medioId,
            titulo: cleanTitle.substring(0, 300),
            texto: artText.substring(0, 1000),
            textoCompleto: artText.substring(0, 8000),
            url: cleanUrl,
            fechaCaptura: new Date(),
            fechaPublicacion: new Date(),
            tipoMencion: 'mencion_pasiva',
            enlaceActivo: true,
          },
        });
        await prisma.mencionLente.create({ data: { mencionId: menc.id, lenteId: lente9.id } }).catch(() => {});
        stats[source.nombre].articles++;
        stats[source.nombre].mentions++;
        console.log(`     ✓ creada (${menc.id.substring(0,8)}) score:${artScore}`);
      } catch (e: any) {
        console.log(`     ✗ ${e.message?.substring(0, 80)}`);
      }
    }
  }

  // ─── Summary ────────────────────────────────────────────────
  const despues = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as c FROM MencionLente WHERE lenteId='${lente9.id}'`);
  const total = Number(despues[0].c);
  const nuevas = total - Number(antes[0].c);

  console.log(`\n\n${'═'.repeat(50)}`);
  console.log(`  RESULTADO FINAL`);
  console.log('═'.repeat(50));
  console.log(`Antes: ${Number(antes[0].c)} | Después: ${total} | Nuevas: ${nuevas}\n`);

  console.log('── Por fuente ──');
  for (const [name, s] of Object.entries(stats)) {
    const icon = s.mentions > 0 ? '✅' : '❌';
    console.log(`  ${icon} ${name}: ${s.mentions} menciones (HTML:${s.fetched ? (s.fetched/1024).toFixed(0)+'KB' : '0'})${s.error ? ' ['+s.error+']' : ''}`);
  }

  const bySource = await prisma.$queryRawUnsafe(`
    SELECT m2.nombre, COUNT(ml.id) as total 
    FROM MencionLente ml JOIN Mencion m ON m.id=ml.mencionId JOIN Medio m2 ON m2.id=m.medioId 
    WHERE ml.lenteId='${lente9.id}' GROUP BY m2.nombre ORDER BY total DESC
  `);
  console.log('\n── Distribución ──');
  for (const r of (bySource as any[])) console.log(`  ${String(r.total).padStart(3)} | ${r.nombre}`);

  const otras = await prisma.$queryRawUnsafe(`
    SELECT l.nombre, COUNT(ml.id) as total FROM MencionLente ml JOIN Lente l ON l.id=ml.lenteId 
    WHERE ml.mencionId IN (SELECT mencionId FROM MencionLente WHERE lenteId='${lente9.id}')
    AND l.id!='${lente9.id}' GROUP BY l.nombre ORDER BY total DESC
  `);
  console.log('\n── Lentes cruzados ──');
  for (const r of (otras as any[])) console.log(`  ${String(r.total).padStart(3)} | ${r.nombre}`);

  console.log(`\n⏳ Hecho. ${nuevas >= 10 ? 'Suficiente para boletín.' : 'Insuficiente (' + nuevas + '/' + 10 + ' mínimo).'}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
