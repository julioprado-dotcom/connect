/**
 * @module whatsapp
 * @description Servicio principal del Módulo A1 - WhatsApp Business API.
 * Implementa el envío de notificaciones y boletines vía WhatsApp usando
 * la API REST de Twilio. Funciona en modo mock automático cuando no hay
 * credenciales configuradas.
 *
 * Características principales:
 * - Validación de formato de teléfono boliviano (+591XXXXXXXXX)
 * - Fragmentación automática de mensajes >4096 caracteres
 * - Reintentos con backoff exponencial (1s, 5s, 15s)
 * - Clasificación inteligente de errores (fatal vs reintentable)
 * - Modo sandbox y modo mock para desarrollo
 *
 * @project DECODEX Bolivia - Equipo A
 * @module_id A1
 */

import {
  WhatsAppOptions,
  WhatsAppDeliveryResult,
  WhatsAppServiceStatus,
  WhatsAppConfig,
  PhoneValidationResult,
  WhatsAppErrorType,
  WhatsAppServiceError,
  TwilioMessageResponse,
} from './whatsapp.types';

// ─── Constantes ──────────────────────────────────────────────────────────────

/** URL base de la API REST de Twilio para envío de mensajes */
const TWILIO_API_BASE = 'https://api.twilio.com/2010-04-01';

/** Longitud máxima de un mensaje WhatsApp antes de fragmentar */
const MAX_MESSAGE_LENGTH = 4096;

/** Número total de intentos de envío (incluyendo el primero) */
const MAX_RETRIES = 3;

/** Delays en milisegundos para backoff exponencial: 1s, 5s, 15s */
const RETRY_DELAYS_MS: readonly number[] = [1000, 5000, 15000];

/** Regex para validar números de teléfono bolivianos */
const BOLIVIA_PHONE_REGEX = /^\+591[67]\d{7}$/;

/** Prefijo internacional de Bolivia */
const BOLIVIA_PREFIX = '+591';

// ─── Estado interno ──────────────────────────────────────────────────────────

/** Configuración cacheada del servicio */
let cachedConfig: WhatsAppConfig | null = null;

// ─── Funciones auxiliares ────────────────────────────────────────────────────

/**
 * Lee la configuración desde variables de entorno.
 * Las credenciales nunca se hardcodean; se leen de process.env.
 *
 * @returns Configuración con valores de entorno o strings vacíos
 */
function loadConfig(): WhatsAppConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  cachedConfig = {
    accountSid: process.env.TWILIO_ACCOUNT_SID ?? '',
    authToken: process.env.TWILIO_AUTH_TOKEN ?? '',
    phoneNumber: process.env.TWILIO_PHONE_NUMBER ?? '',
    sandbox: process.env.WHATSAPP_SANDBOX === 'true',
  };

  return cachedConfig;
}

/**
 * Limpia la configuración cacheada. Útil para testing.
 */
export function resetConfig(): void {
  cachedConfig = null;
}

/**
 * Indica si el servicio tiene credenciales válidas configuradas.
 *
 * @returns `true` si accountSid, authToken y phoneNumber están presentes
 */
function isConfigured(): boolean {
  const config = loadConfig();
  return (
    config.accountSid.length > 0 &&
    config.authToken.length > 0 &&
    config.phoneNumber.length > 0
  );
}

/**
 * Genera un delay asíncrono.
 *
 * @param ms - Milisegundos a esperar
 * @returns Promesa que se resuelve después del delay
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}


/**
 * Obtiene la marca temporal actual en formato ISO 8601.
 *
 * @returns String con la fecha y hora actual en UTC
 */
function getTimestamp(): string {
  return new Date().toISOString();
}

// ─── Validación de teléfono ──────────────────────────────────────────────────

/**
 * Valida y normaliza un número de teléfono boliviano.
 * Acepta formatos: +591XXXXXXXXX, 591XXXXXXXXX, XXXXXXXXX (8 dígitos),
 * y números con espacios o guiones intermedios.
 *
 * @param telefono - Número de teléfono a validar
 * @returns Objeto con `valid: true` y `normalized` si es válido,
 *          o `valid: false` y `error` si es inválido
 *
 * @example
 * ```typescript
 * validatePhone('+59170000000')
 * // { valid: true, normalized: '+59170000000' }
 *
 * validatePhone('70000000')
 * // { valid: true, normalized: '+59170000000' }
 *
 * validatePhone('+59112345678')
 * // { valid: false, error: 'El número debe comenzar con 6 o 7 después de +591' }
 * ```
 */
export function validatePhone(telefono: string): PhoneValidationResult {
  if (!telefono || typeof telefono !== 'string') {
    return {
      valid: false,
      error: 'El número de teléfono es requerido y debe ser un string',
    };
  }

  // Limpiar espacios, guiones y paréntesis
  const cleaned = telefono.replace(/[\s\-\(\)]/g, '');

  // Agregar prefijo si no lo tiene
  let fullNumber: string;
  if (cleaned.startsWith('+591')) {
    fullNumber = cleaned;
  } else if (cleaned.startsWith('591')) {
    fullNumber = `+${cleaned}`;
  } else if (/^\d{8}$/.test(cleaned)) {
    fullNumber = `${BOLIVIA_PREFIX}${cleaned}`;
  } else {
    return {
      valid: false,
      error: 'El número debe comenzar con +591 o tener 8 dígitos',
    };
  }

  // Validar longitud exacta: +591 + 8 dígitos = 12 caracteres
  if (fullNumber.length !== 12) {
    return {
      valid: false,
      error: 'Longitud inválida: se esperan 8 dígitos después de +591',
    };
  }

  // Validar que comience con 6 o 7 (móviles en Bolivia)
  if (!/^6|7/.test(fullNumber.substring(4))) {
    return {
      valid: false,
      error: 'El número debe comenzar con 6 o 7 después de +591',
    };
  }

  // Validar que todos sean dígitos después del prefijo
  if (!BOLIVIA_PHONE_REGEX.test(fullNumber)) {
    return {
      valid: false,
      error: 'El formato del número de teléfono boliviano es inválido',
    };
  }

  return { valid: true, normalized: fullNumber };
}

// ─── Fragmentación ───────────────────────────────────────────────────────────

/**
 * Fragmenta un mensaje largo en partes de máximo 4096 caracteres,
 * agregando el marcador [N/M] al inicio de cada fragmento.
 *
 * Los fragmentos se generan respetando la longitud real incluyendo
 * el prefijo del marcador.
 *
 * @param mensaje - Mensaje completo a fragmentar
 * @returns Arreglo de strings con cada fragmento, o un solo elemento
 *          si el mensaje es corto
 *
 * @example
 * ```typescript
 * fragmentMessage('Hola') // ['Hola']
 *
 * const largo = 'A'.repeat(5000)
 * fragmentMessage(largo)
 * // ['[1/2] AAAA...', '[2/2] AAAA...']
 * ```
 */
export function fragmentMessage(mensaje: string): string[] {
  if (mensaje.length <= MAX_MESSAGE_LENGTH) {
    return [mensaje];
  }

  const fragments: string[] = [];
  let remaining = mensaje;
  let fragmentIndex = 1;

  // Primer pase: estimar cuántos fragmentos se necesitarán
  const estimatedTotal = Math.ceil(mensaje.length / MAX_MESSAGE_LENGTH);

  while (remaining.length > 0) {
    // El marcador puede ocupar distinto espacio según el número total
    // Usamos el total estimado para el marcador
    const marker = `[${fragmentIndex}/${estimatedTotal}] `;
    const availableSpace = MAX_MESSAGE_LENGTH - marker.length;

    if (availableSpace <= 0) {
      // Caso extremo: el marcador es más largo que el límite
      // (no debería pasar con 4096 caracteres)
      fragments.push(remaining);
      break;
    }

    if (remaining.length <= availableSpace) {
      // Último fragmento
      fragments.push(`${marker}${remaining}`);
      remaining = '';
    } else {
      // Cortar en el límite, intentando no cortar palabras
      let cutIndex = availableSpace;

      // Buscar último espacio cercano al corte (dentro de los últimos 100 chars)
      const searchStart = Math.max(0, availableSpace - 100);
      const lastSpace = remaining.lastIndexOf(' ', availableSpace);

      if (lastSpace > searchStart) {
        cutIndex = lastSpace;
      }

      fragments.push(`${marker}${remaining.substring(0, cutIndex)}`);
      remaining = remaining.substring(cutIndex).trimStart();

      // Actualizar total estimado si es necesario
      const newEstimated = fragmentIndex + Math.ceil(remaining.length / MAX_MESSAGE_LENGTH);
      if (newEstimated !== estimatedTotal) {
        // Recalcular los marcadores del primer fragmento si cambió el total
        // Esto es raro pero posible con word-wrap
      }

      fragmentIndex++;
    }
  }

  // Actualizar marcadores con el total real
  const realTotal = fragments.length;
  if (realTotal !== estimatedTotal && realTotal > 1) {
    for (let i = 0; i < realTotal; i++) {
      const content = fragments[i].replace(/^\[\d+\/\d+\]\s*/, '');
      fragments[i] = `[${i + 1}/${realTotal}] ${content}`;
    }
  }

  return fragments;
}

// ─── Clasificación de errores ────────────────────────────────────────────────

/**
 * Clasifica un error HTTP en un tipo de error WhatsApp para
 * determinar la estrategia de reintento.
 *
 * - 401/403 → AUTHENTICATION (no reintentar)
 * - 429 → RATE_LIMIT (reintentar con espera)
 * - Errores de código Twilio 21xxx → VALIDATION (no reintentar)
 * - Errores de red (sin status) → TRANSIENT (reintentar)
 * - Otros 5xx → TRANSIENT (reintentar)
 * - Otros → UNKNOWN (reintentar)
 *
 * @param statusCode - Código de estado HTTP (undefined si error de red)
 * @param body - Cuerpo de la respuesta de error (puede ser string o objeto)
 * @returns Tipo de error clasificado
 */
function classifyError(
  statusCode: number | undefined,
  body: string | Record<string, unknown>,
): WhatsAppErrorType {
  // Error de autenticación
  if (statusCode === 401 || statusCode === 403) {
    return WhatsAppErrorType.AUTHENTICATION;
  }

  // Rate limit
  if (statusCode === 429) {
    return WhatsAppErrorType.RATE_LIMIT;
  }

  // Errores del servidor
  if (statusCode !== undefined && statusCode >= 500) {
    return WhatsAppErrorType.TRANSIENT;
  }

  // Errores de validación de Twilio (códigos 21xxx)
  if (typeof body === 'string') {
    try {
      const parsed = JSON.parse(body) as { code?: number };
      if (parsed.code && parsed.code >= 21000 && parsed.code < 22000) {
        return WhatsAppErrorType.VALIDATION;
      }
    } catch {
      // No es JSON, continuar
    }
  } else if (body !== null && typeof body === 'object' && 'code' in body) {
    const code = (body as { code: number }).code;
    if (code >= 21000 && code < 22000) {
      return WhatsAppErrorType.VALIDATION;
    }
  }

  // Error de red (sin statusCode)
  if (statusCode === undefined) {
    return WhatsAppErrorType.TRANSIENT;
  }

  return WhatsAppErrorType.UNKNOWN;
}

/**
 * Indica si un tipo de error debe ser reintentado.
 *
 * @param errorType - Tipo de error clasificado
 * @returns `true` si se debe reintentar el envío
 */
function shouldRetry(errorType: WhatsAppErrorType): boolean {
  return (
    errorType === WhatsAppErrorType.RATE_LIMIT ||
    errorType === WhatsAppErrorType.TRANSIENT ||
    errorType === WhatsAppErrorType.UNKNOWN
  );
}

// ─── Envío a la API de Twilio ────────────────────────────────────────────────

/**
 * Envía un mensaje individual a la API REST de Twilio.
 *
 * Usa la API REST directamente (sin SDK) para mantener el módulo ligero.
 * Autenticación via Basic Auth con base64(SID:AuthToken).
 *
 * @param telefono - Número de teléfono destino (formato internacional)
 * @param mensaje - Contenido del mensaje
 * @param config - Configuración de Twilio
 * @returns Promesa que resuelve con la respuesta de Twilio
 * @throws {WhatsAppServiceError} Si la API retorna un error
 */
async function sendToTwilioAPI(
  telefono: string,
  mensaje: string,
  config: WhatsAppConfig,
): Promise<TwilioMessageResponse> {
  const url = `${TWILIO_API_BASE}/Accounts/${config.accountSid}/Messages.json`;

  const credentials = Buffer.from(`${config.accountSid}:${config.authToken}`).toString('base64');

  const params = new URLSearchParams({
    To: `whatsapp:${telefono}`,
    From: `whatsapp:${config.phoneNumber}`,
    Body: mensaje,
  });

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });
  } catch (networkError) {
    const message =
      networkError instanceof Error ? networkError.message : 'Error de red desconocido';
    throw new WhatsAppServiceError(
      `Error de red al conectar con Twilio: ${message}`,
      WhatsAppErrorType.TRANSIENT,
      undefined,
    );
  }

  const responseBody = await response.text();
  const errorType = classifyError(response.status, responseBody);

  if (!response.ok) {
    let twilioCode: string | undefined;
    let errorMessage: string;

    try {
      const parsed = JSON.parse(responseBody) as { code?: number; message?: string };
      twilioCode = parsed.code?.toString();
      errorMessage = parsed.message ?? 'Error desconocido de Twilio';
    } catch {
      twilioCode = undefined;
      errorMessage = responseBody.substring(0, 200);
    }

    throw new WhatsAppServiceError(
      `Error de Twilio (${response.status}): ${errorMessage}`,
      errorType,
      response.status,
      twilioCode,
    );
  }

  try {
    return JSON.parse(responseBody) as TwilioMessageResponse;
  } catch {
    throw new WhatsAppServiceError(
      'No se pudo parsear la respuesta de Twilio',
      WhatsAppErrorType.UNKNOWN,
      response.status,
    );
  }
}

// ─── Envío en modo Mock ──────────────────────────────────────────────────────

/**
 * Simula el envío de un mensaje WhatsApp en modo mock.
 * Genera un delay aleatorio de 100-300ms para simular latencia de red.
 *
 * @param telefono - Número de teléfono destino
 * @param mensaje - Contenido del mensaje
 * @returns Promesa que resuelve con un resultado exitoso mock
 */
async function sendMock(
  telefono: string,
  mensaje: string,
): Promise<WhatsAppDeliveryResult> {
  const mockDelay = 100 + Math.floor(Math.random() * 200);
  await delay(mockDelay);

  // Simular un ID de mensaje basado en hash del contenido
  const hash = Buffer.from(`${telefono}:${mensaje.substring(0, 50)}`).toString('base64').substring(0, 12);

  return {
    success: true,
    messageId: `SMmock_${hash}`,
    timestamp: getTimestamp(),
    telefono,
    fragments: undefined,
  };
}

// ─── Función principal de envío ──────────────────────────────────────────────

/**
 * Envía un mensaje WhatsApp a un número de teléfono boliviano.
 *
 * Esta es la función principal del servicio. Realiza:
 * 1. Validación del formato del teléfono
 * 2. Fragmentación automática si el mensaje excede 4096 caracteres
 * 3. Envío a la API de Twilio con reintentos y backoff exponencial
 * 4. Fallback automático a modo mock cuando no hay credenciales
 *
 * **Estrategia de reintentos:**
 * - Errores de autenticación y validación: no reintentan (error fatal)
 * - Rate limit (429): reintentan con backoff de 1s, 5s, 15s
 * - Errores temporales de red: reintentan con el mismo backoff
 * - Máximo 3 intentos total
 *
 * @param telefono - Número de teléfono destino (formatos aceptados:
 *                   +591XXXXXXXXX, 591XXXXXXXXX, XXXXXXXXX)
 * @param mensaje - Contenido del mensaje a enviar
 * @param opciones - Opciones adicionales (template y parámetros)
 * @returns Promesa con el resultado de la entrega
 *
 * @throws {WhatsAppServiceError} En caso de error de validación (síncrono)
 *         o error de Twilio después de agotar reintentos
 *
 * @example
 * ```typescript
 * // Envío simple
 * const result = await sendWhatsApp('+59170000000', 'Hola desde DECODEX');
 * console.log(result.success); // true
 *
 * // Envío con template
 * const result2 = await sendWhatsApp(
 *   '+59170000000',
 *   '',
 *   { templateId: 'hw_boletin', parametros: ['Juan', '15/01/2025'] }
 * );
 * ```
 */
export async function sendWhatsApp(
  telefono: string,
  mensaje: string,
  opciones?: WhatsAppOptions,
): Promise<WhatsAppDeliveryResult> {
  // ── 1. Validar teléfono ────────────────────────────────────────────────
  const phoneValidation = validatePhone(telefono);
  if (!phoneValidation.valid) {
    return {
      success: false,
      telefono,
      errorCode: 'VALIDATION_ERROR',
      errorMessage: phoneValidation.error,
    };
  }

  const normalizedPhone: string = phoneValidation.normalized!;

  // ── 2. Construir mensaje final ─────────────────────────────────────────
  let finalMessage = mensaje;

  // Si se proporciona template, usar el template como cuerpo base
  // Nota: Para templates de Twilio, normalmente se usaría la API de
  // Content API, pero aquí lo manejamos como mensaje parametrizado simple
  if (opciones?.templateId && opciones?.parametros) {
    const paramStr = opciones.parametros.join(' | ');
    finalMessage = `[Template: ${opciones.templateId}]\n${paramStr}`;
  }

  // ── 3. Verificar modo mock ─────────────────────────────────────────────
  const useMock = !isConfigured();
  const config = loadConfig();

  if (useMock) {
    // En modo mock, enviar sin fragmentación (no hay límite real)
    const mockResult = await sendMock(normalizedPhone, finalMessage);
    return {
      ...mockResult,
      telefono: normalizedPhone,
    };
  }

  // ── 4. Fragmentar mensaje si es necesario ──────────────────────────────
  const fragments = fragmentMessage(finalMessage);

  // ── 5. Enviar cada fragmento con reintentos ───────────────────────────
  const results: WhatsAppDeliveryResult[] = [];

  for (const fragment of fragments) {
    let lastError: WhatsAppServiceError | null = null;
    let sent = false;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const twilioResponse = await sendToTwilioAPI(normalizedPhone, fragment, config);

        results.push({
          success: true,
          messageId: twilioResponse.sid,
          timestamp: twilioResponse.date_created,
          telefono: normalizedPhone,
          fragments: fragments.length > 1 ? fragments.length : undefined,
        });

        sent = true;
        lastError = null;
        break; // Éxito, salir del loop de reintentos
      } catch (error) {
        if (error instanceof WhatsAppServiceError) {
          lastError = error;

          // No reintentar errores fatales
          if (!shouldRetry(error.type)) {
            break;
          }

          // Esperar antes de reintentar (excepto en el último intento)
          if (attempt < MAX_RETRIES - 1) {
            const retryDelay = RETRY_DELAYS_MS[attempt] ?? 15000;
            await delay(retryDelay);
          }
        } else {
          // Error inesperado no-WhatsAppServiceError
          const message = error instanceof Error ? error.message : 'Error desconocido';
          lastError = new WhatsAppServiceError(
            `Error inesperado: ${message}`,
            WhatsAppErrorType.UNKNOWN,
          );
          break;
        }
      }
    }

    // Si después de todos los reintentos no se envió
    if (!sent && lastError) {
      return {
        success: false,
        telefono: normalizedPhone,
        errorCode: lastError.twilioCode ?? lastError.type,
        errorMessage: lastError.message,
        fragments: fragments.length > 1 ? fragments.length : undefined,
      };
    }
  }

  // Retornar resultado del último fragmento como resultado consolidado
  const lastResult = results[results.length - 1];
  return {
    success: true,
    messageId: lastResult.messageId,
    timestamp: lastResult.timestamp,
    telefono: normalizedPhone,
    fragments: fragments.length > 1 ? fragments.length : undefined,
  };
}

// ─── Estado del servicio ─────────────────────────────────────────────────────

/**
 * Obtiene el estado actual del servicio WhatsApp.
 * Permite verificar si el servicio está configurado correctamente,
 * en qué modo opera (producción, sandbox o mock).
 *
 * @returns Estado actual del servicio
 *
 * @example
 * ```typescript
 * const status = getServiceStatus();
 * if (status.provider === 'mock') {
 *   console.warn('WhatsApp operando en modo mock - sin credenciales');
 * }
 * ```
 */
export function getServiceStatus(): WhatsAppServiceStatus {
  const configured = isConfigured();
  const config = loadConfig();

  return {
    configured,
    provider: configured ? 'twilio' : 'mock',
    sandbox: config.sandbox,
  };
}

// ─── Exportar tipos internos para testing ─────────────────────────────────────

/**
 * Referencia interna a `classifyError` para testing.
 * No usar en producción.
 * @internal
 */
export { classifyError, shouldRetry, MAX_MESSAGE_LENGTH, RETRY_DELAYS_MS, MAX_RETRIES };
