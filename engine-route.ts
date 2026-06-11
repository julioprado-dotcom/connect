export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getStats, ensureWorkerRunning } from '@/lib/jobs';
import { startWorker, stopWorker } from '@/lib/jobs/worker';
import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';

const SCHEDULER_HB = os.tmpdir() + '/decodex-scheduler-heartbeat';

function getSchedulerStatusPm2() {
  try {
    const output = execSync('pm2 jlist --no-color 2>/dev/null', {
      timeout: 5000, encoding: 'utf-8',
    });
    const list = JSON.parse(output) as Array<Record<string, unknown>>;
    const proc = list.find(
      (p) => p.name === 'decodex-scheduler' || (p.pm2_env as Record<string, unknown>)?.name === 'decodex-scheduler'
    );
    if (!proc) return { running: false, mode: 'pm2', pm2Status: 'none' as const };

    const status = ((proc.pm2_env as Record<string, unknown>)?.status as string) || (proc.status as string) || 'unknown';
    let hbData: Record<string, unknown> = {};
    try {
      hbData = JSON.parse(fs.readFileSync(SCHEDULER_HB, 'utf-8'));
    } catch { /* sin heartbeat */ }

    return {
      running: status === 'online',
      mode: 'pm2' as const,
      pm2Status: status,
      totalTasks: (hbData.totalTasks as number) ?? 0,
      uptime: hbData.uptime,
    };
  } catch {
    return { running: false, mode: 'pm2' as const, pm2Status: 'none' as const };
  }
}

export async function GET() {
  try {
    const stats = getStats();
    const schedulerStatus = getSchedulerStatusPm2();
    return NextResponse.json({
      worker: stats.worker,
      productive: stats.productive,
      scheduler: schedulerStatus,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { action } = body as { action?: string };

    switch (action) {
      case 'ensure':
        ensureWorkerRunning();
        return NextResponse.json({ message: 'Worker asegurado', status: getStats() });

      case 'start-scheduler':
        execSync('pm2 restart decodex-scheduler', { timeout: 15000 });
        return NextResponse.json({ message: 'Scheduler iniciado via PM2', scheduler: getSchedulerStatusPm2() });

      case 'stop-scheduler':
        execSync('pm2 stop decodex-scheduler', { timeout: 10000 });
        return NextResponse.json({ message: 'Scheduler detenido via PM2', scheduler: getSchedulerStatusPm2() });

      case 'start-worker':
        startWorker();
        return NextResponse.json({ message: 'Worker iniciado', worker: getStats().worker });

      case 'stop-worker':
        stopWorker();
        return NextResponse.json({ message: 'Worker detenido', worker: getStats().worker });

      default:
        return NextResponse.json({ error: 'Accion no valida: ' + action }, { status: 400 });
    }
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    );
  }
}