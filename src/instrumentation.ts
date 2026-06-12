export const runtime = 'nodejs';

export async function register() {
  if (typeof window !== 'undefined') return;
  if (typeof (globalThis as any).EdgeRuntime !== 'undefined') return;

  console.log('[Instrumentation] DECODEX Bolivia - modo PM2 multi-proceso');
  console.log('[Instrumentation] Web process: solo API routes + UI');
  console.log('[Instrumentation] Worker y Scheduler corren como procesos PM2 independientes');
}
