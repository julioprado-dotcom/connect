/**
 * DECODEX Bolivia — Brand Constants
 * Definiciones oficiales de marca según Equipo de Marca.
 * Fuente: Mensaje de Producción Ejecuta — Equipo de Marca (May 2026)
 */

// ─── Paleta de Colores ─────────────────────────────────────────────

export const BRAND_COLORS = {
  navy:      '#0F2027',
  blue:      '#1284BA',
  orange:    '#FF862F',
  teal:      '#203A43',
  light:     '#F4F8FC',
  white:     '#FFFFFF',
  dark:      '#1A1A1A',
} as const

/** CSS variables para uso en estilos inline y Tailwind config */
export const BRAND_CSS_VARIABLES = {
  '--decodex-navy':  BRAND_COLORS.navy,
  '--decodex-blue':  BRAND_COLORS.blue,
  '--decodex-orange': BRAND_COLORS.orange,
  '--decodex-teal':  BRAND_COLORS.teal,
  '--decodex-light': BRAND_COLORS.light,
  '--decodex-white': BRAND_COLORS.white,
  '--decodex-dark':  BRAND_COLORS.dark,
} as const

/** Colores de sentimiento para badges y emojis */
export const SENTIMENT_COLORS = {
  positive: '#1284BA',
  neutral:  '#203A43',
  negative: '#FF862F',
} as const

export const SENTIMENT_EMOJI = {
  positive: '🟢',
  neutral:  '🟡',
  negative: '🔴',
} as const

export type SentimentType = 'positive' | 'neutral' | 'negative'

// ─── Tipografías ───────────────────────────────────────────────────

export const BRAND_FONTS = {
  heading: 'Montserrat',
  body:    'Roboto',
  fallback: "'Arial', 'Calibri', sans-serif",
} as const

// ─── Logo SVG ──────────────────────────────────────────────────────

export const BRAND_LOGO_SVG_COLOR = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 60">
  <defs>
    <linearGradient id="decodex-grad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#1284BA"/>
      <stop offset="100%" stop-color="#0F2027"/>
    </linearGradient>
  </defs>
  <text x="0" y="40" font-family="Montserrat, sans-serif" font-weight="700" font-size="32" fill="url(#decodex-grad)">DECODEX</text>
  <text x="0" y="55" font-family="Roboto, sans-serif" font-weight="300" font-size="10" fill="#FF862F">Inteligencia de Medios</text>
</svg>`

export const BRAND_LOGO_SVG_WHITE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 60">
  <text x="0" y="40" font-family="Montserrat, sans-serif" font-weight="700" font-size="32" fill="#FFFFFF">DECODEX</text>
  <text x="0" y="55" font-family="Roboto, sans-serif" font-weight="300" font-size="10" fill="#FFFFFF">Inteligencia de Medios</text>
</svg>`

// ─── WhatsApp — Reglas de Entrega ─────────────────────────────────

export const WHATSAPP_RULES = {
  maxLength: 1600,
  structure: [
    '📊 *DECODEX – Boletín del [DD/MM]*',
    '*Cliente:* [Nombre]',
    '*Resumen:* [una línea con sentimiento global]',
    '🔹 *Top noticias:*',
    '1. [Título] – [Fuente] 🟢/🔴/🟡',
    '📎 *PDF completo:* [enlace acortado]',
  ],
  allowedEmojis: ['✅', '❌', '⚠️', '📈', '📉', '🟢', '🔴', '🟡', '📊', '🔹', '📎', '💬', '🕒', '🏷️'],
  prohibited: ['HTML', 'markdown complejo', 'links largos sin acortar'],
} as const

// ─── Email — Reglas de Entrega ────────────────────────────────────

export const EMAIL_RULES = {
  maxWidth: 600,
  bgColor: '#F4F8FC',
  tableHeaderBg: '#1284BA',
  tableHeaderText: '#FFFFFF',
  tableAltRow: '#F4F8FC',
  tableRow: '#FFFFFF',
  footerLineColor: '#1284BA',
} as const

// ─── PDF — Reglas de Entrega ──────────────────────────────────────

export const PDF_RULES = {
  size: 'A4',
  margins: {
    top: 20,
    bottom: 15,
    left: 15,
    right: 15,
  },
  author: 'DECODEX Bolivia',
  patternOpacity: 0.03,
} as const

// ─── Tono y Estilo para IA ────────────────────────────────────────

export const BRAND_TONE = {
  formalidad: 'media',
  tratamiento: 'usted',
  palabrasProhibidas: ['quizás', 'tal vez', 'creemos', 'podría interpretarse'],
  palabrasPermitidas: ['el análisis indica', 'los datos muestran', 'se observa'],
  estructuraFija: [
    'Título: [Producto] – [Fecha] – [Cliente]',
    'Resumen ejecutivo (2-3 líneas)',
    'Cuerpo detallado (listas o párrafos)',
    'Conclusión (1 línea)',
    'Cierre: "DECODEX – Inteligencia de Medios"',
  ],
} as const

// ─── Variables Dinámicas para Templates ───────────────────────────

export const TEMPLATE_VARIABLES = {
  fecha: '{fecha}',
  clienteNombre: '{cliente_nombre}',
  sentimientoGeneral: '{sentimiento_general}',
  totalMenciones: '{total_menciones}',
  topTresNoticias: '{top_tres_noticias}',
  nombreLegislador: '{nombre_legislador}',
  ejeTematico: '{eje}',
  enlacePdf: '{enlace_pdf}',
  semana: '{semana}',
} as const

// ─── Checklist de Validación Visual ───────────────────────────────

export const BRAND_CHECKLIST = [
  'Logo visible y opacidad correcta en todos los formatos',
  'Colores = paleta DECODEX (Navy, Blue, Orange, Teal)',
  'Tipografía: Montserrat títulos, Roboto cuerpo (sin fallbacks)',
  'Badges de sentimiento: positivo #1284BA, neutral #203A43, negativo #FF862F',
  'WhatsApp: sin HTML visible, solo emojis permitidos',
  'Email: responsive (no se rompe en móvil <600px)',
  'PDF: marca de agua nodos visible pero sutil (opacidad 3-5%)',
  'Fecha y nombre del cliente sin placeholders {}',
  'Tono de voz sin palabras prohibidas (quizás, tal vez...)',
  'Enlaces de contacto (WhatsApp, web) clicables y funcionales',
] as const
