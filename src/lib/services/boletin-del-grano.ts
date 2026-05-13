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

// ─── Paleta de Colores (temática café) ────────────────────────────────

const COLORS = {
  header: '#3e2723',
  accent: '#6d4c41',
  accent2: '#4e342e',
  border: '#bcaaa4',
  text: '#1b1a17',
  muted: '#8d7b74',
  background: '#faf6f1',
  surface: '#f0ebe3',
  highlight: '#fff8e1',
  tensionAlta: '#c62828',
  tensionMedia: '#ef6c00',
  tensionBaja: '#2e7d32',
} as const;

// ─── Constantes Internas ──────────────────────────────────────────────

const isPuppeteerAvailable = (): boolean => {
  try {
    require('puppeteer');
    return true;
  } catch {
    return false;
  }
};

/** Escapa HTML para prevenir inyección XSS */
const escapeHTML = (texto: string): string => {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

/** Retorna el color correspondiente al nivel de tensión */
const colorTension = (tension: 'ALTA' | 'MEDIA' | 'BAJA'): string => {
  switch (tension) {
    case 'ALTA':  return COLORS.tensionAlta;
    case 'MEDIA': return COLORS.tensionMedia;
    case 'BAJA':  return COLORS.tensionBaja;
  }
};

/** Retorna el color de fondo del badge de tensión */
const colorTensionBg = (tension: 'ALTA' | 'MEDIA' | 'BAJA'): string => {
  switch (tension) {
    case 'ALTA':  return `${COLORS.tensionAlta}18`;
    case 'MEDIA': return `${COLORS.tensionMedia}18`;
    case 'BAJA':  return `${COLORS.tensionBaja}18`;
  }
};

/** Color de la flecha de tendencia */
const colorTendencia = (tendencia: '↑' | '→' | '↓'): string => {
  switch (tendencia) {
    case '↑': return '#2e7d32';
    case '↓': return '#c62828';
    case '→': return '#6d4c41';
  }
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

// ─── Estilos CSS Inline ───────────────────────────────────────────────

const generarEstilos = (): string => `
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800&display=swap');

    @page {
      size: A4;
      margin: 20mm 15mm;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Georgia', 'Times New Roman', serif;
      font-size: 11px;
      line-height: 1.6;
      color: ${COLORS.text};
      background: ${COLORS.background};
    }

    .page-break { page-break-before: always; }

    /* ── Títulos ── */
    h1, h2, h3, h4, h5, h6 {
      font-family: 'Montserrat', sans-serif;
    }

    /* ── Portada ── */
    .portada {
      text-align: center;
      padding: 100px 50px 80px;
      background: linear-gradient(160deg, ${COLORS.header} 0%, ${COLORS.accent2} 50%, ${COLORS.accent} 100%);
      color: #ffffff;
      border-radius: 10px;
      margin-bottom: 0;
      min-height: 650px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      position: relative;
      overflow: hidden;
    }

    .portada::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      background:
        radial-gradient(circle at 20% 80%, rgba(255,255,255,0.04) 0%, transparent 50%),
        radial-gradient(circle at 80% 20%, rgba(255,255,255,0.06) 0%, transparent 50%);
      pointer-events: none;
    }

    .portada-icono {
      font-size: 48px;
      margin-bottom: 24px;
      opacity: 0.9;
    }

    .portada h1 {
      font-size: 36px;
      font-weight: 800;
      letter-spacing: 3px;
      margin-bottom: 8px;
      text-transform: uppercase;
    }

    .portada .subtitulo {
      font-family: 'Georgia', serif;
      font-size: 15px;
      font-style: italic;
      opacity: 0.85;
      margin-bottom: 32px;
      letter-spacing: 0.5px;
    }

    .portada .periodo {
      font-family: 'Montserrat', sans-serif;
      font-size: 13px;
      font-weight: 600;
      opacity: 0.9;
      margin-bottom: 6px;
      letter-spacing: 0.3px;
    }

    .portada .semana-info {
      font-family: 'Montserrat', sans-serif;
      font-size: 11px;
      opacity: 0.7;
      margin-bottom: 24px;
    }

    .portada .marca {
      position: absolute;
      bottom: 20px;
      font-family: 'Montserrat', sans-serif;
      font-size: 9px;
      opacity: 0.5;
      letter-spacing: 1px;
    }

    /* ── Badge de tensión ── */
    .tension-badge {
      display: inline-block;
      padding: 6px 20px;
      border-radius: 20px;
      font-family: 'Montserrat', sans-serif;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 1px;
      text-transform: uppercase;
      border: 2px solid;
    }

    /* ── Secciones ── */
    .seccion {
      background: ${COLORS.surface};
      border: 1px solid ${COLORS.border};
      border-radius: 6px;
      padding: 20px 22px;
      margin-bottom: 16px;
      page-break-inside: avoid;
    }

    .seccion-titulo {
      font-family: 'Montserrat', sans-serif;
      font-size: 14px;
      font-weight: 700;
      color: ${COLORS.header};
      border-bottom: 2px solid ${COLORS.accent};
      padding-bottom: 8px;
      margin-bottom: 16px;
      text-transform: uppercase;
      letter-spacing: 0.8px;
    }

    .seccion-titulo .num {
      display: inline-block;
      background: ${COLORS.header};
      color: #ffffff;
      width: 22px;
      height: 22px;
      line-height: 22px;
      text-align: center;
      border-radius: 50%;
      font-size: 11px;
      margin-right: 8px;
      vertical-align: middle;
    }

    /* ── Resumen ── */
    .resumen-texto {
      font-size: 11.5px;
      line-height: 1.8;
      color: ${COLORS.text};
      padding: 14px 18px;
      background: ${COLORS.background};
      border-radius: 4px;
      border-left: 4px solid ${COLORS.accent};
    }

    .resumen-texto p {
      margin-bottom: 12px;
    }

    .resumen-texto p:last-child {
      margin-bottom: 0;
    }

    /* ── Stats Grid ── */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin-bottom: 16px;
    }

    .stat-card {
      background: ${COLORS.background};
      border-radius: 6px;
      padding: 14px 10px;
      text-align: center;
      border: 1px solid ${COLORS.border};
    }

    .stat-valor {
      font-family: 'Montserrat', sans-serif;
      font-size: 24px;
      font-weight: 700;
      color: ${COLORS.header};
    }

    .stat-etiqueta {
      font-family: 'Montserrat', sans-serif;
      font-size: 9px;
      color: ${COLORS.muted};
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-top: 4px;
    }

    /* ── Tablas ── */
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10px;
    }

    thead th {
      background: ${COLORS.header};
      color: #ffffff;
      padding: 8px 10px;
      text-align: left;
      font-family: 'Montserrat', sans-serif;
      font-weight: 600;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }

    tbody td {
      padding: 8px 10px;
      border-bottom: 1px solid ${COLORS.border};
      vertical-align: middle;
    }

    tbody tr:nth-child(even) {
      background: ${COLORS.background};
    }

    tbody tr:nth-child(odd) {
      background: ${COLORS.surface};
    }

    /* ── Barra de cobertura ── */
    .barra-track {
      width: 100%;
      height: 14px;
      background: ${COLORS.border};
      border-radius: 7px;
      overflow: hidden;
    }

    .barra-fill {
      height: 100%;
      border-radius: 7px;
      background: ${COLORS.accent};
    }

    /* ── Noticia destacada ── */
    .noticia-card {
      background: ${COLORS.background};
      border: 1px solid ${COLORS.border};
      border-radius: 6px;
      padding: 14px 16px;
      margin-bottom: 12px;
      border-left: 4px solid ${COLORS.accent};
    }

    .noticia-titulo {
      font-family: 'Montserrat', sans-serif;
      font-size: 12px;
      font-weight: 700;
      color: ${COLORS.text};
      margin-bottom: 6px;
      line-height: 1.4;
    }

    .noticia-meta {
      font-size: 9px;
      color: ${COLORS.muted};
      margin-bottom: 8px;
      font-family: 'Montserrat', sans-serif;
    }

    .noticia-resumen {
      font-size: 10.5px;
      line-height: 1.6;
      color: ${COLORS.text};
      margin-bottom: 8px;
    }

    .noticia-ejes {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }

    .eje-tag {
      display: inline-block;
      padding: 2px 8px;
      background: ${COLORS.accent}18;
      color: ${COLORS.accent2};
      border-radius: 10px;
      font-family: 'Montserrat', sans-serif;
      font-size: 8px;
      font-weight: 600;
      border: 1px solid ${COLORS.accent}30;
    }

    /* ── Fuentes ranking badge ── */
    .fuente-nueva-badge {
      display: inline-block;
      padding: 1px 6px;
      background: ${COLORS.accent};
      color: #ffffff;
      border-radius: 8px;
      font-family: 'Montserrat', sans-serif;
      font-size: 7px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      margin-left: 6px;
    }

    /* ── Nota metodológica ── */
    .metodo-lista {
      padding: 12px 18px;
      background: ${COLORS.background};
      border-radius: 4px;
      border-left: 4px solid ${COLORS.border};
    }

    .metodo-lista ul {
      padding-left: 18px;
      margin: 0;
    }

    .metodo-lista li {
      font-size: 10px;
      line-height: 1.7;
      color: ${COLORS.text};
      margin-bottom: 2px;
    }

    /* ── Pie de página ── */
    .footer {
      text-align: center;
      padding: 16px;
      margin-top: 24px;
      font-family: 'Montserrat', sans-serif;
      font-size: 8px;
      color: ${COLORS.muted};
      border-top: 1px solid ${COLORS.border};
      letter-spacing: 0.5px;
    }

    .footer .footer-linea1 {
      font-weight: 700;
      color: ${COLORS.accent2};
      margin-bottom: 2px;
    }

    .footer .footer-linea2 {
      font-weight: 400;
      opacity: 0.7;
    }

    /* ── Marca de agua ── */
    .watermark {
      position: fixed;
      bottom: 10px;
      right: 10px;
      font-family: 'Montserrat', sans-serif;
      font-size: 7px;
      color: ${COLORS.muted};
      opacity: 0.25;
      transform: rotate(-15deg);
      pointer-events: none;
      letter-spacing: 0.5px;
    }

    /* ── Empty state ── */
    .empty-state {
      text-align: center;
      padding: 24px;
      color: ${COLORS.muted};
      font-style: italic;
    }

    /* ── Análisis narrativo ── */
    .analisis-texto {
      font-size: 11px;
      line-height: 1.8;
      color: ${COLORS.text};
      padding: 14px 18px;
      background: ${COLORS.highlight};
      border-radius: 4px;
      border-left: 4px solid ${COLORS.accent};
    }

    .analisis-texto p {
      margin-bottom: 10px;
    }

    .analisis-texto p:last-child {
      margin-bottom: 0;
    }
  </style>
`;

// ─── Generadores de Secciones HTML ────────────────────────────────────

/**
 * Sección 1 — PORTADA
 */
const generarPortada = (data: BoletinGranoData): string => {
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
const generarResumenEjecutivo = (data: BoletinGranoData): string => {
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
const generarEstadisticasClave = (data: BoletinGranoData): string => {
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
const generarMapaTensiones = (data: BoletinGranoData): string => {
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
const generarNoticiasDestacadas = (data: BoletinGranoData): string => {
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
const generarIndiceFuentes = (data: BoletinGranoData): string => {
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
const generarCruceTransversal = (data: BoletinGranoData): string => {
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
const generarTendenciaProyeccion = (data: BoletinGranoData): string => {
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
const generarNotaMetodologica = (data: BoletinGranoData): string => {
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
const generarFooter = (): string => `
  <div class="watermark">DECODEX Bolivia</div>
  <div class="footer">
    <div class="footer-linea1">DECODEX Bolivia &mdash; decodebolivia.org</div>
    <div class="footer-linea2">BOLET&Iacute;N DEL GRANO &mdash; Caf&eacute; de Especialidad Bolivia</div>
  </div>
`;

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
  if (!isPuppeteerAvailable()) {
    // Modo mock: retorna buffer vacío
    return Buffer.alloc(0);
  }

  // Modo producción con Puppeteer (si está disponible)
  let puppeteer: any;
  try {
    puppeteer = require('puppeteer');
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
