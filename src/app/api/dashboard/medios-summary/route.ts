/**
 * /api/dashboard/medios-summary — Medios registrados dashboard
 * Returns medios with their fuente status and mention counts.
 */
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { safeError } from '@/lib/rate-guard';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const medios = await db.medio.findMany({
      orderBy: [{ nivel: 'asc' }, { nombre: 'asc' }],
      include: {
        _count: { select: { Mencion: true } },
        FuenteEstado: {
          select: {
            estado: true,
            capaActual: true,
            activo: true,
          },
        },
      },
    });

    const total = medios.length;
    const activos = medios.filter(m => m.activo).length;
    const conFuente = medios.filter(m => m.FuenteEstado !== null).length;

    // Category distribution
    const porCategoria: Record<string, number> = {};
    for (const m of medios) {
      const cat = m.categoria || 'otro';
      porCategoria[cat] = (porCategoria[cat] || 0) + 1;
    }

    // Level distribution
    const porNivel: Record<string, number> = {};
    for (const m of medios) {
      const niv = m.nivel || '1';
      porNivel[niv] = (porNivel[niv] || 0) + 1;
    }

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      total,
      activos,
      conFuente,
      porCategoria,
      porNivel,
      medios: medios.map((m) => ({
        id: m.id,
        nombre: m.nombre,
        tipo: m.tipo,
        categoria: m.categoria,
        nivel: m.nivel,
        departamento: m.departamento,
        activo: m.activo,
        mencionesCount: m._count.Mencion,
        tieneFuente: !!m.FuenteEstado,
        fuenteEstado: m.FuenteEstado?.estado ?? null,
        fuenteCapa: m.FuenteEstado?.capaActual ?? null,
      })),
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: safeError(error, 'medios-summary') }, { status: 500 });
  }
}
