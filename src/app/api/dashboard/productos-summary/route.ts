/**
 * /api/dashboard/productos-summary — Productos/Entregas dashboard
 * Returns delivery stats by estado/tipo and latest 10 entregas.
 */
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { guardError } from '@/lib/rate-guard';
import { boliviaStartOfDay } from '@/lib/date-bolivia';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const hoy = boliviaStartOfDay();
    const manana = new Date(hoy.getTime() + 24 * 60 * 60 * 1000);

    const [enviadasHoy, fallidasHoy, pendientesHoy, totalEntregas, porTipo, ultimasEntregas] =
      await Promise.all([
        db.entrega.count({
          where: { estado: 'enviado', fechaCreacion: { gte: hoy, lt: manana } },
        }),
        db.entrega.count({
          where: { estado: 'fallido', fechaCreacion: { gte: hoy, lt: manana } },
        }),
        db.entrega.count({
          where: { estado: 'pendiente', fechaCreacion: { gte: hoy, lt: manana } },
        }),
        db.entrega.count(),
        db.entrega.groupBy({
          by: ['tipoBoletin'],
          _count: true,
        }),
        db.entrega.findMany({
          include: {
            Contrato: {
              include: { Cliente: { select: { nombre: true } } },
            },
          },
          orderBy: { fechaCreacion: 'desc' },
          take: 10,
        }),
      ]);

    const porTipoMap: Record<string, number> = {};
    for (const row of porTipo) {
      porTipoMap[row.tipoBoletin] = row._count;
    }

    const totalHoy = enviadasHoy + fallidasHoy + pendientesHoy;

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      entregasHoy: {
        enviadas: enviadasHoy,
        fallidas: fallidasHoy,
        pendientes: pendientesHoy,
        total: totalHoy,
      },
      totalEntregas,
      porTipo: porTipoMap,
      ultimasEntregas: ultimasEntregas.map((e) => ({
        id: e.id,
        tipoBoletin: e.tipoBoletin,
        estado: e.estado,
        canal: e.canal,
        fechaEnvio: e.fechaEnvio?.toISOString() ?? null,
        cliente: e.Contrato?.Cliente?.nombre ?? 'Sin cliente',
      })),
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: guardError(error, 'productos-summary') }, { status: 500 });
  }
}
