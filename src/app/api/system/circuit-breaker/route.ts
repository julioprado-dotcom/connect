// API: Circuit Breaker LLM — GET status, POST force open/close
// DECODEX Bolivia

import { NextRequest, NextResponse } from 'next/server'
import {
  getCircuitBreakerState,
  forceOpen,
  forceClose,
} from '@/lib/ai/circuit-breaker'

// GET: obtener estado del circuit breaker
export async function GET() {
  const state = getCircuitBreakerState()

  const uptimeOpen = state.openedAt ? Math.round((Date.now() - state.openedAt) / 60000) : 0
  const sinceRecovery = state.recoveredAt ? Math.round((Date.now() - state.recoveredAt) / 60000) : 0

  return NextResponse.json({
    ...state,
    uptimeOpenMinutes: uptimeOpen,
    sinceRecoveryMinutes: sinceRecovery,
    statusLabel: {
      CLOSED: 'Operativo',
      OPEN: 'Pausado (sin saldo)',
      HALF: 'Probando recuperación...',
    }[state.state],
  })
}

// POST: forzar estado del circuit breaker
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, reason } = body as { action?: string; reason?: string }

    if (action === 'open' || action === 'pause') {
      forceOpen(reason || 'Forzado vía API')
      return NextResponse.json({
        ok: true,
        message: 'Circuit breaker abierto — Fase 3 (LLM) pausada',
        state: getCircuitBreakerState(),
      })
    }

    if (action === 'close' || action === 'resume') {
      forceClose()
      return NextResponse.json({
        ok: true,
        message: 'Circuit breaker cerrado — Fase 3 (LLM) reanudada',
        state: getCircuitBreakerState(),
      })
    }

    return NextResponse.json(
      { ok: false, error: 'Acción no válida. Usar: open, close, pause, resume' },
      { status: 400 },
    )
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}
