import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { PRODUCTOS } from '@/constants/products';
import type { TipoBoletin } from '@/types/bulletin';
import {
  calculateWindow,
  calculateSentimiento,
  calculateTopActores,
  calculateTopMedios,
  calculateClasificadores,
  calculateMencionesPorNivel,
  countEnlacesRotos,
  formatVentanaLabel,
  getSentimientoLabelExtendido,
} from '@/lib/reportes-utils';
import type { MencionConRelaciones, ResumenParams } from '@/lib/reportes-utils';

// ─── Tipos válidos derivados del catálogo (data-driven) ───
const VALID_TIPOS = Object.keys(PRODUCTOS);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { personaId, tipo, fecha, ejesSeleccionados } = body;
    const tipoReporte = tipo || 'semanal';

    // ─── Validación: verificar que existe en el catálogo ───
    const config = PRODUCTOS[tipoReporte as TipoBoletin];
    if (!config || !VALID_TIPOS.includes(tipoReporte)) {
      return NextResponse.json(
        { error: `tipo inválido: "${tipoReporte}". Tipos válidos: ${VALID_TIPOS.join(', ')}` },
        { status: 400 }
      );
    }

    // Calcular ventana de tiempo usando config del producto
    const ventana = config.generador.ventana;
    const { fechaInicio, fechaFin } = calculateWindow(ventana, fecha);

    // ─── Where clause ───
    const where: Record<string, unknown> = {
      fechaCaptura: { gte: fechaInicio, lte: fechaFin },
    };
    if (personaId) where.personaId = personaId;

    // ─── Filtrar por ejes seleccionados ───
    const ejesSlugs: string[] = Array.isArray(ejesSeleccionados) ? ejesSeleccionados : [];
    let menciones: MencionConRelaciones[];

    if (ejesSlugs.length > 0) {
      const ejesDB = await db.ejeTematico.findMany({
        where: { slug: { in: ejesSlugs } },
        select: { id: true },
      });
      const ejesIds = ejesDB.map(e => e.id);

      menciones = await db.mencion.findMany({
        where: {
          ...where,
          ejesTematicos: { some: { ejeTematicoId: { in: ejesIds } } },
        },
        include: {
          persona: { select: { id: true, nombre: true, partidoSigla: true, camara: true, departamento: true } },
          medio: { select: { id: true, nombre: true, tipo: true, nivel: true } },
          ejesTematicos: { include: { ejeTematico: { select: { id: true, nombre: true, slug: true, color: true } } } },
        },
        orderBy: { fechaCaptura: 'desc' },
      });
    } else {
      menciones = await db.mencion.findMany({
        where,
        include: {
          persona: { select: { id: true, nombre: true, partidoSigla: true, camara: true, departamento: true } },
          medio: { select: { id: true, nombre: true, tipo: true, nivel: true } },
          ejesTematicos: { include: { ejeTematico: { select: { id: true, nombre: true, slug: true, color: true } } } },
        },
        orderBy: { fechaCaptura: 'desc' },
      });
    }

    // ─── Calcular métricas usando utils compartidas ───
    const totalMenciones = menciones.length;
    const sentimiento = calculateSentimiento(menciones);
    const clasificadores = calculateClasificadores(menciones);
    const topMedios = calculateTopMedios(menciones);
    const topActores = calculateTopActores(menciones, 10);
    const mencionesPorNivel = calculateMencionesPorNivel(menciones);
    const enlacesRotos = countEnlacesRotos(menciones);

    // ─── Comentarios (groupBy) ───
    const mencionIds = menciones.map(m => m.id);
    let totalComentarios = 0;
    let sentimientoComentarios = '';

    if (mencionIds.length > 0) {
      const comentariosStats = await db.comentario.groupBy({
        by: ['sentimiento'],
        where: { mencionId: { in: mencionIds } },
        _count: { id: true },
      });

      const sentCount: Record<string, number> = {};
      for (const cs of comentariosStats) {
        totalComentarios += cs._count.id;
        const sent = cs.sentimiento || 'no_clasificado';
        sentCount[sent] = (sentCount[sent] || 0) + cs._count.id;
      }

      if (totalComentarios > 0) {
        const partes: string[] = [];
        for (const [sent, count] of Object.entries(sentCount).sort((a, b) => b[1] - a[1])) {
          const pct = Math.round((count / totalComentarios) * 100);
          partes.push(`${pct}% ${sent.replace('_', ' ')}`);
        }
        sentimientoComentarios = partes.join(', ');
      }
    }

    // ─── Target persona ───
    const personaTarget = personaId
      ? await db.persona.findUnique({ where: { id: personaId }, select: { nombre: true } })
      : null;

    // ─── Generar resumen textual ───
    const ventanaLabel = formatVentanaLabel(ventana, fecha, ejesSlugs);

    const resumen = generarResumen({
      tipo: tipoReporte,
      personaNombre: personaTarget?.nombre,
      totalMenciones,
      sentimientoPromedio: sentimiento.promedio,
      clasificadores,
      topMedios,
      topActores: personaId ? null : topActores.map(a => ({ nombre: a.nombre, partido: a.partido, camara: a.camara, count: a.count })),
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
      sentimiento: { promedio: sentimiento.promedio, distribucion: sentimiento.distribucion },
      topMedios,
      topActores,
      comentarios: { total: totalComentarios, sentimiento: sentimientoComentarios },
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
        sentimientoPromedio: sentimiento.promedio,
        temasPrincipales: clasificadores.map(c => c.slug).join(', '),
        totalComentarios,
        sentimientoComentarios,
        enlacesRotos,
        contenido: contenidoEstructurado,
        clasificadores: JSON.stringify(clasificadores),
      },
      include: { persona: { select: { nombre: true, partidoSigla: true } } },
    });

    // ─── Respuesta con cache headers ───
    return NextResponse.json(
      {
        reporte,
        datos: {
          totalMenciones,
          sentimientoPromedio: sentimiento.promedio,
          clasificadores,
          topMedios,
          topActores: personaId ? null : topActores.map(a => ({ nombre: a.nombre, partido: a.partido, camara: a.camara, count: a.count })),
          totalComentarios,
          sentimientoComentarios,
          enlacesRotos,
          mencionesPorNivel,
        },
      },
      {
        headers: {
          'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
        },
      }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: 'Error al generar reporte', details: message }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════
// Generadores de resumen textual — Registry por tipo (data-driven)
// ═══════════════════════════════════════════════════════════

// Registry: productos dedicados con narrativa propia
const DEDICATED_RESUMEN_MAP: Partial<Record<TipoBoletin, (params: ResumenParams) => string>> = {
  EL_TERMOMETRO: generarResumenTermometro,
  SALDO_DEL_DIA: generarResumenSaldoDelDia,
  EL_FOCO: generarResumenElFoco,
  EL_RADAR: generarResumenElRadar,
};

function generarResumen(params: ResumenParams): string {
  // Buscar función dedicada por tipo
  const fn = DEDICATED_RESUMEN_MAP[params.tipo as TipoBoletin];
  if (fn) return fn(params);

  // ─── Productos genéricos: narrativa estándar ───
  const target = params.personaNombre || 'los actores monitoreados';
  const ventana = params.ventanaLabel || 'el periodo analizado';

  let resumen = `Reporte ${params.tipo} de presencia mediatica de ${target}.\n\n`;
  resumen += `Durante ${ventana}, se registraron ${params.totalMenciones} menciones en medios de comunicacion bolivianos.\n\n`;

  if (params.totalMenciones > 0) {
    const sentLabel = getSentimientoLabelExtendido(params.sentimientoPromedio);
    resumen += `Sentimiento promedio: ${sentLabel} (${params.sentimientoPromedio.toFixed(1)}/5).\n\n`;

    if (params.clasificadores.length > 0) {
      resumen += `Ejes tematicos principales:\n`;
      for (const c of params.clasificadores.slice(0, 5)) {
        resumen += `  - ${c.nombre}: ${c.menciones} menciones\n`;
      }
      resumen += '\n';
    }

    const corporativos = (params.mencionesPorNivel['1'] || 0) + (params.mencionesPorNivel['2'] || 0);
    const alternativos = (params.mencionesPorNivel['3'] || 0) + (params.mencionesPorNivel['4'] || 0);
    if (corporativos > 0 && alternativos > 0) {
      resumen += `Brecha de visibilidad: medios corporativos/regionales registraron ${corporativos} menciones vs ${alternativos} en medios alternativos/redes.\n\n`;
    }

    if (params.topMedios.length > 0) {
      const mediosStr = params.topMedios.map(m => `${m.nombre} (${m.count})`).join(', ');
      resumen += `Medios con mas presencia: ${mediosStr}.\n\n`;
    }

    if (params.topActores && params.topActores.length > 0) {
      const actoresStr = params.topActores.slice(0, 5).map(p => `${p.nombre} (${p.count})`).join(', ');
      resumen += `Actores con mayor presencia: ${actoresStr}.\n\n`;
    }
  } else {
    resumen += 'No se registraron menciones en el periodo analizado.\n\n';
  }

  if (params.totalComentarios > 0) {
    resumen += `Comentarios analizados: ${params.totalComentarios}. Sentimiento: ${params.sentimientoComentarios}.\n\n`;
  }

  if (params.enlacesRotos > 0) {
    resumen += `Enlaces rotos detectados: ${params.enlacesRotos}. Texto completo respaldado en el sistema.\n`;
  }

  return resumen;
}

function generarResumenTermometro(params: ResumenParams): string {
  const ventana = params.ventanaLabel || 'la ventana nocturna analizada';
  let resumen = `EL TERMOMETRO — Clima Mediatico Matutino\n\n`;
  resumen += `Ventana de analisis: ${ventana}\n\n`;

  if (params.totalMenciones === 0) {
    resumen += `No se registraron menciones durante la noche. El clima mediatico se mantiene en calma.\n\n`;
    return resumen;
  }

  const sentLabel =
    params.sentimientoPromedio >= 4 ? 'DESPEJADO' :
    params.sentimientoPromedio >= 3.5 ? 'PARCIALMENTE DESPEJADO' :
    params.sentimientoPromedio >= 3 ? 'NUBLADO' :
    params.sentimientoPromedio >= 2 ? 'TORMENTOSO' :
    'CRITICO';

  resumen += `CLIMA MEDIATICO: ${sentLabel} (${params.sentimientoPromedio.toFixed(1)}/5)\n`;
  resumen += `Total de menciones registradas: ${params.totalMenciones}\n\n`;

  if (params.clasificadores.length > 0) {
    resumen += `Ejes que marcan la agenda matutina:\n`;
    for (const c of params.clasificadores.slice(0, 5)) {
      resumen += `  - ${c.nombre}: ${c.menciones} menciones\n`;
    }
    resumen += '\n';
  }

  if (params.topActores && params.topActores.length > 0) {
    resumen += `Actores destacados de la noche:\n`;
    for (const a of params.topActores.slice(0, 5)) {
      resumen += `  - ${a.nombre} (${a.partido}): ${a.count} menciones\n`;
    }
    resumen += '\n';
  }

  if (params.topMedios.length > 0) {
    const mediosStr = params.topMedios.slice(0, 3).map(m => `${m.nombre} (${m.count})`).join(', ');
    resumen += `Medios con mayor actividad nocturna: ${mediosStr}.\n\n`;
  }

  if (params.totalComentarios > 0) {
    resumen += `Reaccion ciudadana: ${params.totalComentarios} comentarios analizados. Sentimiento: ${params.sentimientoComentarios}.\n\n`;
  }

  if (params.enlacesRotos > 0) {
    resumen += `Nota: ${params.enlacesRotos} enlace(s) roto(s) detectados. Texto completo respaldado.\n`;
  }

  return resumen;
}

function generarResumenSaldoDelDia(params: ResumenParams): string {
  const ventana = params.ventanaLabel || 'la jornada diurna analizada';
  let resumen = `SALDO DEL DIA — Balance de Jornada\n\n`;
  resumen += `Ventana de analisis: ${ventana}\n\n`;

  if (params.totalMenciones === 0) {
    resumen += `Jornada sin actividad mediatica significativa registrada.\n\n`;
    return resumen;
  }

  const sentLabel =
    params.sentimientoPromedio >= 4 ? 'POSITIVO' :
    params.sentimientoPromedio >= 3.5 ? 'MODERADAMENTE POSITIVO' :
    params.sentimientoPromedio >= 3 ? 'NEUTRAL' :
    params.sentimientoPromedio >= 2 ? 'NEGATIVO' :
    'CRITICO';

  resumen += `BALANCE DE SENTIMIENTO: ${sentLabel} (${params.sentimientoPromedio.toFixed(1)}/5)\n`;
  resumen += `Total de menciones en la jornada: ${params.totalMenciones}\n\n`;

  if (params.clasificadores.length > 0) {
    resumen += `Ejes tematicos del dia:\n`;
    for (const c of params.clasificadores.slice(0, 5)) {
      resumen += `  - ${c.nombre}: ${c.menciones} menciones\n`;
    }
    resumen += '\n';
  }

  if (params.topActores && params.topActores.length > 0) {
    resumen += `Actores principales de la jornada:\n`;
    for (const a of params.topActores.slice(0, 5)) {
      resumen += `  - ${a.nombre} (${a.partido}): ${a.count} menciones\n`;
    }
    resumen += '\n';
  }

  if (params.topMedios.length > 0) {
    const mediosStr = params.topMedios.slice(0, 3).map(m => `${m.nombre} (${m.count})`).join(', ');
    resumen += `Medios con mayor cobertura: ${mediosStr}.\n\n`;
  }

  if (params.totalComentarios > 0) {
    resumen += `Reaccion ciudadana: ${params.totalComentarios} comentarios. Sentimiento: ${params.sentimientoComentarios}.\n\n`;
  }

  if (params.enlacesRotos > 0) {
    resumen += `Nota: ${params.enlacesRotos} enlace(s) roto(s) detectados.\n`;
  }

  return resumen;
}

function generarResumenElFoco(params: ResumenParams): string {
  const ventana = params.ventanaLabel || 'el dia analizado';
  const ejeNombre = params.ejesSlugs?.length ? params.ejesSlugs[0] : 'eje tematico';

  let resumen = `EL FOCO — Analisis Profundo: ${ejeNombre}\n\n`;
  resumen += `Ventana de analisis: ${ventana}\n\n`;

  if (params.totalMenciones === 0) {
    resumen += `No se registraron menciones para este eje tematico en el periodo analizado.\n\n`;
    return resumen;
  }

  const sentLabel = getSentimientoLabelExtendido(params.sentimientoPromedio);

  resumen += `SENTIMIENTO DEL EJE: ${sentLabel} (${params.sentimientoPromedio.toFixed(1)}/5)\n`;
  resumen += `Total de menciones registradas: ${params.totalMenciones}\n\n`;

  if (params.topActores && params.topActores.length > 0) {
    resumen += `Actores principales en el eje:\n`;
    for (const a of params.topActores.slice(0, 5)) {
      resumen += `  - ${a.nombre} (${a.partido}): ${a.count} menciones\n`;
    }
    resumen += '\n';
  }

  if (params.topMedios.length > 0) {
    resumen += `Fuentes que cubrieron el eje:\n`;
    for (const m of params.topMedios.slice(0, 5)) {
      resumen += `  - ${m.nombre}: ${m.count} menciones\n`;
    }
    resumen += '\n';
  }

  if (params.clasificadores.length > 0) {
    resumen += `Sub-temas relacionados:\n`;
    for (const c of params.clasificadores.slice(0, 5)) {
      resumen += `  - ${c.nombre}: ${c.menciones} menciones\n`;
    }
    resumen += '\n';
  }

  if (params.totalComentarios > 0) {
    resumen += `Reaccion ciudadana: ${params.totalComentarios} comentarios. Sentimiento: ${params.sentimientoComentarios}.\n\n`;
  }

  if (params.enlacesRotos > 0) {
    resumen += `Nota: ${params.enlacesRotos} enlace(s) roto(s) detectados.\n`;
  }

  return resumen;
}

function generarResumenElRadar(params: ResumenParams): string {
  const ventana = params.ventanaLabel || 'la semana analizada';
  let resumen = `EL RADAR — Radar Semanal de Ejes Tematicos\n\n`;
  resumen += `Ventana de analisis: ${ventana}\n\n`;

  if (params.totalMenciones === 0) {
    resumen += `Semana sin actividad mediatica registrada en los ejes tematicos monitoreados.\n\n`;
    return resumen;
  }

  const sentLabel = getSentimientoLabelExtendido(params.sentimientoPromedio);
  const ejesActivos = params.clasificadores.filter(c => c.menciones > 0).length;

  resumen += `CLIMA SEMANAL: ${sentLabel} (${params.sentimientoPromedio.toFixed(1)}/5)\n`;
  resumen += `Total menciones: ${params.totalMenciones} | Ejes activos: ${ejesActivos} de ${params.clasificadores.length}\n\n`;

  if (params.clasificadores.length > 0) {
    resumen += `RADAR DE EJES TEMATICOS:\n`;
    const activos = params.clasificadores.filter(c => c.menciones > 0);
    for (const c of activos) {
      const tendencia = c.menciones >= 10 ? '(alta actividad)' : c.menciones >= 5 ? '(actividad moderada)' : '(baja actividad)';
      resumen += `  - ${c.nombre}: ${c.menciones} menciones ${tendencia}\n`;
    }
    const inactivos = params.clasificadores.filter(c => c.menciones === 0);
    if (inactivos.length > 0) {
      resumen += `  Ejes sin actividad: ${inactivos.map(c => c.nombre).join(', ')}\n`;
    }
    resumen += '\n';
  }

  if (params.clasificadores[0]?.menciones > 0) {
    resumen += `EJE DOMINANTE: ${params.clasificadores[0].nombre} (${params.clasificadores[0].menciones} menciones)\n\n`;
  }

  if (params.topActores && params.topActores.length > 0) {
    resumen += `ACTORES DESTACADOS DE LA SEMANA:\n`;
    for (const a of params.topActores.slice(0, 7)) {
      resumen += `  - ${a.nombre} (${a.partido}): ${a.count} menciones\n`;
    }
    resumen += '\n';
  }

  if (params.topMedios.length > 0) {
    const mediosStr = params.topMedios.slice(0, 5).map(m => `${m.nombre} (${m.count})`).join(', ');
    resumen += `Medios con mayor cobertura: ${mediosStr}.\n\n`;
  }

  const corporativos = (params.mencionesPorNivel['1'] || 0) + (params.mencionesPorNivel['2'] || 0);
  const alternativos = (params.mencionesPorNivel['3'] || 0) + (params.mencionesPorNivel['4'] || 0) + (params.mencionesPorNivel['5'] || 0);
  if (corporativos > 0 && alternativos > 0) {
    resumen += `Distribucion por nivel: corporativos/regionales ${corporativos} | alternativos/redes ${alternativos}.\n\n`;
  }

  if (params.totalComentarios > 0) {
    resumen += `Reaccion ciudadana: ${params.totalComentarios} comentarios. Sentimiento: ${params.sentimientoComentarios}.\n\n`;
  }

  if (params.enlacesRotos > 0) {
    resumen += `Nota: ${params.enlacesRotos} enlace(s) roto(s) detectados. Texto completo respaldado.\n`;
  }

  return resumen;
}
