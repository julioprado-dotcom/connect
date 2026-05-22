/**
 * /api/dashboard/ejes-summary — Ejes temáticos dashboard
 * Returns active root ejes with today's mention activity counts.
 */
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { safeError } from '@/lib/rate-guard';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    // Start of today (local)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Root-level active ejes
    const ejes = await db.ejeTematico.findMany({
      where: { parentId: null },
      include: {
        _count: {
          select: { menciones: true },
        },
        children: {
          select: { id: true, _count: { select: { menciones: true } } },
        },
      },
      orderBy: { orden: 'asc' },
    });

    const totalActivos = ejes.length;

    // Batch query for today mentions (avoid N+1)
    const allEjeIds = ejes.flatMap((e) => [e.id, ...e.children.map((c) => c.id)]);
    const todayMentionCounts = await db.mencionTema.groupBy({
      by: ['ejeTematicoId'],
      where: {
        ejeTematicoId: { in: allEjeIds },
        Mencion: { fechaCaptura: { gte: todayStart } },
      },
      _count: true,
    });
    const todayCountMap = new Map<string, number>();
    for (const row of todayMentionCounts) {
      todayCountMap.set(row.ejeTematicoId, row._count);
    }

    const ejesMapped = ejes.map((eje) => {
      const ejeIds = [eje.id, ...eje.children.map((c) => c.id)];
      const mencionesHoy = ejeIds.reduce(
        (sum, id) => sum + (todayCountMap.get(id) ?? 0),
        0,
      );
      const totalMenciones =
        eje._count.menciones +
        eje.children.reduce((s, c) => s + c._count.menciones, 0);

      return {
        id: eje.id,
        nombre: eje.nombre,
        slug: eje.slug,
        color: eje.color,
        icono: eje.icono,
        mencionesHoy,
        totalMenciones,
        temasCount: eje.children.length,
      };
    });

    const conActividadHoy = ejesMapped.filter((e) => e.mencionesHoy > 0).length;

    // Top eje by today mentions (first with highest count)
    const topEje =
      ejesMapped.length > 0
        ? ejesMapped.reduce((top, current) =>
            current.mencionesHoy > top.mencionesHoy ? current : top,
          )
        : null;

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      totalActivos,
      conActividadHoy,
      topEje,
      ejes: ejesMapped,
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: safeError(error, 'ejes-summary') }, { status: 500 });
  }
}
