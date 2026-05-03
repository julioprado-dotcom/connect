import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const periodo = searchParams.get('periodo') || 'hoy'; // hoy | semana | mes | historico

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
          : {}; // historico = sin filtro

    // Total en el periodo
    const totalPeriodo = await db.reporte.count({
      where: { fechaCreacion: rangoFecha },
    });

    // Total histórico (siempre)
    const totalHistorico = await db.reporte.count();

    // Enviados en el periodo
    const enviadosPeriodo = await db.reporte.count({
      where: { fechaCreacion: rangoFecha, enviado: true },
    });

    // Distribución por tipo de producto
    const porTipoRaw = await db.reporte.groupBy({
      by: ['tipo'],
      where: { fechaCreacion: rangoFecha },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    });

    const porTipo = porTipoRaw.map((r) => ({
      tipo: r.tipo,
      count: r._count.id,
    }));

    // Distribución por tipo histórica
    const porTipoHistoricoRaw = await db.reporte.groupBy({
      by: ['tipo'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    });

    const porTipoHistorico = porTipoHistoricoRaw.map((r) => ({
      tipo: r.tipo,
      count: r._count.id,
    }));

    // Último generado por tipo (solo para los operativos)
    const tiposActivos = [
      'EL_TERMOMETRO', 'SALDO_DEL_DIA', 'EL_FOCO', 'EL_RADAR',
      'VOZ_Y_VOTO', 'EL_HILO', 'EL_INFORME_CERRADO', 'FOCO_DE_LA_SEMANA',
      'ALERTA_TEMPRANA', 'FICHA_LEGISLADOR', 'EL_ESPECIALIZADO',
    ];

    const ultimoPorTipo = await Promise.all(
      tiposActivos.map(async (tipo) => {
        const ultimo = await db.reporte.findFirst({
          where: { tipo },
          orderBy: { fechaCreacion: 'desc' },
          select: {
            id: true,
            fechaCreacion: true,
            totalMenciones: true,
            sentimientoPromedio: true,
            resumen: true,
            enviado: true,
          },
        });
        const countTipo = await db.reporte.count({ where: { tipo } });
        return {
          tipo,
          ultimo: ultimo || null,
          totalGenerados: countTipo,
        };
      })
    );

    // Tendencia: reportes por día últimos 7 días
    const tendencias = await Promise.all(
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        d.setHours(0, 0, 0, 0);
        const dFin = new Date(d);
        dFin.setDate(dFin.getDate() + 1);
        return {
          fecha: d.toISOString().slice(0, 10),
          promesa: db.reporte.count({
            where: { fechaCreacion: { gte: d, lt: dFin } },
          }),
        };
      })
    );
    const tendenciasData = await Promise.all(
      tendencias.map(async (t) => ({
        fecha: t.fecha,
        total: await t.promesa,
      }))
    );

    return NextResponse.json({
      periodo,
      totalPeriodo,
      totalHistorico,
      enviadosPeriodo,
      porTipo,
      porTipoHistorico,
      ultimoPorTipo,
      tendencias: tendenciasData,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
