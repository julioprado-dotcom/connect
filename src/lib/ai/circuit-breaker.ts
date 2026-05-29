// ─── Circuit Breaker para LLM (DashScope / z-ai-web-dev-sdk) ─────────────
// DECODEX Bolivia
//
// Cuando el API de IA responde con 429 (sin saldo) o errores repetidos,
// el circuit breaker se abre y pausa todas las llamadas LLM.
// Fases 1-2 del pipeline (check + triaje) continúan normalmente.
// El breaker reintenta automáticamente para detectar recuperación.
//
// Estados:
//   CLOSED  → LLM funciona, llamadas normales
//   OPEN    → LLM en error, se skipean todas las llamadas
//   HALF    → Período de prueba: una llamada para testear si recuperó

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF'

export interface CircuitBreakerState {
  state: CircuitState
  failures: number           // errores consecutivos
  lastFailureTime: number    // timestamp del último error
  lastError: string          // mensaje del último error
  totalSkipped: number       // llamadas skipeadas mientras OPEN
  totalCalled: number        // llamadas ejecutadas
  openedAt: number | null    // timestamp cuando se abrió el circuit
  halfOpenAt: number | null  // timestamp del último half-open
  recoveredAt: number | null // timestamp de última recuperación
}

// ─── Configuración ─────────────────────────────────────────────────────────

const CIRCUIT_CONFIG = {
  failureThreshold: 2,        // errores consecutivos para abrir el circuit
  recoveryIntervalMs: 5 * 60 * 1000,  // 5 minutos antes de intentar recuperación
  halfOpenTestIntervalMs: 30 * 1000,  // cada 30s hacer 1 prueba en half-open
  maxHalfOpenTests: 3,        // máx pruebas en half-open antes de re-abrir
}

// ─── Estado en memoria (globalThis para persistir entre contextos) ────────

interface GlobalCircuit {
  __decodex_circuit__: CircuitBreakerState | undefined
}

const _g = globalThis as unknown as GlobalCircuit

function getState(): CircuitBreakerState {
  if (!_g.__decodex_circuit__) {
    _g.__decodex_circuit__ = {
      state: 'CLOSED',
      failures: 0,
      lastFailureTime: 0,
      lastError: '',
      totalSkipped: 0,
      totalCalled: 0,
      openedAt: null,
      halfOpenAt: null,
      recoveredAt: null,
    }
  }
  return _g.__decodex_circuit__
}

// ─── API pública ──────────────────────────────────────────────────────────

/**
 * Verificar si el circuit breaker permite llamadas LLM.
 * Retorna true si se puede proceder con la llamada LLM.
 * Si retorna false, la Fase 3 debe skipearse.
 */
export function canCallLLM(): boolean {
  const s = getState()

  if (s.state === 'CLOSED') return true

  if (s.state === 'OPEN') {
    // Verificar si pasó el intervalo de recuperación → pasar a HALF
    const elapsed = Date.now() - s.lastFailureTime
    if (elapsed >= CIRCUIT_CONFIG.recoveryIntervalMs) {
      s.state = 'HALF'
      s.halfOpenAt = Date.now()
      console.log(`[Circuit-Breaker] OPEN → HALF: probando recuperación después de ${Math.round(elapsed / 60000)}min`)
      return true // Permitir una llamada de prueba
    }
    return false
  }

  if (s.state === 'HALF') {
    // Permitir llamadas periódicas como prueba
    const elapsed = Date.now() - (s.halfOpenAt || 0)
    if (elapsed >= CIRCUIT_CONFIG.halfOpenTestIntervalMs) {
      s.halfOpenAt = Date.now()
      return true
    }
    return false
  }

  return false
}

/**
 * Registrar un éxito en la llamada LLM.
 */
export function recordSuccess(): void {
  const s = getState()
  s.totalCalled++
  s.failures = 0

  if (s.state === 'HALF') {
    // ¡Recuperación exitosa!
    s.state = 'CLOSED'
    s.recoveredAt = Date.now()
    console.log(`[Circuit-Breaker] HALF → CLOSED: LLM recuperado ✅ (skipeadas ${s.totalSkipped} llamadas)`)
    s.totalSkipped = 0
  }
}

/**
 * Registrar un error en la llamada LLM.
 * Detecta automáticamente errores 429 (sin saldo) para abrir el circuit.
 */
export function recordFailure(error: unknown): void {
  const s = getState()
  s.totalCalled++
  s.failures++
  s.lastFailureTime = Date.now()

  const msg = error instanceof Error ? error.message : String(error)
  s.lastError = msg.substring(0, 200)

  // Detectar 429 (sin saldo) o errores de quota
  const is429 = msg.includes('429') || msg.includes('1113') || msg.includes('余额不足') || msg.includes('rate limit')

  if (is429 && s.state === 'CLOSED') {
    // Error de saldo → abrir inmediatamente (no esperar threshold)
    s.state = 'OPEN'
    s.openedAt = Date.now()
    console.warn(`[Circuit-Breaker] CLOSED → OPEN: Error 429 (sin saldo en DashScope). Fase 3 pausada.`)
    console.warn(`[Circuit-Breaker] El pipeline continuará con Fases 1-2 (check + triaje) sin LLM.`)
    console.warn(`[Circuit-Breaker] Reintentará automáticamente en ${Math.round(CIRCUIT_CONFIG.recoveryIntervalMs / 60000)}min.`)
    return
  }

  if (s.failures >= CIRCUIT_CONFIG.failureThreshold && s.state === 'CLOSED') {
    s.state = 'OPEN'
    s.openedAt = Date.now()
    console.warn(`[Circuit-Breaker] CLOSED → OPEN: ${s.failures} errores consecutivos. Último: ${msg.substring(0, 100)}`)
    return
  }

  if (s.state === 'HALF') {
    // La prueba falló → reabrir
    s.state = 'OPEN'
    s.openedAt = Date.now()
    console.warn(`[Circuit-Breaker] HALF → OPEN: Prueba de recuperación falló (${msg.substring(0, 100)})`)
  }
}

/**
 * Registrar que una llamada LLM fue skipeada por el circuit breaker.
 */
export function recordSkipped(): void {
  const s = getState()
  s.totalSkipped++
}

/**
 * Obtener el estado actual del circuit breaker (para el dashboard/API).
 */
export function getCircuitBreakerState(): CircuitBreakerState {
  return { ...getState() }
}

/**
 * Forzar apertura del circuit (útil para testing o pausa manual).
 */
export function forceOpen(reason?: string): void {
  const s = getState()
  s.state = 'OPEN'
  s.openedAt = Date.now()
  s.lastFailureTime = Date.now()
  s.lastError = reason || 'Forzado manualmente'
  console.warn(`[Circuit-Breaker] Forzado a OPEN: ${reason}`)
}

/**
 * Forzar cierre del circuit (útil para reactivar después de recargar saldo).
 */
export function forceClose(): void {
  const s = getState()
  const wasOpen = s.state !== 'CLOSED'
  s.state = 'CLOSED'
  s.failures = 0
  s.recoveredAt = Date.now()
  if (wasOpen) {
    console.log(`[Circuit-Breaker] Forzado a CLOSED: LLM reactivado ✅`)
  }
}
