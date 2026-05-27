/**
 * /api/dashboard/alertas-summary — Alertas tempranas dashboard
 * Returns last 10 menciones with critical/aggressive treatment (alertas tempranas).
 */
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { guardError } from '@/lib/rate-guard';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const manana = new Date(hoy);
    manana.setDate(manana.getDate() + 1);

    // Alertas: menciones with tratamiento critico/agresivo
    const [criticasHoy, agresivasHoy, alertasRecientes] = await Promise.all([
      db.mencion.count({
        where: {
          tratamientoPeriodistico: 'tratamiento_critico',
          fechaCaptura: { gte: hoy, lt: manana },
        },
      }),
      db.mencion.count({
        where: {
          tratamientoPeriodistico: 'tratamiento_agresivo',
          fechaCaptura: { gte: hoy, lt: manana },
        },
      }),
      db.mencion.findMany({
        where: {
          tratamientoPeriodistico: { in: ['tratamiento_critico', 'tratamiento_agresivo'] },
        },
        include: {
          Persona: { select: { id: true, nombre: true, partidoSigla: true, camara: true } },
          Medio: { select: { id: true, nombre: true }},
        },
        orderBy: { fechaCaptura: 'desc' },
        take: 10,
      }),
    ]);

    const totalAlertasHoy = criticasHoy + agresivasHoy;

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      criticasHoy,
      agresivasHoy,
      totalAlertasHoy,
      ultimas: alertasRecientes.map((m) => ({
        id: m.id,
        titulo: m.titulo,
        tratamiento: m.tratamientoPeriodistico,
        sentimiento: m.sentimiento,
        fechaCaptura: m.fechaCaptura,
        persona: m.persona ? {
          nombre: m.persona.nombre,
          partidoSigla: m.persona.partidoSigla,
          camara: m.persona.camara,
        } : null,
        medio: { nombre: m.Medio.nombre },
      })),
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: guardError(error, 'alertas-summary') }, { status: 500 });
  }
}
