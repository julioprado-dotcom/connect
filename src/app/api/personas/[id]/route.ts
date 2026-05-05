import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const persona = await db.persona.findUnique({
      where: { id },
    });

    if (!persona) {
      return NextResponse.json({ error: 'Persona no encontrada' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));

    // Stats
    const totalMenciones = await db.mencion.count({ where: { personaId: id } });

    const inicioSemana = new Date();
    inicioSemana.setDate(inicioSemana.getDate() - inicioSemana.getDay() + 1);
    inicioSemana.setHours(0, 0, 0, 0);

    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);

    const mencionesSemana = await db.mencion.count({
      where: { personaId: id, fechaCaptura: { gte: inicioSemana } },
    });

    const mencionesMes = await db.mencion.count({
      where: { personaId: id, fechaCaptura: { gte: inicioMes } },
    });

    // Sentimiento promedio
    const sentimientoMap: Record<string, number> = {
      elogioso: 5, positivo: 4, neutral: 3, negativo: 2, critico: 1, no_clasificado: 3,
    };

    const allMenciones = await db.mencion.findMany({
      where: { personaId: id },
      select: { sentimiento: true },
    });

    let sentimientoSum = 0;
    const temasCount: Record<string, number> = {};
    for (const m of allMenciones) {
      sentimientoSum += sentimientoMap[m.sentimiento] || 3;
      // We could also collect temas here but they're on the full mencion record
    }
    const sentimientoPromedio = allMenciones.length > 0 ? sentimientoSum / allMenciones.length : 0;

    // Temas principales
    const mencionesConTemas = await db.mencion.findMany({
      where: { personaId: id, temas: { not: '' } },
      select: { temas: true },
    });
    for (const m of mencionesConTemas) {
      for (const tema of m.temas.split(',').map((t: string) => t.trim()).filter(Boolean)) {
        temasCount[tema] = (temasCount[tema] || 0) + 1;
      }
    }
    const temasPrincipales = Object.entries(temasCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tema]) => tema);

    // Menciones paginadas
    const menciones = await db.mencion.findMany({
      where: { personaId: id },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { fechaCaptura: 'desc' },
      include: {
        medio: { select: { id: true, nombre: true, tipo: true } },
      },
    });

    // Medios stats
    const mediosGrouped = await db.mencion.groupBy({
      by: ['medioId'],
      where: { personaId: id },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    });

    const mediosStats = await Promise.all(
      mediosGrouped.map(async (item) => {
        const medio = await db.medio.findUnique({
          where: { id: item.medioId },
          select: { nombre: true },
        });
        return { medio: medio?.nombre || 'Desconocido', count: item._count.id };
      })
    );

    return NextResponse.json({
      persona: {
        id: persona.id,
        nombre: persona.nombre,
        camara: persona.camara,
        departamento: persona.departamento,
        partido: persona.partido,
        partidoSigla: persona.partidoSigla,
        tipo: persona.tipo,
        cargoDirectiva: persona.cargoDirectiva,
        email: persona.email,
        activa: persona.activa,
      },
      stats: {
        totalMenciones,
        mencionesSemana,
        mencionesMes,
        sentimientoPromedio,
        temasPrincipales,
      },
      menciones,
      mediosStats,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
