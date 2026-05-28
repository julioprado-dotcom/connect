/**
 * @module pdf-generator.sections
 * @description Generadores de secciones HTML individuales para informes PDF.
 * Cada función genera un fragmento HTML reutilizable: portada, resumen,
 * estadísticas, tablas, ranking, ficha de persona, evolución, filtros y footer.
 */

import type {
  TipoInforme,
  Sentimiento,
  MencionInforme,
  PDFGenerationOptions,
  RankingPersonaEntry,
  PersonaInfo,
  RankingPosicion,
  EvolucionMensualEntry,
  FiltrosAdHoc,
} from './pdf-generator.types.js';
import { PDF_DEFAULTS } from './pdf-generator.types.js';
import {
  escapeHTML,
  etiquetaSentimiento,
  simboloTendencia,
  colorTendencia,
  porcentajeBarra,
  formatearFecha,
  nowISO,
} from './pdf-generator.styles.js';

// ─── Generadores de Secciones HTML ────────────────────────────────────

/**
 * Genera la portada del informe.
 */
export const generarPortada = (
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
export const generarResumen = (texto: string, colorPrimario: string): string => {
  if (!texto.trim()) return '<div class="empty-state">Sin resumen disponible</div>';
  return `<div class="resumen">${escapeHTML(texto)}</div>`;
};

/**
 * Genera las tarjetas de estadísticas resumidas.
 */
export const generarStatsCards = (
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
export const generarTablaDistribucion = (
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
export const generarRanking = (
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
export const generarTablaMenciones = (menciones: readonly MencionInforme[]): string => {
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
export const generarPersonaHeader = (
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
export const generarEvolucionMensual = (
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
export const generarFiltrosTags = (filtros: FiltrosAdHoc, colorPrimario: string): string => {
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
export const generarFooter = (conMarcaAgua: boolean): string => {
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
