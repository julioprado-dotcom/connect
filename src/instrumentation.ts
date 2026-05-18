/**
 * Next.js Instrumentation — DECODEX Bolivia
 * Auto-inicia el sistema de Job Queue (worker + scheduler) al arrancar el servidor.
 * https://nextjs.org/docs/app/api-reference/config/instrumentation
 */

export async function register() {
  // Solo ejecutar en el servidor
  if (typeof window !== 'undefined') return;

  console.log('[Instrumentation] Iniciando sistema DECODEX...');

  try {
    const { initJobSystem, activateProductiveMode } = await import('@/lib/jobs');

    // Fase 1: Inicializar en modo IDLE (registra runners, worker polling)
    await initJobSystem();

    // Fase 2: Activar modo productivo después de warmup
    // Esperar a que Next.js termine de compilar rutas
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
