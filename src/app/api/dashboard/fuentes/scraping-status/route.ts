// GET /api/dashboard/fuentes/scraping-status
//
// Retorna datos completos de scraping por cada fuente:
// - Medio: nombre, url, activo
// - Fechas: ultimoCheck, ultimoCheckOk, ultimoCambio, ultimoHeadline, ultimoTexto, ultimoMencion
// - Contadores: totalChecks, totalCambios, totalHeadlines, totalTexto, totalMenciones
// - Estado: fallosConsecutivos, error, estado derivado
// - NotaRaw: total y pendientes por medio

import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { guardError } from '@/lib/rate-guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function timeAgo(date: Date | null): string {
  if (!date) return 'nunca';
  const diff = Date.now() - date.getTime();
  if (diff < 0) return 'ahora';
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'ahora';
  if (mins < 60) return `hace ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return `hace ${days}d`;
}

function formatDate(date: Date | null): string | null {
  if (!date) return null;
  return date.toLocaleString('es-BO', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

// Derive a readable estado from FuenteEstado fields
function deriveEstado(estado: {
  activo: boolean;
  ultimoCheck: Date | null;
  checksSinCambio: number;
  fallosConsecutivos: number;
  error: string;
  medioNombre: string;
}): string {
  if (!estado.activo) return 'pausada';
  if (estado.fallosConsecutivos >= 3) return 'caida';
  if (!estado.ultimoCheck) return 'sin_estado';
  const hoursSinceCheck = (Date.now() - estado.ultimoCheck.getTime()) / 3600000;
  if (hoursSinceCheck > 72) return 'caida';
  if (hoursSinceCheck > 48 && estado.checksSinCambio >= 7) return 'degradada';
  if (estado.fallosConsecutivos > 0) return 'degradada';
  return 'activa';
}

export async function GET() {
  try {
    // 1. Fetch all FuenteEstado with Medio info
    const estados = await db.fuenteEstado.findMany({
      include: {
        Medio: {
          select: {
            id: true,
            nombre: true,
            url: true,
            activo: true,
            tipo: true,
            nivel: true,
            categoria: true,
          },
        },
      },
      orderBy: { ultimoCheck: 'desc' },
    });

    // 2. Fetch medios WITHOUT FuenteEstado (registered but never scraped)
    const mediosConEstado = new Set(estados.map(e => e.medioId));
    const mediosSinEstado = await db.medio.findMany({
      where: {
        activo: true,
        id: { notIn: Array.from(mediosConEstado) },
      },
      select: {
        id: true,
        nombre: true,
        url: true,
        activo: true,
        tipo: true,
        nivel: true,
        categoria: true,
      },
      orderBy: { nombre: 'asc' },
    });

    // 3. Count NotaRaw per medioId (total and pending)
    const allMedioIds = [
      ...estados.map(e => e.medioId),
      ...mediosSinEstado.map(m => m.id),
    ];

    let notaRawMap = new Map<string, { total: number; pendientes: number }>();
    if (allMedioIds.length > 0) {
      try {
        const notaRawCounts = await db.$queryRaw<Array<{ medioId: string; total: number; pendientes: number }>>(
          `SELECT medioId,
             COUNT(*) as total,
             SUM(CASE WHEN procesada = 0 THEN 1 ELSE 0 END) as pendientes
           FROM NotaRaw
           WHERE medioId IN (${allMedioIds.map(() => '?').join(',')})
           GROUP BY medioId`,
          ...allMedioIds
        );
        notaRawMap = new Map(notaRawCounts.map(n => [n.medioId, { total: n.total, pendientes: n.pendientes }]));
      } catch (err) {
        console.warn('[scraping-status] Error counting NotaRaw:', err);
      }
    }

    // 4. Build enriched response for fuentes WITH estado
    const fuentesConEstado = estados.map(estado => {
      const medio = estado.Medio;
      const derived = deriveEstado({
        activo: estado.activo,
        ultimoCheck: estado.ultimoCheck,
        checksSinCambio: estado.checksSinCambio,
        fallosConsecutivos: estado.fallosConsecutivos,
        error: estado.error || '',
        medioNombre: medio.nombre,
      });

      const notaRaw = notaRawMap.get(estado.medioId) || { total: 0, pendientes: 0 };

      return {
        medioId: estado.medioId,
        medioNombre: medio.nombre,
        medioUrl: medio.url,
        medioTipo: medio.tipo,
        medioNivel: medio.nivel,
        medioCategoria: medio.categoria,
        medioActivo: medio.activo,

        // Estado derivado
        estado: derived,

        // Fechas de scraping (raw ISO + formateado + timeAgo)
        ultimoCheck: estado.ultimoCheck?.toISOString() ?? null,
        ultimoCheckFecha: formatDate(estado.ultimoCheck),
        ultimoCheckHace: timeAgo(estado.ultimoCheck),

        ultimoCheckOk: estado.ultimoCheckOk?.toISOString() ?? null,
        ultimoCheckOkFecha: formatDate(estado.ultimoCheckOk),
        ultimoCheckOkHace: timeAgo(estado.ultimoCheckOk),

        ultimoCambio: estado.ultimoCambio?.toISOString() ?? null,
        ultimoCambioFecha: formatDate(estado.ultimoCambio),

        ultimoHeadline: estado.ultimoHeadline?.toISOString() ?? null,
        ultimoHeadlineFecha: formatDate(estado.ultimoHeadline),
        ultimoHeadlineHace: timeAgo(estado.ultimoHeadline),

        ultimoTexto: estado.ultimoTexto?.toISOString() ?? null,
        ultimoTextoFecha: formatDate(estado.ultimoTexto),

        ultimoMencion: estado.ultimoMencion?.toISOString() ?? null,
        ultimoMencionFecha: formatDate(estado.ultimoMencion),
        ultimoMencionHace: timeAgo(estado.ultimoMencion),

        // Contadores
        totalChecks: estado.totalChecks,
        totalCambios: estado.totalCambios,
        totalHeadlines: estado.totalHeadlines,
        totalTexto: estado.totalTexto,
        totalMenciones: estado.totalMenciones,

        // Estado técnico
        fallosConsecutivos: estado.fallosConsecutivos,
        checksSinCambio: estado.checksSinCambio,
        error: estado.error || '',
        responseTime: estado.responseTime,
        capaActual: estado.capaActual,
        frecuenciaActual: estado.frecuenciaActual,
        strategyValid: estado.strategyValid,
        strategyScrape: estado.strategyScrape,

        // NotaRaw
        notaRawTotal: notaRaw.total,
        notaRawPendientes: notaRaw.pendientes,

        // Flag: fue scrapeada alguna vez
        algunaVezScrapeada: (estado.totalChecks || 0) > 0,
      };
    });

    // 5. Build response for medios WITHOUT estado (never scraped)
    const fuentesSinEstado = mediosSinEstado.map(medio => ({
      medioId: medio.id,
      medioNombre: medio.nombre,
      medioUrl: medio.url,
      medioTipo: medio.tipo,
      medioNivel: medio.nivel,
      medioCategoria: medio.categoria,
      medioActivo: medio.activo,
      estado: 'sin_estado' as string,
      ultimoCheck: null,
      ultimoCheckFecha: null,
      ultimoCheckHace: 'nunca',
      ultimoCheckOk: null,
      ultimoCheckOkFecha: null,
      ultimoCheckOkHace: 'nunca',
      ultimoCambio: null,
      ultimoCambioFecha: null,
      ultimoHeadline: null,
      ultimoHeadlineFecha: null,
      ultimoHeadlineHace: 'nunca',
      ultimoTexto: null,
      ultimoTextoFecha: null,
      ultimoMencion: null,
      ultimoMencionFecha: null,
      ultimoMencionHace: 'nunca',
      totalChecks: 0,
      totalCambios: 0,
      totalHeadlines: 0,
      totalTexto: 0,
      totalMenciones: 0,
      fallosConsecutivos: 0,
      checksSinCambio: 0,
      error: '',
      responseTime: 0,
      capaActual: 0,
      frecuenciaActual: '-',
      strategyValid: '',
      strategyScrape: '',
      notaRawTotal: 0,
      notaRawPendientes: 0,
      algunaVezScrapeada: false,
    }));

    // 6. Combine: con estado first (ordered by ultimoCheck desc), then sin estado
    const todasFuentes = [...fuentesConEstado, ...fuentesSinEstado];

    // 7. Summary stats
    const resumen = {
      totalFuentes: todasFuentes.length,
      conEstado: fuentesConEstado.length,
      sinEstado: fuentesSinEstado.length,
      algunaVezScrapeadas: fuentesConEstado.filter(f => f.algunaVezScrapeada).length,
      nuncaScrapeadas: todasFuentes.filter(f => !f.algunaVezScrapeada).length,
      activas: todasFuentes.filter(f => f.estado === 'activa').length,
      degradadas: todasFuentes.filter(f => f.estado === 'degradada').length,
      caidas: todasFuentes.filter(f => f.estado === 'caida').length,
      pausadas: todasFuentes.filter(f => f.estado === 'pausada').length,
      conNotasRaw: todasFuentes.filter(f => f.notaRawTotal > 0).length,
      notasRawTotal: todasFuentes.reduce((s, f) => s + f.notaRawTotal, 0),
      notasRawPendientes: todasFuentes.reduce((s, f) => s + f.notaRawPendientes, 0),
      mencionesTotal: todasFuentes.reduce((s, f) => s + f.totalMenciones, 0),
    };

    return NextResponse.json({
      fuentes: todasFuentes,
      resumen,
    });
  } catch (error: unknown) {
    console.error('[API /dashboard/fuentes/scraping-status GET]', error);
    return NextResponse.json(
      { error: guardError(error, 'dashboard/fuentes/scraping-status') },
      { status: 500 },
    );
  }
}
