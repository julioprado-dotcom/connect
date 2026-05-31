// Container Guardian — Monitor de cgroup con acciones preventivas
// DECODEX Bolivia — Motor de Inteligencia Mediática
//
// Monitorea el uso REAL del cgroup (no solo heap de Node.js) cada 30s.
// Ejecuta acciones preventivas automáticas cuando el contenedor supera umbrales:
//   70% → drop_pagecache + purge .next/cache
//   80% → detiene scheduler + purge agresivo
//   85% → detiene worker + purga TODO + alerta emergency
// Recupera automáticamente cuando baja a <65%

// CRÍTICO: No usar `import fs from 'fs'` aquí — este archivo es importado
// dinámicamente desde jobs/index.ts (que a su vez viene de instrumentation.ts).
// Turbopack tracea todas las importaciones estáticas de Node.js (fs, path, os)
// y lanza warnings de Edge Runtime incluso si el código nunca se ejecuta en Edge.
// Usamos import('fs') dinámico dentro de funciones para evitar el trace.
import { GUARDIAN_CONFIG } from './constants'

// ── Types ────────────────────────────────────────────────────────────

export type GuardianLevel = 'stable' | 'watch' | 'warn' | 'critical' | 'emergency'
export type GuardianAction = 'none' | 'drop_pagecache' | 'purge_cache' | 'stop_scheduler' | 'stop_worker' | 'purge_all' | 'recover_scheduler' | 'recover_worker'

export interface GuardianSnapshot {
  timestamp: string
  cgroupPct: number
  cgroupUsageMB: number
  cgroupLimitMB: number
  level: GuardianLevel
  action: GuardianAction
  message: string
}

export interface GuardianStatus {
  active: boolean
  level: GuardianLevel
  currentPct: number
  trendMB: number            // delta MB en los últimos 5 min
  trendPctPerHour: number    // proyección %/hora
  lastAction: GuardianAction
  lastActionTime: string | null
  lastActionMessage: string | null
  actionsExecuted: number
  snapshots: GuardianSnapshot[]   // últimas 20 lecturas
  emergencyCount: number
  workerPaused: boolean
  schedulerPaused: boolean
}

// ── State ────────────────────────────────────────────────────────────

let intervalId: ReturnType<typeof setInterval> | null = null
const snapshots: GuardianSnapshot[] = []
let status: GuardianStatus = createInitialStatus()

function createInitialStatus(): GuardianStatus {
  return {
    active: false,
    level: 'stable',
    currentPct: 0,
    trendMB: 0,
    trendPctPerHour: 0,
    lastAction: 'none',
    lastActionTime: null,
    lastActionMessage: null,
    actionsExecuted: 0,
    snapshots: [],
    emergencyCount: 0,
    workerPaused: false,
    schedulerPaused: false,
  }
}

// ── cgroup Reader ────────────────────────────────────────────────────

async function readCgroup(): Promise<{ usageMB: number; limitMB: number; pct: number } | null> {
  try {
    const fs = await import('fs')
    const limit = parseInt(fs.readFileSync('/sys/fs/cgroup/memory/memory.limit_in_bytes', 'utf-8').trim(), 10)
    const usage = parseInt(fs.readFileSync('/sys/fs/cgroup/memory/memory.usage_in_bytes', 'utf-8').trim(), 10)
    if (limit > 0) {
      return {
        usageMB: Math.round(usage / (1024 * 1024) * 10) / 10,
        limitMB: Math.round(limit / (1024 * 1024) * 10) / 10,
        pct: Math.round((usage / limit) * 10000) / 100,
      }
    }
  } catch { /* no cgroup */ }
  return null
}

// ── Page Cache Drop ──────────────────────────────────────────────────

async function dropPageCache(): Promise<boolean> {
  try {
    const fs = await import('fs')
    fs.writeFileSync('/proc/sys/vm/drop_caches', '3', 'utf-8')
    return true
  } catch {
    return false
  }
}

// ── Purge Actions ────────────────────────────────────────────────────

function purgeNextDevCache(): number {
  try {
    const { purgeTurbopackCache } = require('@/lib/browser-runtime') as { purgeTurbopackCache: () => Promise<{ freedMB: number }> }
    // sync wrapper — called from sync context but purgeTurbopackCache is now async
    let freedMB = 0
    purgeTurbopackCache().then(r => { freedMB = r.freedMB }).catch(() => {})
    return freedMB
  } catch { return 0 }
}

// ── Worker/Scheduler Control ─────────────────────────────────────────

function pauseScheduler(): void {
  try {
    const { stopScheduler } = require('./scheduler') as { stopScheduler: () => void }
    stopScheduler()
    status.schedulerPaused = true
  } catch { /* scheduler puede no estar accesible */ }
}

function resumeScheduler(): void {
  try {
    const { startScheduler } = require('./scheduler') as { startScheduler: () => Promise<void> }
    startScheduler().then(() => { status.schedulerPaused = false }).catch(() => {})
  } catch { /* scheduler puede no estar accesible */ }
}

function pauseWorker(): void {
  try {
    const { stopWorker } = require('./worker') as { stopWorker: () => void }
    stopWorker()
    status.workerPaused = true
  } catch { /* worker puede no estar accesible */ }
}

function resumeWorker(): void {
  try {
    const { startWorker, registerDefaultRunners } = require('./worker') as { startWorker: () => void; registerDefaultRunners: () => void }
    registerDefaultRunners()
    startWorker()
    status.workerPaused = false
  } catch { /* worker puede no estar accesible */ }
}

// ── Trend Calculation ────────────────────────────────────────────────

function calculateTrend(): { trendMB: number; trendPctPerHour: number } {
  if (snapshots.length < 2) return { trendMB: 0, trendPctPerHour: 0 }

  // Buscar snapshot de hace ~5 minutos
  const now = Date.now()
  const fiveMinAgo = now - 5 * 60 * 1000
  const recentSnapshot = snapshots.find(s => now - new Date(s.timestamp).getTime() >= fiveMinAgo * 0.8)

  if (!recentSnapshot) return { trendMB: 0, trendPctPerHour: 0 }

  const elapsedHours = (now - new Date(recentSnapshot.timestamp).getTime()) / (1000 * 60 * 60)
  if (elapsedHours < 0.001) return { trendMB: 0, trendPctPerHour: 0 }

  const currentUsageMB = snapshots[snapshots.length - 1].cgroupUsageMB
  const deltaMB = currentUsageMB - recentSnapshot.cgroupUsageMB
  const deltaPct = snapshots[snapshots.length - 1].cgroupPct - recentSnapshot.cgroupPct

  return {
    trendMB: Math.round(deltaMB * 10) / 10,
    trendPctPerHour: Math.round((deltaPct / elapsedHours) * 10) / 10,
  }
}

// ── Level Determination ─────────────────────────────────────────────

function determineLevel(pct: number): GuardianLevel {
  if (pct >= GUARDIAN_CONFIG.emergencyPct) return 'emergency'
  if (pct >= GUARDIAN_CONFIG.criticalPct) return 'critical'
  if (pct >= GUARDIAN_CONFIG.warnPct) return 'warn'
  if (pct >= GUARDIAN_CONFIG.watchPct) return 'watch'
  return 'stable'
}

// ── Core Loop ────────────────────────────────────────────────────────

async function tick(): Promise<void> {
  const cgroup = readCgroup()
  if (!cgroup) {
    console.warn('[Guardian] No se pudo leer cgroup — saltando tick')
    return
  }

  const level = determineLevel(cgroup.pct)
  const trend = calculateTrend()

  // Actualizar estado
  status.currentPct = cgroup.pct
  status.level = level
  status.trendMB = trend.trendMB
  status.trendPctPerHour = trend.trendPctPerHour

  // ── Backup diferencial por dominio (solo en stable, cada ~6 horas) ─
  if (level === 'stable' && snapshots.length % GUARDIAN_CONFIG.backupCheckIntervalTicks === 0) {
    try {
      const { shouldBackupDomain, createDomainBackup } = require('@/lib/backup') as {
        shouldBackupDomain: (d: 'config' | 'operacional', h: number) => Promise<boolean>,
        createDomainBackup: (d: 'config' | 'operacional') => Promise<{ success: boolean; tamanio: string; registros: Record<string, number> }>,
      }
      if (await shouldBackupDomain('config', GUARDIAN_CONFIG.backupConfigIntervalHours)) {
        const result = await createDomainBackup('config')
        if (result.success) {
          console.log(`[Guardian] Backup CONFIG creado (${result.tamanio})`)
        }
      }
      if (await shouldBackupDomain('operacional', GUARDIAN_CONFIG.backupOperacionalIntervalHours)) {
        const result = await createDomainBackup('operacional')
        if (result.success) {
          console.log(`[Guardian] Backup OPERACIONAL creado (${result.tamanio})`)
        }
      }
    } catch {
      /* backup es nice-to-have, no debe romper el guardian */
    }
  }

  // Crear snapshot
  const snapshot: GuardianSnapshot = {
    timestamp: new Date().toISOString(),
    cgroupPct: cgroup.pct,
    cgroupUsageMB: cgroup.usageMB,
    cgroupLimitMB: cgroup.limitMB,
    level,
    action: 'none',
    message: '',
  }

  // ── Acciones según nivel ─────────────────────────────────────────

  switch (level) {
    case 'stable':
    case 'watch':
      // Log periódico solo cada 5 minutos
      if (snapshots.length % 10 === 0) {
        console.log(`[Guardian] Contenedor ${cgroup.pct}% (${cgroup.usageMB}/${cgroup.limitMB} MB) — ${level}`)
      }
      // Recovery automático
      if ((status.workerPaused || status.schedulerPaused) && cgroup.pct < GUARDIAN_CONFIG.recoveryPct) {
        if (status.schedulerPaused) {
          resumeScheduler()
          snapshot.action = 'recover_scheduler'
          snapshot.message = `Contenedor recuperado a ${cgroup.pct}% — scheduler reiniciado`
          console.log(`[Guardian] RECUPERACIÓN: ${snapshot.message}`)
        }
        if (status.workerPaused) {
          resumeWorker()
          snapshot.action = 'recover_worker'
          snapshot.message = `Contenedor recuperado a ${cgroup.pct}% — worker reiniciado`
          console.log(`[Guardian] RECUPERACIÓN: ${snapshot.message}`)
        }
        recordAction(snapshot)
      }
      break

    case 'warn':
      // 70%: drop page cache + purge .next/dev
      console.warn(`[Guardian] WARN: Contenedor a ${cgroup.pct}% — ejecutando drop_caches + purge`)
      const dropped = await dropPageCache()
      const purged = purgeNextDevCache()
      snapshot.action = 'drop_pagecache'
      snapshot.message = `Page cache liberado: ${dropped ? 'OK' : 'FALLÓ'}. Purge .next: ${purged} MB`
      console.log(`[Guardian] ${snapshot.message}`)
      recordAction(snapshot)
      break

    case 'critical':
      // 80%: detener scheduler + purge agresivo
      console.error(`[Guardian] CRITICAL: Contenedor a ${cgroup.pct}% — deteniendo scheduler`)
      if (!status.schedulerPaused) {
        pauseScheduler()
        snapshot.action = 'stop_scheduler'
        snapshot.message = `Scheduler detenido para reducir presión. Contenedor: ${cgroup.pct}%`
        console.log(`[Guardian] ${snapshot.message}`)
      }
      // También drop caches
      await dropPageCache()
      purgeNextDevCache()
      recordAction(snapshot)
      break

    case 'emergency':
      // 85%: detener worker + purgar todo
      console.error(`[Guardian] EMERGENCY: Contenedor a ${cgroup.pct}% — deteniendo worker + scheduler`)
      status.emergencyCount++
      if (!status.schedulerPaused) pauseScheduler()
      if (!status.workerPaused) {
        pauseWorker()
        snapshot.action = 'stop_worker'
        snapshot.message = `EMERGENCY #${status.emergencyCount}: Worker y scheduler detenidos. Contenedor: ${cgroup.pct}%`
        console.error(`[Guardian] ${snapshot.message}`)
      }
      await dropPageCache()
      recordAction(snapshot)
      break
  }

  // Agregar snapshot al historial
  snapshots.push(snapshot)
  if (snapshots.length > 20) snapshots.shift()
}

function recordAction(snapshot: GuardianSnapshot): void {
  status.lastAction = snapshot.action
  status.lastActionTime = snapshot.timestamp
  status.lastActionMessage = snapshot.message
  status.actionsExecuted++
}

// ── Public API ───────────────────────────────────────────────────────

export function startContainerGuardian(): void {
  if (intervalId) return
  status.active = true
  console.log(`[Guardian] Container Guardian iniciado (cada ${GUARDIAN_CONFIG.intervalMs / 1000}s, umbrales: watch=${GUARDIAN_CONFIG.watchPct}%, warn=${GUARDIAN_CONFIG.warnPct}%, critical=${GUARDIAN_CONFIG.criticalPct}%, emergency=${GUARDIAN_CONFIG.emergencyPct}%)`)

  // Primer tick inmediato
  tick().catch(err => console.error('[Guardian] Error en primer tick:', err))

  intervalId = setInterval(() => {
    tick().catch(err => console.error('[Guardian] Error en tick:', err))
  }, GUARDIAN_CONFIG.intervalMs)
}

export function stopContainerGuardian(): void {
  if (intervalId) {
    clearInterval(intervalId)
    intervalId = null
  }
  status.active = false
  console.log('[Guardian] Container Guardian detenido')
}

export function getGuardianStatus(): GuardianStatus {
  return { ...status, snapshots: [...snapshots] }
}

/**
 * Ejecutar drop_caches manualmente desde API.
 * Retorna true si tuvo éxito.
 */
export async function manualDropPageCache(): Promise<boolean> {
  const result = await dropPageCache()
  if (result) {
    const snapshot: GuardianSnapshot = {
      timestamp: new Date().toISOString(),
      cgroupPct: status.currentPct,
      cgroupUsageMB: 0,
      cgroupLimitMB: 0,
      level: status.level,
      action: 'drop_pagecache',
      message: 'drop_caches ejecutado manualmente',
    }
    recordAction(snapshot)
  }
  return result
}
