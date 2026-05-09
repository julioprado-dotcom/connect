import { NextResponse } from 'next/server';
import db from '@/lib/db';

// ─── GET: Historial de cambios de la versión activa ──────────────

export async function GET() {
  try {
    const marco = await db.marcoConceptual.findFirst({ where: { activa: true } });

    if (!marco) {
      return NextResponse.json(
        { error: 'Marco conceptual no inicializado' },
        { status: 404 }
      );
    }

    const cambios = await db.cambioMarcoConceptual.findMany({
      where: { marcoId: marco.id },
      orderBy: { creadoEn: 'desc' },
    });

    return NextResponse.json({
      version: marco.version,
      totalCambios: cambios.length,
      cambios: cambios.map(c => ({
        id: c.id,
        campo: c.campo,
        valorAnterior: c.valorAnterior,
        valorNuevo: c.valorNuevo,
        razon: c.razon,
        creadoPor: c.creadoPor,
        creadoEn: c.creadoEn,
      })),
    });
  } catch (error) {
    console.error('[marco-conceptual/historial GET]', error);
    return NextResponse.json(
      { error: 'Error al obtener historial' },
      { status: 500 }
    );
  }
}
