// POST /api/seed-fuentes — Crear FuenteEstado para medios que no tienen
// GET  /api/seed-fuentes — Estado actual de fuentes
// Fase test: solo activa nivel 1 con URL valida

import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { guardError } from '@/lib/rate-guard'

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

    // 3. Crear FuenteEstado para medios que no tienen (batch: collect then createMany)
    let creados = 0
    let saltados = 0
    const detalles: Array<{ medio: string; estado: string; razon?: string }> = []

    const fuentesToCreate: Array<Record<string, unknown>> = []
    const fuentesToUpdate: Array<{ medioId: string; url: string; tipoCheck: string; frecuenciaBase: string }> = []
    const mediosToSkip: Array<{ nombre: string; razon: string }> = []

    for (const medio of medios) {
      if (existentesSet.has(medio.id) && !forzar) {
        saltados++
        mediosToSkip.push({ nombre: medio.nombre, razon: 'ya existe' })
        continue
      }
      if (!medio.url) {
        saltados++
        mediosToSkip.push({ nombre: medio.nombre, razon: 'sin URL' })
        continue
      }

      const frecuenciaBase = FRECUENCIA_POR_NIVEL[medio.nivel] || '6h'
      const tipoCheck = tipoCheckParaCategoria(medio.tipo)

      if (forzar && existentesSet.has(medio.id)) {
        fuentesToUpdate.push({ medioId: medio.id, url: medio.url, tipoCheck, frecuenciaBase })
      } else {
        fuentesToCreate.push({
          id: `fe-${medio.id}`,
          medioId: medio.id,
          url: medio.url,
          tipoCheck,
          frecuenciaBase,
          frecuenciaActual: frecuenciaBase,
          activo: medio.nivel === '1',
        })
      }
    }

    // Batch create new fuentes
    if (fuentesToCreate.length > 0) {
      try {
        const result = await db.fuenteEstado.createMany({ data: fuentesToCreate, skipDuplicates: true })
        creados += result.count
        for (const medio of medios) {
          const found = fuentesToCreate.find(f => f.medioId === medio.id)
          if (found) {
            detalles.push({
              medio: medio.nombre,
              estado: 'creado',
              razon: `nivel ${medio.nivel}, freq ${(found as Record<string, string>).frecuenciaBase}, check ${(found as Record<string, string>).tipoCheck}, activo ${medio.nivel === '1'}`,
            })
          }
        }
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error)
        detalles.push({ medio: 'batch', estado: 'error', razon: msg })
      }
    }

    // Batch update existing fuentes (when forzar=true)
    if (fuentesToUpdate.length > 0) {
      try {
        await Promise.all(fuentesToUpdate.map(f =>
          db.fuenteEstado.update({
            where: { medioId: f.medioId },
            data: { url: f.url, tipoCheck: f.tipoCheck, frecuenciaBase: f.frecuenciaBase, frecuenciaActual: f.frecuenciaBase, activo: true },
          })
        ))
        creados += fuentesToUpdate.length
        for (const f of fuentesToUpdate) {
          const medio = medios.find(m => m.id === f.medioId)
          if (medio) {
            detalles.push({ medio: medio.nombre, estado: 'actualizado', razon: `freq ${f.frecuenciaBase}, check ${f.tipoCheck}` })
          }
        }
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error)
        detalles.push({ medio: 'batch-update', estado: 'error', razon: msg })
      }
    }

    for (const s of mediosToSkip) {
      detalles.push({ medio: s.nombre, estado: 'saltado', razon: s.razon })
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
    return NextResponse.json({ error: guardError(error, 'seed-fuentes') }, { status: 500 })
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
      include: { Medio: { select: { nombre: true, nivel: true } } },
      where: { activo: true },
      orderBy: { Medio: { nivel: 'asc' } },
    })

    const porNivel: Record<string, { count: number; fuentes: string[] }> = {}
    for (const f of fuentesPorNivel) {
      const nivel = f.Medio.nivel || '?'
      if (!porNivel[nivel]) porNivel[nivel] = { count: 0, fuentes: [] }
      porNivel[nivel].count++
      porNivel[nivel].fuentes.push(f.Medio.nombre)
    }

    return NextResponse.json({
      totalFuentes,
      activas,
      totalMedios,
      mediosHuerfanos,
      porNivel,
    })
  } catch (error: unknown) {
    return NextResponse.json({ error: guardError(error, 'seed-fuentes') }, { status: 500 })
  }
}
