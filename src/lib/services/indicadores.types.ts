/**
 * @module indicadores.types
 * @description Tipos TypeScript estrictos para el Módulo A3 - Indicadores Reales de Bolivia.
 * Define interfaces, tipos de unión y enumeraciones utilizadas por el servicio
 * de indicadores económicos del proyecto DECODEX Bolivia.
 *
 * Todas las fuentes de datos son públicas y gratuitas ($0 USD).
 */

// ─── Categorías de indicadores ─────────────────────────────────────────────

/** Categorías de indicadores económicos disponibles */
export type CategoriaIndicador =
  | 'minerales'
  | 'tipo_cambio'
  | 'reservas'
  | 'hidrocarburos'
  | 'comercio'
  | 'inflacion';

// ─── SLUGs de indicadores ──────────────────────────────────────────────────

/** Identificador único de cada indicador disponible */
export type SlugIndicador =
  | 'lme-cobre'
  | 'lme-zinc'
  | 'lme-estano'
  | 'lme-plata'
  | 'lme-plomo'
  | 'tc-oficial-bcb'
  | 'tc-paralelo'
  | 'reservas-internacionales'
  | 'produccion-gas'
  | 'produccion-petroleo'
  | 'exportaciones-fob'
  | 'ipc';

// ─── Modelo principal ──────────────────────────────────────────────────────

/**
 * Indicador económico real con datos completos.
 *
 * Cada indicador tiene un slug único, un valor numérico, unidad de medida,
 * fecha de referencia y metadatos de procedencia.
 */
export interface IndicadorReal {
  /** Identificador único (SlugIndicador) */
  slug: string;
  /** Nombre legible del indicador */
  nombre: string;
  /** Valor numérico actual */
  valor: number;
  /** Unidad de medida (USD/t, BOB/USD, MMmcd, etc.) */
  unidad: string;
  /** Fecha del dato en formato ISO 8601 (YYYY-MM-DD) */
  fecha: string;
  /** Nombre de la fuente de donde se obtuvo el dato */
  fuente: string;
  /** Indica si el dato provino de la fuente primaria y es confiable */
  confiable: boolean;
  /** Variación porcentual respecto al período anterior (opcional) */
  variacion?: number;
  /** Código de moneda si aplica (USD, BOB, etc.) */
  moneda?: string;
  /** Categoría a la que pertenece el indicador */
  categoria: CategoriaIndicador;
}

// ─── Configuración de fuentes ──────────────────────────────────────────────

/** Tipo de fuente de datos */
export type TipoFuente = 'scraping' | 'api' | 'fallback';

/**
 * Configuración de una fuente de datos individual.
 *
 * Cada fuente tiene un nombre descriptivo, URL base, tipo de acceso,
 * estado activo/inactivo y timeout de conexión.
 */
export interface FuenteConfig {
  /** Nombre descriptivo de la fuente */
  nombre: string;
  /** URL base o endpoint de la fuente */
  url: string;
  /** Tipo de acceso: scraping, API REST o fallback (último cacheado) */
  tipo: TipoFuente;
  /** Indica si la fuente está habilitada para consultas */
  activa: boolean;
  /** Timeout de conexión en milisegundos */
  timeout: number;
}

// ─── Resultados de fetching ────────────────────────────────────────────────

/**
 * Error individual producido durante la obtención de un indicador.
 *
 * Incluye información sobre el slug afectado, la fuente que falló,
 * el mensaje de error y si el error es recuperable (permite retry).
 */
export interface FetchError {
  /** Slug del indicador que produjo el error */
  slug: string;
  /** Nombre de la fuente que falló */
  fuente: string;
  /** Mensaje descriptivo del error */
  mensaje: string;
  /** Indica si el error es transitorio y puede reintentarse */
  recuperable: boolean;
}

/**
 * Resultado completo de una operación de obtención de indicadores.
 *
 * Contiene la lista de indicadores obtenidos exitosamente, los errores
 * registrados, timestamp de la operación y las fuentes efectivamente usadas.
 */
export interface FetchIndicadoresResult {
  /** Lista de indicadores obtenidos exitosamente */
  indicadores: IndicadorReal[];
  /** Lista de errores parciales (por indicador) */
  errores: FetchError[];
  /** Timestamp ISO 8601 de la operación */
  timestamp: string;
  /** Nombres de las fuentes que fueron consultadas */
  fuentesUsadas: string[];
}

// ─── Metadatos de caché ────────────────────────────────────────────────────

/**
 * Entrada de caché para un indicador individual.
 * @internal Uso interno del servicio, no exportado para consumo público.
 */
export interface CacheEntry {
  /** Indicador cacheado */
  indicador: IndicadorReal;
  /** Timestamp (Date.now()) cuando se almacenó */
  storedAt: number;
}

// ─── Configuración del servicio ────────────────────────────────────────────

/**
 * Configuración global del servicio de indicadores.
 * Permite personalizar timeouts, TTL y fuentes.
 */
export interface IndicadoresServiceConfig {
  /** Timeout por defecto para fetch en milisegundos (default: 10_000) */
  defaultTimeout?: number;
  /** TTL del caché en milisegundos (default: 3_600_000 = 1 hora) */
  cacheTtl?: number;
  /** Sobrescribe las fuentes activas */
  fuentesOverride?: Partial<Record<SlugIndicador, FuenteConfig[]>>;
}

// ─── Mapeo de categorías ──────────────────────────────────────────────────

/**
 * Información descriptiva de una categoría de indicadores.
 */
export interface CategoriaInfo {
  /** Slug de la categoría */
  slug: CategoriaIndicador;
  /** Nombre legible */
  nombre: string;
  /** Descripción breve */
  descripcion: string;
  /** Slugs de indicadores que pertenecen a esta categoría */
  indicadores: SlugIndicador[];
}
