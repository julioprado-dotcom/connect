export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getStats, ensureWorkerRunning } from '@/lib/jobs';
import { getSchedulerStatus } from '@/lib/jobs/scheduler';
import { startScheduler, stopScheduler } from '@/lib/jobs/scheduler';
import { startWorker, stopWorker } from '@/lib/jobs/worker';

export async function GET() {
  try {
    const stats = getStats();
    const schedulerStatus = getSchedulerStatus();
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
        await startScheduler();
        return NextResponse.json({ message: 'Scheduler iniciado', scheduler: getSchedulerStatus() });

      case 'stop-scheduler':
        stopScheduler();
        return NextResponse.json({ message: 'Scheduler detenido', scheduler: getSchedulerStatus() });

      case 'start-worker':
        startWorker();
        return NextResponse.json({ message: 'Worker iniciado', worker: getStats().worker });

      case 'stop-worker':
        stopWorker();
        return NextResponse.json({ message: 'Worker detenido', worker: getStats().worker });

      default:
        return NextResponse.json({ error: `Acción no válida: ${action}` }, { status: 400 });
    }
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    );
  }
}
