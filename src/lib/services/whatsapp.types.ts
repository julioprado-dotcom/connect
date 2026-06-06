/**
 * @module whatsapp.types
 * @description Tipos TypeScript estrictos para el Módulo A1 - WhatsApp Business API.
 * Define todas las interfaces y tipos utilizados por el servicio de mensajería WhatsApp
 * a través de Twilio. Prohibido el uso de `any`.
 *
 * @project DECODEX Bolivia - Equipo A
 * @module_id A1
 */

// ─── Opciones de envío ───────────────────────────────────────────────────────

/**
 * Opciones adicionales para enviar un mensaje WhatsApp.
 * Permite el uso de templates de Twilio con parámetros dinámicos.
 *
 * @example
 * ```typescript
 * const opciones: WhatsAppOptions = {
 *   templateId: 'hw_bienvenida',
 *   parametros: ['Juan', '2025']
 * };
 * ```
 */
export interface WhatsAppOptions {
  /** ID del template aprobado en Twilio (ej: 'hw_bienvenida') */
  templateId?: string;
  /** Lista de parámetros para sustituir en el template (máximo 10) */
  parametros?: string[];
}

// ─── Resultados de entrega ───────────────────────────────────────────────────

/**
 * Resultado de la operación de envío de mensaje WhatsApp.
 * Contiene información sobre el éxito o fracaso del envío,
 * incluyendo detalles de error cuando aplica.
 *
 * @example
 * ```typescript
 * // Envío exitoso
 * {
 *   success: true,
 *   messageId: 'SMabc123',
 *   timestamp: '2025-01-15T10:30:00Z',
 *   fragments: 2,
 *   telefono: '+59170000000'
 * }
 *
 * // Envío fallido
 * {
 *   success: false,
 *   errorCode: '21211',
 *   errorMessage: 'Invalid To Number',
 *   telefono: '+59100000000'
 * }
 * ```
 */
export interface WhatsAppDeliveryResult {
  /** Indica si el mensaje fue enviado exitosamente */
  success: boolean;
  /** SID del mensaje asignado por Twilio (presente solo en éxito) */
  messageId?: string;
  /** Marca temporal ISO 8601 del envío (presente solo en éxito) */
  timestamp?: string;
  /** Código de error retornado por Twilio (presente solo en fallo) */
  errorCode?: string;
  /** Mensaje descriptivo del error (presente solo en fallo) */
  errorMessage?: string;
  /** Número de fragmentos enviados (presente cuando hay fragmentación) */
  fragments?: number;
  /** Número de teléfono destino (siempre presente) */
  telefono: string;
}

// ─── Estado del servicio ─────────────────────────────────────────────────────

/**
 * Estado actual del servicio WhatsApp.
 * Permite consultar si el servicio está configurado para producción,
 * sandbox, o funcionando en modo mock.
 *
 * @example
 * ```typescript
 * const status = getServiceStatus();
 * // { configured: true, provider: 'twilio', sandbox: false }
 * ```
 */
export interface WhatsAppServiceStatus {
  /** `true` si las credenciales de Twilio están configuradas */
  configured: boolean;
  /** Proveedor activo: 'twilio' para producción, 'mock' para desarrollo/pruebas */
  provider: 'twilio' | 'mock';
  /** `true` si está en modo sandbox de Twilio (envío gratuito limitado) */
  sandbox: boolean;
}

// ─── Configuración ───────────────────────────────────────────────────────────

/**
 * Configuración del servicio WhatsApp.
 * Normalmente cargada desde variables de entorno.
 *
 * @example
 * ```typescript
 * const config: WhatsAppConfig = {
 *   accountSid: process.env.TWILIO_ACCOUNT_SID ?? '',
 *   authToken: process.env.TWILIO_AUTH_TOKEN ?? '',
 *   phoneNumber: process.env.TWILIO_PHONE_NUMBER ?? '',
 *   sandbox: process.env.WHATSAPP_SANDBOX === 'true'
 * };
 * ```
 */
export interface WhatsAppConfig {
  /** Twilio Account SID (credencial principal) */
  accountSid: string;
  /** Twilio Auth Token (credencial secreta) */
  authToken: string;
  /** Número de Twilio con canal WhatsApp habilitado */
  phoneNumber: string;
  /** Activar modo sandbox (sin costos, envío limitado) */
  sandbox: boolean;
}

// ─── Validación de teléfono ──────────────────────────────────────────────────

/**
 * Resultado de la validación de un número de teléfono boliviano.
 *
 * @example
 * ```typescript
 * // Válido
 * { valid: true, normalized: '+59170000000' }
 *
 * // Inválido
 * { valid: false, error: 'El número debe comenzar con +591' }
 * ```
 */
export interface PhoneValidationResult {
  /** `true` si el formato del teléfono es válido para Bolivia */
  valid: boolean;
  /** Número normalizado con prefijo internacional (solo si válido) */
  normalized?: string;
  /** Descripción del error de validación (solo si inválido) */
  error?: string;
}

// ─── Tipos internos de error ─────────────────────────────────────────────────

/** Clasificación de errores para determinar la estrategia de reintento */
export const enum WhatsAppErrorType {
  /** Error de autenticación con Twilio (401/403) — no reintentar */
  AUTHENTICATION = 'AUTHENTICATION',
  /** Formato de teléfono inválido — no reintentar */
  VALIDATION = 'VALIDATION',
  /** Rate limit de Twilio (429) — reintentar con espera */
  RATE_LIMIT = 'RATE_LIMIT',
  /** Error temporal de red o servidor — reintentar con backoff */
  TRANSIENT = 'TRANSIENT',
  /** Error desconocido — reintentar con backoff */
  UNKNOWN = 'UNKNOWN',
}

/**
 * Error estructurado del servicio WhatsApp.
 * Extiende Error con información contextual para el manejo de reintentos.
 */
export class WhatsAppServiceError extends Error {
  /** Tipo clasificado del error */
  readonly type: WhatsAppErrorType;
  /** Código de estado HTTP (si aplica) */
  readonly statusCode: number | undefined;
  /** Código de error de Twilio (si aplica) */
  readonly twilioCode: string | undefined;

  constructor(
    message: string,
    type: WhatsAppErrorType,
    statusCode?: number,
    twilioCode?: string,
  ) {
    super(message);
    this.name = 'WhatsAppServiceError';
    this.type = type;
    this.statusCode = statusCode;
    this.twilioCode = twilioCode;
  }
}

// ─── Tipos para la API REST de Twilio ────────────────────────────────────────

/** Respuesta exitosa de la API de mensajes de Twilio */
export interface TwilioMessageResponse {
  sid: string;
  status: string;
  date_created: string;
  date_updated: string;
  error_code: number | null;
  error_message: string | null;
  body: string;
  from: string;
  to: string;
  num_segments: string;
  direction: string;
}

/** Respuesta de error de la API de Twilio */
export interface TwilioErrorResponse {
  code: number;
  message: string;
  more_info: string;
  status: number;
}
