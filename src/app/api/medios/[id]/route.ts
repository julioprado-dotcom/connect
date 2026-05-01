import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

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
    const body = await request.json();

    const medio = await db.medio.update({
      where: { id },
      data: {
        ...(body.activo !== undefined ? { activo: body.activo } : {}),
        ...(body.nombre !== undefined ? { nombre: body.nombre } : {}),
        ...(body.url !== undefined ? { url: body.url } : {}),
        ...(body.tipo !== undefined ? { tipo: body.tipo } : {}),
        ...(body.nivel !== undefined ? { nivel: body.nivel } : {}),
        ...(body.departamento !== undefined ? { departamento: body.departamento } : {}),
        ...(body.plataformas !== undefined ? { plataformas: body.plataformas } : {}),
        ...(body.notas !== undefined ? { notas: body.notas } : {}),
      },
    });

    return NextResponse.json({ medio });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
