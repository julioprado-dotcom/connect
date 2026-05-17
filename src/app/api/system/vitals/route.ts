/**
 * /api/system/vitals — Señales vitales del sistema para el puente de mando ONION200
 *
 * Retorna datos del sistema operativo + Node.js + Base de datos + Worker.
 * Polling recomendado: cada 5 segundos.
 */
import { NextResponse } from 'next/server';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { getWorkerStats } from '@/lib/jobs/worker';
import { getSchedulerStatus } from '@/lib/jobs/scheduler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ── CPU usage: snapshot-based calculation ──────────────────────
// Node.js doesn't expose cumulative CPU usage easily in a stateless API.
// We return per-core times so the frontend can compute deltas.

function getCPUInfo() {
  const cpus = os.cpus();
  const loadAvg = os.loadavg();
  const totalCores = cpus.length;

  // Calculate aggregate CPU usage from os.cpus()
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
    // Instantaneous idle percentage (0-100)
    idlePct: totalTick > 0 ? Math.round((totalIdle / totalTick) * 10000) / 100 : 0,
    // Usage percentage = 100 - idle
    usagePct: totalTick > 0 ? Math.round(((totalTick - totalIdle) / totalTick) * 10000) / 100 : 0,
  };
}

// ── Memory ─────────────────────────────────────────────────────

function getMemoryInfo() {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;

  return {
    totalMB: Math.round(total / (1024 * 1024)),
    usedMB: Math.round(used / (1024 * 1024)),
    freeMB: Math.round(free / (1024 * 1024)),
    usagePct: Math.round((used / total) * 10000) / 100,
  };
}

// ── Process memory (Node.js heap) ──────────────────────────────

function getProcessMemory() {
  const mem = process.memoryUsage();
  return {
    rssMB: Math.round(mem.rss / (1024 * 1024) * 100) / 100,
    heapUsedMB: Math.round(mem.heapUsed / (1024 * 1024) * 100) / 100,
    heapTotalMB: Math.round(mem.heapTotal / (1024 * 1024) * 100) / 100,
    externalMB: Math.round(mem.external / (1024 * 1024) * 100) / 100,
  };
}

// ── Database size (SQLite) ─────────────────────────────────────

function getDbSize() {
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
}

// ── Uptime formatting ──────────────────────────────────────────

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
}

// ── Endpoint ───────────────────────────────────────────────────

export async function GET() {
  try {
    const cpu = getCPUInfo();
    const memory = getMemoryInfo();
    const processMem = getProcessMemory();
    const dbSizeMB = getDbSize();
    const uptimeSeconds = process.uptime();

    // Worker + Scheduler status
    const workerStats = getWorkerStats();
    const schedulerStats = getSchedulerStatus();

    return NextResponse.json({
      timestamp: new Date().toISOString(),
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
        lastJobTime: workerStats.lastJobTime?.toISOString() ?? null,
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
    return NextResponse.json(
      { error: 'Failed to collect system vitals' },
      { status: 500 }
    );
  }
}
