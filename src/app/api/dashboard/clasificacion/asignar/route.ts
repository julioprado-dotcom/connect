// POST /api/dashboard/clasificacion/asignar — Asignar lente/eje a menciones
//
// Recibe: { mencionIds: string[], lenteId?: string, ejeTematicoId?: string }
// Para cada mencionId:
//   - Si ejeTematicoId: upsert MencionTema
//   - Si lenteId: upsert MencionLente
//   - Actualiza tratamientoPeriodistico si es null

import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { withAuth } from '@/lib/auth-helpers';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  // Auth check
  const { error: authError } = await withAuth();
  if (authError) return authError;

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
      where: { id: { in: mencionIds } },
      select: { id: true, tratamientoPeriodistico: true },
    });

    if (menciones.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'No se encontraron menciones con los IDs proporcionados' },
        { status: 404 },
      );
    }

    let asignadas = 0;
    const mencionesToUpdate: string[] = [];

    for (const mencion of menciones) {
      // Upsert MencionTema if ejeTematicoId provided
      if (ejeTematicoId) {
        try {
          await db.mencionTema.upsert({
            where: {
              mencionId_ejeTematicoId: {
                mencionId: mencion.id,
                ejeTematicoId,
              },
            },
            create: {
              id: crypto.randomUUID(),
              mencionId: mencion.id,
              ejeTematicoId,
            },
            update: {
              ejeTematicoId,
            },
          });
        } catch (err) {
          console.warn(`[asignar] Error al upsertar MencionTema para ${mencion.id}:`, err);
        }
      }

      // Upsert MencionLente if lenteId provided
      if (lenteId) {
        try {
          await db.mencionLente.upsert({
            where: {
              mencionId_lenteId: {
                mencionId: mencion.id,
                lenteId,
              },
            },
            create: {
              id: crypto.randomUUID(),
              mencionId: mencion.id,
              lenteId,
            },
            update: {
              lenteId,
            },
          });
        } catch (err) {
          console.warn(`[asignar] Error al upsertar MencionLente para ${mencion.id}:`, err);
        }
      }

      // Track menciones that need tratamientoPeriodistico update
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
