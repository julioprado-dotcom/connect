import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { safeError } from '@/lib/rate-guard';
import { scrapingState } from '@/lib/scraping-state';

export async function GET() {
  try {
    // ─── Parallel Phase 1: Counts independientes ───
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const manana = new Date(hoy);
    manana.setDate(manana.getDate() + 1);

    const inicioSemana = new Date();
    inicioSemana.setDate(inicioSemana.getDate() - inicioSemana.getDay() + 1);
    inicioSemana.setHours(0, 0, 0, 0);

    const [
      totalPersonas,
      fuentesActivas,
      mencionesHoy,
      mencionesSemana,
      totalReportes,
      enlacesRotos,
      totalComentarios,
      totalEjes,
      clientesActivos,
      contratosVigentes,
      entregasHoy,
      diputados,
      senadores,
      alertasNegativas,
      alertasPositivas,
      alertasNeutras,
      ultimaAlerta,
    ] = await Promise.all([
      db.persona.count({ where: { activa: true } }),
      // Fuentes en monitoreo activo: solo si hay fase activa
      scrapingState.faseActual > 0 ? scrapingState.scrapeFuentes.length : 0,
      db.mencion.count({ where: { fechaCaptura: { gte: hoy, lt: manana } } }),
      db.mencion.count({ where: { fechaCaptura: { gte: inicioSemana } } }),
      db.reporte.count(),
      db.mencion.count({ where: { enlaceActivo: false } }),
      db.comentario.count(),
      db.ejeTematico.count({ where: { activo: true } }),
      db.cliente.count({ where: { estado: 'activo' } }),
      db.contrato.count({ where: { estado: 'activo' } }),
      db.entrega.count({ where: { estado: 'enviado', fechaEnvio: { gte: hoy, lt: manana } } }),
      db.persona.count({ where: { camara: 'Diputados', activa: true } }),
      db.persona.count({ where: { camara: 'Senadores', activa: true } }),
      db.reporte.count({ where: { tipo: 'ALERTA_TEMPRANA', sentimientoComentarios: { contains: 'negativo' }, fechaCreacion: { gte: hoy } } }),
      db.reporte.count({ where: { tipo: 'ALERTA_TEMPRANA', sentimientoComentarios: { contains: 'positivo' }, fechaCreacion: { gte: hoy } } }),
      db.reporte.count({ where: { tipo: 'ALERTA_TEMPRANA', fechaCreacion: { gte: hoy }, NOT: [{ sentimientoComentarios: { contains: 'positivo' } }, { sentimientoComentarios: { contains: 'negativo' } }] } }),
      db.reporte.findFirst({ where: { tipo: 'ALERTA_TEMPRANA' }, orderBy: { fechaCreacion: 'desc' }, select: { id: true, fechaCreacion: true, resumen: true, sentimientoComentarios: true } }),
    ]);

    // ─── Parallel Phase 2: Datos dependientes ───

    // Top 10 actores con groupBy (1 query) + datos de persona en batch (1 query)
    const topActoresGrouped = await db.mencion.groupBy({
      by: ['personaId'],
      where: { fechaCaptura: { gte: inicioSemana } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });

    const personaIds = topActoresGrouped
      .map(a => a.personaId)
      .filter((id): id is string => id !== null);

    // 1 query: todas las personas de una vez
    const personasBatch = personaIds.length > 0
      ? await db.persona.findMany({
          where: { id: { in: personaIds } },
          select: { id: true, nombre: true, partidoSigla: true, camara: true, departamento: true },
        })
      : [];
    const personaMap = new Map(personasBatch.map(p => [p.id, p]));

    // 1 query: todas las menciones de estos actores esta semana
    const mencionesActores = personaIds.length > 0
      ? await db.mencion.findMany({
          where: { personaId: { in: personaIds }, fechaCaptura: { gte: inicioSemana } },
          select: { personaId: true, sentimiento: true, temas: true },
        })
      : [];

    // 1 query: todos los ejes temáticos de estas menciones
    const ejesMenciones = personaIds.length > 0
      ? await db.mencionTema.findMany({
          where: { mencion: { personaId: { in: personaIds }, fechaCaptura: { gte: inicioSemana } } },
          include: {
            ejeTematico: { select: { id: true, nombre: true, slug: true, color: true } },
            mencion: { select: { personaId: true } },
          },
        })
      : [];

    // ─── Process topActors en memoria (0 queries extra) ───
    const actorMencionesMap = new Map<string, typeof mencionesActores>();
    for (const m of mencionesActores) {
      if (!m.personaId) continue; // Skip thematic mentions (no persona)
      const list = actorMencionesMap.get(m.personaId) || [];
      list.push(m);
      actorMencionesMap.set(m.personaId, list);
    }

    const actorEjesMap = new Map<string, typeof ejesMenciones>();
    for (const em of ejesMenciones) {
      const pid = em.mencion.personaId;
      if (!pid) continue; // Skip thematic mentions
      const list = actorEjesMap.get(pid) || [];
      list.push(em);
      actorEjesMap.set(pid, list);
    }

    const topActoresData = topActoresGrouped
      .filter(item => item.personaId !== null)
      .map((item) => {
      const persona = personaMap.get(item.personaId!);
      if (!persona) return null;

      const menciones = actorMencionesMap.get(item.personaId!) || [];
      const sentimientoCount: Record<string, number> = {};
      const temasCount: Record<string, number> = {};

      for (const m of menciones) {
        const s = m.sentimiento || 'no_clasificado';
        sentimientoCount[s] = (sentimientoCount[s] || 0) + 1;
        if (m.temas) {
          for (const t of m.temas.split(',').map(x => x.trim()).filter(Boolean)) {
            temasCount[t] = (temasCount[t] || 0) + 1;
          }
        }
      }

      const sentimientoTop = Object.entries(sentimientoCount)
        .sort(([, a], [, b]) => b - a)[0] || ['no_clasificado', 0];
      const temasTop = Object.entries(temasCount)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([tema, count]) => ({ tema, count }));

      const ejes = actorEjesMap.get(item.personaId!) || [];
      const ejesCountMap: Record<string, { nombre: string; slug: string; color: string; count: number }> = {};
      for (const em of ejes) {
        const key = em.ejeTematico.id;
        if (!ejesCountMap[key]) {
          ejesCountMap[key] = { nombre: em.ejeTematico.nombre, slug: em.ejeTematico.slug, color: em.ejeTematico.color, count: 0 };
        }
        ejesCountMap[key].count++;
      }
      const ejesTop = Object.values(ejesCountMap)
        .sort((a, b) => b.count - a.count)
        .slice(0, 4);

      return {
        ...persona,
        mencionesCount: item._count.id,
        sentimiento: {
          dominante: sentimientoTop[0],
          distribucion: sentimientoCount,
        },
        ejesTematicos: ejesTop,
        temasEspecificos: temasTop,
      };
    }).filter(Boolean);

    // ─── Menciones por partido (groupBy personaId → 1 query compacta) ───
    const mppGrouped = await db.mencion.groupBy({
      by: ['personaId'],
      where: { fechaCaptura: { gte: inicioSemana }, personaId: { not: null } },
      _count: { id: true },
    });

    const mppPersonaIds = mppGrouped.map(g => g.personaId).filter((id): id is string => id !== null);
    const mppPersonas = mppPersonaIds.length > 0
      ? await db.persona.findMany({
          where: { id: { in: mppPersonaIds } },
          select: { id: true, partidoSigla: true },
        })
      : [];
    const mppPersonaMap = new Map(mppPersonas.map(p => [p.id, p.partidoSigla]));

    const partidoCount: Record<string, number> = {};
    for (const g of mppGrouped) {
      if (!g.personaId) continue;
      const sigla = mppPersonaMap.get(g.personaId) || 'Sin partido';
      partidoCount[sigla] = (partidoCount[sigla] || 0) + g._count.id;
    }
    const mencionesPorPartido = Object.entries(partidoCount)
      .map(([partido, count]) => ({ partido, count }))
      .sort((a, b) => b.count - a.count);

    // ─── Últimas menciones (1 query) ───
    const ultimasMenciones = await db.mencion.findMany({
      take: 15,
      orderBy: { fechaCaptura: 'desc' },
      include: {
        persona: { select: { id: true, nombre: true, partidoSigla: true, camara: true } },
        medio: { select: { id: true, nombre: true, tipo: true } },
      },
    });

    // ─── Fuentes por nivel (5 queries paralelizadas → 1 batch con groupBy) ───
    const [capturaLogs, mediosAll] = await Promise.all([
      db.capturaLog.findMany({
        where: { fecha: { gte: hoy, lt: manana } },
        select: { nivel: true, fecha: true, exitosa: true, totalArticulos: true, mencionesEncontradas: true },
        orderBy: { fecha: 'desc' },
      }),
      db.medio.findMany({
        select: { nivel: true, activo: true },
      }),
    ]);

    // Process fuentes in memory
    const ultimaCapturaPorNivel = new Map<string, typeof capturaLogs[0]>();
    const capturasHoyPorNivel = new Map<string, number>();

    for (const cl of capturaLogs) {
      if (!ultimaCapturaPorNivel.has(cl.nivel)) {
        ultimaCapturaPorNivel.set(cl.nivel, cl);
      }
      capturasHoyPorNivel.set(cl.nivel, (capturasHoyPorNivel.get(cl.nivel) || 0) + 1);
    }

    const mediosCountMap: Record<string, { total: number; activos: number }> = {};
    for (const m of mediosAll) {
      if (!mediosCountMap[m.nivel]) mediosCountMap[m.nivel] = { total: 0, activos: 0 };
      mediosCountMap[m.nivel].total++;
      if (m.activo) mediosCountMap[m.nivel].activos++;
    }

    const fuentesPorNivel = ['1', '2', '3', '4', '5'].map(nivel => {
      const last = ultimaCapturaPorNivel.get(nivel);
      return {
        nivel,
        mediosCount: mediosCountMap[nivel]?.activos || 0,
        ultimaCaptura: last?.fecha || null,
        ultimaExitosa: last?.exitosa || false,
        ultimoTotalArticulos: last?.totalArticulos || 0,
        ultimoMencionesEncontradas: last?.mencionesEncontradas || 0,
        capturasHoy: capturasHoyPorNivel.get(nivel) || 0,
      };
    });

    const mediosPorNivel = ['1', '2', '3', '4', '5'].map(nivel => ({
      nivel,
      total: mediosCountMap[nivel]?.total || 0,
      activos: mediosCountMap[nivel]?.activos || 0,
    }));

    return NextResponse.json({
      totalPersonas,
      totalMedios: fuentesActivas,
      mencionesHoy,
      mencionesSemana,
      totalReportes,
      enlacesRotos,
      totalComentarios,
      totalEjes,
      topActores: topActoresData,
      mencionesPorPartido,
      ultimasMenciones,
      distribucionCamara: { diputados, senadores },
      clientesActivos,
      contratosVigentes,
      entregasHoy,
      fuentesPorNivel,
      mediosPorNivel,
      alertas: {
        negativasHoy: alertasNegativas,
        positivasHoy: alertasPositivas,
        neutrasHoy: alertasNeutras,
        ultimaAlerta: ultimaAlerta || null,
      },
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: safeError(error, 'stats') }, { status: 500 });
  }
}
