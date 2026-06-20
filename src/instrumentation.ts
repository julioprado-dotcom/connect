export const runtime = 'nodejs';

export async function register() {
  if (typeof window !== 'undefined') return;
  if (typeof (globalThis as any).EdgeRuntime !== 'undefined') return;

  // ─── Patch z-ai-web-dev-sdk: strip 'thinking' from request body ────
  // The SDK (v0.0.17/v0.0.18) unconditionally injects thinking: { type: 'disabled' }
  // which causes GLM API error 1210 ("API 调用参数有误").
  // serverExternalPackages forces Next.js to load the SDK at runtime (not bundled),
  // so this prototype patch is applied to the single shared copy in memory.
  // All 16 call sites automatically use the patched version — zero changes needed.
  try {
    const ZAI = (await import('z-ai-web-dev-sdk')).default;
    const originalCreate = ZAI.prototype.createChatCompletion;
    ZAI.prototype.createChatCompletion = async function (body: any) {
      const { thinking, ...rest } = body;
      return originalCreate.call(this, rest);
    };
    console.log('[Instrumentation] z-ai-web-dev-sdk patched: thinking parameter stripped');
  } catch (e) {
    console.warn('[Instrumentation] Failed to patch z-ai-web-dev-sdk:', e);
  }

  console.log('[Instrumentation] DECODEX Bolivia - modo PM2 multi-proceso');
  console.log('[Instrumentation] Web process: solo API routes + UI');
  console.log('[Instrumentation] Worker y Scheduler corren como procesos PM2 independientes');
}
