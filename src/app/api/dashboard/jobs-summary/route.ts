/**
 * /api/dashboard/jobs-summary — Jobs dashboard widget
 * Returns job counts by status, recent jobs, and queue stats.
 */
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { guardError } from '@/lib/rate-guard';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const last24h = new Date(now.getTime() - 24 * 3600000);

    const [completadosHoy, fallidosHoy, enProgreso, pendientes, cancelados, recentJobs] = await Promise.all([
      db.job.count({ where: { estado: 'completado', fechaFin: { gte: startOfDay } } }),
      db.job.count({ where: { estado: 'fallido', fechaFin: { gte: last24h } } }),
      db.job.count({ where: { estado: 'en_progreso' } }),
      db.job.count({ where: { estado: 'pendiente' } }),
      db.job.count({ where: { estado: 'cancelado' } }),
      db.job.findMany({
        orderBy: { fechaCreacion: 'desc' },
        take: 10,
        select: {
          id: true,
          tipo: true,
          estado: true,
          prioridad: true,
          intentos: true,
          maxIntentos: true,
          fechaCreacion: true,
          fechaInicio: true,
          fechaFin: true,
          error: true,
        },
      }),
    ]);

    // Jobs by type — aggregate from ALL jobs, not just recent 10
    const jobsByTypeRaw = await db.job.groupBy({
      by: ['tipo'],
      _count: true,
    });
    const jobsByType: Record<string, number> = {};
    for (const row of jobsByTypeRaw) {
      jobsByType[row.tipo] = row._count;
    }

    const ultimos = recentJobs.map((j) => {
      const duracion =
        j.fechaInicio && j.fechaFin
          ? Math.round((j.fechaFin.getTime() - j.fechaInicio.getTime()) / 1000)
          : null;
      return {
        id: j.id,
        tipo: j.tipo,
        estado: j.estado,
        prioridad: j.prioridad,
        intentos: j.intentos,
        maxIntentos: j.maxIntentos,
        duracionSegundos: duracion,
        fechaCreacion: j.fechaCreacion.toISOString(),
        error: j.error || null,
      };
    });

    return NextResponse.json({
      timestamp: now.toISOString(),
      completadosHoy,
      fallidos24h: fallidosHoy,
      enProgreso,
      pendientes,
      cancelados,
      jobsByType,
      ultimos,
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: guardError(error, 'jobs-summary') }, { status: 500 });
  }
}
