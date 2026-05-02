import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tipo = searchParams.get('tipo') || '';
    const fecha = searchParams.get('fecha') || new Date().toISOString().slice(0, 10);
    const ejeSlug = searchParams.get('ejeSlug') || '';

    if (!tipo || !['EL_TERMOMETRO', 'SALDO_DEL_DIA', 'EL_FOCO'].includes(tipo)) {
      return NextResponse.json({ error: 'tipo inválido. Use EL_TERMOMETRO, SALDO_DEL_DIA o EL_FOCO' }, { status: 400 });
    }

    // Parsear fecha seleccionada
    const [year, month, day] = fecha.split('-').map(Number);
    const selectedDate = new Date(year, month - 1, day);

    // ═══ EL_FOCO: rama dedicada ═══
    if (tipo === 'EL_FOCO') {
      return handleElFoco(selectedDate, fecha, ejeSlug);
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
