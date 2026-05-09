/**
 * GET /api/reportes/sectorial/minero/historial
 * Devuelve lista paginada de reportes sectoriales mineros anteriores.
 * Público (solo lectura).
 */

import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const limit = Math.min(50, Math.max(1, parseInt(sp.get('limit') || '10')));
    const offset = Math.max(0, parseInt(sp.get('offset') || '0'));

    const [reportes, total] = await Promise.all([
      db.reporteSectorial.findMany({
        where: { sector: 'minero' },
        orderBy: { creadoEn: 'desc' },
        skip: offset,
        take: limit,
        select: {
          id: true,
          titulo: true,
          periodoInicio: true,
          periodoFin: true,
          estado: true,
          mencionCount: true,
          medioCount: true,
          indiceExposicion: true,
          generadoEn: true,
          enviadoEn: true,
          creadoEn: true,
          ejes: { select: { ejeTematico: true, mencionCount: true, tendencia: true } },
        },
      }),
      db.reporteSectorial.count({ where: { sector: 'minero' } }),
    ]);

    return NextResponse.json({ reportes, total, limit, offset });
  } catch (error: unknown) {
    console.error('[API /reportes/sectorial/minero/historial]', error);
    return NextResponse.json(
      { error: 'Error al obtener historial de reportes' },
      { status: 500 }
    );
  }
}
