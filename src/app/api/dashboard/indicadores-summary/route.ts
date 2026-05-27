/**
 * /api/dashboard/indicadores-summary — Indicadores operacionales del pipeline
 *
 * Devuelve KPIs reales de las 4 etapas del pipeline periodístico:
 *   CAPTURA → CLASIFICACIÓN → PRODUCCIÓN → DISTRIBUCIÓN
 *
 * Todos los valores se calculan desde las tablas reales de la DB.
 * Modelos disponibles: mencion, medio, fuenteEstado, lente, mencionLente,
 * mencionTema, ejeTematico, reporte, entrega, suscriptor, job
 */
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { safeError } from '@/lib/rate-guard';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ─── Helpers ──────────────────────────────────────────────────

function boNow() {
  const now = new Date();
  return new Date(now.getTime() + now.getTimezoneOffset() * 60000 - 4 * 3600000);
}

function boStartOfDay() {
  const d = boNow();
  d.setHours(0, 0, 0, 0);
  return d;
}

function boDaysAgo(n: number) {
  const d = boStartOfDay();
  d.setDate(d.getDate() - n);
  return d;
}

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

    // ──── Consultas en paralelo ────
    const [
      // CAPTURA
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

      // CLASIFICACIÓN
      lentesTotal,
      mencionesConLente,
      mencionesConEje,
      mencionesConSentimiento,
      ejesTotal,

      // PRODUCCIÓN (usamos Reporte como modelo de productos)
      productosTotal,
      productosHoy,
      productosSemana,
      productosPorTipo,
      productosEnviados,
      ultProducto,

      // DISTRIBUCIÓN (usamos Entrega)
      enviosTotal,
      enviosExitosos,
      enviosFallidos,
      entregasTotal,
      entregasHoy,
      suscriptoresTotal,
      ultEnvio,

      // JOBS (actividad del sistema)
      jobsCompletados24h,
      jobsFallidos24h,
    ] = await Promise.all([
      // ── CAPTURA ──
      db.mencion.count(),
      db.mencion.count({ where: { fechaCaptura: { gte: hoyBo } } }),
      db.mencion.count({ where: { fechaCaptura: { gte: semanaAgoBo } } }),
      db.medio.count(),
      db.fuenteEstado.count({ where: { activo: true } }),
      // Degradada: 3+ fallos consecutivos O 7+ checks sin cambio (alineado con pipeline API)
      db.fuenteEstado.count({ where: { OR: [
        { fallosConsecutivos: { gte: 3 } },
        { checksSinCambio: { gte: 7 } },
      ] } }),
      db.mencion.findFirst({ orderBy: { fechaCaptura: 'desc' }, select: { fechaCaptura: true } }),
      // Menciones por nivel de medio (cast BigInt to Number)
      db.$queryRaw`
        SELECT m.nivel as nivel, COUNT(ml.id) as total
        FROM Medio m
        LEFT JOIN Mencion ml ON ml.medioId = m.id
        GROUP BY m.nivel
        ORDER BY m.nivel
      `.then((rows: Array<{ nivel: number; total: bigint }>) =>
        rows.map(r => ({ nivel: Number(r.nivel), total: Number(r.total) }))
      ),

      // Menciones por sentimiento (excluir "no_clasificado" y "sin_tratamiento")
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

      // Menciones por tipo de mencion (tipoMencion)
      db.$queryRaw`
        SELECT tipoMencion, COUNT(id) as total
        FROM Mencion
        WHERE tipoMencion IS NOT NULL AND tipoMencion != ''
        GROUP BY tipoMencion
        ORDER BY total DESC
      `.then((rows: Array<{ tipoMencion: string; total: bigint }>) =>
        rows.map(r => ({ tipoMencion: r.tipoMencion, total: Number(r.total) }))
      ),

      // ── CLASIFICACIÓN ──
      db.lente.count(),
      // distinct count via raw SQL (Prisma v6 compatible) — cast to int
      db.$queryRaw<Array<{ c: number }>>`SELECT COUNT(DISTINCT mencionId) as c FROM MencionLente`.then(r => (Array.isArray(r) && r[0] ? Number(r[0].c) : 0)),
      db.$queryRaw<Array<{ c: number }>>`SELECT COUNT(DISTINCT mencionId) as c FROM MencionTema`.then(r => (Array.isArray(r) && r[0] ? Number(r[0].c) : 0)),
      // Menciones con sentimiento REAL (excluir no_clasificado/sin_tratamiento)
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

      // ── DISTRIBUCIÓN (Entrega = envíos realizados) ──
      db.entrega.count(),
      db.entrega.count({ where: { estado: 'enviado' } }),
      db.entrega.count({ where: { estado: 'fallido' } }),
      db.entrega.count(),
      db.entrega.count({ where: { fechaEnvio: { gte: hoyBo } } }),
      db.suscriptor.count(),
      db.entrega.findFirst({ orderBy: { fechaEnvio: 'desc' } }),

      // ── JOBS ──
      db.job.count({ where: { estado: 'completado', fechaCreacion: { gte: new Date(Date.now() - 24 * 3600 * 1000) } } }),
      db.job.count({ where: { estado: 'fallido', fechaCreacion: { gte: new Date(Date.now() - 24 * 3600 * 1000) } } }),
    ]);

    // ──── Calcular tasas y derivados ────

    const tasaClasificacionEje = mencionesTotal > 0
      ? Math.round((mencionesConEje / mencionesTotal) * 100) : 0;
    const tasaClasificacionLente = mencionesTotal > 0
      ? Math.round((mencionesConLente / mencionesTotal) * 100) : 0;
    const tasaClasificacionSentimiento = mencionesTotal > 0
      ? Math.round((mencionesConSentimiento / mencionesTotal) * 100) : 0;
    const tasaExitoEnvios = enviosTotal > 0
      ? Math.round((enviosExitosos / enviosTotal) * 100) : 0;
    const productosPendientes = productosTotal - productosEnviados;

    // porNivel ya viene convertido de la raw query
    const porNivel = Array.isArray(mencionesPorNivel) ? mencionesPorNivel : [];

    // porSentimiento y porTipoMencion
    const porSentimiento = Array.isArray(mencionesPorSentimiento) ? mencionesPorSentimiento : [];
    const porTipoMencion = Array.isArray(mencionesPorTipoMencion) ? mencionesPorTipoMencion : [];

    // Derivar porTipo de forma segura
    const porTipo = Array.isArray(productosPorTipo)
      ? productosPorTipo.map(p => ({ tipo: p.tipo, total: p._count }))
      : [];

    // ──── Armar respuesta ────

    return NextResponse.json({
      timestamp: new Date().toISOString(),

      // ── Captura ──
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
          : fuentesActivas > 0 && mencionesTotal > 0 ? 'ok'
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
        tasas: { lente: tasaClasificacionLente, eje: tasaClasificacionEje, sentimiento: tasaClasificacionSentimiento },
        status: tasaClasificacionEje > 50 ? 'ok' : tasaClasificacionEje > 0 ? 'warn' : 'idle',
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
        status: productosTotal > 0 ? 'ok' : 'idle',
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
      captura: { menciones: { total: 0, hoy: 0, semana: 0 }, medios: 0, fuentes: { activas: 0, degradadas: 0 }, ultimaCaptura: null, ultimaCapturaHace: 'nunca', porNivel: [], porSentimiento: [], porTipoMencion: [], status: 'idle' },
      clasificacion: { lentes: 0, ejes: 0, mencionesClasificadas: { conLente: 0, conEje: 0, conSentimiento: 0, total: 0 }, tasas: { lente: 0, eje: 0, sentimiento: 0 }, status: 'idle' },
      produccion: { productos: { total: 0, hoy: 0, semana: 0 }, reportes: 0, porTipo: [], porEstado: [], ultimoProducto: null, ultimoProductoHace: 'nunca', ultimoTipo: null, status: 'idle' },
      distribucion: { envios: { total: 0, exitosos: 0, fallidos: 0, tasaExito: 0 }, entregas: { total: 0, hoy: 0 }, suscriptores: 0, ultimoEnvio: null, ultimoEnvioHace: 'nunca', status: 'idle' },
      sistema: { jobs24h: { completados: 0, fallidos: 0 }, status: 'idle' },
      message: 'Metricas no disponibles temporalmente',
    });
  }
}
