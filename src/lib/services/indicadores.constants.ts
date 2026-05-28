/**
 * @module indicadores.constants
 * @description Static configuration data for the Indicadores service.
 *
 * Contains all indicator metadata, source configurations, category definitions,
 * fallback values, and unit conversion constants. Extracted from indicadores.ts
 * to improve maintainability.
 */

import type {
  SlugIndicador,
  FuenteConfig,
  CategoriaIndicador,
  CategoriaInfo,
} from './indicadores.types';

// ─── Constantes ────────────────────────────────────────────────────────────

/** TTL por defecto del caché: 1 hora en milisegundos */
export const DEFAULT_CACHE_TTL = 3_600_000;

/** Timeout por defecto para fetch: 10 segundos */
export const DEFAULT_TIMEOUT = 10_000;

/** Todos los slugs disponibles */
export const ALL_SLUGS: readonly SlugIndicador[] = [
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

export interface IndicadorMeta {
  nombre: string;
  unidad: string;
  moneda?: string;
  categoria: CategoriaIndicador;
  yahooSymbol?: string;
  stooqSymbol?: string;
  unitConversion?: 'oz_to_ton';
}

/** Metadatos estáticos por indicador */
export const INDICADOR_META: Readonly<Record<SlugIndicador, IndicadorMeta>> = {
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
  // Divisas internacionales relevantes para comercio exterior boliviano
  'fx-eur-usd': {
    nombre: 'Euro / Dólar (EUR/USD)',
    unidad: 'USD/EUR',
    moneda: 'EUR',
    categoria: 'tipo_cambio',
    yahooSymbol: 'EURUSD=X',
  },
  'fx-cny-usd': {
    nombre: 'Yuan / Dólar (USD/CNY)',
    unidad: 'CNY/USD',
    moneda: 'CNY',
    categoria: 'tipo_cambio',
    yahooSymbol: 'CNY=X',
  },
  'fx-brl-usd': {
    nombre: 'Real Brasileño / Dólar (USD/BRL)',
    unidad: 'BRL/USD',
    moneda: 'BRL',
    categoria: 'tipo_cambio',
    yahooSymbol: 'BRL=X',
  },
  'fx-pen-usd': {
    nombre: 'Sol Peruano / Dólar (USD/PEN)',
    unidad: 'PEN/USD',
    moneda: 'PEN',
    categoria: 'tipo_cambio',
    yahooSymbol: 'PEN=X',
  },
  'fx-clp-usd': {
    nombre: 'Peso Chileno / Dólar (USD/CLP)',
    unidad: 'CLP/USD',
    moneda: 'CLP',
    categoria: 'tipo_cambio',
    yahooSymbol: 'CLP=X',
  },
  'fx-ars-usd': {
    nombre: 'Peso Argentino / Dólar (USD/ARS)',
    unidad: 'ARS/USD',
    moneda: 'ARS',
    categoria: 'tipo_cambio',
    yahooSymbol: 'ARS=X',
  },
  'fx-pyg-usd': {
    nombre: 'Guaraní Paraguayo / Dólar (USD/PYG)',
    unidad: 'PYG/USD',
    moneda: 'PYG',
    categoria: 'tipo_cambio',
    yahooSymbol: 'PYG=X',
  },
  'fx-jpy-usd': {
    nombre: 'Yen Japonés / Dólar (USD/JPY)',
    unidad: 'JPY/USD',
    moneda: 'JPY',
    categoria: 'tipo_cambio',
    yahooSymbol: 'JPY=X',
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
export const FUENTES_POR_INDICADOR: Readonly<
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
  // Divisas internacionales — Yahoo Finance API
  'fx-eur-usd': [
    {
      nombre: 'Yahoo Finance (EUR/USD)',
      url: 'https://query1.finance.yahoo.com/v8/finance/chart/EURUSD=X?interval=1d&range=2d',
      tipo: 'api',
      activa: true,
      timeout: DEFAULT_TIMEOUT,
    },
  ],
  'fx-cny-usd': [
    {
      nombre: 'Yahoo Finance (USD/CNY)',
      url: 'https://query1.finance.yahoo.com/v8/finance/chart/CNY=X?interval=1d&range=2d',
      tipo: 'api',
      activa: true,
      timeout: DEFAULT_TIMEOUT,
    },
  ],
  'fx-brl-usd': [
    {
      nombre: 'Yahoo Finance (USD/BRL)',
      url: 'https://query1.finance.yahoo.com/v8/finance/chart/BRL=X?interval=1d&range=2d',
      tipo: 'api',
      activa: true,
      timeout: DEFAULT_TIMEOUT,
    },
  ],
  'fx-pen-usd': [
    {
      nombre: 'Yahoo Finance (USD/PEN)',
      url: 'https://query1.finance.yahoo.com/v8/finance/chart/PEN=X?interval=1d&range=2d',
      tipo: 'api',
      activa: true,
      timeout: DEFAULT_TIMEOUT,
    },
  ],
  'fx-clp-usd': [
    {
      nombre: 'Yahoo Finance (USD/CLP)',
      url: 'https://query1.finance.yahoo.com/v8/finance/chart/CLP=X?interval=1d&range=2d',
      tipo: 'api',
      activa: true,
      timeout: DEFAULT_TIMEOUT,
    },
  ],
  'fx-ars-usd': [
    {
      nombre: 'Yahoo Finance (USD/ARS)',
      url: 'https://query1.finance.yahoo.com/v8/finance/chart/ARS=X?interval=1d&range=2d',
      tipo: 'api',
      activa: true,
      timeout: DEFAULT_TIMEOUT,
    },
  ],
  'fx-pyg-usd': [
    {
      nombre: 'Yahoo Finance (USD/PYG)',
      url: 'https://query1.finance.yahoo.com/v8/finance/chart/PYG=X?interval=1d&range=2d',
      tipo: 'api',
      activa: true,
      timeout: DEFAULT_TIMEOUT,
    },
  ],
  'fx-jpy-usd': [
    {
      nombre: 'Yahoo Finance (USD/JPY)',
      url: 'https://query1.finance.yahoo.com/v8/finance/chart/JPY=X?interval=1d&range=2d',
      tipo: 'api',
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
export const CATEGORIAS: Readonly<CategoriaInfo[]> = [
  {
    slug: 'minerales',
    nombre: 'Minerales (LME)',
    descripcion: 'Cotizaciones de minerales en el London Metal Exchange',
    indicadores: ['lme-cobre', 'lme-zinc', 'lme-estano', 'lme-plata', 'lme-plomo'],
  },
  {
    slug: 'tipo_cambio',
    nombre: 'Tipo de Cambio',
    descripcion: 'Tipos de cambio oficial y paralelo del boliviano + principales divisas internacionales',
    indicadores: ['tc-oficial-bcb', 'tc-paralelo', 'fx-eur-usd', 'fx-cny-usd', 'fx-brl-usd', 'fx-pen-usd', 'fx-clp-usd', 'fx-ars-usd', 'fx-pyg-usd', 'fx-jpy-usd'],
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

// ─── Valores conocidos (fallback) ────────────────────────────────────────────

/** Valores conocidos como fallback (últimos valores cacheados históricos) */
export const knownValues: Readonly<Record<SlugIndicador, number>> = {
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
  'fx-eur-usd': 0.92,
  'fx-cny-usd': 7.25,
  'fx-brl-usd': 5.70,
  'fx-pen-usd': 3.72,
  'fx-clp-usd': 960,
  'fx-ars-usd': 1150,
  'fx-pyg-usd': 7850,
  'fx-jpy-usd': 149.5,
  'reservas-internacionales': 18_500,
  'produccion-gas': 42.5,
  'produccion-petroleo': 44_000,
  'exportaciones-fob': 7_850,
  ipc: 1.42,
};

// ─── Constantes de conversión ──────────────────────────────────────────────

/** Factor de conversión: 1 tonelada métrica = 32,150.7 troy oz */
export const TROY_OZ_PER_TON = 32_150.7;
/** Factor de conversión: 1 tonelada métrica = 2,204.62 libras */
export const LB_PER_TON = 2_204.62;

/**
 * Multiplicadores por fuente para convertir a USD/ton.
 * - Yahoo Finance: HG=F (cobre) viene en USD/lb, SI=F (plata) en USD/oz
 * - Stooq: XAGUSD (plata) viene en USD/oz, LCOP.UK (cobre) en USD/kg
 */
export const YAHOO_MULTIPLIER: Partial<Record<SlugIndicador, number>> = {
  'lme-cobre': LB_PER_TON,       // HG=F: USD/lb → USD/ton
  'lme-plata': TROY_OZ_PER_TON,  // SI=F: USD/oz → USD/ton
  'lme-plomo': LB_PER_TON,       // PB=F: USD/lb → USD/ton
};

export const STOOQ_MULTIPLIER: Partial<Record<SlugIndicador, number>> = {
  'lme-plata': TROY_OZ_PER_TON,  // XAGUSD: USD/oz → USD/ton
  'lme-cobre': 1_000,             // LCOP.UK: USD/kg → USD/ton
  'lme-zinc': 1_000,              // LZIN.UK: USD/kg → USD/ton
  'lme-estano': 1_000,            // LTIN.UK: USD/kg → USD/ton
  'lme-plomo': 1_000,             // LLEA.UK: USD/kg → USD/ton
};

/**
 * Convierte un valor según la configuración del indicador (legacy — ya no se usa directamente).
 */
export function convertUnit(value: number, slug: SlugIndicador): number {
  const meta = INDICADOR_META[slug];
  if (meta.unitConversion === 'oz_to_ton') {
    return Number((value * TROY_OZ_PER_TON).toFixed(2));
  }
  return value;
}
