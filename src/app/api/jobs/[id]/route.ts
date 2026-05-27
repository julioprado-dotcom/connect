// GET /api/jobs/[id] - Single job detail
// PATCH /api/jobs/[id] - Pause/resume a job
// DELETE /api/jobs/[id] - Cancel or hard-delete a job

export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { getJob, cancel, pauseJob, resumeJob, deleteJob } from '@/lib/jobs/queue'
import { guardError } from '@/lib/rate-guard'
import { withAuth } from '@/lib/auth-helpers'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params

    const job = await getJob(id)
    if (!job) {
      return NextResponse.json({ error: 'Job no encontrado' }, { status: 404 })
    }

    return NextResponse.json({ job })
  } catch (error: unknown) {
    console.error('[API /jobs/[id] GET]', error)
    return NextResponse.json({ error: guardError(error, 'jobs/[id]') }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { accion } = body as { accion?: string }

    if (!accion || !['pausar', 'reanudar'].includes(accion)) {
      return NextResponse.json(
        { error: 'Accion invalida. Valores: "pausar", "reanudar"' },
        { status: 400 },
      )
    }

    if (accion === 'pausar') {
      const ok = await pauseJob(id)
      if (!ok) {
        return NextResponse.json(
          { error: 'No se pudo pausar. Solo jobs pendientes o en_progreso pueden pausarse.' },
          { status: 400 },
        )
      }
      return NextResponse.json({ exito: true, pausado: true })
    }

    // reanudar
    const ok = await resumeJob(id)
    if (!ok) {
      return NextResponse.json(
        { error: 'No se pudo reanudar. Solo jobs pausados pueden reanudarse.' },
        { status: 400 },
      )
    }
    return NextResponse.json({ exito: true, reanudado: true })
  } catch (error: unknown) {
    console.error('[API /jobs/[id] PATCH]', error)
    return NextResponse.json({ error: guardError(error, 'jobs/[id]') }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error: authError } = await withAuth()
  if (authError) return authError

  try {
    const { id } = await params

    // Soporte hard delete via query param ?hard=true
    const { searchParams } = new URL(request.url)
    const hard = searchParams.get('hard') === 'true'

    if (hard) {
      const ok = await deleteJob(id)
      if (!ok) {
        return NextResponse.json({ error: 'Job no encontrado' }, { status: 404 })
      }
      return NextResponse.json({ exito: true, eliminado: true })
    }

    // Comportamiento original: soft cancel
    const cancelado = await cancel(id)
    if (!cancelado) {
      return NextResponse.json({ error: 'No se pudo cancelar' }, { status: 400 })
    }

    return NextResponse.json({ exito: true, cancelado: true })
  } catch (error: unknown) {
    console.error('[API /jobs/[id] DELETE]', error)
    return NextResponse.json({ error: guardError(error, 'jobs/[id]') }, { status: 500 })
  }
}
