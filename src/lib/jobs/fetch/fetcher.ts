// Fetcher v3 — 100% nativo desde el VPS
// Sin dependencias de SDK externos para web proxy
// DECODEX Bolivia

// ─── Interfaz ───────────────────────────────────────────────────

interface PageResult {
  title: string
  url: string
  html: string
  publishedTime?: string
  source: 'native'
}

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'

// ─── Función principal ─────────────────────────────────────────

/**
 * Obtiene el contenido de una URL usando fetch nativo desde el VPS.
 * Retorna null si falla (no lanza excepción).
 */
export async function fetchPage(url: string, timeoutMs = 15000): Promise<PageResult | null> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined

  try {
    const controller = new AbortController()
    timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-BO,es;q=0.9,en;q=0.8',
        'Accept-Encoding': 'identity',
        'Cache-Control': 'no-cache',
      },
      signal: controller.signal,
      redirect: 'follow',
    })

    clearTimeout(timeoutId)
    timeoutId = undefined

    if (!response.ok) {
      console.warn(`[Fetch] HTTP ${response.status} para ${url}`)
      return null
    }

    const html = await response.text()
    if (html.length < 200) {
      console.warn(`[Fetch] HTML muy corto (${html.length} chars) para ${url}`)
      return null
    }

    const title = extractTitle(html)

    return { title, url: response.url || url, html, source: 'native' }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (msg.includes('abort') || msg.includes('timeout')) {
      console.warn(`[Fetch] Timeout ${timeoutMs}ms para ${url}`)
    } else {
      console.warn(`[Fetch] Error para ${url}: ${msg}`)
    }
    return null
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}

/**
 * Obtiene contenido de un ARTÍCULO usando fetch nativo.
 * Misma lógica que fetchPage — mantiene compatibilidad con callers que usaban zaiFetchArticle.
 */
export async function fetchArticle(url: string, timeoutMs = 20000): Promise<PageResult | null> {
  return fetchPage(url, timeoutMs)
}

// ─── Helpers ──────────────────────────────────────────────────

function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  if (!match) return ''
  return match[1].trim().replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
}

// ─── fetchText (compatibilidad) ────────────────────────────────

export async function fetchText(url: string, timeoutMs = 30000): Promise<{
  title: string
  text: string
  url: string
  publishedTime?: string
} | null> {
  const page = await fetchPage(url, timeoutMs)
  if (!page) return null

  const text = page.html
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
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)))
    .replace(/\s+/g, ' ')
    .trim()

  return {
    title: page.title,
    text,
    url: page.url,
    publishedTime: page.publishedTime,
  }
}

// ─── fingerprint (compatibilidad) ──────────────────────────

export async function fetchFingerprint(url: string): Promise<{
  hash: string
  title: string
  length: number
  html?: string
} | null> {
  const page = await fetchPage(url)
  if (!page) return null

  const normalized = page.html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/\d{13}/g, '')
    .replace(/"csrf[^"]*"\s*:\s*"[^"]*"/gi, '')
    .replace(/"nonce[^"]*"\s*:\s*"[^"]*"/gi, '')
    .replace(/\s+/g, ' ')
    .trim()

  const hash = await sha256(normalized)

  return {
    hash,
    title: page.title,
    length: normalized.length,
    html: page.html,
  }
}

async function sha256(input: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(input)
  const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

// ─── Compatibilidad: aliases para código existente ─────────

