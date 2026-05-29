// GET /api/jobs/scheduler - Scheduler status
// POST /api/jobs/scheduler - Recalculate, pause, or resume scheduler
//
// FIX: En modo PM2 multi-proceso, el scheduler corre como proceso independiente
// (scheduler-service.ts) y NO escribe a globalThis. Por eso leemos el heartbeat
// file para determinar el estado real del scheduler PM2.

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

export async function GET() {
  try {
    // Leer heartbeat del scheduler PM2 (proceso independiente)
    const hb = readSchedulerHeartbeat()

    // Leer estado in-process (para modo monolítico)
    const inProcess = getSchedulerStatus()

    // En modo PM2: heartbeat tiene prioridad
    // En modo monolítico: in-process tiene prioridad
    const isPm2Mode = hb.online

    const running = isPm2Mode ? true : inProcess.running
    const totalTasks = isPm2Mode
      ? (hb.data.totalTasks as number) ?? 0
      : inProcess.totalTasks
    const totalScheduled = isPm2Mode
      ? (hb.data.totalScheduled as number) ?? 0
      : 0

    // Tareas: en PM2 no tenemos detalle individual desde heartbeat
    // Mostramos resumen en vez de array vacío
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

    // Detectar si estamos en modo PM2 (scheduler standalone)
    const hb = readSchedulerHeartbeat()
    const isPm2Mode = hb.online

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

      // resume
      try {
        execSync('pm2 start ecosystem.config.js --only decodex-scheduler', { timeout: 15000 })
        return NextResponse.json({
          exito: true,
          estado: 'running',
          modo: 'pm2',
          mensaje: 'Scheduler reanudado via PM2 start',
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
