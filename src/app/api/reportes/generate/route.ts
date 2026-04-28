import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { personaId, tipo } = body;
    const tipoReporte = tipo || 'semanal';

    // Calcular rango de fechas según tipo
    const fechaFin = new Date();
    const fechaInicio = new Date();

    if (tipoReporte === 'diario' || tipoReporte === 'boletin_diario') {
      fechaInicio.setDate(fechaFin.getDate() - 1);
    } else if (tipoReporte === 'semanal') {
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
        persona: { select: { nombre: true, partidoSigla: true, camara: true, departamento: true } },
        medio: { select: { nombre: true, tipo: true, nivel: true } },
        ejesTematicos: { include: { ejeTematico: { select: { nombre: true, slug: true, color: true } } } },
      },
      orderBy: { fechaCaptura: 'desc' },
    });

    const totalMenciones = menciones.length;

    // ─── Sentimiento ───
    const sentimientoMap: Record<string, number> = {
      elogioso: 5, positivo: 4, neutral: 3, negativo: 2, critico: 1, no_clasificado: 3,
    };

    let sentimientoSum = 0;
    let sentimientoCount = 0;
    const sentimientoDistribucion: Record<string, number> = {};

    for (const m of menciones) {
      const sentVal = sentimientoMap[m.sentimiento] || 3;
      sentimientoSum += sentVal;
      sentimientoCount++;
      const sentKey = m.sentimiento || 'no_clasificado';
      sentimientoDistribucion[sentKey] = (sentimientoDistribucion[sentKey] || 0) + 1;
    }

    const sentimientoPromedio = sentimientoCount > 0 ? sentimientoSum / sentimientoCount : 0;

    // ─── Ejes temáticos ───
    const ejesCount: Record<string, { nombre: string; slug: string; color: string; count: number }> = {};
    for (const m of menciones) {
      if (m.ejesTematicos) {
        for (const mt of m.ejesTematicos) {
          const eje = mt.ejeTematico;
          if (eje) {
            if (!ejesCount[eje.slug]) {
              ejesCount[eje.slug] = { nombre: eje.nombre, slug: eje.slug, color: eje.color, count: 0 };
            }
            ejesCount[eje.slug].count++;
          }
        }
      }
    }

    const clasificadores = Object.values(ejesCount)
      .sort((a, b) => b.count - a.count)
      .slice(0, 11)
      .map(e => ({ nombre: e.nombre, slug: e.slug, color: e.color, menciones: e.count }));

    const temasPrincipales = clasificadores.map(c => c.slug);

    // ─── Por medio y persona ───
    const mencionesPorMedio: Record<string, number> = {};
    const mencionesPorPersona: Record<string, { nombre: string; partido: string; camara: string; count: number }> = {};

    for (const m of menciones) {
      const medioNombre = m.medio?.nombre || 'Desconocido';
      mencionesPorMedio[medioNombre] = (mencionesPorMedio[medioNombre] || 0) + 1;

      if (m.persona) {
        const pKey = m.persona.id;
        if (!mencionesPorPersona[pKey]) {
          mencionesPorPersona[pKey] = {
            nombre: m.persona.nombre,
            partido: m.persona.partidoSigla,
            camara: m.persona.camara,
            count: 0,
          };
        }
        mencionesPorPersona[pKey].count++;
      }
    }

    // ─── Comentarios ───
    const mencionIds = menciones.map(m => m.id);
    let totalComentarios = 0;
    const comentariosSentimientoCount: Record<string, number> = {};

    if (mencionIds.length > 0) {
      const comentariosStats = await db.comentario.groupBy({
        by: ['sentimiento'],
        where: { mencionId: { in: mencionIds } },
        _count: { id: true },
      });

      for (const cs of comentariosStats) {
        totalComentarios += cs._count.id;
        const sent = cs.sentimiento || 'no_clasificado';
        comentariosSentimientoCount[sent] = (comentariosSentimientoCount[sent] || 0) + cs._count.id;
      }
    }

    let sentimientoComentarios = '';
    if (totalComentarios > 0) {
      const partes: string[] = [];
      const totalCom = Object.values(comentariosSentimientoCount).reduce((a, b) => a + b, 0);
      for (const [sent, count] of Object.entries(comentariosSentimientoCount).sort((a, b) => b[1] - a[1])) {
        const pct = Math.round((count / totalCom) * 100);
        partes.push(`${pct}% ${sent.replace('_', ' ')}`);
      }
      sentimientoComentarios = partes.join(', ');
    }

    // ─── Enlaces rotos ───
    const enlacesRotos = await db.mencion.count({
      where: { ...where, enlaceActivo: false },
    });

    // ─── Rankings ───
    const topMedios = Object.entries(mencionesPorMedio)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([nombre, count]) => ({ nombre, count }));

    const topPersonas = Object.values(mencionesPorPersona)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map(p => ({ nombre: p.nombre, partido: p.partido, camara: p.camara, count: p.count }));

    // ─── Brecha de visibilidad por nivel de medio ───
    const mencionesPorNivel: Record<string, number> = {};
    for (const m of menciones) {
      const nivel = String(m.medio?.nivel || '0');
      mencionesPorNivel[nivel] = (mencionesPorNivel[nivel] || 0) + 1;
    }

    // ─── Generar resumen textual ───
    const personaTarget = personaId
      ? await db.persona.findUnique({ where: { id: personaId }, select: { nombre: true } })
      : null;

    const resumen = generarResumen({
      tipo: tipoReporte,
      personaNombre: personaTarget?.nombre,
      totalMenciones,
      sentimientoPromedio,
      clasificadores,
      topMedios,
      topPersonas: personaId ? null : topPersonas,
      totalComentarios,
      sentimientoComentarios,
      enlacesRotos,
      mencionesPorNivel,
    });

    // ─── Contenido estructurado JSON ───
    const contenidoEstructurado = JSON.stringify({
      clasificadores,
      sentimiento: {
        promedio: sentimientoPromedio,
        distribucion: sentimientoDistribucion,
      },
      topMedios,
      topPersonas,
      comentarios: {
        total: totalComentarios,
        sentimiento: sentimientoComentarios,
      },
      enlacesRotos,
      mencionesPorNivel,
    });

    // ─── Crear registro del reporte ───
    const reporte = await db.reporte.create({
      data: {
        tipo: tipoReporte === 'boletin_diario' ? 'boletin_diario' : tipoReporte,
        personaId: personaId || null,
        fechaInicio,
        fechaFin,
        resumen,
        totalMenciones,
        sentimientoPromedio,
        temasPrincipales: temasPrincipales.join(', '),
        totalComentarios,
        sentimientoComentarios,
        enlacesRotos,
        contenido: contenidoEstructurado,
        clasificadores: JSON.stringify(clasificadores),
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
        clasificadores,
        topMedios,
        topPersonas,
        totalComentarios,
        sentimientoComentarios,
        enlacesRotos,
        mencionesPorNivel,
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
  clasificadores: Array<{ nombre: string; slug: string; color: string; menciones: number }>;
  topMedios: Array<{ nombre: string; count: number }>;
  topPersonas: Array<{ nombre: string; partido: string; camara: string; count: number }> | null;
  totalComentarios: number;
  sentimientoComentarios: string;
  enlacesRotos: number;
  mencionesPorNivel: Record<string, number>;
}): string {
  const target = params.personaNombre
    ? `el legislador ${params.personaNombre}`
    : 'los legisladores bolivianos';

  const periodoLabels: Record<string, string> = {
    boletin_diario: 'las últimas 24 horas',
    diario: 'las últimas 24 horas',
    semanal: 'la última semana',
    mensual: 'el último mes',
  };
  const periodoLabel = periodoLabels[params.tipo] || 'el período analizado';

  let resumen = `Reporte ${params.tipo} de presencia mediática de ${target}.\n\n`;
  resumen += `Durante ${periodoLabel}, se registraron ${params.totalMenciones} menciones en medios de comunicación bolivianos.\n\n`;

  if (params.totalMenciones > 0) {
    const sentLabel =
      params.sentimientoPromedio >= 4 ? 'positivo' :
      params.sentimientoPromedio >= 3 ? 'neutral' : 'negativo';

    resumen += `Sentimiento promedio: ${sentLabel} (${params.sentimientoPromedio.toFixed(1)}/5).\n\n`;

    // Clasificadores
    if (params.clasificadores.length > 0) {
      resumen += `Ejes temáticos principales:\n`;
      for (const c of params.clasificadores.slice(0, 5)) {
        resumen += `  - ${c.nombre}: ${c.menciones} menciones\n`;
      }
      resumen += '\n';
    }

    // Brecha de visibilidad
    const nivel1 = params.mencionesPorNivel['1'] || 0;
    const nivel3 = params.mencionesPorNivel['3'] || 0;
    const nivel4 = params.mencionesPorNivel['4'] || 0;
    if (nivel1 > 0 && (nivel3 > 0 || nivel4 > 0)) {
      const corporativos = nivel1 + (params.mencionesPorNivel['2'] || 0);
      const alternativos = nivel3 + nivel4;
      resumen += `Brecha de visibilidad: medios corporativos/regionales registraron ${corporativos} menciones vs ${alternativos} en medios alternativos/redes.\n\n`;
    }

    if (params.topMedios.length > 0) {
      const mediosStr = params.topMedios.map(m => `${m.nombre} (${m.count})`).join(', ');
      resumen += `Medios con más presencia: ${mediosStr}.\n\n`;
    }

    if (params.topPersonas && params.topPersonas.length > 0) {
      const personasStr = params.topPersonas.slice(0, 5).map(p => `${p.nombre} (${p.count})`).join(', ');
      resumen += `Legisladores más mencionados: ${personasStr}.\n\n`;
    }
  } else {
    resumen += 'No se registraron menciones en el período analizado.\n\n';
  }

  if (params.totalComentarios > 0) {
    resumen += `Comentarios analizados: ${params.totalComentarios}. `;
    resumen += `Sentimiento: ${params.sentimientoComentarios}.\n\n`;
  }

  if (params.enlacesRotos > 0) {
    resumen += `Enlaces rotos detectados: ${params.enlacesRotos}. Texto completo respaldado en el sistema.\n`;
  }

  return resumen;
}
