/**
 * @module indicadores
 * @description Servicio principal del Módulo A3 - Indicadores Reales de Bolivia.
 *
 * Obtiene indicadores económicos reales de fuentes públicas gratuitas para
 * enriquecer boletines e informes del proyecto DECODEX Bolivia.
 *
 * Características principales:
 * - Sistema de fallback por indicador (primaria → secundaria → caché)
 * - Cache en memoria con TTL configurable (default: 1 hora)
 * - Timeout por fuente (default: 10 segundos)
 * - Costo: $0 USD (todas las fuentes son públicas)
 * - Zero dependencies (solo fetch nativo de Node.js 18+)
 *
 * @example
 * ```typescript
 * import { fetchIndicadores, getAllIndicadores } from './indicadores';
 *
 * // Obtener indicadores específicos
 * const result = await fetchIndicadores(['lme-cobre', 'tc-oficial-bcb']);
 * console.log(result.indicadores);
 *
 * // Obtener todos los indicadores
 * const all = await getAllIndicadores();
 * ```
 */

import type {
  IndicadorReal,
  SlugIndicador,
  FetchIndicadoresResult,
  FetchError,
  CategoriaIndicador,
  CategoriaInfo,
} from './indicadores.types';

// ─── Re-export constants ────────────────────────────────────────────────────

export {
  DEFAULT_CACHE_TTL,
  DEFAULT_TIMEOUT,
  ALL_SLUGS,
  INDICADOR_META,
  FUENTES_POR_INDICADOR,
  CATEGORIAS,
  knownValues,
  TROY_OZ_PER_TON,
  LB_PER_TON,
  YAHOO_MULTIPLIER,
  STOOQ_MULTIPLIER,
  convertUnit,
} from './indicadores.constants';

export type { IndicadorMeta } from './indicadores.constants';

// ─── Re-export cache functions ─────────────────────────────────────────────

export {
  cache,
  serviceConfig,
  getFromCache,
  setCache,
  clearCache,
  configureService,
  resetService,
  getCacheStats,
  __test_setCacheEntry,
  __test_reset,
  __test_setKnownValue,
} from './indicadores.cache';

// ─── Re-export fetchers ─────────────────────────────────────────────────────

export {
  todayISO,
  fetchWithTimeout,
  calcularVariacion,
  parseNumber,
  createFallbackIndicador,
  fetchFromYahooFinance,
  fetchFromScraping,
  fetchFromStooq,
  fetchFromInvestingCom,
  estimateParalelo,
  fetchIndicadorWithFallback,
} from './indicadores.fetchers';

// Re-import for use in public API functions below
import { ALL_SLUGS, CATEGORIAS, FUENTES_POR_INDICADOR, INDICADOR_META } from './indicadores.constants';
import {
  fetchIndicadorWithFallback as _fetchIndicadorWithFallback,
} from './indicadores.fetchers';
import type { IndicadorMeta } from './indicadores.constants';

// ─── API Pública ───────────────────────────────────────────────────────────

/**
 * Obtiene una lista de indicadores por sus slugs.
 *
 * Cada indicador recorre la cadena de fallback:
 * fuente primaria → fuente secundaria → caché → valor conocido.
 *
 * @param slugs - Lista de slugs de indicadores a obtener
 * @returns Resultado con indicadores, errores, timestamp y fuentes usadas
 *
 * @example
 * ```typescript
 * const result = await fetchIndicadores(['lme-cobre', 'tc-oficial-bcb']);
 * if (result.errores.length > 0) {
 *   console.warn('Algunos indicadores tienen errores:', result.errores);
 * }
 * for (const ind of result.indicadores) {
 *   console.log(`${ind.nombre}: ${ind.valor} ${ind.unidad} (${ind.fuente})`);
 * }
 * ```
 */
export async function fetchIndicadores(
  slugs: SlugIndicador[],
): Promise<FetchIndicadoresResult> {
  const indicadores: IndicadorReal[] = [];
  const errores: FetchError[] = [];
  const fuentesUsadas = new Set<string>();

  // Ejecutar todos los fetches en paralelo
  const results = await Promise.all(
    slugs.map((slug) => _fetchIndicadorWithFallback(slug)),
  );

  for (const result of results) {
    if (result.indicador) {
      indicadores.push(result.indicador);
    }
    errores.push(...result.errores);
    result.fuentesUsadas.forEach((f) => fuentesUsadas.add(f));
  }

  return {
    indicadores,
    errores,
    timestamp: new Date().toISOString(),
    fuentesUsadas: Array.from(fuentesUsadas),
  };
}

/**
 * Retorna la lista completa de slugs de indicadores disponibles.
 *
 * @returns Array con todos los SlugIndicador disponibles
 *
 * @example
 * ```typescript
 * const slugs = getAvailableSlugs();
 * console.log(`Hay ${slugs.length} indicadores disponibles`);
 * ```
 */
export function getAvailableSlugs(): SlugIndicador[] {
  return [...ALL_SLUGS];
}

/**
 * Obtiene un único indicador por slug.
 *
 * Recorre la cadena de fallback completa para retornar el mejor
 * valor disponible.
 *
 * @param slug - Slug del indicador deseado
 * @returns Indicador o null si no se puede obtener de ninguna fuente
 *
 * @example
 * ```typescript
 * const cobre = await getIndicador('lme-cobre');
 * if (cobre) {
 *   console.log(`Cobre: ${cobre.valor} USD/t (confiable: ${cobre.confiable})`);
 * }
 * ```
 */
export async function getIndicador(
  slug: SlugIndicador,
): Promise<IndicadorReal | null> {
  const result = await _fetchIndicadorWithFallback(slug);
  return result.indicador;
}

/**
 * Obtiene todos los indicadores disponibles en una sola llamada.
 *
 * Equivalente a `fetchIndicadores(getAvailableSlugs())`.
 *
 * @returns Resultado con todos los indicadores disponibles
 *
 * @example
 * ```typescript
 * const all = await getAllIndicadores();
 * const confiables = all.indicadores.filter(i => i.confiable);
 * console.log(`${confiables.length} de ${all.indicadores.length} indicadores son confiables`);
 * ```
 */
export async function getAllIndicadores(): Promise<FetchIndicadoresResult> {
  return fetchIndicadores([...ALL_SLUGS]);
}

/**
 * Obtiene los indicadores de una categoría específica.
 *
 * @param categoria - Slug de la categoría
 * @returns Resultado con los indicadores de la categoría
 *
 * @example
 * ```typescript
 * const minerales = await fetchIndicadoresPorCategoria('minerales');
 * ```
 */
export async function fetchIndicadoresPorCategoria(
  categoria: CategoriaIndicador,
): Promise<FetchIndicadoresResult> {
  const catInfo = CATEGORIAS.find((c) => c.slug === categoria);
  if (!catInfo) {
    return {
      indicadores: [],
      errores: [
        {
          slug: categoria,
          fuente: 'sistema',
          mensaje: `Categoría no encontrada: ${categoria}`,
          recuperable: false,
        },
      ],
      timestamp: new Date().toISOString(),
      fuentesUsadas: [],
    };
  }

  return fetchIndicadores(catInfo.indicadores);
}

/**
 * Retorna el estado actual del servicio de indicadores.
 *
 * Incluye si está configurado y el estado de cada fuente de datos.
 *
 * @returns Estado del servicio con fuentes activas
 *
 * @example
 * ```typescript
 * const status = getServiceStatus();
 * if (!status.configured) {
 *   console.error('Servicio no configurado');
 * }
 * ```
 */
export function getServiceStatus(): {
  configured: boolean;
  sources: { nombre: string; activa: boolean }[];
} {
  const sources: { nombre: string; activa: boolean }[] = [];

  for (const [slug, fuentes] of Object.entries(FUENTES_POR_INDICADOR)) {
    for (const fuente of fuentes) {
      sources.push({
        nombre: `[${slug}] ${fuente.nombre}`,
        activa: fuente.activa,
      });
    }
  }

  return {
    configured: sources.some((s) => s.activa),
    sources,
  };
}

/**
 * Obtiene la información descriptiva de todas las categorías.
 *
 * @returns Array con información de cada categoría
 */
export function getCategorias(): CategoriaInfo[] {
  return CATEGORIAS.map((c) => ({ ...c, indicadores: [...c.indicadores] }));
}

/**
 * Obtiene la información descriptiva de un indicador por su slug.
 *
 * @param slug - Slug del indicador
 * @returns Metadatos del indicador o undefined si no existe
 */
export function getIndicadorMeta(slug: SlugIndicador): IndicadorMeta | undefined {
  const meta = INDICADOR_META[slug];
  return meta ? { ...meta } : undefined;
}
