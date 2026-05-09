// Runner: check_fuente - Verificacion Check-First de una fuente de medios
// DECODEX Bolivia

import type { JobPayload, RunnerResult } from '../types'
import { checkFuente } from '../check-first/strategies'
import { enqueue } from '../queue'

export async function run(payload: JobPayload): Promise<RunnerResult> {
  const fuenteId = payload.fuenteId as string
  const medioId = payload.medioId as string | undefined

  if (!fuenteId) {
    return {
      success: false,
      error: 'check_fuente requiere fuenteId en el payload',
    }
  }

  try {
    const result = await checkFuente(fuenteId)

    if (result.cambiado) {
      // Encolar scrape_fuente automaticamente al detectar cambio
      if (medioId) {
        const urls = (result.datosNuevos as Array<{link?: string}> | undefined)
          ?.map(d => d.link).filter(Boolean)
        await enqueue({
          tipo: 'scrape_fuente',
          payload: { fuenteId, medioId, ...(urls?.length ? { urls } : {}) },
          prioridad: 1, // alta prioridad para scrape tras cambio detectado
        }).catch(err => {
          console.warn(`[check-fuente] Error encolando scrape para fuente ${fuenteId}:`, err)
        })
      }

      return {
        success: true,
        data: {
          cambiado: true,
          fuenteId,
          medioId,
          tecnica: result.tecnica,
          detalle: result.detalle,
          datosNuevos: result.datosNuevos,
          responseTime: result.responseTime,
          tipoCheckUsado: result.tipoCheckUsado,
          scrapeEncolado: !!medioId,
          ...(result.error ? { error: result.error } : {}),
          ...(result.estrategiasProbadas ? { estrategiasProbadas: result.estrategiasProbadas } : {}),
        },
      }
    }

    // Sin cambio — propagar error si existe (estrategias fallaron pero no lanzaron excepción)
    return {
      success: true,
      data: {
        cambiado: false,
        fuenteId,
        medioId,
        tecnica: result.tecnica,
        detalle: result.detalle,
        responseTime: result.responseTime,
        tipoCheckUsado: result.tipoCheckUsado,
        ...(result.error ? { error: result.error } : {}),
        ...(result.estrategiasProbadas ? { estrategiasProbadas: result.estrategiasProbadas } : {}),
      },
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    return {
      success: false,
      error: `check_fuente fallo para fuente ${fuenteId}: ${msg}`,
    }
  }
}

// Registro automatico
const handler = run

export default { handler }
