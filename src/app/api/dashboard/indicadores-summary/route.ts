/**
 * /api/dashboard/indicadores-summary — Indicadores operacionales del pipeline
 *
 * Pipeline E v2: check_fuente → scrape_fuente_light → NotaRaw → batch_llm → Menciones
 *
 * Devuelve KPIs reales de las 4 etapas:
 *   CAPTURA → CLASIFICACIÓN → PRODUCCIÓN → DISTRIBUCIÓN
 *
 * IMPORTANTE: Todas las métricas "hoy" se calculan contra medianoche Bolivia
 * (America/La_Paz = UTC-4). Las tasas de clasificación se muestran tanto
 * globales (histórico) como de hoy para evitar cifras engañosas.
 */
import { NextResponse } from 'next/server';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ─── Helpers: Bolivia timezone ──────────────────────────────────

/** Medianoche de hoy en hora Bolivia (UTC-4) */
function boStartOfDay(): Date {
  const now = new Date();
  const boMidnight = new Date(now);
  boMidnight.setHours(0, 0, 0, 0);
  // Si el servidor no está en UTC-4, corregir el offset
  const offsetMin = now.getTimezoneOffset();
  const boOffset = 4 * 60; // 240 min
  const diffMin = offsetMin - boOffset;
  if (Math.abs(diffMin) > 30) {
    boMidnight.setTime(boMidnight.getTime() + diffMin * 60000);
  }
  return boMidnight;
}

/** N días atrás desde medianoche Bolivia */
function boDaysAgo(n: number): Date {
  const d = boStartOfDay();
  d.setDate(d.getDate() - n);
  return d;
}

/** 24h atrás (para jobs que usan UTC interno) */
function hace24h(): Date {
  return new Date(Date.now() - 24 * 3600 * 1000);
}

/** Texto relativo: "hace 5m", "hace 2h", "hace 3d" */
function haceTexto(fecha: Date): string {
  const ms = Date.now() - fecha.getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'ahora mismo';
  if (mins < 60) return `hace ${mins}m`;
  const horas = Math.floor(mins / 60);
  if (horas < 24) return `hace ${horas}h`;
  const dias = Math.floor(horas / 24);
  return `hace ${dias}d`;
}

export async function GET() {
  try {
    const hoyBo = boStartOfDay();
    const semanaAgoBo = boDaysAgo(7);
    const _24hAgo = hace24h();

    // ──── Consultas en paralelo ────
    const [
      // CAPTURA — Menciones (post-LLM)
      mencionesTotal,
      mencionesHoy,
      mencionesSemana,
      mediosTotal,
      fuentesActivas,
      fuentesDegradadas,
      ultMencion,
      mencionesPorNivel,
      mencionesPorSentimiento,
      mencionesPorTipoMencion,

      // PIPELINE NotaRaw (pre-LLM) — datos del pipeline real
      notasRawTotal,
      notasRawHoy,
      notasRawPendientes,
      notasRawProcesadasHoy,

      // CLASIFICACIÓN — global (histórico)
      lentesTotal,
      mencionesConLente,
      mencionesConEje,
      mencionesConSentimiento,
      ejesTotal,
      // PRODUCCIÓN (Reporte)
      productosTotal,
      productosHoy,
      productosSemana,
      productosPorTipo,
      productosEnviados,
      ultProducto,

      // DISTRIBUCIÓN (Entrega)
      enviosTotal,
      enviosExitosos,
      enviosFallidos,
      entregasTotal,
      entregasHoy,
      suscriptoresTotal,
      ultEnvio,

      // JOBS
      jobsCompletados24h,
      jobsFallidos24h,

      // Última actividad (para verificar frescura de datos)
      ultJob,
    ] = await Promise.all([
      // ── CAPTURA (Menciones = datos ya procesados por LLM) ──
      db.mencion.count(),
      db.mencion.count({ where: { fechaCaptura: { gte: hoyBo } } }),
      db.mencion.count({ where: { fechaCaptura: { gte: semanaAgoBo } } }),
      db.medio.count(),
      db.fuenteEstado.count({ where: { activo: true } }),
      db.fuenteEstado.count({ where: { OR: [
        { fallosConsecutivos: { gte: 3 } },
        { checksSinCambio: { gte: 7 } },
      ] } }),
      db.mencion.findFirst({ orderBy: { fechaCaptura: 'desc' }, select: { fechaCaptura: true } }),
      db.$queryRaw`
        SELECT m.nivel as nivel, COUNT(ml.id) as total
        FROM Medio m
        LEFT JOIN Mencion ml ON ml.medioId = m.id
        GROUP BY m.nivel
        ORDER BY m.nivel
      `.then((rows: Array<{ nivel: number; total: bigint }>) =>
        rows.map(r => ({ nivel: Number(r.nivel), total: Number(r.total) }))
      ),
      db.$queryRaw`
        SELECT sentimiento, COUNT(id) as total
        FROM Mencion
        WHERE sentimiento IS NOT NULL
          AND sentimiento != ''
          AND sentimiento != 'no_clasificado'
          AND sentimiento != 'sin_tratamiento'
        GROUP BY sentimiento
        ORDER BY total DESC
      `.then((rows: Array<{ sentimiento: string; total: bigint }>) =>
        rows.map(r => ({ sentimiento: r.sentimiento, total: Number(r.total) }))
      ),
      db.$queryRaw`
        SELECT tipoMencion, COUNT(id) as total
        FROM Mencion
        WHERE tipoMencion IS NOT NULL AND tipoMencion != ''
        GROUP BY tipoMencion
        ORDER BY total DESC
      `.then((rows: Array<{ tipoMencion: string; total: bigint }>) =>
        rows.map(r => ({ tipoMencion: r.tipoMencion, total: Number(r.total) }))
      ),

      // ── PIPELINE NotaRaw (estado del buffer intermedio) ──
      db.notaRaw.count(),
      db.notaRaw.count({ where: { fechaCaptura: { gte: hoyBo } } }),
      db.notaRaw.count({ where: { procesada: false, descartada: false } }),
      db.notaRaw.count({
        where: { procesada: true, fechaProcesada: { gte: hoyBo } },
      }),

      // ── CLASIFICACIÓN global ──
      db.lente.count(),
      db.$queryRaw<Array<{ c: number }>>`SELECT COUNT(DISTINCT mencionId) as c FROM MencionLente`
        .then(r => (Array.isArray(r) && r[0] ? Number(r[0].c) : 0)),
      db.$queryRaw<Array<{ c: number }>>`SELECT COUNT(DISTINCT mencionId) as c FROM MencionTema`
        .then(r => (Array.isArray(r) && r[0] ? Number(r[0].c) : 0)),
      db.mencion.count({
        where: {
          sentimiento: { not: null, not: '' },
          NOT: { sentimiento: { in: ['no_clasificado', 'sin_tratamiento'] } },
        },
      }),
      db.ejeTematico.count({ where: { activo: true } }),

      // ── PRODUCCIÓN (Reporte = productos generados) ──
      db.reporte.count(),
      db.reporte.count({ where: { fechaCreacion: { gte: hoyBo } } }),
      db.reporte.count({ where: { fechaCreacion: { gte: semanaAgoBo } } }),
      db.reporte.groupBy({ by: ['tipo'], _count: true }),
      db.reporte.count({ where: { enviado: true } }),
      db.reporte.findFirst({ orderBy: { fechaCreacion: 'desc' }, select: { fechaCreacion: true, tipo: true } }),

      // ── DISTRIBUCIÓN (Entrega) ──
      db.entrega.count(),
      db.entrega.count({ where: { estado: 'enviado' } }),
      db.entrega.count({ where: { estado: 'fallido' } }),
      db.entrega.count(),
      db.entrega.count({ where: { fechaEnvio: { gte: hoyBo } } }),
      db.suscriptorGratuito.count(),
      db.entrega.findFirst({ orderBy: { fechaEnvio: 'desc' } }),

      // ── JOBS ──
      db.job.count({ where: { estado: 'completado', fechaCreacion: { gte: _24hAgo } } }),
      db.job.count({ where: { estado: 'fallido', fechaCreacion: { gte: _24hAgo } } }),

      // ── Última actividad del sistema ──
      db.job.findFirst({ orderBy: { fechaCreacion: 'desc' }, select: { fechaCreacion: true, tipo: true } }),
    ]);

    // ──── Calcular tasas ────

    // Tasas GLOBALES (histórico completo)
    const tasaClasificacionEjeGlobal = mencionesTotal > 0
      ? Math.round((mencionesConEje / mencionesTotal) * 100) : 0;
    const tasaClasificacionLenteGlobal = mencionesTotal > 0
      ? Math.round((mencionesConLente / mencionesTotal) * 100) : 0;
    const tasaClasificacionSentimientoGlobal = mencionesTotal > 0
      ? Math.round((mencionesConSentimiento / mencionesTotal) * 100) : 0;

    // Tasas DE HOY: todas las menciones de hoy vienen clasificadas por batch_llm,
    // así que la tasa es 100% si hay menciones hoy, 0% si no hay.
    const tasaClasificacionHoy = mencionesHoy > 0 ? 100 : 0;
    const tasaExitoEnvios = enviosTotal > 0
      ? Math.round((enviosExitosos / enviosTotal) * 100) : 0;
    const productosPendientes = productosTotal - productosEnviados;

    const porNivel = Array.isArray(mencionesPorNivel) ? mencionesPorNivel : [];
    const porSentimiento = Array.isArray(mencionesPorSentimiento) ? mencionesPorSentimiento : [];
    const porTipoMencion = Array.isArray(mencionesPorTipoMencion) ? mencionesPorTipoMencion : [];
    const porTipo = Array.isArray(productosPorTipo)
      ? productosPorTipo.map(p => ({ tipo: p.tipo, total: p._count }))
      : [];

    // ──── Armar respuesta ────

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      // Data freshness indicator
      frescura: {
        ultimaActividad: ultJob?.fechaCreacion?.toISOString() ?? null,
        ultimaActividadHace: ultJob ? haceTexto(ultJob.fechaCreacion) : 'nunca',
        ultimaActividadTipo: ultJob?.tipo ?? null,
      },

      // ── Pipeline NotaRaw (buffer intermedio) ──
      pipeline: {
        notasRaw: {
          total: notasRawTotal,
          hoy: notasRawHoy,
          pendientes: notasRawPendientes,
          procesadasHoy: notasRawProcesadasHoy,
        },
        // El pipeline está activo si hay notas pendientes o se procesaron hoy
        status: notasRawPendientes > 0 ? 'procesando'
          : notasRawProcesadasHoy > 0 ? 'ok'
          : notasRawHoy > 0 ? 'pendiente_llm'
          : 'idle',
      },

      // ── Captura (Menciones post-LLM) ──
      captura: {
        menciones: { total: mencionesTotal, hoy: mencionesHoy, semana: mencionesSemana },
        medios: mediosTotal,
        fuentes: { activas: fuentesActivas, degradadas: fuentesDegradadas },
        ultimaCaptura: ultMencion?.fechaCaptura?.toISOString() ?? null,
        ultimaCapturaHace: ultMencion ? haceTexto(ultMencion.fechaCaptura) : 'nunca',
        porNivel,
        porSentimiento,
        porTipoMencion,
        status: fuentesDegradadas > fuentesActivas * 0.5 ? 'error'
          : fuentesDegradadas > 0 ? 'warn'
          : fuentesActivas > 0 && mencionesHoy > 0 ? 'ok'
          : fuentesActivas > 0 ? 'warn'
          : 'idle',
      },

      // ── Clasificación ──
      clasificacion: {
        lentes: lentesTotal,
        ejes: ejesTotal,
        mencionesClasificadas: {
          conLente: mencionesConLente,
          conEje: mencionesConEje,
          conSentimiento: mencionesConSentimiento,
          total: mencionesTotal,
        },
        tasas: {
          lente: tasaClasificacionLenteGlobal,
          eje: tasaClasificacionEjeGlobal,
          sentimiento: tasaClasificacionSentimientoGlobal,
          hoy: tasaClasificacionHoy, // % de menciones de hoy (todas vienen clasificadas)
          hoyMenciones: mencionesHoy, // para contexto
        },
        // Clarificar: tasa global vs hoy
        contexto: mencionesTotal > 0 && mencionesHoy === 0
          ? 'Sin menciones nuevas hoy — las tasas globales reflejan datos históricos'
          : mencionesHoy > 0
          ? `${mencionesHoy} menciones nuevas hoy — tasa global incluye ${mencionesTotal} históricas`
          : 'Sin datos',
        status: tasaClasificacionEjeGlobal > 50 ? 'ok' : tasaClasificacionEjeGlobal > 0 ? 'warn' : 'idle',
      },

      // ── Producción ──
      produccion: {
        productos: { total: productosTotal, hoy: productosHoy, semana: productosSemana },
        reportes: productosTotal,
        porTipo,
        porEstado: [
          { estado: 'completado', total: productosEnviados },
          { estado: 'pendiente', total: productosPendientes },
        ],
        ultimoProducto: ultProducto?.fechaCreacion?.toISOString() ?? null,
        ultimoProductoHace: ultProducto ? haceTexto(ultProducto.fechaCreacion) : 'nunca',
        ultimoTipo: ultProducto?.tipo ?? null,
        status: productosHoy > 0 ? 'ok' : productosTotal > 0 ? 'warn' : 'idle',
      },

      // ── Distribución ──
      distribucion: {
        envios: { total: enviosTotal, exitosos: enviosExitosos, fallidos: enviosFallidos, tasaExito: tasaExitoEnvios },
        entregas: { total: entregasTotal, hoy: entregasHoy },
        suscriptores: suscriptoresTotal,
        ultimoEnvio: ultEnvio?.fechaEnvio?.toISOString() ?? null,
        ultimoEnvioHace: ultEnvio?.fechaEnvio ? haceTexto(ultEnvio.fechaEnvio) : 'nunca',
        status: enviosTotal > 0 && enviosFallidos === 0 ? 'ok' : enviosFallidos > 0 ? 'warn' : 'idle',
      },

      // ── Actividad del sistema ──
      sistema: {
        jobs24h: { completados: jobsCompletados24h, fallidos: jobsFallidos24h },
        status: jobsFallidos24h > jobsCompletados24h ? 'error' : jobsFallidos24h > 0 ? 'warn' : jobsCompletados24h > 0 ? 'ok' : 'idle',
      },
    });
  } catch (error: unknown) {
    // BLINDAJE: NUNCA 500. Devolver datos degradados.
    console.error('[indicadores-summary] Error (returning degraded):', error);
    return NextResponse.json({
      status: 'degraded',
      timestamp: new Date().toISOString(),
      frescura: { ultimaActividad: null, ultimaActividadHace: 'nunca', ultimaActividadTipo: null },
      pipeline: { notasRaw: { total: 0, hoy: 0, pendientes: 0, procesadasHoy: 0 }, status: 'idle' },
      captura: { menciones: { total: 0, hoy: 0, semana: 0 }, medios: 0, fuentes: { activas: 0, degradadas: 0 }, ultimaCaptura: null, ultimaCapturaHace: 'nunca', porNivel: [], porSentimiento: [], porTipoMencion: [], status: 'idle' },
      clasificacion: { lentes: 0, ejes: 0, mencionesClasificadas: { conLente: 0, conEje: 0, conSentimiento: 0, total: 0 }, tasas: { lente: 0, eje: 0, sentimiento: 0, hoy: 0, hoyMenciones: 0 }, contexto: 'Error al calcular métricas', status: 'idle' },
      produccion: { productos: { total: 0, hoy: 0, semana: 0 }, reportes: 0, porTipo: [], porEstado: [], ultimoProducto: null, ultimoProductoHace: 'nunca', ultimoTipo: null, status: 'idle' },
      distribucion: { envios: { total: 0, exitosos: 0, fallidos: 0, tasaExito: 0 }, entregas: { total: 0, hoy: 0 }, suscriptores: 0, ultimoEnvio: null, ultimoEnvioHace: 'nunca', status: 'idle' },
      sistema: { jobs24h: { completados: 0, fallidos: 0 }, status: 'idle' },
      message: 'Metricas no disponibles temporalmente',
    });
  }
}
