/**
 * @module pdf-generator
 * @description Implementación principal del Módulo A4 - Generador de Informes PDF.
 * Servicio plug-in independiente para DECODEX Bolivia que genera informes PDF
 * profesionales: semanales, fichas de persona e informes ad-hoc.
 *
 * Funciona en dos modos:
 * - **Modo producción**: Convierte HTML a PDF via Puppeteer.
 * - **Modo mock**: Genera HTML completo y retorna metadata (para testing/desarrollo).
 */

import type {
  TipoInforme,
  MencionInforme,
  InformeSemanalData,
  FichaPersonaData,
  InformeAdHocData,
  InformeData,
  PDFGenerationOptions,
  PDFGenerationResult,
  Orientacion,
  Sentimiento,
  FiltrosAdHoc,
  EstadisticasInforme,
  EstadisticasFicha,
  EstadisticasAdHoc,
  RankingPersonaEntry,
  EvolucionMensualEntry,
  HTMLToPDFOptions,
  PersonaInfo,
  RankingPosicion,
} from './pdf-generator.types.js';
import { PDF_DEFAULTS } from './pdf-generator.types.js';

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

/** Genera un timestamp ISO para el momento actual */
const nowISO = (): string => new Date().toISOString();

/** Genera un nombre de archivo basado en el tipo y fecha */
const generarFilename = (tipo: TipoInforme, fecha: string): string => {
  const fechaLimpia = fecha.replace(/[:.]/g, '-').slice(0, 19);
  const prefijos: Record<TipoInforme, string> = {
    semanal: 'informe-semanal',
    ficha_persona: 'ficha-persona',
    ad_hoc: 'informe-adhoc',
  };
  return `${prefijos[tipo]}_${fechaLimpia}.pdf`;
};

/** Formatea una fecha ISO a formato legible en español */
const formatearFecha = (fechaISO: string): string => {
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
const colorSentimiento = (sentimiento: Sentimiento): string => {
  const colores: Record<Sentimiento, string> = {
    positivo: PDF_DEFAULTS.COLOR_POSITIVO,
    negativo: PDF_DEFAULTS.COLOR_NEGATIVO,
    neutro: PDF_DEFAULTS.COLOR_NEUTRO,
  };
  return colores[sentimiento];
};

/** Etiqueta legible para el sentimiento */
const etiquetaSentimiento = (sentimiento: Sentimiento): string => {
  const etiquetas: Record<Sentimiento, string> = {
    positivo: 'Positivo',
    negativo: 'Negativo',
    neutro: 'Neutro',
  };
  return etiquetas[sentimiento];
};

/** Símbolo de tendencia para ranking */
const simboloTendencia = (tendencia: 'sube' | 'baja' | 'estable'): string => {
  const simbolos = { sube: '▲', baja: '▼', estable: '●' };
  return simbolos[tendencia];
};

/** Color de tendencia */
const colorTendencia = (tendencia: 'sube' | 'baja' | 'estable'): string => {
  const colores = { sube: '#22c55e', baja: '#ef4444', estable: '#6b7280' };
  return colores[tendencia];
};

/** Calcula el ancho de barra de progreso como porcentaje */
const porcentajeBarra = (valor: number, maximo: number): number => {
  if (maximo <= 0) return 0;
  return Math.round((valor / maximo) * 100);
};

/** Escapa HTML para prevenir inyección */
const escapeHTML = (texto: string): string => {
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
const generarEstilos = (colorPrimario: string): string => {
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

// ─── Generadores de Secciones HTML ────────────────────────────────────

/**
 * Genera la portada del informe.
 */
const generarPortada = (
  tipo: TipoInforme,
  titulo: string,
  periodo: { desde: string; hasta: string },
  opciones: PDFGenerationOptions,
  colorPrimario: string,
): string => {
  const logoUrl = opciones.logoUrl || PDF_DEFAULTS.LOGO_PLACEHOLDER;
  const fechaGeneracion = formatearFecha(nowISO());
  const periodoStr = `${formatearFecha(periodo.desde)} al ${formatearFecha(periodo.hasta)}`;

  return `
    <div class="portada">
      <img src="${escapeHTML(logoUrl)}" alt="DECODEX Bolivia" class="portada-logo" />
      <h1>${escapeHTML(titulo)}</h1>
      <div class="periodo">${escapeHTML(periodoStr)}</div>
      <div style="margin-top: 16px; font-size: 13px; opacity: 0.8;">
        Informe ${tipo === 'semanal' ? 'Semanal de Monitoreo' : tipo === 'ficha_persona' ? 'Ficha Individual' : 'Personalizado (Ad-Hoc)'}
      </div>
      <div class="fecha-generacion">Generado el ${escapeHTML(fechaGeneracion)}</div>
    </div>
  `;
};

/**
 * Genera el resumen ejecutivo o resumen del informe.
 */
const generarResumen = (texto: string, colorPrimario: string): string => {
  if (!texto.trim()) return '<div class="empty-state">Sin resumen disponible</div>';
  return `<div class="resumen">${escapeHTML(texto)}</div>`;
};

/**
 * Genera las tarjetas de estadísticas resumidas.
 */
const generarStatsCards = (
  total: number,
  porSentimiento: Record<Sentimiento, number>,
  colorPrimario: string,
): string => {
  const positivo = porSentimiento.positivo ?? 0;
  const negativo = porSentimiento.negativo ?? 0;
  const neutro = porSentimiento.neutro ?? 0;

  return `
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-valor">${total}</div>
        <div class="stat-etiqueta">Total Menciones</div>
      </div>
      <div class="stat-card">
        <div class="stat-valor" style="color: ${PDF_DEFAULTS.COLOR_POSITIVO};">${positivo}</div>
        <div class="stat-etiqueta">Positivas</div>
      </div>
      <div class="stat-card">
        <div class="stat-valor" style="color: ${PDF_DEFAULTS.COLOR_NEGATIVO};">${negativo}</div>
        <div class="stat-etiqueta">Negativas</div>
      </div>
    </div>
  `;
};

/**
 * Genera una tabla con la distribución por medio.
 */
const generarTablaDistribucion = (
  datos: Record<string, number>,
  tituloColumna: string,
  colorPrimario: string,
): string => {
  const entradas = Object.entries(datos).sort(([, a], [, b]) => b - a);
  if (entradas.length === 0) return '<div class="empty-state">Sin datos</div>';

  const maxVal = Math.max(...entradas.map(([, v]) => v));

  const filas = entradas
    .map(([clave, valor]) => {
      const pct = porcentajeBarra(valor, maxVal);
      return `
        <tr>
          <td>${escapeHTML(clave)}</td>
          <td style="width: 60%;">
            <div class="barra-container">
              <div class="barra-track">
                <div class="barra-fill" style="width: ${pct}%; background: ${colorPrimario};"></div>
              </div>
              <div class="barra-valor">${valor}</div>
            </div>
          </td>
        </tr>
      `;
    })
    .join('');

  return `
    <table>
      <thead>
        <tr>
          <th>${escapeHTML(tituloColumna)}</th>
          <th>Cantidad</th>
        </tr>
      </thead>
      <tbody>${filas}</tbody>
    </table>
  `;
};

/**
 * Genera la tabla de ranking de personas.
 */
const generarRanking = (
  ranking: readonly RankingPersonaEntry[],
  colorPrimario: string,
): string => {
  if (ranking.length === 0) return '<div class="empty-state">Sin datos de ranking</div>';

  const items = ranking
    .map((entry, index) => `
      <div class="ranking-item">
        <div class="ranking-pos">${index + 1}</div>
        <div class="ranking-nombre">${escapeHTML(entry.nombre)}</div>
        <div class="ranking-tendencia" style="color: ${colorTendencia(entry.tendencia)};">
          ${simboloTendencia(entry.tendencia)}
        </div>
        <div class="ranking-menciones">${entry.menciones}</div>
      </div>
    `)
    .join('');

  return items;
};

/**
 * Genera la tabla de menciones detalladas.
 */
const generarTablaMenciones = (menciones: readonly MencionInforme[]): string => {
  if (menciones.length === 0) return '<div class="empty-state">No hay menciones para este periodo</div>';

  const filas = menciones
    .map((m) => {
      const sentBadge = `badge-${m.sentimiento}`;
      const urlCell = m.url
        ? `<a href="${escapeHTML(m.url)}" class="url-link" target="_blank">Ver fuente</a>`
        : '';
      const excerptCell = m.excerpt
        ? `<div class="excerpt-text">${escapeHTML(m.excerpt)}</div>`
        : '';

      return `
        <tr>
          <td style="font-weight: 600;">${escapeHTML(m.persona)}</td>
          <td>${escapeHTML(m.medio)}</td>
          <td>${escapeHTML(m.fecha)}</td>
          <td>${escapeHTML(m.titular)}</td>
          <td><span class="badge ${sentBadge}">${etiquetaSentimiento(m.sentimiento)}</span></td>
          <td>${escapeHTML(m.ejeTematico)}</td>
          <td>${urlCell}</td>
        </tr>
        ${excerptCell ? `<tr><td colspan="7">${excerptCell}</td></tr>` : ''}
      `;
    })
    .join('');

  return `
    <table>
      <thead>
        <tr>
          <th>Persona</th>
          <th>Medio</th>
          <th>Fecha</th>
          <th>Titular</th>
          <th>Sentimiento</th>
          <th>Eje Temático</th>
          <th>Fuente</th>
        </tr>
      </thead>
      <tbody>${filas}</tbody>
    </table>
  `;
};

/**
 * Genera la cabecera de ficha de persona.
 */
const generarPersonaHeader = (
  persona: PersonaInfo,
  ranking: RankingPosicion,
  colorPrimario: string,
): string => {
  const fotoElement = persona.fotoUrl
    ? `<img src="${escapeHTML(persona.fotoUrl)}" alt="${escapeHTML(persona.nombre)}" class="persona-foto" />`
    : `<div class="persona-foto-placeholder">👤</div>`;

  return `
    <div class="persona-header">
      ${fotoElement}
      <div>
        <div class="persona-nombre">${escapeHTML(persona.nombre)}</div>
        <div class="persona-cargo">${escapeHTML(persona.cargo)}</div>
        <div class="persona-institucion">${escapeHTML(persona.institucion)}</div>
        <div class="persona-ranking-badge">
          Ranking #${ranking.posicion} de ${ranking.total}
        </div>
      </div>
    </div>
  `;
};

/**
 * Genera la visualización de evolución mensual con barras.
 */
const generarEvolucionMensual = (
  evolucion: readonly EvolucionMensualEntry[],
  colorPrimario: string,
): string => {
  if (evolucion.length === 0) return '<div class="empty-state">Sin datos de evolución</div>';

  const maxVal = Math.max(...evolucion.map((e) => e.cantidad));

  const barras = evolucion
    .map((entry) => {
      const height = maxVal > 0 ? Math.max((entry.cantidad / maxVal) * 100, 4) : 4;
      const mesLabel = entry.mes.split('-')[1] ? entry.mes : entry.mes.slice(-2);
      return `
        <div class="evolucion-bar" style="height: ${height}%;">
          <div class="evolucion-valor">${entry.cantidad}</div>
          <div class="evolucion-label">${escapeHTML(mesLabel)}</div>
        </div>
      `;
    })
    .join('');

  return `
    <div class="evolucion-grid">
      ${barras}
    </div>
    <div style="height: 24px;"></div>
  `;
};

/**
 * Genera los tags de filtros aplicados para informes ad-hoc.
 */
const generarFiltrosTags = (filtros: FiltrosAdHoc, colorPrimario: string): string => {
  const tags: string[] = [];

  if (filtros.personas && filtros.personas.length > 0) {
    tags.push(...filtros.personas.map((p) => `Persona: ${p}`));
  }
  if (filtros.medios && filtros.medios.length > 0) {
    tags.push(...filtros.medios.map((m) => `Medio: ${m}`));
  }
  if (filtros.ejes && filtros.ejes.length > 0) {
    tags.push(...filtros.ejes.map((e) => `Eje: ${e}`));
  }
  if (filtros.sentimientos && filtros.sentimientos.length > 0) {
    tags.push(...filtros.sentimientos.map((s) => `Sentimiento: ${s}`));
  }
  if (filtros.fechaDesde) {
    tags.push(`Desde: ${filtros.fechaDesde}`);
  }
  if (filtros.fechaHasta) {
    tags.push(`Hasta: ${filtros.fechaHasta}`);
  }

  if (tags.length === 0) return '';

  const tagsHTML = tags.map((t) => `<span class="filtro-tag">${escapeHTML(t)}</span>`).join('');
  return `
    <div class="seccion">
      <div class="seccion-titulo">Filtros Aplicados</div>
      <div class="filtros-container">${tagsHTML}</div>
    </div>
  `;
};

/**
 * Genera el pie de página con marca de agua.
 */
const generarFooter = (conMarcaAgua: boolean): string => {
  const marcaAgua = conMarcaAgua
    ? `<div class="watermark">DECODEX Bolivia</div>`
    : '';

  return `
    ${marcaAgua}
    <div class="footer">
      DECODEX Bolivia — Sistema de Monitoreo de Medios<br />
      Informe generado automáticamente. Documento confidencial.
    </div>
  `;
};

// ─── Generadores de Informes Completos ────────────────────────────────

/**
 * Genera el HTML completo para un informe semanal.
 */
const generarHTMLSemanal = (data: InformeSemanalData, opciones: PDFGenerationOptions, colorPrimario: string): string => {
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
const generarHTMLFichaPersona = (data: FichaPersonaData, opciones: PDFGenerationOptions, colorPrimario: string): string => {
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
const generarHTMLAdHoc = (data: InformeAdHocData, opciones: PDFGenerationOptions, colorPrimario: string): string => {
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
