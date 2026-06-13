// scheduler-pm2.ts — Reemplazo ligero del scheduler monolítico eliminado.
// En modo PM2, el scheduler corre como proceso independiente (scheduler-service.ts).
// Estas funciones son compatibles con la firma del viejo scheduler pero delegan a PM2.

import { execSync } from 'child_process'
import fs from 'fs'
import os from 'os'

const SCHEDULER_HB = os.tmpdir() + '/decodex-scheduler-heartbeat'

export function getSchedulerStatus(): { running: boolean; totalTasks: number; tasks: never[] } {
  try {
    const output = execSync('pm2 jlist --no-color 2>/dev/null', {
      timeout: 5000, encoding: 'utf-8',
    })
    const list = JSON.parse(output) as Array<Record<string, unknown>>
    const proc = list.find(
      (p) => p.name === 'decodex-scheduler' || (p.pm2_env as Record<string, unknown>)?.name === 'decodex-scheduler'
    )
    if (!proc) return { running: false, totalTasks: 0, tasks: [] }

    const status = ((proc.pm2_env as Record<string, unknown>)?.status as string)
      || (proc.status as string) || 'unknown'

    let hbData: Record<string, unknown> = {}
    try {
      hbData = JSON.parse(fs.readFileSync(SCHEDULER_HB, 'utf-8'))
    } catch { /* sin heartbeat */ }

    return {
      running: status === 'online',
      totalTasks: (hbData.totalTasks as number) ?? 0,
      tasks: [],
    }
  } catch {
    return { running: false, totalTasks: 0, tasks: [] }
  }
}

/** En modo PM2, recalcular = restart del proceso scheduler (relee DB). */
export async function rescheduleAll(): Promise<void> {
  execSync('pm2 restart decodex-scheduler', { timeout: 15000 })
}

/** En modo PM2 el scheduler es manejado por PM2, no por el worker. No-op. */
export async function startScheduler(): Promise<void> {
  console.log('[scheduler-pm2] startScheduler: no-op en modo PM2 (gestionado por PM2)')
}

/** En modo PM2 el scheduler es manejado por PM2, no por el worker. No-op. */
export function stopScheduler(): void {
  console.log('[scheduler-pm2] stopScheduler: no-op en modo PM2 (gestionado por PM2)')
}