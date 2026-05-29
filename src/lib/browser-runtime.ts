// browser-runtime.ts — Utilidades de runtime para métricas del sistema
// Usado por CachePressurePanel y API de administración
// No depende de APIs externas — solo lectura de procesos y filesystem
//
// NOTA: dropPageCache() fue movida a container-guardian.ts porque requiere
// lógica de control (guardian decide cuándo ejecutarla). Esta capa expone
// solo lectura de métricas y purga de directorios de cache.

// CRÍTICO: No usar static imports de Node.js (fs, path, os).
// Este archivo es importado desde container-guardian.ts (via require),
// que a su vez viene de instrumentation.ts. Turbopack tracea todas las
// importaciones estáticas de Node.js y lanza warnings de Edge Runtime.
// Usamos dynamic imports dentro de funciones.

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

export async function getContainerMetrics(): Promise<ContainerMetrics> {
  try {
    const fs = await import('fs')
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
  const os = await import('os')
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

export async function getCacheMetrics(): Promise<CacheMetrics> {
  const fs = await import('fs')
  const path = await import('path')
  const cwd = process.cwd()

  const nextCacheDir = path.join(cwd, '.next')
  const nextCacheSizeMB = await dirSizeMB(nextCacheDir, fs, path)

  const turbopackDir = path.join(nextCacheDir, 'dev')
  const turbopackCacheSizeMB = await dirSizeMB(turbopackDir, fs, path)

  const nodeModulesDir = path.join(cwd, 'node_modules')
  const nodeModulesSizeMB = await dirSizeMB(nodeModulesDir, fs, path)

  const dbSizeMB = await getDbSizeMB(fs, path)

  const { backupCount, backupTotalMB } = await getBackupMetrics(fs, path)

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

async function dirSizeMB(dirPath: string, fs: any, pathMod: any): Promise<number> {
  try {
    let totalSize = 0
    const entries = fs.readdirSync(dirPath, { recursive: true, withFileTypes: true })
    for (const entry of entries) {
      if (entry.isFile()) {
        try {
          totalSize += fs.statSync(pathMod.join(dirPath, entry.name)).size
        } catch { /* skip */ }
      }
    }
    return Math.round(totalSize / (1024 * 1024) * 100) / 100
  } catch {
    return 0
  }
}

async function getDbSizeMB(fs: any, pathMod: any): Promise<number> {
  const dbUrl = process.env.DATABASE_URL || ''
  const match = dbUrl.match(/file:(.+)/)
  if (match) {
    try {
      return Math.round(fs.statSync(match[1]).size / (1024 * 1024) * 100) / 100
    } catch { /* skip */ }
  }
  // Fallback paths
  for (const p of [
    pathMod.join(process.cwd(), 'prisma', 'db', 'custom.db'),
    pathMod.join(process.cwd(), 'db', 'custom.db'),
  ]) {
    try {
      return Math.round(fs.statSync(p).size / (1024 * 1024) * 100) / 100
    } catch { /* skip */ }
  }
  return 0
}

async function getBackupMetrics(fs: any, pathMod: any): Promise<{ backupCount: number; backupTotalMB: number }> {
  const backupDir = pathMod.join(process.cwd(), 'backups')
  try {
    const files = fs.readdirSync(backupDir).filter(f => f.startsWith('snapshot-') && f.endsWith('.db'))
    let totalSize = 0
    for (const f of files) {
      try {
        totalSize += fs.statSync(pathMod.join(backupDir, f)).size
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
export async function purgeNextCache(): Promise<PurgeResult> {
  const fs = await import('fs')
  const path = await import('path')
  const devDir = path.join(process.cwd(), '.next', 'dev')
  try {
    const sizeBefore = await dirSizeMB(devDir, fs, path)
    if (fs.existsSync(devDir)) {
      fs.rmSync(devDir, { recursive: true, force: true })
    }
    const sizeAfter = await dirSizeMB(devDir, fs, path)
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
export async function purgeTurbopackCache(): Promise<PurgeResult> {
  const fs = await import('fs')
  const path = await import('path')
  const cacheDir = path.join(process.cwd(), '.next', 'cache')
  try {
    const sizeBefore = await dirSizeMB(cacheDir, fs, path)
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
export async function purgeOldBackups(): Promise<PurgeResult> {
  const fs = await import('fs')
  const path = await import('path')
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
