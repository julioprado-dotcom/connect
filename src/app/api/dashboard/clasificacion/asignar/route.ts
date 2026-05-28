// POST /api/dashboard/clasificacion/asignar — Asignar lente/eje a menciones
//
// Recibe: { mencionIds: string[], lenteId?: string, ejeTematicoId?: string }
// Para cada mencionId:
//   - Si ejeTematicoId: upsert MencionTema
//   - Si lenteId: upsert MencionLente
//   - Actualiza tratamientoPeriodistico si es null

import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { mencionIds, lenteId, ejeTematicoId } = body as {
      mencionIds?: string[];
      lenteId?: string;
      ejeTematicoId?: string;
    };

    if (!mencionIds || !Array.isArray(mencionIds) || mencionIds.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'mencionIds es requerido y debe ser un array no vacío' },
        { status: 400 },
      );
    }

    if (!lenteId && !ejeTematicoId) {
      return NextResponse.json(
        { ok: false, error: 'Se requiere al menos lenteId o ejeTematicoId' },
        { status: 400 },
      );
    }

    // Validate referenced entities
    if (lenteId) {
      const lente = await db.lente.findUnique({
        where: { id: lenteId },
        select: { id: true, nombre: true },
      });
      if (!lente) {
        return NextResponse.json(
          { ok: false, error: 'Lente no encontrado' },
          { status: 404 },
        );
      }
    }

    if (ejeTematicoId) {
      const eje = await db.ejeTematico.findUnique({
        where: { id: ejeTematicoId },
        select: { id: true, nombre: true },
      });
      if (!eje) {
        return NextResponse.json(
          { ok: false, error: 'Eje temático no encontrado' },
          { status: 404 },
        );
      }
    }

    // Validate menciones exist
    const menciones = await db.mencion.findMany({
      where: { id: { in: validMencionIds } },
      select: { id: true, tratamientoPeriodistico: true },
    });

    if (menciones.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'No se encontraron menciones con los IDs proporcionados' },
        { status: 404 },
      );
    }

    // Batch: delete + createMany instead of N upserts (4 queries vs 2N)
    const validMencionIds = menciones.map(m => m.id);
    let asignadas = 0;
    const mencionesToUpdate: string[] = [];

    if (ejeTematicoId) {
      try {
        await db.mencionTema.deleteMany({
          where: { mencionId: { in: validMencionIds }, ejeTematicoId },
        });
        await db.mencionTema.createMany({
          data: menciones.map(m => ({
            id: crypto.randomUUID(),
            mencionId: m.id,
            ejeTematicoId,
          })),
          skipDuplicates: true,
        });
      } catch (err) {
        console.warn('[asignar] Error al asignar MencionTema:', err);
      }
    }

    if (lenteId) {
      try {
        await db.mencionLente.deleteMany({
          where: { mencionId: { in: validMencionIds }, lenteId },
        });
        await db.mencionLente.createMany({
          data: menciones.map(m => ({
            id: crypto.randomUUID(),
            mencionId: m.id,
            lenteId,
          })),
          skipDuplicates: true,
        });
      } catch (err) {
        console.warn('[asignar] Error al asignar MencionLente:', err);
      }
    }

    for (const mencion of menciones) {
      if (!mencion.tratamientoPeriodistico) {
        mencionesToUpdate.push(mencion.id);
      }
      asignadas++;
    }

    // Update tratamientoPeriodistico for menciones that don't have one
    // Infer a default based on the assigned eje/lente
    if (mencionesToUpdate.length > 0) {
      const tratamientoDefault = ejeTematicoId ? 'clasificado_manual' : 'en_revision';
      await db.mencion.updateMany({
        where: {
          id: { in: mencionesToUpdate },
          tratamientoPeriodistico: null,
        },
        data: {
          tratamientoPeriodistico: tratamientoDefault,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      asignadas,
      mencionesProcesadas: menciones.length,
      tratamientosActualizados: mencionesToUpdate.length,
    });
  } catch (error) {
    console.error('[API /dashboard/clasificacion/asignar]', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Error interno del servidor' },
      { status: 500 },
    );
  }
}
