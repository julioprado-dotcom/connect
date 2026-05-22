/**
 * /api/dashboard/reportes-summary — Reportes dashboard
 * Returns total reportes, breakdown by tipo, and latest 5 reportes.
 */
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { safeError } from '@/lib/rate-guard';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const [total, porTipo, ultimos] = await Promise.all([
      db.reporte.count(),
      db.reporte.groupBy({
        by: ['tipo'],
        _count: true,
      }),
      db.reporte.findMany({
        include: {
          Persona: { select: { nombre: true } },
        },
        orderBy: { fechaCreacion: 'desc' },
        take: 5,
      }),
    ]);

    const porTipoMap: Record<string, number> = {};
    for (const row of porTipo) {
      porTipoMap[row.tipo] = row._count;
    }

    const ultimo = ultimos[0] ?? null;

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      total,
      porTipo: porTipoMap,
      ultimo: ultimo
        ? {
            id: ultimo.id,
            tipo: ultimo.tipo,
            fechaCreacion: ultimo.fechaCreacion,
            totalMenciones: ultimo.totalMenciones,
            persona: ultimo.Persona ? { nombre: ultimo.Persona.nombre } : null,
          }
        : null,
      ultimos: ultimos.map((r) => ({
        id: r.id,
        tipo: r.tipo,
        fechaCreacion: r.fechaCreacion,
        totalMenciones: r.totalMenciones,
        persona: r.Persona ? { nombre: r.Persona.nombre } : null,
      })),
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: safeError(error, 'reportes-summary') }, { status: 500 });
  }
}
