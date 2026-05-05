// POST /api/jobs/worker - Pause or resume the worker

import { NextRequest, NextResponse } from 'next/server'
import { startWorker, stopWorker, getWorkerStats } from '@/lib/jobs/worker'
import { safeError } from '@/lib/rate-guard'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { accion } = body as { accion?: string }

    if (!accion || (accion !== 'pause' && accion !== 'resume')) {
      return NextResponse.json(
        { error: 'El campo "accion" es obligatorio y debe ser "pause" o "resume"' },
        { status: 400 },
      )
    }

    if (accion === 'pause') {
      stopWorker()
      return NextResponse.json({ exito: true, estado: 'paused' })
    }

    // accion === 'resume'
    startWorker()
    return NextResponse.json({ exito: true, estado: 'running' })
  } catch (error: unknown) {
    console.error('[API /jobs/worker POST]', error)
    return NextResponse.json({ error: safeError(error, 'jobs/worker') }, { status: 500 })
  }
}
