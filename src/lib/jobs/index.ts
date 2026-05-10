// Inicializacion del sistema de Job Queue - DECODEX Bolivia
// Punto de entrada unico: initJobSystem() + activateProductiveMode()
//
// IMPORTANTE: En Next.js con Turbopack, instrumentation.ts y los API routes
// corren en contextos de modulo diferentes. Por eso usamos globalThis en
// worker.ts para compartir estado. Esta funcion es idempotente — se puede
// llamar desde instrumentation.ts Y desde API routes sin duplicar workers.
//
// Flujo de arranque:
//   1. initJobSystem()          → registra runners, worker IDLE, health, guardian (sin scheduler)
//   2. [warmup de 2 minutos]
//   3. activateProductiveMode() → scheduler + worker productivo

import { startWorkerIdle, startWorker, stopWorker, registerDefaultRunners, getWorkerStats } from './worker'
import { startHealthMonitor, stopHealthMonitor } from './health'
import { startScheduler, stopScheduler } from './scheduler'
import { enqueue } from './queue'
import { WARMUP_CONFIG } from './constants'


// Flag de inicializacion via globalThis — en Next.js Turbopack,
// instrumentation.ts y API routes corren en contextos de modulo
// diferentes. Module-level variables NO se comparten.
const _gi = globalThis as unknown as { __decodex_jobs_initialized__: boolean | undefined }
const _ga = globalThis as unknown as { __decodex_jobs_active__: boolean | undefined }

function isInitialized(): boolean {
  return _gi.__decodex_jobs_initialized__ === true
}
function setInitialized(v: boolean): void {
  _gi.__decodex_jobs_initialized__ = v
}
function isActive(): boolean {
  return _ga.__decodex_jobs_active__ === true
}
function setActive(v: boolean): void {
  _ga.__decodex_jobs_active__ = v
}

// Iniciar sistema en modo IDLE (sin scheduler, sin ejecución de jobs)
// El worker hace polling pero no procesa nada hasta activateProductiveMode()
export async function initJobSystem(): Promise<void> {
  if (isInitialized()) return
  setInitialized(true)

  console.log('[Jobs] Iniciando sistema de Job Queue (modo IDLE)...')

  // 1. Registrar runners por defecto
  registerDefaultRunners()

  // 2. Iniciar worker en modo IDLE (polling pero no ejecuta)
  startWorkerIdle()

  // 3. Iniciar health monitor (cada 60s)
  startHealthMonitor()

  // 4. Iniciar Container Guardian (cada 30s — monitorea cgroup real)
  try {
    const { startContainerGuardian } = await import('./container-guardian')
    startContainerGuardian()
  } catch (err) {
    console.warn('[Jobs] Container Guardian no disponible (Edge Runtime):', (err as Error).message)
  }

  console.log('[Jobs] Sistema inicializado — worker IDLE, sin scheduler')
  console.log(`[Jobs] Warmup configurado: ${WARMUP_CONFIG.delayMs / 1000}s antes de activar modo productivo`)
}

// Activar modo productivo (scheduler + worker ejecuta jobs)
// Debe llamarse DESPUÉS del warmup para que el servidor esté estable
export async function activateProductiveMode(): Promise<void> {
  if (isActive()) {
    console.log('[Jobs] Modo productivo ya está activo')
    return
  }
  setActive(true)

  console.log('[Jobs] Activando modo productivo...')

  // 1. Activar worker (sale de idle, comienza a ejecutar jobs)
  startWorker()

  // 2. Iniciar scheduler (node-cron para fuentes y boletines)
  await startScheduler()

  console.log('[Jobs] Modo productivo activo — scheduler + worker ejecutando')
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
    productive: isActive(),
  }
}

// Detener todo el sistema
export async function shutdownJobSystem(): Promise<void> {
  stopScheduler()
  // Container Guardian — dynamic import para evitar Edge analysis
  try {
    const { stopContainerGuardian } = await import('./container-guardian')
    stopContainerGuardian()
  } catch { /* ya no estaba activo */ }
  stopHealthMonitor()
  stopWorker()
  setInitialized(false)
  setActive(false)
  console.log('[Jobs] Sistema detenido')
}
