/**
 * scheduler-bridge.ts — Puente de comunicación con el Scheduler PM2
 *
 * REEMPLAZA al viejo src/lib/jobs/scheduler.ts (modo monolítico/in-process).
 * En la arquitectura PM2 multi-proceso, el scheduler corre como proceso
 * independiente (scheduler-service.ts) y NO comparte memoria con el web.
 *
 * Este módulo proporciona la misma API que el scheduler viejo pero
 * se comunica con el proceso PM2 real vía:
 *   - Heartbeat file (lectura de estado)
 *   - PM2 CLI (control: start/stop/restart)
 *
 * Todas las operaciones de control usan execSync con timeout corto
 * para no bloquear el proceso web.
 */

import fs from 'fs'
import os from 'os'
import { execSync } from 'child_process'

const HEARTBEAT_PATH = os.tmpdir() + '/decodex-scheduler-heartbeat'

// ── Tipos compatibles con la API vieja ──────────────────────────

interface SchedulerStatus {
  running: boolean
  totalTasks: number
  tasks: Array<{ expresion: string; humana: string }>
}

// ── Leer heartbeat del scheduler PM2 ────────────────────────────

function readHeartbeat(): { online: boolean; data: Record<string, unknown> } {
  try {
    const content = fs.readFileSync(HEARTBEAT_PATH, 'utf-8')
    const data = JSON.parse(content)
    const age = Date.now() - new Date(data.timestamp as string).getTime()
    return { online: age < 30000, data }
  } catch {
    return { online: false, data: {} }
  }
}

// ── Verificar estado PM2 del scheduler ──────────────────────────

function getPm2State(): 'online' | 'stopped' | 'errored' | 'none' {
  try {
    const output = execSync('pm2 jlist --no-color 2>/dev/null', {
      timeout: 5000,
      encoding: 'utf-8',
    })
    const list = JSON.parse(output) as Array<Record<string, unknown>>
    const scheduler = list.find(
      (p) => p.name === 'decodex-scheduler' || (p.pm2_env as Record<string, unknown>)?.name === 'decodex-scheduler'
    )
    if (!scheduler) return 'none'

    const status = (scheduler.pm2_env as Record<string, unknown>)?.status as string
      || scheduler.status as string
      || 'unknown'

    if (status === 'online') return 'online'
    if (status === 'errored') return 'errored'
    return 'stopped'
  } catch {
    return 'none'
  }
}

// ── API pública (compatible con el scheduler viejo) ─────────────

/**
 * Obtener estado del scheduler.
 * En modo PM2: lee heartbeat + pm2 jlist.
 * Retorna interfaz compatible con getSchedulerStatus() del scheduler viejo.
 */
export function getSchedulerStatus(): SchedulerStatus {
  const hb = readHeartbeat()
  const pm2State = getPm2State()

  // El scheduler está "running" si el heartbeat es fresco O el proceso PM2 está online
  const running = hb.online || pm2State === 'online'

  return {
    running,
    totalTasks: (hb.data.totalTasks as number) ?? 0,
    tasks: [], // El scheduler PM2 no expone tareas individuales via heartbeat
  }
}

/**
 * Iniciar el scheduler.
 * En modo PM2: ejecuta `pm2 restart decodex-scheduler`.
 */
export async function startScheduler(): Promise<void> {
  try {
    execSync('pm2 restart decodex-scheduler', { timeout: 15000 })
    console.log('[Scheduler-Bridge] Scheduler iniciado via PM2 restart')
  } catch (err) {
    console.error('[Scheduler-Bridge] Error iniciando scheduler:', err)
    throw new Error('No se pudo iniciar el scheduler via PM2')
  }
}

/**
 * Detener el scheduler.
 * En modo PM2: ejecuta `pm2 stop decodex-scheduler`.
 */
export function stopScheduler(): void {
  try {
    execSync('pm2 stop decodex-scheduler', { timeout: 10000 })
    console.log('[Scheduler-Bridge] Scheduler detenido via PM2 stop')
  } catch (err) {
    console.error('[Scheduler-Bridge] Error deteniendo scheduler:', err)
  }
}

/**
 * Reprogramar todas las fuentes.
 * En modo PM2: equivale a un restart (el scheduler relee la DB al arrancar).
 */
export async function rescheduleAll(): Promise<void> {
  try {
    execSync('pm2 restart decodex-scheduler', { timeout: 15000 })
    console.log('[Scheduler-Bridge] Scheduler rescheduleado via PM2 restart')
  } catch (err) {
    console.error('[Scheduler-Bridge] Error rescheduleando scheduler:', err)
    throw new Error('No se pudo reschedulear el scheduler via PM2')
  }
}