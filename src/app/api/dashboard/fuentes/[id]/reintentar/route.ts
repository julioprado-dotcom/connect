// POST /api/dashboard/fuentes/[id]/reintentar — Reprogramar captura de una fuente
//
// Recibe: { fuerza?: boolean }
// Crea un nuevo Job de tipo check_fuente para el medio indicado.

import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { enqueue } from '@/lib/jobs/queue';
import { withAuth } from '@/lib/auth-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // Auth check
  const { error: authError } = await withAuth();
  if (authError) return authError;

  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { ok: false, error: 'ID de fuente requerido' },
        { status: 400 },
      );
    }

    // Parse body (fuerza is optional)
    let fuerza = false;
    try {
      const body = await request.json();
      fuerza = !!body.fuerza;
    } catch {
      // Body vacío es válido
    }

    // Find the Medio by id
    const medio = await db.medio.findUnique({
      where: { id },
      select: { id: true, nombre: true, url: true, tipo: true },
    });

    if (!medio) {
      return NextResponse.json(
        { ok: false, error: 'Fuente no encontrada' },
        { status: 404 },
      );
    }

    // Check if FuenteEstado exists
    const fuenteEstado = await db.fuenteEstado.findUnique({
      where: { medioId: id },
    });

    // Create a new Job to retry capture
    const jobId = await enqueue({
      tipo: 'check_fuente',
      prioridad: fuerza ? 1 : 3, // P1 si forzado, P3 normal
      payload: {
        medioId: id,
        medioNombre: medio.nombre,
        url: medio.url || (fuenteEstado?.url ?? ''),
        forzado: fuerza,
      },
      programa: 'dashboard-manual-retry',
    });

    // If FuenteEstado exists, reset failure counters
    if (fuenteEstado) {
      await db.fuenteEstado.update({
        where: { medioId: id },
        data: {
          fallosConsecutivos: 0,
          error: '',
        },
      });
    }

    return NextResponse.json({
      ok: true,
      mensaje: `Captura reprogramada para ${medio.nombre}`,
      jobId,
    });
  } catch (error) {
    console.error('[API /dashboard/fuentes/[id]/reintentar]', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Error interno del servidor' },
      { status: 500 },
    );
  }
}
