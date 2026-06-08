// Throttle LLM Global - DECODEX Bolivia

interface ThrottleState {
  lastCallTime: number
  currentDelay: number
  baseDelay: number
  maxDelay: number
  last429Time: number
  totalCalls: number
  total429s: number
  totalWaitMs: number
  backoffFactor: number
}

interface GlobalThrottle {
  __decodex_llm_throttle__: ThrottleState | undefined
}

const _g = globalThis as unknown as GlobalThrottle

function getState(): ThrottleState {
  if (!_g.__decodex_llm_throttle__) {
    _g.__decodex_llm_throttle__ = {
      lastCallTime: 0, currentDelay: 3000, baseDelay: 3000,
      maxDelay: 10000, last429Time: 0, totalCalls: 0,
      total429s: 0, totalWaitMs: 0, backoffFactor: 1.5,
    }
  }
  return _g.__decodex_llm_throttle__
}

export async function throttledLlmCall<T>(llmCall: () => Promise<T>): Promise<T> {
  await waitForLlmSlot()
  try {
    return await llmCall()
  } catch (err: any) {
    const msg = err?.message || String(err)
    if (msg.includes('429') || msg.includes('1305') || msg.includes('rate')) {
      registerLlm429()
    }
    throw err
  }
}

export function getLlmThrottleStats() {
  const s = getState()
  return {
    currentDelayMs: s.currentDelay, totalCalls: s.totalCalls, total429s: s.total429s,
    totalWaitSeconds: Math.round(s.totalWaitMs / 1000),
    lastCallAgo: s.lastCallTime ? Math.round((Date.now() - s.lastCallTime) / 1000) : -1,
    last429Ago: s.last429Time ? Math.round((Date.now() - s.last429Time) / 1000) : -1,
  }
}
