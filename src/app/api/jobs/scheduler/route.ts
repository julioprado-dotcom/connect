// GET /api/jobs/scheduler - Scheduler status
// POST /api/jobs/scheduler - Recalculate, pause, or resume scheduler

import { NextRequest, NextResponse } from 'next/server'
import { rescheduleAll, startScheduler, stopScheduler, getSchedulerStatus } from '@/lib/jobs/scheduler'
import { safeError } from '@/lib/rate-guard'

export async function GET() {
  try {
    const status = getSchedulerStatus()
    return NextResponse.json(status)
  } catch (error: unknown) {
    console.error('[API /jobs/scheduler GET]', error)
    return NextResponse.json({ error: safeError(error, 'jobs/scheduler') }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
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
    return NextResponse.json({ error: safeError(error, 'jobs/scheduler') }, { status: 500 })
  }
}
