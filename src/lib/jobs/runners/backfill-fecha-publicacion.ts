// backfill-fecha-publicacion.ts — Backfill de fechaPublicacion para NotaRaw existentes
// DECODEX Bolivia
//
// Ejecutar en VPS: NODE_OPTIONS="--max-old-space-size=512" npx tsx src/lib/jobs/runners/backfill-fecha-publicacion.ts
//
// Solo UPDATE fechaPublicacion. NUNCA toca fechaCaptura.
// Rate-limited para no saturar la memoria ni los servidores de origen.

import { PrismaClient } from '@prisma/client'

// ─── Config ───────────────────────────────────────────────────
const BATCH_SIZE = 10
const DELAY_MS = 2500          // 2.5s entre requests
const DB_PATH = process.cwd() + '/prisma/db/custom.db'

process.env.DATABASE_URL = `file:${DB_PATH}`
const prisma = new PrismaClient()

// ─── Fechas en español ────────────────────────────────────────
const MESES: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
  ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6,
  jul: 7, ago: 8, sep: 9, oct: 10, nov: 11, dic: 12,
}

// ─── Helpers de extracción (inline para evitar imports pesados) ─
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function extractMetaContent(html: string, name: string): string | null {
  const patterns = [
    new RegExp(`<meta\\s+[^>]*property=["']${escapeRegex(name)}["'][^>]*content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta\\s+[^>]*content=["']([^"']+)["'][^>]*property=["']${escapeRegex(name)}["']`, 'i'),
    new RegExp(`<meta\\s+[^>]*name=["']${escapeRegex(name)}["'][^>]*content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta\\s+[^>]*content=["']([^"']+)["'][^>]*name=["']${escapeRegex(name)}["']`, 'i'),
  ]
  for (const p of patterns) {
    const m = html.match(p)
    if (m?.[1]) return m[1].trim()
  }
  return null
}

function isValidDate(y: number, m: number, d: number): boolean {
  if (y < 2020 || y > 2030 || m < 1 || m > 12 || d < 1 || d > 31) return false
  const dt = new Date(y, m - 1, d)
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d
}

function parseDateStr(str: string): Date | null {
  if (!str) return null
  str = str.trim()
  const d = new Date(str)
  if (!isNaN(d.getTime()) && d.getFullYear() >= 2020 && d.getFullYear() <= 2030) return d
  const cleaned = str.replace(/\.\d+\s*$/, '')
  const d2 = new Date(cleaned)
  if (!isNaN(d2.getTime()) && d2.getFullYear() >= 2020 && d2.getFullYear() <= 2030) return d2
  const dtMatch = str.match(/(\d{4}[-\/]\d{2}[-\/]\d{2})\s+(\d{2}:\d{2}(:\d{2})?)/)
  if (dtMatch) {
    const iso = dtMatch[1] + 'T' + dtMatch[2]
    const d3 = new Date(iso)
    if (!isNaN(d3.getTime()) && d3.getFullYear() >= 2020 && d3.getFullYear() <= 2030) return d3
  }
  return null
}

function extractTextDate(html: string): Date | null {
  const head = html.substring(0, 5000)
  const patterns = [
    /(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+de\s+(\d{4})/i,
    /(\d{1,2})\s+(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+(\d{4})/i,
    /(?:publicad[oa]|fecha)[^:]*:\s*(\d{1,4})[\/\-](\d{1,2})[\/\-](\d{1,4})/i,
  ]
  for (const p of patterns) {
    const m = head.match(p)
    if (!m) continue
    if (m.length === 4 && MESES[m[2].toLowerCase()]) {
      const day = parseInt(m[1]), month = MESES[m[2].toLowerCase()], year = parseInt(m[3])
      if (isValidDate(year, month, day)) return new Date(year, month - 1, day)
    } else if (m.length === 4 && !isNaN(parseInt(m[2]))) {
      const a = parseInt(m[1]), b = parseInt(m[2]), c = parseInt(m[3])
      if (isValidDate(c, b, a)) return new Date(c, b - 1, a)
      if (isValidDate(c, a, b)) return new Date(c, a - 1, b)
    }
  }
  return null
}

function extractSchemaOrgDate(html: string): string | null {
  const m = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i)
  if (!m?.[1]) return null
  try {
    const data = JSON.parse(m[1])
    const items = Array.isArray(data) ? data : [data]
    for (const item of items) {
      if (item.datePublished) return item.datePublished
    }
  } catch { /* skip */ }
  return null
}

function extraerFechaPublicacion(html: string): Date | null {
  if (!html || html.length < 100) return null

  const ogDate = extractMetaContent(html, 'article:published_time')
  if (ogDate) return parseDateStr(ogDate)

  const dpDate = extractMetaContent(html, 'datePublished')
  if (dpDate) return parseDateStr(dpDate)

  const dcDate = extractMetaContent(html, 'DC.date.issued')
  if (dcDate) return parseDateStr(dcDate)

  const pubDate = extractMetaContent(html, 'pubdate')
  if (pubDate) return parseDateStr(pubDate)

  const metaDate = extractMetaContent(html, 'date')
  if (metaDate) return parseDateStr(metaDate)

  const timeMatch = html.match(/<time[^>]*datetime=["']([^"']+)["']/i)
  if (timeMatch?.[1]) return parseDateStr(timeMatch[1].trim())

  const schemaDate = extractSchemaOrgDate(html)
  if (schemaDate) return parseDateStr(schemaDate)

  const textDate = extractTextDate(html)
  if (textDate) return textDate

  return null
}

// ─── Fetch con fallback TLS (minimal, sin dependencias externas) ─
async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; DecodexBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(15_000),
    })
    if (res.status !== 200) return null
    // Limitar respuesta a 500KB para no saturar memoria
    const reader = res.body?.getReader()
    if (!reader) return null
    const chunks: Uint8Array[] = []
    let total = 0
    const MAX = 500_000
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.length
      if (total > MAX) {
        reader.cancel()
        break
      }
      chunks.push(value)
    }
    const decoder = new TextDecoder('latin1')
    let html = ''
    for (const c of chunks) html += decoder.decode(c)
    return html
  } catch {
    // TLS fallback
    try {
      const https = await import('node:https')
      const agent = new https.Agent({ rejectUnauthorized: false, timeout: 15_000 })
      const html = await new Promise<string>((resolve, reject) => {
        const urlObj = new URL(url)
        const req = https.get(
          {
            hostname: urlObj.hostname,
            port: 443,
            path: urlObj.pathname + urlObj.search,
            agent,
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; DecodexBot/1.0)',
              'Host': urlObj.hostname,
            },
          },
          (res) => {
            const chunks: Buffer[] = []
            let total = 0
            res.on('data', (c: Buffer) => {
              total += c.length
              if (total <= MAX) chunks.push(c)
            })
            res.on('end', () => resolve(Buffer.concat(chunks).toString('latin1')))
            res.on('error', reject)
          }
        )
        req.on('error', reject)
        req.on('timeout', () => { req.destroy(); reject(new Error('timeout')) })
      })
      return html
    } catch {
      return null
    }
  }
}

// ─── Main ─────────────────────────────────────────────────────
(async () => {
  const total = await prisma.notaRaw.count({ where: { fechaPublicacion: null } })
  console.log(`[BACKFILL] Iniciando: ${total} registros sin fechaPublicacion`)
  console.log(`[BACKFILL] Config: batch=${BATCH_SIZE}, delay=${DELAY_MS}ms`)

  let processed = 0
  let updated = 0
  let failed = 0
  let skipped = 0

  while (true) {
    const batch = await prisma.notaRaw.findMany({
      where: { fechaPublicacion: null },
      select: { id: true, url: true },
      take: BATCH_SIZE,
      orderBy: { id: 'asc' },
    })

    if (batch.length === 0) break

    for (const nota of batch) {
      processed++
      if (!nota.url) {
        skipped++
        console.log(`[${processed}/${total}] SKIP sin URL: ${nota.id}`)
        continue
      }

      try {
        const html = await fetchHtml(nota.url)
        if (!html || html.length < 100) {
          failed++
          console.log(`[${processed}/${total}] FAIL sin HTML: ${nota.url}`)
          await sleep(DELAY_MS)
          continue
        }

        const fecha = extraerFechaPublicacion(html)
        if (fecha) {
          await prisma.notaRaw.update({
            where: { id: nota.id },
            data: { fechaPublicacion: fecha },
          })
          updated++
          console.log(`[${processed}/${total}] OK ${fecha.toISOString().slice(0, 10)} | ${nota.url.slice(0, 60)}`)
        } else {
          failed++
          console.log(`[${processed}/${total}] NO FECHA: ${nota.url.slice(0, 60)}`)
        }
      } catch (err) {
        failed++
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`[${processed}/${total}] ERROR: ${msg} | ${nota.url.slice(0, 60)}`)
      }

      await sleep(DELAY_MS)
    }
  }

  console.log('\n[BACKFILL] ==============================')
  console.log(`[BACKFILL] Procesados: ${processed}`)
  console.log(`[BACKFILL] Actualizados: ${updated}`)
  console.log(`[BACKFILL] Sin fecha:   ${failed}`)
  console.log(`[BACKFILL] Sin URL:     ${skipped}`)
  console.log(`[BACKFILL] ==============================`)

  await prisma.$disconnect()
})().catch(async (err) => {
  console.error('[BACKFILL] FATAL:', err)
  await prisma.$disconnect()
  process.exit(1)
})

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}