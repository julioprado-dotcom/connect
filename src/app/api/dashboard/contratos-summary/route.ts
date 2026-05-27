/**
 * /api/dashboard/contratos-summary — Contratos dashboard
 * Returns contract status counts, MRR, contracts expiring soon.
 */
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { guardError } from '@/lib/rate-guard';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const now = new Date();
    const in15Days = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);

    const [vigentes, vencidos, contratosActivos, porVencer15d, porVencer] = await Promise.all([
      db.contrato.count({
        where: { estado: 'activo', fechaFin: { gte: now } },
      }),
      db.contrato.count({
        where: { estado: 'activo', fechaFin: { lt: now } },
      }),
      db.contrato.findMany({
        where: { estado: 'activo' },
        select: { montoMensual: true, tipoProducto: true },
      }),
      db.contrato.count({
        where: {
          estado: 'activo',
          fechaFin: { gte: now, lte: in15Days },
        },
      }),
      db.contrato.findMany({
        where: {
          estado: 'activo',
          fechaFin: { gte: now, lte: in15Days },
        },
        include: {
          Cliente: { select: { nombre: true, organizacion: true } },
        },
        orderBy: { fechaFin: 'asc' },
      }),
    ]);

    // MRR: sum of all active contract monthly amounts
    const mrrTotal = contratosActivos.reduce((sum, c) => sum + (c.montoMensual ?? 0), 0);

    // Distribution by product type
    const porTipoProducto: Record<string, number> = {};
    for (const c of contratosActivos) {
      const tipo = c.tipoProducto || 'otro';
      porTipoProducto[tipo] = (porTipoProducto[tipo] || 0) + 1;
    }

    const porVencerMapped = porVencer.map((c) => ({
      id: c.id,
      tipoProducto: c.tipoProducto,
      fechaFin: c.fechaFin?.toISOString() ?? null,
      diasRestantes: c.fechaFin
        ? Math.ceil((c.fechaFin.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : null,
      montoMensual: c.montoMensual ?? 0,
      moneda: c.moneda || 'Bs',
      cliente: {
        nombre: c.Cliente.nombre,
        organizacion: c.Cliente.organizacion,
      },
    }));

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      vigentes,
      porVencer15d,
      vencidos,
      mrrTotal,
      porTipoProducto,
      porVencer: porVencerMapped,
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: guardError(error, 'contratos-summary') }, { status: 500 });
  }
}
