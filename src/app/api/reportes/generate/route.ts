import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { personaId, tipo } = body;
    const tipoReporte = tipo || 'semanal';

    // Calcular rango de fechas
    const fechaFin = new Date();
    const fechaInicio = new Date();

    if (tipoReporte === 'semanal') {
      fechaInicio.setDate(fechaFin.getDate() - 7);
    } else if (tipoReporte === 'mensual') {
      fechaInicio.setMonth(fechaFin.getMonth() - 1);
    }

    fechaInicio.setHours(0, 0, 0, 0);
    fechaFin.setHours(23, 59, 59, 999);

    // Consultar menciones en el rango
    const where: Record<string, unknown> = {
      fechaCaptura: { gte: fechaInicio, lte: fechaFin },
    };
    if (personaId) where.personaId = personaId;

    const menciones = await db.mencion.findMany({
      where,
      include: {
        persona: { select: { nombre: true, partidoSigla: true, camara: true } },
        medio: { select: { nombre: true, tipo: true } },
      },
      orderBy: { fechaCaptura: 'desc' },
    });

    const totalMenciones = menciones.length;

    // Calcular sentimiento promedio
    const sentimientoMap: Record<string, number> = {
      elogioso: 5,
      positivo: 4,
      neutral: 3,
      negativo: 2,
      critico: 1,
      no_clasificado: 3,
    };

    let sentimientoSum = 0;
    let sentimientoCount = 0;
    const temasCount: Record<string, number> = {};

    const mencionesPorMedio: Record<string, number> = {};
    const mencionesPorPersona: Record<string, number> = {};

    for (const m of menciones) {
      // Sentimiento
      const sentVal = sentimientoMap[m.sentimiento] || 3;
      sentimientoSum += sentVal;
      sentimientoCount++;

      // Temas
      if (m.temas) {
        for (const tema of m.temas.split(',').map((t: string) => t.trim()).filter(Boolean)) {
          temasCount[tema] = (temasCount[tema] || 0) + 1;
        }
      }

      // Por medio
      const medioNombre = m.medio?.nombre || 'Desconocido';
      mencionesPorMedio[medioNombre] = (mencionesPorMedio[medioNombre] || 0) + 1;

      // Por persona
      const personaNombre = m.persona?.nombre || 'Desconocido';
      mencionesPorPersona[personaNombre] = (mencionesPorPersona[personaNombre] || 0) + 1;
    }

    const sentimientoPromedio = sentimientoCount > 0 ? sentimientoSum / sentimientoCount : 0;

    // Top 5 medios
    const topMedios = Object.entries(mencionesPorMedio)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([nombre, count]) => ({ nombre, count }));

    // Top 5 personas
    const topPersonas = Object.entries(mencionesPorPersona)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([nombre, count]) => ({ nombre, count }));

    // Temas principales
    const temasPrincipales = Object.entries(temasCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tema]) => tema);

    // Generar resumen textual
    const personaTarget = personaId
      ? await db.persona.findUnique({ where: { id: personaId }, select: { nombre: true } })
      : null;

    const resumen = generarResumen({
      tipo: tipoReporte,
      personaNombre: personaTarget?.nombre,
      totalMenciones,
      sentimientoPromedio,
      temasPrincipales,
      topMedios,
      topPersonas: personaId ? null : topPersonas,
    });

    // Crear registro del reporte
    const reporte = await db.reporte.create({
      data: {
        tipo: tipoReporte,
        personaId: personaId || null,
        fechaInicio,
        fechaFin,
        resumen,
        totalMenciones,
        sentimientoPromedio,
        temasPrincipales: temasPrincipales.join(', '),
      },
      include: {
        persona: { select: { nombre: true, partidoSigla: true } },
      },
    });

    return NextResponse.json({
      reporte,
      datos: {
        totalMenciones,
        sentimientoPromedio,
        temasPrincipales,
        topMedios,
        topPersonas,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: 'Error al generar reporte', details: message }, { status: 500 });
  }
}

function generarResumen(params: {
  tipo: string;
  personaNombre?: string | null;
  totalMenciones: number;
  sentimientoPromedio: number;
  temasPrincipales: string[];
  topMedios: Array<{ nombre: string; count: number }>;
  topPersonas: Array<{ nombre: string; count: number }> | null;
}): string {
  const target = params.personaNombre
    ? `el legislador ${params.personaNombre}`
    : 'los legisladores bolivianos';

  const periodoLabel = params.tipo === 'semanal' ? 'la última semana' : 'el último mes';

  let resumen = `Reporte ${params.tipo} de presencia mediática de ${target}.\n\n`;
  resumen += `Durante ${periodoLabel}, se registraron ${params.totalMenciones} menciones en medios de comunicación bolivianos.\n\n`;

  if (params.totalMenciones > 0) {
    const sentLabel =
      params.sentimientoPromedio >= 4
        ? 'positivo'
        : params.sentimientoPromedio >= 3
          ? 'neutral'
          : 'negativo';

    resumen += `El sentimiento promedio fue ${sentLabel} (${params.sentimientoPromedio.toFixed(1)}/5).\n\n`;

    if (params.temasPrincipales.length > 0) {
      resumen += `Temas principales: ${params.temasPrincipales.join(', ')}.\n\n`;
    }

    if (params.topMedios.length > 0) {
      const mediosStr = params.topMedios
        .map((m) => `${m.nombre} (${m.count})`)
        .join(', ');
      resumen += `Medios con más presencia: ${mediosStr}.\n\n`;
    }

    if (params.topPersonas && params.topPersonas.length > 0) {
      const personasStr = params.topPersonas
        .map((p) => `${p.nombre} (${p.count})`)
        .join(', ');
      resumen += `Legisladores más mencionados: ${personasStr}.\n`;
    }
  } else {
    resumen += 'No se registraron menciones en el período analizado.';
  }

  return resumen;
}
