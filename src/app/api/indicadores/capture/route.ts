/**
 * API: Captura de Indicadores ONION200
 * POST /api/indicadores/capture — Ejecuta captura manual de indicadores Tier 1
 * GET /api/indicadores/capture — Obtiene estado de indicadores
 */

import { NextResponse } from 'next/server'
import { capturarTier1, seedIndicadores, getUltimoValor } from '@/lib/indicadores/capturer-tier1'
import { db as prisma } from '@/lib/db'
import { safeError } from '@/lib/rate-guard'

export async function POST() {
  try {
    const inicio = Date.now()

    // Ejecutar captura de todos los Tier 1
    const resultado = await capturarTier1()

    const duracion = Date.now() - inicio

    return NextResponse.json({
      exito: true,
      mensaje: `Captura completada: ${resultado.exitosos.length} exitosos, ${resultado.fallidos.length} fallidos`,
      datos: {
        exitosos: resultado.exitosos.map(r => ({
          slug: r.slug,
          valor: r.valorTexto,
          confiable: r.confiable,
        })),
        fallidos: resultado.fallidos.map(r => ({
          slug: r.slug,
          error: r.metadata,
        })),
        total: resultado.total,
        duracionMs: duracion,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { exito: false, error: safeError(error, 'indicadores/capture') },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    // Obtener estado actual de todos los indicadores
    const indicadores = await prisma.indicador.findMany({
      where: { activo: true },
      orderBy: { orden: 'asc' },
      include: {
        valores: {
          orderBy: { fechaCaptura: 'desc' },
          take: 1,
        },
      },
    })

    const estado = await Promise.all(
      indicadores.map(async (ind) => {
        const ultimo = ind.valores[0]
        return {
          slug: ind.slug,
          nombre: ind.nombre,
          categoria: ind.categoria,
          fuente: ind.fuente,
          periodicidad: ind.periodicidad,
          unidad: ind.unidad,
          tier: ind.tier,
          ultimoValor: ultimo ? {
            valor: ultimo.valorTexto,
            valorRaw: ultimo.valor,
            fecha: ultimo.fecha,
            confiable: ultimo.confiable,
            fechaCaptura: ultimo.fechaCaptura,
          } : null,
        }
      })
    )

    return NextResponse.json({
      exito: true,
      totalIndicadores: estado.length,
      conDatos: estado.filter(e => e.ultimoValor !== null).length,
      indicadores: estado,
    })
  } catch (error) {
    return NextResponse.json(
      { exito: false, error: safeError(error, 'indicadores/capture') },
      { status: 500 }
    )
  }
}
