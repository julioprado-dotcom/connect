// POST /api/dashboard/fuentes/[id]/pausar — Pausar o reanudar una fuente
//
// Recibe: { accion: 'pausar' | 'reanudar' }
// Actualiza el campo activo en FuenteEstado.

import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
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

    const body = await request.json();
    const { accion } = body;

    if (!accion || !['pausar', 'reanudar'].includes(accion)) {
      return NextResponse.json(
        { ok: false, error: "Acción inválida. Use 'pausar' o 'reanudar'" },
        { status: 400 },
      );
    }

    // Verify Medio exists
    const medio = await db.medio.findUnique({
      where: { id },
      select: { id: true, nombre: true },
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

    if (!fuenteEstado) {
      // No FuenteEstado yet — update the Medio directly
      const nuevoActivo = accion === 'reanudar';
      await db.medio.update({
        where: { id },
        data: { activo: nuevoActivo },
      });

      return NextResponse.json({
        ok: true,
        estado: nuevoActivo ? 'activa' : 'pausada',
        mensaje: `${medio.nombre} ${nuevoActivo ? 'reanudada' : 'pausada'} (sin FuenteEstado)`,
      });
    }

    // Update FuenteEstado
    const nuevoActivo = accion === 'reanudar';
    await db.fuenteEstado.update({
      where: { medioId: id },
      data: {
        activo: nuevoActivo,
        estado: nuevoActivo ? 'activa' : 'pausada',
        error: nuevoActivo ? '' : 'Pausada manualmente',
      },
    });

    // Also update Medio
    await db.medio.update({
      where: { id },
      data: { activo: nuevoActivo },
    });

    return NextResponse.json({
      ok: true,
      estado: nuevoActivo ? 'activa' : 'pausada',
      mensaje: `${medio.nombre} ${nuevoActivo ? 'reanudada' : 'pausada'} correctamente`,
    });
  } catch (error) {
    console.error('[API /dashboard/fuentes/[id]/pausar]', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Error interno del servidor' },
      { status: 500 },
    );
  }
}
