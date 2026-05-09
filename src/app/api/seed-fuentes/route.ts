// POST /api/seed-fuentes — Crear FuenteEstado para medios que no tienen
// GET  /api/seed-fuentes — Estado actual de fuentes
// Fase test: solo activa nivel 1 con URL valida

import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { safeError } from '@/lib/rate-guard'

// Frecuencia base por nivel (del motor de captura)
const FRECUENCIA_POR_NIVEL: Record<string, string> = {
  '1': '1h',   // Top: 4 checks/dia
  '2': '4h',   // Regionales: 2 checks/dia
  '3': '6h',   // Alternativos: 2 checks/dia
}

// Tipo de check por categoria de medio
function tipoCheckParaCategoria(tipo: string): string {
  if (tipo.includes('TV') || tipo.includes('Radio')) return 'rss'
  if (tipo === 'Agencia' || tipo === 'Agencia estatal') return 'rss'
  if (tipo === 'Fact-checking' || tipo === 'Portal') return 'head'
  return 'head'
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const nivelMinimo = body.nivel_minimo ?? '1'
    const forzar = body.forzar === true

    // 1. Obtener medios que cumplen criterio
    const medios = await db.medio.findMany({
      where: {
        activo: true,
        nivel: { lte: nivelMinimo },
      },
      orderBy: [{ nivel: 'asc' }, { nombre: 'asc' }],
    })

    if (medios.length === 0) {
      return NextResponse.json({
        mensaje: 'No hay medios para crear fuentes',
        creados: 0,
        saltados: 0,
      })
    }

    // 2. Obtener FuenteEstado existentes
    const existentes = await db.fuenteEstado.findMany({
      select: { medioId: true },
    })
    const existentesSet = new Set(existentes.map((e) => e.medioId))

    // 3. Crear FuenteEstado para medios que no tienen
    let creados = 0
    let saltados = 0
    const detalles: Array<{ medio: string; estado: string; razon?: string }> = []

    for (const medio of medios) {
      // Ya existe
      if (existentesSet.has(medio.id) && !forzar) {
        saltados++
        detalles.push({ medio: medio.nombre, estado: 'saltado', razon: 'ya existe' })
        continue
      }

      // Sin URL — no se puede monitorear
      if (!medio.url) {
        saltados++
        detalles.push({ medio: medio.nombre, estado: 'saltado', razon: 'sin URL' })
        continue
      }

      const frecuenciaBase = FRECUENCIA_POR_NIVEL[medio.nivel] || '6h'
      const tipoCheck = tipoCheckParaCategoria(medio.tipo)

      try {
        // upsert: crear o actualizar si existe y forzar=true
        await db.fuenteEstado.upsert({
          where: { medioId: medio.id },
          create: {
            medioId: medio.id,
            url: medio.url,
            tipoCheck,
            frecuenciaBase,
            frecuenciaActual: frecuenciaBase,
            activo: medio.nivel === '1', // Fase test: solo nivel 1 activo
          },
          update: forzar ? {
            url: medio.url,
            tipoCheck,
            frecuenciaBase,
            frecuenciaActual: frecuenciaBase,
            activo: medio.nivel === '1',
          } : {},
        })
        creados++
        detalles.push({
          medio: medio.nombre,
          estado: 'creado',
          razon: `nivel ${medio.nivel}, freq ${frecuenciaBase}, check ${tipoCheck}, activo ${medio.nivel === '1'}`,
        })
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error)
        saltados++
        detalles.push({ medio: medio.nombre, estado: 'error', razon: msg })
      }
    }

    return NextResponse.json({
      mensaje: `Fuentes creadas: ${creados}, saltadas: ${saltados}`,
      creados,
      saltados,
      totalMedios: medios.length,
      fase_test: true,
      solo_activas_nivel_1: true,
      detalles,
    })
  } catch (error: unknown) {
    return NextResponse.json({ error: safeError(error, 'seed-fuentes') }, { status: 500 })
  }
}

export async function GET() {
  try {
    const [totalFuentes, activas, totalMedios] = await Promise.all([
      db.fuenteEstado.count(),
      db.fuenteEstado.count({ where: { activo: true } }),
      db.medio.count(),
    ])

    // Fuentes sin FuenteEstado (medios huerfanos)
    const fuentesConEstado = await db.fuenteEstado.findMany({
      select: { medioId: true },
    })
    const conEstadoSet = new Set(fuentesConEstado.map((f) => f.medioId))
    const mediosHuerfanos = await db.medio.count({
      where: {
        id: { not: { in: [...conEstadoSet] } },
        activo: true,
        url: { not: '' },
      },
    })

    // Distribucion por nivel
    const fuentesPorNivel = await db.fuenteEstado.findMany({
      include: { medio: { select: { nombre: true, nivel: true } } },
      where: { activo: true },
      orderBy: { medio: { nivel: 'asc' } },
    })

    const porNivel: Record<string, { count: number; fuentes: string[] }> = {}
    for (const f of fuentesPorNivel) {
      const nivel = f.medio.nivel || '?'
      if (!porNivel[nivel]) porNivel[nivel] = { count: 0, fuentes: [] }
      porNivel[nivel].count++
      porNivel[nivel].fuentes.push(f.medio.nombre)
    }

    return NextResponse.json({
      totalFuentes,
      activas,
      totalMedios,
      mediosHuerfanos,
      porNivel,
    })
  } catch (error: unknown) {
    return NextResponse.json({ error: safeError(error, 'seed-fuentes') }, { status: 500 })
  }
}
