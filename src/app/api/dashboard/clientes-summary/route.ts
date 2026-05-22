/**
 * /api/dashboard/clientes-summary — Clientes dashboard
 * Returns active cliente counts, segment/plan distribution, top clientes.
 */
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { safeError } from '@/lib/rate-guard';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const [totalActivos, total, allClientes, topClientesRaw, ultimoRegistro] = await Promise.all([
      db.cliente.count({ where: { estado: 'activo' } }),
      db.cliente.count(),
      db.cliente.findMany({ select: { segmento: true, plan: true } }),
      db.cliente.findMany({
        include: { _count: { select: { Contrato: true } } },
        take: 5,
        orderBy: { fechaCreacion: 'desc' },
      }),
      db.cliente.findFirst({ orderBy: { fechaCreacion: 'desc' } }),
    ]);

    // Segment and plan distribution
    const porSegmento: Record<string, number> = {};
    const porPlan: Record<string, number> = {};
    for (const c of allClientes) {
      const seg = c.segmento || 'otro';
      porSegmento[seg] = (porSegmento[seg] || 0) + 1;
      const plan = c.plan || 'basico';
      porPlan[plan] = (porPlan[plan] || 0) + 1;
    }

    const topClientes = topClientesRaw.map((c) => ({
      id: c.id,
      nombre: c.nombre,
      organizacion: c.organizacion,
      plan: c.plan,
      segmento: c.segmento,
      contratosCount: c._count.Contrato,
      fechaCreacion: c.fechaCreacion?.toISOString() ?? new Date().toISOString(),
    }));

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      totalActivos,
      total,
      porSegmento,
      porPlan,
      ultimoRegistro: ultimoRegistro
        ? {
            id: ultimoRegistro.id,
            nombre: ultimoRegistro.nombre,
            organizacion: ultimoRegistro.organizacion,
            plan: ultimoRegistro.plan,
            segmento: ultimoRegistro.segmento,
            fechaCreacion: ultimoRegistro.fechaCreacion?.toISOString() ?? new Date().toISOString(),
          }
        : null,
      topClientes,
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: safeError(error, 'clientes-summary') }, { status: 500 });
  }
}
