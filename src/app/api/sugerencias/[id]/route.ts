import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { safeError } from '@/lib/safe-error';
import { withAuth } from '@/lib/auth-helpers';

// ═══════════════════════════════════════════════════════════════
// PATCH /api/sugerencias/[id] — Aprobar o rechazar sugerencia
// ═══════════════════════════════════════════════════════════════
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error: authError } = await withAuth();
    if (authError) return authError;

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { action, datosPersona } = body as {
      action: 'aprobar' | 'rechazar';
      datosPersona?: {
        camara?: string;
        departamento?: string;
        partido?: string;
        partidoSigla?: string;
        tipo?: string;
      };
    };

    if (!['aprobar', 'rechazar'].includes(action)) {
      return NextResponse.json({ error: 'Acción no válida. Usa "aprobar" o "rechazar".' }, { status: 400 });
    }

    const sugerencia = await db.sugerenciaInteligencia.findUnique({
      where: { id },
    });

    if (!sugerencia) {
      return NextResponse.json({ error: 'Sugerencia no encontrada' }, { status: 404 });
    }

    if (sugerencia.estado !== 'pendiente') {
      return NextResponse.json({
        error: `Sugerencia ya ${sugerencia.estado}`,
        estadoActual: sugerencia.estado,
      }, { status: 409 });
    }

    if (action === 'rechazar') {
      await db.sugerenciaInteligencia.update({
        where: { id },
        data: { estado: 'rechazada', procesadaEn: new Date() },
      });

      return NextResponse.json({
        success: true,
        action: 'rechazada',
        sugerenciaId: id,
      });
    }

    // Acción: aprobar
    if (sugerencia.tipo === 'nueva_persona') {
      const { aprobarSugerenciaPersona } = await import('@/lib/ai/discovery');
      const resultado = await aprobarSugerenciaPersona(id, datosPersona);

      if (!resultado.success) {
        return NextResponse.json({ error: resultado.error }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        action: 'aprobada',
        sugerenciaId: id,
        personaId: resultado.personaId,
      });
    }

    // Para temas y medios: solo marcar como aprobada (el admin decide qué hacer)
    await db.sugerenciaInteligencia.update({
      where: { id },
      data: { estado: 'aprobada', procesadaEn: new Date() },
    });

    return NextResponse.json({
      success: true,
      action: 'aprobada',
      sugerenciaId: id,
    });
  } catch (error: unknown) {
    const { error: msg } = safeError(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════
// DELETE /api/sugerencias/[id] — Eliminar sugerencia
// ═══════════════════════════════════════════════════════════════
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error: authError } = await withAuth();
    if (authError) return authError;

    const { id } = await params;

    await db.sugerenciaInteligencia.delete({ where: { id } });

    return NextResponse.json({ success: true, deleted: id });
  } catch (error: unknown) {
    const { error: msg } = safeError(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
