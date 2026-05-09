// Core de la cola de trabajos - DECODEX Bolivia
// enqueue, dequeue, complete, fail, cancel, stats

import db from '@/lib/db'
import type { JobCreate, JobEstado } from './types'
import { RETRY_CONFIG, QUEUE_LIMITS } from './constants'

// Encolar un nuevo job
export async function enqueue(params: JobCreate): Promise<string> {
  const job = await db.job.create({
    data: {
      tipo: params.tipo,
      prioridad: params.prioridad ?? 5,
      payload: JSON.stringify(params.payload ?? {}),
      maxIntentos: params.maxIntentos ?? RETRY_CONFIG.maxIntentos,
      proximaEjecucion: params.proximaEjecucion ?? new Date(),
      programa: params.programa ?? '',
      estado: 'pendiente',
    },
  })
  return job.id
}

// Encolar multiples jobs de una vez
export async function enqueueMany(jobs: JobCreate[]): Promise<string[]> {
  const results = await db.job.createMany({
    data: jobs.map(j => ({
      tipo: j.tipo,
      prioridad: j.prioridad ?? 5,
      payload: JSON.stringify(j.payload ?? {}),
      maxIntentos: j.maxIntentos ?? RETRY_CONFIG.maxIntentos,
      proximaEjecucion: j.proximaEjecucion ?? new Date(),
      programa: j.programa ?? '',
      estado: 'pendiente',
    })),
  })
  // createMany no devuelve IDs, consultar los ultimos
  const count = results.count
  const lastJobs = await db.job.findMany({
    where: { estado: 'pendiente' },
    orderBy: { fechaCreacion: 'desc' },
    take: count,
  })
  return lastJobs.map(j => j.id).reverse()
}

// Tomar el siguiente job pendiente (por prioridad)
export async function dequeue(): Promise<Record<string, unknown> | null> {
  // Verificar limite de jobs pendientes
  const pendingCount = await db.job.count({
    where: { estado: 'pendiente' },
  })

  if (pendingCount >= QUEUE_LIMITS.maxPendingJobs) {
    console.warn(`[Queue] Limite alcanzado: ${pendingCount} jobs pendientes`)
    return null
  }

  const job = await db.job.findFirst({
    where: {
      estado: 'pendiente',
      proximaEjecucion: { lte: new Date() },
    },
    orderBy: [
      { prioridad: 'asc' },
      { fechaCreacion: 'asc' },
    ],
  })

  if (!job) return null

  // Marcar como en_progreso
  const updated = await db.job.update({
    where: { id: job.id },
    data: {
      estado: 'en_progreso',
      fechaInicio: new Date(),
      intentos: { increment: 1 },
    },
  })

  return {
    ...updated,
    payload: JSON.parse(updated.payload || '{}'),
  }
}

// Marcar job como completado
export async function complete(jobId: string, resultado: Record<string, unknown>): Promise<void> {
  await db.job.update({
    where: { id: jobId },
    data: {
      estado: 'completado',
      fechaFin: new Date(),
      resultado: JSON.stringify(resultado),
    },
  })
}

// Marcar job como fallido (con reintentos o cancelacion)
export async function fail(jobId: string, errorMessage: string): Promise<void> {
  const job = await db.job.findUniqueOrThrow({ where: { id: jobId } })

  if (job.intentos >= job.maxIntentos) {
    // Agotados los reintentos
    await db.job.update({
      where: { id: jobId },
      data: {
        estado: 'fallido',
        fechaFin: new Date(),
        error: errorMessage,
      },
    })
    return
  }

  // Programar reintento con backoff exponencial
  const delay = Math.min(
    RETRY_CONFIG.baseDelayMs * Math.pow(RETRY_CONFIG.multiplier, job.intentos - 1),
    RETRY_CONFIG.maxDelayMs,
  )
  const proxima = new Date(Date.now() + delay)

  await db.job.update({
    where: { id: jobId },
    data: {
      estado: 'pendiente',
      error: errorMessage,
      proximaEjecucion: proxima,
    },
  })
}

// Cancelar un job pendiente o en_progreso
export async function cancel(jobId: string): Promise<boolean> {
  try {
    await db.job.update({
      where: { id: jobId },
      data: {
        estado: 'cancelado',
        fechaFin: new Date(),
      },
    })
    return true
  } catch {
    return false
  }
}

// Obtener conteo de jobs por estado
export async function countByEstado(): Promise<Record<string, number>> {
  const jobs = await db.job.groupBy({
    by: ['estado'],
    _count: true,
  })
  const result: Record<string, number> = {
    pendiente: 0,
    en_progreso: 0,
    completado: 0,
    fallido: 0,
    cancelado: 0,
  }
  for (const j of jobs) {
    result[j.estado] = j._count
  }
  return result
}

// Obtener jobs con filtros
export async function getJobs(params: {
  estado?: JobEstado
  tipo?: string
  limit?: number
  offset?: number
}): Promise<{ jobs: Record<string, unknown>[]; total: number }> {
  const where: Record<string, unknown> = {}
  if (params.estado) where.estado = params.estado
  if (params.tipo) where.tipo = params.tipo

  const total = await db.job.count({ where })

  const jobs = await db.job.findMany({
    where,
    orderBy: { fechaCreacion: 'desc' },
    take: params.limit ?? 50,
    skip: params.offset ?? 0,
  })

  return {
    jobs: jobs.map(j => ({
      ...j,
      payload: JSON.parse(j.payload || '{}'),
      resultado: j.resultado ? JSON.parse(j.resultado) : null,
    })),
    total,
  }
}

// Obtener un job por ID
export async function getJob(jobId: string): Promise<Record<string, unknown> | null> {
  const job = await db.job.findUnique({ where: { id: jobId } })
  if (!job) return null
  return {
    ...job,
    payload: JSON.parse(job.payload || '{}'),
    resultado: job.resultado ? JSON.parse(job.resultado) : null,
  }
}

// Limpiar jobs completados antiguos
export async function purgeCompleted(days: number = QUEUE_LIMITS.jobRetentionDays): Promise<number> {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)

  const result = await db.job.deleteMany({
    where: {
      estado: 'completado',
      fechaFin: { lt: cutoff },
    },
  })
  return result.count
}

// Limpiar jobs fallidos antiguos
export async function purgeFailed(days: number = 7): Promise<number> {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)

  const result = await db.job.deleteMany({
    where: {
      estado: 'fallido',
      fechaFin: { lt: cutoff },
    },
  })
  return result.count
}

// Recuperar jobs huerfanos atascados en en_progreso
// Un job es huerfano si lleva > timeoutMs en en_progreso sin completar.
// Se resetea a pendiente para que el worker lo reintente.
export async function reclaimOrphanJobs(timeoutMs: number = 10 * 60 * 1000): Promise<number> {
  const cutoff = new Date(Date.now() - timeoutMs)

  // Buscar jobs en_progreso cuyo fechaInicio es anterior al cutoff
  const huerfanos = await db.job.findMany({
    where: {
      estado: 'en_progreso',
      fechaInicio: { lt: cutoff },
    },
    select: { id: true, tipo: true, fechaInicio: true },
  })

  if (huerfanos.length === 0) return 0

  // Resetear a pendiente (no incrementar intentos — no falló, se perdió el worker)
  const ids = huerfanos.map(j => j.id)
  const result = await db.job.updateMany({
    where: { id: { in: ids } },
    data: {
      estado: 'pendiente',
      fechaInicio: null,
      proximaEjecucion: new Date(), // re-encolar inmediatamente
    },
  })

  if (result.count > 0) {
    console.log(
      `[Queue] Reclaim: ${result.count} jobs huerfanos recuperados ` +
      `(timeout: ${Math.round(timeoutMs / 60000)}min)`
    )
    for (const j of huerfanos.slice(0, 10)) {
      console.log(`  - job ${j.id} (${j.tipo}) desde ${j.fechaInicio?.toISOString() ?? '?'}`)
    }
    if (huerfanos.length > 10) {
      console.log(`  ... y ${huerfanos.length - 10} mas`)
    }
  }

  return result.count
}
