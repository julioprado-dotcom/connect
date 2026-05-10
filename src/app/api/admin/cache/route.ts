// GET  /api/admin/cache — Métricas de cache, contenedor y estado del Guardian
// POST /api/admin/cache — Acciones: purge_next, purge_turbopack, purge_backups, purge_all, drop_cache

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

// ── GET: Métricas + Guardian ──────────────────────────────────────────

export async function GET() {
  try {
    const memory = getMemoryMetrics()
    const container = getContainerMetrics()
    const cache = getCacheMetrics()
    const uptime = process.uptime()
    // Guardian: dynamic import para evitar Edge analysis
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let guardian: any = {}
    try {
      const mod = await import('@/lib/jobs/container-guardian')
      guardian = mod.getGuardianStatus()
    } catch { /* guardian no disponible */ }

    // Backup diferencial: último backup config y operacional
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let backupInfo: any = { config: null, operacional: null }
    try {
      const { listBackups } = await import('@/lib/backup')
      const backups = await listBackups()
      // Buscar el último backup de cada dominio en archives
      const configBackup = backups.find(b => b.tipo === 'archive' && b.archivo.startsWith('config-'))
      const opBackup = backups.find(b => b.tipo === 'archive' && b.archivo.startsWith('operacional-'))
      if (configBackup) backupInfo.config = { archivo: configBackup.archivo, tamanio: configBackup.tamanio, fecha: configBackup.fecha }
      if (opBackup) backupInfo.operacional = { archivo: opBackup.archivo, tamanio: opBackup.tamanio, fecha: opBackup.fecha }
    } catch { /* backup info no disponible */ }

    // Nivel de presión (0-100) — ahora pesa más el cgroup que el heap
    const pressureScore = Math.round(
      (memory.heapPct * 0.25) + (container.pct * 0.55) +
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
      guardian: {
        active: guardian.active,
        level: guardian.level,
        currentPct: guardian.currentPct,
        trendMB: guardian.trendMB,
        trendPctPerHour: guardian.trendPctPerHour,
        lastAction: guardian.lastAction,
        lastActionTime: guardian.lastActionTime,
        lastActionMessage: guardian.lastActionMessage,
        actionsExecuted: guardian.actionsExecuted,
        emergencyCount: guardian.emergencyCount,
        workerPaused: guardian.workerPaused,
        schedulerPaused: guardian.schedulerPaused,
        // Últimas 20 snapshots para gráfica de tendencia
        snapshots: guardian.snapshots,
      },
      backup: backupInfo,
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
        { error: 'Campo "accion" requerido. Opciones: purge_next, purge_turbopack, purge_backups, purge_all, drop_cache', accionesValidas: ['purge_next', 'purge_turbopack', 'purge_backups', 'purge_all', 'drop_cache'] },
        { status: 400 }
      )
    }

    const resultados: Array<{ target: string; success: boolean; freedMB: number; error?: string }> = []

    switch (accion) {
      case 'drop_cache': {
        // Liberar page cache del SO sin reiniciar
        let success = false
        try {
          const mod = await import('@/lib/jobs/container-guardian')
          success = mod.manualDropPageCache()
        } catch { /* guardian no disponible */ }
        resultados.push({
          target: 'page_cache (SO)',
          success,
          freedMB: 0, // drop_caches no reporta cuánto liberó — se refleja en siguiente lectura
        })
        break
      }
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
          { error: `Acción no reconocida: ${accion}`, accionesValidas: ['purge_next', 'purge_turbopack', 'purge_backups', 'purge_all', 'drop_cache'] },
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
        liberado: r.success ? `${formatMB(r.freedMB)}` : 'N/A',
        error: r.error,
      })),
      totalLiberado: `${formatMB(totalFreed)}`,
      nota: accion === 'drop_cache'
        ? 'Page cache liberada. El efecto se refleja en la siguiente lectura del contenedor (30s).'
        : undefined,
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
