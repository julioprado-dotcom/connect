/**
 * /api/dashboard/capturas-summary — Capturas / Evidencias dashboard
 * Returns capture logs with mention counts and success rate.
 */
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { safeError } from '@/lib/rate-guard';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const last24h = new Date(now.getTime() - 24 * 3600000);

    const [capturasHoy, capturas24h, totalCapturas, exitosas24h, totalMenciones24h, recentCapturas] =
      await Promise.all([
        db.capturaLog.count({ where: { fecha: { gte: startOfDay } } }),
        db.capturaLog.count({ where: { fecha: { gte: last24h } } }),
        db.capturaLog.count(),
        db.capturaLog.count({ where: { fecha: { gte: last24h }, exitosa: true } }),
        // Sum mencionesEncontradas from last 24h captures
        db.capturaLog.aggregate({
          where: { fecha: { gte: last24h } },
          _sum: { mencionesEncontradas: true, totalArticulos: true },
        }),
        db.capturaLog.findMany({
          orderBy: { fecha: 'desc' },
          take: 10,
          include: {
            medio: { select: { id: true, nombre: true, tipo: true } },
          },
        }),
      ]);

    const successRate =
      capturas24h > 0 ? Math.round((exitosas24h / capturas24h) * 100) : 0;

    const ultimas = recentCapturas.map((c) => ({
      id: c.id,
      fecha: c.fecha.toISOString(),
      nivel: c.nivel,
      totalArticulos: c.totalArticulos,
      mencionesEncontradas: c.mencionesEncontradas,
      exitosa: c.exitosa,
      errores: c.errores,
      medio: { nombre: c.medio.nombre, tipo: c.medio.tipo },
    }));

    return NextResponse.json({
      timestamp: now.toISOString(),
      capturasHoy,
      capturas24h,
      totalCapturas,
      exitosas24h,
      fallidas24h: capturas24h - exitosas24h,
      successRate,
      totalMenciones24h: totalMenciones24h._sum.mencionesEncontradas ?? 0,
      totalArticulos24h: totalMenciones24h._sum.totalArticulos ?? 0,
      ultimas,
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: safeError(error, 'capturas-summary') }, { status: 500 });
  }
}
