// GET /api/productos/[tipo]/ultimo — Último producto generado
//
// Retorna el último Reporte para un tipo de producto dado.
// Usado por el panel de Producción para la vista previa.

import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { guardError } from '@/lib/rate-guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Mapeo de tipo URL a tipo Reporte (BD)
const TIPO_MAP: Record<string, string> = {
  termometro: 'EL_TERMOMETRO',
  saldo_del_dia: 'SALDO_DEL_DIA',
  el_foco: 'EL_FOCO',
  el_especializado: 'EL_ESPECIALIZADO',
  el_informe_cerrado: 'EL_INFORME_CERRADO',
  ficha_legislador: 'FICHA_LEGISLADOR',
  el_radar: 'EL_RADAR',
  el_hilo: 'EL_HILO',
  boletin_del_grano: 'BOLETIN_DEL_GRANO',
  informe_mineria: 'INFORME_MINERIA',
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ tipo: string }> },
) {
  try {
    const { tipo } = await params;
    const tipoReporte = TIPO_MAP[tipo];

    if (!tipoReporte) {
      return NextResponse.json(
        { error: `Tipo de producto no reconocido: ${tipo}` },
        { status: 400 },
      );
    }

    const reporte = await db.reporte.findFirst({
      where: { tipo: tipoReporte },
      orderBy: { fechaCreacion: 'desc' },
      select: {
        id: true,
        tipo: true,
        resumen: true,
        contenido: true,
        totalMenciones: true,
        fechaCreacion: true,
        fechaInicio: true,
        fechaFin: true,
        temasPrincipales: true,
      },
    });

    if (!reporte) {
      return NextResponse.json({ encontrado: false, tipo: tipoReporte });
    }

    // Parse contenido if it's a JSON string
    let contenidoParsed = reporte.contenido;
    if (typeof contenidoParsed === 'string') {
      try {
        contenidoParsed = JSON.parse(contenidoParsed);
      } catch {
        // Keep as string
      }
    }

    return NextResponse.json({
      encontrado: true,
      tipo: reporte.tipo,
      id: reporte.id,
      resumen: reporte.resumen,
      contenido: contenidoParsed,
      totalMenciones: reporte.totalMenciones,
      fechaCreacion: reporte.fechaCreacion?.toISOString() ?? null,
      fechaInicio: reporte.fechaInicio?.toISOString() ?? null,
      fechaFin: reporte.fechaFin?.toISOString() ?? null,
      temasPrincipales: reporte.temasPrincipales,
    });
  } catch (error: unknown) {
    console.error('[API /productos/[tipo]/ultimo]', error);
    return NextResponse.json(
      { error: guardError(error, 'productos/ultimo') },
      { status: 500 },
    );
  }
}
