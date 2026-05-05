/**
 * @module email.types
 * @description Tipos TypeScript estrictos para el Módulo A2 - Email Service.
 * Define interfaces, tipos y contratos para el envío de emails a través de Resend.
 * Cero uso de `any` — tipado completo y seguro.
 *
 * @project DECODEX Bolivia - Equipo A
 */

/** Adjunto de email codificado en base64 */
export interface Attachment {
  /** Nombre del archivo (ej: "reporte_semanal.pdf") */
  filename: string;
  /** Contenido del archivo codificado en base64 */
  content: string;
  /** Tipo MIME del archivo (ej: "application/pdf") */
  contentType?: string;
}

/** Opciones adicionales de envío de email */
export interface EmailOptions {
  /** Dirección de respuesta (reply-to) */
  replyTo?: string;
  /** Lista de archivos adjuntos */
  adjuntos?: Attachment[];
  /** Destinatarios en copia */
  cc?: string[];
  /** Destinatarios en copia oculta */
  bcc?: string[];
  /** Tags para categorización y rastreo en Resend */
  tags?: EmailTag[];
}

/** Tag de categorización para Resend */
export interface EmailTag {
  /** Nombre del tag */
  name: string;
  /** Valor del tag */
  value: string;
}

/** Resultado de entrega de un email individual */
export interface EmailDeliveryResult {
  /** `true` si el email fue aceptado por el proveedor */
  success: boolean;
  /** ID único del mensaje devuelto por Resend */
  messageId?: string;
  /** Marca temporal ISO 8601 del envío */
  timestamp?: string;
  /** Código de error devuelto por el proveedor */
  errorCode?: string;
  /** Mensaje de error descriptivo */
  errorMessage?: string;
  /** URL para previsualizar el email en el dashboard de Resend */
  previewUrl?: string;
}

/** Tipo de email para clasificación interna */
export type EmailType = 'boletin' | 'alerta' | 'notificacion' | 'personalizado';

/** Estado del servicio Email */
export interface EmailServiceStatus {
  /** `true` si las credenciales están configuradas */
  configured: boolean;
  /** Proveedor activo: 'resend' con credenciales, 'mock' sin ellas */
  provider: 'resend' | 'mock';
  /** Dirección remitente (from address) */
  fromAddress: string;
  /** Nombre remitente para mostrar */
  fromName: string;
}

/** Resultado de preview sin envío */
export interface EmailPreview {
  /** Contenido HTML del email */
  htmlContent: string;
  /** Asunto del email */
  subject: string;
  /** Dirección remitente */
  from: string;
  /** Dirección destinatario */
  to: string;
  /** Marca temporal ISO 8601 de generación */
  timestamp: string;
  /** Tipo de email para clasificación */
  type: EmailType;
}

/** Resultado de validación de dirección email */
export interface EmailValidationResult {
  /** `true` si el formato es válido */
  valid: boolean;
  /** Descripción del error si la validación falla */
  error?: string;
}

/** Configuración interna del servicio */
export interface EmailServiceConfig {
  /** API Key de Resend */
  apiKey: string;
  /** Dirección remitente verificado en Resend */
  fromAddress: string;
  /** Nombre del remitente */
  fromName: string;
  /** Dirección de reply-to por defecto */
  replyTo?: string;
  /** URL base de la API de Resend */
  apiBaseUrl: string;
  /** Cantidad máxima de reintentos */
  maxRetries: number;
  /** Base del backoff exponencial en milisegundos */
  retryBaseDelayMs: number;
}

/** Payload enviado a la API de Resend */
export interface ResendEmailPayload {
  from: string;
  to: string[];
  subject: string;
  html: string;
  reply_to?: string;
  attachments?: ResendAttachment[];
  cc?: string[];
  bcc?: string[];
  tags?: EmailTag[];
}

/** Formato de adjunto esperado por la API de Resend */
export interface ResendAttachment {
  filename: string;
  content: string;
  content_type?: string;
}

/** Respuesta exitosa de la API de Resend */
export interface ResendSuccessResponse {
  id: string;
}

/** Respuesta de error de la API de Resend */
export interface ResendErrorResponse {
  name: string;
  message: string;
  statusCode: number;
}
