/**
 * @module boletin-del-grano.styles
 * @description Paleta de colores temática café y generador de estilos CSS inline
 * para el BOLETÍN DEL GRANO. Extraído de boletin-del-grano.ts para mantener
 * la modularidad del servicio.
 */

// ─── Paleta de Colores (temática café) ────────────────────────────────

export const COLORS = {
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

// ─── Estilos CSS Inline ───────────────────────────────────────────────

export const generarEstilos = (): string => `
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
