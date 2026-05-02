import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { personaId, tipo, fecha, ejesSeleccionados } = body;
    const tipoReporte = tipo || 'semanal';

    // Calcular rango de fechas según tipo
    let fechaFin = new Date();
    let fechaInicio = new Date();

    if (tipoReporte === 'EL_TERMOMETRO' && fecha) {
      // Ventana nocturna: 19:00 del día anterior a 07:00 del día seleccionado
      const [year, month, day] = fecha.split('-').map(Number);
      const selectedDate = new Date(year, month - 1, day);

      fechaFin = new Date(selectedDate);
      fechaFin.setHours(7, 0, 0, 0);

      fechaInicio = new Date(selectedDate);
      fechaInicio.setDate(fechaInicio.getDate() - 1);
      fechaInicio.setHours(19, 0, 0, 0);
    } else if (tipoReporte === 'SALDO_DEL_DIA' && fecha) {
      // Ventana diurna: 07:00 a 19:00 del día seleccionado
      const [year, month, day] = fecha.split('-').map(Number);
      const selectedDate = new Date(year, month - 1, day);

      fechaInicio = new Date(selectedDate);
      fechaInicio.setHours(7, 0, 0, 0);

      fechaFin = new Date(selectedDate);
      fechaFin.setHours(19, 0, 0, 0);
    } else if (tipoReporte === 'EL_FOCO' && fecha) {
      // Día completo: 00:00 a 23:59 del día seleccionado
      const [year, month, day] = fecha.split('-').map(Number);
      const selectedDate = new Date(year, month - 1, day);

      fechaInicio = new Date(selectedDate);
      fechaInicio.setHours(0, 0, 0, 0);

      fechaFin = new Date(selectedDate);
      fechaFin.setHours(23, 59, 59, 999);
    } else if (tipoReporte === 'diario' || tipoReporte === 'boletin_diario') {
      fechaInicio.setDate(fechaFin.getDate() - 1);
      fechaInicio.setHours(0, 0, 0, 0);
      fechaFin.setHours(23, 59, 59, 999);
    } else if (tipoReporte === 'semanal') {
      fechaInicio.setDate(fechaFin.getDate() - 7);
      fechaInicio.setHours(0, 0, 0, 0);
      fechaFin.setHours(23, 59, 59, 999);
    } else if (tipoReporte === 'mensual') {
      fechaInicio.setMonth(fechaFin.getMonth() - 1);
      fechaInicio.setHours(0, 0, 0, 0);
      fechaFin.setHours(23, 59, 59, 999);
    } else {
      fechaInicio.setHours(0, 0, 0, 0);
      fechaFin.setHours(23, 59, 59, 999);
    }

    // Construir where clause para menciones
    const where: Record<string, unknown> = {
      fechaCaptura: { gte: fechaInicio, lte: fechaFin },
    };
    if (personaId) where.personaId = personaId;

    // Filtrar por ejes seleccionados si se proporcionan
    const ejesSlugs: string[] = Array.isArray(ejesSeleccionados) ? ejesSeleccionados : [];
    let menciones;
    if (ejesSlugs.length > 0) {
      // Obtener IDs de ejes temáticos por slug
      const ejesDB = await db.ejeTematico.findMany({
        where: { slug: { in: ejesSlugs } },
        select: { id: true },
      });
      const ejesIds = ejesDB.map(e => e.id);

      menciones = await db.mencion.findMany({
        where: {
          ...where,
          ejesTematicos: {
            some: { ejeTematicoId: { in: ejesIds } },
          },
        },
        include: {
          persona: { select: { id: true, nombre: true, partidoSigla: true, camara: true, departamento: true } },
          medio: { select: { nombre: true, tipo: true, nivel: true } },
          ejesTematicos: { include: { ejeTematico: { select: { nombre: true, slug: true, color: true } } } },
        },
        orderBy: { fechaCaptura: 'desc' },
      });
    } else {
      menciones = await db.mencion.findMany({
        where,
        include: {
          persona: { select: { id: true, nombre: true, partidoSigla: true, camara: true, departamento: true } },
          medio: { select: { nombre: true, tipo: true, nivel: true } },
          ejesTematicos: { include: { ejeTematico: { select: { nombre: true, slug: true, color: true } } } },
        },
        orderBy: { fechaCaptura: 'desc' },
      });
    }

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

    const topActores = Object.values(mencionesPorPersona)
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

    // Ventana descriptiva para productos específicos
    let ventanaLabel = '';
    if (tipoReporte === 'EL_TERMOMETRO' && fecha) {
      const fechaStr = new Date(fecha + 'T12:00:00').toLocaleDateString('es-BO', { day: '2-digit', month: 'long', year: 'numeric' });
      ventanaLabel = `la ventana nocturna (ayer 19:00 — hoy 07:00) del ${fechaStr}`;
    } else if (tipoReporte === 'SALDO_DEL_DIA' && fecha) {
      const fechaStr = new Date(fecha + 'T12:00:00').toLocaleDateString('es-BO', { day: '2-digit', month: 'long', year: 'numeric' });
      ventanaLabel = `la jornada diurna (07:00 — 19:00) del ${fechaStr}`;
    } else if (tipoReporte === 'EL_FOCO' && fecha) {
      const fechaStr = new Date(fecha + 'T12:00:00').toLocaleDateString('es-BO', { day: '2-digit', month: 'long', year: 'numeric' });
      const ejeNombre = ejesSlugs.length > 0 ? `eje «${ejesSlugs[0]}»` : 'eje temático';
      ventanaLabel = `el día completo del ${fechaStr} para el ${ejeNombre}`;
    }

    const resumen = generarResumen({
      tipo: tipoReporte,
      personaNombre: personaTarget?.nombre,
      totalMenciones,
      sentimientoPromedio,
      clasificadores,
      topMedios,
      topActores: personaId ? null : topActores,
      totalComentarios,
      sentimientoComentarios,
      enlacesRotos,
      mencionesPorNivel,
      ventanaLabel,
      ejesSlugs: ejesSlugs,
    });

    // ─── Contenido estructurado JSON ───
    const contenidoEstructurado = JSON.stringify({
      clasificadores,
      sentimiento: {
        promedio: sentimientoPromedio,
        distribucion: sentimientoDistribucion,
      },
      topMedios,
      topActores,
      comentarios: {
        total: totalComentarios,
        sentimiento: sentimientoComentarios,
      },
      enlacesRotos,
      mencionesPorNivel,
      ejesSeleccionados: ejesSlugs,
    });

    // ─── Crear registro del reporte ───
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
        topActores,
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
  topActores: Array<{ nombre: string; partido: string; camara: string; count: number }> | null;
  totalComentarios: number;
  sentimientoComentarios: string;
  enlacesRotos: number;
  mencionesPorNivel: Record<string, number>;
  ventanaLabel?: string;
  ejesSlugs?: string[];
}): string {
  const target = params.personaNombre
    ? `${params.personaNombre}`
    : 'los actores monitoreados';

  // Productos específicos con su propia narrativa
  if (params.tipo === 'EL_TERMOMETRO') {
    return generarResumenTermometro(params);
  }
  if (params.tipo === 'SALDO_DEL_DIA') {
    return generarResumenSaldoDelDia(params);
  }
  if (params.tipo === 'EL_FOCO') {
    return generarResumenElFoco(params);
  }

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

    if (params.topActores && params.topActores.length > 0) {
      const actoresStr = params.topActores.slice(0, 5).map(p => `${p.nombre} (${p.count})`).join(', ');
      resumen += `Actores con mayor presencia: ${actoresStr}.\n\n`;
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

function generarResumenTermometro(params: {
  totalMenciones: number;
  sentimientoPromedio: number;
  clasificadores: Array<{ nombre: string; slug: string; color: string; menciones: number }>;
  topActores: Array<{ nombre: string; partido: string; camara: string; count: number }> | null;
  topMedios: Array<{ nombre: string; count: number }>;
  totalComentarios: number;
  sentimientoComentarios: string;
  enlacesRotos: number;
  mencionesPorNivel: Record<string, number>;
  ventanaLabel?: string;
  ejesSlugs?: string[];
}): string {
  const ventana = params.ventanaLabel || 'la ventana nocturna analizada';

  let resumen = `EL TERMÓMETRO — Clima Mediático Matutino\n\n`;
  resumen += `Ventana de análisis: ${ventana}\n\n`;

  if (params.totalMenciones === 0) {
    resumen += `No se registraron menciones durante la noche. El clima mediático se mantiene en calma.\n\n`;
    return resumen;
  }

  // Indicador de clima
  const sentLabel =
    params.sentimientoPromedio >= 4 ? 'DESPEJADO ☀️' :
    params.sentimientoPromedio >= 3.5 ? 'PARCIALMENTE DESPEJADO ⛅' :
    params.sentimientoPromedio >= 3 ? 'NUBLADO ☁️' :
    params.sentimientoPromedio >= 2 ? 'TORMENTOSO ⛈️' :
    'CRÍTICO 🌩️';

  resumen += `CLIMA MEDIÁTICO: ${sentLabel} (${params.sentimientoPromedio.toFixed(1)}/5)\n`;
  resumen += `Total de menciones registradas: ${params.totalMenciones}\n\n`;

  // Ejes temáticos que marcan la agenda
  if (params.clasificadores.length > 0) {
    resumen += `Ejes que marcan la agenda matutina:\n`;
    for (const c of params.clasificadores.slice(0, 5)) {
      resumen += `  - ${c.nombre}: ${c.menciones} menciones\n`;
    }
    resumen += '\n';
  }

  // Actores destacados de la noche
  if (params.topActores && params.topActores.length > 0) {
    resumen += `Actores destacados de la noche:\n`;
    for (const a of params.topActores.slice(0, 5)) {
      resumen += `  - ${a.nombre} (${a.partido}): ${a.count} menciones\n`;
    }
    resumen += '\n';
  }

  // Medios principales
  if (params.topMedios.length > 0) {
    const mediosStr = params.topMedios.slice(0, 3).map(m => `${m.nombre} (${m.count})`).join(', ');
    resumen += `Medios con mayor actividad nocturna: ${mediosStr}.\n\n`;
  }

  // Comentarios
  if (params.totalComentarios > 0) {
    resumen += `Reacción ciudadana: ${params.totalComentarios} comentarios analizados. `;
    resumen += `Sentimiento: ${params.sentimientoComentarios}.\n\n`;
  }

  if (params.enlacesRotos > 0) {
    resumen += `Nota: ${params.enlacesRotos} enlace(s) roto(s) detectados. Texto completo respaldado.\n`;
  }

  return resumen;
}

function generarResumenSaldoDelDia(params: {
  totalMenciones: number;
  sentimientoPromedio: number;
  clasificadores: Array<{ nombre: string; slug: string; color: string; menciones: number }>;
  topActores: Array<{ nombre: string; partido: string; camara: string; count: number }> | null;
  topMedios: Array<{ nombre: string; count: number }>;
  totalComentarios: number;
  sentimientoComentarios: string;
  enlacesRotos: number;
  mencionesPorNivel: Record<string, number>;
  ventanaLabel?: string;
  ejesSlugs?: string[];
}): string {
  const ventana = params.ventanaLabel || 'la jornada diurna analizada';

  let resumen = `SALDO DEL DÍA — Balance de Jornada\n\n`;
  resumen += `Ventana de análisis: ${ventana}\n\n`;

  if (params.totalMenciones === 0) {
    resumen += `Jornada sin actividad mediática significativa registrada.\n\n`;
    return resumen;
  }

  // Balance del día
  const sentLabel =
    params.sentimientoPromedio >= 4 ? 'POSITIVO ✓' :
    params.sentimientoPromedio >= 3.5 ? 'MODERADAMENTE POSITIVO' :
    params.sentimientoPromedio >= 3 ? 'NEUTRAL ○' :
    params.sentimientoPromedio >= 2 ? 'NEGATIVO ✗' :
    'CRÍTICO ⚠';

  resumen += `BALANCE DE SENTIMIENTO: ${sentLabel} (${params.sentimientoPromedio.toFixed(1)}/5)\n`;
  resumen += `Total de menciones en la jornada: ${params.totalMenciones}\n\n`;

  // Ejes temáticos del día
  if (params.clasificadores.length > 0) {
    resumen += `Ejes temáticos del día:\n`;
    for (const c of params.clasificadores.slice(0, 5)) {
      resumen += `  - ${c.nombre}: ${c.menciones} menciones\n`;
    }
    resumen += '\n';
  }

  // Actores principales de la jornada
  if (params.topActores && params.topActores.length > 0) {
    resumen += `Actores principales de la jornada:\n`;
    for (const a of params.topActores.slice(0, 5)) {
      resumen += `  - ${a.nombre} (${a.partido}): ${a.count} menciones\n`;
    }
    resumen += '\n';
  }

  // Medios que lideraron cobertura
  if (params.topMedios.length > 0) {
    const mediosStr = params.topMedios.slice(0, 3).map(m => `${m.nombre} (${m.count})`).join(', ');
    resumen += `Medios con mayor cobertura: ${mediosStr}.\n\n`;
  }

  // Comentarios
  if (params.totalComentarios > 0) {
    resumen += `Reacción ciudadana: ${params.totalComentarios} comentarios. `;
    resumen += `Sentimiento: ${params.sentimientoComentarios}.\n\n`;
  }

  if (params.enlacesRotos > 0) {
    resumen += `Nota: ${params.enlacesRotos} enlace(s) roto(s) detectados.\n`;
  }

  return resumen;
}

function generarResumenElFoco(params: {
  totalMenciones: number;
  sentimientoPromedio: number;
  clasificadores: Array<{ nombre: string; slug: string; color: string; menciones: number }>;
  topActores: Array<{ nombre: string; partido: string; camara: string; count: number }> | null;
  topMedios: Array<{ nombre: string; count: number }>;
  totalComentarios: number;
  sentimientoComentarios: string;
  enlacesRotos: number;
  mencionesPorNivel: Record<string, number>;
  ventanaLabel?: string;
  ejesSlugs?: string[];
}): string {
  const ventana = params.ventanaLabel || 'el día analizado';
  const ejeNombre = params.ejesSlugs && params.ejesSlugs.length > 0 ? params.ejesSlugs[0] : 'eje temático';

  let resumen = `EL FOCO — Análisis Profundo: ${ejeNombre}\n\n`;
  resumen += `Ventana de análisis: ${ventana}\n\n`;

  if (params.totalMenciones === 0) {
    resumen += `No se registraron menciones para este eje temático en el período analizado.\n\n`;
    return resumen;
  }

  // Sentimiento del eje
  const sentLabel =
    params.sentimientoPromedio >= 4 ? 'FAVORABLE ✦' :
    params.sentimientoPromedio >= 3.5 ? 'MODERADAMENTE FAVORABLE' :
    params.sentimientoPromedio >= 3 ? 'NEUTRO ○' :
    params.sentimientoPromedio >= 2 ? 'DESFAVORABLE ✗' :
    'CRÍTICO ⚠';

  resumen += `SENTIMIENTO DEL EJE: ${sentLabel} (${params.sentimientoPromedio.toFixed(1)}/5)\n`;
  resumen += `Total de menciones registradas: ${params.totalMenciones}\n\n`;

  // Actores dentro del eje
  if (params.topActores && params.topActores.length > 0) {
    resumen += `Actores principales en el eje:\n`;
    for (const a of params.topActores.slice(0, 5)) {
      resumen += `  - ${a.nombre} (${a.partido}): ${a.count} menciones\n`;
    }
    resumen += '\n';
  }

  // Fuentes que cubrieron el eje
  if (params.topMedios.length > 0) {
    resumen += `Fuentes que cubrieron el eje:\n`;
    for (const m of params.topMedios.slice(0, 5)) {
      resumen += `  - ${m.nombre}: ${m.count} menciones\n`;
    }
    resumen += '\n';
  }

  // Sub-ejes o clasificadores relacionados
  if (params.clasificadores.length > 0) {
    resumen += `Sub-temas relacionados:\n`;
    for (const c of params.clasificadores.slice(0, 5)) {
      resumen += `  - ${c.nombre}: ${c.menciones} menciones\n`;
    }
    resumen += '\n';
  }

  // Comentarios
  if (params.totalComentarios > 0) {
    resumen += `Reacción ciudadana: ${params.totalComentarios} comentarios. `;
    resumen += `Sentimiento: ${params.sentimientoComentarios}.\n\n`;
  }

  if (params.enlacesRotos > 0) {
    resumen += `Nota: ${params.enlacesRotos} enlace(s) roto(s) detectados.\n`;
  }

  return resumen;
}
