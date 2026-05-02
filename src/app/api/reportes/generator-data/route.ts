import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import {
  calculateWindow,
  calculateSentimiento,
  calculateTopActores,
  calculateTopMedios,
  calculateSubTemas,
  calculateEvolucionHoraria,
  countEnlacesRotos,
  getSentimientoLabelExtendido,
} from '@/lib/reportes-utils';
import type { MencionConRelaciones } from '@/lib/reportes-utils';

const VALID_TIPOS = ['EL_TERMOMETRO', 'SALDO_DEL_DIA', 'EL_FOCO', 'EL_RADAR'];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tipo = searchParams.get('tipo') || '';
    const fecha = searchParams.get('fecha') || new Date().toISOString().slice(0, 10);
    const ejeSlug = searchParams.get('ejeSlug') || '';

    if (!tipo || !VALID_TIPOS.includes(tipo)) {
      return NextResponse.json(
        { error: `tipo inválido. Use ${VALID_TIPOS.join(', ')}` },
        { status: 400 }
      );
    }

    // Ramas dedicadas
    if (tipo === 'EL_FOCO') return handleElFoco(fecha, ejeSlug);
    if (tipo === 'EL_RADAR') return handleElRadar(fecha);

    // ─── EL_TERMOMETRO / SALDO_DEL_DIA ───
    const { fechaInicio, fechaFin, ventanaLabel: windowLabel } = calculateWindow(tipo, fecha);

    const menciones = await db.mencion.findMany({
      where: { fechaCaptura: { gte: fechaInicio, lte: fechaFin } },
      include: {
        persona: { select: { id: true, nombre: true, partidoSigla: true, camara: true, departamento: true } },
        medio: { select: { nombre: true, tipo: true, nivel: true } },
        ejesTematicos: { include: { ejeTematico: { select: { id: true, nombre: true, slug: true, color: true, activo: true } } } },
      },
      orderBy: { fechaCaptura: 'desc' },
    });

    const totalMenciones = menciones.length;
    const sentimientoResumen = calculateSentimiento(menciones);

    // ─── Ejes temáticos con conteos ───
    const ejesTematicos = await db.ejeTematico.findMany({
      where: { activo: true },
      orderBy: { orden: 'asc' },
      select: { id: true, nombre: true, slug: true, color: true, icono: true, descripcion: true },
    });

    const ejesCount: Record<string, { id: string; nombre: string; slug: string; color: string; count: number }> = {};
    for (const m of menciones) {
      if (m.ejesTematicos) {
        for (const mt of m.ejesTematicos) {
          const eje = mt.ejeTematico;
          if (eje && eje.activo) {
            if (!ejesCount[eje.slug]) {
              ejesCount[eje.slug] = { id: eje.id, nombre: eje.nombre, slug: eje.slug, color: eje.color, count: 0 };
            }
            ejesCount[eje.slug].count++;
          }
        }
      }
    }

    const ejesConMenciones = Object.values(ejesCount).sort((a, b) => b.count - a.count);
    const topEjes = ejesConMenciones.slice(0, 3);

    // Top actores y medios usando utils
    const topActores = calculateTopActores(menciones, 5)
      .map(p => ({ nombre: p.nombre, partidoSigla: p.partido, camara: p.camara, departamento: p.departamento, count: p.count }));

    return NextResponse.json({
      tipo,
      fecha,
      windowLabel,
      fechaInicio: fechaInicio.toISOString(),
      fechaFin: fechaFin.toISOString(),
      menciones: menciones.slice(0, 50).map(m => ({
        id: m.id,
        titulo: m.titulo,
        fechaCaptura: m.fechaCaptura,
        sentimiento: m.sentimiento,
        persona: m.persona ? { nombre: m.persona.nombre, partidoSigla: m.persona.partidoSigla } : null,
        medio: { nombre: m.medio?.nombre },
      })),
      ejesTematicos,
      ejesConMenciones,
      topActores,
      topEjes,
      totalMenciones,
      sentimientoResumen: {
        promedio: sentimientoResumen.promedio,
        label: sentimientoResumen.label,
        distribucion: sentimientoResumen.distribucion,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: 'Error al cargar datos del generador', details: message }, { status: 500 });
  }
}

// ═══ EL_FOCO Handler ═══
async function handleElFoco(fecha: string, ejeSlug: string) {
  const selectedDate = new Date(fecha + 'T12:00:00');
  const { fechaInicio, fechaFin, ventanaLabel: windowLabel } = calculateWindow('EL_FOCO', fecha);

  if (!ejeSlug) {
    // ─── Fase de selección ───
    const ejesTematicos = await db.ejeTematico.findMany({
      where: { activo: true },
      orderBy: { orden: 'asc' },
      select: { id: true, nombre: true, slug: true, color: true, icono: true, descripcion: true },
    });

    const mencionesAll = await db.mencion.findMany({
      where: { fechaCaptura: { gte: fechaInicio, lte: fechaFin } },
      include: { ejesTematicos: { include: { ejeTematico: { select: { id: true, slug: true, activo: true } } } } },
    });

    const ejesCount: Record<string, number> = {};
    for (const m of mencionesAll) {
      if (m.ejesTematicos) {
        for (const mt of m.ejesTematicos) {
          if (mt.ejeTematico && mt.ejeTematico.activo) {
            ejesCount[mt.ejeTematico.slug] = (ejesCount[mt.ejeTematico.slug] || 0) + 1;
          }
        }
      }
    }

    const ejesDisponibles = ejesTematicos.map(e => ({
      id: e.id, nombre: e.nombre, slug: e.slug, color: e.color, descripcion: e.descripcion, icono: e.icono,
      mencionesCount: ejesCount[e.slug] || 0,
    }));

    return NextResponse.json({
      tipo: 'EL_FOCO', fecha, windowLabel,
      fase: 'seleccion',
      totalMencionesDia: mencionesAll.length,
      ejesDisponibles,
    });
  }

  // ─── Fase de análisis ───
  const ejeTematico = await db.ejeTematico.findUnique({
    where: { slug: ejeSlug },
    select: { id: true, nombre: true, slug: true, color: true, icono: true, descripcion: true },
  });

  if (!ejeTematico) {
    return NextResponse.json({ error: `Eje tematico "${ejeSlug}" no encontrado` }, { status: 404 });
  }

  const menciones = await db.mencion.findMany({
    where: {
      fechaCaptura: { gte: fechaInicio, lte: fechaFin },
      ejesTematicos: { some: { ejeTematicoId: ejeTematico.id } },
    },
    include: {
      persona: { select: { id: true, nombre: true, partidoSigla: true, camara: true, departamento: true } },
      medio: { select: { id: true, nombre: true, tipo: true, nivel: true } },
      ejesTematicos: { include: { ejeTematico: { select: { id: true, nombre: true, slug: true, color: true } } } },
    },
    orderBy: { fechaCaptura: 'desc' },
  });

  const totalMenciones = menciones.length;
  const sentimientoResumen = calculateSentimiento(menciones);
  const topActores = calculateTopActores(menciones, 5)
    .map(p => ({ nombre: p.nombre, partidoSigla: p.partido, camara: p.camara, departamento: p.departamento, count: p.count }));

  // Medios distribución
  const mediosDistribucion = calculateTopMedios(menciones, 5)
    .map(m => ({ nombre: m.nombre, tipo: m.tipo, nivel: m.nivel, count: m.count }));

  // Sub-temas y evolución horaria
  const subTemas = calculateSubTemas(menciones, 10);
  const evolucionHoraria = calculateEvolucionHoraria(menciones, 6, 22);

  const mencionesPreview = menciones.slice(0, 20).map(m => ({
    id: m.id, titulo: m.titulo, fechaCaptura: m.fechaCaptura, sentimiento: m.sentimiento,
    persona: m.persona ? { nombre: m.persona.nombre, partidoSigla: m.persona.partidoSigla } : null,
    medio: { nombre: m.medio?.nombre },
  }));

  return NextResponse.json({
    tipo: 'EL_FOCO', fecha, windowLabel,
    fase: 'analisis',
    ejeSeleccionado: { id: ejeTematico.id, nombre: ejeTematico.nombre, slug: ejeTematico.slug, color: ejeTematico.color, descripcion: ejeTematico.descripcion },
    totalMenciones,
    sentimientoResumen: { promedio: sentimientoResumen.promedio, label: sentimientoResumen.label, distribucion: sentimientoResumen.distribucion },
    topActores,
    mediosDistribucion,
    subTemas,
    evolucionHoraria,
    mencionesPreview,
  });
}

// ═══ EL_RADAR Handler ═══
async function handleElRadar(fecha: string) {
  const { fechaInicio, fechaFin, ventanaLabel: windowLabel } = calculateWindow('EL_RADAR', fecha);

  const menciones = await db.mencion.findMany({
    where: { fechaCaptura: { gte: fechaInicio, lte: fechaFin } },
    include: {
      persona: { select: { id: true, nombre: true, partidoSigla: true, camara: true, departamento: true } },
      medio: { select: { id: true, nombre: true, tipo: true, nivel: true } },
      ejesTematicos: { include: { ejeTematico: { select: { id: true, nombre: true, slug: true, color: true, activo: true } } } },
    },
    orderBy: { fechaCaptura: 'desc' },
  });

  const totalMenciones = menciones.length;

  // Ejes temáticos con datos de radar
  const ejesTematicos = await db.ejeTematico.findMany({
    where: { activo: true },
    orderBy: { orden: 'asc' },
    select: { id: true, nombre: true, slug: true, color: true, icono: true, descripcion: true },
  });

  // Midpoint para calcular tendencia
  const midPoint = new Date(fechaInicio);
  midPoint.setDate(midPoint.getDate() + 3);
  midPoint.setHours(12, 0, 0, 0);

  const radarEjes = [];

  for (const eje of ejesTematicos) {
    const mencionesEje = menciones.filter(m =>
      m.ejesTematicos?.some(mt => mt.ejeTematico?.id === eje.id && mt.ejeTematico?.activo)
    );

    const sentimientoEje = calculateSentimiento(mencionesEje);
    const actoresEje = calculateTopActores(mencionesEje, 1);

    // Tendencia: comparar primera vs segunda mitad
    const mencPrimeraMitad = mencionesEje.filter(m => new Date(m.fechaCaptura) <= midPoint).length;
    const mencSegundaMitad = mencionesEje.filter(m => new Date(m.fechaCaptura) > midPoint).length;

    let tendencia: 'ascendente' | 'estable' | 'descendente' = 'estable';
    if (mencSegundaMitad > mencPrimeraMitad * 1.3) tendencia = 'ascendente';
    else if (mencSegundaMitad < mencPrimeraMitad * 0.7) tendencia = 'descendente';

    // Hallazgo contextual
    let hallazgo = '';
    if (mencionesEje.length === 0) {
      hallazgo = 'Sin actividad en la semana';
    } else if (sentimientoEje.promedio >= 4) {
      hallazgo = `Cobertura favorable con ${mencionesEje.length} menciones`;
    } else if (sentimientoEje.promedio <= 2.5) {
      hallazgo = `Cobertura critica: ${mencionesEje.length} menciones con tono negativo predominante`;
    } else if (mencionesEje.length >= 10) {
      hallazgo = `Alta actividad: ${mencionesEje.length} menciones en la semana`;
    } else {
      hallazgo = `${mencionesEje.length} menciones con cobertura equilibrada`;
    }
    if (tendencia === 'ascendente' && mencionesEje.length > 0) {
      hallazgo += '. Tendencia ascendente en la segunda mitad de la semana';
    } else if (tendencia === 'descendente' && mencionesEje.length > 0) {
      hallazgo += '. Tendencia descendente hacia el cierre de la semana';
    }

    radarEjes.push({
      id: eje.id,
      nombre: eje.nombre,
      slug: eje.slug,
      color: eje.color,
      descripcion: eje.descripcion || '',
      menciones: mencionesEje.length,
      sentimientoProm: Math.round(sentimientoEje.promedio * 10) / 10,
      sentimientoLabel: sentimientoEje.label,
      topActor: actoresEje.length > 0 ? actoresEje[0].nombre : null,
      hallazgo,
      tendencia,
    });
  }

  radarEjes.sort((a, b) => b.menciones - a.menciones);

  // Sentimiento global
  const sentimientoGlobal = calculateSentimiento(menciones);

  // Top actores de la semana con ejes
  const actoresSemana: Record<string, { nombre: string; partidoSigla: string; camara: string; count: number; ejes: Set<string> }> = {};
  for (const m of menciones) {
    if (m.persona) {
      const pKey = m.persona.id;
      if (!actoresSemana[pKey]) {
        actoresSemana[pKey] = { nombre: m.persona.nombre, partidoSigla: m.persona.partidoSigla, camara: m.persona.camara, count: 0, ejes: new Set() };
      }
      actoresSemana[pKey].count++;
      if (m.ejesTematicos) {
        for (const mt of m.ejesTematicos) {
          if (mt.ejeTematico?.activo) actoresSemana[pKey].ejes.add(mt.ejeTematico.slug);
        }
      }
    }
  }

  const topActores = Object.values(actoresSemana)
    .sort((a, b) => b.count - a.count)
    .slice(0, 7)
    .map(a => ({ nombre: a.nombre, partidoSigla: a.partidoSigla, camara: a.camara, count: a.count, ejesPrincipales: Array.from(a.ejes).slice(0, 3) }));

  // Evolución diaria
  const evolucionDiaria: Array<{ fecha: string; dia: string; count: number }> = [];
  for (let d = 0; d < 7; d++) {
    const dayStart = new Date(fechaInicio);
    dayStart.setDate(dayStart.getDate() + d);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setHours(23, 59, 59, 999);

    evolucionDiaria.push({
      fecha: dayStart.toISOString().slice(0, 10),
      dia: dayStart.toLocaleDateString('es-BO', { weekday: 'short' }).slice(0, 3),
      count: menciones.filter(m => m.fechaCaptura >= dayStart && m.fechaCaptura <= dayEnd).length,
    });
  }

  // Preview menciones
  const mencionesPreview = menciones.slice(0, 15).map(m => ({
    id: m.id, titulo: m.titulo, fechaCaptura: m.fechaCaptura, sentimiento: m.sentimiento,
    persona: m.persona ? { nombre: m.persona.nombre, partidoSigla: m.persona.partidoSigla } : null,
    medio: { nombre: m.medio?.nombre },
    ejes: m.ejesTematicos?.filter(mt => mt.ejeTematico?.activo).map(mt => ({ nombre: mt.ejeTematico.nombre, color: mt.ejeTematico.color })) || [],
  }));

  // Hallazgo clave de la semana
  const ejeDominante = radarEjes[0];
  const ejeMasCritico = [...radarEjes].sort((a, b) => a.sentimientoProm - b.sentimientoProm)[0];
  const totalEjesActivos = radarEjes.filter(e => e.menciones > 0).length;

  let hallazgoClave = '';
  if (ejeDominante && ejeDominante.menciones > 0) {
    hallazgoClave = `El eje "${ejeDominante.nombre}" domina la semana con ${ejeDominante.menciones} menciones.`;
  }
  if (ejeMasCritico && ejeMasCritico.menciones > 0 && ejeMasCritico.sentimientoProm < 2.5 && ejeMasCritico.slug !== ejeDominante?.slug) {
    hallazgoClave += ` "${ejeMasCritico.nombre}" registra el clima mas critico.`;
  }
  if (totalEjesActivos <= 3) {
    hallazgoClave += ` Solo ${totalEjesActivos} de ${ejesTematicos.length} ejes con actividad.`;
  } else if (totalEjesActivos >= 9) {
    hallazgoClave += ` Alta dispersion tematica: ${totalEjesActivos} ejes activos.`;
  }

  return NextResponse.json({
    tipo: 'EL_RADAR',
    fecha,
    windowLabel,
    fechaInicio: fechaInicio.toISOString(),
    fechaFin: fechaFin.toISOString(),
    totalMenciones,
    totalEjesActivos,
    hallazgoClave: hallazgoClave || 'Semana sin actividad registrada',
    sentimientoGlobal: {
      promedio: Math.round(sentimientoGlobal.promedio * 10) / 10,
      label: sentimientoGlobal.label,
      distribucion: sentimientoGlobal.distribucion,
    },
    radarEjes,
    topActores,
    evolucionDiaria,
    mencionesPreview,
  });
}
