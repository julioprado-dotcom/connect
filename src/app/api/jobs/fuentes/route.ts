// GET /api/jobs/fuentes - List all source states (FuenteEstado)

import { NextResponse } from 'next/server'
import db from '@/lib/db'
import { safeError } from '@/lib/safe-error'

export async function GET() {
  try {
    const fuentes = await db.fuenteEstado.findMany({
      include: {
        medio: {
          select: {
            id: true,
            nombre: true,
            url: true,
          },
        },
      },
      orderBy: { ultimoCheck: 'desc' },
    })

    return NextResponse.json(fuentes)
  } catch (error: unknown) {
    const { error: msg, code, details } = safeError(error)
    console.error('[API /jobs/fuentes GET]', details ?? msg)
    // Return empty array with 200 on DB failure
    return NextResponse.json([])
  }
}
