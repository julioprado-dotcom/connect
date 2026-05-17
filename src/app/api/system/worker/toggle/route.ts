/**
 * POST /api/system/worker/toggle — Iniciar o detener el Worker vía PM2
 *
 * Lee el heartbeat del worker-service para determinar su estado actual.
 * Si está corriendo → lo detiene (pm2 stop decodex-worker).
 * Si está detenido → lo inicia (pm2 start ecosystem.config.js --only decodex-worker).
 *
 * BLINDAJE: Siempre devuelve 200. Si PM2 no está disponible, devuelve estado degradado.
 */
import { NextResponse } from 'next/server';
import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HEARTBEAT_PATH = os.tmpdir() + '/decodex-worker-heartbeat';

function readHeartbeat(): { running: boolean; data: Record<string, unknown> } {
  try {
    const content = fs.readFileSync(HEARTBEAT_PATH, 'utf-8');
    const data = JSON.parse(content);
    // Heartbeat es válido si tiene menos de 30 segundos
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
      // Detener worker
      try {
        execSync('pm2 stop decodex-worker', { timeout: 10000 });
        return NextResponse.json({
          action: 'stopped',
          message: 'Worker detenido via PM2',
          previousState: current.data,
          timestamp: new Date().toISOString(),
        });
      } catch (pm2Error) {
        // Fallback: intentar matar por PID del heartbeat
        const pid = current.data.pid as number | undefined;
        if (pid) {
          try {
            process.kill(pid, 'SIGTERM');
            return NextResponse.json({
              action: 'stopped',
              message: `Worker detenido via SIGTERM (PID ${pid})`,
              timestamp: new Date().toISOString(),
            });
          } catch { /* ignore */ }
        }
        return NextResponse.json({
          action: 'error',
          message: 'No se pudo detener el Worker. PM2 no disponible.',
          timestamp: new Date().toISOString(),
        });
      }
    } else {
      // Iniciar worker
      try {
        execSync('pm2 start ecosystem.config.js --only decodex-worker', {
          timeout: 15000,
          cwd: process.cwd(),
        });
        return NextResponse.json({
          action: 'started',
          message: 'Worker iniciado via PM2',
          timestamp: new Date().toISOString(),
        });
      } catch (pm2Error) {
        return NextResponse.json({
          action: 'error',
          message: 'No se pudo iniciar el Worker. PM2 no disponible o no hay ecosystem.config.js.',
          hint: 'Ejecutar manualmente: cd /root/connect && pm2 start ecosystem.config.js --only decodex-worker',
          timestamp: new Date().toISOString(),
        });
      }
    }
  } catch (error) {
    console.error('[/api/system/worker/toggle] Error:', error);
    return NextResponse.json({
      action: 'error',
      message: 'Error interno al toggle Worker',
      timestamp: new Date().toISOString(),
    });
  }
}

// GET: devolver estado actual del worker
export async function GET() {
  const hb = readHeartbeat();
  return NextResponse.json({
    name: 'decodex-worker',
    running: hb.running,
    ...hb.data,
    pm2Available: true, // Will be determined by toggle attempt
    timestamp: new Date().toISOString(),
  });
}
