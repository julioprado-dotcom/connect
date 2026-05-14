/**
 * /api/dashboard/summary — Batch summary endpoint
 * Returns data for all sidebar widgets in a single call.
 * Used by DashboardCommandCenter to populate CollapsibleWidget badges/status.
 */
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { safeError } from '@/lib/rate-guard';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const manana = new Date(hoy);
    manana.setDate(manana.getDate() + 1);
    const inicioSemana = new Date();
    inicioSemana.setDate(inicioSemana.getDate() - inicioSemana.getDay() + 1);
    inicioSemana.setHours(0, 0, 0, 0);
    const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const en15d = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);

    // ── Parallel Phase 1: Simple counts ───────────────────────
    const [
      mencionesHoy,
      mencionesSemana,
      totalMenciones,
      mediosActivos,
      fuentesInactivas,
      fuentesDegradadas,
      totalMedios,
      totalPersonas,
      diputados,
      senadores,
      indicadoresActivos,
      totalReportes,
      entregasHoyCount,
      entregasFallidasCount,
      entregasPendientesCount,
      clientesActivos,
      contratosVigentes,
      contratosPorVencerCount,
      totalEjes,
      totalSuscriptores,
      jobsCompletados24h,
      jobsFallidos24h,
      jobsActivos,
      alertasNegativas,
      generadoresCount,
    ] = await Promise.all([
      db.mencion.count({ where: { fechaCaptura: { gte: hoy, lt: manana } } }),
      db.mencion.count({ where: { fechaCaptura: { gte: inicioSemana } } }),
      db.mencion.count(),
      db.medio.count({ where: { activo: true } }),
      db.fuenteEstado.count({ where: { estado: 'inactiva' } }),
      db.fuenteEstado.count({ where: { fallosConsecutivos: { gte: 1 } } }),
      db.medio.count(),
      db.persona.count({ where: { activa: true } }),
      db.persona.count({ where: { camara: 'Diputados', activa: true } }),
      db.persona.count({ where: { camara: 'Senadores', activa: true } }),
      db.indicador.count({ where: { activo: true } }),
      db.reporte.count(),
      db.entrega.count({ where: { estado: 'enviado', fechaEnvio: { gte: hoy, lt: manana } } }),
      db.entrega.count({ where: { estado: 'fallido', fechaEnvio: { gte: hoy, lt: manana } } }),
      db.entrega.count({ where: { estado: { in: ['pendiente', 'programado'] } } }),
      db.cliente.count({ where: { estado: 'activo' } }),
      db.contrato.count({ where: { estado: 'activo' } }),
      db.contrato.count({ where: { estado: 'activo', fechaFin: { lte: en15d } } }),
      db.ejeTematico.count({ where: { activo: true } }),
      db.suscriptor.count(),
      db.job.count({ where: { estado: 'completado', fechaCreacion: { gte: hace24h } } }),
      db.job.count({ where: { estado: 'fallido', fechaCreacion: { gte: hace24h } } }),
      db.job.count({ where: { estado: { in: ['pendiente', 'ejecutando'] } } }),
      db.reporte.count({
        where: {
          tipo: 'ALERTA_TEMPRANA',
          sentimientoComentarios: { contains: 'negativo' },
          fechaCreacion: { gte: hoy },
        },
      }),
      db.reporte.count({ where: { tipo: { contains: 'GENERADO' } } }),
    ]);

    // ── Parallel Phase 2: findFirst queries ────────────────────
    const [
      ultimaEvaluacionRaw,
      ultimoReporteRaw,
      lastJobRaw,
    ] = await Promise.all([
      db.indicadorEvaluacion.findFirst({ orderBy: { fechaCreacion: 'desc' } }),
      db.reporte.findFirst({ orderBy: { fechaCreacion: 'desc' } }),
      db.job.findFirst({ orderBy: { fechaCreacion: 'desc' } }),
    ]);

    const ultimaEvaluacion = ultimaEvaluacionRaw?.fechaCreacion ?? null;
    const ultimoReporte = ultimoReporteRaw?.fechaCreacion ?? null;
    const lastJobDate = lastJobRaw?.fechaCreacion ?? null;
    const workerRunning = lastJobDate ? (Date.now() - lastJobDate.getTime() < 2 * 60 * 1000) : false;

    // ── Build response ──────────────────────────────────────
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      menciones: {
        hoy: mencionesHoy,
        semana: mencionesSemana,
        total: totalMenciones,
        status: mencionesHoy > 0 ? 'ok' : mencionesSemana > 0 ? 'warn' : 'idle' as const,
      },
      alertas: {
        negativasHoy: alertasNegativas,
        status: alertasNegativas > 5 ? 'error' as const : alertasNegativas > 0 ? 'warn' as const : 'ok' as const,
      },
      indicadores: {
        activos: totalMenciones, // Refleja menciones capturadas como indicador de actividad
        ultimaEvaluacion,
        status: totalMenciones > 0 ? 'ok' as const : 'idle' as const,
      },
      boletines: {
        entregasHoy: entregasHoyCount,
        fallidas: entregasFallidasCount,
        pendientes: entregasPendientesCount,
        status: entregasFallidasCount > 0 ? 'error' as const : entregasPendientesCount > 0 ? 'warn' as const : 'ok' as const,
      },
      reportes: {
        total: totalReportes,
        ultimo: ultimoReporte,
        status: !ultimoReporte ? 'idle' as const
          : (Date.now() - ultimoReporte.getTime() > 48 * 60 * 60 * 1000) ? 'warn' as const : 'ok' as const,
      },
      productos: { total: 11, operativos: 4, status: 'ok' as const },
      clientes: {
        activos: clientesActivos,
        status: clientesActivos > 0 ? 'ok' as const : 'idle' as const,
      },
      contratos: {
        vigentes: contratosVigentes,
        porVencer15d: contratosPorVencerCount,
        status: contratosPorVencerCount > 0 ? 'warn' as const : 'ok' as const,
      },
      suscriptores: {
        total: totalSuscriptores,
        status: totalSuscriptores > 0 ? 'ok' as const : 'idle' as const,
      },
      fuentes: {
        activas: mediosActivos,
        total: totalMedios,
        inactivas: fuentesInactivas,
        degradadas: fuentesDegradadas,
        status: fuentesInactivas > totalMedios * 0.3 ? 'error' as const
          : fuentesDegradadas > 0 ? 'warn' as const : 'ok' as const,
      },
      ejes: {
        activos: totalEjes,
        status: totalEjes > 0 ? 'ok' as const : 'idle' as const,
      },
      generadores: {
        count: generadoresCount,
        status: generadoresCount > 0 ? 'ok' as const : 'idle' as const,
      },
      jobs: {
        completados24h: jobsCompletados24h,
        fallidos24h: jobsFallidos24h,
        activos: jobsActivos,
        workerRunning,
        status: jobsFallidos24h > 5 ? 'error' as const : jobsFallidos24h > 0 ? 'warn' as const
          : workerRunning ? 'ok' as const : 'idle' as const,
      },
      configuracion: {
        personas: totalPersonas,
        distribucionCamara: { diputados, senadores },
        status: totalPersonas > 0 ? 'ok' as const : 'idle' as const,
      },
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: safeError(error, 'dashboard-summary') }, { status: 500 });
  }
}
