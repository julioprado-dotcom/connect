/**
 * POST /api/indicadores/sync
 * Orquestador: sincroniza todos los indicadores Tier 1 de forma secuencial.
 * Cada indicador se procesa uno por uno (micro-llamadas).
 * Si uno falla, genera alerta pero NO frena los demás.
 */

import { NextResponse } from 'next/server'
import { capturarTier1, seedIndicadores } from '@/lib/indicadores/capturer-tier1'
import { safeError } from '@/lib/rate-guard'

export async function POST() {
  try {
    // Step 1: Asegurar definiciones de indicadores (idempotente)
    let seeded = false
    try {
      await seedIndicadores()
      seeded = true
    } catch (seedError) {
      console.warn('[sync] Seed parcial:', seedError)
      // Seed no frena la captura
    }

    // Step 2: Captura secuencial uno por uno
    const resultado = await capturarTier1()

    return NextResponse.json({
      exito: true,
      exitosos: resultado.exitosos.map(r => ({
        slug: r.slug,
        valorTexto: r.valorTexto,
        confiable: r.confiable,
      })),
      fallidos: resultado.fallidos.map(r => ({
        slug: r.slug,
        error: r.error || 'Valor no disponible',
        valorTexto: r.valorTexto,
      })),
      total: resultado.total,
      seeded,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json(
      { exito: false, error: safeError(error, 'indicadores/sync') },
      { status: 500 }
    )
  }
}
