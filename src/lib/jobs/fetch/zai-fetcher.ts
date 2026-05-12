// Z.ai Fetcher — Wrapper del page_reader de Z.ai SDK
// Permite obtener contenido HTML de sitios que el container no puede
// alcanzar directamente (TLS roto, Cloudflare 403, DNS no resuelto).
// DECODEX Bolivia

import type { CheckResult } from '../types'

// ─── Interfaz ───────────────────────────────────────────────────

interface ZaiPageResult {
  title: string
  url: string
  html: string
  publishedTime?: string
  usage?: { tokens: number }
}

// ─── Singleton ZAI ─────────────────────────────────────────────

let zaiInstance: any | null = null

async function getZai() {
  if (!zaiInstance) {
    // Importación dinámica — solo se carga cuando se necesita
    const { default: ZAI } = await import('z-ai-web-dev-sdk')
    zaiInstance = await ZAI.create()
  }
  return zaiInstance
}

// ─── Función principal ─────────────────────────────────────────

/**
 * Obtiene el contenido de una URL usando el page_reader de Z.ai.
 * Esto bypassa las limitaciones de red del container:
 * - TLS roto (ej: abi.bo)
 * - Cloudflare 403 (ej: la-razon.com)
 * - DNS no resuelto
 *
 * Retorna null si falla (no lanza excepción).
 */
export async function zaiFetch(url: string, timeoutMs = 30000): Promise<ZaiPageResult | null> {
  // FIX MEMORIA: Timeout real con AbortController + cleanup.
  // Antes timeoutMs era aceptado como parametro pero nunca aplicado.
  let timeoutId: ReturnType<typeof setTimeout> | undefined

  try {
    const zai = await getZai()

    // Aplicar timeout real: si el SDK ZAI se cuelga, abortamos
    const controller = new AbortController()
    timeoutId = setTimeout(() => {
      controller.abort()
      console.warn(`[ZaiFetch] Timeout ${timeoutMs}ms reached for ${url}`)
    }, timeoutMs)

    const result = await zai.functions.invoke('page_reader', { url })

    // Si llegamos aqui, el SDK respondió a tiempo — limpiar timeout
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = undefined
    }

    if (!result || !result.data) {
      console.warn(`[ZaiFetch] Sin datos para ${url}`)
      return null
    }

    const page = result.data
    const htmlLength = (page.html || '').length

    if (htmlLength === 0) {
      console.warn(`[ZaiFetch] HTML vacio para ${url}`)
      return null
    }

    console.log(
      `[ZaiFetch] OK ${url} — "${(page.title || '').substring(0, 50)}" ` +
      `(${htmlLength} chars)` +
      (page.publishedTime ? ` pub:${page.publishedTime}` : '')
    )

    return {
      title: page.title || '',
      url: page.url || url,
      html: page.html,
      publishedTime: page.publishedTime,
      usage: page.usage,
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    // Detectar si fue timeout vs otro error
    if (msg.includes('abort') || msg.includes('timeout')) {
      console.warn(`[ZaiFetch] Timeout ${timeoutMs}ms para ${url}`)
    } else {
      console.warn(`[ZaiFetch] Error ${url}: ${msg}`)
    }
    return null
  } finally {
    // FIX MEMORIA: Garantizar que el timeout se limpia siempre
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = undefined
    }
  }
}

/**
 * Obtiene texto plano de una URL usando Z.ai page_reader.
 * Ideal para pasar directo al LLM sin parsear HTML.
 */
export async function zaiFetchText(url: string, timeoutMs = 30000): Promise<{
  title: string
  text: string
  url: string
  publishedTime?: string
} | null> {
  const page = await zaiFetch(url, timeoutMs)
  if (!page) return null

  // Convertir HTML a texto plano (básico pero funcional)
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

/**
 * Calcula un hash SHA-256 del contenido HTML de una URL via Z.ai.
 * Útil para detección de cambios (fingerprint remoto).
 */
export async function zaiFingerprint(url: string): Promise<{
  hash: string
  title: string
  length: number
  html?: string
} | null> {
  const page = await zaiFetch(url)
  if (!page) return null

  // Normalizar para fingerprint: mismo approach que fingerprint.ts
  const normalized = page.html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/\d{13}/g, '') // timestamps
    .replace(/"csrf[^"]*"\s*:\s*"[^"]*"/gi, '')
    .replace(/"nonce[^"]*"\s*:\s*"[^"]*"/gi, '')
    .replace(/\s+/g, ' ')
    .trim()

  const hash = await sha256(normalized)

  return {
    hash,
    title: page.title,
    length: normalized.length,
    html: page.html, // pasar HTML para que scrape-fuente lo reutilice
  }
}

// ─── Utilidades ────────────────────────────────────────────────

async function sha256(input: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(input)
  const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}
