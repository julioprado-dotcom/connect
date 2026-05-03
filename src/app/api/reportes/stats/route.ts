import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const periodo = searchParams.get('periodo') || 'hoy';

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const manana = new Date(hoy);
    manana.setDate(manana.getDate() + 1);

    const inicioSemana = new Date();
    inicioSemana.setDate(inicioSemana.getDate() - inicioSemana.getDay() + 1);
    inicioSemana.setHours(0, 0, 0, 0);

    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);

    // Rango de fecha según periodo
    const rangoFecha = periodo === 'hoy'
      ? { gte: hoy, lt: manana }
      : periodo === 'semana'
        ? { gte: inicioSemana }
        : periodo === 'mes'
          ? { gte: inicioMes }
          : {};

    // Parallel independent counts
    const [totalPeriodo, totalHistorico, enviadosPeriodo, porTipoRaw, porTipoHistoricoRaw] = await Promise.all([
      db.reporte.count({ where: { fechaCreacion: rangoFecha } }),
      db.reporte.count(),
      db.reporte.count({ where: { fechaCreacion: rangoFecha, enviado: true } }),
      db.reporte.groupBy({
        by: ['tipo'],
        where: { fechaCreacion: rangoFecha },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      }),
      db.reporte.groupBy({
        by: ['tipo'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      }),
    ]);

    const porTipo = porTipoRaw.map((r) => ({ tipo: r.tipo, count: r._count.id }));
    const porTipoHistorico = porTipoHistoricoRaw.map((r) => ({ tipo: r.tipo, count: r._count.id }));

    // Build lookup map from porTipoHistorico for O(1) access
    const historicoMap = new Map(porTipoHistorico.map((r) => [r.tipo, r.count]));

    // Batch: single groupBy for all types + latest per type
    // Replaced 22 queries (11 types × 2) with 2 queries
    const tiposActivos = [
      'EL_TERMOMETRO', 'SALDO_DEL_DIA', 'EL_FOCO', 'EL_RADAR',
      'VOZ_Y_VOTO', 'EL_HILO', 'EL_INFORME_CERRADO', 'FOCO_DE_LA_SEMANA',
      'ALERTA_TEMPRANA', 'FICHA_LEGISLADOR', 'EL_ESPECIALIZADO',
    ];

    const [countsByType, latestReports] = await Promise.all([
      db.reporte.groupBy({
        by: ['tipo'],
        _count: { id: true },
      }),
      db.reporte.findMany({
        where: { tipo: { in: tiposActivos } },
        distinct: ['tipo'],
        orderBy: [{ tipo: 'asc' }, { fechaCreacion: 'desc' }],
        select: {
          tipo: true,
          id: true,
          fechaCreacion: true,
          totalMenciones: true,
          sentimientoPromedio: true,
          resumen: true,
          enviado: true,
        },
      }),
    ]);

    const countMap = new Map(countsByType.map((c) => [c.tipo, c._count.id]));
    const latestMap = new Map(latestReports.map((r) => [r.tipo, r]));

    const ultimoPorTipo = tiposActivos.map((tipo) => ({
      tipo,
      ultimo: latestMap.get(tipo) || null,
      totalGenerados: countMap.get(tipo) || 0,
    }));

    // Tendencia: 7 daily counts in parallel
    const tendencias = await Promise.all(
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        d.setHours(0, 0, 0, 0);
        const dFin = new Date(d);
        dFin.setDate(dFin.getDate() + 1);
        return db.reporte
          .count({ where: { fechaCreacion: { gte: d, lt: dFin } } })
          .then((total) => ({ fecha: d.toISOString().slice(0, 10), total }));
      }),
    );

    return NextResponse.json({
      periodo,
      totalPeriodo,
      totalHistorico,
      enviadosPeriodo,
      porTipo,
      porTipoHistorico,
      ultimoPorTipo,
      tendencias,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
