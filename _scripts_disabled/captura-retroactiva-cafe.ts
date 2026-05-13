// Captura Retroactiva — Fuentes Especializadas de Café
// DECODEX Bolivia / ONION200 v0.15.0
//
// Ejecutar: npx tsx scripts/captura-retroactiva-cafe.ts
//
// Estrategia: Fetch directo a homepage/sección → extraer links → 
// filtrar por keywords café → guardar menciones relevantes

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasourceUrl: 'file:/home/z/my-project/prisma/db/custom.db',
});

// ─── Keywords de café (alta + media prioridad) ──────────────────
const COFFEE_KEYWORDS = [
  // Alta prioridad
  'café de especialidad', 'café boliviano', 'café de yungas', 'café de caranavi',
  'grano verde', 'specialty coffee bolivia', 'bolivian coffee', 'yungas coffee',
  'caranavi coffee', 'c-market', 'precio del café', 'coffee price',
  'coffee beans', 'arabica coffee', 'robusta coffee', 'coffee market',
  'cafe de especialidad', 'cafe boliviano', 'cafe de yungas', 'cafe de caranavi',
  'café orgánico', 'cafe organico', 'coffee farming', 'coffee farmer',
  'coffee production', 'coffee export', 'coffee trade', 'coffee industry',
  // Media prioridad
  'torrefacción', 'tueste', 'cata', 'fermentación', 'procesamiento',
  'sca', 'cup of excellence', 'cooperativa cafetera', 'productor de café',
  'cafetería', 'senasag', 'eudr', 'flete café', 'roya del cafeto',
  'broca del café', 'coffee processing', 'coffee cupping', 'coffee roasting',
  'coffee roaster', 'coffee brewing', 'espresso', 'latte', 'cappuccino',
  'single origin', 'coffee origin', 'coffee bean', 'green coffee',
  'coffee harvest', 'coffee season', 'coffee yield', 'coffee leaf rust',
  'ibce', 'ico.org', 'international coffee organization',
  'minutadecafe', 'perfectdailygrind', 'coffeereview',
  'cafetaleros', 'caficultor', 'caficultura', 'cafetal',
  'cosecha de café', 'cosecha de cafe', 'floración del café',
  'coffee certification', 'fair trade coffee', 'organic coffee',
  'coffee consumption', 'coffee demand', 'coffee supply',
  'commodities coffee', 'coffee futures', 'coffee arabica',
  'coffee robusta', 'coffee prices', 'coffee trading',
  'café y', 'café en', 'café el', 'café la', 'café se',
  'cafe y', 'cafe en', 'cafe el', 'cafe la', 'cafe se',
  'yungas', 'caranavi', 'sud yungas', 'nor yungas',
  'cenaproc', 'coaine', 'coabol',
  'hidrocarburos', 'gasolina', 'diésel', 'diesel', 'ypfb',
];

// ─── Fuente definitions ────────────────────────────────────────
interface FuenteConfig {
  nombre: string;
  medioId: string;
  url: string;
  scrapeUrl: string;  // URL to actually scrape (may differ from DB)
  tipo: 'rss' | 'homepage' | 'seccion';
  depth: number;  // days back
  cloudflare: boolean;
}

const FUENTES: FuenteConfig[] = [
  {
    nombre: 'Perfect Daily Grind',
    medioId: 'cmp3585h', // placeholder, will be resolved
    url: 'https://perfectdailygrind.com',
    scrapeUrl: 'https://perfectdailygrind.com/category/origins/',
    tipo: 'homepage',
    depth: 14,
    cloudflare: true,
  },
  {
    nombre: 'Minuta de Café',
    medioId: 'cmp3585h',
    url: 'https://minutadecafe.com',
    scrapeUrl: 'https://minutadecafe.com',
    tipo: 'homepage',
    depth: 30,
    cloudflare: false,
  },
  {
    nombre: 'OIC Café',
    medioId: 'cmp3585h',
    url: 'https://ico.org',
    scrapeUrl: 'https://ico.org/new/',
    tipo: 'homepage',
    depth: 30,
    cloudflare: false,
  },
  {
    nombre: 'SCA',
    medioId: 'cmp3585h',
    url: 'https://sca.coffee',
    scrapeUrl: 'https://sca.coffee/news/',
    tipo: 'homepage',
    depth: 30,
    cloudflare: false,
  },
  {
    nombre: 'Coffee Review',
    medioId: 'cmp3585h',
    url: 'https://coffeereview.com',
    scrapeUrl: 'https://coffeereview.com/review/',
    tipo: 'homepage',
    depth: 30,
    cloudflare: false,
  },
  {
    nombre: 'IBCE',
    medioId: 'cmp3585h',
    url: 'https://ibce.org.bo',
    scrapeUrl: 'https://ibce.org.bo',
    tipo: 'homepage',
    depth: 60,
    cloudflare: false,
  },
  {
    nombre: 'SENASAG',
    medioId: 'cmp3585h',
    url: 'https://senasag.gob.bo',
    scrapeUrl: 'https://senasag.gob.bo',
    tipo: 'homepage',
    depth: 60,
    cloudflare: false,
  },
  {
    nombre: 'Investing.com Café',
    medioId: 'cmp3585h',
    url: 'https://www.investing.com/commodities/coffee',
    scrapeUrl: 'https://www.investing.com/news/commodities/',
    tipo: 'homepage',
    depth: 14,
    cloudflare: true,
  },
  {
    nombre: 'TradingView Café',
    medioId: 'cmp3585h',
    url: 'https://www.tradingview.com/symbols/ICE-KC1!',
    scrapeUrl: 'https://www.tradingview.com/news/',
    tipo: 'homepage',
    depth: 14,
    cloudflare: true,
  },
  {
    nombre: 'Reuters Commodities',
    medioId: 'cmp3585h',
    url: 'https://www.reuters.com/business/commodities/',
    scrapeUrl: 'https://www.reuters.com/business/commodities/coffee/',
    tipo: 'homepage',
    depth: 14,
    cloudflare: true,
  },
];

// ─── Helpers ──────────────────────────────────────────────────

function normalize(text: string): string {
  return text.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9áéíóúñü\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function scoreCoffee(textNorm: string): number {
  let score = 0;
  for (const kw of COFFEE_KEYWORDS) {
    if (textNorm.includes(kw)) score++;
  }
  return score;
}

function extractLinksFromHtml(html: string, baseUrl: string): Array<{ url: string; title: string }> {
  const links: Array<{ url: string; title: string }> = [];
  const urlPattern = /href=["']([^"']+)["']/gi;
  const titlePattern = /(?:<h[1-6][^>]*>|<a[^>]*>)([^<]{10,120})(?:<\/a>|<\/h[1-6]>)/gi;
  const titlePattern2 = /title=["']([^"']{10,120})["']/gi;

  let match: RegExpExecArray | null;
  while ((match = urlPattern.exec(html)) !== null) {
    let href = match[1];
    if (href.startsWith('/')) {
      try {
        const base = new URL(baseUrl);
        href = base.origin + href;
      } catch { continue; }
    }
    if (href.startsWith('http') && href !== baseUrl && !href.includes('#') && !href.includes('javascript:')) {
      links.push({ url: href, title: '' });
    }
  }

  // Try to extract titles from nearby text
  while ((match = titlePattern.exec(html)) !== null) {
    const title = match[1].trim();
    if (title.length > 10) {
      // Find closest link
      const before = html.substring(Math.max(0, match.index - 500), match.index);
      const linkMatch = /href=["']([^"']+)["']/.exec(before.split('/').pop() || '');
      if (linkMatch) {
        const existing = links.find(l => l.url.includes(linkMatch[1].split('/').pop() || ''));
        if (existing) existing.title = title;
      }
    }
  }

  return links;
}

async function fetchWithTimeout(url: string, timeoutMs = 15000): Promise<string> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-BO,es;q=0.9,en;q=0.8',
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (response.ok) return await response.text();
    return '';
  } catch (e) {
    console.log(`  [fetch] Error: ${e instanceof Error ? e.message : e}`);
    return '';
  }
}

// ─── Main ────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  CAPTURA RETROACTIVA — FUENTES DE CAFÉ');
  console.log('═══════════════════════════════════════════════════\n');

  // 1. Resolve medio IDs
  const medios = await prisma.medio.findMany({
    where: {
      nombre: { in: FUENTES.map(f => f.nombre) },
    },
    select: { id: true, nombre: true },
  });
  const medioMap: Record<string, string> = {};
  for (const m of medios) medioMap[m.nombre] = m.id;

  // 2. Get Lente 9 ID
  const lente9 = await prisma.lente.findFirst({ where: { slug: 'cafe-economicas-regionales' } });
  if (!lente9) {
    console.log('ERROR: Lente 9 no encontrado');
    return;
  }
  console.log(`Lente 9: ${lente9.nombre} (${lente9.id})`);

  // 3. Count before
  const antes = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*) as c FROM MencionLente WHERE lenteId = '${lente9.id}'`
  );
  console.log(`Menciones café ANTES: ${Number(antes[0].c)}\n`);

  // 4. Process each source
  const results: Array<{
    nombre: string;
    status: 'ok' | 'fail';
    linksFound: number;
    coffeeScored: number;
    mencionesCreadas: number;
    error?: string;
  }> = [];

  for (const fuente of FUENTES) {
    const medioId = medioMap[fuente.nombre];
    if (!medioId) {
      console.log(`\n❌ ${fuente.nombre}: medioId no encontrado en DB`);
      results.push({ nombre: fuente.nombre, status: 'fail', linksFound: 0, coffeeScored: 0, mencionesCreadas: 0, error: 'medioId not found' });
      continue;
    }
    fuente.medioId = medioId;

    console.log(`\n${'─'.repeat(60)}`);
    console.log(`📡 ${fuente.nombre} (${fuente.scrapeUrl})`);
    console.log(`   Cloudflare: ${fuente.cloudflare ? '⚠️ SÍ' : 'no'} | Depth: ${fuente.depth}d`);

    // Fetch page
    console.log(`   Descargando...`);
    const html = await fetchWithTimeout(fuente.scrapeUrl, fuente.cloudflare ? 30000 : 15000);
    if (!html || html.length < 500) {
      console.log(`   ❌ No se pudo obtener HTML (${html?.length || 0} bytes)`);
      results.push({ nombre: fuente.nombre, status: 'fail', linksFound: 0, coffeeScored: 0, mencionesCreadas: 0, error: 'empty response' });
      continue;
    }
    console.log(`   HTML: ${(html.length / 1024).toFixed(1)} KB`);

    // Also score the homepage itself
    const homepageText = normalize(html.replace(/<[^>]+>/g, ' '));
    const homepageScore = scoreCoffee(homepageText);
    console.log(`   Homepage coffee score: ${homepageScore}`);

    // Extract links
    const links = extractLinksFromHtml(html, fuente.scrapeUrl);
    // Deduplicate
    const uniqueUrls = [...new Map(links.map(l => [l.url, l])).values()];
    console.log(`   Links extraídos: ${uniqueUrls.length}`);

    // Score each link's title for coffee relevance
    const coffeeLinks = uniqueUrls.filter(l => {
      if (!l.title) return false;
      const titleNorm = normalize(l.title);
      return scoreCoffee(titleNorm) >= 1;
    });
    console.log(`   Links con keywords café: ${coffeeLinks.length}`);

    // If homepage has high coffee score, create a mention from it
    let mencionesCreadas = 0;

    if (homepageScore >= 2) {
      // Extract a title from the page
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const pageTitle = titleMatch ? titleMatch[1].trim() : fuente.nombre + ' - Homepage';
      console.log(`   ✓ Creando mención desde homepage (score: ${homepageScore})`);

      // Check for duplicate URL
      const existing = await prisma.mencion.count({ where: { url: fuente.scrapeUrl } });
      if (existing === 0) {
        const cleanText = homepageText.substring(0, 5000);
        try {
          const mencion = await prisma.mencion.create({
            data: {
              medioId,
              titulo: pageTitle.substring(0, 300),
              texto: cleanText.substring(0, 1000),
              textoCompleto: cleanText,
              url: fuente.scrapeUrl,
              fechaCaptura: new Date(),
              fechaPublicacion: new Date(),
              tipoMencion: 'mencion_pasiva',
              enlaceActivo: true,
            },
          });
          // Assign Lente 9
          await prisma.mencionLente.create({
            data: { mencionId: mencion.id, lenteId: lente9.id },
          }).catch(() => {});
          mencionesCreadas++;
          console.log(`   ✓ Mención creada: ${mencion.id.substring(0, 8)}`);
        } catch (e) {
          console.log(`   ✗ Error creando mención: ${e instanceof Error ? e.message : e}`);
        }
      }
    }

    // Process top coffee-scoring links (max 10 per source)
    const toProcess = coffeeLinks.slice(0, 10);
    console.log(`   Procesando ${toProcess.length} links con keywords café...`);

    for (let i = 0; i < toProcess.length; i++) {
      const link = toProcess[i];
      console.log(`   [${i + 1}/${toProcess.length}] ${link.title.substring(0, 60)}`);

      // Check duplicate
      const exists = await prisma.mencion.count({ where: { url: link.url } });
      if (exists > 0) {
        console.log(`     → ya existe, saltando`);
        continue;
      }

      // Fetch article
      await new Promise(r => setTimeout(r, 3000)); // 3s delay
      const articleHtml = await fetchWithTimeout(link.url, 15000);
      if (!articleHtml || articleHtml.length < 300) {
        console.log(`     → no se pudo descargar`);
        continue;
      }

      // Extract text
      const articleText = articleHtml.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      const textNorm = normalize(articleText.substring(0, 3000));
      const articleScore = scoreCoffee(textNorm);

      if (articleScore < 2) {
        console.log(`     → score ${articleScore} < 2, no es suficiente café`);
        continue;
      }

      // Create mention
      try {
        const mencion = await prisma.mencion.create({
          data: {
            medioId,
            titulo: link.title.substring(0, 300),
            texto: articleText.substring(0, 1000),
            textoCompleto: articleText.substring(0, 8000),
            url: link.url,
            fechaCaptura: new Date(),
            fechaPublicacion: new Date(),
            tipoMencion: 'mencion_pasiva',
            enlaceActivo: true,
          },
        });

        // Assign Lente 9
        await prisma.mencionLente.create({
          data: { mencionId: mencion.id, lenteId: lente9.id },
        }).catch(() => {});

        mencionesCreadas++;
        console.log(`     ✓ creada (${mencion.id.substring(0, 8)}) score: ${articleScore}`);
      } catch (e) {
        console.log(`     ✗ error: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    results.push({
      nombre: fuente.nombre,
      status: mencionesCreadas > 0 ? 'ok' : 'fail',
      linksFound: uniqueUrls.length,
      coffeeScored: coffeeLinks.length,
      mencionesCreadas,
    });

    console.log(`   📊 Resultado: ${mencionesCreadas} menciones creadas`);

    // Delay between sources
    if (fuente.cloudflare) {
      console.log(`   ⏳ Pausa 60s (Cloudflare)...`);
      await new Promise(r => setTimeout(r, 60000));
    } else {
      console.log(`   ⏳ Pausa 10s...`);
      await new Promise(r => setTimeout(r, 10000));
    }
  }

  // 5. Final count
  const despues = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*) as c FROM MencionLente WHERE lenteId = '${lente9.id}'`
  );
  const totalDespues = Number(despues[0].c);

  console.log(`\n\n${'═'.repeat(60)}`);
  console.log('  RESUMEN FINAL');
  console.log('═'.repeat(60));
  console.log(`Menciones café ANTES:  ${Number(antes[0].c)}`);
  console.log(`Menciones café DESPUÉS: ${totalDespues}`);
  console.log(`Nuevas capturadas:     ${totalDespues - Number(antes[0].c)}`);
  console.log('');

  console.log('── Por fuente ──');
  for (const r of results) {
    const icon = r.status === 'ok' ? '✅' : '❌';
    console.log(`  ${icon} ${r.nombre}: ${r.mencionesCreadas} menciones (${r.linksFound} links, ${r.coffeeScored} café)${r.error ? ' [' + r.error + ']' : ''}`);
  }

  // Distribution by source
  const bySource = await prisma.$queryRawUnsafe(`
    SELECT m2.nombre as medio, COUNT(ml.id) as total 
    FROM MencionLente ml 
    JOIN Mencion m ON m.id = ml.mencionId 
    JOIN Medio m2 ON m2.id = m.medioId 
    WHERE ml.lenteId = '${lente9.id}'
    GROUP BY m2.nombre ORDER BY total DESC
  `);
  console.log('\n── Distribución por fuente ──');
  for (const r of bySource as any[]) {
    console.log(`  ${String(r.total).padStart(3)} | ${r.medio}`);
  }

  // Other lentes activated
  const otherLentes = await prisma.$queryRawUnsafe(`
    SELECT l.nombre, COUNT(ml.id) as total 
    FROM MencionLente ml 
    JOIN Lente l ON l.id = ml.lenteId 
    WHERE ml.mencionId IN (SELECT mencionId FROM MencionLente WHERE lenteId = '${lente9.id}')
    AND l.id != '${lente9.id}'
    GROUP BY l.nombre ORDER BY total DESC
  `);
  console.log('\n── Otros lentes activados junto a Café ──');
  for (const r of otherLentes as any[]) {
    console.log(`  ${String(r.total).padStart(3)} | ${r.nombre}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
