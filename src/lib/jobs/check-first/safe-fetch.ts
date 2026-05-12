// safeFetch - DECODEX Bolivia
// Wrapper de fetch que maneja certificados TLS mal configurados
// Algunos sitios bolivianos (ej: abi.bo) tienen cadenas de certificados incompletas
// Intenta fetch normal primero (seguro), y si falla por TLS, usa https nativo con rejectUnauthorized: false
//
// NOTA: Este archivo importa node:https, lo cual genera warnings de Edge Runtime en Turbopack.
// Eso es esperado y no bloquea: instrumentation.ts (Node.js runtime) es quien orquesta los checks.
// Las API routes que usan check-first se ejecutan en Node.js runtime, no Edge.

import https from 'node:https'
import type { IncomingHttpHeaders } from 'node:http'
import { CHECK_FIRST_CONFIG } from '../constants'

// Agente TLS inseguro reutilizable (conexiones keep-alive)
// FIX MEMORIA #6: Limitar maxFreeSockets para evitar acumulación de conexiones idle
const insecureAgent = new https.Agent({
  rejectUnauthorized: false,
  keepAlive: true,
  maxFreeSockets: 5,     // FIX: limitar sockets idle (antes sin límite)
  maxSockets: 10,
  timeout: 15_000,
})

// TLS error codes known in Node.js
const TLS_ERROR_CODES: ReadonlySet<string> = new Set([
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'CERT_HAS_EXPIRED',
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'ERR_TLS_CERT_ALTNAME_INVALID',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'CERT_SIGNATURE_FAILURE',
  'ERR_SSL_PINNED_KEY_NOT_IN_CERT_CHAIN',
])

// Walk the error cause chain (fetch errors nest deeply: err.cause.cause.cause...)
// Returns an array of { code, message } objects found while traversing
function walkCauses(error: unknown): Array<{ code?: string; message?: string }> {
  const results: Array<{ code?: string; message?: string }> = []
  let current: unknown = error
  let depth = 0

  while (current && depth < 5) {
    if (current instanceof Error) {
      const raw = current as unknown as Record<string, unknown>
      const code = typeof raw.code === 'string' ? raw.code : undefined
      results.push({ code, message: current.message })
      current = raw.cause
    } else if (typeof current === 'object' && current !== null) {
      const obj = current as Record<string, unknown>
      const code = typeof obj.code === 'string' ? obj.code : undefined
      const message = typeof obj.message === 'string' ? obj.message : undefined
      results.push({ code, message })
      current = obj.cause
    } else {
      break
    }
    depth++
  }

  return results
}

// Detectar errores de certificado TLS (robusto: recorre toda la cadena de causas)
function isTLSError(error: unknown): boolean {
  if (!error) return false
  const msg = error instanceof Error ? error.message : String(error)

  if (
    msg.includes('certificate') ||
    msg.includes('CERT') ||
    msg.includes('unable to verify') ||
    msg.includes('self signed')
  ) {
    return true
  }

  const causes = walkCauses(error)
  for (let i = 0; i < causes.length; i++) {
    const entry = causes[i]
    if (entry.code && TLS_ERROR_CODES.has(entry.code)) return true
    if (entry.message && (
      entry.message.includes('certificate') ||
      entry.message.includes('unable to verify') ||
      entry.message.includes('self signed')
    )) {
      return true
    }
  }

  return false
}

// Fetch con fallback TLS inseguro para sitios con certificados rotos
// Manejo explícito de 304: si el fetch nativo retorna 304, no activa TLS fallback.
// Si el TLS fallback recibe 304, lo retorna como Response válida (sin body significativo).
export async function safeFetch(
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  try {
    const response = await fetch(url, init)

    // 304 Not Modified — respuesta válida, no activar fallback
    // La capa superior (checkETag, checkRSS) sabe manejar este status
    if (response.status === 304) {
      return response
    }

    // Solo si el fetch falla por error (no por status HTTP), intentar TLS fallback
    return response
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error)
    const tlsDetected = isTLSError(error)

    if (!tlsDetected) {
      console.error('[safeFetch] Error NO-TLS en ' + url + ': ' + errMsg)
      throw error
    }

    console.warn('[safeFetch] TLS fallback para ' + url)
    try {
      const response = await httpsFetch(url, init)
      console.log('[safeFetch] TLS fallback OK: ' + response.status)
      return response
    } catch (fallbackError: unknown) {
      const fbMsg = fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
      console.error('[safeFetch] TLS fallback FALLO: ' + fbMsg)
      throw fallbackError
    }
  }
}

function httpsFetch(url: string, init: RequestInit = {}): Promise<Response> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url)
    const method = ((init.method as string) || 'GET').toUpperCase()
    const headers = (init.headers as Record<string, string>) || {}

    const reqOptions: https.RequestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method,
      headers: {
        ...headers,
        Host: urlObj.hostname,
      },
      agent: insecureAgent,
    }

    const req = https.request(reqOptions, (res) => {
      // FIX MEMORIA #7: Aplicar maxContentBytes para evitar respuestas HTTP masivas
      const chunks: Buffer[] = []
      let totalSize = 0
      res.on('data', (chunk: Buffer) => {
        totalSize += chunk.length
        if (totalSize > CHECK_FIRST_CONFIG.maxContentBytes) {
          req.destroy(new Error(`Response too large: ${totalSize} > ${CHECK_FIRST_CONFIG.maxContentBytes} bytes`))
          return
        }
        chunks.push(chunk)
      })
      res.on('end', () => {
        try {
          const body = Buffer.concat(chunks)
          const response = new Response(body, {
            status: res.statusCode || 200,
            statusText: res.statusMessage || '',
            headers: normalizeHeaders(res.headers),
          })
          resolve(response)
        } catch (endError: unknown) {
          // Captura excepciones síncronas en el callback end (ej: body corrupto, 304 inesperado)
          // que de otro modo se convertirían en uncaughtException
          const msg = endError instanceof Error ? endError.message : String(endError)
          console.error('[safeFetch] Error en res.on(end) para ' + url + ': ' + msg)
          reject(endError instanceof Error ? endError : new Error(msg))
        }
      })
      res.on('error', (err: Error) => reject(err))
    })

    req.on('error', reject)
    req.on('timeout', () => {
      req.destroy(new Error('Request timeout'))
    })

    if (init.signal) {
      if (init.signal.aborted) {
        req.destroy(new Error('Aborted'))
        return
      }
      // FIX MEMORIA #6: Remover listener al completar para evitar acumulación
      const onAbort = () => { req.destroy(new Error('Aborted')) }
      init.signal.addEventListener('abort', onAbort)
      // Limpiar listener cuando la request termine (éxito o error)
      req.on('close', () => {
        init.signal!.removeEventListener('abort', onAbort)
      })
    }

    if (init.body) {
      const bodyStr = typeof init.body === 'string' ? init.body : String(init.body)
      req.write(bodyStr)
    }

    req.end()
  })
}

function normalizeHeaders(nodeHeaders: IncomingHttpHeaders): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(nodeHeaders)) {
    if (value === undefined || value === null) continue
    if (Array.isArray(value)) {
      result[key] = value.join(', ')
    } else {
      result[key] = value
    }
  }
  return result
}
