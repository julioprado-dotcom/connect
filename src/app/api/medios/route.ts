import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const nivel = searchParams.get('nivel');
    const tipo = searchParams.get('tipo');
    const departamento = searchParams.get('departamento');
    const activo = searchParams.get('activo');

    const where: Record<string, unknown> = {};
    if (nivel) where.nivel = nivel;
    if (tipo) where.tipo = tipo;
    if (departamento) where.departamento = departamento;
    if (activo !== null && activo !== undefined) where.activo = activo === 'true';

    const medios = await db.medio.findMany({
      where,
      orderBy: [{ nivel: 'asc' }, { nombre: 'asc' }],
    });

    // Contar menciones por medio
    const mediosConConteo = await Promise.all(
      medios.map(async (medio) => {
        const mencionesCount = await db.mencion.count({
          where: { medioId: medio.id },
        });
        return {
          ...medio,
          mencionesCount,
        };
      })
    );

    // Resumen por nivel
    const nivelLabels: Record<string, string> = {
      '1': 'Corporativos',
      '2': 'Regionales',
      '3': 'Alternativos',
      '4': 'Redes',
      '5': 'Extendidos',
    };

    const resumenPorNivel = await Promise.all(
      ['1', '2', '3', '4', '5'].map(async (n) => {
        const count = await db.medio.count({ where: { nivel: n, activo: true } });
        const menciones = await db.medio.findMany({
          where: { nivel: n, activo: true },
          select: { id: true },
        });
        const mencionesCount = await db.mencion.count({
          where: { medioId: { in: menciones.map((m) => m.id) } },
        });
        return {
          nivel: n,
          etiqueta: nivelLabels[n] || `Nivel ${n}`,
          totalMedios: count,
          mencionesCount,
        };
      })
    );

    return NextResponse.json({
      medios: mediosConConteo,
      totalMedios: medios.length,
      resumenPorNivel,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
