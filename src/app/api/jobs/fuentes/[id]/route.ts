// GET /api/jobs/fuentes/[id] - Single source state detail
// PUT /api/jobs/fuentes/[id] - Update frequency override
// PATCH /api/jobs/fuentes/[id] - Batch corrective actions (reset frecuencia, checksSinCambio, etc.)

import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { safeError } from '@/lib/safe-error'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params

    const fuente = await db.fuenteEstado.findUnique({
      where: { id },
      include: { medio: true },
    })

    if (!fuente) {
      return NextResponse.json({ error: 'Fuente no encontrada' }, { status: 404 })
    }

    return NextResponse.json({ fuente })
  } catch (error: unknown) {
    console.error('[API /jobs/fuentes/[id] GET]', error)
    return NextResponse.json({ error: safeError(error) }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { frecuenciaOverride, activo } = body as {
      frecuenciaOverride?: string
      activo?: boolean
    }

    // Build update data with only provided fields
    const data: Record<string, unknown> = {}
    if (frecuenciaOverride !== undefined) data.frecuenciaOverride = frecuenciaOverride
    if (activo !== undefined) data.activo = activo

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: 'No se proporcionaron campos para actualizar' },
        { status: 400 },
      )
    }

    const fuente = await db.fuenteEstado.update({
      where: { id },
      data,
      include: { medio: true },
    })

    return NextResponse.json({ exito: true, fuente })
  } catch (error: unknown) {
    console.error('[API /jobs/fuentes/[id] PUT]', error)
    return NextResponse.json({ error: safeError(error) }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const body = await request.json()
    const {
      frecuenciaActual,
      checksSinCambio,
      activo,
      error: errorField,
      tipoCheck,
    } = body as {
      frecuenciaActual?: string
      checksSinCambio?: number
      activo?: boolean
      error?: string
      tipoCheck?: string
    }

    // Build update data with only provided fields
    const data: Record<string, unknown> = {}
    if (frecuenciaActual !== undefined) data.frecuenciaActual = frecuenciaActual
    if (checksSinCambio !== undefined) data.checksSinCambio = checksSinCambio
    if (activo !== undefined) data.activo = activo
    if (errorField !== undefined) data.error = errorField
    if (tipoCheck !== undefined) data.tipoCheck = tipoCheck

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: 'No se proporcionaron campos para actualizar' },
        { status: 400 },
      )
    }

    const fuente = await db.fuenteEstado.update({
      where: { id },
      data,
      include: { medio: true },
    })

    return NextResponse.json({ exito: true, fuente })
  } catch (error: unknown) {
    console.error('[API /jobs/fuentes/[id] PATCH]', error)
    return NextResponse.json({ error: safeError(error) }, { status: 500 })
  }
}
