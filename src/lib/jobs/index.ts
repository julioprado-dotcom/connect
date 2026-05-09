// Inicializacion del sistema de Job Queue - DECODEX Bolivia
// Punto de entrada unico: initJobSystem()
//
// IMPORTANTE: En Next.js con Turbopack, instrumentation.ts y los API routes
// corren en contextos de modulo diferentes. Por eso usamos globalThis en
// worker.ts para compartir estado. Esta funcion es idempotente — se puede
// llamar desde instrumentation.ts Y desde API routes sin duplicar workers.

import { startWorker, stopWorker, registerDefaultRunners, getWorkerStats } from './worker'
import { startHealthMonitor, stopHealthMonitor } from './health'
import { startScheduler, stopScheduler } from './scheduler'


let initialized = false

// Iniciar todo el sistema (llamar una sola vez)
export async function initJobSystem(): Promise<void> {
  if (initialized) return
  initialized = true

  console.log('[Jobs] Iniciando sistema de Job Queue...')

  // 1. Registrar runners por defecto (mantenimiento)
  registerDefaultRunners()

  // 2. Iniciar worker (background loop)
  startWorker()

  // 3. Iniciar health monitor (cada 60s)
  startHealthMonitor()

  // 4. Iniciar scheduler (node-cron para fuentes y boletines)
  await startScheduler()

  console.log('[Jobs] Sistema de Job Queue iniciado')
}

// Garantizar que el worker esté corriendo — llamado desde API routes
// Usa globalThis para no duplicar el worker loop
export function ensureWorkerRunning(): void {
  const stats = getWorkerStats()
  if (!stats.running) {
    console.log('[Jobs] Worker no estaba corriendo — iniciando desde ensureWorkerRunning()')
    registerDefaultRunners()
    startWorker()
  }
}

// API publica para registrar runners desde otros modulos
export { registerRunner } from './worker'

// API publica para obtener stats
export function getStats() {
  return {
    worker: getWorkerStats(),
  }
}

// Detener todo el sistema
export function shutdownJobSystem(): void {
  stopScheduler()
  stopHealthMonitor()
  stopWorker()
  initialized = false
  console.log('[Jobs] Sistema detenido')
}
