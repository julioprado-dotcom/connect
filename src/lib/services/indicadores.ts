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
  FuenteConfig,
  CategoriaIndicador,
  CategoriaInfo,
  CacheEntry,
  IndicadoresServiceConfig,
} from './indicadores.types';

// ─── Constantes ────────────────────────────────────────────────────────────

/** TTL por defecto del caché: 1 hora en milisegundos */
const DEFAULT_CACHE_TTL = 3_600_000;

/** Timeout por defecto para fetch: 10 segundos */
const DEFAULT_TIMEOUT = 10_000;

/** Todos los slugs disponibles */
const ALL_SLUGS: readonly SlugIndicador[] = [
  'lme-cobre',
  'lme-zinc',
  'lme-estano',
  'lme-plata',
  'lme-plomo',
  'agr-cafe',
  'agr-quinua',
  'agr-soya',
  'agr-arroz',
  'agr-azucar',
  'agr-maiz',
  'agr-trigo',
  'macro-ipc-bcb',
  'macro-tasa-interes',
  'macro-reservas-internacionales',
  'macro-riesgo-pais',
  'macro-deuda-publica',
  'macro-pib',
  'macro-balanza-comercial',
  'ine-poblacion',
  'ine-pobreza',
  'ine-empleo',
  'ine-pib-departamental',
  'salud-desnutricion',
  'salud-materna',
  'salud-esperanza-vida',
  'tc-oficial-bcb',
  'tc-paralelo',
  'reservas-internacionales',
  'produccion-gas',
  'produccion-petroleo',
  'exportaciones-fob',
  'ipc',
] as const;

// ─── Información descriptiva de indicadores ────────────────────────────────

interface IndicadorMeta {
  nombre: string;
  unidad: string;
  moneda?: string;
  categoria: CategoriaIndicador;
  yahooSymbol?: string;
  stooqSymbol?: string;
  unitConversion?: 'oz_to_ton';
}

/** Metadatos estáticos por indicador */
const INDICADOR_META: Readonly<Record<SlugIndicador, IndicadorMeta>> = {
  'lme-cobre': {
    nombre: 'Cobre (LME)',
    unidad: 'USD/t',
    moneda: 'USD',
    categoria: 'minerales',
    yahooSymbol: 'HG=F',
    stooqSymbol: 'LCOP.UK',
  },
  'lme-zinc': {
    nombre: 'Zinc (LME)',
    unidad: 'USD/t',
    moneda: 'USD',
    categoria: 'minerales',
    yahooSymbol: 'CMZS3',
    stooqSymbol: 'LZIN.UK',
  },
  'lme-estano': {
    nombre: 'Estaño (LME)',
    unidad: 'USD/t',
    moneda: 'USD',
    categoria: 'minerales',
    yahooSymbol: 'CMST3',
    stooqSymbol: 'LTIN.UK',
  },
  'lme-plata': {
    nombre: 'Plata (LME)',
    unidad: 'USD/t',
    moneda: 'USD',
    categoria: 'minerales',
    yahooSymbol: 'SI=F',
    stooqSymbol: 'XAGUSD',
    /** Plata viene en USD/oz desde las APIs — se convierte a USD/ton */
    unitConversion: 'oz_to_ton' as const,
  },
  'lme-plomo': {
    nombre: 'Plomo (LME)',
    unidad: 'USD/t',
    moneda: 'USD',
    categoria: 'minerales',
    yahooSymbol: 'PB=F',
    stooqSymbol: 'LLEA.UK',
  },
  'agr-cafe': {
    nombre: 'Café (Internacional)',
    unidad: 'USc/lb',
    moneda: 'USD',
    categoria: 'agricolas',
    yahooSymbol: 'KC=F',
  },
  'agr-quinua': {
    nombre: 'Quinua (Mercado)',
    unidad: 'USD/ton',
    moneda: 'USD',
    categoria: 'agricolas',
  },
  'agr-soya': {
    nombre: 'Soya (Internacional)',
    unidad: 'USc/bushel',
    moneda: 'USD',
    categoria: 'agricolas',
    yahooSymbol: 'ZS=F',
  },
  'agr-arroz': {
    nombre: 'Arroz (Internacional)',
    unidad: 'USD/cwt',
    moneda: 'USD',
    categoria: 'agricolas',
    yahooSymbol: 'ZR=F',
  },
  'agr-azucar': {
    nombre: 'Azúcar (Internacional)',
    unidad: 'USc/lb',
    moneda: 'USD',
    categoria: 'agricolas',
    yahooSymbol: 'SB=F',
  },
  'agr-maiz': {
    nombre: 'Maíz (Internacional)',
    unidad: 'USc/bushel',
    moneda: 'USD',
    categoria: 'agricolas',
    yahooSymbol: 'ZC=F',
  },
  'agr-trigo': {
    nombre: 'Trigo (Internacional)',
    unidad: 'USc/bushel',
    moneda: 'USD',
    categoria: 'agricolas',
    yahooSymbol: 'ZW=F',
  },
  'macro-ipc-bcb': {
    nombre: 'Inflación (IPC) BCB',
    unidad: '% anual',
    moneda: 'BOB',
    categoria: 'macro_bcb',
  },
  'macro-tasa-interes': {
    nombre: 'Tasa de Interés de Referencia',
    unidad: '% anual',
    moneda: 'BOB',
    categoria: 'macro_bcb',
  },
  'macro-reservas-internacionales': {
    nombre: 'Reservas Internacionales (RIN)',
    unidad: 'MM USD',
    moneda: 'USD',
    categoria: 'macro_bcb',
  },
  'macro-riesgo-pais': {
    nombre: 'Riesgo País (EMBI)',
    unidad: 'bps',
    categoria: 'macro_bcb',
  },
  'macro-deuda-publica': {
    nombre: 'Deuda Pública / PIB',
    unidad: '% PIB',
    categoria: 'macro_bcb',
  },
  'macro-pib': {
    nombre: 'Producto Interno Bruto',
    unidad: 'MM USD',
    moneda: 'USD',
    categoria: 'macro_bcb',
  },
  'macro-balanza-comercial': {
    nombre: 'Balanza Comercial',
    unidad: 'MM USD',
    moneda: 'USD',
    categoria: 'macro_bcb',
  },
  'ine-poblacion': {
    nombre: 'Población Estimada',
    unidad: 'habitantes',
    categoria: 'ine',
  },
  'ine-pobreza': {
    nombre: 'Tasa de Pobreza Extrema',
    unidad: '%',
    categoria: 'ine',
  },
  'ine-empleo': {
    nombre: 'Tasa de Empleo Adecuado',
    unidad: '%',
    categoria: 'ine',
  },
  'ine-pib-departamental': {
    nombre: 'PIB Departamental',
    unidad: 'MM USD',
    moneda: 'USD',
    categoria: 'ine',
  },
  'salud-desnutricion': {
    nombre: 'Desnutrición Crónica (< 5 años)',
    unidad: '%',
    categoria: 'salud',
  },
  'salud-materna': {
    nombre: 'Mortalidad Materna',
    unidad: 'x 100,000 nv',
    categoria: 'salud',
  },
  'salud-esperanza-vida': {
    nombre: 'Esperanza de Vida al Nacer',
    unidad: 'años',
    categoria: 'salud',
  },
  'tc-oficial-bcb': {
    nombre: 'Tipo de Cambio Oficial (BCB)',
    unidad: 'BOB/USD',
    moneda: 'BOB',
    categoria: 'tipo_cambio',
    yahooSymbol: 'BOB=X',
  },
  'tc-paralelo': {
    nombre: 'Tipo de Cambio Paralelo',
    unidad: 'BOB/USD',
    moneda: 'BOB',
    categoria: 'tipo_cambio',
  },
  'reservas-internacionales': {
    nombre: 'Reservas Internacionales Netas',
    unidad: 'MM USD',
    moneda: 'USD',
    categoria: 'reservas',
  },
  'produccion-gas': {
    nombre: 'Producción de Gas Natural',
    unidad: 'MMmcd',
    categoria: 'hidrocarburos',
  },
  'produccion-petroleo': {
    nombre: 'Producción de Petróleo Crudo',
    unidad: 'BPD',
    moneda: 'USD',
    categoria: 'hidrocarburos',
  },
  'exportaciones-fob': {
    nombre: 'Exportaciones FOB',
    unidad: 'MM USD',
    moneda: 'USD',
    categoria: 'comercio',
  },
  ipc: {
    nombre: 'Índice de Precios al Consumidor (IPC)',
    unidad: '% acumulado',
    categoria: 'inflacion',
  },
};

// ─── Fuentes de datos ──────────────────────────────────────────────────────

/**
 * Configuración de fuentes por indicador.
 * Orden: [primaria, secundaria, ...]
 */
const FUENTES_POR_INDICADOR: Readonly<
  Record<SlugIndicador, FuenteConfig[]>
> = {
  // Minerales LME — 3 fuentes por metal: scraping LME, Yahoo Finance, Stooq CSV
  'lme-cobre': [
    {
      nombre: 'Yahoo Finance (COMEX Cu)',
      url: 'https://query1.finance.yahoo.com/v8/finance/chart/HG=F?interval=1d&range=2d',
      tipo: 'api',
      activa: true,
      timeout: DEFAULT_TIMEOUT,
    },
    {
      nombre: 'Stooq (LME Copper)',
      url: 'https://stooq.com/q/l/?s=lcop.uk&i=d',
      tipo: 'stooq',
      activa: true,
      timeout: DEFAULT_TIMEOUT,
    },
  ],
  'lme-zinc': [
    {
      nombre: 'Investing.com (Zinc)',
      url: 'https://www.investing.com/commodities/zinc',
      tipo: 'investing_com',
      activa: true,
      timeout: DEFAULT_TIMEOUT,
    },
    {
      nombre: 'Stooq (LME Zinc)',
      url: 'https://stooq.com/q/l/?s=lzin.uk&i=d',
      tipo: 'stooq',
      activa: true,
      timeout: DEFAULT_TIMEOUT,
    },
  ],
  'lme-estano': [
    {
      nombre: 'Investing.com (Tin)',
      url: 'https://www.investing.com/commodities/tin',
      tipo: 'investing_com',
      activa: true,
      timeout: DEFAULT_TIMEOUT,
    },
    {
      nombre: 'Stooq (LME Tin)',
      url: 'https://stooq.com/q/l/?s=tin.uk&i=d',
      tipo: 'stooq',
      activa: true,
      timeout: DEFAULT_TIMEOUT,
    },
  ],
  'lme-plata': [
    {
      nombre: 'Yahoo Finance (COMEX Ag)',
      url: 'https://query1.finance.yahoo.com/v8/finance/chart/SI=F?interval=1d&range=2d',
      tipo: 'api',
      activa: true,
      timeout: DEFAULT_TIMEOUT,
    },
    {
      nombre: 'Stooq (Silver USD/oz)',
      url: 'https://stooq.com/q/l/?s=xagusd&i=d',
      tipo: 'stooq',
      activa: true,
      timeout: DEFAULT_TIMEOUT,
    },
  ],
  'lme-plomo': [
    {
      nombre: 'Investing.com (Lead)',
      url: 'https://www.investing.com/commodities/lead',
      tipo: 'investing_com',
      activa: true,
      timeout: DEFAULT_TIMEOUT,
    },
    {
      nombre: 'Stooq (LME Lead)',
      url: 'https://stooq.com/q/l/?s=lead.uk&i=d',
      tipo: 'stooq',
      activa: true,
      timeout: DEFAULT_TIMEOUT,
    },
  ],
  // Agrícolas — Yahoo Finance (commodities internacionales)
  'agr-cafe': [
    {
      nombre: 'Yahoo Finance (Coffee)',
      url: 'https://query1.finance.yahoo.com/v8/finance/chart/KC=F?interval=1d&range=2d',
      tipo: 'api',
      activa: true,
      timeout: DEFAULT_TIMEOUT,
    },
  ],
  'agr-soya': [
    {
      nombre: 'Yahoo Finance (Soybeans)',
      url: 'https://query1.finance.yahoo.com/v8/finance/chart/ZS=F?interval=1d&range=2d',
      tipo: 'api',
      activa: true,
      timeout: DEFAULT_TIMEOUT,
    },
  ],
  'agr-arroz': [
    {
      nombre: 'Yahoo Finance (Rice)',
      url: 'https://query1.finance.yahoo.com/v8/finance/chart/ZR=F?interval=1d&range=2d',
      tipo: 'api',
      activa: true,
      timeout: DEFAULT_TIMEOUT,
    },
  ],
  'agr-azucar': [
    {
      nombre: 'Yahoo Finance (Sugar)',
      url: 'https://query1.finance.yahoo.com/v8/finance/chart/SB=F?interval=1d&range=2d',
      tipo: 'api',
      activa: true,
      timeout: DEFAULT_TIMEOUT,
    },
  ],
  'agr-maiz': [
    {
      nombre: 'Yahoo Finance (Corn)',
      url: 'https://query1.finance.yahoo.com/v8/finance/chart/ZC=F?interval=1d&range=2d',
      tipo: 'api',
      activa: true,
      timeout: DEFAULT_TIMEOUT,
    },
  ],
  'agr-trigo': [
    {
      nombre: 'Yahoo Finance (Wheat)',
      url: 'https://query1.finance.yahoo.com/v8/finance/chart/ZW=F?interval=1d&range=2d',
      tipo: 'api',
      activa: true,
      timeout: DEFAULT_TIMEOUT,
    },
  ],
  'agr-quinua': [
    {
      nombre: 'FAO / Quinoa Market',
      url: 'https://www.fao.org/faostat/en/#data/PP',
      tipo: 'scraping',
      activa: false,
      timeout: DEFAULT_TIMEOUT,
    },
  ],
  // Macro BCB
  'macro-ipc-bcb': [
    {
      nombre: 'BCB Bolivia (IPC)',
      url: 'https://www.bcb.gob.bo/?q=indicadores/indice_precios',
      tipo: 'scraping',
      activa: true,
      timeout: DEFAULT_TIMEOUT,
    },
  ],
  'macro-tasa-interes': [
    {
      nombre: 'BCB Bolivia (Tasa Política)',
      url: 'https://www.bcb.gob.bo/?q=politica_monetaria/tasas',
      tipo: 'scraping',
      activa: true,
      timeout: DEFAULT_TIMEOUT,
    },
  ],
  'macro-reservas-internacionales': [
    {
      nombre: 'BCB Bolivia (RIN)',
      url: 'https://www.bcb.gob.bo/?q=estadisticas/ri',
      tipo: 'scraping',
      activa: true,
      timeout: DEFAULT_TIMEOUT,
    },
  ],
  'macro-riesgo-pais': [
    {
      nombre: 'JP Morgan EMBI+ Bolivia',
      url: 'https://www.investing.com/indices/embi-plus-bolivia',
      tipo: 'investing_com',
      activa: true,
      timeout: DEFAULT_TIMEOUT,
    },
  ],
  'macro-deuda-publica': [],
  'macro-pib': [
    {
      nombre: 'BCB Bolivia (PIB)',
      url: 'https://www.bcb.gob.bo/?q=estadisticas/pib',
      tipo: 'scraping',
      activa: true,
      timeout: DEFAULT_TIMEOUT,
    },
  ],
  'macro-balanza-comercial': [
    {
      nombre: 'BCB Bolivia (Balanza)',
      url: 'https://www.bcb.gob.bo/?q=estadisticas/balanza',
      tipo: 'scraping',
      activa: true,
      timeout: DEFAULT_TIMEOUT,
    },
  ],
  // INE
  'ine-poblacion': [
    {
      nombre: 'INE Bolivia',
      url: 'https://www.ine.gob.bo/',
      tipo: 'scraping',
      activa: true,
      timeout: DEFAULT_TIMEOUT,
    },
  ],
  'ine-pobreza': [
    {
      nombre: 'INE Bolivia',
      url: 'https://www.ine.gob.bo/',
      tipo: 'scraping',
      activa: true,
      timeout: DEFAULT_TIMEOUT,
    },
  ],
  'ine-empleo': [
    {
      nombre: 'INE Bolivia',
      url: 'https://www.ine.gob.bo/',
      tipo: 'scraping',
      activa: true,
      timeout: DEFAULT_TIMEOUT,
    },
  ],
  'ine-pib-departamental': [],
  // Salud
  'salud-desnutricion': [
    {
      nombre: 'Ministerio de Salud',
      url: 'https://www.minsalud.gob.bo/',
      tipo: 'scraping',
      activa: true,
      timeout: DEFAULT_TIMEOUT,
    },
  ],
  'salud-materna': [
    {
      nombre: 'Ministerio de Salud',
      url: 'https://www.minsalud.gob.bo/',
      tipo: 'scraping',
      activa: true,
      timeout: DEFAULT_TIMEOUT,
    },
  ],
  'salud-esperanza-vida': [
    {
      nombre: 'INE Bolivia',
      url: 'https://www.ine.gob.bo/',
      tipo: 'scraping',
      activa: true,
      timeout: DEFAULT_TIMEOUT,
    },
  ],
  // Tipo de cambio
  'tc-oficial-bcb': [
    {
      nombre: 'BCB Bolivia',
      url: 'https://www.bcb.gob.bo/?q=indicadores/tipo_cambio',
      tipo: 'scraping',
      activa: true,
      timeout: DEFAULT_TIMEOUT,
    },
    {
      nombre: 'Yahoo Finance (BOB=X)',
      url: 'https://query1.finance.yahoo.com/v8/finance/chart/BOB=X?interval=1d&range=1d',
      tipo: 'api',
      activa: true,
      timeout: DEFAULT_TIMEOUT,
    },
  ],
  'tc-paralelo': [
    {
      nombre: 'Fuentes públicas bolivianas',
      url: 'https://www.boliviaentusmanos.com/cambio',
      tipo: 'scraping',
      activa: true,
      timeout: DEFAULT_TIMEOUT,
    },
  ],
  // Reservas
  'reservas-internacionales': [
    {
      nombre: 'BCB Bolivia',
      url: 'https://www.bcb.gob.bo/?q=indicadores/reservas_internacionales',
      tipo: 'scraping',
      activa: true,
      timeout: DEFAULT_TIMEOUT,
    },
  ],
  // Hidrocarburos
  'produccion-gas': [
    {
      nombre: 'YPFB',
      url: 'https://www.ypfb.gob.bo',
      tipo: 'scraping',
      activa: true,
      timeout: DEFAULT_TIMEOUT,
    },
  ],
  'produccion-petroleo': [
    {
      nombre: 'YPFB',
      url: 'https://www.ypfb.gob.bo',
      tipo: 'scraping',
      activa: true,
      timeout: DEFAULT_TIMEOUT,
    },
  ],
  // Comercio
  'exportaciones-fob': [
    {
      nombre: 'INE Bolivia',
      url: 'https://www.ine.gob.bo/',
      tipo: 'scraping',
      activa: true,
      timeout: DEFAULT_TIMEOUT,
    },
  ],
  // Inflación
  ipc: [
    {
      nombre: 'INE Bolivia',
      url: 'https://www.ine.gob.bo/indice/general',
      tipo: 'scraping',
      activa: true,
      timeout: DEFAULT_TIMEOUT,
    },
  ],
};

// ─── Categorías ────────────────────────────────────────────────────────────

/** Información de categorías disponibles */
const CATEGORIAS: Readonly<CategoriaInfo[]> = [
  {
    slug: 'minerales',
    nombre: 'Minerales (LME)',
    descripcion: 'Cotizaciones de minerales en el London Metal Exchange',
    indicadores: ['lme-cobre', 'lme-zinc', 'lme-estano', 'lme-plata', 'lme-plomo'],
  },
  {
    slug: 'tipo_cambio',
    nombre: 'Tipo de Cambio',
    descripcion: 'Tipos de cambio oficial y paralelo del boliviano',
    indicadores: ['tc-oficial-bcb', 'tc-paralelo'],
  },
  {
    slug: 'reservas',
    nombre: 'Reservas Internacionales',
    descripcion: 'Reservas internacionales netas del BCB',
    indicadores: ['reservas-internacionales'],
  },
  {
    slug: 'hidrocarburos',
    nombre: 'Hidrocarburos',
    descripcion: 'Producción de gas natural y petróleo crudo',
    indicadores: ['produccion-gas', 'produccion-petroleo'],
  },
  {
    slug: 'comercio',
    nombre: 'Comercio Exterior',
    descripcion: 'Exportaciones FOB de Bolivia',
    indicadores: ['exportaciones-fob'],
  },
  {
    slug: 'inflacion',
    nombre: 'Inflación',
    descripcion: 'Índice de Precios al Consumidor (IPC)',
    indicadores: ['ipc'],
  },
  {
    slug: 'agricolas',
    nombre: 'Commodities Agrícolas',
    descripcion: 'Precios internacionales de commodities agrícolas relevantes para Bolivia',
    indicadores: ['agr-cafe', 'agr-quinua', 'agr-soya', 'agr-arroz', 'agr-azucar', 'agr-maiz', 'agr-trigo'],
  },
  {
    slug: 'macro_bcb',
    nombre: 'Macroeconomía (BCB)',
    descripcion: 'Indicadores macroeconómicos del Banco Central de Bolivia',
    indicadores: ['macro-ipc-bcb', 'macro-tasa-interes', 'macro-reservas-internacionales', 'macro-riesgo-pais', 'macro-deuda-publica', 'macro-pib', 'macro-balanza-comercial'],
  },
  {
    slug: 'ine',
    nombre: 'Estadísticas INE',
    descripcion: 'Indicadores del Instituto Nacional de Estadística',
    indicadores: ['ine-poblacion', 'ine-pobreza', 'ine-empleo', 'ine-pib-departamental'],
  },
  {
    slug: 'salud',
    nombre: 'Indicadores de Salud',
    descripcion: 'Indicadores de salud pública de Bolivia',
    indicadores: ['salud-desnutricion', 'salud-materna', 'salud-esperanza-vida'],
  },
];

// ─── Estado interno ────────────────────────────────────────────────────────

/** Cache en memoria: slug → CacheEntry */
const cache = new Map<SlugIndicador, CacheEntry>();

/** Valores conocidos como fallback (últimos valores cacheados históricos) */
const knownValues: Readonly<Record<SlugIndicador, number>> = {
  'lme-cobre': 13_187,    // COMEX Cu ~$5.98/lb = ~$13,187/ton (May 2026)
  'lme-zinc': 2_850,      // LME Zinc ~$2,850/ton (est.)
  'lme-estano': 35_000,   // LME Tin ~$35,000/ton (est.)
  'lme-plata': 2_446_668, // COMEX Ag ~$76.1/oz = ~$2,446,668/ton (May 2026)
  'lme-plomo': 2_350,     // LME Lead ~$2,350/ton (est.)
  'agr-cafe': 279.05,
  'agr-quinua': 3200,
  'agr-soya': 1203.25,
  'agr-arroz': 11.24,
  'agr-azucar': 14.97,
  'agr-maiz': 480.25,
  'agr-trigo': 637.75,
  'macro-ipc-bcb': 1.42,
  'macro-tasa-interes': 8.0,
  'macro-reservas-internacionales': 18500,
  'macro-riesgo-pais': 480,
  'macro-deuda-publica': 52.3,
  'macro-pib': 44000,
  'macro-balanza-comercial': -1200,
  'ine-poblacion': 12390000,
  'ine-pobreza': 11.4,
  'ine-empleo': 62.5,
  'ine-pib-departamental': 44000,
  'salud-desnutricion': 11.6,
  'salud-materna': 161,
  'salud-esperanza-vida': 65.0,
  'tc-oficial-bcb': 6.91,
  'tc-paralelo': 7.12,
  'reservas-internacionales': 18_500,
  'produccion-gas': 42.5,
  'produccion-petroleo': 44_000,
  'exportaciones-fob': 7_850,
  ipc: 1.42,
};

/** Tipo interno para configuración del servicio con defaults */
type ServiceConfigInternal = {
  defaultTimeout: number;
  cacheTtl: number;
  fuentesOverride?: Partial<Record<SlugIndicador, FuenteConfig[]>>;
};

/** Configuración del servicio (mutable) */
let serviceConfig: ServiceConfigInternal = {
  defaultTimeout: DEFAULT_TIMEOUT,
  cacheTtl: DEFAULT_CACHE_TTL,
};

// ─── Utilidades internas ───────────────────────────────────────────────────

/**
 * Obtiene la fecha actual en formato ISO 8601 (YYYY-MM-DD).
 */
function todayISO(): string {
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
async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
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
 * Obtiene un valor del cache si aún es válido.
 *
 * @param slug - Slug del indicador
 * @returns Indicador cacheado o null si no existe o expiró
 */
function getFromCache(slug: SlugIndicador): IndicadorReal | null {
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
function setCache(indicador: IndicadorReal): void {
  cache.set(indicador.slug as SlugIndicador, {
    indicador: { ...indicador },
    storedAt: Date.now(),
  });
}

/**
 * Calcula la variación porcentual entre un valor actual y uno anterior.
 *
 * @param current - Valor actual
 * @param previous - Valor anterior
 * @returns Variación porcentual con 2 decimales
 */
function calcularVariacion(current: number, previous: number): number {
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
function parseNumber(text: string): number | null {
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
function createFallbackIndicador(
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

// ─── Constantes de conversión ──────────────────────────────────────────────

/** Factor de conversión: 1 tonelada métrica = 32,150.7 troy oz */
const TROY_OZ_PER_TON = 32_150.7;
/** Factor de conversión: 1 tonelada métrica = 2,204.62 libras */
const LB_PER_TON = 2_204.62;

/**
 * Multiplicadores por fuente para convertir a USD/ton.
 * - Yahoo Finance: HG=F (cobre) viene en USD/lb, SI=F (plata) en USD/oz
 * - Stooq: XAGUSD (plata) viene en USD/oz, LCOP.UK (cobre) en USD/kg
 */
const YAHOO_MULTIPLIER: Partial<Record<SlugIndicador, number>> = {
  'lme-cobre': LB_PER_TON,       // HG=F: USD/lb → USD/ton
  'lme-plata': TROY_OZ_PER_TON,  // SI=F: USD/oz → USD/ton
  'lme-plomo': LB_PER_TON,       // PB=F: USD/lb → USD/ton
};

const STOOQ_MULTIPLIER: Partial<Record<SlugIndicador, number>> = {
  'lme-plata': TROY_OZ_PER_TON,  // XAGUSD: USD/oz → USD/ton
  'lme-cobre': 1_000,             // LCOP.UK: USD/kg → USD/ton
  'lme-zinc': 1_000,              // LZIN.UK: USD/kg → USD/ton
  'lme-estano': 1_000,            // LTIN.UK: USD/kg → USD/ton
  'lme-plomo': 1_000,             // LLEA.UK: USD/kg → USD/ton
};

/**
 * Convierte un valor según la configuración del indicador (legacy — ya no se usa directamente).
 */
function convertUnit(value: number, slug: SlugIndicador): number {
  const meta = INDICADOR_META[slug];
  if (meta.unitConversion === 'oz_to_ton') {
    return Number((value * TROY_OZ_PER_TON).toFixed(2));
  }
  return value;
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
async function fetchFromYahooFinance(
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
async function fetchFromScraping(
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
async function fetchFromStooq(
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
async function fetchFromInvestingCom(
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
function estimateParalelo(oficialValor: number): IndicadorReal {
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
async function fetchIndicadorWithFallback(slug: SlugIndicador): Promise<{
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
    slugs.map((slug) => fetchIndicadorWithFallback(slug)),
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
  const result = await fetchIndicadorWithFallback(slug);
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
