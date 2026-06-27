/**
 * DECODEX v0.8.0 — Regeneracion con Reintentos
 * Motor ONION200 — Equipo B — TAREA 7m
 *
 * Sistema de regeneracion de contenido cuando la validacion
 * de calidad falla. Incluye reintentos con ajuste de prompts
 * y un maximo de 2 reintentos antes de marcar como fallido.
 *
 * Uso:
 *   import { regenerateWithRetry } from '@/lib/quality/regeneration';
 *   const result = await regenerateWithRetry(params);
 */

import ZAI from 'z-ai-web-dev-sdk';
import { PRODUCTOS } from '@/constants/products';
import { registrarLlamadaLLM, USO_FUENTE } from '@/lib/registrar-uso-ia';
import { throttledLlmCall } from '@/lib/ai/llm-throttle';
import { type TipoBoletin, type GenerationResult, type ValidationResult } from '@/types/bulletin';
import { validateContent } from './validator';

// ============================================
// Configuracion de Reintentos
// ============================================

const MAX_REINTENTOS = 2;
const TEMPERATURA_BOOST = 0.05;

// Maximo seguro de caracteres para el user prompt antes de truncar.
// GLM-4.5-Flash soporta 128K tokens (~480K chars en espanol).
// 60,000 chars ≈ 16,000 tokens. Dejamos margen para system prompt + output.
const MAX_USER_PROMPT_CHARS = 60000;

// ============================================
// Mensajes de retroalimentacion para reintentos
// ============================================

const FEEDBACK_MESSAGES: Record<string, string[]> = {
  too_short: [
    'El contenido generado es demasiado corto. Extiende cada seccion con mas detalle y contexto.',
    'Necesitas llegar al minimo de palabras requerido. Elabora mas en cada punto.',
  ],
  too_long: [
    'El contenido excede la longitud permitida. Condensa manteniendo los puntos clave.',
    'Reduce el contenido eliminando redundancias y siendo mas conciso.',
  ],
  no_sections: [
    'El contenido carece de estructura con secciones claras. Organiza con encabezados ##.',
    'Reestructura el contenido usando secciones con encabezados para mejor legibilidad.',
  ],
  generic: [
    'Mejora la calidad del contenido: agrega datos especificos, evita generalidades.',
    'El contenido necesita mayor profundidad y datos concretos de las menciones proporcionadas.',
  ],
};

// Refuerzo de reglas de generación inyectado en CADA reintento.
// Aparece al final del prompt (recency bias) para maximizar cumplimiento.
const REFORZAJE_REINTENTO = `\n\nREGLAS CRITICAS DE REINTENTO — CUMPLIMIENTO OBLIGATORIO:
- SOLO reportar datos que esten en las menciones proporcionadas. No inventar, no deducir.
- CADA afirmacion con atribucion: (Fuente: nombre del medio).
- Si hay versiones contrapuestas entre actores, reportar AMBAS con sus fuentes. Ningun actor es fuente de verdad por defecto.
- Fechas concretas, no referencias temporales vagas ("dia siguiente", "mañana").
- Sintesis permitida: agrupar por tema, cruzar fuentes — siempre con citas.
- No inventar causas, intenciones ni contextos ausentes en las menciones.`;

// ============================================
// Funcion Principal
// ============================================

/**
 * Regenera contenido con reintentos automaticos si la validacion falla.
 */
export async function regenerateWithRetry(params: {
  systemPrompt: string;
  userPrompt: string;
  tipo: TipoBoletin;
  initialTemperatura?: number;
  onRetry?: (intento: number, error: string) => void;
}): Promise<GenerationResult> {
  // GLM rejects temperature: 0 — minimum allowed is > 0
  const baseTemp = Math.max(params.initialTemperatura ?? 0.3, 0.05);

  let lastResult: GenerationResult | null = null;
  let lastValidation: ValidationResult | null = null;

  for (let intento = 0; intento <= MAX_REINTENTOS; intento++) {
    try {
      const temperatura = baseTemp + (intento * TEMPERATURA_BOOST);

      let enhancedPrompt = params.userPrompt;
      if (intento > 0 && lastValidation) {
        const feedback = generateFeedback(lastValidation);
        // Refuerzo de reglas SIEMPRE presente en reintentos,
        // independientemente de la razon del fallo de validacion.
        enhancedPrompt = `${feedback}\n\n---\n\n${REFORZAJE_REINTENTO}\n\n---\n\n${params.userPrompt}`;
      }

      const zai = await ZAI.create();

      // Sanitizar prompts: eliminar caracteres de control (null bytes, C0/C1)
      // que pueden causar error 1210 en la API de GLM.
      let cleanSystem = sanitizePrompt(params.systemPrompt);
      let cleanUser = sanitizePrompt(enhancedPrompt);

      // Truncar user prompt si excede el maximo seguro.
      // Cortar la seccion de menciones (primera seccion) manteniendo reglas finales.
      if (cleanUser.length > MAX_USER_PROMPT_CHARS) {
        const partes = cleanUser.split('\n\nREGLAS FINALES DE ESTE PRODUCTO:');
        if (partes.length === 2) {
          const mencionesPart = partes[0];
          const reglasPart = partes[1];
          const disponible = MAX_USER_PROMPT_CHARS - reglasPart.length - 200;
          if (disponible > 1000) {
            cleanUser = mencionesPart.substring(0, disponible) + '\n\n[...menciones truncadas por limite de tokens...]\n\nREGLAS FINALES DE ESTE PRODUCTO:' + reglasPart;
            console.warn(`[regeneration] User prompt truncado: ${cleanUser.length}chars (de ${enhancedPrompt.length})`);
          } else {
            cleanUser = cleanUser.substring(0, MAX_USER_PROMPT_CHARS);
          }
        } else {
          cleanUser = cleanUser.substring(0, MAX_USER_PROMPT_CHARS);
        }
      }

      const sysLen = cleanSystem.length;
      const usrLen = cleanUser.length;
      console.log(`[regeneration] Intento ${intento + 1} para ${params.tipo}: system=${sysLen}chars, user=${usrLen}chars, temp=${temperatura}`);

      const completion = await throttledLlmCall(() => zai.chat.completions.create({
        model: 'glm-4.5-flash',
        messages: [
          { role: 'system', content: cleanSystem },
          { role: 'user', content: cleanUser },
        ],
        temperature: Math.round(Math.min(temperatura, 0.8) * 100) / 100,
      }));

      const contenido = completion.choices[0]?.message?.content ?? '';
      const tokensUsados = completion.usage?.total_tokens;

      // Registrar uso IA
      registrarLlamadaLLM({
        completion,
        fuente: USO_FUENTE.GENERACION,
        detalles: `tipo=${params.tipo}, intento=${intento + 1}`,
      }).catch(() => {});

      if (!contenido) {
        lastResult = {
          exito: false,
          error: `La IA no genero contenido (intento ${intento + 1}/${MAX_REINTENTOS + 1})`,
        };
        lastValidation = validateContent('', { tipo: params.tipo });
        continue;
      }

      const validation = validateContent(contenido, { tipo: params.tipo });
      lastValidation = validation;

      if (validation.valido) {
        return {
          exito: true,
          contenido,
          tokensUsados,
          modelo: completion.model,
          temperatura,
          metadata: {
            intentos: intento + 1,
            puntuacionCalidad: validation.puntuacion,
            regenerado: intento > 0,
          },
        };
      }

      lastResult = {
        exito: validation.puntuacion >= 50,
        contenido,
        tokensUsados,
        modelo: completion.model,
        temperatura,
        metadata: {
          intentos: intento + 1,
          puntuacionCalidad: validation.puntuacion,
          regenerado: intento > 0,
        },
      };

      if (params.onRetry && intento < MAX_REINTENTOS) {
        const errorMsg = validation.errores.join('; ') || validation.advertencias.join('; ');
        params.onRetry(intento + 1, errorMsg);
      }

      console.log(
        `[regeneration] Intento ${intento + 1}/${MAX_REINTENTOS + 1} fallido ` +
        `para ${params.tipo} — puntuacion: ${validation.puntuacion} — ` +
        `errores: ${validation.errores.length}`
      );
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
        console.error(`[TIMEOUT] LLM call exceeded 60s in regenerateWithRetry (intento ${intento + 1})`);
      }
      // Diagnostico detallado para error 1210 (parametros invalidos de GLM)
      if (errMsg.includes('1210') || errMsg.includes('400')) {
        console.error(`[regeneration] API 1210/400 para ${params.tipo} — system=${params.systemPrompt?.length ?? 0}chars, user=${enhancedPrompt?.length ?? 0}chars`);
        console.error(`[regeneration] system[0:500]: ${params.systemPrompt?.substring(0, 500)}`);
        console.error(`[regeneration] user[0:500]: ${enhancedPrompt?.substring(0, 500)}`);
        console.error(`[regeneration] user[-500:]: ${enhancedPrompt?.substring(Math.max(0, (enhancedPrompt?.length ?? 0) - 500))}`);
        // En el primer intento con 1210, no tiene sentido reintentar con prompt mas grande
        if (intento === 0 && errMsg.includes('1210')) {
          console.error(`[regeneration] Abortando reintentos: error 1210 indica parametros invalidos, reintentar con prompt identico no ayudara`);
          lastResult = {
            exito: false,
            error: `API rechazo los parametros (error 1210). Prompt system: ${params.systemPrompt?.length}chars, user: ${enhancedPrompt?.length}chars. Posible causa: prompt excede limite del modelo o contiene caracteres invalidos.`,
          };
          break;
        }
      }
      console.error(`[regeneration] Error en intento ${intento + 1}:`, error);
      lastResult = {
        exito: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      };
    }
  }

  if (lastResult && lastResult.contenido) {
    console.warn(
      `[regeneration] Agotados reintentos para ${params.tipo}, ` +
      `devolviendo ultimo contenido (puntuacion: ${lastValidation?.puntuacion ?? 0})`
    );
    return {
      ...lastResult,
      metadata: {
        ...lastResult.metadata,
        reintentosAgotados: true,
        validacionFinal: lastValidation,
      },
    };
  }

  return {
    exito: false,
    error: `No se pudo generar contenido valido para ${params.tipo} despues de ${MAX_REINTENTOS + 1} intentos`,
  };
}

// ============================================
// Funciones Auxiliares
// ============================================

function generateFeedback(validation: ValidationResult): string {
  const feedbacks: string[] = [];

  feedbacks.push(
    'RETROALIMENTACION DE CALIDAD: El contenido anterior no paso la validacion. ' +
    'Por favor, ten en cuenta las siguientes correcciones:'
  );

  if (validation.estadisticas.palabras < 300) {
    feedbacks.push(pickRandom(FEEDBACK_MESSAGES.too_short));
  } else if (validation.estadisticas.palabras > 2500) {
    feedbacks.push(pickRandom(FEEDBACK_MESSAGES.too_long));
  }

  const tieneSecciones = validation.errores.some(e => e.includes('secciones'));
  if (tieneSecciones) {
    feedbacks.push(pickRandom(FEEDBACK_MESSAGES.no_sections));
  }

  if (feedbacks.length === 1) {
    feedbacks.push(pickRandom(FEEDBACK_MESSAGES.generic));
  }

  return feedbacks.join('\n\n');
}

function pickRandom<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Sanitiza un prompt eliminando caracteres de control que pueden causar
 * error 1210 (parametros invalidos) en la API de GLM.
 * Mantiene newline, tab y carriage return.
 */
function sanitizePrompt(s: string): string {
  if (!s) return s;
  // Eliminar null bytes y caracteres de control C0/C1
  // (excepto \t=0x09, \n=0x0a, \r=0x0d)
  return s.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f\x80-\x9f]/g, '');
}
