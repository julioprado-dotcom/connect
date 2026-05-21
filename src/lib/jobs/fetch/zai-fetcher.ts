// Z.ai Fetcher v2 — Fetch con fallback Z.ai SDK
// FASE 1: fetch() nativo (desde el servidor)
// FASE 2: Z.ai page_reader (rutea por servidores de Z.ai, funciona aunque el VPS tenga restricciones de red)
// DECODEX Bolivia

import type { CheckResult } from '../types'

// ─── Interfaz ───────────────────────────────────────────────────

interface ZaiPageResult {
  title: string
  url: string
  html: string
  publishedTime?: string
  usage?: { tokens: number }
  source: 'native' | 'zai-sdk'
}

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'

// ─── Z.ai SDK singleton (lazy init) ────────────────────────────
let zaiInstance: Awaited<ReturnType<typeof import('z-ai-web-dev-sdk').ZAI.create>> | null = null

async function getZaiInstance() {
  if (zaiInstance) return zaiInstance
  try {
    const ZAI = (await import('z-ai-web-dev-sdk')).ZAI
    zaiInstance = await ZAI.create()
    return zaiInstance
  } catch (err) {
    console.warn('[ZaiFetch] No se pudo inicializar Z.ai SDK:', err instanceof Error ? err.message : err)
    return null
  }
}

// ─── Función principal ─────────────────────────────────────────

/**
 * Obtiene el contenido de una URL con doble estrategia:
 * 1. fetch() nativo desde el servidor (rápido, sin costo)
 * 2. Z.ai page_reader SDK (rutea por Z.ai, funciona con restricciones de red)
 *
 * Retorna null si ambos fallan (no lanza excepción).
 */
export async function zaiFetch(url: string, timeoutMs = 15000): Promise<ZaiPageResult | null> {
  // ═══════════════════════════════════════════════════════════
  // INTENTO 1: fetch() nativo (rápido, sin costo de tokens)
  // ═══════════════════════════════════════════════════════════
  const nativeResult = await nativeFetch(url, timeoutMs)
  if (nativeResult) {
    console.log(`[Fetch] NATIVO OK ${url} — "${nativeResult.title.substring(0, 50)}" (${nativeResult.html.length} chars)`)
    return nativeResult
  }

  // ═══════════════════════════════════════════════════════════
  // INTENTO 2: Z.ai SDK page_reader (rutea por servidores Z.ai)
  // ═══════════════════════════════════════════════════════════
  console.log(`[Fetch] Nativo falló, intentando Z.ai SDK page_reader: ${url}`)
  const zaiResult = await zaiPageReader(url)
  if (zaiResult) {
    console.log(`[Fetch] Z.AI OK ${url} — "${zaiResult.title.substring(0, 50)}" (${zaiResult.html.length} chars)`)
    return zaiResult
  }

  console.warn(`[Fetch] AMBOS FALLARON para ${url}`)
  return null
}

// ─── Fetch nativo ─────────────────────────────────────────────

async function nativeFetch(url: string, timeoutMs: number): Promise<ZaiPageResult | null> {
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
      console.warn(`[Fetch] Nativo: HTTP ${response.status} para ${url}`)
      return null
    }

    const html = await response.text()
    if (html.length < 200) {
      console.warn(`[Fetch] Nativo: HTML muy corto (${html.length} chars) para ${url}`)
      return null
    }

    const title = extractTitle(html)

    return { title, url: response.url || url, html, source: 'native' }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (msg.includes('abort') || msg.includes('timeout')) {
      console.warn(`[Fetch] Nativo: Timeout ${timeoutMs}ms para ${url}`)
    } else {
      console.warn(`[Fetch] Nativo: Error para ${url}: ${msg}`)
    }
    return null
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}

// ─── Z.ai SDK page_reader ─────────────────────────────────────

async function zaiPageReader(url: string): Promise<ZaiPageResult | null> {
  try {
    const zai = await getZaiInstance()
    if (!zai) {
      console.warn('[Fetch] Z.ai SDK no disponible')
      return null
    }

    const result = await zai.functions.invoke('page_reader', { url })

    if (!result || !result.data) {
      console.warn(`[Fetch] Z.ai: respuesta vacía para ${url}`)
      return null
    }

    const data = result.data
    const html = data.html || ''

    if (html.length < 200) {
      console.warn(`[Fetch] Z.ai: HTML muy corto (${html.length} chars) para ${url}`)
      return null
    }

    return {
      title: data.title || extractTitle(html),
      url: data.url || url,
      html,
      publishedTime: data.publishedTime || data.publish_time,
      usage: data.usage ? { tokens: data.usage.tokens || 0 } : undefined,
      source: 'zai-sdk',
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.warn(`[Fetch] Z.ai SDK error para ${url}: ${msg}`)
    return null
  }
}

// ─── Helpers ──────────────────────────────────────────────────

function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  if (!match) return ''
  return match[1].trim().replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
}

// ─── zaiFetchText (compatibilidad) ────────────────────────────

export async function zaiFetchText(url: string, timeoutMs = 30000): Promise<{
  title: string
  text: string
  url: string
  publishedTime?: string
} | null> {
  const page = await zaiFetch(url, timeoutMs)
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

// ─── zaiFingerprint (compatibilidad) ──────────────────────────

export async function zaiFingerprint(url: string): Promise<{
  hash: string
  title: string
  length: number
  html?: string
} | null> {
  const page = await zaiFetch(url)
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
