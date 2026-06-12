// extraer-fecha-publicacion.ts — Extrae fecha de publicación de HTML de artículos
// DECODEX Bolivia
//
// Fuentes de fecha (en orden de prioridad):
// 1. <meta property="article:published_time" content="...">
// 2. <meta name="datePublished" content="...">
// 3. <meta name="DC.date.issued" content="...">
// 4. <meta name="pubdate" content="...">
// 5. <time datetime="..."> element
// 6. Schema.org datePublished in JSON-LD
// 7. Texto: patrones comunes "Publicado: 12 Jun 2026", "12 de junio de 2026", etc.

/**
 * Extrae la fecha de publicación de un HTML de artículo.
 * Devuelve null si no se encuentra.
 */
export function extraerFechaPublicacion(html: string): Date | null {
  if (!html || html.length < 100) return null

  // 1. Meta article:published_time (Open Graph)
  const ogDate = extractMetaContent(html, 'article:published_time')
  if (ogDate) return parseDate(ogDate)

  // 2. Meta datePublished
  const dpDate = extractMetaContent(html, 'datePublished')
  if (dpDate) return parseDate(dpDate)

  // 3. Meta DC.date.issued (Dublin Core)
  const dcDate = extractMetaContent(html, 'DC.date.issued')
  if (dcDate) return parseDate(dcDate)

  // 4. Meta pubdate
  const pubDate = extractMetaContent(html, 'pubdate')
  if (pubDate) return parseDate(pubDate)

  // 5. Meta date (genérico)
  const metaDate = extractMetaContent(html, 'date')
  if (metaDate) return parseDate(metaDate)

  // 6. <time datetime="...">
  const timeDate = extractTimeElement(html)
  if (timeDate) return parseDate(timeDate)

  // 7. Schema.org JSON-LD datePublished
  const schemaDate = extractSchemaOrgDate(html)
  if (schemaDate) return parseDate(schemaDate)

  // 8. Patrones de texto comunes en español
  const textDate = extractTextDate(html)
  if (textDate) return textDate

  return null
}

/**
 * Extrae fecha de publicación de un string RSS pubDate.
 * Soporta formatos RFC 2822, ISO 8601, y comunes.
 */
export function parseRSSPubDate(pubDate: string): Date | null {
  if (!pubDate || pubDate.trim().length < 8) return null
  return parseDate(pubDate.trim())
}

// ─── Internal helpers ────────────────────────────────────────

function extractMetaContent(html: string, name: string): string | null {
  // property="name" o name="name"
  const patterns = [
    new RegExp(`<meta\\s+[^>]*property=["']${escapeRegex(name)}["'][^>]*content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta\\s+[^>]*content=["']([^"']+)["'][^>]*property=["']${escapeRegex(name)}["']`, 'i'),
    new RegExp(`<meta\\s+[^>]*name=["']${escapeRegex(name)}["'][^>]*content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta\\s+[^>]*content=["']([^"']+)["'][^>]*name=["']${escapeRegex(name)}["']`, 'i'),
  ]
  for (const pattern of patterns) {
    const match = html.match(pattern)
    if (match?.[1]) return match[1].trim()
  }
  return null
}

function extractTimeElement(html: string): string | null {
  // <time datetime="2026-06-12T10:00:00-04:00">
  const timeMatch = html.match(/<time[^>]*datetime=["']([^"']+)["']/i)
  if (timeMatch?.[1]) return timeMatch[1].trim()

  // <time>12 de junio de 2026</time> — fallback to text content
  const timeTextMatch = html.match(/<time[^>]*>([^<]+)<\/time>/i)
  if (timeTextMatch?.[1]) return timeTextMatch[1].trim()

  return null
}

function extractSchemaOrgDate(html: string): string | null {
  // Look for "datePublished": "2026-06-12..." in JSON-LD
  const jsonLdMatch = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i)
  if (!jsonLdMatch?.[1]) return null

  try {
    const data = JSON.parse(jsonLdMatch[1])
    // Could be a single object or an array
    const items = Array.isArray(data) ? data : [data]
    for (const item of items) {
      if (item.datePublished) return item.datePublished
      if (item['@type'] === 'NewsArticle' && item.datePublished) return item.datePublished
    }
  } catch {
    // Malformed JSON, skip
  }
  return null
}

function extractTextDate(html: string): Date | null {
  // Buscar patrones comunes en español dentro de los primeros 5000 chars
  const head = html.substring(0, 5000)

  // Patrones: "12 de junio de 2026", "12 Jun 2026", "12/06/2026"
  const patterns = [
    // "12 de junio de 2026" o "12 de Junio de 2026"
    /(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+de\s+(\d{4})/i,
    // "12 Jun 2026" o "12 junio 2026"
    /(\d{1,2})\s+(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+(\d{4})/i,
    // "Publicado: 12/06/2026" o "12-06-2026"
    /(?:publicad[oa]|fecha)[^:]*:\s*(\d{1,4})[\/\-](\d{1,2})[\/\-](\d{1,4})/i,
  ]

  const meses: Record<string, number> = {
    enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
    julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
    ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6,
    jul: 7, ago: 8, sep: 9, oct: 10, nov: 11, dic: 12,
  }

  for (const pattern of patterns) {
    const match = head.match(pattern)
    if (!match) continue

    if (match.length === 4 && meses[match[2].toLowerCase()]) {
      // Patrón "12 de junio de 2026"
      const day = parseInt(match[1])
      const month = meses[match[2].toLowerCase()]
      const year = parseInt(match[3])
      if (isValidDate(year, month, day)) return new Date(year, month - 1, day)
    } else if (match.length === 4 && !isNaN(parseInt(match[2]))) {
      // Patrón numérico dd/mm/yyyy
      const a = parseInt(match[1])
      const b = parseInt(match[2])
      const c = parseInt(match[3])
      // Intentar dd/mm/yyyy primero (formato latinoamericano)
      if (isValidDate(c, b, a)) return new Date(c, b - 1, a)
      if (isValidDate(c, a, b)) return new Date(c, a - 1, b)
    }
  }

  return null
}

function parseDate(str: string): Date | null {
  if (!str) return null

  // Limpiar la cadena
  str = str.trim()

  // Intentar parseo nativo (ISO 8601, RFC 2822)
  const native = new Date(str)
  if (!isNaN(native.getTime()) && native.getFullYear() >= 2020 && native.getFullYear() <= 2030) {
    return native
  }

  // Intentar con segundos extras al final (común en APIs)
  const cleaned = str.replace(/\.\d+\s*$/, '')
  const cleanedDate = new Date(cleaned)
  if (!isNaN(cleanedDate.getTime()) && cleanedDate.getFullYear() >= 2020 && cleanedDate.getFullYear() <= 2030) {
    return cleanedDate
  }

  // Intentar separar fecha y hora si vienen juntas sin T
  const dtMatch = str.match(/(\d{4}[-\/]\d{2}[-\/]\d{2})\s+(\d{2}:\d{2}(:\d{2})?)/)
  if (dtMatch) {
    const isoStr = dtMatch[1] + 'T' + dtMatch[2]
    const d = new Date(isoStr)
    if (!isNaN(d.getTime()) && d.getFullYear() >= 2020 && d.getFullYear() <= 2030) {
      return d
    }
  }

  return null
}

function isValidDate(year: number, month: number, day: number): boolean {
  if (year < 2020 || year > 2030) return false
  if (month < 1 || month > 12) return false
  if (day < 1 || day > 31) return false
  const d = new Date(year, month - 1, day)
  return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}