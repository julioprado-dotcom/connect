// Worker - loop de ejecucion con backpressure - DECODEX Bolivia
// Un solo worker que procesa jobs de uno en uno
// Estado compartido via globalThis para persistir entre contextos de Next.js

import { dequeue, complete, fail } from './queue'
import { WORKER_CONFIG } from './constants'
import { domainRateLimiter } from './anti-ban'
import type { JobPayload, JobTipo, RunnerResult, RunnerFn } from './types'
import { run as runCheckFuente } from './runners/check-fuente'
import { run as runCheckIndicador } from './runners/check-indicador'
import { run as runScrapeFuente } from './runners/scrape-fuente'
import { run as runCaptureIndicador } from './runners/capture-indicador'
import { run as runGenerarBoletin } from './runners/generar-boletin'
import { run as runEnviarEntrega } from './runners/enviar-entrega'
import { run as runVerificarEnlaces } from './runners/verificar-enlaces'
import { run as runMantenimiento } from './runners/mantenimiento'

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
    uptime: uptime > 0 ? `${hours}h ${minutes}m ${seconds}s` : '0s',
    jobsCompleted: ws.jobsCompleted,
    jobsFailed: ws.jobsFailed,
    jobsPerHour,
    startTime: ws.startTime,
    lastJobTime: ws.lastJobTime,
  }
}

// Iniciar el worker (background, no bloquea el hilo principal)
export function startWorker(): void {
  const ws = getWorkerState()
  if (ws.running) {
    console.log('[Worker] Ya esta corriendo')
    return
  }
  ws.running = true
  ws.startTime = new Date()
  console.log('[Worker] Iniciado (globalThis shared state)')

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
  console.log('[Worker] Detenido')
}

// Loop principal
async function workerLoop(): Promise<void> {
  const ws = getWorkerState()

  while (ws.running) {
    try {
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
      const jitter = Math.floor(WORKER_CONFIG.delayMs * 0.3 * Math.random())
      await sleep(WORKER_CONFIG.delayMs + jitter)
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

  console.log('[Worker] Runners registrados (8 tipos)')
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
