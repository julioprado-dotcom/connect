// Health Monitor - metricas periodicas del sistema - DECODEX Bolivia

import db from '@/lib/db'
import { HEALTH_CONFIG } from './constants'
import { getWorkerStats } from './worker'
import { reclaimOrphanJobs } from './queue'
import type { QueueStats, CheckFirstStats, FuentesStats } from './types'

let intervalId: ReturnType<typeof setInterval> | null = null

// Iniciar health monitor
export function startHealthMonitor(): void {
  if (intervalId) return
  console.log('[Health] Monitor iniciado (cada ' + HEALTH_CONFIG.intervalMs / 1000 + 's)')

  intervalId = setInterval(() => {
    checkHealth().catch(err => {
      console.error('[Health] Error:', err.message)
    })
  }, HEALTH_CONFIG.intervalMs)
}

// Detener health monitor
export function stopHealthMonitor(): void {
  if (intervalId) {
    clearInterval(intervalId)
    intervalId = null
    console.log('[Health] Monitor detenido')
  }
}

// Verificacion periodica
async function checkHealth(): Promise<void> {
  const now = new Date()

  // Jobs pendientes
  const pendientes = await db.job.count({ where: { estado: 'pendiente' } })
  if (pendientes > HEALTH_CONFIG.warnPendingJobs) {
    console.warn(`[Health] ${pendientes} jobs pendientes (limite: ${HEALTH_CONFIG.warnPendingJobs})`)
  }

  // Jobs fallidos en 24h
  const cutoff24h = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const fallidos24h = await db.job.count({
    where: {
      estado: 'fallido',
      fechaFin: { gte: cutoff24h },
    },
  })
  if (fallidos24h > HEALTH_CONFIG.warnFailed24h) {
    console.warn(`[Health] ${fallidos24h} jobs fallidos en 24h (limite: ${HEALTH_CONFIG.warnFailed24h})`)
  }

  // Worker idle check
  const worker = getWorkerStats()
  if (worker.running && worker.lastJobTime) {
    const idleMinutes = (now.getTime() - worker.lastJobTime.getTime()) / 60000
    if (idleMinutes > HEALTH_CONFIG.warnIdleMinutes && pendientes > 0) {
      console.warn(`[Health] Worker idle ${Math.round(idleMinutes)}m con ${pendientes} jobs pendientes`)
    }
  }

  // Memory check
  if (globalThis.process && typeof globalThis.process.memoryUsage === 'function') {
    const mem = globalThis.process.memoryUsage()
    const heapMb = Math.round(mem.heapUsed / 1024 / 1024)
    if (heapMb > HEALTH_CONFIG.warnMemoryMb) {
      console.warn(`[Health] Heap: ${heapMb}MB (limite: ${HEALTH_CONFIG.warnMemoryMb}MB)`)
    }
  }

  // Reclaim jobs huerfanos (en_progreso > 10 min)
  try {
    const reclaimed = await reclaimOrphanJobs(10 * 60 * 1000)
    if (reclaimed > 0) {
      console.warn(`[Health] Reclaim: ${reclaimed} jobs huerfanos recuperados`)
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error(`[Health] Error en reclaim: ${msg}`)
  }
}

// Obtener estadisticas completas para el dashboard
export async function getFullStats(): Promise<{
  cola: QueueStats
  worker: ReturnType<typeof getWorkerStats>
  checkFirst: CheckFirstStats
  fuentes: FuentesStats
}> {
  const now = new Date()
  const cutoff24h = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  // Stats de la cola
  const [pendientes, enProgreso] = await Promise.all([
    db.job.count({ where: { estado: 'pendiente' } }),
    db.job.count({ where: { estado: 'en_progreso' } }),
  ])

  const fallidos24h = await db.job.count({
    where: { estado: 'fallido', fechaFin: { gte: cutoff24h } },
  })

  const completados24h = await db.job.count({
    where: { estado: 'completado', fechaFin: { gte: cutoff24h } },
  })

  // Tiempo promedio de jobs completados en 24h
  const avgJobs = await db.job.findMany({
    where: {
      estado: 'completado',
      fechaFin: { gte: cutoff24h },
      fechaInicio: { not: null },
    },
    select: { fechaInicio: true, fechaFin: true },
    take: 100,
  })

  const tiempos = avgJobs
    .filter((j: { fechaInicio: Date | null; fechaFin: Date | null }) => j.fechaInicio && j.fechaFin)
    .map((j: { fechaInicio: Date | null; fechaFin: Date | null }) => j.fechaFin!.getTime() - j.fechaInicio!.getTime())

  const tiempoPromedio = tiempos.length > 0
    ? Math.round(tiempos.reduce((a: number, b: number) => a + b, 0) / tiempos.length)
    : 0

  const cola: QueueStats = {
    pendientes,
    enProgreso,
    fallidos24h,
    completados24h,
    tiempoPromedioMs: tiempoPromedio,
  }

  // Worker stats
  const workerStats = getWorkerStats()

  // Check-First stats (hoy)
  const hoyInicio = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  const fuentesCheckeadas = await db.fuenteEstado.findMany({
    where: {
      ultimoCheck: { gte: hoyInicio },
    },
    select: {
      totalChecks: true,
      totalCambios: true,
      checksSinCambio: true,
      medio: { select: { nombre: true } },
    },
  })

  let sinCambios = 0
  let conCambios = 0
  const topProductoras: { medio: string; cambios: number }[] = []

  for (const f of fuentesCheckeadas) {
    if (f.totalCambios > 0) {
      conCambios++
      topProductoras.push({
        medio: f.medio.nombre,
        cambios: f.totalCambios,
      })
    } else {
      sinCambios++
    }
  }

  topProductoras.sort((a, b) => b.cambios - a.cambios)

  const checkFirst: CheckFirstStats = {
    sinCambios24h: sinCambios,
    conCambios24h: conCambios,
    tasaAhorro: (sinCambios + conCambios) > 0
      ? Math.round((sinCambios / (sinCambios + conCambios)) * 100) / 100
      : 0,
  }

  // Fuentes stats
  const [activas, conError] = await Promise.all([
    db.fuenteEstado.count({ where: { activo: true } }),
    db.fuenteEstado.count({ where: { activo: true, error: { not: '' } } }),
  ])

  const degradadas = await db.fuenteEstado.count({
    where: {
      activo: true,
      checksSinCambio: { gte: 5 },
    },
  })

  const fuentes: FuentesStats = {
    activas,
    conCambiosHoy: conCambios,
    degradadas,
    conError,
    topProductoras: topProductoras.slice(0, 5),
  }

  return { cola, worker: workerStats, checkFirst, fuentes }
}
