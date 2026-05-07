/**
 * yahoo-finance.ts — DECODEX Bolivia
 * Obtiene precios de metales desde Yahoo Finance (API v8 chart).
 * Cache en memoria de 4 horas. Nunca bloquea al llamador ante errores.
 */

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface PrecioMetal {
  metal: string;
  simbolo: string;
  precioActual: number;
  precioApertura: number;
  variacionSemanal: number;
  moneda: string;
  fecha: string;
}

interface YahooCandle {
  open: number;
  high: number;
  low: number;
  close: number;
  timestamp: number;
}

interface YahooMeta {
  regularMarketPrice: number;
  regularMarketTime: number;
  previousClose: number | null;
}

interface YahooResult {
  meta: YahooMeta;
  timestamp?: number[];
  indicators?: {
    quote?: {
      open?: (number | null)[];
      close?: (number | null)[];
      high?: (number | null)[];
      low?: (number | null)[];
    }[];
  };
}

interface YahooResponse {
  chart?: {
    result?: YahooResult[];
    error?: { code: string; description: string };
  };
}

// ─── Configuración de metales ────────────────────────────────────────────────

const METALES: Array<{ metal: string; simbolo: string; moneda: string }> = [
  { metal: "Oro", simbolo: "GC=F", moneda: "USD/oz" },
  { metal: "Plata", simbolo: "SI=F", moneda: "USD/oz" },
  { metal: "Zinc", simbolo: "ZI=F", moneda: "USD/lb" },
  { metal: "Estaño", simbolo: "SN=F", moneda: "USD/lb" },
  { metal: "Cobre", simbolo: "HG=F", moneda: "USD/lb" },
  { metal: "Litio", simbolo: "LI=F", moneda: "USD/mt" },
];

const YAHOO_BASE_URL =
  "https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?range=5d&interval=1d";

/** Duración del cache en milisegundos (4 horas) */
const CACHE_TTL_MS = 4 * 60 * 60 * 1000;

// ─── Cache en memoria ────────────────────────────────────────────────────────

let cache: PrecioMetal[] = [];
let cacheTimestamp: number = 0;

function isCacheValid(): boolean {
  return cache.length > 0 && Date.now() - cacheTimestamp < CACHE_TTL_MS;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function yahooUrl(simbolo: string): string {
  return YAHOO_BASE_URL.replace("{symbol}", simbolo);
}

/**
 * Calcula la variación semanal en porcentaje:
 * ((precioViernes - precioLunes) / precioLunes) * 100
 *
 * Usa los velas diarias disponibles (range=5d). Si no hay al menos
 * dos velas válidas retorna 0.
 */
function calcularVariacionSemanal(result: YahooResult): number {
  const quotes = result.indicators?.quote?.[0];
  const timestamps = result.timestamp;

  if (!quotes || !timestamps || timestamps.length < 2) return 0;

  const closeValues: YahooCandle[] = [];

  for (let i = 0; i < timestamps.length; i++) {
    const open = quotes.open?.[i];
    const close = quotes.close?.[i];
    if (open != null && close != null && close > 0) {
      closeValues.push({ open, close, timestamp: timestamps[i] } as YahooCandle);
    }
  }

  if (closeValues.length < 2) return 0;

  const priceMonday = closeValues[0].close;
  const priceFriday = closeValues[closeValues.length - 1].close;

  if (priceMonday === 0) return 0;

  return ((priceFriday - priceMonday) / priceMonday) * 100;
}

function fechaFromTimestamp(ts: number): string {
  return new Date(ts * 1000).toISOString().slice(0, 10);
}

// ─── Fetch individual ────────────────────────────────────────────────────────

async function fetchPrecioMetal(
  config: typeof METALES[number]
): Promise<PrecioMetal | null> {
  const url = yahooUrl(config.simbolo);

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; DECODEX-Bolivia/1.0; +https://decodex.bo)",
      },
      signal: AbortSignal.timeout(10_000), // 10 s timeout
    });

    if (!res.ok) {
      console.warn(
        `[yahoo-finance] HTTP ${res.status} para ${config.simbolo} (${config.metal})`
      );
      return null;
    }

    const data: YahooResponse = await res.json();

    const chartError = data.chart?.error;
    if (chartError) {
      console.warn(
        `[yahoo-finance] Error de Yahoo para ${config.simbolo}: ${chartError.code} – ${chartError.description}`
      );
      return null;
    }

    const result = data.chart?.result?.[0];
    if (!result) {
      console.warn(
        `[yahoo-finance] Sin resultado para ${config.simbolo} (${config.metal})`
      );
      return null;
    }

    const { meta } = result;
    const precioActual = meta.regularMarketPrice;
    const fecha = fechaFromTimestamp(meta.regularMarketTime);

    // Precio de apertura del día más reciente
    const quotes = result.indicators?.quote?.[0];
    const openArr = quotes?.open;
    let precioApertura = precioActual;

    if (openArr) {
      // La última vela disponible
      for (let i = openArr.length - 1; i >= 0; i--) {
        if (openArr[i] != null && openArr[i]! > 0) {
          precioApertura = openArr[i]!;
          break;
        }
      }
    }

    const variacionSemanal = calcularVariacionSemanal(result);

    return {
      metal: config.metal,
      simbolo: config.simbolo,
      precioActual: Math.round(precioActual * 100) / 100,
      precioApertura: Math.round(precioApertura * 100) / 100,
      variacionSemanal: Math.round(variacionSemanal * 100) / 100,
      moneda: config.moneda,
      fecha,
    };
  } catch (err) {
    console.warn(
      `[yahoo-finance] Error conectando a Yahoo para ${config.simbolo} (${config.metal}):`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

// ─── Función principal ───────────────────────────────────────────────────────

/**
 * obtenerPreciosMetales()
 *
 * Obtiene los precios actuales de los principales metales desde Yahoo Finance.
 *
 * - Cache en memoria de 4 horas para evitar saturar la API.
 * - Si Yahoo falla (timeout, HTTP error, datos vacíos), retorna un array vacío
 *   y registra un warning — nunca lanza ni bloquea al llamador.
 *
 * @returns Array de objetos PrecioMetal con los 6 metales configurados.
 */
export async function obtenerPreciosMetales(): Promise<PrecioMetal[]> {
  // ── Retornar cache si sigue vigente ──────────────────────────────────────
  if (isCacheValid()) {
    return cache;
  }

  // ── Consultar Yahoo en paralelo ─────────────────────────────────────────
  const resultados = await Promise.allSettled(
    METALES.map((cfg) => fetchPrecioMetal(cfg))
  );

  const precios: PrecioMetal[] = [];

  for (const r of resultados) {
    if (r.status === "fulfilled" && r.value !== null) {
      precios.push(r.value);
    }
  }

  // Si fallaron todas las peticiones, avisar y devolver vacío
  if (precios.length === 0) {
    console.warn(
      "[yahoo-finance] No se pudo obtener ningún precio de metales. Se retorna array vacío."
    );
    return [];
  }

  // ── Actualizar cache ────────────────────────────────────────────────────
  cache = precios;
  cacheTimestamp = Date.now();

  return precios;
}
