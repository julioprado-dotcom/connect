// Runner: check_indicador - Verificacion de indicadores macroeconomicos
// DECODEX Bolivia
// Similar a check_fuente pero especializado para indicadores (tipo de cambio, LME, etc.)

import db from '@/lib/db'
import { CHECK_FIRST_CONFIG } from '../constants'
import type { JobPayload, RunnerResult } from '../types'

export async function run(payload: JobPayload): Promise<RunnerResult> {
  const indicadorId = payload.indicadorId as string
  const medioId = payload.medioId as string | undefined
  const url = payload.url as string | undefined

  if (!indicadorId) {
    return {
      success: false,
      error: 'check_indicador requiere indicadorId en el payload',
    }
  }

  const startTime = Date.now()

  try {
    // Obtener datos del indicador
    const indicador = await db.indicador.findUnique({
      where: { id: indicadorId },
    })

    if (!indicador) {
      return {
        success: false,
        error: `Indicador ${indicadorId} no encontrado`,
      }
    }

    if (!indicador.activo) {
      return {
        success: true,
        data: { cambiado: false, detalle: 'Indicador inactivo' },
      }
    }

    const checkUrl = url || indicador.url
    if (!checkUrl) {
      return {
        success: false,
        error: `Indicador ${indicador.nombre} no tiene URL configurada`,
      }
    }

    // Obtener ultimo valor guardado (hoy)
    const hoyInicio = new Date()
    hoyInicio.setHours(0, 0, 0, 0)

    const ultimoValor = await db.indicadorValor.findFirst({
      where: {
        indicadorId,
        fecha: { gte: hoyInicio },
      },
      orderBy: { fecha: 'desc' },
    })

    // Para indicadores, siempre hacemos un GET (no HEAD)
    // porque necesitamos extraer el valor actual
    const headers: Record<string, string> = {
      'User-Agent': CHECK_FIRST_CONFIG.userAgent,
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), CHECK_FIRST_CONFIG.timeoutMs)

    const response = await fetch(checkUrl, { headers, signal: controller.signal })
    clearTimeout(timeoutId)

    const responseTime = Date.now() - startTime

    if (!response.ok) {
      // Marcar error pero no fallar el job completamente
      return {
        success: true,
        data: {
          cambiado: false,
          indicadorId,
          indicadorNombre: indicador.nombre,
          tecnica: 'api',
          detalle: `HTTP ${response.status} para ${indicador.nombre}`,
          responseTime,
          requiereCaptura: false,
        },
      }
    }

    // Para indicadores, siempre requerimos captura
    // La comparacion del valor se hace en el runner capture_indicador
    // Aqui solo verificamos que el endpoint responde y es accesible
    const contentType = response.headers.get('content-type') || ''

    // Si ya tenemos un valor hoy y es una captura periodica, verificar si es hora
    const esPrimeraCapturaHoy = !ultimoValor
    const minutosDesdeUltima = ultimoValor
      ? (Date.now() - ultimoValor.fechaCaptura.getTime()) / 60000
      : Infinity

    // Si ya capturamos en los ultimos 30 minutos, no volver a capturar
    if (!esPrimeraCapturaHoy && minutosDesdeUltima < CHECK_FIRST_CONFIG.minTimeBetweenChecks) {
      return {
        success: true,
        data: {
          cambiado: false,
          indicadorId,
          indicadorNombre: indicador.nombre,
          tecnica: 'api',
          detalle: `Capturado recientemente (${Math.round(minutosDesdeUltima)} min)`,
          responseTime,
          requiereCaptura: false,
        },
      }
    }

    // Endpoint accesible, requiere captura
    return {
      success: true,
      data: {
        cambiado: true,  // Siempre true para forzar captura si no hay reciente
        indicadorId,
        indicadorNombre: indicador.nombre,
        tecnica: 'api',
        detalle: `Endpoint accesible (content-type: ${contentType}) [${responseTime}ms]`,
        responseTime,
        requiereCaptura: true,
      },
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    return {
      success: false,
      error: `check_indicador fallo para ${indicadorId}: ${msg}`,
    }
  }
}

const handler = run

export default { handler }
