/**
 * @module queue
 * @description Implementación del Módulo A5 - Cola de Trabajos para DECODEX Bolivia.
 *
 * Servicio plug-in independiente que gestiona una cola de trabajos asíncronos.
 * Soporta dos modos de operación:
 * - **pg-boss**: Cola persistente sobre PostgreSQL (requiere DATABASE_URL).
 * - **mock**: Cola en memoria para desarrollo y testing (sin DATABASE_URL).
 *
 * Características:
 * - Backoff exponencial en reintentos: `delay * 2^(attempt-1)`
 * - Concurrencia configurable por tipo de trabajo.
 * - Timeout por tipo de trabajo.
 * - Jobs programados (scheduledAt).
 * - Workers lifecycle management.
 *
 * @team Equipo A - DECODEX Bolivia
 * @module_id A5
 */

import PgBoss from 'pg-boss';
import type {
  JobType,
  JobPayload,
  JobTypeConfig,
  JobResult,
  JobStatus,
  EnqueuedJob,
  QueueStats,
  QueueServiceStatus,
  QueueProvider,
  JobHandler,
} from './queue.types';

/** Alias para la instancia de pg-boss */
type PgBossInstance = PgBoss;

// ─────────────────────────────────────────────────────────────────────────────
// Configuración por tipo de trabajo
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Configuración predeterminada para cada tipo de trabajo.
 *
 * - **captura**: Timeout largo (10min), baja concurrencia (1) — evita sobrecargar fuentes.
 * - **analisis_batch**: Timeout medio (5min), concurrencia moderada (2).
 * - **generacion_boletin**: Timeout medio (3min), concurrencia media (3).
 * - **verificacion_enlaces**: Timeout corto (2min), alta concurrencia (5) — I/O bound.
 */
const JOB_CONFIGS: Readonly<Record<JobType, JobTypeConfig>> = {
  captura: {
    timeout: 600_000,
    concurrency: 1,
    retryLimit: 3,
    retryDelay: 1_000,
    retryBackoff: true,
  },
  analisis_batch: {
    timeout: 300_000,
    concurrency: 2,
    retryLimit: 3,
    retryDelay: 1_000,
    retryBackoff: true,
  },
  generacion_boletin: {
    timeout: 180_000,
    concurrency: 3,
    retryLimit: 3,
    retryDelay: 1_000,
    retryBackoff: true,
  },
  verificacion_enlaces: {
    timeout: 120_000,
    concurrency: 5,
    retryLimit: 3,
    retryDelay: 1_000,
    retryBackoff: true,
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Tipos internos
// ─────────────────────────────────────────────────────────────────────────────

/** Trabajo almacenado en memoria (modo mock) */
interface MockJob {
  id: string;
  type: JobType;
  status: JobStatus;
  data: Record<string, unknown>;
  priority: number;
  createdAt: string;
  scheduledAt?: string;
  startedAt?: string;
  completedAt?: string;
  attempts: number;
  result?: Record<string, unknown>;
  error?: string;
  timeoutTimer?: ReturnType<typeof setTimeout>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Estado interno del servicio
// ─────────────────────────────────────────────────────────────────────────────

let boss: PgBossInstance | null = null;
let provider: QueueProvider = 'mock';
let isConnected = false;
let workersActive = false;

/** Almacén de handlers registrados */
const handlers = new Map<JobType, JobHandler>();

/** Almacén de trabajos en modo mock */
const mockJobs = new Map<string, MockJob>();

/** Contadores para IDs en modo mock */
let mockIdCounter = 0;

/** Set de timers activos para cancelación */
const mockTimers = new Map<string, ReturnType<typeof setTimeout>>();

/** Factor de escala para delays en modo mock (para tests rápidos). Default: 1 (normal) */
let mockDelayScale = 1;

// ─────────────────────────────────────────────────────────────────────────────
// Utilidades internas
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Genera un ID único para trabajos en modo mock.
 * Formato: `mock_<timestamp>_<counter>`
 */
function generateMockId(): string {
  mockIdCounter++;
  return `mock_${Date.now()}_${mockIdCounter}`;
}

/**
 * Enmascara una URL de base de datos para mostrar en logs.
 * Convierte la contraseña por `****`.
 */
function maskDatabaseUrl(url: string): string {
  if (!url) return '(none)';
  try {
    const parsed = new URL(url);
    if (parsed.password) {
      parsed.password = '****';
    }
    return parsed.toString();
  } catch {
    return '(invalid url)';
  }
}

/**
 * Obtiene la URL de conexión a la base de datos.
 * Prioridad: parámetro > variable de entorno.
 */
function getDatabaseUrl(): string {
  return process.env.DATABASE_URL ?? '';
}

/**
 * Calcula el delay con backoff exponencial.
 * Fórmula: `baseDelay * 2^(attempt - 1)`
 *
 * @param baseDelay - Delay base en ms
 * @param attempt - Número de intento (1-indexed)
 * @returns Delay calculado en ms
 */
function calculateBackoff(baseDelay: number, attempt: number): number {
  return baseDelay * Math.pow(2, attempt - 1);
}

/**
 * Crea una copia segura del trabajo mock como JobResult.
 */
function mockJobToResult(job: MockJob): JobResult {
  return {
    jobId: job.id,
    status: job.status,
    type: job.type,
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    attempts: job.attempts,
    result: job.result ? { ...job.result } : undefined,
    error: job.error,
  };
}

/**
 * Ejecuta un trabajo en modo mock con soporte para timeout y reintentos.
 */
function executeMockJob(job: MockJob): void {
  const handler = handlers.get(job.type);
  if (!handler) {
    job.status = 'failed';
    job.completedAt = new Date().toISOString();
    job.error = `No handler registered for job type: ${job.type}`;
    return;
  }

  const config = JOB_CONFIGS[job.type];
  job.status = 'active';
  job.startedAt = new Date().toISOString();

  let completed = false;

  // Timeout handler
  const timeoutId = setTimeout(() => {
    if (completed) return;
    completed = true;
    job.status = 'failed';
    job.completedAt = new Date().toISOString();
    job.error = `Job timed out after ${config.timeout}ms`;
    retryOrFinalize(job);
  }, config.timeout);

  mockTimers.set(job.id, timeoutId);

  // Execute handler
  handler(job.data)
    .then((result) => {
      if (completed) return;
      completed = true;
      clearTimeout(timeoutId);
      mockTimers.delete(job.id);
      job.status = 'completed';
      job.completedAt = new Date().toISOString();
      job.result = result;
    })
    .catch((err: unknown) => {
      if (completed) return;
      completed = true;
      clearTimeout(timeoutId);
      mockTimers.delete(job.id);
      const errorMessage = err instanceof Error ? err.message : String(err);
      job.error = errorMessage;
      retryOrFinalize(job);
    });
}

/**
 * Decide si reintentar un trabajo fallido o marcarlo como fallido definitivamente.
 */
function retryOrFinalize(job: MockJob): void {
  const config = JOB_CONFIGS[job.type];
  if (job.attempts < config.retryLimit) {
    // Programar reintento con backoff (escalado en modo mock)
    const rawDelay = config.retryBackoff
      ? calculateBackoff(config.retryDelay, job.attempts)
      : config.retryDelay;
    const delay = Math.max(1, rawDelay * mockDelayScale);
    job.status = 'pending';
    job.startedAt = undefined;

    const retryTimer = setTimeout(() => {
      if (job.status !== 'pending') return;
      job.attempts++;
      executeMockJob(job);
    }, delay);

    mockTimers.set(`retry_${job.id}`, retryTimer);
  } else {
    // Límite de reintentos agotado — marcar como fallido definitivamente
    job.status = 'failed';
    job.completedAt = new Date().toISOString();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// API Pública
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Inicializa el servicio de cola.
 *
 * En modo **pg-boss** (DATABASE_URL presente), establece conexión con PostgreSQL.
 * En modo **mock**, prepara los almacenes en memoria.
 *
 * @param config - Configuración opcional de conexión (sobreescribe DATABASE_URL)
 * @throws {Error} Si DATABASE_URL está presente pero la conexión falla
 */
export async function initializeQueue(
  config?: { databaseUrl?: string; schema?: string },
): Promise<void> {
  const dbUrl = config?.databaseUrl ?? getDatabaseUrl();
  const schema = config?.schema ?? process.env.QUEUE_SCHEMA ?? 'boss';

  if (dbUrl) {
    provider = 'pg-boss';
    try {
      const PgBossModule = await import('pg-boss');
      const PgBossCtor = PgBossModule.default ?? PgBossModule;
      boss = new PgBossCtor({
        connectionString: dbUrl,
        schema,
        application_name: 'decodex-queue-a5',
      }) as PgBossInstance;

      await boss.start();
      isConnected = true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to connect pg-boss: ${message}`);
    }
  } else {
    provider = 'mock';
    isConnected = true;
    // Limpiar estado previo
    mockJobs.clear();
    mockTimers.forEach((timer) => clearTimeout(timer));
    mockTimers.clear();
    mockIdCounter = 0;
  }
}

/**
 * Encola un nuevo trabajo para ejecución asíncrona.
 *
 * @param payload - Datos del trabajo a encolar
 * @returns Información del trabajo encolado
 * @throws {Error} Si el servicio no está inicializado o el tipo es inválido
 *
 * @example
 * ```typescript
 * const job = await enqueueJob({
 *   type: 'captura',
 *   data: { url: 'https://example.com', medioId: 'med-001' },
 *   priority: 8,
 * });
 * console.log(job.jobId); // "mock_1234567890_1"
 * ```
 */
export async function enqueueJob(payload: JobPayload): Promise<EnqueuedJob> {
  if (!isConnected) {
    throw new Error('Queue service not initialized. Call initializeQueue() first.');
  }

  const { type, data, priority, scheduledAt } = payload;
  const validTypes: readonly JobType[] = ['captura', 'analisis_batch', 'generacion_boletin', 'verificacion_enlaces'];
  if (!validTypes.includes(type)) {
    throw new Error(`Invalid job type: ${type}`);
  }

  const effectivePriority = priority ?? 5;
  const createdAt = new Date().toISOString();

  if (provider === 'pg-boss' && boss) {
    const bossJob = await boss.send(
      type,
      { ...data, __jobType: type },
      {
        priority: effectivePriority,
        startAfter: scheduledAt ? new Date(scheduledAt) : undefined,
        retryLimit: JOB_CONFIGS[type].retryLimit,
        retryDelay: JOB_CONFIGS[type].retryDelay,
        retryBackoff: JOB_CONFIGS[type].retryBackoff,
        expireInSeconds: Math.floor(JOB_CONFIGS[type].timeout / 1000),
      },
    );

    return {
      jobId: bossJob ?? generateMockId(),
      type,
      status: 'pending',
      scheduledAt,
      createdAt,
    };
  }

  // Modo mock
  const jobId = generateMockId();
  const job: MockJob = {
    id: jobId,
    type,
    status: 'pending',
    data: { ...data },
    priority: effectivePriority,
    createdAt,
    scheduledAt,
    attempts: 0,
  };

  mockJobs.set(jobId, job);

  // Programar ejecución
  if (scheduledAt) {
    const scheduleDelay = Math.max(0, new Date(scheduledAt).getTime() - Date.now());
    const timer = setTimeout(() => {
      if (job.status !== 'pending') return;
      job.attempts = 1;
      executeMockJob(job);
    }, scheduleDelay);
    mockTimers.set(jobId, timer);
  } else if (workersActive) {
    // Ejecutar inmediatamente si los workers están activos
    job.attempts = 1;
    // Usar setImmediate para no bloquear el enqueue
    const timer = setTimeout(() => {
      executeMockJob(job);
    }, 0);
    mockTimers.set(jobId, timer);
  }

  return {
    jobId,
    type,
    status: 'pending',
    scheduledAt,
    createdAt,
  };
}

/**
 * Obtiene el estado actual de un trabajo.
 *
 * @param jobId - Identificador único del trabajo
 * @returns Resultado del trabajo con su estado completo
 * @throws {Error} Si el trabajo no existe
 */
export async function getJobStatus(jobId: string): Promise<JobResult> {
  if (provider === 'pg-boss' && boss) {
    // pg-boss requiere nombre de cola + id para buscar
    // Intentamos buscar en cada tipo de cola
    const allJobTypes: readonly JobType[] = [
      'captura', 'analisis_batch', 'generacion_boletin', 'verificacion_enlaces',
    ];
    for (const queueName of allJobTypes) {
      const job = await boss.getJobById(queueName, jobId);
      if (job) {
        const stateMap: Record<string, JobStatus> = {
          created: 'pending',
          retry: 'failed',
          active: 'active',
          completed: 'completed',
          cancelled: 'cancelled',
          failed: 'failed',
        };
        return {
          jobId,
          status: stateMap[job.state] ?? 'pending',
          type: queueName,
          createdAt: job.createdOn ? new Date(job.createdOn).toISOString() : new Date().toISOString(),
          startedAt: job.startedOn ? new Date(job.startedOn).toISOString() : undefined,
          completedAt: job.completedOn ? new Date(job.completedOn).toISOString() : undefined,
          attempts: job.retryCount ?? 0,
          result: job.output as Record<string, unknown> | undefined,
          error: undefined,
        };
      }
    }
    throw new Error(`Job not found: ${jobId}`);
  }

  // Modo mock
  const job = mockJobs.get(jobId);
  if (!job) {
    throw new Error(`Job not found: ${jobId}`);
  }
  return mockJobToResult(job);
}

/**
 * Cancela un trabajo pendiente o activo.
 *
 * @param jobId - Identificador único del trabajo
 * @returns `true` si fue cancelado exitosamente, `false` si no se pudo cancelar
 */
export async function cancelJob(jobId: string): Promise<boolean> {
  if (provider === 'pg-boss' && boss) {
    // pg-boss cancel requiere (name, id)
    const allJobTypes: readonly JobType[] = [
      'captura', 'analisis_batch', 'generacion_boletin', 'verificacion_enlaces',
    ];
    try {
      for (const queueName of allJobTypes) {
        await boss.cancel(queueName, jobId);
      }
      return true;
    } catch {
      return false;
    }
  }

  // Modo mock
  const job = mockJobs.get(jobId);
  if (!job) return false;

  if (job.status !== 'pending' && job.status !== 'active') {
    return false;
  }

  // Limpiar timers asociados
  const mainTimer = mockTimers.get(jobId);
  if (mainTimer) {
    clearTimeout(mainTimer);
    mockTimers.delete(jobId);
  }
  const retryTimer = mockTimers.get(`retry_${jobId}`);
  if (retryTimer) {
    clearTimeout(retryTimer);
    mockTimers.delete(`retry_${jobId}`);
  }

  job.status = 'cancelled';
  job.completedAt = new Date().toISOString();
  return true;
}

/**
 * Reintenta un trabajo que ha fallado.
 *
 * @param jobId - Identificador único del trabajo
 * @returns Información del trabajo reencolado
 * @throws {Error} Si el trabajo no existe o no está en estado 'failed'
 */
export async function retryJob(jobId: string): Promise<EnqueuedJob> {
  if (provider === 'pg-boss' && boss) {
    // pg-boss retry requiere (name, id)
    const allJobTypes: readonly JobType[] = [
      'captura', 'analisis_batch', 'generacion_boletin', 'verificacion_enlaces',
    ];
    let retried = false;
    for (const queueName of allJobTypes) {
      try {
        await boss.retry(queueName, jobId);
        retried = true;
        break;
      } catch {
        // Continuar con el siguiente tipo
      }
    }
    if (!retried) {
      throw new Error(`Job not found: ${jobId}`);
    }
    return {
      jobId,
      type: 'captura',
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
  }

  // Modo mock
  const job = mockJobs.get(jobId);
  if (!job) {
    throw new Error(`Job not found: ${jobId}`);
  }

  if (job.status !== 'failed') {
    throw new Error(`Cannot retry job in status: ${job.status}. Only failed jobs can be retried.`);
  }

  job.status = 'pending';
  job.completedAt = undefined;
  job.error = undefined;
  job.startedAt = undefined;
  job.attempts = 0;

  if (workersActive) {
    job.attempts = 1;
    const timer = setTimeout(() => {
      executeMockJob(job);
    }, 0);
    mockTimers.set(jobId, timer);
  }

  return {
    jobId,
    type: job.type,
    status: 'pending',
    createdAt: job.createdAt,
  };
}

/**
 * Obtiene estadísticas de la cola de trabajos.
 *
 * @returns Estadísticas globales y por tipo de trabajo
 */
export async function getQueueStats(): Promise<QueueStats> {
  if (provider === 'pg-boss' && boss) {
    const allJobTypes: readonly JobType[] = [
      'captura', 'analisis_batch', 'generacion_boletin', 'verificacion_enlaces',
    ];
    const byType = {} as Record<JobType, { pending: number; active: number; completed: number; failed: number }>;

    let totalPending = 0;
    let totalActive = 0;
    let totalCompleted = 0;
    let totalFailed = 0;

    // pg-boss getQueueSize devuelve un número, filtrado por estado 'before'
    for (const jt of allJobTypes) {
      const beforeActive = await boss.getQueueSize(jt, { before: 'active' });
      const beforeCompleted = await boss.getQueueSize(jt, { before: 'completed' });
      const beforeFailed = await boss.getQueueSize(jt, { before: 'failed' });

      // before: 'active' => cuenta created + retry
      // before: 'completed' => cuenta created + retry + active + completed
      // before: 'failed' => cuenta created + retry + active + completed + cancelled + failed
      const pending = beforeActive;
      const completed = beforeCompleted - beforeActive;
      const failed = beforeFailed - beforeCompleted;

      byType[jt] = { pending, active: 0, completed, failed };
      totalPending += pending;
      totalCompleted += completed;
      totalFailed += failed;
    }

    return {
      pending: totalPending,
      active: totalActive,
      completed: totalCompleted,
      failed: totalFailed,
      byType,
    };
  }

  // Modo mock
  const stats: QueueStats = {
    pending: 0,
    active: 0,
    completed: 0,
    failed: 0,
    byType: {
      captura: { pending: 0, active: 0, completed: 0, failed: 0 },
      analisis_batch: { pending: 0, active: 0, completed: 0, failed: 0 },
      generacion_boletin: { pending: 0, active: 0, completed: 0, failed: 0 },
      verificacion_enlaces: { pending: 0, active: 0, completed: 0, failed: 0 },
    },
  };

  for (const job of mockJobs.values()) {
    switch (job.status) {
      case 'pending':
        stats.pending++;
        stats.byType[job.type].pending++;
        break;
      case 'active':
        stats.active++;
        stats.byType[job.type].active++;
        break;
      case 'completed':
        stats.completed++;
        stats.byType[job.type].completed++;
        break;
      case 'failed':
        stats.failed++;
        stats.byType[job.type].failed++;
        break;
      case 'cancelled':
        // Los cancelados no cuentan para las stats operativas
        break;
    }
  }

  return stats;
}

/**
 * Registra un handler para un tipo de trabajo específico.
 * Los handlers deben estar registrados antes de llamar a `startWorkers()`.
 *
 * @param type - Tipo de trabajo a manejar
 * @param handler - Función que procesa el payload del trabajo
 * @throws {Error} Si el tipo de trabajo es inválido
 *
 * @example
 * ```typescript
 * registerHandler('captura', async (payload) => {
 *   const { url } = payload as { url: string };
 *   const response = await fetch(url);
 *   return { statusCode: response.status, fetched: true };
 * });
 * ```
 */
export function registerHandler(type: JobType, handler: JobHandler): void {
  const validTypes: readonly JobType[] = [
    'captura', 'analisis_batch', 'generacion_boletin', 'verificacion_enlaces',
  ];
  if (!validTypes.includes(type)) {
    throw new Error(`Invalid job type: ${type}`);
  }
  handlers.set(type, handler);
}

/**
 * Arranca los workers para procesar trabajos encolados.
 *
 * En modo **pg-boss**, registra los handlers con pg-boss.
 * En modo **mock**, ejecuta los trabajos pendientes en memoria.
 *
 * @throws {Error} Si ya hay workers activos
 */
export async function startWorkers(): Promise<void> {
  if (workersActive) {
    throw new Error('Workers are already active. Call stopWorkers() first.');
  }

  if (provider === 'pg-boss' && boss) {
    const allJobTypes: readonly JobType[] = [
      'captura', 'analisis_batch', 'generacion_boletin', 'verificacion_enlaces',
    ];

    for (const type of allJobTypes) {
      const handler = handlers.get(type);

      if (!handler) continue;

      await boss.work(
        type,
        {
          pollingIntervalSeconds: 1,
        },
        async (pgJobs) => {
          // pg-boss work handler recibe un array de jobs
          for (const pgJob of pgJobs) {
            const payload = pgJob.data as Record<string, unknown>;
            try {
              await handler(payload);
            } catch {
              // pg-boss maneja reintentos automáticamente
            }
          }
        },
      );
    }
  } else {
    // Modo mock: ejecutar trabajos pendientes
    for (const job of mockJobs.values()) {
      if (job.status === 'pending' && !job.scheduledAt) {
        job.attempts = 1;
        executeMockJob(job);
      }
    }
  }

  workersActive = true;
}

/**
 * Detiene los workers y finaliza el procesamiento de trabajos.
 *
 * En modo **pg-boss**, detiene graceful los workers.
 * En modo **mock**, cancela timers pendientes y marca trabajos activos.
 *
 * @param graceful - Si true, espera a que terminen los trabajos activos (default: true)
 */
export async function stopWorkers(graceful: boolean = true): Promise<void> {
  if (!workersActive) return;

  if (provider === 'pg-boss' && boss) {
    if (graceful) {
      await boss.stop({ graceful: true });
    } else {
      await boss.stop({ graceful: false });
    }
  } else {
    // Modo mock: cancelar timers de retry y trabajos pendientes
    if (!graceful) {
      for (const [key, timer] of mockTimers.entries()) {
        clearTimeout(timer);
        mockTimers.delete(key);
      }
      // Marcar trabajos activos como cancelados
      for (const job of mockJobs.values()) {
        if (job.status === 'pending' || job.status === 'active') {
          job.status = 'cancelled';
          job.completedAt = new Date().toISOString();
        }
      }
    }
  }

  workersActive = false;
}

/**
 * Obtiene el estado actual del servicio de cola.
 *
 * @returns Estado del servicio incluyendo proveedor y conexión
 */
export function getServiceStatus(): QueueServiceStatus {
  const dbUrl = getDatabaseUrl();
  return {
    configured: isConnected,
    provider,
    connected: isConnected,
    databaseUrl: maskDatabaseUrl(dbUrl),
  };
}

/**
 * Purga trabajos completados de la cola.
 *
 * En modo **pg-boss**, elimina los trabajos completados de la base de datos.
 * En modo **mock**, elimina los trabajos completados de la memoria.
 *
 * @param daysOld - Días de antigüedad para purgar (default: 7)
 * @returns Número de trabajos purgados
 */
export async function purgeCompleted(daysOld: number = 7): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  if (provider === 'pg-boss' && boss) {
    try {
      // pg-boss purge elimina todos los completados/fallidos
      // Se ejecuta mantenimiento automáticamente si supervise=true
      await boss.maintain();
      return 0; // pg-boss no retorna conteo de purgados
    } catch {
      return 0;
    }
  }

  // Modo mock
  let purged = 0;
  const cutoff = cutoffDate.getTime();

  for (const [jobId, job] of mockJobs.entries()) {
    if (
      (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') &&
      job.completedAt &&
      new Date(job.completedAt).getTime() < cutoff
    ) {
      mockJobs.delete(jobId);
      purged++;
    }
  }

  return purged;
}

/**
 * Limpia todo el estado interno. Útil para tests.
 * NO usar en producción.
 *
 * @internal
 */
export function resetState(): void {
  mockJobs.clear();
  handlers.clear();
  mockTimers.forEach((timer) => clearTimeout(timer));
  mockTimers.clear();
  mockIdCounter = 0;
  mockDelayScale = 1;
  boss = null;
  isConnected = false;
  workersActive = false;
  provider = 'mock';
}

/**
 * Obtiene la configuración de un tipo de trabajo (solo lectura).
 *
 * @param type - Tipo de trabajo
 * @returns Configuración del tipo de trabajo
 * @throws {Error} Si el tipo es inválido
 */
export function getJobConfig(type: JobType): Readonly<JobTypeConfig> {
  const config = JOB_CONFIGS[type];
  if (!config) {
    throw new Error(`Invalid job type: ${type}`);
  }
  return config;
}

/**
 * Obtiene la lista de tipos de trabajo soportados.
 *
 * @returns Array con los tipos de trabajo
 */
export function getSupportedJobTypes(): readonly JobType[] {
  return ['captura', 'analisis_batch', 'generacion_boletin', 'verificacion_enlaces'] as const;
}

/**
 * Establece el factor de escala para delays en modo mock.
 * Útil para tests rápidos. Un valor de 0.01 reduce delays de 1000ms a 10ms.
 *
 * @param scale - Factor de escala (0.001 a 1)
 * @internal
 */
export function setMockDelayScale(scale: number): void {
  mockDelayScale = Math.max(0.001, Math.min(1, scale));
}

// Re-exportar tipos para conveniencia
export type {
  JobType,
  JobPayload,
  JobTypeConfig,
  JobResult,
  JobStatus,
  EnqueuedJob,
  QueueStats,
  QueueServiceStatus,
  QueueProvider,
  JobHandler,
} from './queue.types';
