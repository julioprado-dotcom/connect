import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET() {
  try {
    const ejes = await db.ejeTematico.findMany({
      where: { activo: true },
      orderBy: { orden: 'asc' },
    });

    // Contar menciones asociadas por eje
    const ejesConConteo = await Promise.all(
      ejes.map(async (eje) => {
        const mencionesCount = await db.mencionTema.count({
          where: { ejeTematicoId: eje.id },
        });
        return {
          ...eje,
          mencionesCount,
        };
      })
    );

    return NextResponse.json({
      ejes: ejesConConteo,
      totalEjes: ejes.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
