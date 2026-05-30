/**
 * @module indicadores.fetchers
 * @description Fetcher functions and fallback chain for the Indicadores service.
 *
 * Contains all data fetching logic (Yahoo Finance, Stooq, Investing.com, scraping),
 * utility functions (parsing, conversion, variation), and the core fallback chain.
 * Extracted from indicadores.ts.
 */

import type {
  IndicadorReal,
  SlugIndicador,
  FetchError,
} from './indicadores.types';
import {
  INDICADOR_META,
  FUENTES_POR_INDICADOR,
  knownValues,
  YAHOO_MULTIPLIER,
  STOOQ_MULTIPLIER,
} from './indicadores.constants';
import { cache, serviceConfig, getFromCache, setCache } from './indicadores.cache';

// ─── Utilidades internas ───────────────────────────────────────────────────

/**
 * Obtiene la fecha actual en formato ISO 8601 (YYYY-MM-DD).
 */
export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Realiza un fetch con timeout usando AbortController.
 *
 * @param url - URL a solicitar
 * @param timeoutMs - Timeout en milisegundos
 * @returns Response de fetch
 * @throws Error si el timeout es excedido o hay error de red
 */
export async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; DECODEX-Bolivia/1.0; IndicadoresService)',
        Accept: 'text/html,application/json,*/*',
      },
    });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Calcula la variación porcentual entre un valor actual y uno anterior.
 *
 * @param current - Valor actual
 * @param previous - Valor anterior
 * @returns Variación porcentual con 2 decimales
 */
export function calcularVariacion(current: number, previous: number): number {
  if (previous === 0) return 0;
  return Number((((current - previous) / Math.abs(previous)) * 100).toFixed(2));
}

/**
 * Parsea un número desde texto HTML eliminando separadores de miles.
 * Soporta formatos: "1,234.56", "1.234,56", "1234.56"
 *
 * @param text - Texto con número
 * @returns Número parseado o null si no se puede extraer
 */
export function parseNumber(text: string): number | null {
  // Intentar extraer un patrón numérico del texto
  const cleaned = text.replace(/[^\d.,\-]/g, '').trim();
  if (!cleaned) return null;

  // Detectar formato: si tiene , y . → posible formato europeo (1.234,56)
  const hasComma = cleaned.includes(',');
  const hasDot = cleaned.includes('.');

  let normalized = cleaned;
  if (hasComma && hasDot) {
    // Determinar cuál es el separador decimal
    const lastComma = cleaned.lastIndexOf(',');
    const lastDot = cleaned.lastIndexOf('.');
    if (lastComma > lastDot) {
      // Formato europeo: 1.234,56
      normalized = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      // Formato anglosajón: 1,234.56
      normalized = cleaned.replace(/,/g, '');
    }
  } else if (hasComma) {
    // Solo coma: asumir decimal (0,56 → 0.56) o miles (1,234 → 1234)
    const parts = cleaned.split(',');
    if (parts.length === 2 && parts[1]!.length === 3 && parts[0]!.length > 0) {
      // Parece separador de miles
      normalized = cleaned.replace(',', '');
    } else if (parts.length === 2 && parts[1]!.length <= 2) {
      // Parece decimal
      normalized = cleaned.replace(',', '.');
    } else {
      normalized = cleaned.replace(/,/g, '');
    }
  }

  const num = Number(normalized);
  return Number.isFinite(num) ? num : null;
}

/**
 * Crea un indicador de fallback usando el último valor conocido.
 *
 * @param slug - Slug del indicador
 * @param errorMensaje - Mensaje de error que causó el fallback
 * @returns Indicador con confiable=false
 */
export function createFallbackIndicador(
  slug: SlugIndicador,
  _errorMensaje: string,
): IndicadorReal {
  const meta = INDICADOR_META[slug];
  const valor = knownValues[slug];
  const previousEntry = cache.get(slug);
  const previousValor = previousEntry?.indicador.valor ?? valor;

  return {
    slug,
    nombre: meta.nombre,
    valor,
    unidad: meta.unidad,
    moneda: meta.moneda,
    fecha: todayISO(),
    fuente: 'fallback (último valor conocido)',
    confiable: false,
    variacion: calcularVariacion(valor, previousValor),
    categoria: meta.categoria,
  };
}

// ─── Fetchers por fuente ───────────────────────────────────────────────────

/**
 * Intenta obtener el precio de un metal desde Yahoo Finance API v8.
 *
 * @param yahooSymbol - Símbolo de Yahoo Finance
 * @param slug - Slug del indicador (para metadatos)
 * @param sourceName - Nombre de la fuente para el resultado
 * @returns Indicador o null si falla
 */
export async function fetchFromYahooFinance(
  yahooSymbol: string,
  slug: SlugIndicador,
  sourceName: string,
): Promise<IndicadorReal | null> {
  const meta = INDICADOR_META[slug];
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1d&range=2d`;

  try {
    const response = await fetchWithTimeout(url, serviceConfig.defaultTimeout);

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as {
      chart?: {
        result?: Array<{
          meta?: { regularMarketPrice?: number; previousClose?: number };
        }>;
      };
    };

    const price = data.chart?.result?.[0]?.meta?.regularMarketPrice;
    const prevClose = data.chart?.result?.[0]?.meta?.previousClose;

    if (price === undefined || price === null || !Number.isFinite(price)) {
      return null;
    }

    // Aplicar conversión de unidades según la fuente Yahoo
    const multiplier = YAHOO_MULTIPLIER[slug] ?? 1;
    const convertedPrice = Number((price * multiplier).toFixed(2));
    const rawPrev = prevClose ?? price;
    const convertedPrev = Number((rawPrev * multiplier).toFixed(2));

    const previousEntry = cache.get(slug);
    const previousValor = previousEntry?.indicador.valor ?? convertedPrev;

    return {
      slug,
      nombre: meta.nombre,
      valor: convertedPrice,
      unidad: meta.unidad,
      moneda: meta.moneda,
      fecha: todayISO(),
      fuente: sourceName,
      confiable: true,
      variacion: calcularVariacion(convertedPrice, previousValor),
      categoria: meta.categoria,
    };
  } catch {
    return null;
  }
}

/**
 * Intenta obtener un indicador vía scraping genérico de una URL.
 * Busca patrones numéricos relevantes en el HTML de respuesta.
 *
 * @param url - URL a scrapepear
 * @param slug - Slug del indicador
 * @param sourceName - Nombre de la fuente
 * @param pattern - Patrón regex para extraer el valor (opcional)
 * @returns Indicador o null si falla
 */
export async function fetchFromScraping(
  url: string,
  slug: SlugIndicador,
  sourceName: string,
  pattern?: RegExp,
): Promise<IndicadorReal | null> {
  const meta = INDICADOR_META[slug];

  try {
    const response = await fetchWithTimeout(url, serviceConfig.defaultTimeout);

    if (!response.ok) {
      return null;
    }

    const html = await response.text();

    // Intentar extraer con patrón personalizado
    if (pattern) {
      const match = html.match(pattern);
      if (match?.[1]) {
        const valor = parseNumber(match[1]);
        if (valor !== null && valor > 0) {
          const previousEntry = cache.get(slug);
          const previousValor = previousEntry?.indicador.valor ?? valor;

          return {
            slug,
            nombre: meta.nombre,
            valor,
            unidad: meta.unidad,
            moneda: meta.moneda,
            fecha: todayISO(),
            fuente: sourceName,
            confiable: true,
            variacion: calcularVariacion(valor, previousValor),
            categoria: meta.categoria,
          };
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Intenta obtener el precio de un metal desde Stooq.com (CSV gratuito, sin API key).
 *
 * Stooq devuelve CSV con columnas: Symbol, Date, Time, Open, High, Low, Close, Volume.
 * Parseamos la fila más reciente para obtener el precio de cierre.
 */
export async function fetchFromStooq(
  url: string,
  slug: SlugIndicador,
  sourceName: string,
): Promise<IndicadorReal | null> {
  const meta = INDICADOR_META[slug];

  try {
    const response = await fetchWithTimeout(url, serviceConfig.defaultTimeout);

    if (!response.ok) {
      return null;
    }

    const csv = await response.text();

    const lines = csv.trim().split('\n');
    if (lines.length < 2) return null;

    const recentLine = lines[1];
    if (!recentLine) return null;

    const cols = recentLine.split(',');

    // Close price: try col 6 first (Symbol,Date,Time,O,H,L,C,Vol), fallback col 4
    let closePrice = NaN;
    if (cols[6] !== undefined) {
      closePrice = parseFloat(cols[6]);
    }
    if (!Number.isFinite(closePrice) || closePrice <= 0) {
      closePrice = cols[4] !== undefined ? parseFloat(cols[4]) : NaN;
    }

    // N/D check — Stooq returns "N/D" for unavailable data
    if (!Number.isFinite(closePrice) || closePrice <= 0) {
      return null;
    }

    // Previous row for variation
    let prevClosePrice = NaN;
    if (lines[2]) {
      const prevCols = lines[2].split(',');
      prevClosePrice = prevCols[6] !== undefined ? parseFloat(prevCols[6]) : (prevCols[4] !== undefined ? parseFloat(prevCols[4]) : NaN);
    }

    const multiplier = STOOQ_MULTIPLIER[slug] ?? 1;
    const convertedPrice = Number((closePrice * multiplier).toFixed(2));
    const convertedPrev = Number.isFinite(prevClosePrice) && prevClosePrice > 0
      ? Number((prevClosePrice * multiplier).toFixed(2))
      : convertedPrice;

    const previousEntry = cache.get(slug);
    const previousValor = previousEntry?.indicador.valor ?? convertedPrev;

    return {
      slug,
      nombre: meta.nombre,
      valor: convertedPrice,
      unidad: meta.unidad,
      moneda: meta.moneda,
      fecha: todayISO(),
      fuente: sourceName,
      confiable: true,
      variacion: calcularVariacion(convertedPrice, previousValor),
      categoria: meta.categoria,
    };
  } catch {
    return null;
  }
}

/**
 * Intenta obtener el precio de un metal desde Investing.com (scraping).
 * Investing.com muestra precios de commodities en páginas dedicadas.
 */
export async function fetchFromInvestingCom(
  url: string,
  slug: SlugIndicador,
  sourceName: string,
): Promise<IndicadorReal | null> {
  const meta = INDICADOR_META[slug];

  try {
    const response = await fetchWithTimeout(url, serviceConfig.defaultTimeout);

    if (!response.ok) {
      return null;
    }

    const html = await response.text();

    // Investing.com commodity pages embed prices in data-test attributes or JSON
    const patterns = [
      /data-test="instrument-header-last"[^>]*>([^<]+)/i,
      /class="[^"]*instrument-price[^"]*"[^>]*>([^<]+)/i,
      /class="[^"]*last-price[^"]*"[^>]*>([^<]+)/i,
      /"last":\s*"?([\d,.]+)"?/,
      /class="[^"]*key-info[^"]*"[^>]*data-value="([\d,.]+)"/i,
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match?.[1]) {
        const valor = parseNumber(match[1]);
        if (valor !== null && valor > 0) {
          const previousEntry = cache.get(slug);
          const previousValor = previousEntry?.indicador.valor ?? valor;

          return {
            slug,
            nombre: meta.nombre,
            valor: Number(valor.toFixed(2)),
            unidad: meta.unidad,
            moneda: meta.moneda,
            fecha: todayISO(),
            fuente: sourceName,
            confiable: true,
            variacion: calcularVariacion(valor, previousValor),
            categoria: meta.categoria,
          };
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Intenta obtener el tipo de cambio paralelo estimado basándose en la
 * diferencia histórica promedio vs el tipo de cambio oficial.
 *
 * El spread promedio histórico entre paralelo y oficial en Bolivia
 * es aproximadamente de 2-5%. Se usa un estimador conservador del 3%.
 *
 * @param oficialValor - Valor del tipo de cambio oficial
 * @returns Indicador estimado del tipo de cambio paralelo
 */
export function estimateParalelo(oficialValor: number): IndicadorReal {
  const PARALELO_SPREAD = 0.03; // 3% spread promedio histórico
  const estimatedValor = Number((oficialValor * (1 + PARALELO_SPREAD)).toFixed(2));

  const previousEntry = cache.get('tc-paralelo');
  const previousValor = previousEntry?.indicador.valor ?? estimatedValor;

  return {
    slug: 'tc-paralelo',
    nombre: INDICADOR_META['tc-paralelo'].nombre,
    valor: estimatedValor,
    unidad: 'BOB/USD',
    moneda: 'BOB',
    fecha: todayISO(),
    fuente: 'estimación (spread 3% vs oficial)',
    confiable: false,
    variacion: calcularVariacion(estimatedValor, previousValor),
    categoria: 'tipo_cambio',
  };
}

// ─── Fallback chain por indicador ───────────────────────────────────────────

/**
 * Intenta obtener un indicador recorriendo la cadena de fallback:
 * 1. Revisar caché válido
 * 2. Intentar fuente primaria
 * 3. Intentar fuente secundaria (si existe)
 * 4. Usar último valor conocido (confiable=false)
 *
 * @param slug - Slug del indicador a obtener
 * @returns Indicador obtenido o null
 */
export async function fetchIndicadorWithFallback(slug: SlugIndicador): Promise<{
  indicador: IndicadorReal | null;
  errores: FetchError[];
  fuentesUsadas: string[];
}> {
  const errores: FetchError[] = [];
  const fuentesUsadas: string[] = [];

  // 0. Revisar caché primero
  const cached = getFromCache(slug);
  if (cached) {
    fuentesUsadas.push('cache');
    return { indicador: cached, errores, fuentesUsadas };
  }

  const meta = INDICADOR_META[slug];
  const fuentes = FUENTES_POR_INDICADOR[slug];
  let indicador: IndicadorReal | null = null;

  // 1. Intentar cada fuente configurada
  for (const fuente of fuentes) {
    if (!fuente.activa) continue;

    fuentesUsadas.push(fuente.nombre);

    try {
      if (fuente.tipo === 'api' && meta.yahooSymbol) {
        // Yahoo Finance API
        indicador = await fetchFromYahooFinance(
          meta.yahooSymbol,
          slug,
          fuente.nombre,
        );
      } else if (fuente.tipo === 'stooq') {
        // Stooq CSV
        indicador = await fetchFromStooq(
          fuente.url,
          slug,
          fuente.nombre,
        );
      } else if (fuente.tipo === 'investing_com') {
        // Investing.com scraping
        indicador = await fetchFromInvestingCom(
          fuente.url,
          slug,
          fuente.nombre,
        );
      } else if (fuente.tipo === 'scraping') {
        // Scraping genérico
        indicador = await fetchFromScraping(
          fuente.url,
          slug,
          fuente.nombre,
        );
      }

      if (indicador) {
        // Éxito: cachear y retornar
        setCache(indicador);
        return { indicador, errores, fuentesUsadas };
      }

      // La fuente no retornó datos
      errores.push({
        slug,
        fuente: fuente.nombre,
        mensaje: `Fuente ${fuente.nombre} no retornó datos válidos`,
        recuperable: true,
      });
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : 'Error desconocido';

      errores.push({
        slug,
        fuente: fuente.nombre,
        mensaje: `Error consultando ${fuente.nombre}: ${errorMsg}`,
        recuperable: !(errorMsg.includes('timeout') || errorMsg.includes('aborted')),
      });
    }
  }

  // 2. Fallback especial para tipo de cambio paralelo
  if (slug === 'tc-paralelo' && !indicador) {
    // Intentar usar el valor oficial si está disponible
    const oficialEntry = cache.get('tc-oficial-bcb');
    if (oficialEntry && oficialEntry.indicador.confiable) {
      const paralelo = estimateParalelo(oficialEntry.indicador.valor);
      setCache(paralelo);
      fuentesUsadas.push('estimación-paralelo');
      return { indicador: paralelo, errores, fuentesUsadas };
    }
  }

  // 3. Último recurso: valor conocido con confiable=false
  const fallback = createFallbackIndicador(slug, 'Todas las fuentes fallaron');
  fuentesUsadas.push('fallback-known-value');

  return { indicador: fallback, errores, fuentesUsadas };
}
