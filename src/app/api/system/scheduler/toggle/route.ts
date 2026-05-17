/**
 * POST /api/system/scheduler/toggle — Iniciar o detener el Scheduler vía PM2
 *
 * Lee el heartbeat del scheduler-service para determinar su estado actual.
 * Si está corriendo → lo detiene (pm2 stop decodex-scheduler).
 * Si está detenido → lo inicia (pm2 start ecosystem.config.js --only decodex-scheduler).
 *
 * BLINDAJE: Siempre devuelve 200.
 */
import { NextResponse } from 'next/server';
import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HEARTBEAT_PATH = os.tmpdir() + '/decodex-scheduler-heartbeat';

function readHeartbeat(): { running: boolean; data: Record<string, unknown> } {
  try {
    const content = fs.readFileSync(HEARTBEAT_PATH, 'utf-8');
    const data = JSON.parse(content);
    const age = Date.now() - new Date(data.timestamp).getTime();
    return { running: age < 30000, data };
  } catch {
    return { running: false, data: {} };
  }
}

export async function POST() {
  try {
    const current = readHeartbeat();

    if (current.running) {
      // Detener scheduler
      try {
        execSync('pm2 stop decodex-scheduler', { timeout: 10000 });
        return NextResponse.json({
          action: 'stopped',
          message: 'Scheduler detenido via PM2',
          previousState: current.data,
          timestamp: new Date().toISOString(),
        });
      } catch (pm2Error) {
        const pid = current.data.pid as number | undefined;
        if (pid) {
          try {
            process.kill(pid, 'SIGTERM');
            return NextResponse.json({
              action: 'stopped',
              message: `Scheduler detenido via SIGTERM (PID ${pid})`,
              timestamp: new Date().toISOString(),
            });
          } catch { /* ignore */ }
        }
        return NextResponse.json({
          action: 'error',
          message: 'No se pudo detener el Scheduler. PM2 no disponible.',
          timestamp: new Date().toISOString(),
        });
      }
    } else {
      // Iniciar scheduler
      try {
        execSync('pm2 start ecosystem.config.js --only decodex-scheduler', {
          timeout: 15000,
          cwd: process.cwd(),
        });
        return NextResponse.json({
          action: 'started',
          message: 'Scheduler iniciado via PM2',
          timestamp: new Date().toISOString(),
        });
      } catch (pm2Error) {
        return NextResponse.json({
          action: 'error',
          message: 'No se pudo iniciar el Scheduler. PM2 no disponible o no hay ecosystem.config.js.',
          hint: 'Ejecutar manualmente: cd /root/connect && pm2 start ecosystem.config.js --only decodex-scheduler',
          timestamp: new Date().toISOString(),
        });
      }
    }
  } catch (error) {
    console.error('[/api/system/scheduler/toggle] Error:', error);
    return NextResponse.json({
      action: 'error',
      message: 'Error interno al toggle Scheduler',
      timestamp: new Date().toISOString(),
    });
  }
}

// GET: devolver estado actual del scheduler
export async function GET() {
  const hb = readHeartbeat();
  return NextResponse.json({
    name: 'decodex-scheduler',
    running: hb.running,
    ...hb.data,
    timestamp: new Date().toISOString(),
  });
}
