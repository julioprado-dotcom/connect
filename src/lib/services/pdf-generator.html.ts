/**
 * @module pdf-generator.html
 * @description Generadores de HTML completo para cada tipo de informe PDF.
 * Orquesta las secciones individuales y envuelve el contenido con
 * estilos CSS y estructura HTML válida.
 */

import type {
  TipoInforme,
  InformeSemanalData,
  FichaPersonaData,
  InformeAdHocData,
  InformeData,
  PDFGenerationOptions,
} from './pdf-generator.types.js';
import { PDF_DEFAULTS } from './pdf-generator.types.js';
import { generarEstilos, escapeHTML, nowISO } from './pdf-generator.styles.js';
import {
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

// ─── Generadores de Informes Completos ────────────────────────────────

/**
 * Genera el HTML completo para un informe semanal.
 */
export const generarHTMLSemanal = (data: InformeSemanalData, opciones: PDFGenerationOptions, colorPrimario: string): string => {
  const titulo = 'Informe Semanal de Monitoreo de Medios';

  return `
    ${generarPortada('semanal', titulo, data.periodo, opciones, colorPrimario)}
    <div class="page-break"></div>

    <div class="seccion">
      <div class="seccion-titulo">Resumen Ejecutivo</div>
      ${generarResumen(data.resumenEjecutivo, colorPrimario)}
    </div>

    <div class="seccion">
      <div class="seccion-titulo">Estadísticas Generales</div>
      ${generarStatsCards(data.estadisticas.totalMenciones, data.estadisticas.porSentimiento, colorPrimario)}
    </div>

    <div class="seccion">
      <div class="seccion-titulo">Distribución por Medio</div>
      ${generarTablaDistribucion(data.estadisticas.porMedio, 'Medio', colorPrimario)}
    </div>

    <div class="seccion">
      <div class="seccion-titulo">Distribución por Eje Temático</div>
      ${generarTablaDistribucion(data.estadisticas.porEje, 'Eje Temático', colorPrimario)}
    </div>

    <div class="seccion">
      <div class="seccion-titulo">Ranking de Personas</div>
      ${generarRanking(data.rankingPersonas, colorPrimario)}
    </div>

    <div class="seccion">
      <div class="seccion-titulo">Detalle de Menciones</div>
      ${generarTablaMenciones(data.menciones)}
    </div>

    ${generarFooter(opciones.marcaAgua ?? PDF_DEFAULTS.MARCA_AGUA)}
  `;
};

/**
 * Genera el HTML completo para una ficha de persona.
 */
export const generarHTMLFichaPersona = (data: FichaPersonaData, opciones: PDFGenerationOptions, colorPrimario: string): string => {
  const titulo = `Ficha: ${data.persona.nombre}`;

  return `
    ${generarPortada('ficha_persona', titulo, data.periodo, opciones, colorPrimario)}
    <div class="page-break"></div>

    ${generarPersonaHeader(data.persona, data.ranking, colorPrimario)}

    <div class="seccion">
      <div class="seccion-titulo">Estadísticas del Periodo</div>
      ${generarStatsCards(data.estadisticas.totalMenciones, data.estadisticas.porSentimiento, colorPrimario)}
    </div>

    <div class="seccion">
      <div class="seccion-titulo">Evolución Mensual</div>
      ${generarEvolucionMensual(data.estadisticas.evolucionMensual, colorPrimario)}
    </div>

    <div class="seccion">
      <div class="seccion-titulo">Distribución por Medio</div>
      ${generarTablaDistribucion(data.estadisticas.porMedio, 'Medio', colorPrimario)}
    </div>

    <div class="seccion">
      <div class="seccion-titulo">Menciones Detalladas</div>
      ${generarTablaMenciones(data.menciones)}
    </div>

    <div class="seccion">
      <div class="seccion-titulo">Observaciones</div>
      ${data.observaciones.trim()
        ? `<div class="observaciones">${escapeHTML(data.observaciones)}</div>`
        : '<div class="empty-state">Sin observaciones registradas</div>'}
    </div>

    ${generarFooter(opciones.marcaAgua ?? PDF_DEFAULTS.MARCA_AGUA)}
  `;
};

/**
 * Genera el HTML completo para un informe ad-hoc.
 */
export const generarHTMLAdHoc = (data: InformeAdHocData, opciones: PDFGenerationOptions, colorPrimario: string): string => {
  return `
    ${generarPortada('ad_hoc', data.titulo, {
      desde: data.filtros.fechaDesde ?? nowISO(),
      hasta: data.filtros.fechaHasta ?? nowISO(),
    }, opciones, colorPrimario)}
    <div class="page-break"></div>

    ${generarFiltrosTags(data.filtros, colorPrimario)}

    <div class="seccion">
      <div class="seccion-titulo">Resumen</div>
      ${generarResumen(data.resumen, colorPrimario)}
    </div>

    <div class="seccion">
      <div class="seccion-titulo">Estadísticas</div>
      ${generarStatsCards(data.estadisticas.totalMenciones, data.estadisticas.porSentimiento, colorPrimario)}
    </div>

    <div class="seccion">
      <div class="seccion-titulo">Distribución por Medio</div>
      ${generarTablaDistribucion(data.estadisticas.porMedio, 'Medio', colorPrimario)}
    </div>

    <div class="seccion">
      <div class="seccion-titulo">Menciones</div>
      ${generarTablaMenciones(data.menciones)}
    </div>

    ${generarFooter(opciones.marcaAgua ?? PDF_DEFAULTS.MARCA_AGUA)}
  `;
};

// ─── Función Pública Principal ────────────────────────────────────────

/**
 * Genera el HTML completo de un informe según su tipo.
 *
 * @param data - Datos del informe (semanal, ficha de persona o ad-hoc)
 * @param tipo - Tipo de informe a generar
 * @param opciones - Opciones de personalización del PDF
 * @returns String con el HTML completo del informe
 *
 * @example
 * ```typescript
 * const html = generarHTMLInforme(dataSemanal, 'semanal', { colorPrimario: '#1a5276' });
 * ```
 */
export function generarHTMLInforme(
  data: InformeData,
  tipo: TipoInforme,
  opciones: PDFGenerationOptions = {},
): string {
  const colorPrimario = opciones.colorPrimario ?? PDF_DEFAULTS.COLOR_PRIMARIO;
  const estilos = generarEstilos(colorPrimario);
  const orientacion = opciones.orientacion ?? PDF_DEFAULTS.ORIENTACION;

  let contenidoHTML: string;

  switch (tipo) {
    case 'semanal':
      contenidoHTML = generarHTMLSemanal(data as InformeSemanalData, opciones, colorPrimario);
      break;
    case 'ficha_persona':
      contenidoHTML = generarHTMLFichaPersona(data as FichaPersonaData, opciones, colorPrimario);
      break;
    case 'ad_hoc':
      contenidoHTML = generarHTMLAdHoc(data as InformeAdHocData, opciones, colorPrimario);
      break;
  }

  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>DECODEX Bolivia - Informe ${tipo}</title>
      ${estilos}
    </head>
    <body style="orientation: ${orientacion};">
      ${contenidoHTML}
    </body>
    </html>
  `.trim();
}
