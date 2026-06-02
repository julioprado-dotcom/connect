// GET /api/dashboard/fuentes/scraping-status
//
// Retorna datos completos de scraping por cada fuente.
// Usa RAW SQL para ser resistente a columnas que puedan no existir en la DB.

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

function formatDate(val: string | null): string | null {
  if (!val) return null;
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleString('es-BO', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  } catch {
    return null;
  }
}

function deriveEstado(opts: {
  feActivo: number | null;
  ultimoCheck: string | null;
  checksSinCambio: number | null;
  fallosConsecutivos: number | null;
  totalChecks: number | null;
  error: string;
}): string {
  const fallos = opts.fallosConsecutivos || 0;
  const totalChecks = opts.totalChecks || 0;

  // Never checked → sin_estado
  if (!opts.ultimoCheck || totalChecks === 0) return 'sin_estado';

  const hoursSinceCheck = (Date.now() - new Date(opts.ultimoCheck).getTime()) / 3600000;

  // High consecutive failures → caida
  if (fallos >= 3) return 'caida';
  // No check in 72h → caida
  if (hoursSinceCheck > 72) return 'caida';

  // Actively checked (within last 6h) → activa regardless of feActivo flag
  if (hoursSinceCheck <= 6) return 'activa';

  // Checked recently (6-24h) with no failures → activa
  if (hoursSinceCheck <= 24 && fallos === 0) return 'activa';

  // Checked 24-72h, might be degrading
  const sinCambio = opts.checksSinCambio || 0;
  if (hoursSinceCheck > 48 && sinCambio >= 7) return 'degradada';
  if (fallos > 0) return 'degradada';

  // Default: active if feActivo, paused otherwise
  return opts.feActivo === 1 ? 'activa' : 'pausada';
}

// Safe number extraction from DB (handles null + BigInt)
const n = (v: unknown): number => {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'bigint') return Number(v);
  const num = Number(v);
  return isNaN(num) ? 0 : num;
};

// Safe string extraction
const s = (v: unknown): string => (v ? String(v) : '');

export async function GET() {
  try {
    // ── 1. Detect available columns in FuenteEstado ──
    const tableInfo: Array<{ name: string }> = await db.$queryRaw`
      SELECT name FROM pragma_table_info('FuenteEstado')
    `;
    const colSet = new Set(tableInfo.map(c => c.name));

    // ── 2. Fetch all active medios ──
    const medios: Array<Record<string, unknown>> = await db.$queryRaw`
      SELECT id, nombre, url, activo, tipo, nivel, categoria
      FROM Medio WHERE activo = 1
      ORDER BY nombre ASC
    `;

    // ── 3. Build columns list dynamically ──
    // Core columns always exist
    const feCols = [
      'id', 'medioId', 'url', 'tipoCheck', 'activo',
      'ultimoCheck', 'ultimoCambio', 'totalChecks', 'totalCambios',
      'checksSinCambio', 'frecuenciaBase', 'frecuenciaActual',
      'fallosConsecutivos', 'error', 'responseTime',
    ];
    // Optional columns that may not exist
    const optCols = [
      'ultimoCheckOk', 'estado', 'capaActual',
      'ultimoHeadline', 'ultimoTexto', 'ultimoMencion',
      'totalHeadlines', 'totalTexto', 'totalMenciones',
      'strategyValid', 'strategyScrape',
    ];
    const existingOptCols = optCols.filter(c => colSet.has(c));
    const allCols = [...feCols, ...existingOptCols];

    // ── 4. Fetch all FuenteEstado with only existing columns ──
    const selectClause = ['fe.medioId', ...allCols.map(c => `fe.${c}`), ...[
      'm.id AS medioId2', 'm.nombre AS medioNombre', 'm.url AS medioUrl',
      'm.activo AS medioActivo', 'm.tipo AS medioTipo',
      'm.nivel AS medioNivel', 'm.categoria AS medioCategoria',
    ]].join(', ');

    const estados: Array<Record<string, unknown>> = await db.$queryRawUnsafe(
      `SELECT ${selectClause}
       FROM FuenteEstado fe
       LEFT JOIN Medio m ON fe.medioId = m.id
       ORDER BY fe.ultimoCheck DESC`
    );

    // ── 5. Build medioId → estado map ──
    const estadoMap = new Map<string, Record<string, unknown>>();
    for (const e of estados) {
      const mid = s(e.medioId);
      if (mid) estadoMap.set(mid, e);
    }

    // ── 6. Count NotaRaw per medioId ──
    const allIds = medios.map(m => s(m.id));
    let notaRawMap = new Map<string, { total: number; pendientes: number }>();

    if (allIds.length > 0) {
      try {
        // Check if NotaRaw table exists
        const nrInfo: Array<{ name: string }> = await db.$queryRaw`
          SELECT name FROM pragma_table_info('NotaRaw')
        `;
        if (nrInfo.length > 0) {
          const placeholders = allIds.map(() => '?').join(',');
          const notaRawCounts: Array<Record<string, unknown>> = await db.$queryRawUnsafe(
            `SELECT medioId,
               CAST(COUNT(*) AS INTEGER) as total,
               CAST(SUM(CASE WHEN procesada = 0 THEN 1 ELSE 0 END) AS INTEGER) as pendientes
             FROM NotaRaw
             WHERE medioId IN (${placeholders})
             GROUP BY medioId`,
            ...allIds
          );
          notaRawMap = new Map(notaRawCounts.map(r => [s(r.medioId), { total: n(r.total), pendientes: n(r.pendientes) }]));
        }
      } catch (err) {
        console.warn('[scraping-status] NotaRaw table missing or error:', err);
      }
    }

    // ── 7. Build response ──
    const fuentes = medios.map(medio => {
      const estado = estadoMap.get(s(medio.id));
      const notaRaw = notaRawMap.get(s(medio.id)) || { total: 0, pendientes: 0 };

      if (!estado) {
        return {
          medioId: s(medio.id),
          medioNombre: s(medio.nombre),
          medioUrl: s(medio.url),
          medioTipo: s(medio.tipo),
          medioNivel: s(medio.nivel),
          medioCategoria: s(medio.categoria),
          medioActivo: medio.activo === 1,
          estado: 'sin_estado',
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
          notaRawTotal: notaRaw.total,
          notaRawPendientes: notaRaw.pendientes,
          algunaVezScrapeada: false,
        };
      }

      const derived = deriveEstado({
        feActivo: estado.activo as number | null,
        ultimoCheck: estado.ultimoCheck as string | null,
        checksSinCambio: estado.checksSinCambio as number | null,
        fallosConsecutivos: estado.fallosConsecutivos as number | null,
        totalChecks: estado.totalChecks as number | null,
        error: s(estado.error),
      });

      return {
        medioId: s(estado.medioId),
        medioNombre: s(estado.medioNombre) || s(medio.nombre),
        medioUrl: s(estado.medioUrl) || s(medio.url),
        medioTipo: s(estado.medioTipo) || s(medio.tipo),
        medioNivel: s(estado.medioNivel) || s(medio.nivel),
        medioCategoria: s(estado.medioCategoria) || s(medio.categoria),
        medioActivo: (estado.medioActivo as number) === 1 || medio.activo === 1,

        estado: derived,

        // Dates - always safe since we use colSet to only select existing columns
        ultimoCheck: estado.ultimoCheck ? String(estado.ultimoCheck) : null,
        ultimoCheckFecha: formatDate(estado.ultimoCheck as string | null),
        ultimoCheckHace: timeAgo(estado.ultimoCheck ? new Date(String(estado.ultimoCheck)) : null),

        ultimoCheckOk: estado.ultimoCheckOk ? String(estado.ultimoCheckOk) : null,
        ultimoCheckOkFecha: formatDate(estado.ultimoCheckOk as string | null),
        ultimoCheckOkHace: timeAgo(estado.ultimoCheckOk ? new Date(String(estado.ultimoCheckOk)) : null),

        ultimoCambio: estado.ultimoCambio ? String(estado.ultimoCambio) : null,
        ultimoCambioFecha: formatDate(estado.ultimoCambio as string | null),

        ultimoHeadline: estado.ultimoHeadline ? String(estado.ultimoHeadline) : null,
        ultimoHeadlineFecha: formatDate(estado.ultimoHeadline as string | null),
        ultimoHeadlineHace: timeAgo(estado.ultimoHeadline ? new Date(String(estado.ultimoHeadline)) : null),

        ultimoTexto: estado.ultimoTexto ? String(estado.ultimoTexto) : null,
        ultimoTextoFecha: formatDate(estado.ultimoTexto as string | null),

        ultimoMencion: estado.ultimoMencion ? String(estado.ultimoMencion) : null,
        ultimoMencionFecha: formatDate(estado.ultimoMencion as string | null),
        ultimoMencionHace: timeAgo(estado.ultimoMencion ? new Date(String(estado.ultimoMencion)) : null),

        totalChecks: n(estado.totalChecks),
        totalCambios: n(estado.totalCambios),
        totalHeadlines: n(estado.totalHeadlines),
        totalTexto: n(estado.totalTexto),
        totalMenciones: n(estado.totalMenciones),

        fallosConsecutivos: n(estado.fallosConsecutivos),
        checksSinCambio: n(estado.checksSinCambio),
        error: s(estado.error),
        responseTime: n(estado.responseTime),
        capaActual: n(estado.capaActual),
        frecuenciaActual: s(estado.frecuenciaActual) || '-',
        strategyValid: s(estado.strategyValid),
        strategyScrape: s(estado.strategyScrape),

        notaRawTotal: notaRaw.total,
        notaRawPendientes: notaRaw.pendientes,

        algunaVezScrapeada: n(estado.totalChecks) > 0,
      };
    });

    // ── 8. Summary ──
    const resumen = {
      totalFuentes: fuentes.length,
      conEstado: fuentes.filter(f => f.estado !== 'sin_estado').length,
      sinEstado: fuentes.filter(f => f.estado === 'sin_estado').length,
      algunaVezScrapeadas: fuentes.filter(f => f.algunaVezScrapeada).length,
      nuncaScrapeadas: fuentes.filter(f => !f.algunaVezScrapeada).length,
      activas: fuentes.filter(f => f.estado === 'activa').length,
      degradadas: fuentes.filter(f => f.estado === 'degradada').length,
      caidas: fuentes.filter(f => f.estado === 'caida').length,
      pausadas: fuentes.filter(f => f.estado === 'pausada').length,
      conNotasRaw: fuentes.filter(f => f.notaRawTotal > 0).length,
      notasRawTotal: fuentes.reduce((s, f) => s + f.notaRawTotal, 0),
      notasRawPendientes: fuentes.reduce((s, f) => s + f.notaRawPendientes, 0),
      mencionesTotal: fuentes.reduce((s, f) => s + f.totalMenciones, 0),
    };

    return NextResponse.json({ fuentes, resumen });
  } catch (error: unknown) {
    console.error('[API /dashboard/fuentes/scraping-status GET]', error);
    return NextResponse.json(
      { error: guardError(error, 'dashboard/fuentes/scraping-status') },
      { status: 500 },
    );
  }
}
