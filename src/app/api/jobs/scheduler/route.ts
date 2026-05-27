// GET /api/jobs/scheduler - Scheduler status
// POST /api/jobs/scheduler - Recalculate, pause, or resume scheduler

export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { rescheduleAll, startScheduler, stopScheduler, getSchedulerStatus } from '@/lib/jobs/scheduler'
import { getBackupSchedulerStatus } from '@/lib/jobs/backup-scheduler'
import { guardError } from '@/lib/rate-guard'
import { withAuth } from '@/lib/auth-helpers'

export async function GET() {
  try {
    const status = getSchedulerStatus()
    const backupStatus = getBackupSchedulerStatus()
    return NextResponse.json({
      ...status,
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
