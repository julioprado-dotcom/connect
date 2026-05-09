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

export const FRECUENCIA_BASE_POR_CATEGORIA: Record<string, string> = {
  // Nivel 1 — Nacionales corporativos
  corporativo: '1h',
  // Nivel 1 — Oficiales (gobierno, indicadores)
  oficial: '1d',
  // Nivel 2 — Regionales
  regional: '4h',
  // Nivel 3 — Alternativos/independientes
  alternativo: '1d',
  // Nivel 4 — Redes sociales
  red_social: '1h',
}

// ── Frecuencias base por medio especifico (override de categoria) ──────

export const FRECUENCIA_BASE_POR_MEDIO: Record<string, string> = {
  // Nivel 1 — Top 5 con 4x/dia
  'la-razon.com': '1h',
  'eldeber.com.bo': '1h',
  'lostiempos.com': '1h',
  'rtpbolivia.com.bo': '1h',
  'abi.bo': '1h',

  // TV principales — 2x/dia
  'unitel.bo': '4h',
  'reduno.tv': '4h',
  'atb.com.bo': '1h',

  // Fuentes oficiales lentas — 1x/semana
  'tribunal sup electoral': '1w',
  'contraloria': '1w',
  'tribunal constitucional': '1w',

  // Indicadores — 1x/dia
  'bcb': '1d',
}

// ── Horarios por defecto (sin datos de histograma) ─────────────────────

export const HORARIOS_DEFAULT: Record<string, number[]> = {
  'la-razon.com': [7, 8, 10, 11],
  'eldeber.com.bo': [7, 8, 10, 11],
  'lostiempos.com': [7, 8, 10, 11],
  'rtpbolivia.com.bo': [7, 8, 10, 11],
  'abi.bo': [8, 9, 15, 16],
  'unitel.bo': [7, 14],
  'reduno.tv': [7, 14],
  'atb.com.bo': [7, 10, 14, 17],
  'bcb': [9],
}

export const HORARIOS_CONFIG_DEFAULT: HorariosConfig = {
  numChequeos: 2,
  separacionMinima: 3,
  ventanaInicio: 6,
  ventanaFin: 22,
}

// ── Horarios de boletines ONION200 ─────────────────────────────────────

export const BOLETINES_SCHEDULE: BoletinSchedule[] = [
  { hora: 7,  minuto: 0, tipo: 'EL_TERMOMETRO',    prioridad: 3 },
  { hora: 19, minuto: 0, tipo: 'SALDO_DEL_DIA',     prioridad: 3 },
  { hora: 9,  minuto: 0, tipo: 'EL_FOCO',           prioridad: 5 },
  { hora: 8,  minuto: 0, tipo: 'EL_RADAR',          prioridad: 5 },
  { hora: 10, minuto: 0, tipo: 'EL_ESPECIALIZADO',  prioridad: 5 },
]

// ── Configuracion del Worker ───────────────────────────────────────────

export const WORKER_CONFIG = {
  delayMs: 2000,            // backpressure: espera entre jobs
  pollIntervalMs: 5000,     // intervalo si no hay jobs pendientes
  errorBackoffMs: 10000,    // espera si hay error del sistema
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
