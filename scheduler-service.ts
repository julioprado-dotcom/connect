#!/usr/bin/env npx tsx
/**
 * scheduler-service.ts — El Jefe (Proceso Independiente PM2)
 *
 * Servicio dedicado que decide CUÁNDO lanzar tareas y las envía a la cola.
 * Se ejecuta como proceso PM2 independiente del servidor Next.js y del Worker.
 *
 * Uso: npx tsx scheduler-service.ts
 * PM2: pm2 start "npx tsx scheduler-service.ts" --name decodex-scheduler
 *
 * Funcionalidad:
 * - Lee fuentes activas de la DB y programa checks con node-cron
 * - Generación automática de boletines ONION200
 * - Captura de indicadores Tier 1 (batch diario)
 * - Mantenimiento nocturno
 * - Reschedule periódico (cada 6h) para recalculer horarios
 * - Graceful shutdown: detiene todas las tareas cron → exit
 * - Health heartbeat: escribe timestamp para el dashboard
 */

import 'dotenv/config';
import os from 'os';
import fs from 'fs';
import path from 'path';
import cron from 'node-cron';
import type { ScheduledTask } from 'node-cron';
import db from './src/lib/db';
import { enqueue } from './src/lib/jobs/queue';
import { getFrecuenciaEfectiva, frecuenciaToChecksDia } from './src/lib/jobs/frequency/calculator';
import { calcularHorariosOptimos, getHorariosDefault } from './src/lib/jobs/histogram/calculator';
import { buildCronEntries, getBoletinCronEntries, getMantenimientoCronEntry, formatCronHuman } from './src/lib/jobs/histogram/cron-builder';
import { CHECK_FIRST_CONFIG, QUEUE_LIMITS } from './src/lib/jobs/constants';
import { determinarCapa } from './src/lib/jobs/source-lifecycle';

// ═══════════════════════════════════════════════════════════════
// Health Heartbeat
// ═══════════════════════════════════════════════════════════════

const HEARTBEAT_PATH = path.join(os.tmpdir(), 'decodex-scheduler-heartbeat');

interface SchedulerState {
  tasks: ScheduledTask[];
  startTime: Date | null;
  totalScheduled: number;
  lastReschedule: Date | null;
}

const state: SchedulerState = {
  tasks: [],
  startTime: new Date(),
  totalScheduled: 0,
  lastReschedule: null,
};

function writeHeartbeat(): void {
  try {
    const data = JSON.stringify({
      pid: process.pid,
      uptime: state.startTime ? Math.floor((Date.now() - state.startTime.getTime()) / 1000) : 0,
      totalTasks: state.tasks.length,
      totalScheduled: state.totalScheduled,
      lastReschedule: state.lastReschedule?.toISOString() ?? null,
      timestamp: new Date().toISOString(),
    });
    fs.writeFileSync(HEARTBEAT_PATH, data);
  } catch { /* ignore */ }
}

function cleanupHeartbeat(): void {
  try { fs.unlinkSync(HEARTBEAT_PATH); } catch { /* ignore */ }
}

// ═══════════════════════════════════════════════════════════════
// Programación de Fuentes
// ═══════════════════════════════════════════════════════════════

async function scheduleCheckJobs(): Promise<number> {
  const fuentes = await db.fuenteEstado.findMany({
    where: { estado: 'activa' },
    include: { Medio: true },
  });

  if (fuentes.length === 0) {
    console.log('[Scheduler-Service] No hay fuentes activas');
    return 0;
  }

  let scheduledCount = 0;
  let omitidas = 0;

  for (const fuente of fuentes) {
    try {
      const capa = determinarCapa({
        ultimoCheckOk: fuente.ultimoCheckOk,
        ultimoHeadline: fuente.ultimoHeadline,
        ultimoTexto: fuente.ultimoTexto,
        ultimoMencion: fuente.ultimoMencion,
        estado: fuente.estado || 'creada',
        activo: fuente.activo,
        fallosConsecutivos: fuente.fallosConsecutivos || 0,
      });

      if (capa < 1) {
        omitidas++;
        continue;
      }

      const count = scheduleFuente(fuente);
      scheduledCount += count;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.warn(`[Scheduler-Service] Error programando ${fuente.Medio?.nombre}: ${msg}`);
    }
  }

  console.log(`[Scheduler-Service] ${fuentes.length} fuentes: ${scheduledCount} tareas, ${omitidas} omitidas (capa 0)`);
  return scheduledCount;
}

function scheduleFuente(fuente: {
  id: string;
  medioId: string;
  Medio: { nombre: string; categoria: string; nivel: string; frecuenciaOverride: string };
  frecuenciaActual: string;
  frecuenciaBase: string;
  horasPublicacion: string;
}): number {
  const { efectiva } = getFrecuenciaEfectiva(
    fuente.frecuenciaBase,
    fuente.frecuenciaActual,
    fuente.Medio.frecuenciaOverride || null,
  );

  const numChecks = frecuenciaToChecksDia(efectiva);
  if (numChecks <= 0) {
    scheduleSingleCheck(fuente, 0, 9);
    return 1;
  }

  let horarios: number[];
  try {
    const histograma = JSON.parse(fuente.horasPublicacion || '{}');
    horarios = calcularHorariosOptimos(histograma, numChecks);
  } catch {
    const defaults = getHorariosDefault(fuente.Medio.nombre, '');
    horarios = defaults || distribuirFallback(numChecks);
  }

  // Guardar horarios en DB
  db.fuenteEstado.update({
    where: { id: fuente.id },
    data: { horariosOptimos: JSON.stringify(horarios) },
  }).catch(() => {});

  const domain = (fuente.Medio.nombre || '').toLowerCase().includes('tiempos') ? 'lostiempos.com' : '';
  const prioridad = domain === 'lostiempos.com' ? 0 : (fuente.Medio.nivel === '1' ? 1 : 3);

  for (const hora of horarios) {
    scheduleSingleCheck(fuente, prioridad, hora);
  }

  return horarios.length;
}

function scheduleSingleCheck(
  fuente: { id: string; medioId: string; Medio: { nombre: string } },
  prioridad: number,
  hora: number,
): void {
  const expresion = `0 ${hora} * * *`;
  if (!cron.validate(expresion)) return;

  const task = cron.schedule(expresion, async () => {
    try {
      const ultimoCheck = await db.fuenteEstado.findUnique({
        where: { id: fuente.id },
        select: { ultimoCheck: true },
      });

      if (ultimoCheck?.ultimoCheck) {
        const mins = (Date.now() - ultimoCheck.ultimoCheck.getTime()) / 60000;
        if (mins < CHECK_FIRST_CONFIG.minTimeBetweenChecks) return;
      }

      const pendingJob = await db.job.findFirst({
        where: { tipo: 'check_fuente', estado: 'pendiente', payload: { contains: fuente.id } },
      });
      if (pendingJob) return;

      const pendingCount = await db.job.count({ where: { estado: 'pendiente' } });
      if (pendingCount >= QUEUE_LIMITS.maxPendingJobs) return;

      await enqueue({
        tipo: 'check_fuente',
        prioridad: prioridad as 0 | 1 | 3 | 5 | 7 | 9,
        payload: { fuenteId: fuente.id, medioId: fuente.medioId },
      });

      state.totalScheduled++;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[Scheduler-Service] Error en tarea ${fuente.Medio.nombre}: ${msg}`);
    }
  });

  state.tasks.push(task);
}

// ═══════════════════════════════════════════════════════════════
// Programación de Boletines ONION200
// ═══════════════════════════════════════════════════════════════

function scheduleBoletinJobs(): number {
  const entries = getBoletinCronEntries();
  for (const entry of entries) {
    if (!cron.validate(entry.expresion)) continue;

    const task = cron.schedule(entry.expresion, async () => {
      try {
        const pendingCount = await db.job.count({ where: { estado: 'pendiente' } });
        if (pendingCount >= QUEUE_LIMITS.maxPendingJobs) return;

        const productType = entry.tipoBoletin || entry.tipo;
        await enqueue({
          tipo: 'generar_boletin',
          prioridad: entry.prioridad as 0 | 1 | 3 | 5 | 7 | 9,
          payload: { tipoBoletin: productType, programado: true },
        });

        state.totalScheduled++;
        console.log(`[Scheduler-Service] Boletin ${productType} encolado`);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`[Scheduler-Service] Error en boletin ${entry.tipo}: ${msg}`);
      }
    });

    state.tasks.push(task);
  }
  console.log(`[Scheduler-Service] ${entries.length} boletines programados`);
  return entries.length;
}

// ═══════════════════════════════════════════════════════════════
// Captura de Indicadores Tier 1
// ═══════════════════════════════════════════════════════════════

async function scheduleIndicatorJobs(): Promise<number> {
  const count = await db.indicador.count({ where: { activo: true, tier: 1 } });
  if (count === 0) {
    console.log('[Scheduler-Service] No hay indicadores Tier 1');
    return 0;
  }

  // 08:00 AM Bolivia = 12:00 UTC
  const expresion = '0 12 * * *';
  if (!cron.validate(expresion)) return 0;

  const task = cron.schedule(expresion, async () => {
    try {
      const pendingCapture = await db.job.findFirst({ where: { tipo: 'capture_indicador', estado: 'pendiente' } });
      if (pendingCapture) return;

      const ayer = new Date();
      ayer.setHours(ayer.getHours() - 23);
      const recent = await db.job.findFirst({ where: { tipo: 'capture_indicador', estado: 'completado', fechaFin: { gte: ayer } } });
      if (recent) return;

      await enqueue({ tipo: 'capture_indicador', prioridad: 3, payload: { capturarTodos: true } });
      state.totalScheduled++;
      console.log('[Scheduler-Service] capture_indicador encolado (Tier 1 batch)');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[Scheduler-Service] Error en captura indicadores: ${msg}`);
    }
  });

  state.tasks.push(task);
  console.log(`[Scheduler-Service] Captura indicadores Tier 1 programada (08:00 AM) — ${count} indicadores`);
  return 1;
}

// ═══════════════════════════════════════════════════════════════
// Mantenimiento Nocturno
// ═══════════════════════════════════════════════════════════════

function scheduleMaintenanceJob(): number {
  const entry = getMantenimientoCronEntry();

  const task = cron.schedule(entry.expresion, async () => {
    try {
      await enqueue({
        tipo: 'mantenimiento',
        prioridad: 9,
        payload: { tareas: ['degradar_fuentes', 'recalcular_horarios', 'recalcular_scheduler', 'limpiar_jobs'] },
      });
      state.totalScheduled++;
      console.log('[Scheduler-Service] Mantenimiento nocturno encolado');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[Scheduler-Service] Error en mantenimiento: ${msg}`);
    }
  });

  state.tasks.push(task);
  console.log('[Scheduler-Service] Mantenimiento nocturno programado (04:00 AM)');
  return 1;
}

// ═══════════════════════════════════════════════════════════════
// Reschedule Periódico (cada 6h)
// ═══════════════════════════════════════════════════════════════

function schedulePeriodicReschedule(): void {
  // Cada 6 horas: recalcular horarios para fuentes activas
  const expresion = '0 */6 * * *';
  if (!cron.validate(expresion)) return;

  const task = cron.schedule(expresion, async () => {
    try {
      console.log('[Scheduler-Service] Reschedule periódico iniciando...');

      // Detener todas las tareas de fuentes (no boletines/mantenimiento)
      for (const t of state.tasks) {
        t.stop();
      }
      state.tasks.length = 0;

      // Re-programar todo
      await scheduleCheckJobs();
      await scheduleIndicatorJobs();
      scheduleBoletinJobs();
      scheduleMaintenanceJob();

      state.lastReschedule = new Date();
      console.log(`[Scheduler-Service] Reschedule completo: ${state.tasks.length} tareas`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[Scheduler-Service] Error en reschedule: ${msg}`);
    }
  });

  state.tasks.push(task);
}

// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════

function distribuirFallback(numChecks: number): number[] {
  const ventana = { inicio: 6, fin: 22 };
  const rango = ventana.fin - ventana.inicio;
  const paso = rango / (numChecks + 1);
  return Array.from({ length: numChecks }, (_, i) => Math.round(ventana.inicio + paso * (i + 1)));
}

// ═══════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════

async function main(): Promise<void> {
  console.log('═══════════════════════════════════════════════════');
  console.log('  DECODEX Scheduler Service — Proceso Independiente');
  console.log(`  PID: ${process.pid}`);
  console.log(`  Node: ${process.version}`);
  console.log(`  Memoria inicial: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`);
  console.log('═══════════════════════════════════════════════════');

  // Programar todo
  await scheduleCheckJobs();
  await scheduleIndicatorJobs();
  scheduleBoletinJobs();
  scheduleMaintenanceJob();
  schedulePeriodicReschedule();

  // Heartbeat cada 5s
  setInterval(writeHeartbeat, 5000);
  writeHeartbeat();

  console.log(`[Scheduler-Service] ${state.tasks.length} tareas cron activas`);

  // Mantener proceso vivo
  await new Promise<void>(() => {
    // Este promise NUNCA se resuelve — el proceso vive hasta SIGINT/SIGTERM
  });
}

// ═══════════════════════════════════════════════════════════════
// Graceful Shutdown
// ═══════════════════════════════════════════════════════════════

function shutdown(signal: string): void {
  console.log(`\n[Scheduler-Service] Recibida señal ${signal} — cerrando...`);

  for (const task of state.tasks) {
    task.stop();
  }
  state.tasks.length = 0;

  cleanupHeartbeat();
  console.log('[Scheduler-Service] Todas las tareas detenidas — shutdown limpio');

  db.$disconnect().then(() => process.exit(0)).catch(() => process.exit(1));
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('uncaughtException', (err) => {
  console.error('[Scheduler-Service] Uncaught exception:', err);
  writeHeartbeat();
});
process.on('unhandledRejection', (reason) => {
  console.error('[Scheduler-Service] Unhandled rejection:', reason);
  writeHeartbeat();
});

// ═══════════════════════════════════════════════════════════════
// Start
// ═══════════════════════════════════════════════════════════════

main().catch((err) => {
  console.error('[Scheduler-Service] Fatal error:', err);
  process.exit(1);
});
