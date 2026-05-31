import { NextResponse } from 'next/server'
import db from '@/lib/db'
import { getErroresActivos, getErrorSummary, resolverErrores } from '@/lib/jobs/fuente-error-logger'

// GET /api/fuentes/errores?fuenteId=xxx&limit=50
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const fuenteId = searchParams.get('fuenteId')
    const limit = parseInt(searchParams.get('limit') || '50')
    
    if (fuenteId) {
      const horas = parseInt(searchParams.get('horas') || '24')
      const summary = await getErrorSummary(fuenteId, horas)
      return NextResponse.json(summary)
    }
    
    const errores = await getErroresActivos(limit)
    return NextResponse.json({ errores, total: errores.length })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// POST /api/fuentes/errores/resolve — Mark errors as resolved
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { fuenteId } = body
    
    if (!fuenteId) {
      return NextResponse.json({ error: 'fuenteId requerido' }, { status: 400 })
    }
    
    const count = await resolverErrores(fuenteId)
    return NextResponse.json({ resueltos: count })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
