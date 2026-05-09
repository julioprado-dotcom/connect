// POST /api/jobs/scheduler - Recalculate schedules

import { NextRequest, NextResponse } from 'next/server'
import { rescheduleAll } from '@/lib/jobs/scheduler'
import { safeError } from '@/lib/rate-guard'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { accion } = body as { accion?: string }

    if (!accion || accion !== 'recalcular') {
      return NextResponse.json(
        { error: 'El campo "accion" es obligatorio y debe ser "recalcular"' },
        { status: 400 },
      )
    }

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
