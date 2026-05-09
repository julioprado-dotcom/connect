// GET /api/jobs - List jobs with filters
// POST /api/jobs - Manually enqueue a job

import { NextRequest, NextResponse } from 'next/server'
import { enqueue, getJobs, countByEstado } from '@/lib/jobs/queue'
import type { JobTipo, JobPrioridad, JobEstado } from '@/lib/jobs/types'
import { safeError } from '@/lib/rate-guard'

const VALID_TIPOS: JobTipo[] = [
  'check_fuente',
  'check_indicador',
  'scrape_fuente',
  'capture_indicador',
  'generar_boletin',
  'enviar_entrega',
  'verificar_enlaces',
  'mantenimiento',
]

const VALID_PRIORIDADES: JobPrioridad[] = [0, 1, 3, 5, 7, 9]

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const estado = searchParams.get('estado') as JobEstado | null
    const tipo = searchParams.get('tipo') || undefined
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10), 1), 200)
    const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10), 0)

    const [result, porEstado] = await Promise.all([
      getJobs({ estado: estado || undefined, tipo, limit, offset }),
      countByEstado(),
    ])

    return NextResponse.json({
      jobs: result.jobs,
      total: result.total,
      porEstado,
    })
  } catch (error: unknown) {
    console.error('[API /jobs GET]', error)
    return NextResponse.json({ error: safeError(error, 'jobs') }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { tipo, prioridad, payload } = body as {
      tipo?: string
      prioridad?: JobPrioridad
      payload?: Record<string, unknown>
    }

    if (!tipo) {
      return NextResponse.json({ error: 'El campo "tipo" es obligatorio' }, { status: 400 })
    }

    if (!VALID_TIPOS.includes(tipo as JobTipo)) {
      return NextResponse.json(
        { error: `Tipo invalido. Valores permitidos: ${VALID_TIPOS.join(', ')}` },
        { status: 400 },
      )
    }

    if (prioridad !== undefined && !VALID_PRIORIDADES.includes(prioridad)) {
      return NextResponse.json(
        { error: 'Prioridad invalida. Valores permitidos: 0, 1, 3, 5, 7, 9' },
        { status: 400 },
      )
    }

    const jobId = await enqueue({
      tipo: tipo as JobTipo,
      prioridad,
      payload,
    })

    return NextResponse.json({ exito: true, jobId }, { status: 201 })
  } catch (error: unknown) {
    console.error('[API /jobs POST]', error)
    return NextResponse.json({ error: safeError(error, 'jobs') }, { status: 500 })
  }
}
