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
//
// CRÍTICO: Todos los imports son dinámicos para evitar que Turbopack
// trace módulos de Node.js (fs, path, node-cron, etc.) al compilar
// instrumentation.ts para Edge Runtime. Las funciones internas hacen
// await import() solo cuando se ejecutan en Node.js runtime.

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

  // Dynamic imports — solo se resuelven en Node.js runtime
  const { registerDefaultRunners } = await import('./worker')
  const { startWorkerIdle } = await import('./worker')
  const { startHealthMonitor } = await import('./health')

  // 1. Registrar runners por defecto
  await registerDefaultRunners()

  // 2. Iniciar worker en modo IDLE (polling pero no ejecuta)
  startWorkerIdle()

  // 3. Iniciar health monitor (cada 60s)
  startHealthMonitor()

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

  // Dynamic imports
  const { startWorker } = await import('./worker')
  const { startScheduler } = await import('./scheduler')

  // 1. Activar worker (sale de idle, comienza a ejecutar jobs)
  startWorker()

  // 2. Iniciar scheduler automáticamente — arranca con todas las fuentes programadas
  await startScheduler()

  // 3. Backup scheduler — desactivado por defecto
  // const { startBackupScheduler } = await import('./backup-scheduler')
  // startBackupScheduler()

  console.log('[Jobs] Modo productivo activo — worker + scheduler ejecutando')
}

// Garantizar que el worker esté corriendo — llamado desde API routes
// Usa globalThis para no duplicar el worker loop
export async function ensureWorkerRunning(): Promise<void> {
  const { getWorkerStats, registerDefaultRunners, startWorker } = await import('./worker')
  const stats = getWorkerStats()
  if (!stats.running) {
    console.log('[Jobs] Worker no estaba corriendo — iniciando desde ensureWorkerRunning()')
    await registerDefaultRunners()
    startWorker()
  }
}

// API publica para registrar runners desde otros modulos
export async function registerRunner(tipo: string, fn: (...args: unknown[]) => Promise<unknown>): Promise<void> {
  const { registerRunner: _registerRunner } = await import('./worker')
  _registerRunner(tipo as any, fn as any)
}

// API publica para obtener stats
export async function getStats() {
  const { getWorkerStats } = await import('./worker')
  return {
    worker: getWorkerStats(),
    productive: isActive(),
  }
}

// Detener todo el sistema
export async function shutdownJobSystem(): Promise<void> {
  try {
    const { stopBackupScheduler } = await import('./backup-scheduler')
    stopBackupScheduler()
  } catch { /* backup scheduler no disponible */ }

  try {
    const { stopScheduler } = await import('./scheduler')
    stopScheduler()
  } catch { /* scheduler no disponible */ }

  try {
    const { stopContainerGuardian } = await import('./container-guardian')
    stopContainerGuardian()
  } catch { /* guardian no disponible */ }

  try {
    const { stopHealthMonitor } = await import('./health')
    stopHealthMonitor()
  } catch { /* health monitor no disponible */ }

  try {
    const { stopWorker } = await import('./worker')
    stopWorker()
  } catch { /* worker no disponible */ }

  setInitialized(false)
  setActive(false)
  console.log('[Jobs] Sistema detenido')
}
