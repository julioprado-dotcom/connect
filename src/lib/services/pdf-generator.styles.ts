/**
 * @module pdf-generator.styles
 * @description Estilos CSS y utilidades de formateo para el generador de informes PDF.
 * Contiene la función de generación de estilos inline y los formateadores
 * de datos utilizados por las secciones y templates HTML.
 */

import type {
  TipoInforme,
  Sentimiento,
} from './pdf-generator.types.js';
import { PDF_DEFAULTS } from './pdf-generator.types.js';

// ─── Utilidades de Formateo ───────────────────────────────────────────

/** Genera un timestamp ISO para el momento actual */
export const nowISO = (): string => new Date().toISOString();

/** Genera un nombre de archivo basado en el tipo y fecha */
export const generarFilename = (tipo: TipoInforme, fecha: string): string => {
  const fechaLimpia = fecha.replace(/[:.]/g, '-').slice(0, 19);
  const prefijos: Record<TipoInforme, string> = {
    semanal: 'informe-semanal',
    ficha_persona: 'ficha-persona',
    ad_hoc: 'informe-adhoc',
  };
  return `${prefijos[tipo]}_${fechaLimpia}.pdf`;
};

/** Formatea una fecha ISO a formato legible en español */
export const formatearFecha = (fechaISO: string): string => {
  try {
    const fecha = new Date(fechaISO);
    return fecha.toLocaleDateString('es-BO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return fechaISO;
  }
};

/** Obtiene el color hex según el sentimiento */
export const colorSentimiento = (sentimiento: Sentimiento): string => {
  const colores: Record<Sentimiento, string> = {
    positivo: PDF_DEFAULTS.COLOR_POSITIVO,
    negativo: PDF_DEFAULTS.COLOR_NEGATIVO,
    neutro: PDF_DEFAULTS.COLOR_NEUTRO,
  };
  return colores[sentimiento];
};

/** Etiqueta legible para el sentimiento */
export const etiquetaSentimiento = (sentimiento: Sentimiento): string => {
  const etiquetas: Record<Sentimiento, string> = {
    positivo: 'Positivo',
    negativo: 'Negativo',
    neutro: 'Neutro',
  };
  return etiquetas[sentimiento];
};

/** Símbolo de tendencia para ranking */
export const simboloTendencia = (tendencia: 'sube' | 'baja' | 'estable'): string => {
  const simbolos = { sube: '▲', baja: '▼', estable: '●' };
  return simbolos[tendencia];
};

/** Color de tendencia */
export const colorTendencia = (tendencia: 'sube' | 'baja' | 'estable'): string => {
  const colores = { sube: '#22c55e', baja: '#ef4444', estable: '#6b7280' };
  return colores[tendencia];
};

/** Calcula el ancho de barra de progreso como porcentaje */
export const porcentajeBarra = (valor: number, maximo: number): number => {
  if (maximo <= 0) return 0;
  return Math.round((valor / maximo) * 100);
};

/** Escapa HTML para prevenir inyección */
export const escapeHTML = (texto: string): string => {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

// ─── Estilos CSS Base ─────────────────────────────────────────────────

/**
 * Genera los estilos CSS inline para el informe.
 * @param colorPrimario - Color hex primario personalizado
 * @returns String con bloques CSS
 */
export const generarEstilos = (colorPrimario: string): string => {
  const colorBg = '#f8faf9';
  const colorBgSection = '#ffffff';
  const colorBorder = '#e2e8f0';
  const colorText = '#1e293b';
  const colorTextSecondary = '#64748b';

  return `
    <style>
      @page {
        size: A4;
        margin: 15mm;
      }

      * { box-sizing: border-box; margin: 0; padding: 0; }

      body {
        font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
        font-size: 11px;
        line-height: 1.5;
        color: ${colorText};
        background: ${colorBg};
      }

      .page-break { page-break-before: always; }

      /* ── Portada ── */
      .portada {
        text-align: center;
        padding: 80px 40px 60px;
        background: linear-gradient(135deg, ${colorPrimario} 0%, ${colorPrimario}dd 100%);
        color: white;
        border-radius: 8px;
        margin-bottom: 24px;
        min-height: 600px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
      }

      .portada-logo {
        width: 160px;
        height: auto;
        margin-bottom: 32px;
        filter: brightness(0) invert(1);
      }

      .portada h1 {
        font-size: 28px;
        font-weight: 700;
        margin-bottom: 12px;
        letter-spacing: -0.5px;
      }

      .portada .periodo {
        font-size: 16px;
        opacity: 0.9;
        margin-bottom: 24px;
      }

      .portada .fecha-generacion {
        font-size: 12px;
        opacity: 0.7;
        margin-top: 32px;
      }

      /* ── Secciones ── */
      .seccion {
        background: ${colorBgSection};
        border: 1px solid ${colorBorder};
        border-radius: 6px;
        padding: 20px;
        margin-bottom: 16px;
        page-break-inside: avoid;
      }

      .seccion-titulo {
        font-size: 14px;
        font-weight: 700;
        color: ${colorPrimario};
        border-bottom: 2px solid ${colorPrimario};
        padding-bottom: 8px;
        margin-bottom: 16px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      /* ── Resumen ── */
      .resumen {
        font-size: 12px;
        line-height: 1.7;
        color: ${colorTextSecondary};
        padding: 12px 16px;
        background: ${colorBg};
        border-radius: 4px;
        border-left: 4px solid ${colorPrimario};
      }

      /* ── Tablas ── */
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 10px;
      }

      thead th {
        background: ${colorPrimario};
        color: white;
        padding: 8px 10px;
        text-align: left;
        font-weight: 600;
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.3px;
      }

      tbody td {
        padding: 7px 10px;
        border-bottom: 1px solid ${colorBorder};
        vertical-align: top;
      }

      tbody tr:nth-child(even) { background: ${colorBg}; }
      tbody tr:hover { background: ${colorPrimario}0a; }

      /* ── Estadísticas ── */
      .stats-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 12px;
        margin-bottom: 16px;
      }

      .stat-card {
        background: ${colorBg};
        border-radius: 6px;
        padding: 14px;
        text-align: center;
        border: 1px solid ${colorBorder};
      }

      .stat-valor {
        font-size: 26px;
        font-weight: 700;
        color: ${colorPrimario};
      }

      .stat-etiqueta {
        font-size: 10px;
        color: ${colorTextSecondary};
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-top: 4px;
      }

      /* ── Sentimiento Badge ── */
      .badge {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 10px;
        font-size: 9px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.3px;
      }

      .badge-positivo { background: ${PDF_DEFAULTS.COLOR_POSITIVO}20; color: ${PDF_DEFAULTS.COLOR_POSITIVO}; }
      .badge-negativo { background: ${PDF_DEFAULTS.COLOR_NEGATIVO}20; color: ${PDF_DEFAULTS.COLOR_NEGATIVO}; }
      .badge-neutro { background: ${PDF_DEFAULTS.COLOR_NEUTRO}20; color: ${PDF_DEFAULTS.COLOR_NEUTRO}; }

      /* ── Barra de Progreso ── */
      .barra-container {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 3px 0;
      }

      .barra-label {
        width: 120px;
        font-size: 10px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .barra-track {
        flex: 1;
        height: 16px;
        background: ${colorBorder};
        border-radius: 8px;
        overflow: hidden;
      }

      .barra-fill {
        height: 100%;
        border-radius: 8px;
        transition: width 0.3s;
      }

      .barra-valor {
        width: 36px;
        text-align: right;
        font-size: 10px;
        font-weight: 600;
        color: ${colorTextSecondary};
      }

      /* ── Ranking ── */
      .ranking-item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 0;
        border-bottom: 1px solid ${colorBorder};
      }

      .ranking-pos {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: ${colorPrimario};
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-weight: 700;
        flex-shrink: 0;
      }

      .ranking-nombre {
        flex: 1;
        font-weight: 600;
        font-size: 11px;
      }

      .ranking-tendencia {
        font-size: 14px;
      }

      .ranking-menciones {
        font-size: 12px;
        font-weight: 600;
        color: ${colorPrimario};
        min-width: 40px;
        text-align: right;
      }

      /* ── Ficha Persona ── */
      .persona-header {
        display: flex;
        gap: 20px;
        align-items: center;
        padding: 20px;
        background: ${colorBg};
        border-radius: 6px;
        margin-bottom: 20px;
      }

      .persona-foto {
        width: 80px;
        height: 80px;
        border-radius: 50%;
        object-fit: cover;
        border: 3px solid ${colorPrimario};
        flex-shrink: 0;
      }

      .persona-foto-placeholder {
        width: 80px;
        height: 80px;
        border-radius: 50%;
        background: ${colorPrimario}20;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 32px;
        color: ${colorPrimario};
        flex-shrink: 0;
        border: 3px solid ${colorPrimario};
      }

      .persona-nombre {
        font-size: 20px;
        font-weight: 700;
        color: ${colorPrimario};
      }

      .persona-cargo {
        font-size: 13px;
        color: ${colorTextSecondary};
        margin-top: 2px;
      }

      .persona-institucion {
        font-size: 11px;
        color: ${colorTextSecondary};
        margin-top: 2px;
      }

      .persona-ranking-badge {
        display: inline-block;
        padding: 4px 12px;
        background: ${colorPrimario};
        color: white;
        border-radius: 12px;
        font-size: 11px;
        font-weight: 600;
        margin-top: 6px;
      }

      /* ── Filtros Ad-Hoc ── */
      .filtros-container {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-bottom: 12px;
      }

      .filtro-tag {
        display: inline-block;
        padding: 3px 10px;
        background: ${colorPrimario}15;
        color: ${colorPrimario};
        border-radius: 12px;
        font-size: 10px;
        font-weight: 500;
        border: 1px solid ${colorPrimario}30;
      }

      /* ── Pie de Página / Marca de Agua ── */
      .footer {
        text-align: center;
        padding: 16px;
        margin-top: 24px;
        font-size: 9px;
        color: ${colorTextSecondary};
        border-top: 1px solid ${colorBorder};
      }

      .watermark {
        position: fixed;
        bottom: 10px;
        right: 10px;
        font-size: 8px;
        color: ${colorTextSecondary};
        opacity: 0.3;
        transform: rotate(-15deg);
        pointer-events: none;
      }

      /* ── Evolución Mensual ── */
      .evolucion-grid {
        display: flex;
        align-items: flex-end;
        gap: 8px;
        height: 120px;
        padding: 10px 0;
        border-bottom: 2px solid ${colorBorder};
      }

      .evolucion-bar {
        flex: 1;
        background: ${colorPrimario};
        border-radius: 4px 4px 0 0;
        min-width: 20px;
        position: relative;
        transition: height 0.3s;
      }

      .evolucion-label {
        position: absolute;
        bottom: -20px;
        left: 50%;
        transform: translateX(-50%);
        font-size: 8px;
        color: ${colorTextSecondary};
        white-space: nowrap;
      }

      .evolucion-valor {
        position: absolute;
        top: -16px;
        left: 50%;
        transform: translateX(-50%);
        font-size: 9px;
        font-weight: 600;
        color: ${colorPrimario};
      }

      .observaciones {
        font-size: 11px;
        line-height: 1.7;
        color: ${colorTextSecondary};
        padding: 12px 16px;
        background: ${colorBg};
        border-radius: 4px;
        border-left: 4px solid ${colorPrimario};
        margin-top: 12px;
      }

      .url-link {
        color: ${colorPrimario};
        text-decoration: none;
        font-size: 9px;
        word-break: break-all;
      }

      .excerpt-text {
        font-size: 9px;
        color: ${colorTextSecondary};
        font-style: italic;
        margin-top: 2px;
      }

      .empty-state {
        text-align: center;
        padding: 24px;
        color: ${colorTextSecondary};
        font-style: italic;
      }
    </style>
  `;
};
