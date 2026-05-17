/**
 * /api/jobs/stats — Full statistics dashboard data
 *
 * BLINDAJE: NUNCA devuelve HTTP 500. Si falla alguna consulta,
 * devuelve datos degradados con status 200.
 */

import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // Intentar importar y ejecutar todo. Si algo falla, devolver degradado.
    let fullStats = { cola: { pendientes: 0, enProgreso: 0, fallidos24h: 0, completados24h: 0, tiempoPromedioMs: 0 }, worker: { running: false, uptime: '0s', jobsCompleted: 0, jobsFailed: 0, jobsPerHour: 0, lastJobTime: null }, checkFirst: { sinCambios24h: 0, conCambios24h: 0, tasaAhorro: 0 }, fuentes: { activas: 0, conCambiosHoy: 0, degradadas: 0, conError: 0, topProductoras: [] } }
    let scheduler = { running: false, totalTasks: 0 }

    try {
      const { ensureWorkerRunning } = await import('@/lib/jobs')
      ensureWorkerRunning()
    } catch { /* Worker no disponible */ }

    try {
      const { getFullStats } = await import('@/lib/jobs/health')
      fullStats = await getFullStats()
    } catch (error) {
      console.error('[API /jobs/stats] getFullStats failed (returning degraded):', error)
    }

    try {
      const { getSchedulerStatus } = await import('@/lib/jobs/scheduler')
      scheduler = getSchedulerStatus()
    } catch {
      console.error('[API /jobs/stats] getSchedulerStatus failed (returning degraded)')
    }

    return NextResponse.json({
      status: 'ok',
      cola: fullStats.cola,
      worker: fullStats.worker,
      checkFirst: fullStats.checkFirst,
      fuentes: fullStats.fuentes,
      scheduler,
    })
  } catch (error) {
    // ULTIMO RECURSO: 200 con vacios. NUNCA 500.
    console.error('[API /jobs/stats] Unexpected error (returning degraded):', error)
    return NextResponse.json({
      status: 'degraded',
      cola: { pendientes: 0, enProgreso: 0, fallidos24h: 0, completados24h: 0, tiempoPromedioMs: 0 },
      worker: { running: false, uptime: '0s', jobsCompleted: 0, jobsFailed: 0, jobsPerHour: 0, lastJobTime: null },
      checkFirst: { sinCambios24h: 0, conCambios24h: 0, tasaAhorro: 0 },
      fuentes: { activas: 0, conCambiosHoy: 0, degradadas: 0, conError: 0, topProductoras: [] },
      scheduler: { running: false, totalTasks: 0 },
      message: 'Metricas no disponibles temporalmente',
    })
  }
}
