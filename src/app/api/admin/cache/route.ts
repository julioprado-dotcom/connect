// GET  /api/admin/cache — Métricas de cache y contenedor
// POST /api/admin/cache — Acciones: purge_next, purge_turbopack, purge_backups, purge_all

import { NextRequest, NextResponse } from 'next/server'
import {
  getMemoryMetrics,
  getContainerMetrics,
  getCacheMetrics,
  purgeNextCache,
  purgeTurbopackCache,
  purgeOldBackups,
  formatMB,
} from '@/lib/browser-runtime'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ── GET: Métricas ─────────────────────────────────────────────────────

export async function GET() {
  try {
    const memory = getMemoryMetrics()
    const container = getContainerMetrics()
    const cache = getCacheMetrics()
    const uptime = process.uptime()

    // Nivel de presión (0-100)
    const pressureScore = Math.round(
      (memory.heapPct * 0.4) + (container.pct * 0.4) +
      Math.min(100, (cache.nextCacheSizeMB / 500) * 100) * 0.2
    )

    // Gauge label
    const pressureLabel =
      pressureScore > 80 ? 'critico' :
      pressureScore > 60 ? 'alto' :
      pressureScore > 40 ? 'moderado' :
      pressureScore > 20 ? 'bajo' : 'minimo'

    return NextResponse.json({
      memory,
      container,
      cache,
      pressure: { score: pressureScore, label: pressureLabel },
      uptime: {
        seconds: Math.round(uptime),
        formatted: formatUptime(uptime),
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Error obteniendo métricas de cache' },
      { status: 500 }
    )
  }
}

// ── POST: Acciones de limpieza ────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { accion } = body as { accion?: string }

    if (!accion) {
      return NextResponse.json(
        { error: 'Campo "accion" requerido. Opciones: purge_next, purge_turbopack, purge_backups, purge_all' },
        { status: 400 }
      )
    }

    const resultados: Array<{ target: string; success: boolean; freedMB: number; error?: string }> = []

    switch (accion) {
      case 'purge_next': {
        const r = purgeNextCache()
        resultados.push(r)
        break
      }
      case 'purge_turbopack': {
        const r = purgeTurbopackCache()
        resultados.push(r)
        break
      }
      case 'purge_backups': {
        const r = purgeOldBackups()
        resultados.push(r)
        break
      }
      case 'purge_all': {
        resultados.push(purgeNextCache())
        resultados.push(purgeTurbopackCache())
        resultados.push(purgeOldBackups())
        break
      }
      default:
        return NextResponse.json(
          { error: `Acción no reconocida: ${accion}`, accionesValidas: ['purge_next', 'purge_turbopack', 'purge_backups', 'purge_all'] },
          { status: 400 }
        )
    }

    const totalFreed = resultados.reduce((sum, r) => sum + r.freedMB, 0)
    const allSuccess = resultados.every(r => r.success)

    return NextResponse.json({
      exito: allSuccess,
      accion,
      resultados: resultados.map(r => ({
        target: r.target,
        exito: r.success,
        liberado: `${formatMB(r.freedMB)}`,
        error: r.error,
      })),
      totalLiberado: `${formatMB(totalFreed)}`,
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Error ejecutando acción de limpieza' },
      { status: 500 }
    )
  }
}

// ── Helpers ────────────────────────────────────────────────────────────

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const parts: string[] = []
  if (d > 0) parts.push(`${d}d`)
  if (h > 0) parts.push(`${h}h`)
  parts.push(`${m}m`)
  return parts.join(' ')
}
