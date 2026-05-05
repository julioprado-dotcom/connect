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
import { type TipoBoletin, type GenerationResult, type ValidationResult } from '@/types/bulletin';
import { validateContent } from './validator';

// ============================================
// Configuracion de Reintentos
// ============================================

const MAX_REINTENTOS = 2;
const TEMPERATURA_BOOST = 0.05;

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
  const baseTemp = params.initialTemperatura ?? 0.3;

  let lastResult: GenerationResult | null = null;
  let lastValidation: ValidationResult | null = null;

  for (let intento = 0; intento <= MAX_REINTENTOS; intento++) {
    try {
      const temperatura = baseTemp + (intento * TEMPERATURA_BOOST);

      let enhancedPrompt = params.userPrompt;
      if (intento > 0 && lastValidation) {
        const feedback = generateFeedback(lastValidation);
        enhancedPrompt = `${feedback}\n\n---\n\n${params.userPrompt}`;
      }

      const zai = await ZAI.create();
      const completion = await zai.chat.completions.create({
        messages: [
          { role: 'system', content: params.systemPrompt },
          { role: 'user', content: enhancedPrompt },
        ],
        temperature: Math.min(temperatura, 0.8),
      });

      const contenido = completion.choices[0]?.message?.content ?? '';
      const tokensUsados = completion.usage?.total_tokens;

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
