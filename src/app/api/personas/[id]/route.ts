import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { guardError } from '@/lib/rate-guard';
import { SENTIMENT_SCORES } from '@/constants/colors';
import { boliviaStartOfWeek, boliviaStartOfMonth } from '@/lib/date-bolivia';

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

    const inicioSemana = boliviaStartOfWeek();

    const inicioMes = boliviaStartOfMonth();

    const mencionesSemana = await db.mencion.count({
      where: { personaId: id, fechaCaptura: { gte: inicioSemana } },
    });

    const mencionesMes = await db.mencion.count({
      where: { personaId: id, fechaCaptura: { gte: inicioMes } },
    });

    // Sentimiento promedio (importado de constants/colors — fuente única)
    const allMenciones = await db.mencion.findMany({
      where: { personaId: id },
      select: { sentimiento: true },
    });

    let sentimientoSum = 0;
    const temasCount: Record<string, number> = {};
    for (const m of allMenciones) {
      sentimientoSum += SENTIMENT_SCORES[m.sentimiento] ?? 3;
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
        Medio: { select: { id: true, nombre: true, tipo: true } },
      },
    });

    // Medios stats
    const mediosGrouped = await db.mencion.groupBy({
      by: ['medioId'],
      where: { personaId: id },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    });

    const mediosIds = [...new Set(mediosGrouped.map(item => item.medioId))];
    const mediosMap = new Map(
      (await db.medio.findMany({ where: { id: { in: mediosIds } }, select: { id: true, nombre: true } }))
        .map(m => [m.id, m.nombre])
    );
    const mediosStats = mediosGrouped.map(item => ({
      medio: mediosMap.get(item.medioId) || 'Desconocido',
      count: item._count.id,
    }));

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
    return NextResponse.json({ error: guardError(error, 'personas/[id]') }, { status: 500 });
  }
}
