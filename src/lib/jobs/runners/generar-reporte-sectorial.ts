// Runner: generar_reporte_sectorial - Reporte Sectorial Minero
// DECODEX Bolivia
//
// Productos con pipeline especializado que NO pasan por generate-internal:
//   - Menciones mineras con ejes temáticos del cliente
//   - Precios de metales (Yahoo Finance)
//   - Índice de exposición
//   - Comparación semana anterior (tendencias)
//   - Alertas sectoriales
//   - Factores externos
//   - Narrativa LLM (resumen ejecutivo, hitos, factores externos)
//   - HTML email + Telegram
//   - Guardado en DB (modelo ReporteSectorial, NO Reporte)
//
// Flujo: generarReporteMinero() → DB save (ReporteSectorial) → HTML → Telegram

import type { JobPayload, RunnerResult } from '../types'

export async function run(payload: JobPayload): Promise<RunnerResult> {
  const startTime = Date.now()

  try {
    console.log('[generar_reporte_sectorial] Iniciando generacion (pipeline especializado)')

    const { generarReporteMinero } = await import('@/lib/reporte-sectorial')
    const reporte = await generarReporteMinero(
      payload.periodoInicio ? new Date(payload.periodoInicio as string) : undefined,
      payload.periodoFin ? new Date(payload.periodoFin as string) : undefined,
    )

    const reporteId = (reporte as Record<string, unknown>)?.id
    const estado = (reporte as Record<string, unknown>)?.estado

    if (estado === 'fallido') {
      return {
        success: false,
        error: `Reporte sectorial generado con estado 'fallido'`,
        data: { tipoBoletin: 'REPORTE_SECTORIAL_MINERO', reporteId, estado },
      }
    }

    // Push a GitHub
    try {
      const { pushProductosToGithub } = await import('@/lib/git-utils')
      await pushProductosToGithub('Reporte Sectorial Minero generado')
    } catch (err) {
      console.warn('[generar_reporte_sectorial] GitHub push error (no bloqueante):', err)
    }

    // Auditoría
    const { default: db } = await import('@/lib/db')
    await db.systemLog.create({
      data: {
        modulo: 'generar_reporte_sectorial',
        accion: 'reporte_generado',
        detalle: `Reporte Sectorial Minero: ${reporteId}`,
        automatica: true,
        datos: JSON.stringify({
          tipo: 'REPORTE_SECTORIAL_MINERO',
          reporteId,
          responseTimeMs: Date.now() - startTime,
          path: 'internal',
        }),
      },
    }).catch(() => {})

    console.log(`[generar_reporte_sectorial] OK: ${reporteId} [${Date.now() - startTime}ms]`)

    return {
      success: true,
      data: {
        tipoBoletin: 'REPORTE_SECTORIAL_MINERO',
        reporteId,
        responseTime: Date.now() - startTime,
        path: 'internal',
      },
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error(`[generar_reporte_sectorial] Error: ${msg}`)
    return { success: false, error: msg }
  }
}

const handler = run

export default { handler }