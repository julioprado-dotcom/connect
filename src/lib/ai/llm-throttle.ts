// ─── Throttle Global para LLM — Política Antisaturación ──────────────
// DECODEX Bolivia
//
// TODAS las llamadas LLM del sistema deben pasar por throttledLlmCall().
// Esto previene saturar el API de DashScope (429 código 1305).
//
// Funciona como un semáforo global: garantiza un intervalo mínimo entre
// CUALQUIER dos llamadas LLM, sin importar qué módulo las dispare.
//
// Uso:
//   import { throttledLlmCall } from '@/lib/ai/llm-throttle'
//   const completion = await throttledLlmCall(() => zai.chat.completions.create({...}))

// ─── Configuración ────────────────────────────────────────────────────────

const LLM_THROTTLE_BASE_MS = 8000     // 8s entre llamadas LLM (base — DashScope free tier limit)
const LLM_THROTTLE_MAX_MS = 30000     // 30s máximo (si hay 429s recientes)
const BACKOFF_FACTOR = 2.0            // Multiplicador al recibir 429 (agresivo)
const BACKOFF_RESET_AFTER = 600_000   // Resetear backoff después de 10min sin 429

// ─── Estado global (globalThis para persistir entre contextos) ────────────

interface ThrottleState {
  lastCallTime: number
  currentDelay: number
  last429Time: number
  totalCalls: number
  totalThrottled: number
  total429s: number
}

interface GlobalThrottle {
  __decodex_llm_throttle__: ThrottleState | undefined
}

const _g = globalThis as unknown as GlobalThrottle

function getState(): ThrottleState {
  if (!_g.__decodex_llm_throttle__) {
    _g.__decodex_llm_throttle__ = {
      lastCallTime: 0,
      currentDelay: LLM_THROTTLE_BASE_MS,
      last429Time: 0,
      totalCalls: 0,
      totalThrottled: 0,
      total429s: 0,
    }
  }
  return _g.__decodex_llm_throttle__
}

/**
 * Espera el tiempo necesario antes de permitir una llamada LLM.
 * Llamar ESTA función antes de CADA llamada a zai.chat.completions.create().
 *
 * Estrategia adaptativa:
 *   - Normal: espera 3s desde la última llamada
 *   - Si hubo 429 reciente: incrementa delay (3s → 4.5s → 6.75s → 10s max)
 *   - Si pasan 5min sin 429: resetea al delay base (3s)
 */
export async function waitForLlmSlot(): Promise<void> {
  const s = getState()
  const now = Date.now()

  // Resetear backoff si pasaron 5min sin 429
  if (s.last429Time > 0 && now - s.last429Time > BACKOFF_RESET_AFTER) {
    if (s.currentDelay > LLM_THROTTLE_BASE_MS) {
      console.log(`[LLM-Throttle] Backoff reseteado: ${s.currentDelay}ms → ${LLM_THROTTLE_BASE_MS}ms (sin 429 por 5min)`)
      s.currentDelay = LLM_THROTTLE_BASE_MS
    }
  }

  // Calcular tiempo de espera
  const elapsed = now - s.lastCallTime
  if (elapsed < s.currentDelay) {
    const waitMs = s.currentDelay - elapsed
    s.totalThrottled++
    if (waitMs > 100) {
      await new Promise(resolve => setTimeout(resolve, waitMs))
    }
  }

  s.lastCallTime = Date.now()
  s.totalCalls++
}

/**
 * Registrar que se recibió un 429 (para incrementar backoff).
 * Llamar después de capturar un error 429 en cualquier módulo LLM.
 */
export function registerLlm429(): void {
  const s = getState()
  s.total429s++
  s.last429Time = Date.now()

  // Incrementar delay con backoff (máximo 10s)
  const newDelay = Math.min(Math.round(s.currentDelay * BACKOFF_FACTOR), LLM_THROTTLE_MAX_MS)
  if (newDelay > s.currentDelay) {
    console.warn(`[LLM-Throttle] 429 detectado: incrementando delay ${s.currentDelay}ms → ${newDelay}ms (429s totales: ${s.total429s})`)
    s.currentDelay = newDelay
  }
}

/**
 * Wrapper que combina throttle + llamada LLM + registro de 429.
 * Uso recomendado en todos los módulos LLM.
 *
 * @example
 * const zai = await ZAI.create()
 * const completion = await throttledLlmCall(
 *   () => zai.chat.completions.create({ model: 'glm-4.7-flash', messages: [...] })
 * )
 */
export async function throttledLlmCall<T>(
  llmCall: () => Promise<T>
): Promise<T> {
  await waitForLlmSlot()
  try {
    return await llmCall()
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    // Si es 429, registrar para incrementar backoff global
    if (msg.includes('429') || msg.includes('1305')) {
      registerLlm429()
    }
    throw err
  }
}

/**
 * Obtener estadísticas del throttle (para dashboard/debug).
 */
export function getLlmThrottleStats() {
  const s = getState()
  return {
    currentDelay: s.currentDelay,
    baseDelay: LLM_THROTTLE_BASE_MS,
    maxDelay: LLM_THROTTLE_MAX_MS,
    lastCallTime: s.lastCallTime,
    last429Time: s.last429Time,
    totalCalls: s.totalCalls,
    totalThrottled: s.totalThrottled,
    total429s: s.total429s,
    backoffActive: s.currentDelay > LLM_THROTTLE_BASE_MS,
  }
}
