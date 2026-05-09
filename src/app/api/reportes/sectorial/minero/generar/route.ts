/**
 * POST /api/reportes/sectorial/minero/generar
 * Dispara generación manual del reporte sectorial minero.
 * Protegido con ADMIN_API_KEY (via proxy.ts).
 */

import { NextRequest, NextResponse } from 'next/server';
import { generarReporteMinero } from '@/lib/reporte-sectorial';
import { safeError } from '@/lib/safe-error';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { periodoInicio, periodoFin } = body as {
      periodoInicio?: string;
      periodoFin?: string;
    };

    const inicio = periodoInicio ? new Date(periodoInicio) : undefined;
    const fin = periodoFin ? new Date(periodoFin) : undefined;

    const reporte = await generarReporteMinero(inicio, fin);

    return NextResponse.json({
      exito: true,
      reporteId: reporte.id,
      titulo: reporte.titulo,
      estado: reporte.estado,
      mencionCount: reporte.mencionCount,
      medioCount: reporte.medioCount,
      indiceExposicion: reporte.indiceExposicion,
      generadoEn: reporte.generadoEn,
    });
  } catch (error: unknown) {
    console.error('[API /reportes/sectorial/minero/generar]', error);
    const { error: msg, code, details } = safeError(error);
    return NextResponse.json(
      { exito: false, error: msg, code, ...(details && { details }) },
      { status: 500 }
    );
  }
}
