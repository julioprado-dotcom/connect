// GET /api/jobs/[id] - Single job detail
// DELETE /api/jobs/[id] - Cancel a job

import { NextRequest, NextResponse } from 'next/server'
import { getJob, cancel } from '@/lib/jobs/queue'
import { safeError } from '@/lib/rate-guard'

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
    return NextResponse.json({ error: safeError(error, 'jobs/[id]') }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params

    const cancelado = await cancel(id)
    if (!cancelado) {
      return NextResponse.json({ error: 'No se pudo cancelar' }, { status: 400 })
    }

    return NextResponse.json({ exito: true, cancelado: true })
  } catch (error: unknown) {
    console.error('[API /jobs/[id] DELETE]', error)
    return NextResponse.json({ error: safeError(error, 'jobs/[id]') }, { status: 500 })
  }
}
