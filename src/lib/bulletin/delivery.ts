/**
 * Delivery — ONION200 / DECODEX Bolivia
 * Funciones de formateo y entrega de boletines por canal.
 *
 * v2 — Actualizado con specs del Equipo de Marca (May 2026):
 *   - WhatsApp: límite 1600 chars, emojis oficiales DECODEX
 *   - Email: HTML con tabla 600px, paleta de marca
 *   - PDF: specs A4 con márgenes DECODEX
 *   - Badges de sentimiento: azul/teal/naranja
 */

import { ETIQUETAS_ENTREGA } from '@/constants/products'
import { type TipoBoletin } from '@/types/bulletin'
import {
  BRAND_COLORS,
  EMAIL_RULES,
  WHATSAPP_RULES,
  SENTIMENT_COLORS,
  BRAND_LOGO_SVG_WHITE,
} from '@/constants/brand'

// ─── Helpers de Sentimiento ───────────────────────────────────────

export type SentimentType = 'positive' | 'neutral' | 'negative'

export function getSentimentBadge(type: SentimentType, label: string): string {
  const color = SENTIMENT_COLORS[type]
  return `<span style="display:inline-block;padding:2px 8px;border-radius:12px;font-size:10px;color:white;background:${color};">${label}</span>`
}

export function getSentimentEmoji(type: SentimentType): string {
  switch (type) {
    case 'positive': return '🟢'
    case 'negative': return '🔴'
    case 'neutral':  return '🟡'
  }
}

// ─── Formatear etiqueta de WhatsApp ───────────────────────────────

export function formatWhatsAppLabel(
  tipo: TipoBoletin,
  vars?: Record<string, string>
): string {
  const template = ETIQUETAS_ENTREGA[tipo]?.whatsapp ?? '📰 DECODEX — {fecha}'
  let result = template

  if (vars) {
    for (const [key, value] of Object.entries(vars)) {
      result = result.replace(`{${key}}`, value)
    }
  }

  return result
}

// ─── Formatear asunto de Email ────────────────────────────────────

export function formatEmailSubject(
  tipo: TipoBoletin,
  vars?: Record<string, string>
): string {
  const template = ETIQUETAS_ENTREGA[tipo]?.email ?? 'DECODEX — {fecha}'
  let result = template

  if (vars) {
    for (const [key, value] of Object.entries(vars)) {
      result = result.replace(`{${key}}`, value)
    }
  }

  return result
}

// ─── Truncar para WhatsApp (límite 1600 chars — spec Equipo Marca) ─

export function truncateForWhatsApp(content: string, maxLength: number = WHATSAPP_RULES.maxLength): string {
  if (content.length <= maxLength) return content
  return content.slice(0, maxLength - 60) + '\n\n📎 *Continúa en el informe completo:* [enlace]'
}

// ─── Formatear contenido para WhatsApp ────────────────────────────

export function formatForWhatsApp(content: string): string {
  return content
    .replace(/#{1,3}\s/g, '*')          // headers → bold
    .replace(/\*\*(.*?)\*\*/g, '*$1*')  // markdown bold → WhatsApp bold
    .replace(/__(.*?)__/g, '_$1_')      // markdown italic → WhatsApp italic
    .replace(/~~(.*?)~~/g, '~$1~')      // markdown strikethrough
    .replace(/`{3}[\s\S]*?`{3}/g, '')   // remove code blocks
    .replace(/`([^`]+)`/g, '_$1_')      // inline code → italic
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links → plain text
    .trim()
}

// ─── Formatear contenido para Email (HTML con paleta DECODEX) ─────

export function formatForEmail(content: string): string {
  const styledContent = content
    .replace(/#{1}\s(.+)/g, `<h1 style="font-family:Montserrat,sans-serif;color:${BRAND_COLORS.navy};margin:0 0 8px 0;">$1</h1>`)
    .replace(/#{2}\s(.+)/g, `<h2 style="font-family:Montserrat,sans-serif;color:${BRAND_COLORS.blue};margin:0 0 6px 0;">$1</h2>`)
    .replace(/#{3}\s(.+)/g, `<h3 style="font-family:Montserrat,sans-serif;color:${BRAND_COLORS.teal};margin:0 0 4px 0;">$1</h3>`)
    .replace(/\*\*(.*?)\*\*/g, '<strong style="color:#1A1A1A;">$1</strong>')
    .replace(/\*(.*?)\*/g, '<strong style="color:#1A1A1A;">$1</strong>')
    .replace(/__(.*?)__/g, '<em>$1</em>')
    .replace(/_(.*?)_/g, '<em>$1</em>')
    .replace(/- (.+)/g, `<li style="margin-bottom:4px;color:#1A1A1A;">$1</li>`)
    .replace(/\n\n/g, '</p><p style="margin:8px 0;color:#1A1A1A;line-height:1.6;">')
    .replace(/\n/g, '<br>')

  return wrapEmailTemplate(styledContent)
}

// ─── Envolvente HTML para Email (spec Equipo Marca) ──────────────

export function wrapEmailTemplate(bodyContent: string, vars?: {
  fecha?: string
  clienteNombre?: string
}): string {
  const fecha = vars?.fecha ?? new Date().toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/La_Paz' })
  const cliente = vars?.clienteNombre ?? ''

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  body { margin:0; padding:0; background-color:${EMAIL_RULES.bgColor}; font-family:Roboto,Arial,sans-serif; }
  .container { max-width:${EMAIL_RULES.maxWidth}px; margin:0 auto; background:#FFFFFF; }
  .header { background-color:${BRAND_COLORS.navy}; padding:20px; text-align:center; }
  .header h1 { color:#FFFFFF; font-family:Montserrat,sans-serif; font-size:20px; margin:0; }
  .header .meta { color:rgba(255,255,255,0.7); font-size:12px; margin-top:4px; }
  .body-content { padding:24px; }
  .footer { padding:16px 24px; border-top:1px solid ${EMAIL_RULES.footerLineColor}; text-align:center; }
  .footer p { color:#666; font-size:11px; margin:0; }
  .footer a { color:${BRAND_COLORS.blue}; text-decoration:none; }
  table.data-table { width:100%; border-collapse:collapse; margin:12px 0; }
  table.data-table th { background:${EMAIL_RULES.tableHeaderBg}; color:${EMAIL_RULES.tableHeaderText}; padding:8px 12px; text-align:left; font-size:12px; font-family:Montserrat,sans-serif; }
  table.data-table td { padding:6px 12px; font-size:13px; border-bottom:1px solid #E8EDF2; }
  table.data-table tr:nth-child(even) td { background:${EMAIL_RULES.tableAltRow}; }
</style>
</head>
<body>
<table class="container" width="100%" cellpadding="0" cellspacing="0">
  <tr>
    <td class="header">
      ${BRAND_LOGO_SVG_WHITE}
      <div class="meta">${fecha}${cliente ? ' — ' + cliente : ''}</div>
    </td>
  </tr>
  <tr>
    <td class="body-content">
      ${bodyContent}
    </td>
  </tr>
  <tr>
    <td class="footer">
      <p>DECODEX — Inteligencia de Medios Bolivia</p>
      <p>Este mensaje fue generado automáticamente.</p>
    </td>
  </tr>
</table>
</body>
</html>`
}

// ─── Construir payload de entrega ─────────────────────────────────

export interface DeliveryPayload {
  tipo: TipoBoletin
  canal: 'whatsapp' | 'email' | 'web' | 'pdf'
  destinatarios: string[]
  asunto: string
  contenido: string
  contenidoFormateado: string
  metadata?: Record<string, unknown>
}

export function buildDeliveryPayload(
  tipo: TipoBoletin,
  canal: 'whatsapp' | 'email',
  destinatarios: string[],
  contenido: string,
  vars?: Record<string, string>
): DeliveryPayload {
  const asunto = canal === 'whatsapp'
    ? formatWhatsAppLabel(tipo, vars)
    : formatEmailSubject(tipo, vars)

  const contenidoFormateado = canal === 'whatsapp'
    ? formatForWhatsApp(contenido)
    : formatForEmail(contenido)

  return {
    tipo,
    canal,
    destinatarios,
    asunto,
    contenido,
    contenidoFormateado: canal === 'whatsapp'
      ? truncateForWhatsApp(contenidoFormateado)
      : contenidoFormateado,
  }
}
