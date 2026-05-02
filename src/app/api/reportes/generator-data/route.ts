import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tipo = searchParams.get('tipo') || '';
    const fecha = searchParams.get('fecha') || new Date().toISOString().slice(0, 10);
    const ejeSlug = searchParams.get('ejeSlug') || '';

    if (!tipo || !['EL_TERMOMETRO', 'SALDO_DEL_DIA', 'EL_FOCO', 'EL_RADAR'].includes(tipo)) {
      return NextResponse.json({ error: 'tipo inválido. Use EL_TERMOMETRO, SALDO_DEL_DIA, EL_FOCO o EL_RADAR' }, { status: 400 });
    }

    // Parsear fecha seleccionada
    const [year, month, day] = fecha.split('-').map(Number);
    const selectedDate = new Date(year, month - 1, day);

    // ═══ EL_FOCO: rama dedicada ═══
    if (tipo === 'EL_FOCO') {
      return handleElFoco(selectedDate, fecha, ejeSlug);
    }

    // ═══ EL_RADAR: rama dedicada ═══
    if (tipo === 'EL_RADAR') {
      return handleElRadar(selectedDate, fecha);
    }

    // Calcular ventanas de tiempo según tipo de producto
    let fechaInicio: Date;
    let fechaFin: Date;
    let windowLabel: string;

    if (tipo === 'EL_TERMOMETRO') {
      // Ventana nocturna: 19:00 del día anterior a 07:00 del día seleccionado
      fechaFin = new Date(selectedDate);
      fechaFin.setHours(7, 0, 0, 0);

      fechaInicio = new Date(selectedDate);
      fechaInicio.setDate(fechaInicio.getDate() - 1);
      fechaInicio.setHours(19, 0, 0, 0);

      windowLabel = `${fechaInicio.toLocaleDateString('es-BO', { day: '2-digit', month: 'short' })} 19:00 — ${fechaFin.toLocaleDateString('es-BO', { day: '2-digit', month: 'short' })} 07:00`;
    } else {
      // SALDO_DEL_DIA: Ventana diurna: 07:00 a 19:00 del día seleccionado
      fechaInicio = new Date(selectedDate);
      fechaInicio.setHours(7, 0, 0, 0);

      fechaFin = new Date(selectedDate);
      fechaFin.setHours(19, 0, 0, 0);

      windowLabel = `${fechaInicio.toLocaleDateString('es-BO', { day: '2-digit', month: 'short' })} 07:00 — 19:00`;
    }

    // Consultar menciones en la ventana de tiempo
    const menciones = await db.mencion.findMany({
      where: {
        fechaCaptura: { gte: fechaInicio, lte: fechaFin },
      },
      include: {
        persona: { select: { id: true, nombre: true, partidoSigla: true, camara: true, departamento: true } },
        medio: { select: { nombre: true, tipo: true, nivel: true } },
        ejesTematicos: { include: { ejeTematico: { select: { id: true, nombre: true, slug: true, color: true, activo: true } } } },
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
    const sentimientoLabel =
      sentimientoPromedio >= 4 ? 'positivo' :
      sentimientoPromedio >= 3 ? 'neutral' : 'negativo';

    // ─── Ejes temáticos activos ───
    const ejesTematicos = await db.ejeTematico.findMany({
      where: { activo: true },
      orderBy: { orden: 'asc' },
      select: { id: true, nombre: true, slug: true, color: true, icono: true, descripcion: true },
    });

    // Contar menciones por eje temático
    const ejesCount: Record<string, { id: string; nombre: string; slug: string; color: string; count: number }> = {};
    for (const m of menciones) {
      if (m.ejesTematicos) {
        for (const mt of m.ejesTematicos) {
          const eje = mt.ejeTematico;
          if (eje && eje.activo) {
            if (!ejesCount[eje.slug]) {
              ejesCount[eje.slug] = {
                id: eje.id,
                nombre: eje.nombre,
                slug: eje.slug,
                color: eje.color,
                count: 0,
              };
            }
            ejesCount[eje.slug].count++;
          }
        }
      }
    }

    const ejesConMenciones = Object.values(ejesCount).sort((a, b) => b.count - a.count);
    const topEjes = ejesConMenciones.slice(0, 3);

    // ─── Top actores ───
    const actoresCount: Record<string, { nombre: string; partidoSigla: string; camara: string; departamento: string; count: number }> = {};
    for (const m of menciones) {
      if (m.persona) {
        const pKey = m.persona.id;
        if (!actoresCount[pKey]) {
          actoresCount[pKey] = {
            nombre: m.persona.nombre,
            partidoSigla: m.persona.partidoSigla,
            camara: m.persona.camara,
            departamento: m.persona.departamento,
            count: 0,
          };
        }
        actoresCount[pKey].count++;
      }
    }

    const topActores = Object.values(actoresCount)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map(p => ({ nombre: p.nombre, partidoSigla: p.partidoSigla, camara: p.camara, departamento: p.departamento, count: p.count }));

    // ─── Resumen de sentimiento ───
    const sentimientoResumen: { promedio: number; label: string; distribucion: Record<string, number> } = {
      promedio: sentimientoPromedio,
      label: sentimientoLabel,
      distribucion: sentimientoDistribucion,
    };

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
      ejesConMenciones: ejesConMenciones,
      topActores,
      topEjes,
      totalMenciones,
      sentimientoResumen,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: 'Error al cargar datos del generador', details: message }, { status: 500 });
  }
}

// ═══ EL_FOCO Handler ═══
async function handleElFoco(selectedDate: Date, fecha: string, ejeSlug: string) {
  // Ventana: día completo 00:00 a 23:59
  const fechaInicio = new Date(selectedDate);
  fechaInicio.setHours(0, 0, 0, 0);

  const fechaFin = new Date(selectedDate);
  fechaFin.setHours(23, 59, 59, 999);

  const windowLabel = selectedDate.toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' }) + ' (día completo)';

  // Si no se proporciona ejeSlug → devolver lista de ejes disponibles con conteos
  if (!ejeSlug) {
    const ejesTematicos = await db.ejeTematico.findMany({
      where: { activo: true },
      orderBy: { orden: 'asc' },
      select: { id: true, nombre: true, slug: true, color: true, icono: true, descripcion: true },
    });

    // Contar menciones por eje en la ventana de tiempo
    const mencionesAll = await db.mencion.findMany({
      where: {
        fechaCaptura: { gte: fechaInicio, lte: fechaFin },
      },
      include: {
        ejesTematicos: { include: { ejeTematico: { select: { id: true, slug: true, activo: true } } } },
      },
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
      id: e.id,
      nombre: e.nombre,
      slug: e.slug,
      color: e.color,
      descripcion: e.descripcion,
      icono: e.icono,
      mencionesCount: ejesCount[e.slug] || 0,
    }));

    return NextResponse.json({
      tipo: 'EL_FOCO',
      fecha,
      windowLabel,
      fase: 'seleccion',
      totalMencionesDia: mencionesAll.length,
      ejesDisponibles,
    });
  }

  // Si ejeSlug proporcionado → deep analysis
  const ejeTematico = await db.ejeTematico.findUnique({
    where: { slug: ejeSlug },
    select: { id: true, nombre: true, slug: true, color: true, icono: true, descripcion: true },
  });

  if (!ejeTematico) {
    return NextResponse.json({ error: `Eje temático "${ejeSlug}" no encontrado` }, { status: 404 });
  }

  // Consultar menciones vinculadas a este eje
  const menciones = await db.mencion.findMany({
    where: {
      fechaCaptura: { gte: fechaInicio, lte: fechaFin },
      ejesTematicos: {
        some: { ejeTematicoId: ejeTematico.id },
      },
    },
    include: {
      persona: { select: { id: true, nombre: true, partidoSigla: true, camara: true, departamento: true } },
      medio: { select: { id: true, nombre: true, tipo: true, nivel: true } },
      ejesTematicos: { include: { ejeTematico: { select: { id: true, nombre: true, slug: true, color: true } } } },
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
  const sentimientoLabel =
    sentimientoPromedio >= 4 ? 'positivo' :
    sentimientoPromedio >= 3 ? 'neutral' : 'negativo';

  // ─── Top actores dentro del eje ───
  const actoresCount: Record<string, { nombre: string; partidoSigla: string; camara: string; departamento: string; count: number }> = {};
  for (const m of menciones) {
    if (m.persona) {
      const pKey = m.persona.id;
      if (!actoresCount[pKey]) {
        actoresCount[pKey] = {
          nombre: m.persona.nombre,
          partidoSigla: m.persona.partidoSigla,
          camara: m.persona.camara,
          departamento: m.persona.departamento,
          count: 0,
        };
      }
      actoresCount[pKey].count++;
    }
  }

  const topActores = Object.values(actoresCount)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map(p => ({ nombre: p.nombre, partidoSigla: p.partidoSigla, camara: p.camara, departamento: p.departamento, count: p.count }));

  // ─── Distribución por medio ───
  const mediosCount: Record<string, { nombre: string; tipo: string; nivel: string; count: number }> = {};
  for (const m of menciones) {
    if (m.medio) {
      const mKey = m.medio.id;
      if (!mediosCount[mKey]) {
        mediosCount[mKey] = {
          nombre: m.medio.nombre,
          tipo: m.medio.tipo,
          nivel: m.medio.nivel,
          count: 0,
        };
      }
      mediosCount[mKey].count++;
    }
  }

  const mediosDistribucion = Object.values(mediosCount)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // ─── Sub-temas: extraer de mencion.temas ───
  const subTemasCount: Record<string, number> = {};
  for (const m of menciones) {
    if (m.temas) {
      const tags = m.temas.split(',').map(t => t.trim()).filter(Boolean);
      for (const tag of tags) {
        const lower = tag.toLowerCase();
        subTemasCount[lower] = (subTemasCount[lower] || 0) + 1;
      }
    }
  }

  const subTemas = Object.entries(subTemasCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([tema, count]) => ({ tema, count }));

  // ─── Evolución horaria ───
  const evolucionHoraria: Array<{ hora: number; count: number }> = [];
  for (let h = 0; h < 24; h++) {
    evolucionHoraria.push({ hora: h, count: 0 });
  }
  for (const m of menciones) {
    if (m.fechaCaptura) {
      const hour = new Date(m.fechaCaptura).getHours();
      evolucionHoraria[hour].count++;
    }
  }
  // Solo incluir horas con actividad o un rango reducido (6:00–22:00)
  const evolucionFiltrada = evolucionHoraria.filter(e => e.hora >= 6 && e.hora <= 22);

  // ─── Menciones preview ───
  const mencionesPreview = menciones.slice(0, 20).map(m => ({
    id: m.id,
    titulo: m.titulo,
    fechaCaptura: m.fechaCaptura,
    sentimiento: m.sentimiento,
    persona: m.persona ? { nombre: m.persona.nombre, partidoSigla: m.persona.partidoSigla } : null,
    medio: { nombre: m.medio?.nombre },
  }));

  return NextResponse.json({
    tipo: 'EL_FOCO',
    fecha,
    windowLabel,
    fase: 'analisis',
    ejeSeleccionado: {
      id: ejeTematico.id,
      nombre: ejeTematico.nombre,
      slug: ejeTematico.slug,
      color: ejeTematico.color,
      descripcion: ejeTematico.descripcion,
    },
    totalMenciones,
    sentimientoResumen: {
      promedio: sentimientoPromedio,
      label: sentimientoLabel,
      distribucion: sentimientoDistribucion,
    },
    topActores,
    mediosDistribucion,
    subTemas,
    evolucionHoraria: evolucionFiltrada,
    mencionesPreview,
  });
}

// ═══ EL_RADAR Handler ═══
async function handleElRadar(selectedDate: Date, fecha: string) {
  // Ventana: semana completa (lunes 00:00 → domingo 23:59)
  // Calcular el lunes de la semana de la fecha seleccionada
  const dayOfWeek = selectedDate.getDay(); // 0=dom, 1=lun...
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  const fechaInicio = new Date(selectedDate);
  fechaInicio.setDate(fechaInicio.getDate() + mondayOffset);
  fechaInicio.setHours(0, 0, 0, 0);

  const fechaFin = new Date(fechaInicio);
  fechaFin.setDate(fechaFin.getDate() + 6);
  fechaFin.setHours(23, 59, 59, 999);

  const fmt = (d: Date) => d.toLocaleDateString('es-BO', { day: '2-digit', month: 'short' });
  const windowLabel = `Semana: ${fmt(fechaInicio)} — ${fmt(fechaFin)}`;

  // Consultar todas las menciones de la semana
  const menciones = await db.mencion.findMany({
    where: {
      fechaCaptura: { gte: fechaInicio, lte: fechaFin },
    },
    include: {
      persona: { select: { id: true, nombre: true, partidoSigla: true, camara: true, departamento: true } },
      medio: { select: { id: true, nombre: true, tipo: true, nivel: true } },
      ejesTematicos: { include: { ejeTematico: { select: { id: true, nombre: true, slug: true, color: true, activo: true } } } },
    },
    orderBy: { fechaCaptura: 'desc' },
  });

  const totalMenciones = menciones.length;

  // ─── Ejes temáticos con radar data ───
  const ejesTematicos = await db.ejeTematico.findMany({
    where: { activo: true },
    orderBy: { orden: 'asc' },
    select: { id: true, nombre: true, slug: true, color: true, icono: true, descripcion: true },
  });

  const sentimientoMap: Record<string, number> = {
    elogioso: 5, positivo: 4, neutral: 3, negativo: 2, critico: 1, no_clasificado: 3,
  };

  // Radar por eje: conteo + sentimiento promedio + top actor
  const radarEjes: Array<{
    id: string; nombre: string; slug: string; color: string; descripcion: string;
    menciones: number;
    sentimientoProm: number;
    sentimientoLabel: string;
    topActor: string | null;
    hallazgo: string;
    tendencia: 'ascendente' | 'estable' | 'descendente';
  }> = [];

  for (const eje of ejesTematicos) {
    const mencionesEje = menciones.filter(m =>
      m.ejesTematicos?.some(mt => mt.ejeTematico?.id === eje.id && mt.ejeTematico?.activo)
    );

    let sentSum = 0;
    const actoresMap: Record<string, number> = {};

    for (const m of mencionesEje) {
      sentSum += sentimientoMap[m.sentimiento] || 3;
      if (m.persona) {
        actoresMap[m.persona.nombre] = (actoresMap[m.persona.nombre] || 0) + 1;
      }
    }

    const sentProm = mencionesEje.length > 0 ? sentSum / mencionesEje.length : 0;
    const sentLabel = sentProm >= 4 ? 'positivo' : sentProm >= 3 ? 'neutral' : 'negativo';
    const sortedActores = Object.entries(actoresMap).sort(([, a], [, b]) => b - a);
    const topActor = sortedActores.length > 0 ? sortedActores[0][0] : null;

    // Tendencia: comparar primera mitad vs segunda mitad de la semana
    const midPoint = new Date(fechaInicio);
    midPoint.setDate(midPoint.getDate() + 3);
    midPoint.setHours(12, 0, 0, 0);

    const mencPrimeraMitad = mencionesEje.filter(m => new Date(m.fechaCaptura) <= midPoint).length;
    const mencSegundaMitad = mencionesEje.filter(m => new Date(m.fechaCaptura) > midPoint).length;

    let tendencia: 'ascendente' | 'estable' | 'descendente' = 'estable';
    if (mencSegundaMitad > mencPrimeraMitad * 1.3) tendencia = 'ascendente';
    else if (mencSegundaMitad < mencPrimeraMitad * 0.7) tendencia = 'descendente';

    // Hallazgo clave contextual
    let hallazgo = '';
    if (mencionesEje.length === 0) {
      hallazgo = 'Sin actividad en la semana';
    } else if (sentProm >= 4) {
      hallazgo = `Cobertura favorable con ${mencionesEje.length} menciones`;
    } else if (sentProm <= 2.5) {
      hallazgo = `Cobertura crítica: ${mencionesEje.length} menciones con tono negativo predominante`;
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
      sentimientoProm: Math.round(sentProm * 10) / 10,
      sentimientoLabel: sentLabel,
      topActor,
      hallazgo,
      tendencia,
    });
  }

  // Ordenar por menciones (más activos primero)
  radarEjes.sort((a, b) => b.menciones - a.menciones);

  // ─── Sentimiento global de la semana ───
  let sentimientoGlobalSum = 0;
  let sentimientoGlobalCount = 0;
  const sentimientoGlobalDist: Record<string, number> = {};

  for (const m of menciones) {
    const sentVal = sentimientoMap[m.sentimiento] || 3;
    sentimientoGlobalSum += sentVal;
    sentimientoGlobalCount++;
    const sentKey = m.sentimiento || 'no_clasificado';
    sentimientoGlobalDist[sentKey] = (sentimientoGlobalDist[sentKey] || 0) + 1;
  }

  const sentimientoGlobalProm = sentimientoGlobalCount > 0 ? sentimientoGlobalSum / sentimientoGlobalCount : 0;
  const sentimientoGlobalLabel =
    sentimientoGlobalProm >= 4 ? 'positivo' :
    sentimientoGlobalProm >= 3 ? 'neutral' : 'negativo';

  // ─── Top 5 actores de la semana ───
  const actoresSemana: Record<string, { nombre: string; partidoSigla: string; camara: string; count: number; ejes: Set<string> }> = {};
  for (const m of menciones) {
    if (m.persona) {
      const pKey = m.persona.id;
      if (!actoresSemana[pKey]) {
        actoresSemana[pKey] = {
          nombre: m.persona.nombre,
          partidoSigla: m.persona.partidoSigla,
          camara: m.persona.camara,
          count: 0,
          ejes: new Set<string>(),
        };
      }
      actoresSemana[pKey].count++;
      if (m.ejesTematicos) {
        for (const mt of m.ejesTematicos) {
          if (mt.ejeTematico?.activo) {
            actoresSemana[pKey].ejes.add(mt.ejeTematico.slug);
          }
        }
      }
    }
  }

  const topActores = Object.values(actoresSemana)
    .sort((a, b) => b.count - a.count)
    .slice(0, 7)
    .map(a => ({
      nombre: a.nombre,
      partidoSigla: a.partidoSigla,
      camara: a.camara,
      count: a.count,
      ejesPrincipales: Array.from(a.ejes).slice(0, 3),
    }));

  // ─── Evolución diaria (7 días) ───
  const evolucionDiaria: Array<{ fecha: string; dia: string; count: number }> = [];
  for (let d = 0; d < 7; d++) {
    const dayStart = new Date(fechaInicio);
    dayStart.setDate(dayStart.getDate() + d);
    dayStart.setHours(0, 0, 0, 0);

    const dayEnd = new Date(dayStart);
    dayEnd.setHours(23, 59, 59, 999);

    const dayCount = menciones.filter(m =>
      m.fechaCaptura >= dayStart && m.fechaCaptura <= dayEnd
    ).length;

    evolucionDiaria.push({
      fecha: dayStart.toISOString().slice(0, 10),
      dia: dayStart.toLocaleDateString('es-BO', { weekday: 'short' }).slice(0, 3),
      count: dayCount,
    });
  }

  // ─── Menciones preview (últimas 15) ───
  const mencionesPreview = menciones.slice(0, 15).map(m => ({
    id: m.id,
    titulo: m.titulo,
    fechaCaptura: m.fechaCaptura,
    sentimiento: m.sentimiento,
    persona: m.persona ? { nombre: m.persona.nombre, partidoSigla: m.persona.partidoSigla } : null,
    medio: { nombre: m.medio?.nombre },
    ejes: m.ejesTematicos
      ?.filter(mt => mt.ejeTematico?.activo)
      .map(mt => ({ nombre: mt.ejeTematico.nombre, color: mt.ejeTematico.color })) || [],
  }));

  // ─── Hallazgo clave de la semana ───
  const ejeDominante = radarEjes[0];
  const ejeMasCritico = [...radarEjes].sort((a, b) => a.sentimientoProm - b.sentimientoProm)[0];
  const totalEjesActivos = radarEjes.filter(e => e.menciones > 0).length;

  let hallazgoClave = '';
  if (ejeDominante && ejeDominante.menciones > 0) {
    hallazgoClave = `El eje "${ejeDominante.nombre}" domina la semana con ${ejeDominante.menciones} menciones.`;
  }
  if (ejeMasCritico && ejeMasCritico.menciones > 0 && ejeMasCritico.sentimientoProm < 2.5 && ejeMasCritico.slug !== ejeDominante?.slug) {
    hallazgoClave += ` "${ejeMasCritico.nombre}" registra el clima más crítico.`;
  }
  if (totalEjesActivos <= 3) {
    hallazgoClave += ` Solo ${totalEjesActivos} de 11 ejes con actividad.`;
  } else if (totalEjesActivos >= 9) {
    hallazgoClave += ` Alta dispersión temática: ${totalEjesActivos} ejes activos.`;
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
      promedio: Math.round(sentimientoGlobalProm * 10) / 10,
      label: sentimientoGlobalLabel,
      distribucion: sentimientoGlobalDist,
    },
    radarEjes,
    topActores,
    evolucionDiaria,
    mencionesPreview,
  });
}
