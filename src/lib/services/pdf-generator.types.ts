/**
 * @module pdf-generator.types
 * @description Tipos TypeScript estrictos para el Módulo A4 - Generador de Informes PDF.
 * Define las interfaces y tipos utilizados por el servicio de generación de informes
 * del proyecto DECODEX Bolivia.
 */

/** Tipo de informe disponible para generación */
export type TipoInforme = 'semanal' | 'ficha_persona' | 'ad_hoc';

/** Categorías de sentimiento para las menciones */
export type Sentimiento = 'positivo' | 'negativo' | 'neutro';

/** Tendencia de aparición en ranking */
export type Tendencia = 'sube' | 'baja' | 'estable';

/** Orientación de página del PDF */
export type Orientacion = 'portrait' | 'landscape';

/**
 * Mención individual dentro de un informe.
 * Representa una aparición en medios de una persona monitoreada.
 */
export interface MencionInforme {
  /** Nombre de la persona mencionada */
  persona: string;
  /** Nombre del medio de comunicación */
  medio: string;
  /** Fecha de la mención en formato ISO (YYYY-MM-DD) */
  fecha: string;
  /** Titular o headline de la noticia/artículo */
  titular: string;
  /** Clasificación de sentimiento de la mención */
  sentimiento: Sentimiento;
  /** Eje temático al que pertenece la mención */
  ejeTematico: string;
  /** URL de la fuente original (opcional) */
  url?: string;
  /** Fragmento de texto relevante de la mención (opcional) */
  excerpt?: string;
}

/**
 * Estadísticas de distribución para un informe.
 * Contiene conteos por sentimiento, medio y eje temático.
 */
export interface EstadisticasInforme {
  /** Total de menciones en el periodo */
  totalMenciones: number;
  /** Distribución de menciones por sentimiento */
  porSentimiento: Record<Sentimiento, number>;
  /** Distribución de menciones por medio de comunicación */
  porMedio: Record<string, number>;
  /** Distribución de menciones por eje temático */
  porEje: Record<string, number>;
}

/**
 * Entrada del ranking de personas más mencionadas.
 */
export interface RankingPersonaEntry {
  /** Nombre completo de la persona */
  nombre: string;
  /** Cantidad total de menciones */
  menciones: number;
  /** Tendencia respecto al periodo anterior */
  tendencia: Tendencia;
}

/**
 * Datos para generar un informe semanal.
 * Contiene todas las menciones del periodo junto con estadísticas agregadas.
 */
export interface InformeSemanalData {
  /** Periodo de cobertura del informe */
  periodo: { desde: string; hasta: string };
  /** Lista de menciones individuales */
  menciones: MencionInforme[];
  /** Resumen ejecutivo del periodo */
  resumenEjecutivo: string;
  /** Estadísticas agregadas del periodo */
  estadisticas: EstadisticasInforme;
  /** Ranking de las personas más mencionadas */
  rankingPersonas: RankingPersonaEntry[];
}

/**
 * Datos de la persona para una ficha individual.
 */
export interface PersonaInfo {
  /** Nombre completo */
  nombre: string;
  /** Cargo o posición actual */
  cargo: string;
  /** Institución u organización a la que pertenece */
  institucion: string;
  /** URL de la fotografía (opcional) */
  fotoUrl?: string;
}

/**
 * Evolución mensual de menciones para gráficos.
 */
export interface EvolucionMensualEntry {
  /** Etiqueta del mes (ej: "2024-01") */
  mes: string;
  /** Cantidad de menciones en ese mes */
  cantidad: number;
}

/**
 * Estadísticas específicas para ficha de persona.
 */
export interface EstadisticasFicha {
  /** Total de menciones en el periodo */
  totalMenciones: number;
  /** Distribución por sentimiento */
  porSentimiento: Record<Sentimiento, number>;
  /** Distribución por medio */
  porMedio: Record<string, number>;
  /** Serie temporal de menciones mensuales */
  evolucionMensual: EvolucionMensualEntry[];
}

/**
 * Posición en el ranking general.
 */
export interface RankingPosicion {
  /** Posición ordinal en el ranking */
  posicion: number;
  /** Total de personas en el ranking */
  total: number;
}

/**
 * Datos para generar una ficha de persona.
 * Incluye información personal, menciones y estadísticas individuales.
 */
export interface FichaPersonaData {
  /** Información de la persona */
  persona: PersonaInfo;
  /** Periodo de cobertura */
  periodo: { desde: string; hasta: string };
  /** Lista de menciones de la persona */
  menciones: MencionInforme[];
  /** Estadísticas individuales */
  estadisticas: EstadisticasFicha;
  /** Posición en el ranking general */
  ranking: RankingPosicion;
  /** Observaciones cualitativas */
  observaciones: string;
}

/**
 * Filtros aplicables a un informe ad-hoc.
 * Todos los campos son opcionales para máxima flexibilidad.
 */
export interface FiltrosAdHoc {
  /** Filtrar por nombres de personas específicas */
  personas?: readonly string[];
  /** Filtrar por medios de comunicación */
  medios?: readonly string[];
  /** Filtrar por ejes temáticos */
  ejes?: readonly string[];
  /** Filtrar por categorías de sentimiento */
  sentimientos?: readonly Sentimiento[];
  /** Fecha de inicio del filtro (ISO) */
  fechaDesde?: string;
  /** Fecha de fin del filtro (ISO) */
  fechaHasta?: string;
}

/**
 * Estadísticas para informe ad-hoc.
 * Versión simplificada sin desglose por eje temático.
 */
export interface EstadisticasAdHoc {
  /** Total de menciones que cumplen los filtros */
  totalMenciones: number;
  /** Distribución por sentimiento */
  porSentimiento: Record<Sentimiento, number>;
  /** Distribución por medio */
  porMedio: Record<string, number>;
}

/**
 * Datos para generar un informe ad-hoc.
 * Permite consultas personalizadas con filtros flexibles.
 */
export interface InformeAdHocData {
  /** Filtros aplicados al informe */
  filtros: FiltrosAdHoc;
  /** Título personalizado del informe */
  titulo: string;
  /** Menciones que cumplen los filtros */
  menciones: MencionInforme[];
  /** Estadísticas agregadas */
  estadisticas: EstadisticasAdHoc;
  /** Resumen narrativo del informe */
  resumen: string;
}

/** Unión discriminada de todos los tipos de datos de informe */
export type InformeData = InformeSemanalData | FichaPersonaData | InformeAdHocData;

/**
 * Opciones de personalización para la generación de PDFs.
 */
export interface PDFGenerationOptions {
  /** Incluir marca de agua "DECODEX Bolivia" (default: true) */
  marcaAgua?: boolean;
  /** Orientación de las páginas (default: 'portrait') */
  orientacion?: Orientacion;
  /** URL del logo institucional (usa placeholder si no se proporciona) */
  logoUrl?: string;
  /** Color primario en formato hex (default: '#42725a') */
  colorPrimario?: string;
}

/**
 * Resultado de la operación de generación de PDF.
 */
export interface PDFGenerationResult {
  /** Indica si la generación fue exitosa */
  success: boolean;
  /** Buffer binario del PDF generado (disponible en modo producción) */
  buffer?: Buffer;
  /** Número total de páginas del documento */
  pages: number;
  /** Nombre sugerido para el archivo */
  filename: string;
  /** Tamaño en bytes del buffer generado */
  size: number;
  /** Mensaje de error si la generación falló */
  error?: string;
  /** Timestamp ISO de la generación */
  timestamp: string;
}

/**
 * Opciones internas para la conversión HTML → PDF.
 * Separadas de las opciones públicas para mayor claridad.
 */
export interface HTMLToPDFOptions {
  /** Orientación del documento */
  orientation: Orientacion;
  /** Formato de página (default: 'A4') */
  format?: string;
  /** Márgenes en milímetros */
  margin?: { top: number; right: number; bottom: number; left: number };
  /** Ruta de impresión (para Puppeteer) */
  printBackground?: boolean;
}

/**
 * Constantes de configuración por defecto del módulo.
 */
export const PDF_DEFAULTS = {
  COLOR_PRIMARIO: '#42725a',
  COLOR_POSITIVO: '#22c55e',
  COLOR_NEGATIVO: '#ef4444',
  COLOR_NEUTRO: '#6b7280',
  ORIENTACION: 'portrait' as Orientacion,
  MARCA_AGUA: true,
  FORMATO_PAGINA: 'A4',
  MARGENES: { top: 20, right: 15, bottom: 20, left: 15 },
  LOGO_PLACEHOLDER: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwIiBoZWlnaHQ9IjQwIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxMjAiIGhlaWdodD0iNDAiIGZpbGw9IiM0MjcyNWEiIHJ4PSI1Ii8+PHRleHQgeD0iMTIiIHk9IjI4IiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTgiIGZvbnQtd2VpZ2h0PSJib2xkIiBmaWxsPSJ3aGl0ZSI+REVDT0RFWCBCb2xpdmlhPC90ZXh0Pjwvc3ZnPg==',
} as const;
