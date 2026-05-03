/**
 * fetch-utils.ts — Utilidades de fetch optimizadas para conexiones lentas
 *
 * - fetchWithTimeout: AbortController automático + timeout configurable
 * - FETCH_TIMEOUT: timeout default (15s)
 */

export const FETCH_TIMEOUT = 15_000; // 15 segundos

/**
 * Wrapper de fetch con AbortController y timeout automático.
 * Útil en useEffect — pasar la señal al cleanup.
 */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit & { timeoutMs?: number },
): Promise<Response> {
  const { timeoutMs = FETCH_TIMEOUT, signal: externalSignal, ...rest } = init || {};
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  // Si el caller ya pasa una señal externa, abortar cuando cualquiera de los dos dispare
  if (externalSignal) {
    externalSignal.addEventListener('abort', () => controller.abort());
  }

  try {
    return await fetch(input, {
      ...rest,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}
