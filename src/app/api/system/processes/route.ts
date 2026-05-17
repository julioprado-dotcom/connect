/**
 * GET /api/system/processes — Estado de los 3 procesos PM2
 *
 * Lee heartbeats de worker y scheduler, y determina el estado
 * del proceso web (Next.js) por estar respondiendo esta petición.
 * No requiere PM2 SDK — usa heartbeat files.
 *
 * BLINDAJE: Siempre devuelve 200.
 */
import { NextResponse } from 'next/server';
import fs from 'fs';
import os from 'os';
import { execSync } from 'child_process';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const WORKER_HB = os.tmpdir() + '/decodex-worker-heartbeat';
const SCHEDULER_HB = os.tmpdir() + '/decodex-scheduler-heartbeat';

function readHeartbeat(filePath: string): { online: boolean; age: number; data: Record<string, unknown> } {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);
    const age = Date.now() - new Date(data.timestamp).getTime();
    return { online: age < 30000, age, data };
  } catch {
    return { online: false, age: Infinity, data: {} };
  }
}

export async function GET() {
  try {
    const workerHB = readHeartbeat(WORKER_HB);
    const schedulerHB = readHeartbeat(SCHEDULER_HB);

    const webOnline = true;

    // Intentar obtener estado PM2 si está disponible
    let pm2Status: Array<Record<string, unknown>> | null = null;
    try {
      const pm2Output = execSync('pm2 jlist --no-color 2>/dev/null', {
        timeout: 5000,
        encoding: 'utf-8',
      });
      const pm2List = JSON.parse(pm2Output) as Array<Record<string, unknown>>;
      pm2Status = pm2List.map(p => ({
        name: p.name,
        status: p.pm2_env?.status || p.status,
        pid: p.pid,
        uptime: p.pm2_env?.pm_uptime,
        memory: p.monit?.memory,
        cpu: p.monit?.cpu,
      }));
    } catch {
      pm2Status = null;
    }

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      processes: {
        web: {
          name: 'decodex-web',
          online: webOnline,
          pid: process.pid,
          uptime: Math.floor(process.uptime()),
          nodeVersion: process.version,
          memoryMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
        },
        worker: {
          name: 'decodex-worker',
          online: workerHB.online,
          pid: workerHB.data.pid ?? null,
          uptime: workerHB.data.uptime ?? 0,
          jobsCompleted: workerHB.data.jobsCompleted ?? 0,
          jobsFailed: workerHB.data.jobsFailed ?? 0,
          lastJobTime: workerHB.data.lastJobTime ?? null,
          currentJobId: workerHB.data.currentJobId ?? null,
          heartbeatAge: workerHB.age < Infinity ? Math.round(workerHB.age / 1000) : null,
        },
        scheduler: {
          name: 'decodex-scheduler',
          online: schedulerHB.online,
          pid: schedulerHB.data.pid ?? null,
          uptime: schedulerHB.data.uptime ?? 0,
          totalTasks: schedulerHB.data.totalTasks ?? 0,
          totalScheduled: schedulerHB.data.totalScheduled ?? 0,
          lastReschedule: schedulerHB.data.lastReschedule ?? null,
          heartbeatAge: schedulerHB.age < Infinity ? Math.round(schedulerHB.age / 1000) : null,
        },
      },
      pm2Status,
      architecture: 'multi-process',
    });
  } catch (error) {
    console.error('[/api/system/processes] Error:', error);
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      processes: {
        web: { name: 'decodex-web', online: true, pid: process.pid },
        worker: { name: 'decodex-worker', online: false },
        scheduler: { name: 'decodex-scheduler', online: false },
      },
      pm2Status: null,
      architecture: 'multi-process',
      status: 'degraded',
    });
  }
}
