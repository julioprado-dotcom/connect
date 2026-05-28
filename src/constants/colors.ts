/**
 * DECODEX v0.11.0 — Paleta Centralizada de Colores
 * Motor ONION200 — Fuente única de verdad
 *
 * Todos los componentes deben importar desde este archivo.
 * PROHIBIDO definir colores inline para sentimiento/tratamiento.
 *
 * Convención ONION200:
 * - Positivo = cyan (marca principal)
 * - Negativo = rose (alerta)
 * - Neutro = slate (neutral)
 * - Mixto/Ambiguo = amber (caución)
 * - Sin clasificar = slate oscuro
 */

// ─── Tipo base ────────────────────────────────────────────────────

export interface ColorEntry {
  color: string      // color principal para texto/iconos
  bg: string        // fondo con baja opacidad
  label: string     // etiqueta legible
}

// ─── Sentimiento (clasificación derivada de tratamiento) ───────────
// Mapea tratamientoPeriodistico → sentimiento via tratamientoToSentimiento()
// Valores: positivo | negativo | neutro | mixto | no_clasificado

export const SENTIMENT: Record<string, ColorEntry> = {
  positivo: {
    color: '#06b6d4',                  // cyan-500
    bg: 'rgba(6,182,212,0.10)',
    label: 'Positivo',
  },
  negativo: {
    color: '#f43f5e',                  // rose-500
    bg: 'rgba(244,63,94,0.10)',
    label: 'Negativo',
  },
  neutro: {
    color: '#64748b',                  // slate-500
    bg: 'rgba(100,116,139,0.10)',
    label: 'Neutro',
  },
  neutral: {                           // alias
    color: '#64748b',
    bg: 'rgba(100,116,139,0.10)',
    label: 'Neutral',
  },
  mixto: {
    color: '#f59e0b',                  // amber-500
    bg: 'rgba(245,158,11,0.10)',
    label: 'Mixto',
  },
  no_clasificado: {
    color: '#475569',                  // slate-600
    bg: 'rgba(71,85,105,0.08)',
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

// ─── Tratamiento Periodístico (clasificación directa LLM) ─────────
// 8 valores definidos en lib/analyze.ts y lib/auto-recovery.ts

export const TRATAMIENTO: Record<string, ColorEntry> = {
  tratamiento_informativo: {
    color: '#06b6d4',                  // cyan-500 — neutral info
    bg: 'rgba(6,182,212,0.10)',
    label: 'Informativo',
  },
  tratamiento_analitico: {
    color: '#8b5cf6',                  // violet-500 — análisis
    bg: 'rgba(139,92,246,0.10)',
    label: 'Analítico',
  },
  tratamiento_critico: {
    color: '#f43f5e',                  // rose-500 — crítica
    bg: 'rgba(244,63,94,0.10)',
    label: 'Crítico',
  },
  tratamiento_editorial: {
    color: '#a78bfa',                  // violet-400 — editorial (suave)
    bg: 'rgba(167,139,250,0.10)',
    label: 'Editorial',
  },
  tratamiento_agresivo: {
    color: '#ef4444',                  // red-500 — agresivo (peligro)
    bg: 'rgba(239,68,68,0.10)',
    label: 'Agresivo',
  },
  tratamiento_elogioso: {
    color: '#10b981',                  // emerald-500 — elogioso
    bg: 'rgba(16,185,129,0.10)',
    label: 'Elogioso',
  },
  tratamiento_ambiguo: {
    color: '#f59e0b',                  // amber-500 — ambiguo
    bg: 'rgba(245,158,11,0.10)',
    label: 'Ambiguo',
  },
  sin_tratamiento: {
    color: '#475569',                  // slate-600
    bg: 'rgba(71,85,105,0.08)',
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
  mixto: 'bg-amber-500/10 text-amber-400',
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
