import { NextResponse } from 'next/server';
import db from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ═══════════════════════════════════════════════════════════
// BLINDAJE: Este endpoint NUNCA devuelve HTTP 500.
// Si alguna query falla, devuelve datos parciales.
// ═══════════════════════════════════════════════════════════

// Helpers: zona horaria Bolivia UTC-4

function todayStart(): Date {
  try {
    const now = new Date();
    const boliviaOffset = -4 * 60;
    const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
    const boliviaMs = utcMs + boliviaOffset * 60000;
    const boliviaNow = new Date(boliviaMs);
    const start = new Date(boliviaNow.getFullYear(), boliviaNow.getMonth(), boliviaNow.getDate());
    const startUTC = new Date(start.getTime() - boliviaOffset * 60000);
    return startUTC;
  } catch {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }
}

function weekStart(): Date {
  try {
    const now = new Date();
    const boliviaOffset = -4 * 60;
    const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
    const boliviaMs = utcMs + boliviaOffset * 60000;
    const boliviaNow = new Date(boliviaMs);
    const day = boliviaNow.getDay();
    const diff = day === 0 ? 6 : day - 1;
    const monday = new Date(boliviaNow.getFullYear(), boliviaNow.getMonth(), boliviaNow.getDate() - diff);
    return new Date(monday.getTime() - boliviaOffset * 60000);
  } catch {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay() + 1);
    d.setHours(0, 0, 0, 0);
    return d;
  }
}

function safeNum(n: unknown, fallback = 0): number {
  return typeof n === 'number' && Number.isFinite(n) ? n : fallback;
}

function tiempoRelativo(fecha: Date | null): string {
  if (!fecha) return 'nunca';
  try {
    const ahora = Date.now();
    const ms = ahora - fecha.getTime();
    const minutos = Math.floor(ms / 60000);
    if (minutos < 1) return 'ahora';
    if (minutos < 60) return `hace ${minutos}m`;
    const horas = Math.floor(minutos / 60);
    if (horas < 24) return `hace ${horas}h`;
    const dias = Math.floor(horas / 24);
    return `hace ${dias}d`;
  } catch {
    return 'desconocido';
  }
}

const PRODUCT_NAMES: Record<string, string> = {
  EL_TERMOMETRO: 'El Termometro',
  SALDO_DEL_DIA: 'Saldo del Dia',
  EL_FOCO: 'El Foco',
  EL_ESPECIALIZADO: 'El Especializado',
  EL_INFORME_CERRADO: 'Informe Cerrado',
  FICHA_LEGISLADOR: 'Ficha Legislador',
  EL_RADAR: 'El Radar',
  VOZ_Y_VOTO: 'Voz y Voto',
  EL_HILO: 'El Hilo',
  FOCO_DE_LA_SEMANA: 'Foco de la Semana',
  ALERTA_TEMPRANA: 'Alerta Temprana',
  BOLETIN_DEL_GRANO: 'Boletin del Grano',
};

const STANDARD_PRODUCTS = [
  'EL_TERMOMETRO', 'SALDO_DEL_DIA', 'EL_FOCO', 'EL_ESPECIALIZADO',
  'EL_INFORME_CERRADO', 'FICHA_LEGISLADOR', 'EL_RADAR', 'EL_HILO',
  'BOLETIN_DEL_GRANO', 'VOZ_Y_VOTO',
];

// ═══════════════════════════════════════════════════════════
// Endpoint — NUNCA 500
// ═══════════════════════════════════════════════════════════

export async function GET() {
  try {
    const start = todayStart();
    const weekS = weekStart();

    // ════════════════════════════════════════════════════
    // 1. CAPTURA — cada query con su propio catch
    // ════════════════════════════════════════════════════

    const mencionesHoy = safeNum(await db.mencion.count({
      where: { fechaCaptura: { gte: start } },
    }).catch(() => 0));

    const totalMenciones = safeNum(await db.mencion.count().catch(() => 0));

    const sieteDiasAtras = new Date(start.getTime() - 7 * 24 * 60 * 60 * 1000);
    const totalSemanaPasada = safeNum(await db.mencion.count({
      where: { fechaCaptura: { gte: sieteDiasAtras, lt: start } },
    }).catch(() => 0));
    const promedioDiario = totalSemanaPasada > 0 ? Math.round(totalSemanaPasada / 7) : safeNum(mencionesHoy);

    const ultimaMencion = await db.mencion.findFirst({
      orderBy: { fechaCaptura: 'desc' },
      select: { fechaCaptura: true, createdAt: true },
    }).catch(() => null);

    let sinCapturaHoras: number | null = null;
    if (ultimaMencion) {
      try {
        const fechaRef = ultimaMencion.fechaCaptura || ultimaMencion.createdAt;
        if (fechaRef) {
          sinCapturaHoras = Math.floor((Date.now() - fechaRef.getTime()) / (1000 * 60 * 60));
        }
      } catch { /* ignore */ }
    }

    const fuentesRaw = await db.fuenteEstado.findMany({
      include: { Medio: { select: { nombre: true } } },
      orderBy: { ultimoCheck: 'desc' },
      take: 50,
    }).catch(() => []);

    const mencionesSemana = await db.mencion.groupBy({
      by: ['medioId'],
      where: { fechaCaptura: { gte: weekS } },
      _count: true,
    }).catch(() => []);

    const mencionesPorMedio = new Map(mencionesSemana.map(m => [m.medioId, m._count]));

    const fuentes = fuentesRaw.map(f => {
      try {
        const estado = f.activo
          ? (f.fallosConsecutivos > 3 ? 'error' : f.fallosConsecutivos > 0 ? 'warning' : 'ok')
          : 'inactivo';
        return {
          id: f.id,
          nombre: f.Medio?.nombre || f.url,
          estado,
          ultimaCaptura: tiempoRelativo(f.ultimoCheck),
          mencionesSemana: safeNum(mencionesPorMedio.get(f.medioId)),
        };
      } catch {
        return { id: f.id, nombre: 'unknown', estado: 'inactivo' as const, ultimaCaptura: 'unknown', mencionesSemana: 0 };
      }
    });

    // ════════════════════════════════════════════════════
    // 2. CLASIFICACION
    // ════════════════════════════════════════════════════

    const clasificadas = safeNum(await db.mencion.count({
      where: { tratamientoPeriodistico: { not: null } },
    }).catch(() => 0));

    const porcentaje = totalMenciones > 0
      ? safeNum(Math.round((clasificadas / totalMenciones) * 100))
      : 0;

    let lentes: Array<{ nombre: string; total: number; clasificadas: number; porcentaje: number }> = [];
    try {
      const lentesRaw = await db.lente.findMany({
        where: { activo: true },
        include: { MencionLente: { include: { Mencion: { select: { tratamientoPeriodistico: true } } } } },
      });
      lentes = lentesRaw.map(l => {
        const clasificadasLente = l.MencionLente.filter(ml => ml.Mencion.tratamientoPeriodistico !== null).length;
        return {
          nombre: l.nombre,
          total: safeNum(l.MencionLente.length),
          clasificadas: safeNum(clasificadasLente),
          porcentaje: l.MencionLente.length > 0 ? safeNum(Math.round((clasificadasLente / l.MencionLente.length) * 100)) : 0,
        };
      });
    } catch { lentes = []; }

    const pendientes = safeNum(totalMenciones - clasificadas);

    // ════════════════════════════════════════════════════
    // 3. PRODUCCION
    // ════════════════════════════════════════════════════

    const reportesSemana = await db.reporte.findMany({
      where: { fechaCreacion: { gte: weekS } },
      orderBy: { fechaCreacion: 'desc' },
      take: 200,
      select: { id: true, tipo: true, fechaInicio: true, fechaCreacion: true, totalMenciones: true, resumen: true },
    }).catch(() => []);

    const entregasSemana = await db.entrega.findMany({
      where: { fechaCreacion: { gte: weekS } },
      orderBy: { fechaCreacion: 'desc' },
      take: 200,
      select: { tipoBoletin: true, estado: true, fechaCreacion: true },
    }).catch(() => []);

    const reporteMap = new Map<string, { total: number; totalMenciones: number; ultimaEdicion: string }>();
    for (const r of reportesSemana) {
      try {
        const tipo = r.tipo;
        const existing = reporteMap.get(tipo);
        if (existing) {
          existing.total++;
          existing.totalMenciones += safeNum(r.totalMenciones);
          if (!existing.ultimaEdicion || r.fechaCreacion > new Date(existing.ultimaEdicion)) {
            existing.ultimaEdicion = r.fechaCreacion.toISOString();
          }
        } else {
          reporteMap.set(tipo, { total: 1, totalMenciones: safeNum(r.totalMenciones), ultimaEdicion: r.fechaCreacion.toISOString() });
        }
      } catch { /* skip */ }
    }

    const entregaMap = new Map<string, { enviadas: number; fallidas: number; pendientes: number }>();
    for (const e of entregasSemana) {
      try {
        const tipo = e.tipoBoletin || 'otro';
        const existing = entregaMap.get(tipo);
        if (existing) {
          if (e.estado === 'enviado') existing.enviadas++;
          else if (e.estado === 'fallido') existing.fallidas++;
          else existing.pendientes++;
        } else {
          entregaMap.set(tipo, {
            enviadas: e.estado === 'enviado' ? 1 : 0,
            fallidas: e.estado === 'fallido' ? 1 : 0,
            pendientes: e.estado !== 'enviado' && e.estado !== 'fallido' ? 1 : 0,
          });
        }
      } catch { /* skip */ }
    }

    const semana = STANDARD_PRODUCTS.map(tipo => {
      const reporte = reporteMap.get(tipo);
      const entrega = entregaMap.get(tipo);
      const hasReporte = reporte && reporte.total > 0;
      const hasFallidas = entrega && entrega.fallidas > 0;
      const hasPendientes = entrega && entrega.pendientes > 0;
      return {
        nombre: PRODUCT_NAMES[tipo] || tipo,
        tipo,
        estado: hasFallidas ? 'error' : hasReporte ? 'ok' : hasPendientes ? 'pending' : 'pending',
        ultimaEdicion: reporte?.ultimaEdicion || null,
        mencionesUsadas: reporte?.totalMenciones || 0,
        total: reporte?.total || 0,
      };
    });

    // ════════════════════════════════════════════════════
    // 4. DISTRIBUCION
    // ════════════════════════════════════════════════════

    const ultimasEntregas = await db.entrega.findMany({
      where: { fechaEnvio: { not: null } },
      include: { Contrato: { select: { Cliente: { select: { nombre: true } } } } },
      orderBy: { fechaEnvio: 'desc' },
      take: 5,
    }).catch(() => []);

    const ultimasFallidas = await db.entrega.findMany({
      where: { estado: 'fallido' },
      include: { Contrato: { select: { Cliente: { select: { nombre: true } } } } },
      orderBy: { fechaCreacion: 'desc' },
      take: 5,
    }).catch(() => []);

    const allEntregas = [...ultimasEntregas, ...ultimasFallidas]
      .sort((a, b) => {
        try {
          const ta = a.fechaEnvio || a.fechaCreacion;
          const tb = b.fechaEnvio || b.fechaCreacion;
          return tb.getTime() - ta.getTime();
        } catch { return 0; }
      })
      .filter((e, i, arr) => arr.findIndex(x => x.id === e.id) === i)
      .slice(0, 5);

    const ultimos = allEntregas.map(e => ({
      id: e.id,
      producto: PRODUCT_NAMES[e.tipoBoletin] || e.tipoBoletin || 'Desconocido',
      destinatario: e.Contrato?.Cliente?.nombre || 'Sin cliente',
      canal: e.canal || 'email',
      timestamp: (e.fechaEnvio || e.fechaCreacion).toISOString(),
      estado: e.estado,
      error: e.error || undefined,
    }));

    const errores = safeNum(await db.entrega.count({
      where: { estado: 'fallido', fechaCreacion: { gte: weekS } },
    }).catch(() => 0));

    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      captura: {
        hoy: safeNum(mencionesHoy),
        promedioDiario: safeNum(promedioDiario),
        sinCapturaHoras,
        fuentes,
      },
      clasificacion: {
        total: safeNum(totalMenciones),
        clasificadas: safeNum(clasificadas),
        porcentaje: safeNum(porcentaje),
        lentes,
        pendientes: safeNum(pendientes),
      },
      produccion: { semana },
      distribucion: {
        ultimos,
        errores: safeNum(errores),
      },
    });
  } catch (error) {
    // ULTIMO RECURSO: 200 con vacios. NUNCA 500.
    console.error('[dashboard/status] Unexpected error (returning degraded):', error);
    return NextResponse.json({
      status: 'degraded',
      timestamp: new Date().toISOString(),
      captura: { hoy: 0, promedioDiario: 0, sinCapturaHoras: null, fuentes: [] },
      clasificacion: { total: 0, clasificadas: 0, porcentaje: 0, lentes: [], pendientes: 0 },
      produccion: { semana: STANDARD_PRODUCTS.map(tipo => ({ nombre: PRODUCT_NAMES[tipo] || tipo, tipo, estado: 'pending', ultimaEdicion: null, mencionesUsadas: 0, total: 0 })) },
      distribucion: { ultimos: [], errores: 0 },
      message: 'Metricas no disponibles temporalmente',
    });
  }
}
