/**
 * @module boletin-del-grano.html
 * @description Generadores de secciones HTML para el BOLETÍN DEL GRANO.
 * Contiene funciones auxiliares de formateo y cada sección del documento
 * como función independiente. Extraído de boletin-del-grano.ts para
 * mantener la modularidad del servicio.
 */

import type { BoletinGranoData } from './boletin-del-grano';
import { COLORS } from './boletin-del-grano.styles';

// ─── Funciones Auxiliares ──────────────────────────────────────────────

/** Escapa HTML para prevenir inyección XSS */
export const escapeHTML = (texto: string): string => {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

/** Retorna el color correspondiente al nivel de tensión */
export const colorTension = (tension: 'ALTA' | 'MEDIA' | 'BAJA'): string => {
  switch (tension) {
    case 'ALTA':  return COLORS.tensionAlta;
    case 'MEDIA': return COLORS.tensionMedia;
    case 'BAJA':  return COLORS.tensionBaja;
  }
};

/** Retorna el color de fondo del badge de tensión */
export const colorTensionBg = (tension: 'ALTA' | 'MEDIA' | 'BAJA'): string => {
  switch (tension) {
    case 'ALTA':  return `${COLORS.tensionAlta}18`;
    case 'MEDIA': return `${COLORS.tensionMedia}18`;
    case 'BAJA':  return `${COLORS.tensionBaja}18`;
  }
};

/** Color de la flecha de tendencia */
export const colorTendencia = (tendencia: '↑' | '→' | '↓'): string => {
  switch (tendencia) {
    case '↑': return '#2e7d32';
    case '↓': return '#c62828';
    case '→': return '#6d4c41';
  }
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

// ─── Generadores de Secciones HTML ────────────────────────────────────

/**
 * Sección 1 — PORTADA
 */
export const generarPortada = (data: BoletinGranoData): string => {
  const periodoStr = `${formatearFecha(data.periodoInicio)} al ${formatearFecha(data.periodoFin)}`;
  const tensionColor = colorTension(data.tensionGeneral);
  const tensionBg = colorTensionBg(data.tensionGeneral);

  return `
    <div class="portada">
      <div class="portada-icono">&#9749;</div>
      <h1>Boletín del Grano</h1>
      <div class="subtitulo">Café de Especialidad Bolivia — Análisis Semanal</div>
      <div class="periodo">${escapeHTML(periodoStr)}</div>
      <div class="semana-info">Semana ${data.semanaNumero} &bull; Versión ${escapeHTML(data.version)}</div>
      <div style="margin-top: 20px;">
        <span class="tension-badge" style="color: ${tensionColor}; background: ${tensionBg}; border-color: ${tensionColor};">
          Tensión ${escapeHTML(data.tensionGeneral)}
        </span>
      </div>
      <div class="marca">DECODEX Bolivia &mdash; decodebolivia.org</div>
    </div>
  `;
};

/**
 * Sección 2 — RESUMEN EJECUTIVO
 */
export const generarResumenEjecutivo = (data: BoletinGranoData): string => {
  if (!data.resumenEjecutivo.trim()) {
    return '<div class="empty-state">Sin resumen ejecutivo disponible</div>';
  }

  // Convertir párrafos separados por doble salto de línea
  const parrafos = data.resumenEjecutivo
    .split(/\n\s*\n/)
    .filter((p) => p.trim().length > 0)
    .map((p) => `<p>${escapeHTML(p.trim())}</p>`)
    .join('');

  return `
    <div class="seccion">
      <div class="seccion-titulo"><span class="num">2</span>Resumen Ejecutivo</div>
      <div class="resumen-texto">${parrafos}</div>
    </div>
  `;
};

/**
 * Sección 3 — ESTADÍSTICAS CLAVE
 */
export const generarEstadisticasClave = (data: BoletinGranoData): string => {
  return `
    <div class="seccion">
      <div class="seccion-titulo"><span class="num">3</span>Estadísticas Clave</div>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-valor">${data.totalNoticias}</div>
          <div class="stat-etiqueta">Noticias Totales</div>
        </div>
        <div class="stat-card">
          <div class="stat-valor">${data.fuentesMonitoreadas}</div>
          <div class="stat-etiqueta">Fuentes Monitoreadas</div>
        </div>
        <div class="stat-card">
          <div class="stat-valor">${data.ejesActivados}</div>
          <div class="stat-etiqueta">Ejes Activados</div>
        </div>
        <div class="stat-card">
          <div class="stat-valor" style="font-size: 18px;">${escapeHTML(data.nivelActividad)}</div>
          <div class="stat-etiqueta">Nivel de Actividad</div>
        </div>
        <div class="stat-card">
          <div class="stat-valor" style="font-size: 18px;">${escapeHTML(data.precioCMarket)}</div>
          <div class="stat-etiqueta">Precio C-Market</div>
        </div>
        <div class="stat-card">
          <div class="stat-valor" style="font-size: 18px;">${escapeHTML(data.variacionSemanal)}</div>
          <div class="stat-etiqueta">Variación Semanal</div>
        </div>
      </div>
    </div>
  `;
};

/**
 * Sección 4 — MAPA DE TENSIONES (tabla de 7 ejes internos)
 */
export const generarMapaTensiones = (data: BoletinGranoData): string => {
  if (data.ejes.length === 0) {
    return '<div class="empty-state">Sin datos de ejes disponibles</div>';
  }

  const filas = data.ejes
    .map((eje) => {
      const tendenciaColor = colorTendencia(eje.tendencia);
      return `
        <tr>
          <td style="font-weight: 600;">${escapeHTML(eje.nombre)}</td>
          <td>
            <div class="barra-track">
              <div class="barra-fill" style="width: ${eje.cobertura}%;"></div>
            </div>
            <div style="font-family: 'Montserrat', sans-serif; font-size: 9px; color: ${COLORS.muted}; margin-top: 2px;">${eje.cobertura}%</div>
          </td>
          <td style="text-align: center; font-weight: 600;">${eje.noticias}</td>
          <td style="text-align: center; font-size: 16px; color: ${tendenciaColor}; font-weight: 700;">${eje.tendencia}</td>
        </tr>
      `;
    })
    .join('');

  return `
    <div class="seccion">
      <div class="seccion-titulo"><span class="num">4</span>Mapa de Tensiones</div>
      <table>
        <thead>
          <tr>
            <th style="width: 30%;">Eje Temático</th>
            <th style="width: 40%;">Cobertura</th>
            <th style="width: 15%; text-align: center;">Noticias</th>
            <th style="width: 15%; text-align: center;">Tendencia</th>
          </tr>
        </thead>
        <tbody>${filas}</tbody>
      </table>
    </div>
  `;
};

/**
 * Sección 5 — NOTICIAS DESTACADAS
 */
export const generarNoticiasDestacadas = (data: BoletinGranoData): string => {
  if (data.noticiasDestacadas.length === 0) {
    return '<div class="empty-state">Sin noticias destacadas para este periodo</div>';
  }

  const tarjetas = data.noticiasDestacadas
    .map((noticia) => {
      const tColor = colorTension(noticia.tension);
      const tBg = colorTensionBg(noticia.tension);

      const ejesHTML = noticia.ejes
        .map((e) => `<span class="eje-tag">${escapeHTML(e)}</span>`)
        .join('');

      return `
        <div class="noticia-card" style="border-left-color: ${tColor};">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
            <div class="noticia-titulo">${escapeHTML(noticia.titulo)}</div>
            <span class="tension-badge" style="color: ${tColor}; background: ${tBg}; border-color: ${tColor}; font-size: 8px; padding: 3px 10px; flex-shrink: 0; margin-left: 8px;">
              ${escapeHTML(noticia.tension)}
            </span>
          </div>
          <div class="noticia-meta">
            ${escapeHTML(noticia.medio)} &bull; ${escapeHTML(noticia.fecha)} &bull; ${noticia.fuentes} fuente${noticia.fuentes !== 1 ? 's' : ''}
          </div>
          <div class="noticia-resumen">${escapeHTML(noticia.resumen)}</div>
          <div class="noticia-ejes">${ejesHTML}</div>
        </div>
      `;
    })
    .join('');

  return `
    <div class="seccion">
      <div class="seccion-titulo"><span class="num">5</span>Noticias Destacadas</div>
      ${tarjetas}
    </div>
  `;
};

/**
 * Sección 6 — ÍNDICE DE FUENTES (ranking de fuentes)
 */
export const generarIndiceFuentes = (data: BoletinGranoData): string => {
  if (data.fuentesRanking.length === 0) {
    return '<div class="empty-state">Sin datos de fuentes para este periodo</div>';
  }

  const filas = data.fuentesRanking
    .map((fuente, index) => {
      const nuevaBadge = fuente.nuevas
        ? '<span class="fuente-nueva-badge">NUEVA</span>'
        : '';
      return `
        <tr>
          <td style="font-weight: 700; text-align: center; color: ${COLORS.accent2};">${index + 1}</td>
          <td style="font-weight: 600;">${escapeHTML(fuente.nombre)}${nuevaBadge}</td>
          <td style="text-align: center; font-weight: 700; color: ${COLORS.header};">${fuente.noticias}</td>
        </tr>
      `;
    })
    .join('');

  return `
    <div class="seccion">
      <div class="seccion-titulo"><span class="num">6</span>Índice de Fuentes</div>
      <table>
        <thead>
          <tr>
            <th style="width: 10%; text-align: center;">#</th>
            <th style="width: 70%;">Fuente</th>
            <th style="width: 20%; text-align: center;">Noticias</th>
          </tr>
        </thead>
        <tbody>${filas}</tbody>
      </table>
    </div>
  `;
};

/**
 * Sección 7 — CRUCE TRANSVERSAL
 */
export const generarCruceTransversal = (data: BoletinGranoData): string => {
  if (!data.cruceTransversal.trim()) {
    return '<div class="empty-state">Sin análisis transversal disponible</div>';
  }

  const parrafos = data.cruceTransversal
    .split(/\n\s*\n/)
    .filter((p) => p.trim().length > 0)
    .map((p) => `<p>${escapeHTML(p.trim())}</p>`)
    .join('');

  return `
    <div class="seccion">
      <div class="seccion-titulo"><span class="num">7</span>Cruce Transversal</div>
      <div class="analisis-texto">${parrafos}</div>
    </div>
  `;
};

/**
 * Sección 8 — TENDENCIA Y PROYECCIÓN
 */
export const generarTendenciaProyeccion = (data: BoletinGranoData): string => {
  if (!data.tendenciaProyeccion.trim()) {
    return '<div class="empty-state">Sin proyección de tendencia disponible</div>';
  }

  const parrafos = data.tendenciaProyeccion
    .split(/\n\s*\n/)
    .filter((p) => p.trim().length > 0)
    .map((p) => `<p>${escapeHTML(p.trim())}</p>`)
    .join('');

  return `
    <div class="seccion">
      <div class="seccion-titulo"><span class="num">8</span>Tendencia y Proyección</div>
      <div class="analisis-texto">${parrafos}</div>
    </div>
  `;
};

/**
 * Sección 9 — NOTA METODOLÓGICA
 */
export const generarNotaMetodologica = (data: BoletinGranoData): string => {
  const periodoStr = `${formatearFecha(data.periodoInicio)} al ${formatearFecha(data.periodoFin)}`;

  const fuentesItems = data.fuentesMonitoreadasLista
    .map((f) => `<li>${escapeHTML(f)}</li>`)
    .join('');

  return `
    <div class="seccion">
      <div class="seccion-titulo"><span class="num">9</span>Nota Metodológica</div>

      <p style="font-size: 10.5px; line-height: 1.7; color: ${COLORS.text}; margin-bottom: 14px;">
        El <strong>Boletín del Grano</strong> es un producto de análisis semanal elaborado por
        <strong>DECODEX Bolivia</strong> que monitorea, clasifica y analiza la información pública
        relevante sobre café de especialidad en Bolivia. El boletín cubre siete ejes temáticos
        internos que permiten una lectura transversal de la coyuntura cafetera nacional.
      </p>

      <p style="font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700; color: ${COLORS.header}; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px;">
        Periodo de cobertura
      </p>
      <p style="font-size: 10.5px; color: ${COLORS.text}; margin-bottom: 14px;">
        ${escapeHTML(periodoStr)}
      </p>

      <p style="font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700; color: ${COLORS.header}; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px;">
        Fuentes monitoreadas (${data.fuentesMonitoreadasLista.length})
      </p>
      <div class="metodo-lista">
        <ul>${fuentesItems}</ul>
      </div>

      <p style="font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700; color: ${COLORS.header}; margin-bottom: 6px; margin-top: 14px; text-transform: uppercase; letter-spacing: 0.5px;">
        Palabras clave de búsqueda
      </p>
      <p style="font-size: 10.5px; color: ${COLORS.text}; line-height: 1.6; padding: 10px 14px; background: ${COLORS.background}; border-radius: 4px;">
        ${escapeHTML(data.keywordsResumen)}
      </p>

      <p style="font-size: 9px; color: ${COLORS.muted}; margin-top: 14px; font-style: italic; line-height: 1.6;">
        Este documento es de carácter informativo y no representa una posición institucional.
        Las fuentes citadas son de acceso público. Para consultas: decodebolivia.org
      </p>
    </div>
  `;
};

/**
 * Footer con marca de agua
 */
export const generarFooter = (): string => `
  <div class="watermark">DECODEX Bolivia</div>
  <div class="footer">
    <div class="footer-linea1">DECODEX Bolivia &mdash; decodebolivia.org</div>
    <div class="footer-linea2">BOLET&Iacute;N DEL GRANO &mdash; Caf&eacute; de Especialidad Bolivia</div>
  </div>
`;
