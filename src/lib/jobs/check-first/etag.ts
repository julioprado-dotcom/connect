// Check por ETag / Last-Modified / HEAD request - DECODEX Bolivia
// Estrategia mas ligera: solo headers HTTP, sin descargar contenido

import { CHECK_FIRST_CONFIG } from '../constants'
import { safeFetch } from './safe-fetch'
import type { CheckResult } from '../types'

export async function checkETag(
  url: string,
  cachedETag?: string,
  cachedLastModified?: string,
): Promise<CheckResult & {
  newETag?: string
  newLastModified?: string
}> {
  const startTime = Date.now()

  try {
    // HEAD request - no descarga contenido
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Accept': '*/*',
    }

    // Si tenemos ETag cacheado, usar If-None-Match
    if (cachedETag) {
      headers['If-None-Match'] = cachedETag
    }
    // Si tenemos Last-Modified, usar If-Modified-Since
    if (cachedLastModified) {
      headers['If-Modified-Since'] = cachedLastModified
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), CHECK_FIRST_CONFIG.timeoutMs)

    const response = await safeFetch(url, {
      method: 'HEAD',
      headers,
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    const responseTime = Date.now() - startTime
    const newETag = response.headers.get('etag') || undefined
    const newLastModified = response.headers.get('last-modified') || undefined
    const newContentLength = response.headers.get('content-length')

    // 304 Not Modified
    if (response.status === 304) {
      return {
        cambiado: false,
        tecnica: 'head',
        detalle: `304 Not Modified (ETag/Last-Modified cacheado) [${responseTime}ms]`,
        responseTime,
      }
    }

    if (!response.ok) {
      return {
        cambiado: false,
        tecnica: 'head',
        detalle: `HTTP ${response.status}: ${response.statusText} [${responseTime}ms]`,
        responseTime,
        error: `HTTP ${response.status}`,
      }
    }

    // Verificar si los headers cambiaron
    const etagChanged = cachedETag && newETag && cachedETag !== newETag
    const lmChanged = cachedLastModified && newLastModified && cachedLastModified !== newLastModified

    if (etagChanged || lmChanged) {
      return {
        cambiado: true,
        tecnica: 'head',
        detalle: `Headers cambiaron: ETag=${etagChanged ? 'si' : 'no'} LM=${lmChanged ? 'si' : 'no'} [${responseTime}ms]`,
        newETag,
        newLastModified,
        responseTime,
      }
    }

    // Primera vez (no hay cache) - siempre marcar como cambiado para forzar primer fetch
    if (!cachedETag && !cachedLastModified) {
      return {
        cambiado: true,
        tecnica: 'head',
        detalle: `Primera verificacion, sin cache previo [${responseTime}ms]`,
        newETag,
        newLastModified,
        responseTime,
      }
    }

    // Headers iguales o no disponibles - sin cambios
    return {
      cambiado: false,
      tecnica: 'head',
      detalle: `Headers sin cambios (ETag+LM iguales) [${responseTime}ms]`,
      newETag,
      newLastModified,
      responseTime,
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    return {
      cambiado: false,
      tecnica: 'head',
      detalle: `Error: ${msg}`,
      responseTime: Date.now() - startTime,
      error: msg,
    }
  }
}
