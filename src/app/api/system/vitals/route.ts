/**
 * /api/system/vitals — Señales vitales del sistema para el puente de mando ONION200
 *
 * Retorna datos del sistema operativo + Node.js + Base de datos + Worker.
 * Polling recomendado: cada 5 segundos.
 *
 * BLINDAJE: Este endpoint NUNCA devuelve HTTP 500. Si cualquier métrica falla,
 * devuelve un JSON 200 con valores degradados (0, 'unknown', false).
 */
import { NextResponse } from 'next/server';
import os from 'os';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ── CPU usage: snapshot-based calculation ──────────────────────

function getCPUInfo() {
  try {
    const cpus = os.cpus();
    const loadAvg = os.loadavg();
    const totalCores = cpus.length;

    let totalIdle = 0;
    let totalTick = 0;
    for (const cpu of cpus) {
      for (const type of cpu.times) {
        totalTick += type;
      }
      totalIdle += cpu.times.idle;
    }

    const cpuModel = cpus[0]?.model || 'unknown';

    return {
      model: cpuModel,
      cores: totalCores,
      loadAvg1m: Math.round(loadAvg[0] * 100) / 100,
      loadAvg5m: Math.round(loadAvg[1] * 100) / 100,
      loadAvg15m: Math.round(loadAvg[2] * 100) / 100,
      idlePct: totalTick > 0 ? Math.round((totalIdle / totalTick) * 10000) / 100 : 0,
      usagePct: totalTick > 0 ? Math.round(((totalTick - totalIdle) / totalTick) * 10000) / 100 : 0,
    };
  } catch {
    return { model: 'unknown', cores: 0, loadAvg1m: 0, loadAvg5m: 0, loadAvg15m: 0, idlePct: 0, usagePct: 0 };
  }
}

// ── Memory ─────────────────────────────────────────────────────

function getMemoryInfo() {
  try {
    const total = os.totalmem();
    const free = os.freemem();
    const used = total - free;

    return {
      totalMB: Math.round(total / (1024 * 1024)),
      usedMB: Math.round(used / (1024 * 1024)),
      freeMB: Math.round(free / (1024 * 1024)),
      usagePct: Math.round((used / total) * 10000) / 100,
    };
  } catch {
    return { totalMB: 0, usedMB: 0, freeMB: 0, usagePct: 0 };
  }
}

// ── Process memory (Node.js heap) ──────────────────────────────

function getProcessMemory() {
  try {
    const mem = process.memoryUsage();
    return {
      rssMB: Math.round(mem.rss / (1024 * 1024) * 100) / 100,
      heapUsedMB: Math.round(mem.heapUsed / (1024 * 1024) * 100) / 100,
      heapTotalMB: Math.round(mem.heapTotal / (1024 * 1024) * 100) / 100,
      externalMB: Math.round(mem.external / (1024 * 1024) * 100) / 100,
    };
  } catch {
    return { rssMB: 0, heapUsedMB: 0, heapTotalMB: 0, externalMB: 0 };
  }
}

// ── Database size (SQLite) ─────────────────────────────────────

function getDbSize() {
  try {
    const candidates = [
      process.env.DATABASE_URL?.replace('file:', '') || '',
      path.join(process.cwd(), 'db', 'custom.db'),
      path.join(process.cwd(), 'prisma', 'dev.db'),
    ];
    for (const p of candidates) {
      try {
        const s = fs.statSync(p);
        if (s.isFile()) return Math.round(s.size / (1024 * 1024) * 100) / 100;
      } catch { /* next */ }
    }
    return 0;
  } catch {
    return 0;
  }
}

// ── Uptime formatting ──────────────────────────────────────────

function formatUptime(seconds: number): string {
  try {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    return `${m}m ${s}s`;
  } catch {
    return 'unknown';
  }
}

// ── Worker stats (safe import) ─────────────────────────────────

function safeWorkerStats() {
  try {
    const { getWorkerStats } = require('@/lib/jobs/worker');
    return getWorkerStats();
  } catch {
    return { running: false, uptime: '0s', jobsCompleted: 0, jobsFailed: 0, jobsPerHour: 0, lastJobTime: null };
  }
}

// ── Scheduler stats (safe import) ──────────────────────────────

function safeSchedulerStats() {
  try {
    const { getSchedulerStatus } = require('@/lib/jobs/scheduler');
    return getSchedulerStatus();
  } catch {
    return { running: false, totalTasks: 0 };
  }
}

// ── Endpoint ───────────────────────────────────────────────────

export async function GET() {
  // BLINDAJE: Siempre 200, nunca 500.
  try {
    const cpu = getCPUInfo();
    const memory = getMemoryInfo();
    const processMem = getProcessMemory();
    const dbSizeMB = getDbSize();
    const uptimeSeconds = process.uptime();

    // Worker + Scheduler status — safe (never throws)
    const workerStats = safeWorkerStats();
    const schedulerStats = safeSchedulerStats();

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      status: 'ok',
      cpu,
      memory,
      process: {
        memory: processMem,
        pid: process.pid,
        uptime: uptimeSeconds,
        uptimeFormatted: formatUptime(uptimeSeconds),
        nodeVersion: process.version,
      },
      database: {
        sizeMB: dbSizeMB,
        engine: 'SQLite',
      },
      worker: {
        running: workerStats.running,
        uptime: workerStats.uptime,
        jobsCompleted: workerStats.jobsCompleted,
        jobsFailed: workerStats.jobsFailed,
        jobsPerHour: workerStats.jobsPerHour,
        lastJobTime: workerStats.lastJobTime?.toISOString?.() ?? null,
      },
      scheduler: {
        running: schedulerStats.running,
        totalTasks: schedulerStats.totalTasks,
      },
      activeProcesses: {
        worker: workerStats.running,
        scheduler: schedulerStats.running,
        totalTasks: schedulerStats.totalTasks,
      },
    });
  } catch (error) {
    // Último recurso: JSON 200 con datos vacíos. NUNCA 500.
    console.error('[/api/system/vitals] Unexpected error (returning degraded):', error);
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      status: 'degraded',
      cpu: { model: 'unknown', cores: 0, loadAvg1m: 0, loadAvg5m: 0, loadAvg15m: 0, idlePct: 0, usagePct: 0 },
      memory: { totalMB: 0, usedMB: 0, freeMB: 0, usagePct: 0 },
      process: {
        memory: { rssMB: 0, heapUsedMB: 0, heapTotalMB: 0, externalMB: 0 },
        pid: process.pid || 0,
        uptime: 0,
        uptimeFormatted: 'unknown',
        nodeVersion: process.version || 'unknown',
      },
      database: { sizeMB: 0, engine: 'SQLite' },
      worker: { running: false, uptime: '0s', jobsCompleted: 0, jobsFailed: 0, jobsPerHour: 0, lastJobTime: null },
      scheduler: { running: false, totalTasks: 0 },
      activeProcesses: { worker: false, scheduler: false, totalTasks: 0 },
      message: 'Metricas no disponibles temporalmente',
    });
  }
}
