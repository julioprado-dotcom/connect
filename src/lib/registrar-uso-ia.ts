// Registrar uso de IA (tokens y costo) para auditoría y control de gastos
// Fire-and-forget: errores no bloquean el pipeline

import db from '@/lib/db';

// ─── Precios por modelo (USD por 1M tokens) ───────────

const PRECIOS_MODELO: Record<string, { prompt: number; completion: number }> = {
  'glm-4.7-flash':  { prompt: 0.00, completion: 0.00 }, // Free via Z.ai SDK
  'glm-4-plus':     { prompt: 0.50, completion: 1.50 },
  'glm-4-long':     { prompt: 0.50, completion: 1.50 },
  'glm-4-air':      { prompt: 0.10, completion: 0.10 },
  'gpt-4o':         { prompt: 2.50, completion: 10.00 },
  'gpt-4o-mini':    { prompt: 0.15, completion: 0.60 },
  'gpt-3.5-turbo':  { prompt: 0.50, completion: 1.50 },
};

// ─── Fuentes de uso ───────────

export const USO_FUENTE = {
  CAPTURA:            'captura',
  CLASIFICACION:      'clasificacion',
  DEDUPLICACION:      'deduplicacion',
  DISCOVERY:          'discovery',
  GENERACION:        'generacion',
  INSTRUCCION:       'instruccion',
  SIGNAL:            'signal',
  MEDIO_ANALYZE:     'medio_analyze',
} as const;

export type FuenteUso = (typeof USO_FUENTE)[keyof typeof USO_FUENTE];

interface RegistrarUsoIAParams {
  modelo?: string;
  fuente: FuenteUso | string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  medioId?: string;
  mencionId?: string;
  detalles?: string;
}

/**
 * Calcula el costo USD basado en modelo y tokens.
 */
function calcularCosto(modelo: string, promptTokens: number, completionTokens: number): number {
  const precios = PRECIOS_MODELO[modelo] || PRECIOS_MODELO['glm-4.7-flash'];
  const costoPrompt = (promptTokens / 1_000_000) * precios.prompt;
  const costoCompletion = (completionTokens / 1_000_000) * precios.completion;
  return parseFloat((costoPrompt + costoCompletion).toFixed(6));
}

/**
 * Registra una llamada al LLM en la tabla UsoIA.
 * Fire-and-forget: errores se loguean pero no bloquean el pipeline.
 */
export async function registrarUsoIA(params: RegistrarUsoIAParams): Promise<void> {
  try {
    const modelo = params.modelo || 'glm-4.7-flash';
    const promptTokens = params.promptTokens || 0;
    const completionTokens = params.completionTokens || 0;
    const totalTokens = params.totalTokens || (promptTokens + completionTokens);
    const costoUSD = calcularCosto(modelo, promptTokens, completionTokens);

    await db.usoIA.create({
      data: {
        modelo,
        fuente: params.fuente,
        promptTokens,
        completionTokens,
        totalTokens,
        costoUSD,
        medioId: params.medioId || null,
        mencionId: params.mencionId || null,
        detalles: (params.detalles || '').substring(0, 200),
      },
    });

    console.log(`[IA] tokens: ${totalTokens} (${modelo}, ${params.fuente}, $${costoUSD.toFixed(4)})`);
  } catch (err) {
    console.warn(`[IA] Error registrando uso: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Extrae tokens de un objeto completion de z-ai-web-dev-sdk
 * y los registra en la tabla UsoIA.
 * Función de conveniencia para usar después de cada llamada LLM.
 */
export async function registrarLlamadaLLM(params: {
  completion: { usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } } | null | undefined;
  modelo?: string;
  fuente: FuenteUso | string;
  medioId?: string;
  mencionId?: string;
  detalles?: string;
}): Promise<{ totalTokens: number; costoUSD: number }> {
  const usage = params.completion?.usage;
  const promptTokens = usage?.prompt_tokens || 0;
  const completionTokens = usage?.completion_tokens || 0;
  const totalTokens = usage?.total_tokens || (promptTokens + completionTokens);

  const modelo = params.modelo || 'glm-4.7-flash';
  const costoUSD = calcularCosto(modelo, promptTokens, completionTokens);

  // Registrar en DB (fire-and-forget)
  registrarUsoIA({
    modelo,
    fuente: params.fuente,
    promptTokens,
    completionTokens,
    totalTokens,
    medioId: params.medioId,
    mencionId: params.mencionId,
    detalles: params.detalles,
  }).catch(() => {}); // No esperar

  return { totalTokens, costoUSD };
}
