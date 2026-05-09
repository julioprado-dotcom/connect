// browser-runtime.ts — Utilidades de runtime para métricas del sistema
// Usado por CachePressurePanel y API de administración
// No depende de APIs externas — solo lectura de procesos y filesystem

import fs from 'fs'
import path from 'path'
import os from 'os'

// ── Métricas de Memoria ──────────────────────────────────────────────

export interface MemoryMetrics {
  rss: number        // MB
  heapUsed: number   // MB
  heapLimit: number  // MB
  heapPct: number    // 0-100
  external: number   // MB
  arrayBuffers: number // MB
}

export function getMemoryMetrics(): MemoryMetrics {
  const mem = process.memoryUsage()
  const heapLimit = getHeapLimit()
  return {
    rss: Math.round(mem.rss / (1024 * 1024) * 100) / 100,
    heapUsed: Math.round(mem.heapUsed / (1024 * 1024) * 100) / 100,
    heapLimit: Math.round(heapLimit / (1024 * 1024) * 100) / 100,
    heapPct: Math.round((mem.heapUsed / heapLimit) * 10000) / 100,
    external: Math.round(mem.external / (1024 * 1024) * 100) / 100,
    arrayBuffers: Math.round((mem.arrayBuffers || 0) / (1024 * 1024) * 100) / 100,
  }
}

function getHeapLimit(): number {
  const match = (process.env.NODE_OPTIONS || '').match(/--max-old-space-size=(\d+)/)
  if (match) return parseInt(match[1], 10) * 1024 * 1024
  try { return (require('v8') as { getHeapStatistics: () => { heap_size_limit: number } }).getHeapStatistics().heap_size_limit } catch { return 4041 * 1024 * 1024 }
}

// ── Métricas de Contenedor ───────────────────────────────────────────

export interface ContainerMetrics {
  usageMB: number
  limitMB: number
  pct: number
  availableMB: number
}

export function getContainerMetrics(): ContainerMetrics {
  try {
    const limit = parseInt(fs.readFileSync('/sys/fs/cgroup/memory/memory.limit_in_bytes', 'utf-8').trim(), 10)
    const usage = parseInt(fs.readFileSync('/sys/fs/cgroup/memory/memory.usage_in_bytes', 'utf-8').trim(), 10)
    if (limit > 0) {
      return {
        usageMB: Math.round(usage / (1024 * 1024) * 100) / 100,
        limitMB: Math.round(limit / (1024 * 1024) * 100) / 100,
        pct: Math.round((usage / limit) * 10000) / 100,
        availableMB: Math.round((limit - usage) / (1024 * 1024) * 100) / 100,
      }
    }
  } catch { /* fallback */ }
  const total = os.totalmem()
  const free = os.freemem()
  return {
    usageMB: Math.round((total - free) / (1024 * 1024) * 100) / 100,
    limitMB: Math.round(total / (1024 * 1024) * 100) / 100,
    pct: Math.round(((total - free) / total) * 10000) / 100,
    availableMB: Math.round(free / (1024 * 1024) * 100) / 100,
  }
}

// ── Métricas de Cache ────────────────────────────────────────────────

export interface CacheMetrics {
  nextCacheDir: string
  nextCacheSizeMB: number
  turbopackCacheSizeMB: number
  nodeModulesSizeMB: number
  dbSizeMB: number
  backupCount: number
  backupTotalMB: number
}

export function getCacheMetrics(): CacheMetrics {
  const cwd = process.cwd()

  const nextCacheDir = path.join(cwd, '.next')
  const nextCacheSizeMB = dirSizeMB(nextCacheDir)

  const turbopackDir = path.join(nextCacheDir, 'dev')
  const turbopackCacheSizeMB = dirSizeMB(turbopackDir)

  const nodeModulesDir = path.join(cwd, 'node_modules')
  const nodeModulesSizeMB = dirSizeMB(nodeModulesDir)

  const dbSizeMB = getDbSizeMB()

  const { backupCount, backupTotalMB } = getBackupMetrics()

  return {
    nextCacheDir,
    nextCacheSizeMB,
    turbopackCacheSizeMB,
    nodeModulesSizeMB,
    dbSizeMB,
    backupCount,
    backupTotalMB,
  }
}

function dirSizeMB(dirPath: string): number {
  try {
    let totalSize = 0
    const entries = fs.readdirSync(dirPath, { recursive: true, withFileTypes: true })
    for (const entry of entries) {
      if (entry.isFile()) {
        try {
          totalSize += fs.statSync(path.join(dirPath, entry.name)).size
        } catch { /* skip */ }
      }
    }
    return Math.round(totalSize / (1024 * 1024) * 100) / 100
  } catch {
    return 0
  }
}

function getDbSizeMB(): number {
  const dbUrl = process.env.DATABASE_URL || ''
  const match = dbUrl.match(/file:(.+)/)
  if (match) {
    try {
      return Math.round(fs.statSync(match[1]).size / (1024 * 1024) * 100) / 100
    } catch { /* skip */ }
  }
  // Fallback paths
  for (const p of [
    path.join(process.cwd(), 'prisma', 'db', 'custom.db'),
    path.join(process.cwd(), 'db', 'custom.db'),
  ]) {
    try {
      return Math.round(fs.statSync(p).size / (1024 * 1024) * 100) / 100
    } catch { /* skip */ }
  }
  return 0
}

function getBackupMetrics(): { backupCount: number; backupTotalMB: number } {
  const backupDir = path.join(process.cwd(), 'backups')
  try {
    const files = fs.readdirSync(backupDir).filter(f => f.startsWith('snapshot-') && f.endsWith('.db'))
    let totalSize = 0
    for (const f of files) {
      try {
        totalSize += fs.statSync(path.join(backupDir, f)).size
      } catch { /* skip */ }
    }
    return {
      backupCount: files.length,
      backupTotalMB: Math.round(totalSize / (1024 * 1024) * 100) / 100,
    }
  } catch {
    return { backupCount: 0, backupTotalMB: 0 }
  }
}

// ── Operaciones de Limpieza ───────────────────────────────────────────

export interface PurgeResult {
  success: boolean
  target: string
  freedMB: number
  error?: string
}

/**
 * Limpia la cache de Next.js (.next/dev).
 * DEBE llamarse solo desde API admin con confirmación.
 */
export function purgeNextCache(): PurgeResult {
  const devDir = path.join(process.cwd(), '.next', 'dev')
  try {
    const sizeBefore = dirSizeMB(devDir)
    if (fs.existsSync(devDir)) {
      fs.rmSync(devDir, { recursive: true, force: true })
    }
    const sizeAfter = dirSizeMB(devDir)
    return {
      success: true,
      target: '.next/dev',
      freedMB: Math.max(0, sizeBefore - sizeAfter),
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return { success: false, target: '.next/dev', freedMB: 0, error: msg }
  }
}

/**
 * Limpia la cache de Turbopack (.next/cache).
 */
export function purgeTurbopackCache(): PurgeResult {
  const cacheDir = path.join(process.cwd(), '.next', 'cache')
  try {
    const sizeBefore = dirSizeMB(cacheDir)
    if (fs.existsSync(cacheDir)) {
      fs.rmSync(cacheDir, { recursive: true, force: true })
    }
    return {
      success: true,
      target: '.next/cache',
      freedMB: sizeBefore,
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return { success: false, target: '.next/cache', freedMB: 0, error: msg }
  }
}

/**
 * Limpia backups antiguos (mantiene los últimos 3).
 */
export function purgeOldBackups(): PurgeResult {
  const backupDir = path.join(process.cwd(), 'backups')
  try {
    const files = fs.readdirSync(backupDir)
      .filter(f => f.startsWith('snapshot-') && f.endsWith('.db'))
      .sort()
      .reverse()

    if (files.length <= 3) {
      return { success: true, target: 'backups', freedMB: 0 }
    }

    const toDelete = files.slice(3)
    let freedBytes = 0
    for (const f of toDelete) {
      try {
        const stat = fs.statSync(path.join(backupDir, f))
        freedBytes += stat.size
        fs.unlinkSync(path.join(backupDir, f))
      } catch { /* skip */ }
    }

    return {
      success: true,
      target: 'backups',
      freedMB: Math.round(freedBytes / (1024 * 1024) * 100) / 100,
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return { success: false, target: 'backups', freedMB: 0, error: msg }
  }
}

// ── Formato helpers ───────────────────────────────────────────────────

export function formatMB(mb: number): string {
  if (mb < 1) return `${Math.round(mb * 1024)} KB`
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`
  return `${mb.toFixed(1)} MB`
}
