import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ═══════════════════════════════════════════════════════════════
// BLINDAJE TOTAL: Este endpoint NUNCA devuelve HTTP 500.
// Si cualquier componente falla, devuelve datos degradados.
// ═══════════════════════════════════════════════════════════════

// ─── Helpers de bajo nivel ────────────────────────────────────

function readCgroupMemory(): { limit: number; usage: number } {
  try {
    const limit = parseInt(fs.readFileSync('/sys/fs/cgroup/memory/memory.limit_in_bytes', 'utf-8').trim(), 10);
    const usage = parseInt(fs.readFileSync('/sys/fs/cgroup/memory/memory.usage_in_bytes', 'utf-8').trim(), 10);
    if (limit > 0) return { limit, usage };
  } catch { /* fallback */ }
  try {
    return { limit: os.totalmem(), usage: os.totalmem() - os.freemem() };
  } catch {
    return { limit: 1, usage: 0 };
  }
}

function getHeapLimit(): number {
  try {
    const match = (process.env.NODE_OPTIONS || '').match(/--max-old-space-size=(\d+)/);
    if (match) return parseInt(match[1], 10) * 1024 * 1024;
    try { return require('v8').getHeapStatistics().heap_size_limit; } catch { return 4041 * 1024 * 1024; }
  } catch {
    return 4041 * 1024 * 1024;
  }
}

function getDbSize(): number {
  try {
    const paths = [
      process.env.DATABASE_URL?.replace('file:', '') || '',
      path.join(process.cwd(), 'db', 'custom.db'),
      path.join(process.cwd(), 'prisma', 'dev.db'),
    ];
    for (const p of paths) {
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

function formatUptime(seconds: number): string {
  try {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const parts: string[] = [];
    if (d > 0) parts.push(`${d}d`);
    if (h > 0) parts.push(`${h}h`);
    parts.push(`${m}m`);
    return parts.join(' ');
  } catch {
    return 'unknown';
  }
}

// ─── Safe Worker/Scheduler imports ────────────────────────────

function safeWorkerStats() {
  try {
    const { getWorkerStats } = require('@/lib/jobs/worker');
    return getWorkerStats();
  } catch {
    return { running: false, uptime: '0s', jobsCompleted: 0, jobsFailed: 0, jobsPerHour: 0, lastJobTime: null };
  }
}

function safeSchedulerStats() {
  try {
    const { getSchedulerStatus } = require('@/lib/jobs/scheduler');
    return getSchedulerStatus();
  } catch {
    return { running: false, totalTasks: 0 };
  }
}

// ═══════════════════════════════════════════════════════════════
// Diagnósticos — cada uno atrapa sus propios errores
// ═══════════════════════════════════════════════════════════════

type Diagnosis = {
  id: string;
  severity: 'ok' | 'warning' | 'critical';
  message: string;
  detail: string;
  action?: string;
  team?: 'desarrollo' | 'sistemas' | 'administrador';
};

function diagnoseMemory(mem: NodeJS.MemoryUsage, heapLimit: number): Diagnosis {
  try {
    const heapPct = (mem.heapUsed / heapLimit) * 100;
    const rssMB = Math.round(mem.rss / (1024 * 1024));
    if (heapPct > 85) {
      return { id: 'memory', severity: 'critical', message: 'Heap Node.js saturado', detail: `${heapPct.toFixed(0)}% del limite (${rssMB} MB RSS).` };
    }
    if (heapPct > 60) {
      return { id: 'memory', severity: 'warning', message: 'Consumo de heap elevado', detail: `${heapPct.toFixed(0)}% del limite (${rssMB} MB RSS).` };
    }
    return { id: 'memory', severity: 'ok', message: 'Memoria estable', detail: `Heap ${heapPct.toFixed(0)}% (${rssMB} MB RSS).` };
  } catch {
    return { id: 'memory', severity: 'ok', message: 'Memoria', detail: 'Datos no disponibles.' };
  }
}

function diagnoseContainer(cgroup: { limit: number; usage: number }): Diagnosis {
  try {
    const pct = cgroup.limit > 0 ? (cgroup.usage / cgroup.limit) * 100 : 0;
    if (pct > 90) {
      return { id: 'container', severity: 'critical', message: 'Contenedor al limite', detail: `${pct.toFixed(0)}% de ${Math.round(cgroup.limit / 1024 / 1024)} MB.` };
    }
    if (pct > 75) {
      return { id: 'container', severity: 'warning', message: 'Contenedor con presion', detail: `${pct.toFixed(0)}% de ${Math.round(cgroup.limit / 1024 / 1024)} MB.` };
    }
    return { id: 'container', severity: 'ok', message: 'Contenedor estable', detail: `${pct.toFixed(0)}% de ${Math.round(cgroup.limit / 1024 / 1024)} MB.` };
  } catch {
    return { id: 'container', severity: 'ok', message: 'Contenedor', detail: 'Datos no disponibles.' };
  }
}

function diagnoseDatabase(dbSizeMB: number): Diagnosis {
  try {
    if (dbSizeMB > 500) {
      return { id: 'database', severity: 'warning', message: 'Base de datos grande', detail: `${dbSizeMB} MB.` };
    }
    return { id: 'database', severity: 'ok', message: 'Base de datos sana', detail: `${dbSizeMB} MB.` };
  } catch {
    return { id: 'database', severity: 'ok', message: 'Base de datos', detail: 'Datos no disponibles.' };
  }
}

function diagnoseUptime(uptimeSeconds: number): Diagnosis {
  try {
    if (uptimeSeconds < 300) {
      return { id: 'uptime', severity: 'warning', message: 'Inicializando', detail: `Arriba hace ${formatUptime(uptimeSeconds)}.` };
    }
    if (uptimeSeconds < 600) {
      return { id: 'uptime', severity: 'warning', message: 'Estabilizando', detail: `Arriba hace ${formatUptime(uptimeSeconds)}.` };
    }
    return { id: 'uptime', severity: 'ok', message: `Arriba ${formatUptime(uptimeSeconds)}`, detail: `Servidor estable (${Math.round(uptimeSeconds / 3600)}h).` };
  } catch {
    return { id: 'uptime', severity: 'ok', message: 'Uptime', detail: 'Datos no disponibles.' };
  }
}

function diagnoseDevOverhead(): Diagnosis {
  try {
    const isDev = process.env.NODE_ENV === 'development';
    if (!isDev) {
      return { id: 'dev-overhead', severity: 'ok', message: 'Produccion', detail: 'Sin overhead de desarrollo.' };
    }
    const nextDir = path.join(process.cwd(), '.next', 'dev');
    const cacheSize = fs.readdirSync(nextDir, { recursive: true }).reduce((acc, f) => {
      try { return acc + fs.statSync(path.join(nextDir, f as string)).size; } catch { return acc; }
    }, 0);
    const cacheMB = Math.round(cacheSize / 1024 / 1024);
    if (cacheMB > 500) {
      return { id: 'dev-overhead', severity: 'warning', message: 'Cache de dev grande', detail: `Turbopack cache: ${cacheMB} MB.` };
    }
    return { id: 'dev-overhead', severity: 'ok', message: 'Modo desarrollo', detail: `Turbopack cache: ${cacheMB} MB.` };
  } catch {
    return { id: 'dev-overhead', severity: 'ok', message: 'Entorno', detail: process.env.NODE_ENV || 'unknown' };
  }
}

function diagnoseAuth(): Diagnosis {
  try {
    const hasSecret = !!process.env.AUTH_SECRET;
    if (!hasSecret) {
      return { id: 'auth', severity: 'critical', message: 'AUTH_SECRET no configurado', detail: 'Las sesiones no se pueden firmar.' };
    }
    return { id: 'auth', severity: 'ok', message: 'Autenticacion configurada', detail: 'AUTH_SECRET presente.' };
  } catch {
    return { id: 'auth', severity: 'ok', message: 'Autenticacion', detail: 'Datos no disponibles.' };
  }
}

function diagnoseWorker(
  stats: ReturnType<typeof safeWorkerStats>,
  schedulerStats?: ReturnType<typeof safeSchedulerStats>,
): Diagnosis {
  try {
    if (!stats.running) {
      return { id: 'worker', severity: 'critical', message: 'Worker detenido', detail: 'El worker no esta procesando jobs.' };
    }
    if (stats.lastJobTime === null) {
      const schedulerStopped = schedulerStats ? !schedulerStats.running : true;
      const schedulerSinTareas = schedulerStats ? (schedulerStats.running && schedulerStats.totalTasks === 0) : false;
      if (schedulerStopped) {
        return { id: 'worker', severity: 'warning', message: 'Worker esperando', detail: `Scheduler detenido — sin tareas.` };
      }
      if (schedulerSinTareas) {
        return { id: 'worker', severity: 'warning', message: 'Worker esperando', detail: `Scheduler sin tareas programadas.` };
      }
      return { id: 'worker', severity: 'ok', message: 'Worker esperando', detail: `Scheduler: ${schedulerStats?.totalTasks ?? 0} tareas.` };
    }
    return {
      id: 'worker',
      severity: 'ok',
      message: 'Worker activo',
      detail: `${stats.jobsCompleted} completados, ${stats.jobsFailed} fallidos.`,
    };
  } catch {
    return { id: 'worker', severity: 'ok', message: 'Worker', detail: 'Datos no disponibles.' };
  }
}

function diagnoseScheduler(stats: ReturnType<typeof safeSchedulerStats>): Diagnosis {
  try {
    if (!stats.running) {
      return { id: 'scheduler', severity: 'critical', message: 'Scheduler detenido', detail: 'No hay tareas programadas.' };
    }
    if (stats.totalTasks === 0) {
      return { id: 'scheduler', severity: 'warning', message: 'Scheduler sin tareas', detail: 'Sin fuentes activas.' };
    }
    return { id: 'scheduler', severity: 'ok', message: 'Scheduler activo', detail: `${stats.totalTasks} tareas programadas.` };
  } catch {
    return { id: 'scheduler', severity: 'ok', message: 'Scheduler', detail: 'Datos no disponibles.' };
  }
}

// ═══════════════════════════════════════════════════════════════
// Endpoint principal — NUNCA 500
// ═══════════════════════════════════════════════════════════════

export async function GET() {
  try {
    const mem = process.memoryUsage();
    const cgroup = readCgroupMemory();
    const heapLimit = getHeapLimit();
    const dbSize = getDbSize();
    const uptimeSeconds = process.uptime();

    const memoryUsage = {
      rss: Math.round(mem.rss / (1024 * 1024) * 100) / 100,
      heapUsed: Math.round(mem.heapUsed / (1024 * 1024) * 100) / 100,
      heapLimit: Math.round(heapLimit / (1024 * 1024) * 100) / 100,
      cgroupUsage: Math.round(cgroup.usage / (1024 * 1024) * 100) / 100,
      cgroupLimit: Math.round(cgroup.limit / (1024 * 1024) * 100) / 100,
    };

    const workerStats = safeWorkerStats();
    const schedulerStatus = safeSchedulerStats();
    const backendVitals = { worker: workerStats, scheduler: schedulerStatus };

    const diagnoses: Diagnosis[] = [
      diagnoseWorker(workerStats, schedulerStatus),
      diagnoseScheduler(schedulerStatus),
      diagnoseMemory(mem, heapLimit),
      diagnoseContainer(cgroup),
      diagnoseDatabase(dbSize),
      diagnoseUptime(uptimeSeconds),
      diagnoseDevOverhead(),
      diagnoseAuth(),
    ];

    const devModePattern = /next dev|hot reload|development|dev server|compilation|fast refresh|hmr/i;
    const nonTrivialDiagnoses = diagnoses.filter(d => {
      if (d.id === 'dev-overhead' || d.id === 'auth') return false;
      const texto = (d.message + ' ' + d.detail).toLowerCase();
      if (devModePattern.test(texto)) return false;
      return true;
    });
    const realCriticals = nonTrivialDiagnoses.filter(d => d.severity === 'critical');
    const realWarnings = nonTrivialDiagnoses.filter(d => d.severity === 'warning');
    const healthScore = Math.max(0, 100 - (realCriticals.length * 30) - (realWarnings.length * 10));

    return NextResponse.json({
      healthScore,
      diagnoses,
      memoryUsage,
      dbSize,
      backendVitals,
      uptime: uptimeSeconds,
      uptimeFormatted: formatUptime(uptimeSeconds),
      environment: process.env.NODE_ENV || 'unknown',
      nodeVersion: process.version,
      timestamp: new Date().toISOString(),
      status: 'ok',
    });
  } catch (error) {
    // ULTIMO RECURSO: 200 con datos minimos. NUNCA 500.
    console.error('[/api/dashboard/system] Unexpected error (returning degraded):', error);
    return NextResponse.json({
      healthScore: 0,
      diagnoses: [{ id: 'system', severity: 'critical', message: 'Error del sistema', detail: 'Metricas no disponibles.' }],
      memoryUsage: { rss: 0, heapUsed: 0, heapLimit: 0, cgroupUsage: 0, cgroupLimit: 0 },
      dbSize: 0,
      backendVitals: {
        worker: { running: false, uptime: '0s', jobsCompleted: 0, jobsFailed: 0, jobsPerHour: 0, lastJobTime: null },
        scheduler: { running: false, totalTasks: 0 },
      },
      uptime: 0,
      uptimeFormatted: 'unknown',
      environment: process.env.NODE_ENV || 'unknown',
      nodeVersion: process.version || 'unknown',
      timestamp: new Date().toISOString(),
      status: 'degraded',
      message: 'Metricas no disponibles temporalmente',
    });
  }
}
