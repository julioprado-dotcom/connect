export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { execSync } from 'child_process'
import fs from 'fs'
import os from 'os'
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

function getPm2SchedulerState(): 'online' | 'stopped' | 'errored' | 'none' {
  try {
    const output = execSync('pm2 jlist --no-color 2>/dev/null', {
      timeout: 5000, encoding: 'utf-8',
    })
    const list = JSON.parse(output) as Array<Record<string, unknown>>
    const scheduler = list.find(
      (p) => p.name === 'decodex-scheduler' || (p.pm2_env as Record<string, unknown>)?.name === 'decodex-scheduler'
    )
    if (!scheduler) return 'none'
    const status = ((scheduler.pm2_env as Record<string, unknown>)?.status as string)
      || (scheduler.status as string) || 'unknown'
    if (status === 'online') return 'online'
    if (status === 'stopped' || status === 'stopping') return 'stopped'
    if (status === 'errored') return 'errored'
    return 'stopped'
  } catch {
    return 'none'
  }
}

export async function GET() {
  try {
    const hb = readSchedulerHeartbeat()
    const pm2State = getPm2SchedulerState()
    const running = hb.online || pm2State === 'online'
    const totalTasks = (hb.data.totalTasks as number) ?? 0
    const totalScheduled = (hb.data.totalScheduled as number) ?? 0
    const backupStatus = getBackupSchedulerStatus()
    return NextResponse.json({
      running,
      totalTasks,
      totalScheduled,
      tasks: [],
      mode: 'pm2',
      pm2Status: pm2State !== 'none' ? pm2State : undefined,
      heartbeat: {
        uptime: hb.data.uptime,
        lastReschedule: hb.data.lastReschedule,
        pid: hb.data.pid,
      },
      backup: {
        ...backupStatus,
        politica: '4x/dia — NUNCA se borran — GitHub',
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

    if (accion === 'recalcular') {
      try {
        execSync('pm2 restart decodex-scheduler', { timeout: 15000 })
        return NextResponse.json({ exito: true, estado: 'running', modo: 'pm2', mensaje: 'Scheduler recalculado via PM2 restart' })
      } catch {
        return NextResponse.json({ exito: false, error: 'No se pudo reiniciar el scheduler via PM2' }, { status: 500 })
      }
    }

    if (accion === 'pause') {
      try {
        execSync('pm2 stop decodex-scheduler', { timeout: 10000 })
        return NextResponse.json({ exito: true, estado: 'paused', modo: 'pm2', mensaje: 'Scheduler pausado via PM2 stop' })
      } catch {
        return NextResponse.json({ exito: false, error: 'No se pudo pausar el scheduler via PM2' }, { status: 500 })
      }
    }

    // resume
    try {
      execSync('pm2 restart decodex-scheduler', { timeout: 15000 })
      return NextResponse.json({ exito: true, estado: 'running', modo: 'pm2', mensaje: 'Scheduler reanudado via PM2 restart' })
    } catch {
      return NextResponse.json({ exito: false, error: 'No se pudo reanudar el scheduler via PM2' }, { status: 500 })
    }
  } catch (error: unknown) {
    console.error('[API /jobs/scheduler POST]', error)
    return NextResponse.json({ error: guardError(error, 'jobs/scheduler') }, { status: 500 })
  }
}