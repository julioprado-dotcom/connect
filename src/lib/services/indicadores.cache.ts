/**
 * @module indicadores.cache
 * @description Cache layer and service configuration for the Indicadores service.
 *
 * Manages in-memory caching with TTL, service configuration (timeouts, TTL),
 * and test helper utilities. Extracted from indicadores.ts.
 */

import type {
  IndicadorReal,
  SlugIndicador,
  CacheEntry,
  FuenteConfig,
  IndicadoresServiceConfig,
} from './indicadores.types';
import { DEFAULT_CACHE_TTL, DEFAULT_TIMEOUT, knownValues } from './indicadores.constants';

// ─── Estado interno ────────────────────────────────────────────────────────

/** Cache en memoria: slug → CacheEntry */
export const cache = new Map<SlugIndicador, CacheEntry>();

/** Tipo interno para configuración del servicio con defaults */
type ServiceConfigInternal = {
  defaultTimeout: number;
  cacheTtl: number;
  fuentesOverride?: Partial<Record<SlugIndicador, FuenteConfig[]>>;
};

/** Configuración del servicio (mutable) */
export let serviceConfig: ServiceConfigInternal = {
  defaultTimeout: DEFAULT_TIMEOUT,
  cacheTtl: DEFAULT_CACHE_TTL,
};

// ─── Funciones de caché ─────────────────────────────────────────────────────

/**
 * Obtiene un valor del cache si aún es válido.
 *
 * @param slug - Slug del indicador
 * @returns Indicador cacheado o null si no existe o expiró
 */
export function getFromCache(slug: SlugIndicador): IndicadorReal | null {
  const entry = cache.get(slug);
  if (!entry) return null;

  const age = Date.now() - entry.storedAt;
  if (age > serviceConfig.cacheTtl) {
    cache.delete(slug);
    return null;
  }

  return { ...entry.indicador };
}

/**
 * Almacena un indicador en el cache.
 *
 * @param indicador - Indicador a cachear
 */
export function setCache(indicador: IndicadorReal): void {
  cache.set(indicador.slug as SlugIndicador, {
    indicador: { ...indicador },
    storedAt: Date.now(),
  });
}

/**
 * Limpia toda la caché de indicadores.
 * Útil para forzar la recarga de datos.
 */
export function clearCache(): void {
  cache.clear();
}

/**
 * Configura el servicio de indicadores con opciones personalizadas.
 *
 * @param config - Opciones de configuración
 *
 * @example
 * ```typescript
 * configureService({
 *   defaultTimeout: 15_000,
 *   cacheTtl: 1_800_000, // 30 minutos
 * });
 * ```
 */
export function configureService(config: IndicadoresServiceConfig): void {
  if (config.defaultTimeout !== undefined) {
    serviceConfig.defaultTimeout = config.defaultTimeout;
  }
  if (config.cacheTtl !== undefined) {
    serviceConfig.cacheTtl = config.cacheTtl;
  }
}

/**
 * Reinicia la configuración del servicio a sus valores por defecto.
 * También limpia la caché.
 */
export function resetService(): void {
  serviceConfig = {
    defaultTimeout: DEFAULT_TIMEOUT,
    cacheTtl: DEFAULT_CACHE_TTL,
  };
  cache.clear();
}

/**
 * Obtiene estadísticas del caché actual.
 *
 * @returns Cantidad de entradas, tamaño total y las entradas con sus edades
 */
export function getCacheStats(): {
  size: number;
  entries: Array<{
    slug: SlugIndicador;
    age: number;
    expired: boolean;
  }>;
} {
  const now = Date.now();
  const entries = Array.from(cache.entries()).map(([slug, entry]) => ({
    slug,
    age: now - entry.storedAt,
    expired: now - entry.storedAt > serviceConfig.cacheTtl,
  }));

  return { size: cache.size, entries };
}

// ─── Exportaciones para testing ────────────────────────────────────────────

/**
 * @internal Expuesto solo para tests unitarios.
 * Inyecta un valor manualmente en el caché.
 */
export function __test_setCacheEntry(
  slug: SlugIndicador,
  indicador: IndicadorReal,
  age: number = 0,
): void {
  cache.set(slug, {
    indicador: { ...indicador },
    storedAt: Date.now() - age,
  });
}

/**
 * @internal Exposto solo para tests unitarios.
 * Limpia el caché y reinicia la configuración.
 */
export function __test_reset(): void {
  cache.clear();
  serviceConfig = {
    defaultTimeout: DEFAULT_TIMEOUT,
    cacheTtl: DEFAULT_CACHE_TTL,
  };
}

/**
 * @internal Exposto solo para tests unitarios.
 * Permite sobrescribir knownValues para tests de fallback.
 */
export function __test_setKnownValue(
  slug: SlugIndicador,
  valor: number,
): void {
  (knownValues as Record<SlugIndicador, number>)[slug] = valor;
}
