/**
 * DECODEX — Corrección Ortográfica y Gramatical (Paso Final del Pipeline)
 * 
 * Se ejecuta DESPUÉS de todos los demás pasos de post-procesamiento.
 * Es un paso SEPARADO de verifyFactualWithLLM para:
 * - Evitar sobrecargar el prompt de verificación factual
 * - Corregir el texto FINAL completo (sin truncación)
 * - Ejecutar sobre texto ya limpiado (sin undefined, con cierre, etc.)
 * 
 * Usa glm-4-flash (rápido, barato) con temperatura 0.
 * Corrige: acentos, concordancia, sintaxis, términos inventados.
 * NO cambia datos, cifras, nombres ni fuentes.
 */

import ZAI from 'z-ai-web-dev-sdk';
import { throttledLlmCall } from '@/lib/ai/llm-throttle';

// ─── Tipos ──────────────────────────────────────────────────────────

export interface GramaticaResult {
  corrected: boolean
  textoCorregido: string
  correcciones: GramaticaCorrection[]
  tokensUsados?: number
}

interface GramaticaCorrection {
  tipo: 'acento' | 'concordancia' | 'sintaxis' | 'termino_inventado' | 'ortografia' | 'puntuacion'
  original: string
  corregido: string
  razon: string
}

// ─── Prompt de Corrección ───────────────────────────────────────────

const GRAMATICA_SYSTEM_PROMPT = `Eres un corrector ortografico y gramatical de textos periodisticos en espanol boliviano. Tu UNICA tarea es corregir errores de ORTOGRAFIA, GRAMATICA y SINTAXIS.

REGLAS ESTRICTAS:
1. ACENTOS: Verifica que todas las palabras lleven sus tildes correctas (analisis, economia, publico, generacion, informacion, urgente, frecuencia, domingo, lunes, martes, miercoles, jueves, sabado, porcentaje, tecnica, politica, juridica, electrica, economica, critica, unica, basica, practica, historica, tipica, diaria, semanal, mensual, anual, ambiental, estatal, regional, nacional, institucional, parlamentaria, presupuestaria, presupuestaria, hidrocarburos, hidroelectrica, termica, nuclear, vehiculo, vehiculos, recursos, producidas, hidrico, climatico, publicaciones, prevencion, prevencion, autoridad, autoridades, ciudadania, ciudadania, presupuesto, presupuestos, capacidad, capacidades, seguridad, transparencia, transparencia, prioridad, prioridades, legitimidad, oportunidad, oportunidades, disponibilidad, disponibilidad, viabilidad, viabilidad,ibilidad, accesibilidad, accesibilidad, continuidad, continuidad, funcionalidad, funcionalidades).
2. CONCORDANCIA: "sectores productivos" (no "sectores productores"), "medios de comunicacion" (no "medios de comunicaciones"), "datos proporcionados" (no "datos proporcionado").
3. SINTAXIS: Cada oracion debe tener sujeto y verbo. Clausulas con "mientras" o "aunque" deben estar completas (no pueden terminar en "mientras sectores productivos alertan" sin la oracion principal). Corregir: une clausulas rotas o elimina conectores sin complemento.
4. PUNTUACION: Comas en listas enumeradas. Punto al final de cada parrafo. Dos puntos despues de titulos de secciones. Sin punto antes de cierre de parentesis o comillas.
5. ESPACIADO: Sin espacios extra entre numeros y puntos (1.200, no "1. 200"). Una sola linea en blanco entre parrafos (no \\n\\n\\n\\n).
6. TERMINOS INVENTADOS: Si una palabra no existe en espanol (ej: "sectores productores", "mientras tanto" como conector temporal), corregirla por el termino correcto.
7. PROHIBIDO CAMBIAR: Nombres de personas, cargos, cifras, datos, fechas, nombres de medios, citas textuales, o cualquier dato factual. Solo corregir la FORMA del texto, no el CONTENIDO.
8. FORMATO DE SALIDA: Mantener el formato markdown original (##, ###, **, etc.). No agregar ni eliminar secciones. No cambiar el orden del texto.
9. NOMBRES PROPIOS: NUNCA cambies nombres propios. Si ves "Edmundo" y no sabes si es correcto, DEJALO TAL CUAL. No "corrijas" nombres que parezcan incorrectos si no tienes certeza absoluta.
10. FORMATO DE NUMEROS: Separador de miles con punto (1.200), decimales con coma (9,73). No usar separadores de miles con espacios.

RESPUESTA EN FORMATO JSON:
{
  "corrected": true/false,
  "texto_corregido": "texto completo corregido (si hay cambios) o original (si no hay cambios)",
  "correcciones": [
    {"tipo": "acento|concordancia|sintaxis|termino_inventado|ortografia|puntuacion", "original": "texto original", "corregido": "texto corregido", "razon": "explicacion breve"}
  ]
}

Responde SOLO con el JSON, sin texto adicional.`;

// ─── Funcion Principal ─────────────────────────────────────────────

/**
 * Corrige ortografía y gramática del texto generado.
 * Se ejecuta como paso FINAL del pipeline, después de todos los demás.
 * 
 * @param textoFinal - Texto ya pasado por todos los demás pasos de post-procesamiento
 * @param tipoProducto - Tipo de producto (para logging)
 * @returns Texto corregido con lista de cambios
 */
export async function corregirOrtografiaGramatica(
  textoFinal: string,
  tipoProducto: string = 'desconocido'
): Promise<GramaticaResult> {

  const resultadoVacio: GramaticaResult = {
    corrected: false,
    textoCorregido: textoFinal,
    correcciones: [],
  };

  // Skip si texto vacio o muy corto
  if (!textoFinal || textoFinal.trim().length < 200) {
    return resultadoVacio;
  }

  try {
    // Enviar texto COMPLETO (sin truncar — es el paso final)
    // Si es muy largo (>12000 chars), partir en chunks pero corregir completo
    const texto = textoFinal.length > 12000
      ? textoFinal.substring(0, 12000)
      : textoFinal;

    const userPrompt = `TEXTO A CORREGIR (espanol boliviano, corregir SOLO ortografia/gramatica, NO cambiar datos):
---
${texto}
---

Corrige errores de ortografia, gramatica y sintaxis. Devuelve el JSON con el texto corregido.`;

    const zai = await ZAI.create();

    const completion = await throttledLlmCall(() => zai.chat.completions.create({
      model: 'glm-4.5-flash',
      messages: [
        { role: 'system', content: GRAMATICA_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.1,
    }));

    const responseText = completion.choices[0]?.message?.content?.trim();
    if (!responseText) {
      console.warn(`[corregir-gramatica] LLM no respondio para ${tipoProducto}`);
      return resultadoVacio;
    }

    // Parsear JSON — extraer el objeto del posible texto rodeando
    let jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn(`[corregir-gramatica] JSON no encontrado en respuesta para ${tipoProducto}`);
      return resultadoVacio;
    }

    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed || !parsed.texto_corregido) {
      console.warn(`[corregir-gramatica] JSON sin texto_corregido para ${tipoProducto}`);
      return resultadoVacio;
    }

    const result: GramaticaResult = {
      corrected: parsed.corrected === true,
      textoCorregido: parsed.texto_corregido,
      correcciones: (parsed.correcciones || []).map(c => ({
        tipo: c.tipo || 'ortografia',
        original: c.original || '',
        corregido: c.corregido || '',
        razon: c.razon || '',
      })),
      tokensUsados: completion.usage?.total_tokens,
    };

    // Safety net: verificar que el texto corregido no es significativamente más corto
    const lenOriginal = textoFinal.length;
    const lenCorregido = result.textoCorregido.length;
    if (lenCorregido < lenOriginal * 0.85) {
      console.warn(`[corregir-gramatica] Texto corregido ${Math.round((1 - lenCorregido/lenOriginal) * 100)}% mas corto, rechazando correccion para ${tipoProducto}`);
      return resultadoVacio;
    }

    // Safety net: verificar que no se introdujeron "N/A" ni "undefined"
    const originalNA = (textoFinal.match(/N\/A|undefined/g) || []).length;
    const correctedNA = (result.textoCorregido.match(/N\/A|undefined/g) || []).length;
    if (correctedNA > originalNA) {
      console.warn(`[corregir-gramatica] Correcciones introducen N/A o undefined, rechazando para ${tipoProducto}`);
      return resultadoVacio;
    }

    // Log
    if (result.corrected && result.correcciones.length > 0) {
      console.log(`[corregir-gramatica] ${tipoProducto}: ${result.correcciones.length} correcciones ortograficas/gramaticles (${result.tokensUsados} tokens)`);
      for (const c of result.correcciones) {
        console.log(`  → [${c.tipo}] "${c.original}" → "${c.corregido}" (${c.razon})`);
      }
    }

    return result;
  } catch (err) {
    console.warn(`[corregir-gramatica] Error para ${tipoProducto}:`, err);
    return resultadoVacio;
  }
}
