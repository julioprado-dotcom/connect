import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const mencion = await db.mencion.findUnique({
      where: { id },
      include: {
        persona: { select: { id: true, nombre: true, partidoSigla: true, camara: true, departamento: true } },
        medio: { select: { id: true, nombre: true, tipo: true } },
      },
    });

    if (!mencion) {
      return NextResponse.json({ error: 'Mención no encontrada' }, { status: 404 });
    }

    const comentarios = await db.comentario.findMany({
      where: { mencionId: id },
      orderBy: { fechaCaptura: 'desc' },
      select: {
        id: true,
        autor: true,
        texto: true,
        sentimiento: true,
        fechaComentario: true,
      },
    });

    return NextResponse.json({ mencion, comentarios });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
