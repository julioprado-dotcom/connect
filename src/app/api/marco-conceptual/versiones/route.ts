import { NextResponse } from 'next/server';
import db from '@/lib/db';

// ─── GET: Todas las versiones del Marco Conceptual ──────────────

export async function GET() {
  try {
    const versiones = await db.marcoConceptual.findMany({
      orderBy: { version: 'desc' },
      select: {
        id: true,
        version: true,
        activa: true,
        creadoPor: true,
        creadoEn: true,
        editadoPor: true,
        editadoEn: true,
      },
    });

    return NextResponse.json({
      total: versiones.length,
      versiones,
    });
  } catch (error) {
    console.error('[marco-conceptual/versiones GET]', error);
    return NextResponse.json(
      { error: 'Error al obtener versiones' },
      { status: 500 }
    );
  }
}
