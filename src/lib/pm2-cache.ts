/**
 * pm2-cache.ts — Caché compartido para pm2 jlist
 *
 * PROBLEMA: 5 endpoints del dashboard hacían execSync('pm2 jlist') en cada poll
 * (cada 5-15s), generando ~1,920 spawns de proceso hijo por hora.
 *
 * SOLUCIÓN: Un singleton que ejecuta pm2 jlist como máximo 1 vez cada 30 segundos.
 * Todas las lecturas dentro de la ventana TTL retornan el resultado en caché.
 *
 * Esto reduce 1,920 calls/hora a 120 calls/hora con cero pérdida de información
 * para el dashboard (que no necesita datos al segundo).
 */

import { execSync } from 'child_process'

export interface Pm2ProcessInfo {
  name: string
  status: string
  pid: number
  uptime: number
  memory: number
  cpu: number
}

interface Pm2CacheEntry {
  data: Pm2ProcessInfo[]
  timestamp: number
}

const CACHE_TTL_MS = 30_000 // 30 segundos
let cache: Pm2CacheEntry | null = null

/**
 * Retorna la lista de procesos PM2, usando caché de 30s.
 * Nunca llama pm2 jlist más de 1 vez cada 30 segundos.
 */
export function getPm2Processes(): Pm2ProcessInfo[] {
  const now = Date.now()

  // Retornar caché si está vigente
  if (cache && (now - cache.timestamp) < CACHE_TTL_MS) {
    return cache.data
  }

  // Ejecutar pm2 jlist (máximo 1 vez cada 30s)
  try {
    const output = execSync('pm2 jlist --no-color 2>/dev/null', {
      timeout: 5000,
      encoding: 'utf-8',
    })
    const list = JSON.parse(output) as Array<Record<string, unknown>>

    const processes: Pm2ProcessInfo[] = list.map(p => ({
      name: (p.name as string) || '',
      status: ((p.pm2_env as Record<string, unknown>)?.status as string) || '',
      pid: (p.pid as number) || 0,
      uptime: ((p.pm2_env as Record<string, unknown>)?.pm_uptime as number) || 0,
      memory: (p.monit as Record<string, unknown>)?.memory as number || 0,
      cpu: (p.monit as Record<string, unknown>)?.cpu as number || 0,
    }))

    cache = { data: processes, timestamp: now }
    return processes
  } catch {
    // Si pm2 falla, retornar caché viejo si existe
    return cache?.data || []
  }
}

/**
 * Busca un proceso PM2 por nombre en el caché.
 */
export function findPm2Process(name: string): Pm2ProcessInfo | undefined {
  return getPm2Processes().find(p => p.name === name)
}

/**
 * Verifica si un proceso PM2 está online.
 */
export function isPm2ProcessOnline(name: string): boolean {
  const proc = findPm2Process(name)
  return proc?.status === 'online'
}

/**
 * Invalidar el caché manualmente (para tests o después de pm2 restart).
 */
export function invalidatePm2Cache(): void {
  cache = null
}