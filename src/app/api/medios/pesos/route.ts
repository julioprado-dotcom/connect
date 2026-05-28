/**
 * POST /api/medios/pesos — Recalcular pesoInformativo para todos los medios
 * Uses the peso-calculator to compute scores and update the DB
 */

export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { withAuth } from '@/lib/auth-helpers';
import { calcularPesoInformativo } from '@/lib/jobs/peso-calculator';

export async function POST() {
  const { error: authError } = await withAuth();
  if (authError) return authError;

  try {
    const medios = await db.medio.findMany({
      select: {
        id: true,
        nombre: true,
        credibilidad: true,
        ambito: true,
        naturaleza: true,
        nivel: true,
        tipo: true,
      },
    });

    // Count menciones per medio (single raw query)
    const mencionesCounts = new Map<string, number>()
    try {
      const counts = await db.$queryRaw<Array<{ medioId: string; count: number }>>(
        'SELECT medioId, COUNT(*) as count FROM Mencion GROUP BY medioId'
      )
      for (const c of counts) {
        mencionesCounts.set(c.medioId, c.count)
      }
    } catch {
      // Skip mention counts if query fails
    }

    // Compute all pesos in memory (no DB needed for computation)
    const pesos = medios.map(medio => ({
      id: medio.id,
      peso: calcularPesoInformativo({
        nombre: medio.nombre,
        credibilidad: medio.credibilidad,
        ambito: medio.ambito,
        naturaleza: medio.naturaleza,
        nivel: medio.nivel,
        tipo: medio.tipo,
        mencionesCount: mencionesCounts.get(medio.id) || 0,
      }),
    }));

    // Batch update: use raw SQL CASE for single query instead of N individual updates
    if (pesos.length > 0) {
      const caseParts = pesos.map(p => `WHEN '${p.id}' THEN ${p.peso}`).join(' ');
      await db.$executeRawUnsafe(
        `UPDATE Medio SET pesoInformativo = CASE id ${caseParts} END WHERE id IN (${pesos.map(p => `'${p.id}'`).join(',')})`
      );
    }

    return NextResponse.json({
      message: `${pesos.length} medios actualizados`,
      totalMedios: medios.length,
    })
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    )
  }
}
