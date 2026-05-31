/**
 * Next.js Instrumentation — DECODEX Bolivia
 *
 * ARCHITECTURE E v2: PM2 Multi-Proceso
 * - decodex-web: Solo Next.js (API routes + UI) — NO ejecuta jobs/scheduler
 * - decodex-worker: Proceso standalone (worker-service.ts) — ejecuta jobs
 * - decodex-scheduler: Proceso standalone (scheduler-service.ts) — programa tareas
 *
 * instrumentation.ts SOLO inicia el job system cuando NO hay procesos PM2
 * standalone disponibles (modo monolítico/desarrollo local).
 *
 * https://nextjs.org/docs/app/api-reference/config/instrumentation
 */

// CRÍTICO: instrumentation DEBE correr en Node.js runtime, no Edge Runtime.
export const runtime = 'nodejs';

export async function register() {
  // Solo ejecutar en el servidor
  if (typeof window !== 'undefined') return;

  // Turbopack compila instrumentation para Edge + Node.js.
  // EdgeRuntime es un global que solo existe en Edge — si existe, saltamos.
  if (typeof (globalThis as any).EdgeRuntime !== 'undefined') return;

  console.log('[Instrumentation] Iniciando sistema DECODEX...');

  // ─── Detectar si estamos en modo PM2 multi-proceso ─────────
  // Si los procesos standalone (worker/scheduler) existen, NO iniciar
  // el job system aquí. El web process solo sirve UI + API routes.
  const pm2Available = await checkPm2Processes();
  if (pm2Available) {
    console.log('[Instrumentation] Modo PM2 detectado — OMITIENDO job system (worker/scheduler son procesos separados)');
    console.log('[Instrumentation] Web process solo sirve API routes + UI');
    return;
  }

  // ─── Modo monolítico (sin PM2) ─────────
  // Solo usar en desarrollo local o cuando no hay PM2.
  // En producción con PM2, worker-service.ts y scheduler-service.ts
  // manejan el job system de forma independiente.
  console.log('[Instrumentation] Modo monolítico — iniciando job system integrado...');
  try {
    const { initJobSystem, activateProductiveMode } = await import('@/lib/jobs');

    // Fase 1: Inicializar en modo IDLE
    await initJobSystem();

    // Fase 2: Activar modo productivo después de warmup
    setTimeout(async () => {
      try {
        await activateProductiveMode();
        console.log('[Instrumentation] Sistema productivo activo');
      } catch (err) {
        console.error('[Instrumentation] Error activando modo productivo:', err);
      }
    }, 5000);
  } catch (err) {
    console.error('[Instrumentation] Error inicializando job system:', err);
  }
}

/**
 * Verifica si los procesos PM2 standalone (decodex-worker, decodex-scheduler)
 * están registrados en PM2. No verifica si están online — solo si existen
 * en la configuración de PM2.
 */
async function checkPm2Processes(): Promise<boolean> {
  try {
    const { execSync } = await import('child_process');
    const output = execSync('pm2 jlist --no-color 2>/dev/null', {
      timeout: 3000,
      encoding: 'utf-8',
    });
    const list = JSON.parse(output) as Array<Record<string, unknown>>;
    const names = new Set(list.map((p) => p.name as string));
    // Si ambos procesos existen en PM2 → modo multi-proceso
    return names.has('decodex-worker') && names.has('decodex-scheduler');
  } catch {
    // PM2 no disponible → modo monolítico
    return false;
  }
}
