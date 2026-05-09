/**
 * GET /api/reportes/sectorial/minero
 * Devuelve el último reporte sectorial minero generado + metadata.
 * Público (solo lectura).
 */

import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    // Último reporte generado
    const reporte = await db.reporteSectorial.findFirst({
      where: { sector: 'minero' },
      orderBy: { creadoEn: 'desc' },
      include: {
        ejes: true,
        envios: { select: { canal: true, destinatario: true, estado: true, enviadoEn: true } },
      },
    });

    if (!reporte) {
      return NextResponse.json({
        reporte: null,
        mensaje: 'No hay reportes sectoriales mineros generados aún.',
        totalHistorial: 0,
      });
    }

    // Conteo total de historial
    const totalHistorial = await db.reporteSectorial.count({
      where: { sector: 'minero' },
    });

    return NextResponse.json({
      reporte: {
        ...reporte,
        contenido: JSON.parse(reporte.contenido || '{}'),
      },
      totalHistorial,
    });
  } catch (error: unknown) {
    console.error('[API /reportes/sectorial/minero GET]', error);
    return NextResponse.json(
      { error: 'Error al obtener reporte sectorial' },
      { status: 500 }
    );
  }
}
