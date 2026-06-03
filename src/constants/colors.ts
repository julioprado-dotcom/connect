/**
 * DECODEX v0.12.0 — Paleta Centralizada de Colores
 * Motor ONION200 — Fuente única de verdad
 *
 * ═══════════════════════════════════════════════════════════════
 * SEMÁFORO UNIVERSAL — REGLAS FIRMES
 * ═══════════════════════════════════════════════════════════════
 *
 * Todo color de estado operativo DEBE usar STATUS_TOKENS.
 * Todo color de sentimiento DEBE usar SENTIMENT.
 * Todo color de tratamiento DEBE usar TRATAMIENTO.
 *
 * PROHIBIDO:
 * - Definir colores inline (#hex / rgba) para estados, sentimiento o tratamiento
 * - Crear funciones locales de color (estadoColor, getColor, colorMap, etc.)
 * - Usar violet (#8b5cf6) para error/offline — violet es EXCLUSIVamente analítico
 * - Usar cyan (#06b6d4) para "completado" — cyan es EXCLUSIVamente "en progreso"
 *
 * SEMÁFORO (3 niveles + 3 extendidos):
 * 🟢 ok/running/active/completado  → emerald (#10b981)
 * 🟡 warning/degraded/pending     → amber (#f59e0b)
 * 🔴 error/offline/failed/caida   → red (#ef4444)
 * 🔵 starting/iniciando           → blue (#3b82f6)
 * ⚪ idle/inactive/paused         → slate (#64748b)
 * 🟣 analítico (solo tratamiento) → violet (#8b5cf6) — NUNCA para error
 */

// ─── Tipo base ────────────────────────────────────────────────────

export interface ColorEntry {
  color: string      // color principal para texto/iconos
  bg: string        // fondo con baja opacidad
  border: string    // borde con media opacidad
  label: string     // etiqueta legible
}

// ═══════════════════════════════════════════════════════════════
// SEMÁFORO UNIVERSAL — STATUS_TOKENS
// Fuente única de verdad para TODOS los estados operativos
// ═══════════════════════════════════════════════════════════════

export const STATUS: Record<string, ColorEntry> = {
  // ── 🟢 Verde: todo bien ──
  ok: {
    color: '#10b981',                // emerald-500
    bg: 'rgba(16,185,129,0.08)',
    border: 'rgba(16,185,129,0.20)',
    label: 'OK',
  },
  running: {
    color: '#10b981',                // emerald-500
    bg: 'rgba(16,185,129,0.08)',
    border: 'rgba(16,185,129,0.20)',
    label: 'En ejecución',
  },
  active: {
    color: '#10b981',                // emerald-500
    bg: 'rgba(16,185,129,0.08)',
    border: 'rgba(16,185,129,0.20)',
    label: 'Activo',
  },
  completado: {
    color: '#10b981',                // emerald-500
    bg: 'rgba(16,185,129,0.08)',
    border: 'rgba(16,185,129,0.20)',
    label: 'Completado',
  },
  exitoso: {
    color: '#10b981',                // emerald-500
    bg: 'rgba(16,185,129,0.08)',
    border: 'rgba(16,185,129,0.20)',
    label: 'Exitoso',
  },
  entregado: {
    color: '#10b981',                // emerald-500
    bg: 'rgba(16,185,129,0.08)',
    border: 'rgba(16,185,129,0.20)',
    label: 'Entregado',
  },
  online: {
    color: '#10b981',                // emerald-500
    bg: 'rgba(16,185,129,0.08)',
    border: 'rgba(16,185,129,0.20)',
    label: 'En línea',
  },
  confiable: {
    color: '#10b981',                // emerald-500
    bg: 'rgba(16,185,129,0.08)',
    border: 'rgba(16,185,129,0.20)',
    label: 'Confiable',
  },
  activa: {
    color: '#10b981',                // emerald-500
    bg: 'rgba(16,185,129,0.08)',
    border: 'rgba(16,185,129,0.20)',
    label: 'Activa',
  },

  // ── 🟡 Amarillo: atención ──
  warning: {
    color: '#f59e0b',                // amber-500
    bg: 'rgba(245,158,11,0.08)',
    border: 'rgba(245,158,11,0.20)',
    label: 'Alerta',
  },
  degraded: {
    color: '#f59e0b',                // amber-500
    bg: 'rgba(245,158,11,0.08)',
    border: 'rgba(245,158,11,0.20)',
    label: 'Degradado',
  },
  pending: {
    color: '#f59e0b',                // amber-500
    bg: 'rgba(245,158,11,0.08)',
    border: 'rgba(245,158,11,0.20)',
    label: 'Pendiente',
  },
  pendiente: {
    color: '#f59e0b',                // amber-500
    bg: 'rgba(245,158,11,0.08)',
    border: 'rgba(245,158,11,0.20)',
    label: 'Pendiente',
  },
  degradada: {
    color: '#f59e0b',                // amber-500
    bg: 'rgba(245,158,11,0.08)',
    border: 'rgba(245,158,11,0.20)',
    label: 'Degradada',
  },
  inactiva: {
    color: '#f59e0b',                // amber-500 (fuente apagada, no error)
    bg: 'rgba(245,158,11,0.08)',
    border: 'rgba(245,158,11,0.20)',
    label: 'Inactiva',
  },

  // ── 🔴 Rojo: problema ──
  error: {
    color: '#ef4444',                // red-500
    bg: 'rgba(239,68,68,0.08)',
    border: 'rgba(239,68,68,0.20)',
    label: 'Error',
  },
  failed: {
    color: '#ef4444',                // red-500
    bg: 'rgba(239,68,68,0.08)',
    border: 'rgba(239,68,68,0.20)',
    label: 'Fallido',
  },
  fallido: {
    color: '#ef4444',                // red-500
    bg: 'rgba(239,68,68,0.08)',
    border: 'rgba(239,68,68,0.20)',
    label: 'Fallido',
  },
  offline: {
    color: '#ef4444',                // red-500
    bg: 'rgba(239,68,68,0.08)',
    border: 'rgba(239,68,68,0.20)',
    label: 'Desconectado',
  },
  caida: {
    color: '#ef4444',                // red-500
    bg: 'rgba(239,68,68,0.08)',
    border: 'rgba(239,68,68,0.20)',
    label: 'Caída',
  },
  critico: {
    color: '#ef4444',                // red-500
    bg: 'rgba(239,68,68,0.08)',
    border: 'rgba(239,68,68,0.20)',
    label: 'Crítico',
  },
  cancelado: {
    color: '#ef4444',                // red-500
    bg: 'rgba(239,68,68,0.08)',
    border: 'rgba(239,68,68,0.20)',
    label: 'Cancelado',
  },

  // ── 🔵 Azul: transición ──
  starting: {
    color: '#3b82f6',                // blue-500
    bg: 'rgba(59,130,246,0.08)',
    border: 'rgba(59,130,246,0.20)',
    label: 'Iniciando',
  },
  en_progreso: {
    color: '#3b82f6',                // blue-500 — se ejecuta pero no completó
    bg: 'rgba(59,130,246,0.08)',
    border: 'rgba(59,130,246,0.20)',
    label: 'En progreso',
  },
  en_proceso: {
    color: '#3b82f6',                // blue-500 — alias
    bg: 'rgba(59,130,246,0.08)',
    border: 'rgba(59,130,246,0.20)',
    label: 'En proceso',
  },
  inicializando: {
    color: '#3b82f6',                // blue-500
    bg: 'rgba(59,130,246,0.08)',
    border: 'rgba(59,130,246,0.20)',
    label: 'Inicializando',
  },

  // ── ⚪ Gris: inactivo/pausado ──
  idle: {
    color: '#64748b',                // slate-500
    bg: 'rgba(100,116,139,0.08)',
    border: 'rgba(100,116,139,0.15)',
    label: 'Inactivo',
  },
  paused: {
    color: '#64748b',                // slate-500
    bg: 'rgba(100,116,139,0.08)',
    border: 'rgba(100,116,139,0.15)',
    label: 'Pausado',
  },
  pausada: {
    color: '#64748b',                // slate-500
    bg: 'rgba(100,116,139,0.08)',
    border: 'rgba(100,116,139,0.15)',
    label: 'Pausada',
  },
  inactive: {
    color: '#64748b',                // slate-500
    bg: 'rgba(100,116,139,0.08)',
    border: 'rgba(100,116,139,0.15)',
    label: 'Inactivo',
  },
  unknown: {
    color: '#64748b',                // slate-500
    bg: 'rgba(100,116,139,0.08)',
    border: 'rgba(100,116,139,0.15)',
    label: 'Desconocido',
  },
  sin_estado: {
    color: '#475569',                // slate-600
    bg: 'rgba(71,85,105,0.06)',
    border: 'rgba(71,85,105,0.12)',
    label: 'Sin estado',
  },
}

// Helper: obtiene ColorEntry para un estado, con fallback a 'unknown'
export function statusToken(key: string): ColorEntry {
  return STATUS[key] ?? STATUS.unknown
}

// Helper: solo el color hex
export function statusColor(key: string): string {
  return STATUS[key]?.color ?? STATUS.unknown.color
}

// Helper: solo el fondo
export function statusBg(key: string): string {
  return STATUS[key]?.bg ?? STATUS.unknown.bg
}

// Helper: solo el borde
export function statusBorder(key: string): string {
  return STATUS[key]?.border ?? STATUS.unknown.border
}

// Helper: label legible
export function statusLabel(key: string): string {
  return STATUS[key]?.label ?? 'Desconocido'
}

// Helper: boxShadow glow (para dots y orbs)
export function statusGlow(key: string, size: number = 8): string {
  const color = statusColor(key)
  return `0 0 ${size}px ${color}80`
}

// Helper: mapea estados comunes a clave STATUS normalizada
export function normalizeStatus(raw: string): string {
  const s = (raw || '').toLowerCase().trim()
  const map: Record<string, string> = {
    // Verde
    'ok': 'ok', 'running': 'running', 'active': 'active', 'online': 'online',
    'completado': 'completado', 'exitoso': 'exitoso', 'entregado': 'entregado',
    'confiable': 'confiable', 'activa': 'activa', 'en_vivo': 'running',
    'alive': 'online', 'vivo': 'running', 'true': 'active',
    // Amarillo
    'warning': 'warning', 'warn': 'warning', 'degraded': 'degraded',
    'pending': 'pending', 'pendiente': 'pendiente', 'degradada': 'degradada',
    'inactiva': 'inactiva', 'stale': 'warning',
    // Rojo
    'error': 'error', 'failed': 'failed', 'fallido': 'fallido',
    'offline': 'offline', 'caida': 'caida', 'caído': 'caida',
    'critico': 'critico', 'crítico': 'critico', 'cancelado': 'cancelado',
    'false': 'offline',
    // Azul
    'starting': 'starting', 'en_progreso': 'en_progreso', 'en_proceso': 'en_proceso',
    'inicializando': 'inicializando', 'iniciando': 'starting',
    // Gris
    'idle': 'idle', 'paused': 'paused', 'pausada': 'pausada',
    'inactive': 'inactive', 'unknown': 'unknown', 'sin_estado': 'sin_estado',
  }
  return map[s] ?? 'unknown'
}

// ═══════════════════════════════════════════════════════════════
// SEMÁFORO DE THRESHOLD — Para métricas numéricas (%, scores)
// ═══════════════════════════════════════════════════════════════

/** Devuelve clave STATUS basado en un porcentaje (0-100).
 *  Regla: bajo = OK (verde), medio = atención (ámbar), alto = peligro (rojo)
 *  Usado para: CPU%, memoria%, fill rate, uso de recursos */
export function thresholdStatus(pct: number, thresholds: { warn: number; crit: number } = { warn: 60, crit: 85 }): string {
  if (pct >= thresholds.crit) return 'error'
  if (pct >= thresholds.warn) return 'warning'
  return 'ok'
}

/** Devuelve clave STATUS basado en un score (0-100, 100 = mejor).
 *  Regla invertida: alto = OK (verde), medio = atención (ámbar), bajo = peligro (rojo)
 *  Usado para: health score, confianza, calidad */
export function scoreStatus(score: number, thresholds: { warn: number; crit: number } = { warn: 50, crit: 30 }): string {
  if (score <= thresholds.crit) return 'error'
  if (score <= thresholds.warn) return 'warning'
  return 'ok'
}

/** Devuelve clave STATUS basado en antigüedad de datos (en minutos).
 *  Reciente = OK, algo antiguo = warning, muy antiguo = error */
export function freshnessStatus(minutes: number, thresholds: { warn: number; crit: number } = { warn: 360, crit: 1440 }): string {
  if (minutes >= thresholds.crit) return 'error'
  if (minutes >= thresholds.warn) return 'warning'
  return 'ok'
}

// ═══════════════════════════════════════════════════════════════
// Sentimiento (clasificación derivada de tratamiento)
// ═══════════════════════════════════════════════════════════════
// Valores: positivo | negativo | neutro | mixto | no_clasificado

export const SENTIMENT: Record<string, ColorEntry> = {
  positivo: {
    color: '#06b6d4',                  // cyan-500 — marca DECODEX (positivo informativo)
    bg: 'rgba(6,182,212,0.10)',
    border: 'rgba(6,182,212,0.20)',
    label: 'Positivo',
  },
  negativo: {
    color: '#f43f5e',                  // rose-500 — negativo
    bg: 'rgba(244,63,94,0.10)',
    border: 'rgba(244,63,94,0.20)',
    label: 'Negativo',
  },
  neutro: {
    color: '#64748b',                  // slate-500 — neutral
    bg: 'rgba(100,116,139,0.10)',
    border: 'rgba(100,116,139,0.20)',
    label: 'Neutro',
  },
  neutral: {                           // alias
    color: '#64748b',
    bg: 'rgba(100,116,139,0.10)',
    border: 'rgba(100,116,139,0.20)',
    label: 'Neutral',
  },
  mixto: {
    color: '#a78bfa',                  // violet-400 — mixto (NO amber, para no confundir con warning)
    bg: 'rgba(167,139,250,0.10)',
    border: 'rgba(167,139,250,0.20)',
    label: 'Mixto',
  },
  no_clasificado: {
    color: '#475569',                  // slate-600
    bg: 'rgba(71,85,105,0.08)',
    border: 'rgba(71,85,105,0.12)',
    label: 'N/C',
  },
}

// Helper: obtiene color para un valor de sentimiento, con fallback
export function sentimentColor(value: string): string {
  return SENTIMENT[value]?.color ?? SENTIMENT.no_clasificado.color
}

// Helper: obtiene bg para un valor de sentimiento, con fallback
export function sentimentBg(value: string): string {
  return SENTIMENT[value]?.bg ?? SENTIMENT.no_clasificado.bg
}

// Helper: obtiene label para un valor de sentimiento
export function sentimentLabel(value: string): string {
  if (!value || value === 'no_clasificado') return 'N/C'
  const key = value.includes('positivo') ? 'positivo'
    : value.includes('negativo') ? 'negativo'
    : value.includes('neutro') || value === 'neutral' ? 'neutro'
    : value === 'mixto' ? 'mixto'
    : 'no_clasificado'
  return SENTIMENT[key]?.label ?? 'N/C'
}

// ═══════════════════════════════════════════════════════════════
// Tratamiento Periodístico (clasificación directa LLM)
// ═══════════════════════════════════════════════════════════════
// 8 valores definidos en lib/analyze.ts y lib/auto-recovery.ts
// NOTA: violet (#8b5cf6) se usa SOLO para analítico/editorial.
// NUNCA se usa violet para error/offline — eso es red (#ef4444).

export const TRATAMIENTO: Record<string, ColorEntry> = {
  tratamiento_informativo: {
    color: '#06b6d4',                  // cyan-500 — neutral info
    bg: 'rgba(6,182,212,0.10)',
    border: 'rgba(6,182,212,0.20)',
    label: 'Informativo',
  },
  tratamiento_analitico: {
    color: '#8b5cf6',                  // violet-500 — análisis (EXCLUSIVO)
    bg: 'rgba(139,92,246,0.10)',
    border: 'rgba(139,92,246,0.20)',
    label: 'Analítico',
  },
  tratamiento_critico: {
    color: '#f43f5e',                  // rose-500 — crítica
    bg: 'rgba(244,63,94,0.10)',
    border: 'rgba(244,63,94,0.20)',
    label: 'Crítico',
  },
  tratamiento_editorial: {
    color: '#a78bfa',                  // violet-400 — editorial (suave)
    bg: 'rgba(167,139,250,0.10)',
    border: 'rgba(167,139,250,0.20)',
    label: 'Editorial',
  },
  tratamiento_agresivo: {
    color: '#ef4444',                  // red-500 — agresivo (peligro)
    bg: 'rgba(239,68,68,0.10)',
    border: 'rgba(239,68,68,0.20)',
    label: 'Agresivo',
  },
  tratamiento_elogioso: {
    color: '#10b981',                  // emerald-500 — elogioso
    bg: 'rgba(16,185,129,0.10)',
    border: 'rgba(16,185,129,0.20)',
    label: 'Elogioso',
  },
  tratamiento_ambiguo: {
    color: '#f59e0b',                  // amber-500 — ambiguo
    bg: 'rgba(245,158,11,0.10)',
    border: 'rgba(245,158,11,0.20)',
    label: 'Ambiguo',
  },
  sin_tratamiento: {
    color: '#475569',                  // slate-600
    bg: 'rgba(71,85,105,0.08)',
    border: 'rgba(71,85,105,0.12)',
    label: 'S/C',
  },
}

// Helper: obtiene color para tratamiento, con fallback
export function tratamientoColor(value: string): string {
  return TRATAMIENTO[value]?.color ?? TRATAMIENTO.sin_tratamiento.color
}

// Helper: obtiene bg para tratamiento
export function tratamientoBg(value: string): string {
  return TRATAMIENTO[value]?.bg ?? TRATAMIENTO.sin_tratamiento.bg
}

// Helper: obtiene label para tratamiento
export function tratamientoLabel(value: string): string {
  return TRATAMIENTO[value]?.label ?? 'S/C'
}

// ═══════════════════════════════════════════════════════════════
// ACCENT — Colores decorativos (no semáforo, no estado)
// ═══════════════════════════════════════════════════════════════
// Para categoría de indicadores, naturaleza de fuente, canales, etc.
// Estos NO son estados operativos — son etiquetas de clasificación.

export const ACCENT: Record<string, ColorEntry> = {
  // Naturaleza de fuente
  estatal: {
    color: '#06b6d4', bg: 'rgba(6,182,212,0.08)', border: 'rgba(6,182,212,0.20)',
    label: 'Estatal',
  },
  estatical: {
    color: '#06b6d4', bg: 'rgba(6,182,212,0.08)', border: 'rgba(6,182,212,0.20)',
    label: 'Estatal',
  },
  privado: {
    color: '#94a3b8', bg: 'rgba(148,163,184,0.06)', border: 'rgba(148,163,184,0.15)',
    label: 'Privado',
  },
  comunitario: {
    color: '#3b82f6', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.15)',
    label: 'Comunitario',
  },
  ong: {
    color: '#a78bfa', bg: 'rgba(167,139,250,0.08)', border: 'rgba(167,139,250,0.15)',
    label: 'ONG',
  },
  mixto_naturaleza: {
    color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.15)',
    label: 'Mixto',
  },
  // Canal de distribución
  email: {
    color: '#06b6d4', bg: 'rgba(6,182,212,0.08)', border: 'rgba(6,182,212,0.20)',
    label: 'Email',
  },
  whatsapp: {
    color: '#10b981', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.20)',
    label: 'WhatsApp',
  },
  telegram: {
    color: '#a78bfa', bg: 'rgba(167,139,250,0.08)', border: 'rgba(167,139,250,0.15)',
    label: 'Telegram',
  },
}

// ─── Scoring (escala numérica para cálculo de promedios) ──────────

export const SENTIMENT_SCORES: Record<string, number> = {
  positivo:         5,
  neutro:           3,
  negativo:         1,
  mixto:            3,
  no_clasificado:   3,
  neutral:          3,
}

/** Label a partir de promedio de score (escala 1-5) */
export function sentimentScoreLabel(promedio: number): string {
  if (promedio >= 4)    return 'Positivo'
  if (promedio >= 2.5)  return 'Neutral'
  if (promedio >= 1)    return 'Negativo'
  return 'Sin datos'
}

// ─── Labels rápidos (compatibilidad con imports existentes) ────────

export const SENTIMENT_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(SENTIMENT).map(([k, v]) => [k, v.label])
)

export const TRATAMIENTO_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(TRATAMIENTO).map(([k, v]) => [k, v.label])
)

// ─── Clases Tailwind (para badges inline en dark mode) ─────────────

export const SENTIMENT_CLASSES: Record<string, string> = {
  positivo: 'bg-cyan-500/10 text-cyan-400',
  negativo: 'bg-rose-500/10 text-rose-400',
  neutro: 'bg-slate-500/10 text-slate-400',
  neutral: 'bg-slate-500/10 text-slate-400',
  mixto: 'bg-violet-400/10 text-violet-300',
  no_clasificado: 'bg-slate-600/10 text-slate-500',
}

export const TRATAMIENTO_CLASSES: Record<string, string> = {
  tratamiento_informativo: 'bg-cyan-500/10 text-cyan-400',
  tratamiento_analitico: 'bg-violet-500/10 text-violet-400',
  tratamiento_critico: 'bg-rose-500/10 text-rose-400',
  tratamiento_editorial: 'bg-violet-400/10 text-violet-300',
  tratamiento_agresivo: 'bg-red-500/10 text-red-400',
  tratamiento_elogioso: 'bg-emerald-500/10 text-emerald-400',
  tratamiento_ambiguo: 'bg-amber-500/10 text-amber-400',
  sin_tratamiento: 'bg-slate-600/10 text-slate-500',
}
