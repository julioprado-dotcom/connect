/**
 * @module queue.types
 * @description Tipos TypeScript estrictos para el Módulo A5 - Cola de Trabajos.
 * Define la interfaz completa del servicio de cola de trabajos asíncronos
 * para DECODEX Bolivia, incluyendo payloads, configuraciones, resultados
 * y estadísticas.
 *
 * Tipos de trabajo soportados:
 * - `captura`: Captura de contenido de medios (noticias, redes sociales).
 * - `analisis_batch`: Análisis por lotes de artículos o contenidos capturados.
 * - `generacion_boletin`: Generación automática de boletines informativos.
 * - `verificacion_enlaces`: Verificación de enlaces y URLs referenciadas.
 *
 * @team Equipo A - DECODEX Bolivia
 * @module_id A5
 */

// ─────────────────────────────────────────────────────────────────────────────
// Tipos de Trabajo y Estado
// ─────────────────────────────────────────────────────────────────────────────

/** Tipos de trabajo soportados por la cola */
export type JobType = 'captura' | 'analisis_batch' | 'generacion_boletin' | 'verificacion_enlaces';

/** Estado del trabajo en su ciclo de vida */
export type JobStatus = 'pending' | 'active' | 'completed' | 'failed' | 'cancelled';

// ─────────────────────────────────────────────────────────────────────────────
// Payloads y Configuración
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Payload base para encolar un trabajo.
 *
 * @example
 * ```typescript
 * const payload: JobPayload = {
 *   type: 'captura',
 *   data: { url: 'https://example.com/noticia', medioId: 'med-001' },
 *   priority: 8,
 *   scheduledAt: '2025-07-15T08:00:00.000Z',
 * };
 * ```
 */
export interface JobPayload {
  /** Tipo de trabajo a ejecutar */
  type: JobType;
  /** Datos específicos del trabajo */
  data: Record<string, unknown>;
  /** Prioridad del trabajo (0-10, default 5). Mayor valor = mayor prioridad. */
  priority?: number;
  /** Fecha/hora de ejecución diferida en formato ISO 8601 */
  scheduledAt?: string;
}

/**
 * Configuración de ejecución por tipo de trabajo.
 * Define timeouts, concurrencia y políticas de reintentos.
 */
export interface JobTypeConfig {
  /** Tiempo máximo de ejecución en milisegundos */
  timeout: number;
  /** Número máximo de trabajos simultáneos para este tipo */
  concurrency: number;
  /** Número máximo de reintentos tras fallo */
  retryLimit: number;
  /** Retraso base entre reintentos en milisegundos */
  retryDelay: number;
  /** Si true, aplica backoff exponencial: delay * 2^(attempt-1) */
  retryBackoff: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Resultados
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resultado completo de un trabajo, incluyendo su historial de ejecución.
 */
export interface JobResult {
  /** Identificador único del trabajo */
  jobId: string;
  /** Estado actual del trabajo */
  status: JobStatus;
  /** Tipo de trabajo */
  type: JobType;
  /** Fecha/hora de creación (ISO 8601) */
  createdAt: string;
  /** Fecha/hora de inicio de ejecución (ISO 8601) */
  startedAt?: string;
  /** Fecha/hora de finalización (ISO 8601) */
  completedAt?: string;
  /** Número de intentos de ejecución realizados */
  attempts: number;
  /** Datos de resultado (si completado exitosamente) */
  result?: Record<string, unknown>;
  /** Mensaje de error (si fallido) */
  error?: string;
}

/**
 * Trabajo encolado — resultado inmediato de `enqueueJob`.
 */
export interface EnqueuedJob {
  /** Identificador único del trabajo */
  jobId: string;
  /** Tipo de trabajo */
  type: JobType;
  /** Estado inicial siempre es 'pending' */
  status: 'pending';
  /** Fecha/hora programada (si fue programado) */
  scheduledAt?: string;
  /** Fecha/hora de creación (ISO 8601) */
  createdAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Estadísticas
// ─────────────────────────────────────────────────────────────────────────────

/** Contadores por tipo de trabajo */
export interface JobTypeStats {
  pending: number;
  active: number;
  completed: number;
  failed: number;
}

/**
 * Estadísticas globales y por tipo de la cola de trabajos.
 */
export interface QueueStats {
  /** Trabajos pendientes */
  pending: number;
  /** Trabajos en ejecución */
  active: number;
  /** Trabajos completados */
  completed: number;
  /** Trabajos fallidos */
  failed: number;
  /** Desglose por tipo de trabajo */
  byType: Record<JobType, JobTypeStats>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Handlers y Funciones
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Función handler que procesa un trabajo.
 * Recibe el payload y retorna un resultado.
 *
 * @typeParam T - Tipo del payload (default: Record<string, unknown>)
 * @param payload - Datos del trabajo a procesar
 * @returns Promesa con el resultado del procesamiento
 *
 * @example
 * ```typescript
 * const handler: JobHandler<{ url: string }> = async (payload) => {
 *   const response = await fetch(payload.url);
 *   return { statusCode: response.status, ok: response.ok };
 * };
 * ```
 */
export type JobHandler<T = Record<string, unknown>> = (
  payload: T,
) => Promise<Record<string, unknown>>;

// ─────────────────────────────────────────────────────────────────────────────
// Configuración y Estado del Servicio
// ─────────────────────────────────────────────────────────────────────────────

/** Proveedor de cola */
export type QueueProvider = 'pg-boss' | 'mock';

/**
 * Estado actual del servicio de cola.
 */
export interface QueueServiceStatus {
  /** Si la configuración fue cargada correctamente */
  configured: boolean;
  /** Proveedor activo (pg-boss o mock) */
  provider: QueueProvider;
  /** Si está conectado al proveedor */
  connected: boolean;
  /** URL de base de datos (enmascarada) */
  databaseUrl: string;
}

/**
 * Configuración de conexión para el servicio de cola.
 */
export interface QueueConfig {
  /** URL de conexión a PostgreSQL (formato postgresql://...) */
  databaseUrl: string;
  /** Schema de PostgreSQL para las tablas de pg-boss (default: 'boss') */
  schema?: string;
  /** Nombre de la aplicación para identificación en pg-boss */
  application?: string;
}
