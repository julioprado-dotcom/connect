/**
 * /api/dashboard/personas-summary — Personas dashboard
 * Returns total active personas, mention counts, and top 10 personas by mentions today.
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

    const inicioSemana = new Date(hoy);
    inicioSemana.setDate(inicioSemana.getDate() - inicioSemana.getDay() + 1); // Monday

    const [totalPersonas, mencionesHoy, mencionesSemana, topPersonas] = await Promise.all([
      db.persona.count({ where: { activa: true } }),
      db.mencion.count({ where: { fechaCaptura: { gte: hoy } } }),
      db.mencion.count({ where: { fechaCaptura: { gte: inicioSemana } } }),
      db.persona.findMany({
        where: { activa: true },
        take: 10,
        include: {
          _count: {
            select: {
              Mencion: {
                where: { fechaCaptura: { gte: hoy } },
              },
            },
          },
        },
        orderBy: {
          Mencion: { _count: 'desc' },
        },
      }),
    ]);

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      totalPersonas,
      mencionesHoy,
      mencionesSemana,
      topPersonas: topPersonas.map((p) => ({
        id: p.id,
        nombre: p.nombre,
        camara: p.camara,
        partidoSigla: p.partidoSigla,
        departamento: p.departamento,
        mencionesHoy: p._count.Mencion,
      })),
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: guardError(error, 'personas-summary') }, { status: 500 });
  }
}
