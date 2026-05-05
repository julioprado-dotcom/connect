/**
 * DECODEX v0.11.0 — Canales de Entrega
 * Conecta los servicios reales del Equipo A con los generadores del Equipo B.
 *
 * Los módulos del Equipo A (WhatsApp, Email, PDF) funcionan en modo real
 * cuando las variables de entorno están configuradas, y en modo mock
 * automáticamente cuando no lo están.
 */

import { sendWhatsApp as waSend } from '@/lib/services/whatsapp';
import { sendEmail as emSend } from '@/lib/services/email';
import { generarInformePDF as pdfGenerate } from '@/lib/services/pdf-generator';
import type { InformeData, TipoInforme } from '@/lib/services/pdf-generator.types';

// ============================================
// Tipos de resultado
// ============================================

export interface ChannelResult {
  exito: boolean;
  trackingId?: string;
  error?: string;
}

// ============================================
// WhatsApp — Delegado al módulo A1 del Equipo A
// ============================================

/**
 * Envía un mensaje por WhatsApp vía Twilio (Equipo A).
 */
export async function sendWhatsApp(
  telefono: string,
  mensaje: string
): Promise<ChannelResult> {
  try {
    if (!telefono || !/^591\d{8}$/.test(telefono)) {
      return {
        exito: false,
        error: `Formato de teléfono inválido: ${telefono}. Formato esperado: 591XXXXXXXXX`,
      };
    }

    const WHATSAPP_MAX = 1600;
    let content = mensaje;
    if (content.length > WHATSAPP_MAX) {
      console.warn(`[whatsapp] Mensaje truncado: ${content.length} > ${WHATSAPP_MAX} caracteres`);
      content = content.substring(0, WHATSAPP_MAX - 3) + '...';
    }

    const result = await waSend(telefono, content);

    return {
      exito: result.success,
      trackingId: result.messageId || `wa_${Date.now()}`,
      error: result.errorMessage,
    };
  } catch (error) {
    console.error('[whatsapp] Error:', error);
    return {
      exito: false,
      error: error instanceof Error ? error.message : 'Error al enviar WhatsApp',
    };
  }
}

// ============================================
// Email — Delegado al módulo A2 del Equipo A
// ============================================

/**
 * Envía un correo electrónico vía Resend (Equipo A).
 */
export async function sendEmail(
  destinatario: string,
  asunto: string,
  contenidoHtml: string
): Promise<ChannelResult> {
  try {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!destinatario || !emailRegex.test(destinatario)) {
      return {
        exito: false,
        error: `Email inválido: ${destinatario}`,
      };
    }

    if (!contenidoHtml || contenidoHtml.trim().length === 0) {
      return {
        exito: false,
        error: 'Contenido del email vacío',
      };
    }

    const result = await emSend(destinatario, asunto, contenidoHtml);

    return {
      exito: result.success,
      trackingId: result.messageId || `em_${Date.now()}`,
      error: result.errorMessage,
    };
  } catch (error) {
    console.error('[email] Error:', error);
    return {
      exito: false,
      error: error instanceof Error ? error.message : 'Error al enviar email',
    };
  }
}

// ============================================
// PDF — Delegado al módulo A4 del Equipo A
// ============================================

/**
 * Genera un documento PDF vía Puppeteer (Equipo A).
 */
export async function generatePDF(
  contenido: string,
  titulo: string
): Promise<ChannelResult> {
  try {
    if (!contenido || contenido.trim().length === 0) {
      return {
        exito: false,
        error: 'Contenido vacío para generar PDF',
      };
    }

    const data: InformeData = {
      filtros: { personas: [], medios: [], ejes: [], fechaDesde: new Date().toISOString(), fechaHasta: new Date().toISOString() },
      titulo,
      menciones: [],
      estadisticas: {
        totalMenciones: 0,
        porSentimiento: { positivo: 0, negativo: 0, neutro: 0 },
        porMedio: {},
      },
      resumen: contenido.slice(0, 500),
    };

    const result = await pdfGenerate(data, 'ad_hoc');

    return {
      exito: result.success,
      trackingId: result.filename || `pdf_${Date.now()}`,
      error: result.error,
    };
  } catch (error) {
    console.error('[pdf] Error:', error);
    return {
      exito: false,
      error: error instanceof Error ? error.message : 'Error al generar PDF',
    };
  }
}

// ============================================
// Health Check
// ============================================

/**
 * Verifica si un canal de entrega está disponible.
 */
export async function checkChannelStatus(canal: 'whatsapp' | 'email' | 'pdf'): Promise<{
  disponible: boolean;
  latenciaMs: number;
  mensaje: string;
}> {
  const start = Date.now();

  try {
    switch (canal) {
      case 'whatsapp': {
        const available = !!process.env.TWILIO_ACCOUNT_SID && !!process.env.TWILIO_AUTH_TOKEN;
        return {
          disponible: available,
          latenciaMs: Date.now() - start,
          mensaje: available ? 'WhatsApp (Twilio) conectado' : 'WhatsApp en modo mock (sin TWILIO_*)',
        };
      }
      case 'email': {
        const available = !!process.env.RESEND_API_KEY;
        return {
          disponible: available,
          latenciaMs: Date.now() - start,
          mensaje: available ? 'Email (Resend) conectado' : 'Email en modo mock (sin RESEND_API_KEY)',
        };
      }
      case 'pdf': {
        return {
          disponible: true,
          latenciaMs: Date.now() - start,
          mensaje: 'PDF disponible (Puppeteer: detectado en runtime)',
        };
      }
    }
  } catch {
    return {
      disponible: false,
      latenciaMs: Date.now() - start,
      mensaje: `Error al verificar canal ${canal}`,
    };
  }
}
