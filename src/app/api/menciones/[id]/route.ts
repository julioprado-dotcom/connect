import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { safeError } from '@/lib/rate-guard';

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
    return NextResponse.json({ error: safeError(error, 'menciones/[id]') }, { status: 500 });
  }
}
