/**
 * Plantilla de email HTML para el Reporte Sectorial Minero de DECODEX Bolivia.
 *
 * Diseño profesional basado en tablas (email-safe), sin flexbox, sin float,
 * CSS inline, ancho máximo 600px, sin imágenes externas ni JavaScript.
 */

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface ContenidoReporteMinero {
  resumenEjecutivo: string;
  hitos: Array<{ titulo: string; detalle: string; tipo: string }>;
  coberturaPorEje: Array<{
    eje: string;
    menciones: number;
    tratamientoTop: string;
    medioTop: string;
    tendencia: string;
    variacion: number | null;
  }>;
  actores: Array<{
    nombre: string;
    menciones: number;
    tratamientoTop: string;
  }>;
  factoresExternos: string;
  precios: Array<{
    metal: string;
    simbolo: string;
    precioActual: number;
    precioApertura: number;
    variacionSemanal: number;
    moneda: string;
    fecha: string;
  }>;
  alertas: Array<{ nivel: string; mensaje: string; eje?: string }>;
  tendencia: {
    totalMenciones: number;
    variacionTotal: number;
    resumen: string;
  };
}

// ─── Colores y constantes ────────────────────────────────────────────────────

const COLORS = {
  bg: '#f4f5f7',
  white: '#ffffff',
  darkBlue: '#1a2744',
  medBlue: '#2c3e6b',
  accentBlue: '#3b6cb5',
  lightGray: '#e8eaed',
  medGray: '#6b7280',
  darkGray: '#374151',
  text: '#1f2937',
  green: '#16a34a',
  red: '#dc2626',
  softBg: '#f0f4fa',
  cardBorder: '#d1d5db',
  separator: '#e5e7eb',
} as const;

const MAX_WIDTH = 600;

// ─── Utilidades ──────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return n.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function variacionBadge(variacion: number | null): string {
  if (variacion === null) return '<span style="color:#6b7280">\u2014</span>';
  if (variacion > 0) {
    return `<span style="color:${COLORS.green};font-weight:700">\u25B2 +${fmt(variacion)}%</span>`;
  }
  if (variacion < 0) {
    return `<span style="color:${COLORS.red};font-weight:700">\u25BC ${fmt(variacion)}%</span>`;
  }
  return `<span style="color:#6b7280">\u2014 0,00%</span>`;
}

function hitoTipoColor(tipo: string): string {
  const t = tipo.toLowerCase();
  if (t.includes('regulatorio') || t.includes('norma') || t.includes('ley')) return '#1e40af';
  if (t.includes('operativo') || t.includes('producción') || t.includes('produccion')) return '#b45309';
  if (t.includes('conflicto') || t.includes('social') || t.includes('protesta')) return '#dc2626';
  if (t.includes('negocio') || t.includes('inversión') || t.includes('inversion')) return '#16a34a';
  return '#4b5563';
}

function alertaBadge(nivel: string): string {
  const n = nivel.toLowerCase();
  if (n.includes('alto') || n.includes('crític') || n.includes('critico') || n.includes('peligro')) {
    return `<span style="display:inline-block;background-color:#fef2f2;border:1px solid #fca5a5;border-radius:4px;padding:2px 8px;font-size:12px;color:${COLORS.red}">\uD83D\uDD34 Alto</span>`;
  }
  if (n.includes('medio') || n.includes('moderado') || n.includes('atención') || n.includes('atencion')) {
    return `<span style="display:inline-block;background-color:#fffbeb;border:1px solid #fcd34d;border-radius:4px;padding:2px 8px;font-size:12px;color:#b45309">\uD83D\uDFE1 Medio</span>`;
  }
  return `<span style="display:inline-block;background-color:#f0fdf4;border:1px solid #86efac;border-radius:4px;padding:2px 8px;font-size:12px;color:${COLORS.green}">\uD83D\uDFE2 Positivo</span>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Generador principal ─────────────────────────────────────────────────────

export function generarHtmlReporteMinero(
  contenido: ContenidoReporteMinero,
  periodo: string,
  metadata: { mencionCount: number; medioCount: number },
): string {
  const sections: string[] = [];

  // ── 1. Header ──────────────────────────────────────────────────────────
  sections.push(`
    <tr>
      <td style="background-color:${COLORS.darkBlue};padding:24px 20px;text-align:center;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="text-align:center;">
              <span style="font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:3px;color:#93b4e8;text-transform:uppercase;">DECODEX Bolivia</span>
              <h1 style="margin:6px 0 0;font-family:Georgia,serif;font-size:20px;font-weight:700;color:${COLORS.white};line-height:1.3;">Reporte Sectorial Minero</h1>
              <p style="margin:8px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#a0b4d0;">${escapeHtml(periodo)}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>`);

  // ── 2. Resumen ejecutivo ───────────────────────────────────────────────
  sections.push(`
    <tr>
      <td style="background-color:${COLORS.softBg};padding:20px;">
        <h2 style="margin:0 0 10px;font-family:Georgia,serif;font-size:16px;color:${COLORS.darkBlue};border-bottom:2px solid ${COLORS.accentBlue};padding-bottom:6px;">Resumen Ejecutivo</h2>
        <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${COLORS.text};line-height:1.6;">${escapeHtml(contenido.resumenEjecutivo)}</p>
      </td>
    </tr>`);

  // ── 3. Hitos de la semana ──────────────────────────────────────────────
  if (contenido.hitos.length > 0) {
    const hitoRows = contenido.hitos
      .map(
        (h) => `
          <tr>
            <td style="padding:12px 14px;background-color:${COLORS.white};border:1px solid ${COLORS.cardBorder};border-radius:6px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="vertical-align:top;">
                    <span style="display:inline-block;font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:${hitoTipoColor(h.tipo)};margin-bottom:4px;">${escapeHtml(h.tipo)}</span>
                    <h3 style="margin:0 0 4px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;color:${COLORS.text};">${escapeHtml(h.titulo)}</h3>
                    <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${COLORS.medGray};line-height:1.5;">${escapeHtml(h.detalle)}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`,
      )
      .join('');

    sections.push(`
      <tr>
        <td style="padding:20px;">
          <h2 style="margin:0 0 12px;font-family:Georgia,serif;font-size:16px;color:${COLORS.darkBlue};border-bottom:2px solid ${COLORS.accentBlue};padding-bottom:6px;">Hitos de la Semana</h2>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">
            ${hitoRows}
          </table>
        </td>
      </tr>`);
  }

  // ── 4. Cobertura por eje ───────────────────────────────────────────────
  if (contenido.coberturaPorEje.length > 0) {
    const headerRow = `
      <tr style="background-color:${COLORS.darkBlue};">
        <th style="padding:8px 10px;text-align:left;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;color:${COLORS.white};border-radius:4px 0 0 0;">Eje</th>
        <th style="padding:8px 10px;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;color:${COLORS.white};">Menciones</th>
        <th style="padding:8px 10px;text-align:left;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;color:${COLORS.white};">Tratamiento top</th>
        <th style="padding:8px 10px;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;color:${COLORS.white};">Var.</th>
      </tr>`;

    const dataRows = contenido.coberturaPorEje
      .map(
        (e, i) => `
          <tr style="background-color:${i % 2 === 0 ? COLORS.white : '#f9fafb'};">
            <td style="padding:8px 10px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${COLORS.text};font-weight:600;border-bottom:1px solid ${COLORS.separator};">${escapeHtml(e.eje)}</td>
            <td style="padding:8px 10px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${COLORS.text};text-align:center;border-bottom:1px solid ${COLORS.separator};">${e.menciones}</td>
            <td style="padding:8px 10px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${COLORS.medGray};border-bottom:1px solid ${COLORS.separator};">${escapeHtml(e.tratamientoTop)}</td>
            <td style="padding:8px 10px;text-align:center;border-bottom:1px solid ${COLORS.separator};">${variacionBadge(e.variacion)}</td>
          </tr>`,
      )
      .join('');

    sections.push(`
      <tr>
        <td style="padding:20px;">
          <h2 style="margin:0 0 12px;font-family:Georgia,serif;font-size:16px;color:${COLORS.darkBlue};border-bottom:2px solid ${COLORS.accentBlue};padding-bottom:6px;">Cobertura por Eje</h2>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;border-spacing:0;border:1px solid ${COLORS.lightGray};border-radius:4px;overflow:hidden;">
            ${headerRow}${dataRows}
          </table>
        </td>
      </tr>`);
  }

  // ── 5. Actores m&aacute;s mencionados ───────────────────────────────────
  if (contenido.actores.length > 0) {
    const headerRow = `
      <tr style="background-color:${COLORS.darkBlue};">
        <th style="padding:8px 10px;text-align:left;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;color:${COLORS.white};border-radius:4px 0 0 0;">Actor</th>
        <th style="padding:8px 10px;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;color:${COLORS.white};">Menciones</th>
        <th style="padding:8px 10px;text-align:left;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;color:${COLORS.white};border-radius:0 4px 0 0;">Tratamiento top</th>
      </tr>`;

    const dataRows = contenido.actores
      .map(
        (a, i) => `
          <tr style="background-color:${i % 2 === 0 ? COLORS.white : '#f9fafb'};">
            <td style="padding:8px 10px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${COLORS.text};font-weight:600;border-bottom:1px solid ${COLORS.separator};">${escapeHtml(a.nombre)}</td>
            <td style="padding:8px 10px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${COLORS.text};text-align:center;border-bottom:1px solid ${COLORS.separator};">${a.menciones}</td>
            <td style="padding:8px 10px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${COLORS.medGray};border-bottom:1px solid ${COLORS.separator};">${escapeHtml(a.tratamientoTop)}</td>
          </tr>`,
      )
      .join('');

    sections.push(`
      <tr>
        <td style="padding:20px;">
          <h2 style="margin:0 0 12px;font-family:Georgia,serif;font-size:16px;color:${COLORS.darkBlue};border-bottom:2px solid ${COLORS.accentBlue};padding-bottom:6px;">Actores M&aacute;s Mencionados</h2>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;border-spacing:0;border:1px solid ${COLORS.lightGray};border-radius:4px;overflow:hidden;">
            ${headerRow}${dataRows}
          </table>
        </td>
      </tr>`);
  }

  // ── 6. Factores externos ───────────────────────────────────────────────
  if (contenido.factoresExternos && contenido.factoresExternos.trim().length > 0) {
    sections.push(`
      <tr>
        <td style="padding:20px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#fffbeb;border-left:4px solid #f59e0b;border-radius:0 6px 6px 0;">
            <tr>
              <td style="padding:16px 18px;">
                <h2 style="margin:0 0 8px;font-family:Georgia,serif;font-size:16px;color:#92400e;">Factores Externos</h2>
                <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${COLORS.text};line-height:1.6;">${escapeHtml(contenido.factoresExternos)}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>`);
  }

  // ── 7. Precios internacionales ──────────────────────────────────────────
  if (contenido.precios.length > 0) {
    const headerRow = `
      <tr style="background-color:${COLORS.darkBlue};">
        <th style="padding:8px 10px;text-align:left;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;color:${COLORS.white};border-radius:4px 0 0 0;">Metal</th>
        <th style="padding:8px 10px;text-align:right;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;color:${COLORS.white};">Precio actual</th>
        <th style="padding:8px 10px;text-align:right;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;color:${COLORS.white};">Apertura</th>
        <th style="padding:8px 10px;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;color:${COLORS.white};border-radius:0 4px 0 0;">Var. semanal</th>
      </tr>`;

    const dataRows = contenido.precios
      .map(
        (p, i) => `
          <tr style="background-color:${i % 2 === 0 ? COLORS.white : '#f9fafb'};">
            <td style="padding:8px 10px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${COLORS.text};font-weight:600;border-bottom:1px solid ${COLORS.separator};">${escapeHtml(p.metal)} <span style="color:${COLORS.medGray};font-weight:400;">${escapeHtml(p.simbolo)}</span></td>
            <td style="padding:8px 10px;font-family:'Courier New',monospace;font-size:12px;color:${COLORS.text};text-align:right;border-bottom:1px solid ${COLORS.separator};">${fmt(p.precioActual)} ${escapeHtml(p.moneda)}</td>
            <td style="padding:8px 10px;font-family:'Courier New',monospace;font-size:12px;color:${COLORS.medGray};text-align:right;border-bottom:1px solid ${COLORS.separator};">${fmt(p.precioApertura)} ${escapeHtml(p.moneda)}</td>
            <td style="padding:8px 10px;text-align:center;border-bottom:1px solid ${COLORS.separator};">${variacionBadge(p.variacionSemanal)}</td>
          </tr>`,
      )
      .join('');

    sections.push(`
      <tr>
        <td style="padding:20px;">
          <h2 style="margin:0 0 12px;font-family:Georgia,serif;font-size:16px;color:${COLORS.darkBlue};border-bottom:2px solid ${COLORS.accentBlue};padding-bottom:6px;">Precios Internacionales</h2>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;border-spacing:0;border:1px solid ${COLORS.lightGray};border-radius:4px;overflow:hidden;">
            ${headerRow}${dataRows}
          </table>
        </td>
      </tr>`);
  }

  // ── 8. Alertas sectoriales ─────────────────────────────────────────────
  if (contenido.alertas.length > 0) {
    const alertaRows = contenido.alertas
      .map(
        (a) => `
          <tr>
            <td style="padding:10px 14px;border-bottom:1px solid ${COLORS.separator};vertical-align:middle;">
              ${alertaBadge(a.nivel)}
              <span style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${COLORS.text};margin-left:6px;">${escapeHtml(a.mensaje)}</span>
              ${a.eje ? `<br/><span style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:${COLORS.medGray};">Eje: ${escapeHtml(a.eje)}</span>` : ''}
            </td>
          </tr>`,
      )
      .join('');

    sections.push(`
      <tr>
        <td style="padding:20px;">
          <h2 style="margin:0 0 12px;font-family:Georgia,serif;font-size:16px;color:${COLORS.darkBlue};border-bottom:2px solid ${COLORS.accentBlue};padding-bottom:6px;">Alertas Sectoriales</h2>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${COLORS.lightGray};border-radius:4px;overflow:hidden;">
            ${alertaRows}
          </table>
        </td>
      </tr>`);
  }

  // ── 9. Tendencia vs semana anterior ────────────────────────────────────
  const td = contenido.tendencia;
  sections.push(`
    <tr>
      <td style="padding:20px;">
        <h2 style="margin:0 0 12px;font-family:Georgia,serif;font-size:16px;color:${COLORS.darkBlue};border-bottom:2px solid ${COLORS.accentBlue};padding-bottom:6px;">Tendencia vs. Semana Anterior</h2>
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;border-spacing:0;border:1px solid ${COLORS.lightGray};border-radius:4px;overflow:hidden;">
          <tr style="background-color:${COLORS.darkBlue};">
            <th style="padding:8px 12px;text-align:left;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;color:${COLORS.white};">Indicador</th>
            <th style="padding:8px 12px;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;color:${COLORS.white};">Valor</th>
          </tr>
          <tr style="background-color:${COLORS.white};">
            <td style="padding:8px 12px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${COLORS.text};font-weight:600;border-bottom:1px solid ${COLORS.separator};">Total menciones</td>
            <td style="padding:8px 12px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${COLORS.text};text-align:center;border-bottom:1px solid ${COLORS.separator};">${td.totalMenciones}</td>
          </tr>
          <tr style="background-color:#f9fafb;">
            <td style="padding:8px 12px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${COLORS.text};font-weight:600;border-bottom:1px solid ${COLORS.separator};">Variaci&oacute;n total</td>
            <td style="padding:8px 12px;text-align:center;border-bottom:1px solid ${COLORS.separator};">${variacionBadge(td.variacionTotal)}</td>
          </tr>
        </table>
        <p style="margin:10px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${COLORS.text};line-height:1.6;">${escapeHtml(td.resumen)}</p>
      </td>
    </tr>`);

  // ── Footer ──────────────────────────────────────────────────────────────
  sections.push(`
    <tr>
      <td style="background-color:${COLORS.darkBlue};padding:18px 20px;text-align:center;">
        <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#93b4e8;">Generado por <strong style="color:${COLORS.white};">DECODEX Bolivia</strong> | Datos de ${metadata.medioCount} medios | ${metadata.mencionCount} menciones analizadas</p>
      </td>
    </tr>`);

  // ── Ensamblaje final ───────────────────────────────────────────────────
  const innerContent = sections.join('\n');

  return `<!DOCTYPE html>
<html lang="es" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>DECODEX Bolivia | Reporte Sectorial Minero</title>
</head>
<body style="margin:0;padding:0;background-color:${COLORS.bg};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${COLORS.bg};">
    <tr>
      <td align="center" style="padding:20px 10px;">
        <table role="presentation" width="${MAX_WIDTH}" cellpadding="0" cellspacing="0" border="0" style="max-width:${MAX_WIDTH}px;width:100%;background-color:${COLORS.white};border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
${innerContent}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
