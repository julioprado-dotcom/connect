// Fuente Error Logger: utilidades para consulta, registro y resumen de errores de fuentes
// DECODEX Bolivia

import db from '@/lib/db'

// ─── Tipos ────────────────────────────────────────────────────────────

interface LogErrorParams {
  fuenteId: string
  medioId: string
  nivel: string
  tipoError: string
  estrategia: string
  url?: string
  mensaje?: string
  detalle?: string
  statusCode?: number
  responseTime?: number
}

// ─── Clasificacion de errores ─────────────────────────────────────────

/**
 * Clasifica un error (string) en un tipoError estandarizado para la tabla FuenteErrorLog.
 */
export function clasificarError(detalle: string): string {
  const d = (detalle || '').toLowerCase()

  if (d.includes('tls') || d.includes('ssl') || d.includes('certificate') || d.includes('cert_')) {
    return 'tls_error'
  }
  if (d.includes('timeout') || d.includes('timed out') || d.includes('etimedout')) {
    return 'timeout'
  }
  if (d.includes('403') || d.includes('waf') || d.includes('blocked') || d.includes('cloudflare') || d.includes('forbidden')) {
    return 'waf_blocked'
  }
  if (d.includes('enotfound') || d.includes('dns') || d.includes('getaddrinfo')) {
    return 'dns_error'
  }
  if (d.includes('econnrefused') || d.includes('econnreset') || d.includes('connection_refused') || d.includes('connection reset')) {
    return 'connection_refused'
  }
  if (d.includes('parse') || d.includes('json') || d.includes('xml') || d.includes('syntaxerror')) {
    return 'parse_error'
  }
  if (d.includes('empty') || d.includes('sin contenido') || d.includes('no content') || d.includes('body vacio')) {
    return 'empty_response'
  }
  if (d.includes('http') && (d.includes('429') || d.includes('500') || d.includes('502') || d.includes('503'))) {
    return 'http_error'
  }

  return 'unknown'
}

// ─── Registro de errores ────────────────────────────────────────────

/**
 * Registra un error estructurado en FuenteErrorLog para una fuente.
 */
export async function logErrorFuente(params: LogErrorParams): Promise<void> {
  try {
    await db.fuenteErrorLog.create({
      data: {
        fuenteId: params.fuenteId,
        medioId: params.medioId,
        nivel: params.nivel,
        tipoError: params.tipoError,
        estrategia: params.estrategia,
        url: params.url || '',
        mensaje: params.mensaje || '',
        detalle: params.detalle || '',
        statusCode: params.statusCode || 0,
        responseTime: params.responseTime || 0,
        resuelto: false,
      },
    })
  } catch (err) {
    console.error(`[fuente-error-logger] Error guardando log: ${err instanceof Error ? err.message : err}`)
  }
}

// ─── Resolucion de errores ──────────────────────────────────────────

/**
 * Marca todos los errores sin resolver de una fuente como resueltos.
 * Retorna la cantidad de errores marcados.
 */
export async function resolverErrores(fuenteId: string): Promise<number> {
  try {
    const result = await db.fuenteErrorLog.updateMany({
      where: {
        fuenteId,
        resuelto: false,
      },
      data: {
        resuelto: true,
      },
    })
    return result.count
  } catch (err) {
    console.error(`[fuente-error-logger] Error resolviendo errores: ${err instanceof Error ? err.message : err}`)
    return 0
  }
}

// ─── Consulta de errores ───────────────────────────────────────────

/**
 * Obtiene los errores activos (sin resolver) de todas las fuentes.
 */
export async function getErroresActivos(limit: number = 50) {
  try {
    return await db.fuenteErrorLog.findMany({
      where: { resuelto: false },
      orderBy: { fecha: 'desc' },
      take: limit,
      include: {
        Medio: { select: { id: true, nombre: true, nivel: true } },
      },
    })
  } catch {
    return []
  }
}

/**
 * Obtiene un resumen de errores de una fuente en las ultimas N horas.
 * Devuelve conteos agrupados por tipo de error y estado de resolucion.
 */
export async function getErrorSummary(
  fuenteId: string,
  hours: number = 24,
): Promise<{ total: number; sinResolver: number; porTipo: Record<string, number> }> {
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000)

  try {
    const errores = await db.fuenteErrorLog.findMany({
      where: {
        fuenteId,
        fecha: { gte: cutoff },
      },
      select: {
        tipoError: true,
        resuelto: true,
      },
    })

    const porTipo: Record<string, number> = {}
    let total = 0
    let sinResolver = 0

    for (const e of errores) {
      total++
      if (!e.resuelto) sinResolver++
      porTipo[e.tipoError] = (porTipo[e.tipoError] || 0) + 1
    }

    return { total, sinResolver, porTipo }
  } catch {
    return { total: 0, sinResolver: 0, porTipo: {} }
  }
}
