/**
 * Delivery — ONION200 / DECODEX Bolivia
 * Funciones de formateo y entrega de boletines por canal.
 */

import { ETIQUETAS_ENTREGA } from '@/constants/products'
import { type TipoBoletin } from '@/types/bulletin'

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

// ─── Truncar para WhatsApp (límite ~4096 chars) ───────────────────

export function truncateForWhatsApp(content: string, maxLength: number = 3800): string {
  if (content.length <= maxLength) return content
  return content.slice(0, maxLength - 50) + '\n\n... [Continúa en el adjunto / enlace]'
}

// ─── Formatear contenido para WhatsApp ────────────────────────────

export function formatForWhatsApp(content: string): string {
  return content
    .replace(/#{1,3}\s/g, '*')       // headers → bold
    .replace(/\*\*(.*?)\*\*/g, '*$1*') // markdown bold → WhatsApp bold
    .replace(/__(.*?)__/g, '_$1_')    // markdown italic → WhatsApp italic
    .replace(/~~(.*?)~~/g, '~$1~')    // markdown strikethrough
    .replace(/`{3}[\s\S]*?`{3}/g, '') // remove code blocks
    .replace(/`([^`]+)`/g, '_$1_')    // inline code → italic
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links → plain text
    .trim()
}

// ─── Formatear contenido para Email (HTML básico) ─────────────────

export function formatForEmail(content: string): string {
  return content
    .replace(/#{1}\s(.+)/g, '<h1>$1</h1>')
    .replace(/#{2}\s(.+)/g, '<h2>$1</h2>')
    .replace(/#{3}\s(.+)/g, '<h3>$1</h3>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<strong>$1</strong>')
    .replace(/__(.*?)__/g, '<em>$1</em>')
    .replace(/_(.*?)_/g, '<em>$1</em>')
    .replace(/- (.+)/g, '<li>$1</li>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>')
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
