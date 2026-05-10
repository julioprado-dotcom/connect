// Check por fingerprint SHA-256 - DECODEX Bolivia
// Descarga contenido parcial, calcula hash, compara contra cache

import { CHECK_FIRST_CONFIG } from '../constants'
import { safeFetch } from './safe-fetch'
import type { CheckResult } from '../types'

// Calcular SHA-256 de un string usando Web Crypto API (disponible en Node 18+)
async function sha256(input: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(input)
  const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

// Normalizar contenido HTML: remover timestamps, IDs dinamicos, scripts
function normalizeContent(html: string): string {
  let normalized = html

  // Remover scripts y styles
  normalized = normalized.replace(/<script[\s\S]*?<\/script>/gi, '')
  normalized = normalized.replace(/<style[\s\S]*?<\/style>/gi, '')

  // Remover timestamps comunes en formato timestamp (13 digitos)
  normalized = normalized.replace(/["'][\d]{13}["']/g, '""')

  // Remover tokens/nonce comunes
  normalized = normalized.replace(/["']csrf[^"']*["']/gi, '""')
  normalized = normalized.replace(/nonce=["'][^"']*["']/gi, 'nonce=""')

  // Remover atributos data-* dinamicos comunes
  normalized = normalized.replace(/data-timestamp=["'][^"']*["']/gi, '')

  // Normalizar whitespace multiple
  normalized = normalized.replace(/\s+/g, ' ')

  return normalized.trim()
}

// Extraer solo el body o una porcion representativa del HTML
function extractRelevantContent(html: string, maxBytes: number = CHECK_FIRST_CONFIG.maxContentBytes): string {
  // Intentar extraer solo el body
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
  const content = bodyMatch ? bodyMatch[1] : html

  // Truncar al limite configurado
  if (content.length > maxBytes) {
    return content.substring(0, maxBytes)
  }
  return content
}

export async function checkFingerprint(
  url: string,
  cachedFingerprint?: string,
): Promise<CheckResult & {
  newFingerprint?: string
}> {
  const startTime = Date.now()

  try {
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'es-BO,es;q=0.9,en;q=0.8',
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), CHECK_FIRST_CONFIG.timeoutMs)

    const response = await safeFetch(url, {
      headers,
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    const responseTime = Date.now() - startTime

    // 304 Not Modified — sin descarga de contenido
    if (response.status === 304) {
      return {
        cambiado: false,
        tecnica: 'fingerprint',
        detalle: `304 Not Modified (contenido sin cambios) [${responseTime}ms]`,
        responseTime,
      }
    }

    if (!response.ok) {
      // Detección específica de WAF (Cloudflare, Akamai, etc.)
      const server = response.headers.get('server') || ''
      const isWAF = server.includes('cloudflare') || response.status === 403
      const wafError = isWAF ? `waf_blocked: ${server} — requiere navegador headless` : `HTTP ${response.status}`

      return {
        cambiado: false,
        tecnica: 'fingerprint',
        detalle: isWAF
          ? `WAF bloqueo (${server}) — detección automática, fuente desactivada [${responseTime}ms]`
          : `HTTP ${response.status}: ${response.statusText} [${responseTime}ms]`,
        responseTime,
        error: wafError,
      }
    }

    const html = await response.text()

    // Verificar si el contenido es una challenge page (WAF que devolvió 200 con JS challenge)
    const isChallengePage = html.includes('Just a moment') ||
      html.includes('cf-browser-verification') ||
      html.includes('challenge-platform')
    if (isChallengePage && html.length < 10000) {
      return {
        cambiado: false,
        tecnica: 'fingerprint',
        detalle: `WAF JS Challenge detectado (200 con challenge page, ${html.length}b) [${responseTime}ms]`,
        responseTime,
        error: `waf_blocked: Cloudflare JS Challenge — requiere navegador headless`,
      }
    }

    // Extraer contenido relevante y normalizar
    const relevant = extractRelevantContent(html)
    const normalized = normalizeContent(relevant)

    // Calcular fingerprint
    const newFingerprint = await sha256(normalized)

    // Primera vez: sin cache, marcar como cambiado
    if (!cachedFingerprint) {
      return {
        cambiado: true,
        tecnica: 'fingerprint',
        detalle: `Primera verificacion, fingerprint generado [${responseTime}ms]`,
        newFingerprint,
        responseTime,
      }
    }

    // Comparar fingerprints
    if (newFingerprint === cachedFingerprint) {
      return {
        cambiado: false,
        tecnica: 'fingerprint',
        detalle: `Sin cambios (SHA-256 coincide) [${responseTime}ms]`,
        newFingerprint,
        responseTime,
      }
    }

    // Fingerprint diferente = cambio detectado
    return {
      cambiado: true,
      tecnica: 'fingerprint',
      detalle: `Cambio detectado (SHA-256 diferente) [${responseTime}ms]`,
      newFingerprint,
      responseTime,
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    return {
      cambiado: false,
      tecnica: 'fingerprint',
      detalle: `Error: ${msg}`,
      responseTime: Date.now() - startTime,
      error: msg,
    }
  }
}
