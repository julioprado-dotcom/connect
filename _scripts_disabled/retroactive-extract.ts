// ═══════════════════════════════════════════════════════════════
// retroactive-extract.ts — Extracción retroactiva escalonada
// DECODEX Bolivia — PASO 2
// ═══════════════════════════════════════════════════════════════
//
// Estrategia:
//   1. Para fuentes Nivel A (sitemap): fetch sitemap, extraer URLs de artículos
//   2. Para fuentes Nivel A (archivo por fecha): construir URLs
//   3. Filtrar URLs que ya existen en DB (por url en Mencion)
//   4. Crear jobs scrape_fuente con las URLs retroactivas
//   5. Stagger: 3-5 min entre fuentes Nivel A, 2 min entre Nivel B
//
// Uso: npx tsx scripts/retroactive-extract.ts [--dry-run] [--start-day YYYY-MM-DD]
// ═══════════════════════════════════════════════════════════════

import { PrismaClient } from '@prisma/client'
import { enqueue } from '../src/lib/jobs/queue'

const db = new PrismaClient()

// ─── Configuración ─────────────────────────────────────────────
const DAYS_TO_EXTRACT = 7
const DELAY_BETWEEN_SOURCES_A = 1 * 60 * 1000  // 1 min entre fuentes A (acelerado)
const DELAY_BETWEEN_SOURCES_B = 1 * 60 * 1000  // 1 min entre fuentes B (acelerado)
const MAX_ARTICLES_PER_SOURCE = 50               // máximo artículos a extraer por fuente
const MAX_SOURCES_PER_HOUR = 12
const CPU_THRESHOLD = 80
const MEM_THRESHOLD = 80

const DRY_RUN = process.argv.includes('--dry-run')

// ─── Nivel A: Fuentes con sitemap o archivo por fecha ──────────
// Scouting results (2026-05-13):
//   ✅ leo.bo: /{YYYY}/{MM}/{DD}/ → 21-25 articles/day (WORKS)
//   ✅ bolpress.com: homepage has /2026/05/DD/slug pattern (WP, sitemap timeout)
//   ✅ eldia.com.bo: homepage has /2026-MM-DD/seccion/slug pattern (NO archive)
//   ✅ elperiodico.com.bo: homepage has /slug pattern (WP, sitemap empty 7d)
//   ✅ lavozdetarija.com: homepage has /2026/MM/DD/slug pattern (WP)
//   ✅ boliviaverifica.bo: homepage has /slug pattern (WP, sitemap slow)
//   ✅ lostiempos.com: Drupal, links in HTML as /actualidad/seccion/YYYYMMDD/slug
//   ❌ la-razon.com: Cloudflare managed challenge (BLOQUEADA)
//   ❌ elpotosi.net: Cloudflare non-interactive challenge (BLOQUEADA)
//   ❌ correodelsur.com: Cloudflare + SPA (no article links in HTML)
//   ❌ opinion.com.bo: 403 Forbidden
//   ❌ vision360.bo: SPA, no static article URLs
//   ❌ elpais.bo: No useful archive pattern

const FUENTES_NIVEL_A: Record<string, { tipo: 'sitemap' | 'archivo_fecha' | 'homepage'; sitemapUrl?: string; urlPattern?: string; homepageUrl?: string; articlePattern?: RegExp }> = {
  'leo.bo': {
    tipo: 'archivo_fecha',
    urlPattern: 'https://leo.bo/{YYYY}/{MM}/{DD}/',
  },
  'bolpress.com': {
    tipo: 'homepage',
    homepageUrl: 'https://bolpress.com/',
    articlePattern: /href="(https:\/\/bolpress\.com\/2026\/[0-9]{2}\/[0-9]{2}\/[^"]+)"/gi,
  },
  'eldia.com.bo': {
    tipo: 'homepage',
    homepageUrl: 'https://eldia.com.bo/',
    articlePattern: /href="(https:\/\/eldia\.com\.bo\/2026-[0-9]{2}-[0-9]{2}\/[^"]+)"/gi,
  },
  'elperiodico.com.bo': {
    tipo: 'homepage',
    homepageUrl: 'https://elperiodico.com.bo/',
    articlePattern: /href="(https:\/\/elperiodico\.com\.bo\/[a-z][^"]*-[a-z][^"\/]*\/)"/gi,
  },
  'lavozdetarija.com': {
    tipo: 'homepage',
    homepageUrl: 'https://lavozdetarija.com/',
    articlePattern: /href="(https:\/\/lavozdetarija\.com\/2026\/[0-9]{2}\/[0-9]{2}\/[^"]+)"/gi,
  },
  'boliviaverifica.bo': {
    tipo: 'homepage',
    homepageUrl: 'https://boliviaverifica.bo/',
    articlePattern: /href="(https:\/\/boliviaverifica\.bo\/[a-z][^"]*-[a-z][^"\/]*\/)"/gi,
  },
  'www.lostiempos.com': {
    tipo: 'homepage',
    homepageUrl: 'https://www.lostiempos.com/',
    articlePattern: /href="(\/actualidad\/[^"]+\/202[0-9]{5}\/[^"]+)"/gi,
  },
  'resumenlatinoamericano.org': {
    tipo: 'sitemap',
    sitemapUrl: 'https://resumenlatinoamericano.org/post-sitemap.xml',
  },
}

// ─── Nivel B: Fuentes con RSS ─────────────────────────────────
const FUENTES_NIVEL_B: Record<string, { rssUrl: string }> = {
  'cedib.org': { rssUrl: 'https://cedib.org/feed/' },
  'eju.tv': { rssUrl: 'https://eju.tv/feed/' },
  'elmundo.com.bo': { rssUrl: 'https://elmundo.com.bo/feed/' },
}

// ─── Helpers ────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function formatDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function buildArchiveUrl(pattern: string, date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return pattern
    .replace('{YYYY}', String(y))
    .replace('{MM}', m)
    .replace('{DD}', d)
}

function parseDateFromUrl(url: string): Date | null {
  // Try patterns: /YYYY-MM-DD/, /YYYY/MM/DD/
  const match1 = url.match(/\/(\d{4})-(\d{2})-(\d{2})\//)
  if (match1) return new Date(+match1[1], +match1[2] - 1, +match1[3])
  const match2 = url.match(/\/(\d{4})\/(\d{2})\/(\d{2})\//)
  if (match2) return new Date(+match2[1], +match2[2] - 1, +match2[3])
  return null
}

async function getExistingUrls(): Promise<Set<string>> {
  const menciones = await db.mencion.findMany({
    select: { url: true },
    where: { url: { not: '' } },
  })
  return new Set(menciones.map(m => m.url).filter(u => u.length > 0))
}

async function getSourceInfo(url: string): Promise<{ id: string; medioId: string; nombre: string } | null> {
  const fuente = await db.fuenteEstado.findFirst({
    where: {
      OR: [
        { url: { contains: url.replace(/^https?:\/\//, '').split('/')[0] } },
        { url: url },
      ],
    },
    include: { medio: true },
  })
  if (!fuente) return null
  return { id: fuente.id, medioId: fuente.medioId, nombre: fuente.medio?.nombre || url }
}

async function fetchXml(url: string): Promise<string> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 20000)
    const res = await fetch(url, {
      redirect: 'follow',
      headers: {
        'User-Agent': 'DECODEX-Bot/0.15.0 (Inteligencia Mediática Bolivia)',
        'Accept': 'application/xml, text/xml, */*',
      },
      signal: controller.signal,
    })
    clearTimeout(timeout)
    if (res.ok) return await res.text()
    console.warn(`  ⚠️  HTTP ${res.status} para ${url}`)
    return ''
  } catch (e) {
    console.warn(`  ⚠️  Fetch falló para ${url}: ${e instanceof Error ? e.message : e}`)
    return ''
  }
}

interface SitemapEntry {
  url: string
  lastmod?: Date
}

function extractUrlsFromSitemap(xml: string, maxAgeDays: number): SitemapEntry[] {
  const entries: SitemapEntry[] = []
  const cutoff = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000)

  const urlBlockRegex = /<url>[\s\S]*?<\/url>/gi
  let blockMatch
  while ((blockMatch = urlBlockRegex.exec(xml)) !== null) {
    const block = blockMatch[0]
    const locMatch = block.match(/<loc>(https?:\/\/[^<]+)<\/loc>/i)
    if (!locMatch) continue
    const url = locMatch[1]
    if (url.includes('/sitemap') || url.includes('/category/') || url.includes('/tag/') || url.includes('/page/')) continue

    const lastmodMatch = block.match(/<lastmod>([^<]+)<\/lastmod>/i)
    let lastmod: Date | undefined
    if (lastmodMatch) {
      const parsed = new Date(lastmodMatch[1])
      if (!isNaN(parsed.getTime())) lastmod = parsed
    }

    entries.push({ url, lastmod })
  }

  return entries.filter(e => {
    if (e.lastmod) return e.lastmod >= cutoff
    const urlDate = parseDateFromUrl(e.url)
    if (urlDate) return urlDate >= cutoff
    return false
  })
}

function extractUrlsFromRss(xml: string): string[] {
  const urls: string[] = []
  const regex = /<link>(https?:\/\/[^<]+)<\/link>/gi
  let match
  while ((match = regex.exec(xml)) !== null) {
    urls.push(match[1])
  }
  // Also try <link href="..."/>
  const regex2 = /<link[^>]+href="(https?:\/\/[^"]+)"[^>]*\/?>/gi
  while ((match = regex2.exec(xml)) !== null) {
    if (!urls.includes(match[1])) urls.push(match[1])
  }
  return urls
}

function isWithinDays(date: Date, maxDays: number): boolean {
  const now = new Date()
  const cutoff = new Date(now.getTime() - maxDays * 24 * 60 * 60 * 1000)
  return date >= cutoff
}

// ─── System resource check ─────────────────────────────────────

async function checkResources(): Promise<{ ok: boolean; cpu: number; mem: number }> {
  try {
    const { execSync } = await import('child_process')
    const cpu = parseFloat(execSync("top -bn1 | rg 'Cpu' | awk '{print $2}' | sed 's/,/./'").toString().trim() || '0')
    const memRaw = execSync("free | rg Mem | awk '{print ($3/$2)*100}'").toString().trim()
    const mem = parseFloat(memRaw || '0')
    return { ok: cpu < CPU_THRESHOLD && mem < MEM_THRESHOLD, cpu, mem }
  } catch {
    return { ok: true, cpu: 0, mem: 0 }
  }
}

// ─── Extract articles from archive page ────────────────────────

async function fetchHomepage(url: string): Promise<string> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 20000)
    const res = await fetch(url, {
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,*/*',
      },
      signal: controller.signal,
    })
    clearTimeout(timeout)
    if (!res.ok) {
      console.warn(`  ⚠️  HTTP ${res.status} para ${url}`)
      return ''
    }
    const html = await res.text()
    // Check for Cloudflare challenge pages
    if (html.includes('Just a moment') || html.includes('challenge-platform')) {
      console.warn(`  ⚠️  Cloudflare challenge detectado para ${url}`)
      return ''
    }
    return html
  } catch (e) {
    console.warn(`  ⚠️  Fetch falló para ${url}: ${e instanceof Error ? e.message : e}`)
    return ''
  }
}

async function extractArticleUrlsFromArchive(archiveUrl: string): Promise<string[]> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)
    const res = await fetch(archiveUrl, {
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,*/*',
      },
      signal: controller.signal,
    })
    clearTimeout(timeout)
    if (!res.ok) return []

    const html = await res.text()
    // Extract article URLs from HTML
    const urls: string[] = []
    // Match href patterns that look like article URLs
    const regex = /href=["'](\/[^"']*\d{4}[^"']*|https?:\/\/[^"']*\d{4}[^"']*)["']/gi
    let match
    const seen = new Set<string>()
    while ((match = regex.exec(html)) !== null) {
      let url = match[1]
      // Make absolute if relative
      if (url.startsWith('/')) {
        try {
          url = new URL(url, archiveUrl).href
        } catch { continue }
      }
      // Filter: must look like an article URL (has a date or a number/slug pattern)
      if (url.match(/\/\d{4}[-\/]\d{2}[-\/]\d{2}/) || url.match(/\/\d+[-]/)) {
        if (!seen.has(url)) {
          seen.add(url)
          urls.push(url)
        }
      }
    }
    return urls.slice(0, MAX_ARTICLES_PER_SOURCE)
  } catch {
    return []
  }
}

// ─── Main extraction logic ─────────────────────────────────────

async function processNivelA(existingUrls: Set<string>, startDate: Date) {
  console.log('\n═══════════════════════════════════════════════')
  console.log('  NIVEL A: Fuentes con sitemap/archivo por fecha')
  console.log('═══════════════════════════════════════════════\n')

  let totalJobs = 0
  let totalUrls = 0
  let sourcesProcessed = 0
  let hourStart = Date.now()

  for (const [domain, config] of Object.entries(FUENTES_NIVEL_A)) {
    // Rate limit: max 12 sources per hour
    if (sourcesProcessed >= MAX_SOURCES_PER_HOUR) {
      const elapsed = Date.now() - hourStart
      if (elapsed < 3600 * 1000) {
        const waitTime = 3600 * 1000 - elapsed
        console.log(`⏳  Límite de ${MAX_SOURCES_PER_HOUR} fuentes/hora alcanzado. Esperando ${(waitTime / 60000).toFixed(0)} min...`)
        await sleep(waitTime)
      }
      sourcesProcessed = 0
      hourStart = Date.now()
    }

    // Check system resources
    const resources = await checkResources()
    if (!resources.ok) {
      console.log(`⚠️  Recursos altos (CPU: ${resources.cpu.toFixed(0)}%, MEM: ${resources.mem.toFixed(0)}%). Esperando 5 min...`)
      await sleep(5 * 60 * 1000)
    }

    // Get source info from DB
    const cleanDomain = domain.replace(/_\d+$/, '')  // Remove _2 suffix for lookup
    const sourceInfo = await getSourceInfo(cleanDomain)
    if (!sourceInfo) {
      console.log(`⏭️  ${domain} — no encontrada en DB, saltando`)
      continue
    }

    console.log(`\n📡 ${sourceInfo.nombre} (${domain})`)

    let articleUrls: string[] = []

    if (config.tipo === 'sitemap' && config.sitemapUrl) {
      console.log(`  📥 Sitemap: ${config.sitemapUrl}`)
      const xml = await fetchXml(config.sitemapUrl)
      if (!xml) {
        console.log(`  ❌ No se pudo obtener sitemap`)
        continue
      }
      const entries = extractUrlsFromSitemap(xml, DAYS_TO_EXTRACT)
      articleUrls = entries.map(e => e.url)
      console.log(`  📋 ${articleUrls.length} URLs en sitemap (últimos ${DAYS_TO_EXTRACT} días)`)

      // If sitemap is an index, fetch sub-sitemaps
      if (articleUrls.length > 0 && articleUrls.every(u => u.includes('sitemap'))) {
        console.log(`  📑 Sitemap index detectado, obteniendo sub-sitemaps...`)
        const allEntries: SitemapEntry[] = []
        for (const subUrl of articleUrls.slice(0, 15)) {
          const subXml = await fetchXml(subUrl)
          if (subXml) {
            const subEntries = extractUrlsFromSitemap(subXml, DAYS_TO_EXTRACT)
            allEntries.push(...subEntries)
          }
          await sleep(1000)
        }
        articleUrls = allEntries.map(e => e.url)
        console.log(`  📋 ${articleUrls.length} URLs totales de sub-sitemaps`)
      }

    } else if (config.tipo === 'homepage' && config.homepageUrl && config.articlePattern) {
      // Scrape homepage to extract article URLs via regex pattern
      console.log(`  🌐 Homepage: ${config.homepageUrl}`)
      const html = await fetchHomepage(config.homepageUrl)
      if (!html) {
        console.log(`  ❌ No se pudo obtener homepage`)
        continue
      }
      // Reset regex lastIndex
      const pattern = new RegExp(config.articlePattern.source, config.articlePattern.flags)
      let match
      const seen = new Set<string>()
      while ((match = pattern.exec(html)) !== null) {
        let url = match[1]
        // Make absolute if relative (for lostiempos)
        if (url.startsWith('/')) {
          try {
            url = new URL(url, config.homepageUrl).href
          } catch { continue }
        }
        // Filter out non-article URLs
        if (url.includes('/category/') || url.includes('/tag/') || url.includes('/page/') || url.includes('/author/') || url.endsWith('/wp-json/') || url.includes('/apps/')) continue
        // For Bolivia Verifica, skip static analysis pages
        if (url.includes('/analisis-del-discurso-20')) continue
        // For date-based patterns, only keep last 7 days
        const urlDate = parseDateFromUrl(url)
        if (urlDate && !isWithinDays(urlDate, DAYS_TO_EXTRACT + 1)) continue
        // For slug-based patterns (no date in URL), include all from homepage
        if (!seen.has(url)) {
          seen.add(url)
          articleUrls.push(url)
        }
      }
      console.log(`  📋 ${articleUrls.length} URLs extraídas de homepage`)

    } else if (config.tipo === 'archivo_fecha' && config.urlPattern) {
      // Construct URLs for each day
      console.log(`  📅 Construyendo URLs de archivo...`)
      for (let d = 0; d < DAYS_TO_EXTRACT; d++) {
        const date = new Date(startDate.getTime() - d * 24 * 60 * 60 * 1000)
        const archiveUrl = buildArchiveUrl(config.urlPattern, date)
        console.log(`  📂 ${formatDate(date)}: ${archiveUrl}`)
        const dayUrls = await extractArticleUrlsFromArchive(archiveUrl)
        console.log(`     → ${dayUrls.length} artículos encontrados`)
        articleUrls.push(...dayUrls)
        await sleep(1500)  // 1.5s between day pages
      }
    }

    // Filter out existing URLs and deduplicate (remove fragments)
    const uniqueUrls = [...new Set(articleUrls.map(u => u.split('#')[0]))]
    const newUrls = uniqueUrls.filter(url => !existingUrls.has(url))
    console.log(`  ✨ ${newUrls.length} URLs nuevas (de ${uniqueUrls.length} únicas, ${articleUrls.length} totales)`)

    if (newUrls.length === 0) {
      console.log(`  ⏭️  Sin URLs nuevas, saltando`)
      continue
    }

    // Split into chunks for multiple jobs if needed
    const CHUNK_SIZE = MAX_ARTICLES_PER_SOURCE
    const chunks: string[][] = []
    for (let i = 0; i < newUrls.length; i += CHUNK_SIZE) {
      chunks.push(newUrls.slice(i, i + CHUNK_SIZE))
    }

    if (DRY_RUN) {
      console.log(`  [DRY RUN] Crearía ${chunks.length} job(s) con ${newUrls.length} URLs`)
      for (const u of newUrls.slice(0, 3)) {
        console.log(`    → ${u}`)
      }
      if (newUrls.length > 3) console.log(`    ... y ${newUrls.length - 3} más`)
    } else {
      for (const chunk of chunks) {
        try {
          const jobId = await enqueue({
            tipo: 'scrape_fuente',
            prioridad: 4,
            payload: {
              fuenteId: sourceInfo.id,
              medioId: sourceInfo.medioId,
              urls: chunk,
              retroactivo: true,
            },
            programa: 'retroactive-extract',
          })
          console.log(`  ✅ Job creado: ${jobId} (${chunk.length} URLs)`)
          totalJobs++
          for (const u of chunk) existingUrls.add(u)
        } catch (e) {
          console.error(`  ❌ Error creando job: ${e instanceof Error ? e.message : e}`)
        }
      }
    }

    totalUrls += newUrls.length
    sourcesProcessed++

    // Delay between sources
    if (!DRY_RUN && sourcesProcessed < Object.keys(FUENTES_NIVEL_A).length) {
      console.log(`  ⏳  Esperando ${(DELAY_BETWEEN_SOURCES_A / 1000).toFixed(0)}s antes de la siguiente fuente...`)
      await sleep(DELAY_BETWEEN_SOURCES_A)
    }
  }

  return { totalJobs, totalUrls }
}

async function processNivelB(existingUrls: Set<string>) {
  console.log('\n═══════════════════════════════════════════════')
  console.log('  NIVEL B: Fuentes con RSS')
  console.log('═══════════════════════════════════════════════\n')

  let totalJobs = 0
  let totalUrls = 0

  for (const [domain, config] of Object.entries(FUENTES_NIVEL_B)) {
    const sourceInfo = await getSourceInfo(domain)
    if (!sourceInfo) {
      console.log(`⏭️  ${domain} — no encontrada en DB, saltando`)
      continue
    }

    console.log(`\n📡 ${sourceInfo.nombre} (${domain})`)
    console.log(`  📥 RSS: ${config.rssUrl}`)

    const xml = await fetchXml(config.rssUrl)
    if (!xml) {
      console.log(`  ❌ No se pudo obtener RSS`)
      continue
    }

    const rssUrls = extractUrlsFromRss(xml)
    console.log(`  📋 ${rssUrls.length} URLs en RSS`)

    const newUrls = rssUrls.filter(url => !existingUrls.has(url))
    console.log(`  ✨ ${newUrls.length} URLs nuevas`)

    if (newUrls.length === 0) continue

    if (DRY_RUN) {
      console.log(`  [DRY RUN] Crearía job scrape_fuente con ${newUrls.length} URLs`)
    } else {
      try {
        const jobId = await enqueue({
          tipo: 'scrape_fuente',
          prioridad: 4,
          payload: {
            fuenteId: sourceInfo.id,
            medioId: sourceInfo.medioId,
            urls: newUrls,
            retroactivo: true,
          },
          programa: 'retroactive-extract',
        })
        console.log(`  ✅ Job creado: ${jobId} (${newUrls.length} URLs)`)
        totalJobs++
        for (const u of newUrls) existingUrls.add(u)
      } catch (e) {
        console.error(`  ❌ Error creando job: ${e instanceof Error ? e.message : e}`)
      }
    }

    totalUrls += newUrls.length

    // Delay between sources
    if (!DRY_RUN) {
      await sleep(DELAY_BETWEEN_SOURCES_B)
    }
  }

  return { totalJobs, totalUrls }
}

// ─── Main ──────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════')
  console.log('  EXTRACCIÓN RETROACTIVA ESCALONADA')
  console.log(`  ${DRY_RUN ? '[DRY RUN - sin crear jobs]' : '[EJECUCIÓN REAL]'}`)
  console.log(`  Días a extraer: ${DAYS_TO_EXTRACT}`)
  console.log(`  Fecha inicio: ${formatDate(new Date())}`)
  console.log('═══════════════════════════════════════════════')

  // Get existing URLs from DB to avoid duplicates
  console.log('\n📋 Obteniendo URLs existentes en DB...')
  const existingUrls = await getExistingUrls()
  console.log(`  📊 ${existingUrls.size} URLs ya existentes en Mencion`)

  // Determine start date
  const startDate = new Date()

  // Process Nivel A
  const resultA = await processNivelA(existingUrls, startDate)

  // Process Nivel B
  const resultB = await processNivelB(existingUrls)

  // Summary
  console.log('\n═══════════════════════════════════════════════')
  console.log('  RESUMEN')
  console.log('═══════════════════════════════════════════════')
  console.log(`  Nivel A: ${resultA.totalJobs} jobs, ${resultA.totalUrls} URLs`)
  console.log(`  Nivel B: ${resultB.totalJobs} jobs, ${resultB.totalUrls} URLs`)
  console.log(`  Total: ${resultA.totalJobs + resultB.totalJobs} jobs, ${resultA.totalUrls + resultB.totalUrls} URLs`)
  console.log(`  URLs ya existentes (saltadas): ${existingUrls.size}`)
  console.log('═══════════════════════════════════════════════')

  if (!DRY_RUN) {
    console.log('\n⏳ Los jobs están en cola. El worker los procesará automáticamente.')
    console.log('Monitorear con: tail -f /tmp/decodex-server.log | rg scrape-fuente')
  }

  await db.$disconnect()
}

main().catch(e => {
  console.error('❌ Error fatal:', e)
  process.exit(1)
})
