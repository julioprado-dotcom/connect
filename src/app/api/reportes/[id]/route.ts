import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { guardError } from '@/lib/rate-guard';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const reporte = await db.reporte.findUnique({
      where: { id },
      include: {
        Persona: { select: { id: true, nombre: true, partidoSigla: true } },
      },
    });

    if (!reporte) {
      return NextResponse.json({ error: 'Reporte no encontrado' }, { status: 404 });
    }

    return NextResponse.json(reporte);
  } catch (error: unknown) {
    return NextResponse.json({ error: guardError(error, 'reportes/[id]') }, { status: 500 });
  }
}