/**
 * /api/dashboard/capturas-summary — Capturas REALES
 * Datos derivados directamente de la tabla Mencion.
 * Timezone: America/La_Paz (UTC-4).
 */
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { safeError } from '@/lib/rate-guard';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** Retorna el inicio del día actual en timezone Bolivia */
function todayStartBolivia(): Date {
  const now = new Date();
  // Bolivia es UTC-4
  const boliviaOffset = -4;
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  const boliviaMs = utcMs + boliviaOffset * 60000;
  const boliviaNow = new Date(boliviaMs);
  const start = new Date(boliviaNow.getFullYear(), boliviaNow.getMonth(), boliviaNow.getDate());
  // Convertir de vuelta a UTC
  return new Date(start.getTime() - boliviaOffset * 60000 - now.getTimezoneOffset() * 60000);
}

/** Retorna hace 24h en timezone Bolivia */
function last24hBolivia(): Date {
  return new Date(Date.now() - 24 * 3600000);
}

/** Retorna inicio de la semana actual (lunes) en Bolivia */
function weekStartBolivia(): Date {
  const now = new Date();
  const boliviaOffset = -4;
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  const boliviaMs = utcMs + boliviaOffset * 60000;
  const boliviaNow = new Date(boliviaMs);
  const day = boliviaNow.getDay(); // 0=dom, 1=lun...
  const diff = day === 0 ? 6 : day - 1; // días desde lunes
  const monday = new Date(boliviaNow);
  monday.setDate(boliviaNow.getDate() - diff);
  monday.setHours(0, 0, 0, 0);
  return new Date(monday.getTime() - boliviaOffset * 60000 - now.getTimezoneOffset() * 60000);
}

function safeNum(n: unknown, fallback = 0): number {
  return typeof n === 'number' && !Number.isNaN(n) ? n : fallback;
}

export async function GET() {
  try {
    const hoyStart = todayStartBolivia();
    const last24h = last24hBolivia();
    const weekStart = weekStartBolivia();

    // ── Consultas paralelas a la BD ──────────────────────
    const [
      mencionesHoy,
      menciones24h,
      totalMenciones,
      mencionesSemana,

      // Medios con actividad
      mediosActivosTotal,
      mencionesPorMedio24h,

      // Capture logs (si hay)
      capturasLog24h,
      capturasLogExitosas,
    ] = await Promise.all([
      // Menciones capturadas hoy (Bolivia)
      db.mencion.count({ where: { fechaCaptura: { gte: hoyStart }, esDuplicado: false } }),
      // Menciones últimas 24h
      db.mencion.count({ where: { fechaCaptura: { gte: last24h }, esDuplicado: false } }),
      // Total menciones en la BD
      db.mencion.count({ where: { esDuplicado: false } }),
      // Menciones esta semana (lunes a hoy)
      db.mencion.count({ where: { fechaCaptura: { gte: weekStart }, esDuplicado: false } }),

      // Medios registrados
      db.medio.count({ where: { activo: true } }),

      // Menciones agrupadas por medio (últimas 24h)
      db.mencion.groupBy({
        by: ['medioId'],
        where: { fechaCaptura: { gte: last24h }, esDuplicado: false },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 15,
      }),

      // CaptureLog (si la tabla existe y tiene datos)
      db.capturaLog.count({ where: { fecha: { gte: last24h } } }).catch(() => 0),
      db.capturaLog.count({ where: { fecha: { gte: last24h }, exitosa: true } }).catch(() => 0),
    ]);

    // ── Top medios con sus nombres ─────────────────────────
    const medioIds = mencionesPorMedio24h.map(g => g.medioId);
    const mediosMap = new Map<string, string>();
    if (medioIds.length > 0) {
      const medios = await db.medio.findMany({
        where: { id: { in: medioIds } },
        select: { id: true, nombre: true, tipo: true, nivel: true },
      });
      for (const m of medios) mediosMap.set(m.id, m.nombre);
    }

    const topMedios = mencionesPorMedio24h.map(g => ({
      medioId: g.medioId,
      nombre: mediosMap.get(g.medioId) || 'Desconocido',
      menciones: g._count.id,
    }));

    // ── Medios con actividad vs inactivos ──────────────────
    const mediosConMencion = await db.mencion.groupBy({
      by: ['medioId'],
      where: { fechaCaptura: { gte: weekStart }, esDuplicado: false },
      _count: { id: true },
    });
    const mediosActivosEstaSemana = mediosConMencion.length;
    const mediosSinActividad = Math.max(0, mediosActivosTotal - mediosActivosEstaSemana);

    // ── Tasa de éxito real ──────────────────────────────────
    // Si hay CaptureLogs, usarlos. Si no, basarse en medios con menciones.
    let successRate: number;
    let totalCapturasIntentadas: number;
    let capturasExitosas: number;

    if (capturasLog24h > 0) {
      totalCapturasIntentadas = capturasLog24h;
      capturasExitosas = capturasLogExitosas;
      successRate = capturasLog24h > 0 ? Math.round((capturasExitosas / capturasLog24h) * 100) : 0;
    } else {
      // No hay logs de captura. Calcular basado en medios con/sin menciones.
      totalCapturasIntentadas = mediosActivosTotal;
      capturasExitosas = mediosActivosEstaSemana;
      successRate = mediosActivosTotal > 0
        ? Math.round((mediosActivosEstaSemana / mediosActivosTotal) * 100)
        : 0;
    }

    // ── Última fecha de captura ────────────────────────────
    const ultimaMencion = await db.mencion.findFirst({
      where: { esDuplicado: false },
      orderBy: { fechaCaptura: 'desc' },
      select: { fechaCaptura: true, id: true },
    });

    const ultimaCaptura = ultimaMencion?.fechaCaptura ?? null;

    // ── Menciones por día (últimos 7 días) ────────────────
    const hace7d = new Date(Date.now() - 7 * 24 * 3600000);
    const mencionesPorDia = await db.mencion.groupBy({
      by: ['fechaCaptura'],  // Note: SQLite stores as ISO string, groupBy works on date portion
      where: { fechaCaptura: { gte: hace7d }, esDuplicado: false },
      _count: { id: true },
      orderBy: { fechaCaptura: 'asc' },
    });

    // Simplificar: solo contar por fecha
    const tendencia: Array<{ fecha: string; total: number }> = [];
    for (const g of mencionesPorDia) {
      const fecha = g.fechaCaptura instanceof Date
        ? g.fechaCaptura.toISOString().split('T')[0]
        : String(g.fechaCaptura).split('T')[0];
      tendencia.push({ fecha, total: g._count.id });
    }

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      // ── KPIs principales ───────────────────────────────
      capturasHoy: safeNum(mencionesHoy),
      capturas24h: safeNum(menciones24h),
      capturasSemana: safeNum(mencionesSemana),
      totalMenciones: safeNum(totalMenciones),

      // ── Medios ───────────────────────────────────────────
      medios: {
        registrados: mediosActivosTotal,
        conActividad: mediosActivosEstaSemana,
        sinActividad: mediosSinActividad,
        porcentajeCobertura: mediosActivosTotal > 0
          ? Math.round((mediosActivosEstaSemana / mediosActivosTotal) * 100)
          : 0,
      },

      // ── Tasa de éxito ───────────────────────────────────
      capturas: {
        intentadas: totalCapturasIntentadas,
        exitosas: capturasExitosas,
        fallidas: totalCapturasIntentadas - capturasExitosas,
        successRate,
      },

      // ── Top medios ───────────────────────────────────────
      topMedios,

      // ── Tendencia ────────────────────────────────────────
      tendencia,

      // ── Última actividad ────────────────────────────────
      ultimaCaptura,
      sistemaActivo: ultimaCaptura
        ? (Date.now() - ultimaCaptura.getTime()) < 48 * 3600000
        : false,
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: safeError(error, 'capturas-summary') }, { status: 500 });
  }
}
