import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { RATE, safeError } from '@/lib/rate-guard';
import { isRateLimited, getClientIp } from '@/lib/rate-limit';
import { medioUpdateSchema } from '@/lib/validations';
import { guardedParse } from '@/lib/rate-guard';
import { withAuth } from '@/lib/auth-helpers';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const medio = await db.medio.findUnique({ where: { id } });
    if (!medio) {
      return NextResponse.json({ error: 'Medio no encontrado' }, { status: 404 });
    }
    return NextResponse.json({ medio });
  } catch (error: unknown) {
    return NextResponse.json({ error: safeError(error, 'medios/[id]') }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const parsed = await guardedParse(request, medioUpdateSchema, RATE.WRITE);
    if (parsed instanceof NextResponse) return parsed;

    const medio = await db.medio.update({
      where: { id },
      data: parsed.body,
    });

    // Sincronizar activo con FuenteEstado si cambio ese campo
    if (parsed.body.activo !== undefined) {
      await db.fuenteEstado.updateMany({
        where: { medioId: id },
        data: { activo: parsed.body.activo as boolean },
      }).catch(err => {
        console.warn(`[medios/[id]] Error sincronizando FuenteEstado para ${id}:`, err);
      });
    }

    // Also sync URL to FuenteEstado if it changed
    if (parsed.body.url !== undefined) {
      await db.fuenteEstado.updateMany({
        where: { medioId: id },
        data: { url: parsed.body.url as string },
      }).catch(() => {});
    }

    // Update ultimaRevisionHumana when classification fields change
    if (parsed.body.naturaleza || parsed.body.ambito || parsed.body.enfoque || parsed.body.credibilidad) {
      await db.medio.update({
        where: { id },
        data: { ultimaRevisionHumana: new Date() },
      }).catch(() => {});
    }

    return NextResponse.json({ medio });
  } catch (error: unknown) {
    return NextResponse.json({ error: safeError(error, 'medios/[id]') }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authError } = await withAuth();
  if (authError) return authError;

  try {
    const { id } = await params;
    const medio = await db.medio.findUnique({
      where: { id },
      include: { _count: { select: { Mencion: true } } },
    });
    if (!medio) {
      return NextResponse.json({ error: 'Medio no encontrado' }, { status: 404 });
    }
    if (medio._count.Mencion > 0) {
      await db.medio.update({ where: { id }, data: { activo: false } });
      return NextResponse.json({
        message: `Medio desactivado (tiene ${medio._count.Mencion} menciones asociadas)`,
        deactivated: true,
      });
    }
    await db.medio.delete({ where: { id } });
    return NextResponse.json({ message: 'Medio eliminado', deleted: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: safeError(error, 'medios/[id]') }, { status: 500 });
  }
}
