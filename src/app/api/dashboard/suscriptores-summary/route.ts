/**
 * /api/dashboard/suscriptores-summary — Suscriptores dashboard
 * Returns subscriber counts (paid + free), weekly registrations, latest free subscribers.
 */
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { guardError } from '@/lib/rate-guard';
import { boliviaStartOfWeek } from '@/lib/date-bolivia';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const startOfWeek = boliviaStartOfWeek();

    const [totalGratuitos, activosGratuito, registradosSemanaGratuito, ultimos] =
      await Promise.all([
        db.suscriptorGratuito.count(),
        db.suscriptorGratuito.count({ where: { activo: true } }),
        db.suscriptorGratuito.count({
          where: { fechaSuscripcion: { gte: startOfWeek } },
        }),
        db.suscriptorGratuito.findMany({
          take: 5,
          orderBy: { fechaSuscripcion: 'desc' },
        }),
      ]);

    const ultimosMapped = ultimos.map((s) => ({
      id: s.id,
      nombre: s.nombre,
      email: s.email,
      canal: s.canal,
      origen: s.origen,
      activo: s.activo,
      fechaSuscripcion: s.fechaSuscripcion.toISOString(),
    }));

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      totalSuscriptores: totalGratuitos,
      totalGratuitos,
      activos: activosGratuito,
      registradosSemana: registradosSemanaGratuito,
      ultimos: ultimosMapped,
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: guardError(error, 'suscriptores-summary') }, { status: 500 });
  }
}
