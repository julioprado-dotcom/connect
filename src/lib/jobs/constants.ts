// ─── Constantes del sistema de Job Queue — DECODEX Bolivia ─────────────

import type {
  JobPrioridadLabel,
  FrecuenciaConfig,
  BoletinSchedule,
  HorariosConfig,
} from './types'

// ── Prioridades ────────────────────────────────────────────────────────

export const PRIORIDADES: JobPrioridadLabel[] = [
  { nivel: 'P0', prioridad: 0, color: '#dc2626', descripcion: 'Critico — Alerta Temprana' },
  { nivel: 'P1', prioridad: 1, color: '#ea580c', descripcion: 'Alta — Captura top sources' },
  { nivel: 'P2', prioridad: 3, color: '#d97706', descripcion: 'Media — Generacion de boletines' },
  { nivel: 'P3', prioridad: 5, color: '#2563eb', descripcion: 'Normal — Fuentes regulares' },
  { nivel: 'P4', prioridad: 7, color: '#4b5563', descripcion: 'Baja — Verificacion de enlaces' },
  { nivel: 'P5', prioridad: 9, color: '#9ca3af', descripcion: 'Mantenimiento — Limpieza' },
]

export const PRIORIDAD_MAP = Object.fromEntries(
  PRIORIDADES.map(p => [p.prioridad, p])
) as Record<number, JobPrioridadLabel>

// ── Frecuencias ────────────────────────────────────────────────────────

export const FRECUENCIAS: FrecuenciaConfig[] = [
  { key: '15m', label: 'Cada 15 min', minutos: 15, checksDia: 16 },
  { key: '30m', label: 'Cada 30 min', minutos: 30, checksDia: 8 },
  { key: '1h',  label: '1 hora',       minutos: 60, checksDia: 4 },
  { key: '2h',  label: '2 horas',      minutos: 120, checksDia: 3 },
  { key: '4h',  label: '4 horas',      minutos: 240, checksDia: 2 },
  { key: '6h',  label: '6 horas',      minutos: 360, checksDia: 2 },
  { key: '12h', label: '12 horas',     minutos: 720, checksDia: 1 },
  { key: '1d',  label: '1 vez al dia', minutos: 1440, checksDia: 1 },
  { key: '1w',  label: '1 vez por semana', minutos: 10080, checksDia: 0 },
]

export const FRECUENCIA_MAP = Object.fromEntries(
  FRECUENCIAS.map(f => [f.key, f])
) as Record<string, FrecuenciaConfig>

// Orden de degradacion: cada entrada degrada la anterior
export const DEGRADACION_CHAIN: string[] = [
  '15m', '30m', '1h', '2h', '4h', '6h', '12h', '1d', '1w',
]

// ── Frecuencias base por categoria de medio ────────────────────────────
// REGLA: frecuencia máxima = 2h (protege API LLM y VPS 2GB RAM)
// El autodescubrimiento (gap-detector) ajustará dinámicamente según publicación real

export const FRECUENCIA_BASE_POR_CATEGORIA: Record<string, string> = {
  // Nivel 1 — Nacionales corporativos: 2h (máximo permitido, publican 3-4x/día)
  corporativo: '2h',
  // Nivel 1 — Oficiales (gobierno, indicadores): 6h (publican 1-2x/día normalmente)
  oficial: '6h',
  // Nivel 2 — Regionales: 6h (actualizan 2-3x/día)
  regional: '6h',
  // Nivel 3 — Alternativos/independientes: 6h (publican 1-2x/día)
  alternativo: '6h',
  // Nivel 4 — Redes sociales: 6h (monitoreo constante pero no saturante)
  red_social: '6h',
}

// ── Autodescubrimiento: umbrales para ajuste automático de frecuencias ──

export const AUTODESCUBRIMIENTO_CONFIG = {
  /** Notas mínimas en historial para calcular frecuencia óptima (sin historial suficiente usa categoría) */
  minNotasParaAutoajuste: 10,
  /** Ventana de tiempo (horas) para analizar patrón de publicación */
  ventanaAnalisisHoras: 168, // 7 días
  /** Frecuencia mínima absoluta (nunca chequear más seguido) */
  frecuenciaMinima: '2h' as const,
  /** Frecuencia máxima absoluta (nunca esperar más que esto) */
  frecuenciaMaxima: '6h' as const,
  /** Factor de seguridad: si fuente publica cada X min, chequear cada X * factor */
  factorSeguridad: 0.7, // Si publica cada 100min, chequear cada 70min → redondea a 2h
  /** Umbral de desviación para justificar cambio de frecuencia (%) */
  umbralCambio: 30, // Cambiar solo si nueva frecuencia difiere >30% de la actual
}

// ── Frecuencias base por medio especifico (override de categoria) ──────

export const FRECUENCIA_BASE_POR_MEDIO: Record<string, string> = {
  // PRIORIDAD MAXIMA — Los Tiempos: 2h (máximo permitido, publica muy frecuentemente)
  'lostiempos.com': '2h',

  // Nivel 1 — Nacionales: 2h (publican 3-4x/día)
  'la-razon.com': '2h',
  'eldeber.com.bo': '2h',
  'rtpbolivia.com.bo': '2h',

  // ABI — Agencia Boliviana de Información: 2h (oficial pero publica constantemente)
  'abi.bo': '2h',

  // TV principales — 4h (contenido audiovisual, actualizan 2-3x/día)
  'unitel.bo': '4h',
  'reduno.tv': '4h',
  'atb.com.bo': '4h',

  // Fuentes oficiales lentas — 6h (SENASAG, IBCE, etc. publican poco)
  'tribunal sup electoral': '6h',
  'contraloria': '6h',
  'tribunal constitucional': '6h',
  'senasag': '6h',
  'ibce': '6h',

  // Indicadores — 6h (datos macroeconómicos se actualizan 1-2x/día)
  'bcb': '6h',
}

// ── Horarios por defecto (sin datos de histograma) ─────────────────────

export const HORARIOS_DEFAULT: Record<string, number[]> = {
  // Los Tiempos — 2h: 8 checks/día (06:00–21:00, ventana operativa)
  'lostiempos.com': [6, 8, 10, 12, 14, 16, 18, 20],
  // Nacionales 2h: 8 checks/día
  'la-razon.com': [6, 8, 10, 12, 14, 16, 18, 20],
  'eldeber.com.bo': [6, 8, 10, 12, 14, 16, 18, 20],
  'rtpbolivia.com.bo': [6, 8, 10, 12, 14, 16, 18, 20],
  // ABI 2h: 8 checks/día (oficial pero alta frecuencia de publicación)
  'abi.bo': [6, 8, 10, 12, 14, 16, 18, 20],
  // TV 4h: 4 checks/día
  'unitel.bo': [7, 11, 15, 19],
  'reduno.tv': [7, 11, 15, 19],
  'atb.com.bo': [7, 11, 15, 19],
  // Oficiales lentas / Indicadores 6h: 3 checks/día
  'tribunal sup electoral': [8, 14, 20],
  'contraloria': [8, 14, 20],
  'tribunal constitucional': [8, 14, 20],
  'senasag': [8, 14, 20],
  'ibce': [8, 14, 20],
  'bcb': [8, 14, 20],
}

export const HORARIOS_CONFIG_DEFAULT: HorariosConfig = {
  numChequeos: 2,
  separacionMinima: 3,
  ventanaInicio: 6,   // Inicio ventana operativa (06:00 AM)
  ventanaFin: 23,    // Último scrape 23:00 (después de noticieros nocturnos)
}

// ── Horarios de boletines ONION200 ─────────────────────────────────────

export const BOLETINES_SCHEDULE: BoletinSchedule[] = [
  // ── Diarios (lunes a viernes) ──
  { hora: 7,  minuto: 0, tipo: 'EL_TERMOMETRO',    prioridad: 3 },
  { hora: 19, minuto: 0, tipo: 'SALDO_DEL_DIA',     prioridad: 3 },
  { hora: 9,  minuto: 0, tipo: 'EL_FOCO',           prioridad: 5 },
  { hora: 10, minuto: 0, tipo: 'EL_ESPECIALIZADO',  prioridad: 5 },
  // ── Semanales (lunes únicamente) ──
  { hora: 8,  minuto: 0, tipo: 'EL_RADAR',          prioridad: 5, dias: '1' },
  { hora: 8,  minuto: 0, tipo: 'BOLETIN_DEL_GRANO', prioridad: 5, dias: '1' },
  { hora: 8,  minuto: 0, tipo: 'VOZ_Y_VOTO',        prioridad: 5, dias: '1' },
  { hora: 8,  minuto: 0, tipo: 'EL_HILO',           prioridad: 5, dias: '1' },
  { hora: 8,  minuto: 0, tipo: 'FOCO_DE_LA_SEMANA', prioridad: 5, dias: '1' },
  { hora: 10, minuto: 0, tipo: 'EL_INFORME_CERRADO', prioridad: 5, dias: '1' },
]

// ── Configuracion del Worker ───────────────────────────────────────────

export const WORKER_CONFIG = {
  delayMs: 5000,            // backpressure: espera entre jobs (aumentado de 2s)
  pollIntervalMs: 10000,    // intervalo si no hay jobs pendientes (aumentado de 5s)
  errorBackoffMs: 30000,    // espera si hay error del sistema (aumentado de 10s)
  delayScrapeMs: 15000,     // espera extra después de jobs pesados (scrape_fuente)
  delayGenerateMs: 8000,    // espera extra después de generar_boletin
  maxEventLoopLagMs: 500,   // si el event loop está más lento que esto, pausar el worker
}

// ── Configuracion de Arranque Diferido ──────────────────────────────────
// El servidor espera este tiempo antes de activar el scheduler y worker productivo.
// Permite que Next.js compile rutas, GC pase su primera pasada, y Container Guardian
// establezca baseline de memoria antes de que los jobs comiencen a consumir recursos.

export const WARMUP_CONFIG = {
  delayMs: 5_000,           // 5 segundos — reducido para evitar shell session timeout
}

// ── Configuracion del Container Guardian ──────────────────────────────

export const GUARDIAN_CONFIG = {
  intervalMs: 30000,          // cada 30 segundos (más agresivo que health 60s)
  watchPct: 60,               // 60% → INFO log periódico
  warnPct: 70,                // 70% → drop_caches + purge .next/dev
  criticalPct: 80,            // 80% → detener scheduler + purge agresivo
  emergencyPct: 85,           // 85% → detener worker + todo
  recoveryPct: 65,            // <65% → reiniciar scheduler + worker
  maxSnapshots: 20,           // historial de lecturas
  trendWindowMinutes: 5,      // ventana para calcular tendencia
  // Backup diferencial por dominio
  backupConfigIntervalHours: 6,     // CONFIG backup cada 6 horas
  backupOperacionalIntervalHours: 6,  // OPERACIONAL backup cada 6 horas
  backupCheckIntervalTicks: 720,     // verificar si toca backup cada 720 ticks (~6h a 30s/tick)
}

// ── Configuracion de Health Monitor ────────────────────────────────────

export const HEALTH_CONFIG = {
  intervalMs: 60000,        // cada 60 segundos
  warnPendingJobs: 50,
  warnFailed24h: 10,
  warnIdleMinutes: 30,      // sin jobs completados en este tiempo
  warnMemoryMb: 400,
  // Historial para stats
  statsWindowHours: 24,
}

// ── Configuracion de Check-First ───────────────────────────────────────

export const CHECK_FIRST_CONFIG = {
  timeoutMs: 10000,         // timeout para requests HTTP
  maxContentBytes: 512 * 1024, // 512 KB max para fingerprint
  rssMaxEntries: 50,        // max entries a parsear de RSS
  minTimeBetweenChecks: 30, // minutos entre checks de la misma fuente
  userAgent: 'DECODEX-Bot/1.0 (ONION200 Bolivia)',
  maxConcurrentChecks: 3,   // max check_fuente desde un solo batch request
}

// ── Configuracion de Flow Control ──────────────────────────────────
// Protecciones contra saturación del event loop

export const FLOW_CONTROL = {
  // Monitoreo del event loop
  eventLoopLagThresholdMs: 500,   // si el lag supera esto, pausar
  eventLoopCheckIntervalMs: 2000,  // cada cuánto medir el lag
  // Límites de concurrencia
  maxCheckFuenteBatch: 3,          // máx checks por batch (endpoint /api/jobs)
  maxScrapePending: 1,             // máx scrape_fuente en cola al mismo tiempo — UNO A LA VEZ
  captureEndpointCooldownMs: 180000, // cooldown de 3 min entre capturas
  // Protección de memoria (debe ser MENOR que PM2 max_memory_restart)
  // PM2 worker = 768M, flow control debe actuar mucho antes
  heapWarnMb: 300,                 // warn si heapUsed supera esto
  heapCriticalMb: 380,             // pausar worker si heapUsed supera esto (antes del OOM de PM2)
}

// ── Configuracion de Retries ───────────────────────────────────────────

export const RETRY_CONFIG = {
  maxIntentos: 3,
  baseDelayMs: 30000,       // 30 segundos
  maxDelayMs: 300000,       // 5 minutos
  multiplier: 2,            // backoff exponencial
}

// ── Limites de la cola ─────────────────────────────────────────────────

export const QUEUE_LIMITS = {
  maxPendingJobs: 100,      // pausar scheduler si se alcanza
  maxHeavyPending: 2,       // max scrape_fuente pendientes (jobs pesados) — breathing room para evitar deadlock
  maxBatchEnqueue: 5,       // max jobs por batch desde el endpoint de captura
  jobRetentionDays: 30,     // purgar jobs completados > 30 dias
  capturaLogRetentionDays: 90,
  mencionTextRetentionMonths: 6,
}

// ── Mantenimiento ──────────────────────────────────────────────────────

export const MANTENIMIENTO_SCHEDULE = {
  hora: 4,
  minuto: 0,
}

// ── Tipos de check por patron de URL ───────────────────────────────────

export const TIPO_CHECK_PATTERNS: { patron: RegExp; tipo: 'rss' | 'api' | 'head' }[] = [
  { patron: /\/feed\/?$/i,                   tipo: 'rss' },
  { patron: /\/rss\/?$/i,                    tipo: 'rss' },
  { patron: /\/atom\.xml$/i,                 tipo: 'rss' },
  { patron: /\/feed\.xml$/i,                 tipo: 'rss' },
  { patron: /\/rss\.xml$/i,                  tipo: 'rss' },
  { patron: /\/index\.xml$/i,                tipo: 'rss' },
  { patron: /\/api\//i,                      tipo: 'api' },
  { patron: /\.json$/i,                      tipo: 'api' },
]
