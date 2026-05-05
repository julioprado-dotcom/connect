import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { RATE } from '@/lib/rate-guard';
import { isRateLimited, getClientIp } from '@/lib/rate-limit';

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
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const ip = getClientIp(request);
    const { limited } = isRateLimited(ip, RATE.WRITE);
    if (limited) return NextResponse.json({ error: 'Demasiadas peticiones' }, { status: 429 });

    const body = await request.json();

    const medio = await db.medio.update({
      where: { id },
      data: {
        ...(body.activo !== undefined ? { activo: body.activo } : {}),
        ...(body.nombre !== undefined ? { nombre: body.nombre } : {}),
        ...(body.url !== undefined ? { url: body.url } : {}),
        ...(body.tipo !== undefined ? { tipo: body.tipo } : {}),
        ...(body.categoria !== undefined ? { categoria: body.categoria } : {}),
        ...(body.nivel !== undefined ? { nivel: body.nivel } : {}),
        ...(body.departamento !== undefined ? { departamento: body.departamento } : {}),
        ...(body.plataformas !== undefined ? { plataformas: body.plataformas } : {}),
        ...(body.notas !== undefined ? { notas: body.notas } : {}),
        ...(body.pais !== undefined ? { pais: body.pais } : {}),
      },
    });

    return NextResponse.json({ medio });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const medio = await db.medio.findUnique({
      where: { id },
      include: { _count: { select: { menciones: true } } },
    });
    if (!medio) {
      return NextResponse.json({ error: 'Medio no encontrado' }, { status: 404 });
    }
    if (medio._count.menciones > 0) {
      await db.medio.update({ where: { id }, data: { activo: false } });
      return NextResponse.json({
        message: `Medio desactivado (tiene ${medio._count.menciones} menciones asociadas)`,
        deactivated: true,
      });
    }
    await db.medio.delete({ where: { id } });
    return NextResponse.json({ message: 'Medio eliminado', deleted: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
