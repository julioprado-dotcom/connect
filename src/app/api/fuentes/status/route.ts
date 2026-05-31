// API: Estado detallado de fuentes con metricas de salud
// DECODEX Bolivia
//
// GET /api/fuentes/status?activo=true&conErrores=true

import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getErrorSummary } from '@/lib/jobs/fuente-error-logger';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const soloActivos = searchParams.get('activo') === 'true';
    const conErrores = searchParams.get('conErrores') === 'true';

    const where: Record<string, unknown> = {};
    if (soloActivos) where.activo = true;
    if (conErrores) where.fallosConsecutivos = { gt: 0 };

    const fuentes = await db.fuenteEstado.findMany({
      where,
      include: {
        Medio: { select: { id: true, nombre: true, categoria: true, nivel: true } },
        _count: { select: { ErrorLogs: { where: { resuelto: false } } } },
      },
      orderBy: { ultimoCheck: 'desc' },
    });

    const resultado = await Promise.all(fuentes.map(async (f) => {
      const errorSummary = await getErrorSummary(f.id, 24);

      // Detectar "fuente fantasma" — responde OK pero nunca produce menciones
      const esFantasma = f.totalChecks > 10 && f.totalMenciones === 0 && f.activo;

      return {
        id: f.id,
        medioId: f.medioId,
        medio: f.Medio.nombre,
        categoria: f.Medio.categoria,
        nivel: f.Medio.nivel,
        url: f.url,
        activo: f.activo,
        estado: f.estado,
        capa: f.capaActual,
        tipoCheck: f.tipoCheck,
        ultimoCheck: f.ultimoCheck,
        ultimoCambio: f.ultimoCambio,
        ultimoCheckOk: f.ultimoCheckOk,
        totalChecks: f.totalChecks,
        totalCambios: f.totalCambios,
        totalMenciones: f.totalMenciones,
        totalHeadlines: f.totalHeadlines,
        fallosConsecutivos: f.fallosConsecutivos,
        errorActual: f.error,
        responseTimePromedio: f.responseTime,
        errores24h: errorSummary,
        erroresSinResolver: f._count.ErrorLogs,
        esFantasma,
        advertencias: [
          esFantasma ? 'Fuentes sin menciones tras 10+ checks' : null,
          f.fallosConsecutivos >= 3 ? `${f.fallosConsecutivos} fallos consecutivos` : null,
          f.capaActual === 0 && f.activo ? 'Capa 0: sin check OK reciente' : null,
          errorSummary.sinResolver >= 5 ? `${errorSummary.sinResolver} errores sin resolver (24h)` : null,
        ].filter(Boolean),
      };
    }));

    // Resumen global
    const total = resultado.length;
    const activas = resultado.filter(f => f.activo).length;
    const conProblemas = resultado.filter(f => f.advertencias.length > 0).length;
    const fantasmas = resultado.filter(f => f.esFantasma).length;

    return NextResponse.json({
      fuentes: resultado,
      resumen: {
        total,
        activas,
        conProblemas,
        fantasmas,
        salud: total > 0 ? Math.round((activas - conProblemas) / total * 100) : 0,
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
