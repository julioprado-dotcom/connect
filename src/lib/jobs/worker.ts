// Worker - loop de ejecucion con backpressure - DECODEX Bolivia
// Un solo worker que procesa jobs de uno en uno
// Estado compartido via globalThis para persistir entre contextos de Next.js

import { dequeue, complete, fail } from './queue'
import { WORKER_CONFIG, FLOW_CONTROL, QUEUE_LIMITS } from './constants'
import db from '@/lib/db'
import type { JobPayload, JobTipo, RunnerResult, RunnerFn } from './types'
import { run as runCheckFuente } from './runners/check-fuente'
import { run as runCheckIndicador } from './runners/check-indicador'
import { run as runScrapeFuente } from './runners/scrape-fuente'
import { run as runCaptureIndicador } from './runners/capture-indicador'
import { run as runGenerarBoletin } from './runners/generar-boletin'
import { run as runEnviarEntrega } from './runners/enviar-entrega'
import { run as runVerificarEnlaces } from './runners/verificar-enlaces'
import { run as runMantenimiento } from './runners/mantenimiento'
import { run as runConnectivityTest } from './runners/connectivity-test'

// Registro de runners por tipo de job
const runners = new Map<string, RunnerFn>()

// Registrar un runner
export function registerRunner(tipo: JobTipo, fn: RunnerFn): void {
  runners.set(tipo, fn)
}

// Obtener un runner
export function getRunner(tipo: JobTipo): RunnerFn | undefined {
  return runners.get(tipo)
}

// ─── Estado compartido via globalThis ─────────────────────────
// Next.js Turbopack ejecuta instrumentation.ts y API routes en
// contextos de módulo diferentes. Usar globalThis garantiza que
// el estado del worker persista entre contextos.

interface WorkerState {
  running: boolean
  idle: boolean              // true = hace polling pero no ejecuta jobs
  startTime: Date | null
  jobsCompleted: number
  jobsFailed: number
  lastJobTime: Date | null
  runnersRegistered: boolean
}

const _g = globalThis as unknown as { __decodex_worker__: WorkerState | undefined }

function getWorkerState(): WorkerState {
  if (!_g.__decodex_worker__) {
    _g.__decodex_worker__ = {
      running: false,
      idle: true,             // por defecto arranca en idle hasta warmup
      startTime: null,
      jobsCompleted: 0,
      jobsFailed: 0,
      lastJobTime: null,
      runnersRegistered: false,
    }
  }
  return _g.__decodex_worker__
}

// Estadisticas del worker
export function getWorkerStats() {
  const ws = getWorkerState()
  const mode = ws.idle ? 'idle' : 'active'
  const uptime = ws.startTime
    ? Math.floor((Date.now() - ws.startTime.getTime()) / 1000)
    : 0
  const hours = Math.floor(uptime / 3600)
  const minutes = Math.floor((uptime % 3600) / 60)
  const seconds = uptime % 60

  const jobsPerHour = uptime > 0
    ? Math.round(((ws.jobsCompleted + ws.jobsFailed) / uptime) * 3600)
    : 0

  return {
    running: ws.running,
    mode,
    uptime: uptime > 0 ? `${hours}h ${minutes}m ${seconds}s` : '0s',
    jobsCompleted: ws.jobsCompleted,
    jobsFailed: ws.jobsFailed,
    jobsPerHour,
    startTime: ws.startTime,
    lastJobTime: ws.lastJobTime,
  }
}

// Iniciar el worker en modo IDLE (polling pero no ejecuta jobs)
export function startWorkerIdle(): void {
  const ws = getWorkerState()
  if (ws.running) {
    console.log('[Worker] Ya esta corriendo')
    return
  }
  ws.running = true
  ws.idle = true
  ws.startTime = new Date()
  console.log('[Worker] Iniciado en modo IDLE (esperando warmup)')

  workerLoop().catch(err => {
    console.error('[Worker] Error fatal:', err)
    ws.running = false
  })
}

// Iniciar el worker (background, no bloquea el hilo principal)
export function startWorker(): void {
  const ws = getWorkerState()
  if (ws.running && !ws.idle) {
    console.log('[Worker] Ya esta corriendo en modo productivo')
    return
  }
  ws.running = true
  ws.idle = false
  if (!ws.startTime) ws.startTime = new Date()
  console.log('[Worker] Activado — modo productivo')

  // Ejecutar en background
  workerLoop().catch(err => {
    console.error('[Worker] Error fatal:', err)
    ws.running = false
  })
}

// Detener el worker
export function stopWorker(): void {
  const ws = getWorkerState()
  ws.running = false
  ws.idle = false
  console.log('[Worker] Detenido')
}

// ─── Event Loop Lag Monitor ────────────────────────────────
// Mide cuánto tarda el event loop en procesar un setTimeout(0).
// Si el lag supera el umbral, el worker se pausa automáticamente.

function measureEventLoopLag(): Promise<number> {
  return new Promise<number>((resolve) => {
    const start = Date.now()
    setTimeout(() => {
      resolve(Date.now() - start)
    }, 0)
  })
}

// Verificar si hay demasiados scrape_fuente pendientes
async function heavyJobPressure(): Promise<number> {
  try {
    return await db.job.count({
      where: { estado: 'pendiente', tipo: 'scrape_fuente' },
    })
  } catch {
    return 0
  }
}

// Loop principal
async function workerLoop(): Promise<void> {
  const ws = getWorkerState()

  while (ws.running) {
    try {
      // Si el worker está en idle, no ejecutar jobs — solo esperar
      if (ws.idle) {
        await sleep(WORKER_CONFIG.pollIntervalMs)
        continue
      }

      // ─── FLOW CONTROL: Verificar salud del event loop ───
      const lag = await measureEventLoopLag()
      if (lag > FLOW_CONTROL.eventLoopLagThresholdMs) {
        console.warn(
          `[Worker] Event loop lag ${lag}ms > ${FLOW_CONTROL.eventLoopLagThresholdMs}ms — pausando 10s`
        )
        await sleep(10_000)
        continue
      }

      // ─── FLOW CONTROL: Verificar presión de memoria ───
      if (typeof process.memoryUsage === 'function') {
        const heapMb = Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
        if (heapMb > FLOW_CONTROL.heapCriticalMb) {
          console.warn(
            `[Worker] Heap critico ${heapMb}MB > ${FLOW_CONTROL.heapCriticalMb}MB — pausando 30s`
          )
          await sleep(30_000)
          continue
        }
      }

      // ─── FLOW CONTROL: Verificar presión de jobs pesados ───
      const heavyCount = await heavyJobPressure()
      if (heavyCount >= QUEUE_LIMITS.maxHeavyPending) {
        console.log(
          `[Worker] ${heavyCount} scrape_fuente pendientes (max ${QUEUE_LIMITS.maxHeavyPending}) — esperando`
        )
        await sleep(WORKER_CONFIG.pollIntervalMs)
        continue
      }

      const job = await dequeue()

      if (!job) {
        // No hay jobs pendientes - esperar antes de consultar de nuevo
        await sleep(WORKER_CONFIG.pollIntervalMs)
        continue
      }

      const jobId = job.id as string
      const tipo = job.tipo as JobTipo
      const payload = job.payload as JobPayload

      console.log(`[Worker] Ejecutando job ${jobId} (${tipo}) prioridad=${job.prioridad}`)

      // Buscar runner registrado
      const runner = getRunner(tipo)
      if (!runner) {
        await fail(jobId, `No existe runner para tipo: ${tipo}`)
        ws.jobsFailed++
        console.warn(`[Worker] Sin runner para ${tipo}`)
        await sleep(WORKER_CONFIG.delayMs)
        continue
      }

      // Ejecutar con timeout implicito por el fetch del check-first
      try {
        const result: RunnerResult = await runner(payload)

        if (result.success) {
          await complete(jobId, result.data ?? {})
          ws.jobsCompleted++
          ws.lastJobTime = new Date()
          console.log(`[Worker] Job ${jobId} completado`)
        } else {
          await fail(jobId, result.error ?? 'Error desconocido')
          ws.jobsFailed++
          console.error(`[Worker] Job ${jobId} fallido: ${result.error}`)
        }
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error)
        await fail(jobId, msg)
        ws.jobsFailed++
        console.error(`[Worker] Job ${jobId} exception: ${msg}`)
      }

      // Backpressure: esperar entre jobs con jitter anti-ban
      // Jobs pesados (scrape, generate) necesitan más tiempo de recuperación
      const baseDelay = (tipo === 'scrape_fuente')
        ? WORKER_CONFIG.delayScrapeMs
        : (tipo === 'generar_boletin')
          ? WORKER_CONFIG.delayGenerateMs
          : WORKER_CONFIG.delayMs
      const jitter = Math.floor(baseDelay * 0.3 * Math.random())
      await sleep(baseDelay + jitter)
    } catch (error: unknown) {
      // Error del sistema (no del job)
      const msg = error instanceof Error ? error.message : String(error)
      console.error(`[Worker] Error en loop: ${msg}`)
      await sleep(WORKER_CONFIG.errorBackoffMs)
    }
  }

  console.log('[Worker] Loop terminado')
}

// Registrar todos los runners del sistema
export function registerDefaultRunners(): void {
  const ws = getWorkerState()
  if (ws.runnersRegistered) return
  ws.runnersRegistered = true

  // Check-First runners (Capa 2)
  registerRunner('check_fuente', runCheckFuente)
  registerRunner('check_indicador', runCheckIndicador)

  // Captura runners (Capa 1)
  registerRunner('scrape_fuente', runScrapeFuente)
  registerRunner('capture_indicador', runCaptureIndicador)

  // Productos ONION200
  registerRunner('generar_boletin', runGenerarBoletin)
  registerRunner('enviar_entrega', runEnviarEntrega)

  // Verificacion y mantenimiento
  registerRunner('verificar_enlaces', runVerificarEnlaces)
  registerRunner('mantenimiento', runMantenimiento)

  // Startup
  registerRunner('connectivity_test', runConnectivityTest)

  console.log('[Worker] Runners registrados (9 tipos)')
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Extraer dominio de una URL para rate limiting por dominio
function extractDomain(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return 'unknown'
  }
}
