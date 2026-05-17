#!/usr/bin/env npx tsx
/**
 * worker-service.ts — El Obrero (Proceso Independiente PM2)
 *
 * Servicio dedicado que escanea la tabla Job y ejecuta tareas pesadas.
 * Se ejecuta como proceso PM2 independiente del servidor Next.js.
 *
 * Uso: npx tsx worker-service.ts
 * PM2: pm2 start "npx tsx worker-service.ts" --name decodex-worker
 *
 * Funcionalidad:
 * - Polling cada 5s de la tabla Job (estado: 'pendiente')
 * - Ejecuta runners registrados (check_fuente, scrape_fuente, etc.)
 * - Flow control: event loop lag, memoria, backpressure
 * - Graceful shutdown: SIGINT/SIGTERM → termina job actual → exit
 * - Health heartbeat: escribe timestamp a /tmp/decodex-worker-heartbeat
 */

import 'dotenv/config';
import os from 'os';
import { dequeue, complete, fail, reclaimOrphanJobs } from './src/lib/jobs/queue';
import { WORKER_CONFIG, FLOW_CONTROL, QUEUE_LIMITS } from './src/lib/jobs/constants';
import { registerDefaultRunners } from './src/lib/jobs/worker';
import { run as runCheckFuente } from './src/lib/jobs/runners/check-fuente';
import { run as runCheckIndicador } from './src/lib/jobs/runners/check-indicador';
import { run as runScrapeFuente } from './src/lib/jobs/runners/scrape-fuente';
import { run as runCaptureIndicador } from './src/lib/jobs/runners/capture-indicador';
import { run as runGenerarBoletin } from './src/lib/jobs/runners/generar-boletin';
import { run as runEnviarEntrega } from './src/lib/jobs/runners/enviar-entrega';
import { run as runVerificarEnlaces } from './src/lib/jobs/runners/verificar-enlaces';
import { run as runMantenimiento } from './src/lib/jobs/runners/mantenimiento';
import { run as runConnectivityTest } from './src/lib/jobs/runners/connectivity-test';
import type { JobPayload, JobTipo, RunnerResult, RunnerFn } from './src/lib/jobs/types';
import fs from 'fs';
import path from 'path';
import db from './src/lib/db';

// ═══════════════════════════════════════════════════════════════
// Registro de Runners
// ═══════════════════════════════════════════════════════════════

const runners = new Map<string, RunnerFn>();

function registerRunner(tipo: JobTipo, fn: RunnerFn): void {
  runners.set(tipo, fn);
}

function registerAllRunners(): void {
  registerRunner('check_fuente', runCheckFuente);
  registerRunner('check_indicador', runCheckIndicador);
  registerRunner('scrape_fuente', runScrapeFuente);
  registerRunner('capture_indicador', runCaptureIndicador);
  registerRunner('generar_boletin', runGenerarBoletin);
  registerRunner('enviar_entrega', runEnviarEntrega);
  registerRunner('verificar_enlaces', runVerificarEnlaces);
  registerRunner('mantenimiento', runMantenimiento);
  registerRunner('connectivity_test', runConnectivityTest);
  console.log(`[Worker-Service] ${runners.size} runners registrados`);
}

// ═══════════════════════════════════════════════════════════════
// Estado del Worker
// ═══════════════════════════════════════════════════════════════

interface WorkerServiceState {
  running: boolean;
  startTime: Date | null;
  jobsCompleted: number;
  jobsFailed: number;
  lastJobTime: Date | null;
  currentJobId: string | null;
}

const state: WorkerServiceState = {
  running: true,
  startTime: new Date(),
  jobsCompleted: 0,
  jobsFailed: 0,
  lastJobTime: null,
  currentJobId: null,
};

// ═══════════════════════════════════════════════════════════════
// Health Heartbeat — escribe timestamp para que el dashboard
// sepa que el worker está vivo sin necesitar conectarse a PM2.
// ═══════════════════════════════════════════════════════════════

const HEARTBEAT_PATH = path.join(os.tmpdir(), 'decodex-worker-heartbeat');

function writeHeartbeat(): void {
  try {
    const data = JSON.stringify({
      pid: process.pid,
      uptime: state.startTime ? Math.floor((Date.now() - state.startTime.getTime()) / 1000) : 0,
      jobsCompleted: state.jobsCompleted,
      jobsFailed: state.jobsFailed,
      lastJobTime: state.lastJobTime?.toISOString() ?? null,
      currentJobId: state.currentJobId,
      timestamp: new Date().toISOString(),
    });
    fs.writeFileSync(HEARTBEAT_PATH, data);
  } catch { /* ignore */ }
}

function cleanupHeartbeat(): void {
  try { fs.unlinkSync(HEARTBEAT_PATH); } catch { /* ignore */ }
}

// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function measureEventLoopLag(): Promise<number> {
  return new Promise<number>((resolve) => {
    const start = Date.now();
    setTimeout(() => resolve(Date.now() - start), 0);
  });
}

async function heavyJobPressure(): Promise<number> {
  try {
    return await db.job.count({ where: { estado: 'pendiente', tipo: 'scrape_fuente' } });
  } catch { return 0; }
}

// ═══════════════════════════════════════════════════════════════
// Main Loop
// ═══════════════════════════════════════════════════════════════

async function main(): Promise<void> {
  console.log('═══════════════════════════════════════════════════');
  console.log('  DECODEX Worker Service — Proceso Independiente');
  console.log(`  PID: ${process.pid}`);
  console.log(`  Node: ${process.version}`);
  console.log(`  Memoria inicial: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`);
  console.log('═══════════════════════════════════════════════════');

  // Registrar runners
  registerAllRunners();

  // Escribir heartbeat cada 5s
  const heartbeatInterval = setInterval(writeHeartbeat, 5000);
  writeHeartbeat();

  // Reclaim orphans al arrancar
  try {
    const reclaimed = await reclaimOrphanJobs(10 * 60 * 1000);
    if (reclaimed > 0) console.log(`[Worker-Service] Reclaim: ${reclaimed} jobs huerfanos recuperados`);
  } catch (err) {
    console.error('[Worker-Service] Error en reclaim inicial:', err);
  }

  // Main loop
  while (state.running) {
    try {
      // Flow control: event loop lag
      const lag = await measureEventLoopLag();
      if (lag > FLOW_CONTROL.eventLoopLagThresholdMs) {
        console.warn(`[Worker-Service] Event loop lag ${lag}ms — pausando 10s`);
        await sleep(10_000);
        continue;
      }

      // Flow control: memoria
      if (typeof process.memoryUsage === 'function') {
        const heapMb = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
        if (heapMb > FLOW_CONTROL.heapCriticalMb) {
          console.warn(`[Worker-Service] Heap critico ${heapMb}MB — pausando 30s`);
          await sleep(30_000);
          continue;
        }
      }

      // Flow control: presión de heavy jobs
      const heavyCount = await heavyJobPressure();
      if (heavyCount >= QUEUE_LIMITS.maxHeavyPending) {
        console.log(`[Worker-Service] ${heavyCount} scrape_fuente pendientes — esperando`);
        await sleep(WORKER_CONFIG.pollIntervalMs);
        continue;
      }

      // Dequeue
      const job = await dequeue();
      if (!job) {
        await sleep(WORKER_CONFIG.pollIntervalMs);
        continue;
      }

      const jobId = job.id as string;
      const tipo = job.tipo as JobTipo;
      const payload = job.payload as JobPayload;

      state.currentJobId = jobId;
      console.log(`[Worker-Service] Ejecutando job ${jobId} (${tipo}) prioridad=${job.prioridad}`);

      const runner = runners.get(tipo);
      if (!runner) {
        await fail(jobId, `No existe runner para tipo: ${tipo}`);
        state.jobsFailed++;
        console.warn(`[Worker-Service] Sin runner para ${tipo}`);
        state.currentJobId = null;
        await sleep(WORKER_CONFIG.delayMs);
        continue;
      }

      // Ejecutar
      try {
        const result: RunnerResult = await runner(payload);

        if (result.success) {
          await complete(jobId, result.data ?? {});
          state.jobsCompleted++;
          state.lastJobTime = new Date();
          console.log(`[Worker-Service] Job ${jobId} completado`);
        } else {
          await fail(jobId, result.error ?? 'Error desconocido');
          state.jobsFailed++;
          console.error(`[Worker-Service] Job ${jobId} fallido: ${result.error}`);
        }
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        await fail(jobId, msg);
        state.jobsFailed++;
        console.error(`[Worker-Service] Job ${jobId} exception: ${msg}`);
      }

      state.currentJobId = null;

      // Backpressure
      const baseDelay = tipo === 'scrape_fuente'
        ? WORKER_CONFIG.delayScrapeMs
        : tipo === 'generar_boletin'
          ? WORKER_CONFIG.delayGenerateMs
          : WORKER_CONFIG.delayMs;
      const jitter = Math.floor(baseDelay * 0.3 * Math.random());
      await sleep(baseDelay + jitter);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[Worker-Service] Error en loop: ${msg}`);
      await sleep(WORKER_CONFIG.errorBackoffMs);
    }
  }

  // Cleanup
  clearInterval(heartbeatInterval);
  cleanupHeartbeat();
  console.log('[Worker-Service] Loop terminado — shutdown limpio');
  await db.$disconnect();
}

// ═══════════════════════════════════════════════════════════════
// Graceful Shutdown
// ═══════════════════════════════════════════════════════════════

async function shutdown(signal: string): Promise<void> {
  console.log(`\n[Worker-Service] Recibida señal ${signal} — cerrando...`);
  state.running = false;

  // Esperar a que termine el job actual (máximo 30s)
  const deadline = Date.now() + 30_000;
  while (state.currentJobId && Date.now() < deadline) {
    console.log(`[Worker-Service] Esperando job ${state.currentJobId}...`);
    await sleep(1000);
  }

  if (state.currentJobId) {
    console.warn(`[Worker-Service] Job ${state.currentJobId} no terminó — forzando shutdown`);
    // Reclaim: devolver el job a pendiente
    try { await reclaimOrphanJobs(0); } catch { /* ignore */ }
  }

  cleanupHeartbeat();
  console.log(`[Worker-Service] Shutdown completo. Stats: ${state.jobsCompleted} completados, ${state.jobsFailed} fallidos`);
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('uncaughtException', (err) => {
  console.error('[Worker-Service] Uncaught exception:', err);
  writeHeartbeat();
});
process.on('unhandledRejection', (reason) => {
  console.error('[Worker-Service] Unhandled rejection:', reason);
  writeHeartbeat();
});

// ═══════════════════════════════════════════════════════════════
// Start
// ═══════════════════════════════════════════════════════════════

main().catch((err) => {
  console.error('[Worker-Service] Fatal error:', err);
  process.exit(1);
});
