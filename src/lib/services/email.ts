/**
 * @module email
 * @description Implementación principal del Módulo A2 - Email Service.
 * Servicio plug-in independiente para envío de boletines, alertas y notificaciones
 * por email utilizando la API REST de Resend.
 *
 * Características:
 * - Validación robusta de direcciones email
 * - Conversión de clases CSS a estilos inline para compatibilidad con clientes de email
 * - Función preview() para dashboard admin SIN enviar
 * - Soporte para adjuntos en base64, CC, BCC y tags
 * - Modo mock automático cuando no hay credenciales configuradas
 * - Reintentos con backoff exponencial (3 intentos: 2s, 6s, 18s)
 *
 * @project DECODEX Bolivia - Equipo A
 */

import type {
  Attachment,
  EmailDeliveryResult,
  EmailOptions,
  EmailPreview,
  EmailServiceConfig,
  EmailServiceStatus,
  EmailType,
  EmailValidationResult,
  ResendAttachment,
  ResendEmailPayload,
  ResendErrorResponse,
  ResendSuccessResponse,
} from './email.types.js';

// ─── Constantes ───────────────────────────────────────────────────────────────

const DEFAULT_FROM_ADDRESS = 'onboarding@resend.dev';
const DEFAULT_FROM_NAME = 'DECODEX Bolivia';
const RESEND_API_BASE = 'https://api.resend.com/emails';
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 2000;

/** Mapa de reglas CSS inline para conversión de clases a estilos */
const INLINE_STYLES_MAP: Record<string, Record<string, string>> = {
  h1: { 'font-size': '24px', 'font-weight': 'bold', 'margin': '0 0 16px 0', color: '#1a1a2e' },
  h2: { 'font-size': '20px', 'font-weight': 'bold', 'margin': '0 0 12px 0', color: '#16213e' },
  h3: { 'font-size': '16px', 'font-weight': 'bold', 'margin': '0 0 8px 0', color: '#0f3460' },
  p: { 'font-size': '14px', 'line-height': '1.6', 'margin': '0 0 12px 0', color: '#333333' },
  a: { color: '#e94560', 'text-decoration': 'none' },
  ul: { 'margin': '0 0 12px 0', 'padding-left': '20px' },
  ol: { 'margin': '0 0 12px 0', 'padding-left': '20px' },
  li: { 'font-size': '14px', 'line-height': '1.6', 'margin': '0 0 4px 0' },
  blockquote: {
    border: '1px solid #ddd',
    'border-left': '4px solid #e94560',
    'padding': '8px 16px',
    margin: '0 0 12px 0',
    'background-color': '#f9f9f9',
    color: '#555555',
  },
  code: {
    'font-family': 'monospace',
    'background-color': '#f4f4f4',
    padding: '2px 6px',
    'border-radius': '3px',
    'font-size': '13px',
  },
  pre: {
    'font-family': 'monospace',
    'background-color': '#f4f4f4',
    padding: '12px',
    'border-radius': '4px',
    'overflow-x': 'auto',
    'font-size': '13px',
    margin: '0 0 12px 0',
    border: '1px solid #e0e0e0',
  },
  table: {
    border: 'none',
    'border-collapse': 'collapse',
    width: '100%',
    margin: '0 0 12px 0',
  },
  th: {
    'background-color': '#1a1a2e',
    color: '#ffffff',
    padding: '8px 12px',
    'text-align': 'left',
    'font-size': '13px',
    'font-weight': 'bold',
    border: '1px solid #1a1a2e',
  },
  td: {
    padding: '8px 12px',
    'font-size': '13px',
    border: '1px solid #dddddd',
  },
  'tr:nth-child(even) td': { 'background-color': '#f9f9f9' },
  hr: { border: 'none', 'border-top': '1px solid #dddddd', margin: '16px 0' },
  strong: { 'font-weight': 'bold' },
  em: { 'font-style': 'italic' },
  img: { 'max-width': '100%', height: 'auto', margin: '0 0 12px 0' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Espera un tiempo determinado en milisegundos.
 * Utilitario para reintentos con backoff.
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Convierte un objeto de estilos CSS a un string de atributo `style`.
 * @param styles - Objeto con propiedades CSS
 * @returns String de estilos inline
 */
function stylesToString(styles: Record<string, string>): string {
  return Object.entries(styles)
    .map(([prop, value]) => `${prop}: ${value}`)
    .join('; ');
}

/**
 * Lee la configuración desde variables de entorno.
 * Nunca hardcodea secrets.
 * @returns Objeto de configuración del servicio
 */
function loadConfig(): EmailServiceConfig {
  return {
    apiKey: process.env.RESEND_API_KEY ?? '',
    fromAddress: process.env.EMAIL_FROM ?? DEFAULT_FROM_ADDRESS,
    fromName: process.env.EMAIL_FROM_NAME ?? DEFAULT_FROM_NAME,
    replyTo: process.env.EMAIL_REPLY_TO,
    apiBaseUrl: RESEND_API_BASE,
    maxRetries: MAX_RETRIES,
    retryBaseDelayMs: RETRY_BASE_DELAY_MS,
  };
}

// ─── Módulo de RegEx para validación de email ─────────────────────────────────

/**
 * Patrón RFC 5322 simplificado para validación de direcciones email.
 * Acepta el formato estándar: local-part@domain.tld
 */
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

// ─── Funciones Públicas ──────────────────────────────────────────────────────

/**
 * Valida el formato de una dirección de email.
 *
 * @param email - Dirección de email a validar
 * @returns Resultado de la validación con indicador de éxito y error descriptivo
 *
 * @example
 * ```typescript
 * const result = validateEmail('usuario@ejemplo.com');
 * if (!result.valid) console.error(result.error);
 * ```
 */
export function validateEmail(email: string): EmailValidationResult {
  if (!email || typeof email !== 'string') {
    return { valid: false, error: 'La dirección de email es requerida y debe ser un string.' };
  }

  const trimmed = email.trim();

  if (trimmed.length === 0) {
    return { valid: false, error: 'La dirección de email no puede estar vacía.' };
  }

  if (trimmed.length > 254) {
    return { valid: false, error: 'La dirección de email no puede exceder 254 caracteres.' };
  }

  if (!EMAIL_REGEX.test(trimmed)) {
    return { valid: false, error: `Formato de email inválido: "${trimmed}"` };
  }

  return { valid: true };
}

/**
 * Convierte clases CSS y elementos HTML a estilos inline.
 * Necesario para compatibilidad con clientes de email que eliminan
 * bloques `<style>` (Gmail, Outlook, Yahoo).
 *
 * Procesa todos los elementos HTML conocidos definidos en INLINE_STYLES_MAP
 * y añade atributos `style` directamente a cada elemento.
 *
 * @param html - Contenido HTML con clases CSS
 * @returns HTML con estilos inline aplicados
 *
 * @example
 * ```typescript
 * const inlineHtml = inlineStyles('<h1>Boletín Semanal</h1><p>Contenido...</p>');
 * ```
 */
export function inlineStyles(html: string): string {
  if (!html || typeof html !== 'string') {
    return html;
  }

  let result = html;

  for (const [selector, styles] of Object.entries(INLINE_STYLES_MAP)) {
    const styleAttr = stylesToString(styles);

    // Caso 1: selector de pseudo-clase como tr:nth-child(even) td
    if (selector.includes(':')) {
      // Para tr:nth-child(even) td -> aplicamos a td dentro de tr
      const baseSelector = selector.split(':')[0]; // "tr"
      const pseudoPart = selector.split(':').slice(1).join(':'); // "nth-child(even) td"
      const targetTag = pseudoPart.split(' ').pop() ?? ''; // "td"

      if (targetTag && baseSelector) {
        // Aplicamos estilo a todos los td que están dentro de tr que son even
        let rowIndex = 0;
        result = result.replace(/<tr[^>]*>[\s\S]*?<\/tr>/g, (match) => {
          rowIndex++;
          if (rowIndex % 2 === 0) {
            return match.replace(/<td([^>]*)>/g, (tdMatch, tdAttrs: string) => {
              const hasStyle = /style\s*=/i.test(tdAttrs);
              if (hasStyle) {
                return tdMatch.replace(/style\s*=\s*"([^"]*)"/i, `style="$1; ${styleAttr}"`);
              }
              return `<td style="${styleAttr}"${tdAttrs}>`;
            });
          }
          return match;
        });
      }
      continue;
    }

    // Caso 2: selector simple de elemento (<tag>)
    const tagRegex = new RegExp(`<${selector}\\b([^>]*)>`, 'gi');
    result = result.replace(tagRegex, (match, attrs: string) => {
      const hasStyle = /style\s*=/i.test(attrs);
      if (hasStyle) {
        return match.replace(/style\s*=\s*"([^"]*)"/i, `style="$1; ${styleAttr}"`);
      }
      return `<${selector} style="${styleAttr}"${attrs}>`;
    });
  }

  return result;
}

/**
 * Obtiene el estado actual del servicio Email.
 * Indica si está configurado con credenciales reales o en modo mock.
 *
 * @returns Estado del servicio con proveedor y configuración
 */
export function getServiceStatus(): EmailServiceStatus {
  const config = loadConfig();
  const isConfigured = config.apiKey.length > 0 && config.apiKey.startsWith('re_');

  return {
    configured: isConfigured,
    provider: isConfigured ? 'resend' : 'mock',
    fromAddress: config.fromAddress,
    fromName: config.fromName,
  };
}

/**
 * Genera una previsualización del email sin enviarlo.
 * Útil para el dashboard admin donde se necesita verificar
 * el contenido antes de distribuir.
 *
 * @param destinatario - Dirección del destinatario
 * @param asunto - Asunto del email
 * @param htmlContent - Contenido HTML del email (se le aplicarán estilos inline)
 * @param type - Tipo de email para clasificación (default: 'personalizado')
 * @returns Objeto preview con todos los datos del email
 *
 * @example
 * ```typescript
 * const preview = previewEmail('admin@decodex.bo', 'Boletín #42', htmlContent, 'boletin');
 * console.log(preview.htmlContent); // HTML con estilos inline
 * ```
 */
export function preview(
  destinatario: string,
  asunto: string,
  htmlContent: string,
  type: EmailType = 'personalizado'
): EmailPreview {
  const config = loadConfig();
  const validation = validateEmail(destinatario);

  if (!validation.valid) {
    throw new Error(`Preview fallido: ${validation.error}`);
  }

  return {
    htmlContent: inlineStyles(htmlContent),
    subject: asunto,
    from: `${config.fromName} <${config.fromAddress}>`,
    to: destinatario,
    timestamp: new Date().toISOString(),
    type,
  };
}

/**
 * Envía un email individual a través de Resend.
 *
 * En modo mock (sin credenciales), simula el envío y devuelve un resultado
 * exitoso sin realizar llamadas a la API.
 *
 * Con credenciales, realiza hasta 3 reintentos con backoff exponencial
 * (2s, 6s, 18s) ante errores transitorios.
 *
 * @param destinatario - Dirección del destinatario
 * @param asunto - Asunto del email
 * @param htmlContent - Contenido HTML (se aplicarán estilos inline automáticamente)
 * @param opciones - Opciones adicionales (adjuntos, CC, BCC, tags, reply-to)
 * @returns Resultado de la entrega con ID de mensaje y marca temporal
 *
 * @example
 * ```typescript
 * const result = await sendEmail(
 *   'editor@medios.bo',
 *   'Alerta: Mención en El Deber',
 *   '<h1>Alerta</h1><p>Se detectó una mención...</p>',
 *   { tags: [{ name: 'tipo', value: 'alerta' }] }
 * );
 * ```
 */
export async function sendEmail(
  destinatario: string,
  asunto: string,
  htmlContent: string,
  opciones?: EmailOptions
): Promise<EmailDeliveryResult> {
  // ── Validaciones ──────────────────────────────────────────────────
  const emailValidation = validateEmail(destinatario);
  if (!emailValidation.valid) {
    return {
      success: false,
      timestamp: new Date().toISOString(),
      errorCode: 'INVALID_EMAIL',
      errorMessage: emailValidation.error,
    };
  }

  if (!asunto || asunto.trim().length === 0) {
    return {
      success: false,
      timestamp: new Date().toISOString(),
      errorCode: 'INVALID_SUBJECT',
      errorMessage: 'El asunto del email es requerido.',
    };
  }

  // ── Validación de CC/BCC ──────────────────────────────────────────
  if (opciones?.cc) {
    for (const ccEmail of opciones.cc) {
      const ccValidation = validateEmail(ccEmail);
      if (!ccValidation.valid) {
        return {
          success: false,
          timestamp: new Date().toISOString(),
          errorCode: 'INVALID_CC',
          errorMessage: `CC inválido: ${ccValidation.error}`,
        };
      }
    }
  }

  if (opciones?.bcc) {
    for (const bccEmail of opciones.bcc) {
      const bccValidation = validateEmail(bccEmail);
      if (!bccValidation.valid) {
        return {
          success: false,
          timestamp: new Date().toISOString(),
          errorCode: 'INVALID_BCC',
          errorMessage: `BCC inválido: ${bccValidation.error}`,
        };
      }
    }
  }

  const config = loadConfig();
  const isMock = config.apiKey.length === 0 || !config.apiKey.startsWith('re_');

  // ── Modo Mock ─────────────────────────────────────────────────────
  if (isMock) {
    return mockSend(destinatario, asunto, htmlContent, opciones, config);
  }

  // ── Envío real con Resend ─────────────────────────────────────────
  return resendSend(destinatario, asunto, htmlContent, opciones, config);
}

/**
 * Envía emails masivos a múltiples destinatarios.
 * Cada email se envía de forma independiente para evitar problemas
 * con la API y permitir seguimiento individual.
 *
 * @param destinatarios - Lista de direcciones de email
 * @param asunto - Asunto del email
 * @param htmlContent - Contenido HTML
 * @param opciones - Opciones adicionales (se aplican a todos los emails)
 * @returns Arreglo de resultados de entrega, uno por destinatario
 *
 * @example
 * ```typescript
 * const resultados = await sendBulk(
 *   ['editor1@medios.bo', 'editor2@medios.bo'],
 *   'Boletín Semanal #42',
 *   htmlContent,
 *   { tags: [{ name: 'tipo', value: 'boletin' }] }
 * );
 * const exitosos = resultados.filter(r => r.success).length;
 * ```
 */
export async function sendBulk(
  destinatarios: string[],
  asunto: string,
  htmlContent: string,
  opciones?: EmailOptions
): Promise<EmailDeliveryResult[]> {
  if (!Array.isArray(destinatarios) || destinatarios.length === 0) {
    return [{
      success: false,
      timestamp: new Date().toISOString(),
      errorCode: 'EMPTY_RECIPIENTS',
      errorMessage: 'La lista de destinatarios no puede estar vacía.',
    }];
  }

  // Enviar de forma secuencial para respetar rate limits
  const results: EmailDeliveryResult[] = [];
  for (const destinatario of destinatarios) {
    const result = await sendEmail(destinatario, asunto, htmlContent, opciones);
    results.push(result);

    // Pausa entre envíos para respetar rate limits
    if (destinatario !== destinatarios[destinatarios.length - 1]) {
      await delay(500);
    }
  }

  return results;
}

// ─── Implementaciones Internas ────────────────────────────────────────────────

/**
 * Simula el envío de un email en modo mock.
 * No realiza llamadas a la API. Útil para desarrollo y testing.
 */
function mockSend(
  destinatario: string,
  asunto: string,
  htmlContent: string,
  opciones: EmailOptions | undefined,
  config: EmailServiceConfig
): EmailDeliveryResult {
  const processedHtml = inlineStyles(htmlContent);

  // Log para debugging en desarrollo
  // eslint-disable-next-line no-console
  console.log('[MOCK EMAIL]', {
    from: `${config.fromName} <${config.fromAddress}>`,
    to: destinatario,
    subject: asunto,
    hasAttachments: (opciones?.adjuntos?.length ?? 0) > 0,
    ccCount: opciones?.cc?.length ?? 0,
    bccCount: opciones?.bcc?.length ?? 0,
    tagsCount: opciones?.tags?.length ?? 0,
    htmlLength: processedHtml.length,
  });

  return {
    success: true,
    messageId: `mock_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`,
    timestamp: new Date().toISOString(),
    previewUrl: `mock://preview/${Date.now()}`,
  };
}

/**
 * Envía un email real a través de la API REST de Resend.
 * Implementa reintentos con backoff exponencial ante errores transitorios.
 *
 * Estrategia de reintentos:
 * - Intento 1: inmediato
 * - Intento 2: espera 2s
 * - Intento 3: espera 6s (2s × 3)
 * - Intento 4: espera 18s (2s × 3²) — máximo antes de fallar
 */
async function resendSend(
  destinatario: string,
  asunto: string,
  htmlContent: string,
  opciones: EmailOptions | undefined,
  config: EmailServiceConfig
): Promise<EmailDeliveryResult> {
  const processedHtml = inlineStyles(htmlContent);

  // Construir payload para la API de Resend
  const payload: ResendEmailPayload = {
    from: `${config.fromName} <${config.fromAddress}>`,
    to: [destinatario],
    subject: asunto,
    html: processedHtml,
  };

  if (opciones?.replyTo ?? config.replyTo) {
    payload.reply_to = opciones?.replyTo ?? config.replyTo;
  }

  if (opciones?.adjuntos && opciones.adjuntos.length > 0) {
    payload.attachments = opciones.adjuntos.map(mapAttachment);
  }

  if (opciones?.cc && opciones.cc.length > 0) {
    payload.cc = opciones.cc;
  }

  if (opciones?.bcc && opciones.bcc.length > 0) {
    payload.bcc = opciones.bcc;
  }

  if (opciones?.tags && opciones.tags.length > 0) {
    payload.tags = opciones.tags;
  }

  // Ejecutar con reintentos
  let lastError: EmailDeliveryResult | undefined;

  for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
    try {
      const response = await fetch(config.apiBaseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const data: ResendSuccessResponse = await response.json() as ResendSuccessResponse;
        return {
          success: true,
          messageId: data.id,
          timestamp: new Date().toISOString(),
          previewUrl: `https://resend.com/emails/${data.id}`,
        };
      }

      // Manejar errores HTTP
      const errorBody: ResendErrorResponse = await response.json() as ResendErrorResponse;
      const errorCode = mapHttpError(response.status, errorBody);

      // Errores no reintentables: fallar inmediatamente
      if (!isRetryableError(response.status)) {
        return {
          success: false,
          timestamp: new Date().toISOString(),
          errorCode,
          errorMessage: errorBody.message || `HTTP ${response.status}`,
        };
      }

      // Guardar error para posible reintento
      lastError = {
        success: false,
        timestamp: new Date().toISOString(),
        errorCode,
        errorMessage: errorBody.message || `HTTP ${response.status}`,
      };

      // Si no quedan reintentos, fallar
      if (attempt >= config.maxRetries) {
        break;
      }

      // Backoff exponencial: 2s, 6s, 18s
      const delayMs = config.retryBaseDelayMs * Math.pow(3, attempt - 1);
      await delay(delayMs);
    } catch (networkError: unknown) {
      const errorMessage = networkError instanceof Error ? networkError.message : 'Error de red desconocido';
      lastError = {
        success: false,
        timestamp: new Date().toISOString(),
        errorCode: 'NETWORK_ERROR',
        errorMessage,
      };

      if (attempt >= config.maxRetries) {
        break;
      }

      const delayMs = config.retryBaseDelayMs * Math.pow(3, attempt - 1);
      await delay(delayMs);
    }
  }

  // Todos los reintentos fallaron
  return lastError ?? {
    success: false,
    timestamp: new Date().toISOString(),
    errorCode: 'UNKNOWN_ERROR',
    errorMessage: 'No se pudo enviar el email después de múltiples intentos.',
  };
}

/**
 * Mapea un adjunto interno al formato esperado por Resend.
 */
function mapAttachment(att: Attachment): ResendAttachment {
  return {
    filename: att.filename,
    content: att.content,
    content_type: att.contentType,
  };
}

/**
 * Determina si un código de error HTTP es reintentable.
 * Errores 429 (rate limit) y 5xx (server error) son reintentables.
 */
function isRetryableError(statusCode: number): boolean {
  return statusCode === 429 || (statusCode >= 500 && statusCode < 600);
}

/**
 * Mapea un código HTTP y cuerpo de error a un código de error interno.
 */
function mapHttpError(statusCode: number, errorBody: ResendErrorResponse): string {
  switch (statusCode) {
    case 400:
      return 'BAD_REQUEST';
    case 401:
      return 'AUTH_ERROR';
    case 403:
      return 'FORBIDDEN';
    case 422:
      return 'VALIDATION_ERROR';
    case 429:
      return 'RATE_LIMITED';
    case 500:
      return 'SERVER_ERROR';
    case 502:
      return 'BAD_GATEWAY';
    case 503:
      return 'SERVICE_UNAVAILABLE';
    default:
      return errorBody.name || `HTTP_${statusCode}`;
  }
}
