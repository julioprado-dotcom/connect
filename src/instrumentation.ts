/**
 * Next.js Instrumentation — DECODEX Bolivia
 * Auto-inicia el sistema de Job Queue (worker + scheduler) al arrancar el servidor.
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
