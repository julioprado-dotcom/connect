/**
 * Plantilla de Telegram (Markdown) para el Reporte Sectorial Minero de DECODEX Bolivia.
 *
 * Formato Markdown simple compatible con Telegram (*bold*, _italic_).
 * Si el mensaje excede ~4000 caracteres, se divide en 3 partes:
 *   Msg1 — Resumen Ejecutivo + Hitos de la Semana
 *   Msg2 — Cobertura por Eje + Actores Más Mencionados
 *   Msg3 — Precios Internacionales + Alertas Sectoriales + Tendencia
 */

// ─── Tipos (redefinidos localmente para independencia del módulo) ─────────────

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

// ─── Constantes ──────────────────────────────────────────────────────────────

const MAX_CHARS = 4000;
const SEPARATOR = '─────────────────────────';

// ─── Utilidades ──────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return n.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function varArrow(v: number | null): string {
  if (v === null) return '—';
  if (v > 0) return `+${fmt(v)}%`;
  return `${fmt(v)}%`;
}

function alertaIcon(nivel: string): string {
  const n = nivel.toLowerCase();
  if (n.includes('alto') || n.includes('crític') || n.includes('critico') || n.includes('peligro')) return '🔴';
  if (n.includes('medio') || n.includes('moderado') || n.includes('atención') || n.includes('atencion')) return '🟡';
  return '🟢';
}

function alertaLabel(nivel: string): string {
  const n = nivel.toLowerCase();
  if (n.includes('alto') || n.includes('crític') || n.includes('critico') || n.includes('peligro')) return 'ALTO';
  if (n.includes('medio') || n.includes('moderado') || n.includes('atención') || n.includes('atencion')) return 'MEDIO';
  return 'POSITIVO';
}

function varEmoji(v: number): string {
  if (v > 0) return '📈';
  if (v < 0) return '📉';
  return '➡️';
}

// ─── Secciones ───────────────────────────────────────────────────────────────

function buildHeader(periodo: string): string {
  return `*DECODEX Bolivia* | Reporte Sectorial Minero\n_\"${periodo}\"_\n`;
}

function buildResumen(contenido: ContenidoReporteMinero): string {
  const parts: string[] = [];
  parts.push(`📋 *RESUMEN EJECUTIVO*\n`);
  parts.push(contenido.resumenEjecutivo.trim());
  return parts.join('\n');
}

function buildHitos(contenido: ContenidoReporteMinero): string {
  if (contenido.hitos.length === 0) return '';
  const parts: string[] = [];
  parts.push(`\n📌 *HITOS DE LA SEMANA*\n`);
  contenido.hitos.forEach((h, i) => {
    parts.push(`${i + 1}. *${h.titulo}*\n   _${h.tipo}_ — ${h.detalle.trim()}`);
  });
  return parts.join('\n');
}

function buildFactores(contenido: ContenidoReporteMinero): string {
  if (!contenido.factoresExternos || contenido.factoresExternos.trim().length === 0) return '';
  return `\n🌐 *FACTORES EXTERNOS*\n${contenido.factoresExternos.trim()}`;
}

function buildCobertura(contenido: ContenidoReporteMinero): string {
  if (contenido.coberturaPorEje.length === 0) return '';
  const parts: string[] = [];
  parts.push(`📊 *COBERTURA POR EJE*\n`);
  contenido.coberturaPorEje.forEach((e) => {
    const vStr = e.variacion !== null ? ` (${varEmoji(e.variacion)} ${varArrow(e.variacion)})` : '';
    parts.push(`  • *${e.eje}*: ${e.menciones} menciones${vStr}\n    Tratamiento: ${e.tratamientoTop} | Medio: ${e.medioTop}`);
  });
  return parts.join('\n');
}

function buildActores(contenido: ContenidoReporteMinero): string {
  if (contenido.actores.length === 0) return '';
  const parts: string[] = [];
  parts.push(`\n👥 *ACTORES MÁS MENCIONADOS*\n`);
  contenido.actores.forEach((a) => {
    parts.push(`  ${a.menciones}. *${a.nombre}* — ${a.tratamientoTop}`);
  });
  return parts.join('\n');
}

function buildPrecios(contenido: ContenidoReporteMinero): string {
  if (contenido.precios.length === 0) return '';
  const parts: string[] = [];
  parts.push(`\n💰 *PRECIOS INTERNACIONALES*\n`);
  contenido.precios.forEach((p) => {
    const arrow = p.variacionSemanal > 0 ? '🟢' : p.variacionSemanal < 0 ? '🔴' : '⚪';
    parts.push(
      `  ${arrow} *${p.metal}* \`${p.simbolo}\`\n` +
      `     Actual: ${fmt(p.precioActual)} ${p.moneda}\n` +
      `     Apert.: ${fmt(p.precioApertura)} ${p.moneda}\n` +
      `     Var.:   ${varArrow(p.variacionSemanal)}`,
    );
  });
  return parts.join('\n');
}

function buildAlertas(contenido: ContenidoReporteMinero): string {
  if (contenido.alertas.length === 0) return '';
  const parts: string[] = [];
  parts.push(`\n🚨 *ALERTAS SECTORIALES*\n`);
  contenido.alertas.forEach((a) => {
    const icon = alertaIcon(a.nivel);
    const label = alertaLabel(a.nivel);
    const ejeStr = a.eje ? ` [${a.eje}]` : '';
    parts.push(`  ${icon} *${label}*: ${a.mensaje}${ejeStr}`);
  });
  return parts.join('\n');
}

function buildTendencia(contenido: ContenidoReporteMinero): string {
  const td = contenido.tendencia;
  const parts: string[] = [];
  parts.push(`\n📈 *TENDENCIA VS. SEMANA ANTERIOR*\n`);
  parts.push(`  Total menciones: *${td.totalMenciones}*`);
  parts.push(`  Variación: ${varEmoji(td.variacionTotal)} ${varArrow(td.variacionTotal)}`);
  parts.push(`\n  ${td.resumen.trim()}`);
  return parts.join('\n');
}

// ─── Generador principal ─────────────────────────────────────────────────────

export function generarTelegramReporteMinero(
  contenido: ContenidoReporteMinero,
  periodo: string,
): string[] {
  const header = buildHeader(periodo);
  const resumen = buildResumen(contenido);
  const hitos = buildHitos(contenido);
  const factores = buildFactores(contenido);
  const cobertura = buildCobertura(contenido);
  const actores = buildActores(contenido);
  const precios = buildPrecios(contenido);
  const alertas = buildAlertas(contenido);
  const tendencia = buildTendencia(contenido);

  // Intentar unificar en un solo mensaje
  const fullMessage = [
    header,
    resumen,
    hitos,
    factores,
    SEPARATOR,
    cobertura,
    actores,
    SEPARATOR,
    precios,
    alertas,
    tendencia,
  ].join('\n');

  if (fullMessage.length <= MAX_CHARS) {
    return [fullMessage];
  }

  // Dividir en 3 mensajes
  const msg1Parts: string[] = [header, resumen, hitos, factores];
  const msg2Parts: string[] = [SEPARATOR, cobertura, actores];
  const msg3Parts: string[] = [SEPARATOR, precios, alertas, tendencia];

  const msg1 = msg1Parts.join('\n');
  const msg2 = msg2Parts.join('\n');
  const msg3 = msg3Parts.join('\n');

  // Combinar msg2 con msg3 si msg2 es muy corto y hay espacio
  const messages: string[] = [];
  if (msg1.length <= MAX_CHARS) {
    messages.push(msg1);
  } else {
    // msg1 demasiado largo: recortar hitos
    messages.push(msg1.substring(0, MAX_CHARS - 20) + '\n\\[continúa...]');
  }

  // msg2 + msg3 juntos si caben
  const msg2y3 = msg2 + '\n' + msg3;
  if (msg2y3.length <= MAX_CHARS) {
    messages.push(msg2y3);
  } else {
    if (msg2.length <= MAX_CHARS) {
      messages.push(msg2);
    } else {
      messages.push(msg2.substring(0, MAX_CHARS - 20) + '\n\\[continúa...]');
    }
    if (msg3.length <= MAX_CHARS) {
      messages.push(msg3);
    } else {
      messages.push(msg3.substring(0, MAX_CHARS - 20) + '\n\\[continúa...]');
    }
  }

  return messages;
}
