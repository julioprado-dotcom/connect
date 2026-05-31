// GET /api/jobs/scheduler - Scheduler status
// POST /api/jobs/scheduler - Recalculate, pause, or resume scheduler
//
// FIX: En modo PM2 multi-proceso, el scheduler corre como proceso independiente
// (scheduler-service.ts) y NO escribe a globalThis. Por eso leemos el heartbeat
// file para determinar el estado real del scheduler PM2.
//
// FIX v2: heartbeat freshness != scheduler running. Cuando pm2 stop detiene
// el proceso, el heartbeat expira en 30s pero `pm2 describe` sigue mostrando
// el proceso (status: stopped). Antes el GET devolvía running=true siempre
// que isPm2Mode=true, haciendo imposible reactivar el scheduler.

export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { execSync } from 'child_process'
import fs from 'fs'
import os from 'os'
import { rescheduleAll, startScheduler, stopScheduler, getSchedulerStatus } from '@/lib/jobs/scheduler'
import { getBackupSchedulerStatus } from '@/lib/jobs/backup-scheduler'
import { guardError } from '@/lib/rate-guard'
import { withAuth } from '@/lib/auth-helpers'

const SCHEDULER_HB = os.tmpdir() + '/decodex-scheduler-heartbeat'

function readSchedulerHeartbeat(): { online: boolean; data: Record<string, unknown> } {
  try {
    const content = fs.readFileSync(SCHEDULER_HB, 'utf-8')
    const data = JSON.parse(content)
    const age = Date.now() - new Date(data.timestamp as string).getTime()
    return { online: age < 30000, data }
  } catch {
    return { online: false, data: {} }
  }
}

/**
 * Verifica si el scheduler corre como proceso PM2 y su estado real.
 * Returns: 'online' | 'stopped' | 'errored' | 'none' (no existe)
 */
function getPm2SchedulerState(): 'online' | 'stopped' | 'errored' | 'none' {
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
    if (status === 'stopped' || status === 'stopping') return 'stopped'
    if (status === 'errored' || status === 'stopping') return 'errored'
    return 'stopped' // default: si existe pero no online → stopped
  } catch {
    return 'none'
  }
}

export async function GET() {
  try {
    // Leer heartbeat del scheduler PM2 (proceso independiente)
    const hb = readSchedulerHeartbeat()

    // Verificar estado real del proceso PM2 (no solo heartbeat)
    const pm2State = getPm2SchedulerState()
    const isPm2Process = pm2State !== 'none' // El proceso existe en PM2

    // Leer estado in-process (para modo monolítico)
    let inProcess = { running: false, totalTasks: 0, tasks: [] as Array<{ humana?: string; expresion: string }> }
    try {
      inProcess = getSchedulerStatus()
    } catch { /* globalThis no disponible */ }

    // Determinar modo y estado
    // En PM2 mode: heartbeat freshness determina running, pm2State confirma
    // En modo monolítico: in-process.running
    const isPm2Mode = isPm2Process
    const running = isPm2Mode
      ? (hb.online || pm2State === 'online')  // heartbeat fresco O proceso PM2 online
      : inProcess.running

    const totalTasks = isPm2Mode
      ? (hb.data.totalTasks as number) ?? 0
      : inProcess.totalTasks
    const totalScheduled = isPm2Mode
      ? (hb.data.totalScheduled as number) ?? 0
      : 0

    // Tareas: en PM2 no tenemos detalle individual desde heartbeat
    const tasks = isPm2Mode
      ? []  // El scheduler-service.ts no expone tareas individuales via heartbeat
      : inProcess.tasks.map(t => ({
          name: t.humana || t.expresion,
          expression: t.expresion,
          nextRun: null as string | null,
          active: true,
        }))

    const backupStatus = getBackupSchedulerStatus()

    return NextResponse.json({
      running,
      totalTasks,
      totalScheduled,
      tasks,
      mode: isPm2Mode ? 'pm2' : 'in-process',
      pm2Status: isPm2Mode ? pm2State : undefined,  // 'online' | 'stopped' | 'errored' — útil para UI
      heartbeat: isPm2Mode ? {
        uptime: hb.data.uptime,
        lastReschedule: hb.data.lastReschedule,
        pid: hb.data.pid,
      } : undefined,
      backup: {
        ...backupStatus,
        politica: '4x/día — NUNCA se borran — GitHub',
      },
    })
  } catch (error: unknown) {
    console.error('[API /jobs/scheduler GET]', error)
    return NextResponse.json({ error: guardError(error, 'jobs/scheduler') }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { error: authError } = await withAuth()
  if (authError) return authError

  try {
    const body = await request.json()
    const { accion } = body as { accion?: string }

    if (!accion || !['recalcular', 'pause', 'resume'].includes(accion)) {
      return NextResponse.json(
        { error: 'Accion invalida. Valores: "recalcular", "pause", "resume"' },
        { status: 400 },
      )
    }

    // Detectar si estamos en modo PM2: verificar si el proceso EXISTE
    // (no depender del heartbeat que puede expirar tras un pause/restart)
    const pm2State = getPm2SchedulerState()
    const isPm2Mode = pm2State !== 'none'

    if (isPm2Mode) {
      // Modo PM2: usar pm2 CLI para controlar el proceso scheduler standalone
      if (accion === 'recalcular') {
        // Restart = equivale a recalcular (relee DB y reprograma tareas)
        try {
          execSync('pm2 restart decodex-scheduler', { timeout: 15000 })
          return NextResponse.json({
            exito: true,
            estado: 'running',
            modo: 'pm2',
            mensaje: 'Scheduler recalculado via PM2 restart',
          })
        } catch {
          return NextResponse.json({
            exito: false,
            error: 'No se pudo reiniciar el scheduler via PM2',
          }, { status: 500 })
        }
      }

      if (accion === 'pause') {
        try {
          execSync('pm2 stop decodex-scheduler', { timeout: 10000 })
          return NextResponse.json({
            exito: true,
            estado: 'paused',
            modo: 'pm2',
            mensaje: 'Scheduler pausado via PM2 stop',
          })
        } catch {
          return NextResponse.json({
            exito: false,
            error: 'No se pudo pausar el scheduler via PM2',
          }, { status: 500 })
        }
      }

      // resume — usar restart (es más confiable que start --only)
      try {
        execSync('pm2 restart decodex-scheduler', { timeout: 15000 })
        return NextResponse.json({
          exito: true,
          estado: 'running',
          modo: 'pm2',
          mensaje: 'Scheduler reanudado via PM2 restart',
        })
      } catch {
        return NextResponse.json({
          exito: false,
          error: 'No se pudo reanudar el scheduler via PM2',
        }, { status: 500 })
      }
    }

    // Modo in-process: usar funciones directas del scheduler
    if (accion === 'pause') {
      stopScheduler()
      return NextResponse.json({ exito: true, estado: 'paused', mensaje: 'Scheduler pausado' })
    }

    if (accion === 'resume') {
      await startScheduler()
      return NextResponse.json({ exito: true, estado: 'running', mensaje: 'Scheduler reanudado' })
    }

    // recalcular
    await rescheduleAll()

    return NextResponse.json({
      exito: true,
      mensaje: 'Scheduler recalculado',
    })
  } catch (error: unknown) {
    console.error('[API /jobs/scheduler POST]', error)
    return NextResponse.json({ error: guardError(error, 'jobs/scheduler') }, { status: 500 })
  }
}
