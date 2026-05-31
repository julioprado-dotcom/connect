/**
 * /api/jobs/stats — Full statistics dashboard data
 *
 * FIX: En modo PM2 multi-proceso, worker y scheduler corren como procesos
 * independientes. globalThis NO comparte estado entre procesos.
 * Solution: Leer heartbeat files como fuente primaria para worker/scheduler,
 * y solo usar getFullStats() para cola/checkFirst/fuentes (datos de DB).
 *
 * BLINDAJE: NUNCA devuelve HTTP 500. Si falla alguna consulta,
 * devuelve datos degradados con status 200.
 */

export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import fs from 'fs'
import os from 'os'

// ─── Heartbeat readers (PM2 multi-process mode) ───────────────────
const WORKER_HB = os.tmpdir() + '/decodex-worker-heartbeat'
const SCHEDULER_HB = os.tmpdir() + '/decodex-scheduler-heartbeat'

function readHeartbeat(filePath: string): { online: boolean; age: number; data: Record<string, unknown> } {
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    const data = JSON.parse(content)
    const age = Date.now() - new Date(data.timestamp as string).getTime()
    return { online: age < 30000, age, data }
  } catch {
    return { online: false, age: Infinity, data: {} }
  }
}

function workerFromHeartbeat(hb: { online: boolean; data: Record<string, unknown> }) {
  const uptime = (hb.data.uptime as number) ?? 0
  const hours = Math.floor(uptime / 3600)
  const minutes = Math.floor((uptime % 3600) / 60)
  const seconds = uptime % 60
  const totalJobs = ((hb.data.jobsCompleted as number) ?? 0) + ((hb.data.jobsFailed as number) ?? 0)
  const jobsPerHour = uptime > 0
    ? Math.round((totalJobs / uptime) * 3600)
    : 0

  return {
    running: hb.online,
    mode: 'active' as const,
    uptime: uptime > 0 ? `${hours}h ${minutes}m ${seconds}s` : '0s',
    jobsCompleted: (hb.data.jobsCompleted as number) ?? 0,
    jobsFailed: (hb.data.jobsFailed as number) ?? 0,
    jobsPerHour,
    lastJobTime: (hb.data.lastJobTime as string) ?? null,
  }
}

function schedulerFromHeartbeat(hb: { online: boolean; data: Record<string, unknown> }) {
  return {
    running: hb.online,
    totalTasks: (hb.data.totalTasks as number) ?? 0,
  }
}

export async function GET() {
  try {
    // Leer heartbeats de worker y scheduler (PM2 standalone mode)
    const workerHB = readHeartbeat(WORKER_HB)
    const schedulerHB = readHeartbeat(SCHEDULER_HB)

    // Stats de cola desde DB (siempre disponible, no depende de procesos)
    let fullStats = {
      cola: { pendientes: 0, enProgreso: 0, fallidos24h: 0, completados24h: 0, tiempoPromedioMs: 0 },
      worker: { running: false, uptime: '0s', jobsCompleted: 0, jobsFailed: 0, jobsPerHour: 0, lastJobTime: null as string | null },
      checkFirst: { sinCambios24h: 0, conCambios24h: 0, tasaAhorro: 0 },
      fuentes: { activas: 0, conCambiosHoy: 0, degradadas: 0, conError: 0, topProductoras: [] as Array<{ medio: string; cambios: number }> },
    }
    let scheduler = { running: false, totalTasks: 0 }

    try {
      const { getFullStats } = await import('@/lib/jobs/health')
      fullStats = await getFullStats()
    } catch (error) {
      console.error('[API /jobs/stats] getFullStats failed (returning degraded):', error)
    }

    // Worker: heartbeat tiene prioridad sobre globalThis (PM2 mode)
    if (workerHB.online) {
      fullStats.worker = workerFromHeartbeat(workerHB)
    } else {
      // Fallback: intentar globalThis (modo monolítico)
      try {
        const { getWorkerStats } = await import('@/lib/jobs/worker')
        const inProcess = getWorkerStats()
        if (inProcess.running) {
          fullStats.worker = inProcess
        }
      } catch { /* globalThis no disponible */ }
    }

    // Scheduler: heartbeat tiene prioridad sobre globalThis (PM2 mode)
    if (schedulerHB.online) {
      scheduler = schedulerFromHeartbeat(schedulerHB)
    } else {
      // Fallback: intentar globalThis (modo monolítico)
      try {
        const { getSchedulerStatus } = await import('@/lib/jobs/scheduler')
        const inProcess = getSchedulerStatus()
        if (inProcess.running) {
          scheduler = { running: true, totalTasks: inProcess.totalTasks }
        }
      } catch { /* globalThis no disponible */ }
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
