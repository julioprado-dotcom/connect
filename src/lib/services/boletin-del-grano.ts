/**
 * @module boletin-del-grano
 * @description Servicio de generación de PDF para el BOLETÍN DEL GRANO — boletín
 * semanal de café de especialidad de Bolivia, producido por DECODEX Bolivia.
 *
 * Funciona en dos modos:
 * - **Modo producción**: Convierte HTML a PDF via Puppeteer.
 * - **Modo mock**: Genera HTML completo y retorna buffer vacío (testing/desarrollo).
 */

// ─── Tipos Exportados ──────────────────────────────────────────────────

export interface BoletinGranoNoticia {
  titulo: string;
  medio: string;
  fecha: string;
  resumen: string;
  ejes: string[];
  tension: 'ALTA' | 'MEDIA' | 'BAJA';
  fuentes: number;
  url?: string;
}

export interface BoletinGranoEje {
  nombre: string;
  cobertura: number;
  noticias: number;
  tendencia: '↑' | '→' | '↓';
}

export interface BoletinGranoData {
  periodoInicio: string;
  periodoFin: string;
  semanaNumero: number;
  version: string;
  tensionGeneral: 'ALTA' | 'MEDIA' | 'BAJA';
  resumenEjecutivo: string;
  totalNoticias: number;
  fuentesMonitoreadas: number;
  ejesActivados: number;
  nivelActividad: 'MODERADO' | 'ALTO' | 'CRÍTICO';
  precioCMarket: string;
  variacionSemanal: string;
  noticiaMasMencionada: string;
  ejes: BoletinGranoEje[];
  noticiasDestacadas: BoletinGranoNoticia[];
  fuentesRanking: { nombre: string; noticias: number; nuevas: boolean }[];
  cruceTransversal: string;
  tendenciaProyeccion: string;
  fuentesMonitoreadasLista: string[];
  keywordsResumen: string;
}

// ─── Re-exports — backward compatibility ──────────────────────────────

export {
  COLORS,
  generarEstilos,
} from './boletin-del-grano.styles';

export {
  escapeHTML,
  colorTension,
  colorTensionBg,
  colorTendencia,
  formatearFecha,
  generarPortada,
  generarResumenEjecutivo,
  generarEstadisticasClave,
  generarMapaTensiones,
  generarNoticiasDestacadas,
  generarIndiceFuentes,
  generarCruceTransversal,
  generarTendenciaProyeccion,
  generarNotaMetodologica,
  generarFooter,
} from './boletin-del-grano.html';

// ─── Imports internos ──────────────────────────────────────────────────

import { generarEstilos } from './boletin-del-grano.styles';
import {
  generarPortada,
  generarResumenEjecutivo,
  generarEstadisticasClave,
  generarMapaTensiones,
  generarNoticiasDestacadas,
  generarIndiceFuentes,
  generarCruceTransversal,
  generarTendenciaProyeccion,
  generarNotaMetodologica,
  generarFooter,
} from './boletin-del-grano.html';

// ─── Constantes Internas ──────────────────────────────────────────────

// CRÍTICO: puppeteer es un módulo Node.js puro (no disponible en Edge Runtime).
// Usamos dynamic import para evitar que Turbopack trace este módulo al compilar
// instrumentation.ts para Edge Runtime.
let _puppeteerAvailable: boolean | null = null;

const isPuppeteerAvailable = async (): Promise<boolean> => {
  if (_puppeteerAvailable !== null) return _puppeteerAvailable;
  try {
    await import(/* webpackIgnore: true */ 'puppeteer');
    _puppeteerAvailable = true;
    return true;
  } catch {
    _puppeteerAvailable = false;
    return false;
  }
};

// ─── Funciones Exportadas ──────────────────────────────────────────────

/**
 * Genera el HTML completo para el Boletín del Grano.
 *
 * @param data - Datos del boletín semanal
 * @returns String con el HTML completo del documento
 *
 * @example
 * ```typescript
 * const html = generarHTMLBoletinDelGrano(datosSemanales);
 * ```
 */
export function generarHTMLBoletinDelGrano(data: BoletinGranoData): string {
  const estilos = generarEstilos();

  const contenido = `
    ${generarPortada(data)}
    <div class="page-break"></div>

    ${generarResumenEjecutivo(data)}

    ${generarEstadisticasClave(data)}

    <div class="page-break"></div>

    ${generarMapaTensiones(data)}

    ${generarNoticiasDestacadas(data)}

    <div class="page-break"></div>

    ${generarIndiceFuentes(data)}

    ${generarCruceTransversal(data)}

    ${generarTendenciaProyeccion(data)}

    ${generarNotaMetodologica(data)}

    ${generarFooter()}
  `.trim();

  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Boletín del Grano — Semana ${data.semanaNumero}</title>
      ${estilos}
    </head>
    <body>
      ${contenido}
    </body>
    </html>
  `.trim();
}

/**
 * Genera el PDF del Boletín del Grano usando Puppeteer.
 * Si Puppeteer no está disponible, retorna un buffer vacío (modo mock).
 *
 * @param data - Datos del boletín semanal
 * @returns Buffer binario del PDF generado
 *
 * @example
 * ```typescript
 * const pdfBuffer = await generarPDFBoletinDelGrano(datosSemanales);
 * fs.writeFileSync('boletin.pdf', pdfBuffer);
 * ```
 */
export async function generarPDFBoletinDelGrano(data: BoletinGranoData): Promise<Buffer> {
  if (!await isPuppeteerAvailable()) {
    // Modo mock: retorna buffer vacío
    return Buffer.alloc(0);
  }

  // Modo producción con Puppeteer (si está disponible)
  let puppeteer: any;
  try {
    puppeteer = (await import(/* webpackIgnore: true */ 'puppeteer')).default || (await import(/* webpackIgnore: true */ 'puppeteer'));
  } catch {
    console.warn('[BoletinDelGrano] puppeteer no instalado, usando modo mock');
    return Buffer.alloc(0);
  }
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();

    const html = generarHTMLBoletinDelGrano(data);
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const buffer = await page.pdf({
      format: 'A4',
      margin: {
        top: '20mm',
        bottom: '20mm',
        left: '15mm',
        right: '15mm',
      },
      printBackground: true,
    });

    return Buffer.from(buffer);
  } finally {
    await browser.close();
  }
}
