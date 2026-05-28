/**
 * @module pdf-generator
 * @description Implementación principal del Módulo A4 - Generador de Informes PDF.
 * Servicio plug-in independiente para DECODEX Bolivia que genera informes PDF
 * profesionales: semanales, fichas de persona e informes ad-hoc.
 *
 * Funciona en dos modos:
 * - **Modo producción**: Convierte HTML a PDF via Puppeteer.
 * - **Modo mock**: Genera HTML completo y retorna metadata (para testing/desarrollo).
 *
 * Este archivo actúa como barrel: importa desde los submódulos,
 * expone la API pública y re-exporta todo para compatibilidad.
 */

import type {
  TipoInforme,
  InformeSemanalData,
  FichaPersonaData,
  InformeAdHocData,
  InformeData,
  PDFGenerationOptions,
  PDFGenerationResult,
  HTMLToPDFOptions,
} from './pdf-generator.types.js';
import { PDF_DEFAULTS } from './pdf-generator.types.js';

// Re-export everything from sub-modules for backward compatibility
export {
  nowISO,
  generarFilename,
  formatearFecha,
  colorSentimiento,
  etiquetaSentimiento,
  simboloTendencia,
  colorTendencia,
  porcentajeBarra,
  escapeHTML,
  generarEstilos,
} from './pdf-generator.styles.js';

export {
  generarPortada,
  generarResumen,
  generarStatsCards,
  generarTablaDistribucion,
  generarRanking,
  generarTablaMenciones,
  generarPersonaHeader,
  generarEvolucionMensual,
  generarFiltrosTags,
  generarFooter,
} from './pdf-generator.sections.js';

export {
  generarHTMLSemanal,
  generarHTMLFichaPersona,
  generarHTMLAdHoc,
  generarHTMLInforme,
} from './pdf-generator.html.js';

// Internal imports
import {
  nowISO,
  generarFilename,
} from './pdf-generator.styles.js';
import {
  generarHTMLInforme,
} from './pdf-generator.html.js';

// ─── Constantes Internas ──────────────────────────────────────────────

/** Detecta si Puppeteer está disponible en el entorno */
const isPuppeteerAvailable = (): boolean => {
  try {
    require('puppeteer');
    return true;
  } catch {
    return false;
  }
};

// ─── Conversión HTML → PDF ───────────────────────────────────────────

/**
 * Convierte HTML a PDF usando Puppeteer (modo producción).
 * En modo mock, genera un buffer vacío y retorna metadata.
 *
 * @param html - HTML completo del documento
 * @param opciones - Opciones de conversión
 * @returns Buffer binario del PDF generado
 *
 * @remarks
 * Esta función intenta cargar Puppeteer dinámicamente. Si no está disponible,
 * retorna un buffer vacío (modo mock) para permitir desarrollo y testing
 * sin la dependencia instalada.
 */
export async function htmlToPDF(
  html: string,
  opciones: HTMLToPDFOptions,
): Promise<Buffer> {
  if (isPuppeteerAvailable()) {
    // Modo producción con Puppeteer
    const puppeteer = require('puppeteer') as typeof import('puppeteer');
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const buffer = await page.pdf({
      format: (opciones.format ?? PDF_DEFAULTS.FORMATO_PAGINA) as 'A4',
      landscape: opciones.orientation === 'landscape',
      margin: opciones.margin ?? PDF_DEFAULTS.MARGENES,
      printBackground: opciones.printBackground ?? true,
    });
    await browser.close();
    return Buffer.from(buffer);
  }

  // Modo mock: retorna buffer vacío
  return Buffer.alloc(0);
}

// ─── Funciones Públicas de Generación ─────────────────────────────────

/**
 * Crea el objeto de resultado estandarizado.
 */
const crearResultado = (
  success: boolean,
  buffer: Buffer | undefined,
  pages: number,
  timestamp: string,
  error?: string,
): PDFGenerationResult => ({
  success,
  buffer,
  pages,
  filename: '',
  size: buffer?.byteLength ?? 0,
  error,
  timestamp,
});

/**
 * Genera un informe PDF semanal completo.
 *
 * @param data - Datos del informe semanal
 * @param opciones - Opciones de personalización
 * @returns Resultado de la generación con buffer, metadata y filename
 *
 * @example
 * ```typescript
 * const resultado = await generarInformeSemanal(dataSemanal, {
 *   colorPrimario: '#1a5276',
 *   marcaAgua: true,
 * });
 * if (resultado.success) {
 *   fs.writeFileSync(resultado.filename, resultado.buffer!);
 * }
 * ```
 */
export async function generarInformeSemanal(
  data: InformeSemanalData,
  opciones: PDFGenerationOptions = {},
): Promise<PDFGenerationResult> {
  try {
    const timestamp = nowISO();
    const html = generarHTMLInforme(data, 'semanal', opciones);
    const buffer = await htmlToPDF(html, {
      orientation: opciones.orientacion ?? PDF_DEFAULTS.ORIENTACION,
    });

    const resultado = crearResultado(true, buffer, estimatePages(html, 'semanal'), timestamp);
    resultado.filename = generarFilename('semanal', timestamp);
    return resultado;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
    return crearResultado(false, undefined, 0, nowISO(), errorMsg);
  }
}

/**
 * Genera una ficha PDF individual de una persona monitoreada.
 *
 * @param data - Datos de la ficha de persona
 * @param opciones - Opciones de personalización
 * @returns Resultado de la generación con buffer, metadata y filename
 *
 * @example
 * ```typescript
 * const resultado = await generarFichaPersona(fichaData, {
 *   logoUrl: 'https://ejemplo.com/logo.png',
 * });
 * ```
 */
export async function generarFichaPersona(
  data: FichaPersonaData,
  opciones: PDFGenerationOptions = {},
): Promise<PDFGenerationResult> {
  try {
    const timestamp = nowISO();
    const html = generarHTMLInforme(data, 'ficha_persona', opciones);
    const buffer = await htmlToPDF(html, {
      orientation: opciones.orientacion ?? PDF_DEFAULTS.ORIENTACION,
    });

    const resultado = crearResultado(true, buffer, estimatePages(html, 'ficha_persona'), timestamp);
    resultado.filename = generarFilename('ficha_persona', timestamp);
    return resultado;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
    return crearResultado(false, undefined, 0, nowISO(), errorMsg);
  }
}

/**
 * Genera un informe PDF ad-hoc con filtros personalizados.
 *
 * @param data - Datos del informe ad-hoc con filtros y resultados
 * @param opciones - Opciones de personalización
 * @returns Resultado de la generación con buffer, metadata y filename
 *
 * @example
 * ```typescript
 * const resultado = await generarInformeAdHoc(adHocData, {
 *   orientacion: 'landscape',
 * });
 * ```
 */
export async function generarInformeAdHoc(
  data: InformeAdHocData,
  opciones: PDFGenerationOptions = {},
): Promise<PDFGenerationResult> {
  try {
    const timestamp = nowISO();
    const html = generarHTMLInforme(data, 'ad_hoc', opciones);
    const buffer = await htmlToPDF(html, {
      orientation: opciones.orientacion ?? PDF_DEFAULTS.ORIENTACION,
    });

    const resultado = crearResultado(true, buffer, estimatePages(html, 'ad_hoc'), timestamp);
    resultado.filename = generarFilename('ad_hoc', timestamp);
    return resultado;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
    return crearResultado(false, undefined, 0, nowISO(), errorMsg);
  }
}

/**
 * Genera un informe PDF unificado. Función principal que distribuye
 * según el tipo de informe solicitado.
 *
 * @param data - Datos del informe (tipo discriminado)
 * @param tipo - Tipo de informe a generar
 * @param opciones - Opciones de personalización del PDF
 * @returns Promesa con el resultado de la generación
 *
 * @example
 * ```typescript
 * // Generar informe semanal
 * const resultadoSemanal = await generarInformePDF(
 *   dataSemanal,
 *   'semanal',
 *   { colorPrimario: '#1a5276' }
 * );
 *
 * // Generar ficha de persona
 * const resultadoFicha = await generarInformePDF(
 *   fichaData,
 *   'ficha_persona',
 *   { marcaAgua: true }
 * );
 * ```
 */
export async function generarInformePDF(
  data: InformeData,
  tipo: TipoInforme,
  opciones: PDFGenerationOptions = {},
): Promise<PDFGenerationResult> {
  switch (tipo) {
    case 'semanal':
      return generarInformeSemanal(data as InformeSemanalData, opciones);
    case 'ficha_persona':
      return generarFichaPersona(data as FichaPersonaData, opciones);
    case 'ad_hoc':
      return generarInformeAdHoc(data as InformeAdHocData, opciones);
  }
}

/**
 * Estima la cantidad de páginas basándose en la longitud del HTML.
 * Valores conservadores para reportes típicos.
 */
function estimatePages(html: string, tipo: TipoInforme): number {
  const baseLength = html.length;
  const mentionsFactor = (html.match(/<tr>/g) || []).length;
  const estimatedPerPage = 3000;
  const basePages = Math.max(1, Math.ceil(baseLength / estimatedPerPage));
  return basePages + Math.floor(mentionsFactor / 25);
}
