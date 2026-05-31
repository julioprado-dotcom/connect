// Dispatcher  de estrategias Check-First - DECODEX Bolivia
// Con rotación automática: si una estrategia falla, prueba la siguiente
// y si alguna funciona, esa se convierte en la default para ese sitio

import db from '@/lib/db'
import { CHECK_FIRST_CONFIG, TIPO_CHECK_PATTERNS } from '../constants'
import type { CheckResult, TipoCheck } from '../types'
import { registrarResultadoCheck, determinarCapa, descripcionCapa } from '../source-lifecycle'
import { checkRSS } from './rss'
import { checkETag } from './etag'
import { checkFingerprint } from './fingerprint'

// ─── Orden de rotación de estrategias ─────────────────────────────
// Si la principal falla, intenta la siguiente en este orden
// 100% nativo desde el VPS — sin dependencias externas
const STRATEGY_ORDER: TipoCheck[] = ['rss', 'head', 'fingerprint', 'api']

// Obtener las estrategias en orden de fallback (después de la actual)
function getFallbackStrategies(current: TipoCheck): TipoCheck[] {
  const idx = STRATEGY_ORDER.indexOf(current)
  if (idx === -1) return [...STRATEGY_ORDER] // desconocido → probar todas
  // Primero las que están después, luego las que están antes (wrap-around)
  return [...STRATEGY_ORDER.slice(idx + 1), ...STRATEGY_ORDER.slice(0, idx)]
}

// Auto-detectar tipo de check por URL
export function detectarTipoCheck(url: string): TipoCheck {
  for (const { patron, tipo } of TIPO_CHECK_PATTERNS) {
    if (patron.test(url)) return tipo
  }
  // Default: intentar ETag/HEAD primero (mas ligero)
  return 'head'
}

// ─── Ejecutar una estrategia individual ───────────────────────────
interface StrategyResult {
  result: CheckResult & { responseTime?: number }
  datosActualizacion: Record<string, unknown>
  estrategia: TipoCheck
}

async function ejecutarEstrategia(
  estrategia: TipoCheck,
  url: string,
  fuente: {
    ultimosIds: string
    etag: string | null
    lastModified: string | null
    fingerprint: string | null
  },
): Promise<StrategyResult> {
  const datosActualizacion: Record<string, unknown> = { tipoCheck: estrategia }

  try {
    switch (estrategia) {
      case 'rss': {
        const rssResult = await checkRSS(url, fuente.ultimosIds, fuente.etag || undefined)
        const result: StrategyResult = {
          result: {
            cambiado: rssResult.cambiado,
            tecnica: rssResult.tecnica,
            detalle: rssResult.detalle,
            datosNuevos: rssResult.datosNuevos,
            responseTime: rssResult.responseTime,
            ...(rssResult.error ? { error: rssResult.error } : {}),
          },
          datosActualizacion,
          estrategia,
        }
        datosActualizacion.ultimosIds = JSON.stringify(rssResult.ultimosIdsActualizados)
        return result
      }

      case 'head': {
        const etagResult = await checkETag(
          url,
          fuente.etag || undefined,
          fuente.lastModified || undefined,
        )
        const result: StrategyResult = {
          result: {
            cambiado: etagResult.cambiado,
            tecnica: etagResult.tecnica,
            detalle: etagResult.detalle,
            responseTime: etagResult.responseTime,
            ...(etagResult.error ? { error: etagResult.error } : {}),
          },
          datosActualizacion,
          estrategia,
        }
        if (etagResult.newETag) datosActualizacion.etag = etagResult.newETag
        if (etagResult.newLastModified) datosActualizacion.lastModified = etagResult.newLastModified
        return result
      }

      case 'fingerprint': {
        const fpResult = await checkFingerprint(url, fuente.fingerprint || undefined)
        const result: StrategyResult = {
          result: {
            cambiado: fpResult.cambiado,
            tecnica: fpResult.tecnica,
            detalle: fpResult.detalle,
            responseTime: fpResult.responseTime,
            ...(fpResult.error ? { error: fpResult.error } : {}),
          },
          datosActualizacion,
          estrategia,
        }
        if (fpResult.newFingerprint) datosActualizacion.fingerprint = fpResult.newFingerprint
        return result
      }

      case 'api': {
        const fpResult = await checkFingerprint(url, fuente.fingerprint || undefined)
        const result: StrategyResult = {
          result: {
            cambiado: fpResult.cambiado,
            tecnica: 'api',
            detalle: fpResult.detalle,
            responseTime: fpResult.responseTime,
            ...(fpResult.error ? { error: fpResult.error } : {}),
          },
          datosActualizacion,
          estrategia,
        }
        if (fpResult.newFingerprint) datosActualizacion.fingerprint = fpResult.newFingerprint
        return result
      }

      default: {
        return {
          result: {
            cambiado: false,
            tecnica: 'none',
            detalle: `Tipo de check desconocido: ${estrategia}`,
            error: `tipo_desconocido: ${estrategia}`,
          },
          datosActualizacion,
          estrategia,
        }
      }
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    datosActualizacion.error = msg
    return {
      result: {
        cambiado: false,
        tecnica: estrategia,
        detalle: `Error [${estrategia}]: ${msg}`,
        error: msg,
      },
      datosActualizacion,
      estrategia,
    }
  }
}

// ─── Ejecutar check de una fuente con rotación automática ─────────
export async function checkFuente(fuenteId: string): Promise<CheckResult & {
  responseTime?: number
  tipoCheckUsado: TipoCheck
  datosActualizacion?: Record<string, unknown>
  estrategiasProbadas?: Array<{ estrategia: TipoCheck; exito: boolean; detalle: string }>
}> {
  // Obtener estado de la fuente
  const fuente = await db.fuenteEstado.findUnique({
    where: { id: fuenteId },
    include: { Medio: true },
  })

  if (!fuente) {
    return {
      cambiado: false,
      tecnica: 'none',
      detalle: `FuenteEstado ${fuenteId} no encontrado`,
      error: 'fuente_no_encontrada',
      tipoCheckUsado: 'head' as TipoCheck,
    }
  }

  if (!fuente.activo) {
    return {
      cambiado: false,
      tecnica: 'none',
      detalle: `Fuente ${fuente.Medio.nombre} inactiva`,
      tipoCheckUsado: fuente.tipoCheck as TipoCheck,
    }
  }

  // Verificar tiempo minimo entre checks
  if (fuente.ultimoCheck) {
    const minutosDesdeUltimo = (Date.now() - fuente.ultimoCheck.getTime()) / 60000
    if (minutosDesdeUltimo < CHECK_FIRST_CONFIG.minTimeBetweenChecks) {
      return {
        cambiado: false,
        tecnica: 'none',
        tipoCheckUsado: fuente.tipoCheck as TipoCheck,
        detalle: `Check demasiado reciente (${Math.round(minutosDesdeUltimo)} min)`,
      }
    }
  }

  const tipoCheckActual = (fuente.tipoCheck || detectarTipoCheck(fuente.url)) as TipoCheck
  const url = fuente.url
  const estrategiasProbadas: Array<{ estrategia: TipoCheck; exito: boolean; detalle: string }> = []

  // ─── 1. Intentar estrategia configurada ────────────────────────
  console.log(`[CheckFirst] ${fuente.Medio.nombre}: intentando "${tipoCheckActual}" en ${url}`)

  let intento = await ejecutarEstrategia(tipoCheckActual, url, fuente)
  estrategiasProbadas.push({
    estrategia: tipoCheckActual,
    exito: !intento.result.error,
    detalle: intento.result.detalle,
  })

  // ─── 2. Si falló, rotar estrategias automáticamente ────────────
  let estrategiaExitosa: TipoCheck | null = null
  let resultadoFinal = intento
  let datosActualizacionFinal = intento.datosActualizacion

  if (intento.result.error) {
    console.warn(
      `[CheckFirst] ${fuente.Medio.nombre}: "${tipoCheckActual}" FALLÓ → ${intento.result.detalle}`,
    )
    console.log(`[CheckFirst] ${fuente.Medio.nombre}: rotando estrategias...`)

    const fallbacks = getFallbackStrategies(tipoCheckActual)

    for (const fallback of fallbacks) {
      console.log(`[CheckFirst] ${fuente.Medio.nombre}: intentando fallback "${fallback}"...`)

      intento = await ejecutarEstrategia(fallback, url, fuente)
      estrategiasProbadas.push({
        estrategia: fallback,
        exito: !intento.result.error,
        detalle: intento.result.detalle,
      })

      if (!intento.result.error) {
        console.log(
          `[CheckFirst] ${fuente.Medio.nombre}: "${fallback}" EXITOSA → nueva estrategia default`,
        )
        estrategiaExitosa = fallback
        resultadoFinal = intento
        datosActualizacionFinal = intento.datosActualizacion
        break
      } else {
        console.warn(
          `[CheckFirst] ${fuente.Medio.nombre}: "${fallback}" también falló → ${intento.result.detalle}`,
        )
      }
    }
  } else {
    estrategiaExitosa = tipoCheckActual
  }

  // ─── 3. Si una estrategia diferente funcionó, actualizar default ─
  if (estrategiaExitosa && estrategiaExitosa !== tipoCheckActual) {
    console.log(
      `[CheckFirst] ${fuente.Medio.nombre}: actualizando tipoCheck "${tipoCheckActual}" → "${estrategiaExitosa}"`,
    )
    datosActualizacionFinal.tipoCheck = estrategiaExitosa
  }

  // ─── 3. Determinar resultado: éxito si AL MENOS UNA estrategia funcionó ─
  const checkExitoso = !!estrategiaExitosa

  // Update capacity demonstration timestamps — SOLO si hubo éxito
  if (checkExitoso) {
    datosActualizacionFinal.ultimoCheckOk = new Date()
    datosActualizacionFinal.strategyValid = estrategiaExitosa
    datosActualizacionFinal.capaActual = determinarCapa({
      ultimoCheckOk: new Date(),
      ultimoHeadline: fuente.ultimoHeadline,
      ultimoTexto: fuente.ultimoTexto,
      ultimoMencion: fuente.ultimoMencion,
      estado: fuente.estado || 'creada',
      activo: fuente.activo,
      fallosConsecutivos: 0, // Se acaba de resetear
    })
  }

  // Lifecycle: registrar resultado del check (actualiza fallos, estado, capa)
  const lifecycleResult = await registrarResultadoCheck(fuenteId, checkExitoso)
  if (lifecycleResult.degradacion) {
    console.warn(
      `[CheckFirst] ${fuente.Medio.nombre}: lifecycle degradación → ${lifecycleResult.degradacion.accion}`,
    )
  }
  if (lifecycleResult.promovida) {
    console.log(`[CheckFirst] ${fuente.Medio.nombre}: lifecycle promoción a "activa" (capa ${lifecycleResult.capa})`)
  }

  // Si TODAS fallaron, marcar error
  if (!checkExitoso) {
    console.error(
      `[CheckFirst] ${fuente.Medio.nombre}: TODAS las estrategias fallaron (capa ${lifecycleResult.capa}, ${fuente.fallosConsecutivos + 1} fallos consecutivos):`,
      estrategiasProbadas.map(e => `${e.estrategia}(${e.exito ? 'OK' : 'FAIL'})`).join(', '),
    )

    // Log structured error for dashboard visibility
    const lastError = estrategiasProbadas[estrategiasProbadas.length - 1]
    if (lastError) {
      try {
        const { logErrorFuente: logErr, clasificarError: clasif } = await import('../fuente-error-logger')
        await logErr({
          fuenteId,
          medioId: fuente.medioId,
          nivel: fuente.Medio.nivel,
          tipoError: clasif(lastError.detalle),
          estrategia: lastError.estrategia,
          url: fuente.url,
          mensaje: `Todas las estrategias fallaron: ${estrategiasProbadas.map(e => `${e.estrategia}(${e.exito ? 'OK' : 'FAIL'})`).join(', ')}`,
          detalle: lastError.detalle,
        })
      } catch (err) {
        console.error(`[CheckFirst] Error logging fuente error: ${err instanceof Error ? err.message : err}`)
      }
    }
  } else {
    // Mark previous errors as resolved
    try {
      const { resolverErrores } = await import('../fuente-error-logger')
      await resolverErrores(fuenteId)
    } catch (err) {
      console.error(`[CheckFirst] Error resolving errores: ${err instanceof Error ? err.message : err}`)
    }
  }

  // ─── 4. Actualizar FuenteEstado ────────────────────────────────
  await updateFuenteEstado(fuente, resultadoFinal.result, datosActualizacionFinal)

  // ─── 5. Construir detalle enriquecido con historial de rotación ─
  let detalleFinal = resultadoFinal.result.detalle
  if (estrategiasProbadas.length > 1) {
    const resumen = estrategiasProbadas
      .map(e => `${e.estrategia}:${e.exito ? 'OK' : 'FAIL'}`)
      .join(' → ')
    detalleFinal = `[Rotación: ${resumen}] ${resultadoFinal.result.detalle}`

    // Si cambió de estrategia, incluirlo en el detalle
    if (estrategiaExitosa && estrategiaExitosa !== tipoCheckActual) {
      detalleFinal = `[Estrategia cambiada: ${tipoCheckActual} → ${estrategiaExitosa}] ${resultadoFinal.result.detalle}`
    }
  }

  return {
    ...resultadoFinal.result,
    detalle: detalleFinal,
    tipoCheckUsado: estrategiaExitosa || tipoCheckActual,
    datosActualizacion: datosActualizacionFinal,
    estrategiasProbadas,
  }
}

// Actualizar FuenteEstado despues de un check
async function updateFuenteEstado(
  fuente: { id: string; totalChecks: number; checksSinCambio: number; error: string },
  result: CheckResult,
  datosActualizacion: Record<string, unknown>,
): Promise<void> {
  const now = new Date()

  // Datos para actualizar siempre despues de un check
  const updateData: Record<string, unknown> = {
    ultimoCheck: now,
    totalChecks: { increment: 1 },
    responseTime: result.responseTime || 0,
  }

  // Limpiar error previo si el check fue exitoso
  if (!result.error) {
    updateData.error = ''
  } else {
    updateData.error = result.error
  }

  // Si hubo cambio: resetear contador, actualizar ultimo cambio
  if (result.cambiado) {
    updateData.checksSinCambio = 0
    updateData.ultimoCambio = now
    updateData.totalCambios = { increment: 1 }
  } else {
    // Sin cambio: incrementar contador
    updateData.checksSinCambio = { increment: 1 }
  }

  // Campos especificos de la estrategia (incluyendo posible nuevo tipoCheck)
  for (const [key, value] of Object.entries(datosActualizacion)) {
    if (value !== undefined) {
      updateData[key] = value
    }
  }

  await db.fuenteEstado.update({
    where: { id: fuente.id },
    data: updateData,
  })
}
