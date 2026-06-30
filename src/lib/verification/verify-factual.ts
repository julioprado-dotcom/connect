/**
 * DECODEX v0.17.0 — Verificacion Factual con LLM (Segundo Pase)
 * 
 * Se ejecuta DESPUES de verify-product (heuristicas) y ANTES de guardar.
 * Usa un segundo pase LLM rapido para verificar:
 * - Nombres de personas: exactitud contra menciones fuente
 * - Cargos y generos: "ministra" vs "ministro", concordancia
 * - Datos duros: cifras, leyes, fechas, porcentajes
 * - Correcciones automaticas del texto
 */

import ZAI from 'z-ai-web-dev-sdk';
import { throttledLlmCall } from '@/lib/ai/llm-throttle';

// ─── Tipos ──────────────────────────────────────────────────────────

export interface FactualVerifyResult {
  corrected: boolean
  textoCorregido: string
  correcciones: FactualCorrection[]
  alertas: string[]
  tokensUsados?: number
}

interface FactualCorrection {
  tipo: 'nombre_erroneo' | 'cargo_erroneo' | 'genero_erroneo' | 'dato_erroneo' | 'otro'
  original: string
  corregido: string
  razon: string
}

interface MencionFactual {
  titulo: string
  texto?: string
  persona?: string | null
  medio?: string
}

// ─── Prompt de Verificacion ───────────────────────────────────────

const VERIFY_SYSTEM_PROMPT = `Eres un verificador factual de textos periodisticos. Tu UNICA tarea es verificar que los NOMBRES DE PERSONAS, CARGOS y GENEROS mencionados en el texto sean EXACTAMENTE iguales a los que aparecen en las menciones fuente.

REGLAS ESTRICTAS:
1. Si el texto dice "el ministro René García" pero las menciones dicen "la ministra Beatriz García", esto es ERROR CORREGIR a "la ministra Beatriz García"
2. NOMBRES INVENTADOS (REGLA CRITICA): Si el texto asocia un NOMBRE PROPIO a un cargo (ej: "el canciller Pamela Aramayo", "la ministra Maria Lopez") y ese NOMBRE NO aparece en NINGUNA mencion fuente, es un ERROR GRAVE. Debes ELIMINAR el nombre inventado y dejar solo el cargo: "el canciller declaro..." (sin nombre). Esta es la regla mas importante.
3. NOMBRES DEFORMADOS: Si el texto dice "Pamela Aramayo" pero las menciones dicen "Carlos Aramayo" (cambio de nombre o genero), es ERROR. Corregir al nombre EXACTO de las menciones.
4. Verifica concordancia de genero: "ministra" (femenino) vs "ministro" (masculino), "la" vs "el", "la diputada" vs "el diputado"
5. NO cambies la estructura del texto, solo corrige nombres/cargos/datos erroneos.
6. Si el texto esta correcto, devuélvelo tal cual sin cambios.
7. PROHIBIDO: NUNCA reemplaces un nombre con "N/A", "No disponible" o similar. Si no puedes verificar un nombre, déjalo TAL CUAL.

RESPUESTA EN FORMATO JSON:
{
  "corrected": true/false,
  "texto_corregido": "texto completo corregido (si hay cambios) o original (si no hay cambios)",
  "correcciones": [
    {"tipo": "nombre_erroneo|cargo_erroneo|genero_erroneo|dato_erroneo", "original": "texto original", "corregido": "texto corregido", "razon": "explicación"}
  ],
  "alertas": ["alertas opcionales sobre inconsistencias no corregibles"]
}

Responde SOLO con el JSON, sin texto adicional.`;

// ─── Funcion Principal ─────────────────────────────────────────────

/**
 * Verifica factualmente el texto generado usando un segundo pase LLM.
 * 
 * @param textoGenerado - Texto ya generado y pasado por verify-product
 * @param mencionesUsadas - Menciones reales usadas como input
 * @param tipoProducto - Tipo de producto (para logging)
 * @returns Resultado con texto corregido y lista de correcciones
 */
export async function verifyFactualWithLLM(
  textoGenerado: string,
  mencionesUsadas: MencionFactual[],
  tipoProducto: string = 'desconocido'
): Promise<FactualVerifyResult> {
  
  const resultadoVacio: FactualVerifyResult = {
    corrected: false,
    textoCorregido: textoGenerado,
    correcciones: [],
    alertas: [],
  };

  // Skip si texto vacio o muy corto
  if (!textoGenerado || textoGenerado.trim().length < 200) {
    return resultadoVacio;
  }

  // Skip si no hay menciones para comparar
  if (!mencionesUsadas || mencionesUsadas.length === 0) {
    return resultadoVacio;
  }

  try {
    // Construir lista de nombres/cargos extraidos de menciones para referencia
    const nombresYcargos = extractNamesAndPositions(mencionesUsadas);
    
    // Construir resumen compacto de menciones (max 4000 chars para no explotar token)
    const mencionesCompactas = mencionesUsadas
      .slice(0, 30) // max 30 menciones para no pasarse de tokens
      .map((m, i) => `${i + 1}. ${m.titulo}${m.persona ? ` — Persona: ${m.persona}` : ''}${m.medio ? ` (${m.medio})` : ''}`)
      .join('\n');

    const userPrompt = `TEXTO A VERIFICAR:
---
${textoGenerado.substring(0, 6000)}
---

NOMBRES Y CARGOS EN MENCIONES FUENTE (usa estos como referencia EXACTA):
---
${nombresYcargos}
---

MENCIONES FUENTE:
---
${mencionesCompactas}
---

Verifica que los nombres, cargos y generos en el texto coincidan EXACTAMENTE con las menciones fuente. Devuelve el JSON.`;

    const zai = await ZAI.create();
    
    const completion = await throttledLlmCall(() => zai.chat.completions.create({
      model: 'glm-4.5-flash', // modelo rapido para verificacion
      messages: [
        { role: 'system', content: VERIFY_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.1, // baja temperatura para verificacion precisa
    }));

    const responseText = completion.choices[0]?.message?.content?.trim();
    if (!responseText) {
      console.warn(`[verify-factual] LLM no respondio para ${tipoProducto}`);
      return resultadoVacio;
    }

    // Parsear respuesta JSON
    const parsed = parseJsonResponse(responseText);
    if (!parsed) {
      console.warn(`[verify-factual] JSON invalido de LLM para ${tipoProducto}: ${responseText.substring(0, 200)}`);
      return resultadoVacio;
    }

    const result: FactualVerifyResult = {
      corrected: parsed.corrected === true,
      textoCorregido: parsed.texto_corregido || textoGenerado,
      correcciones: (parsed.correcciones || []).map(c => ({
        tipo: c.tipo || 'otro',
        original: c.original || '',
        corregido: c.corregido || '',
        razon: c.razon || '',
      })),
      alertas: parsed.alertas || [],
      tokensUsados: completion.usage?.total_tokens,
    };

    // Safety net: si las correcciones introducen N/A, rechazar todo
    const originalNA = (textoGenerado.match(/N\/A/g) || []).length;
    const correctedNA = (result.textoCorregido.match(/N\/A/g) || []).length;
    if (correctedNA > originalNA) {
      console.warn(`[verify-factual] Rechazadas correcciones: introducen ${correctedNA - originalNA} N/A nuevos en ${tipoProducto}`);
      return { ...resultadoVacio, alertas: ['Correcciones rechazadas: introducían N/A'] };
    }

    // Log correcciones
    if (result.corrected && result.correcciones.length > 0) {
      console.log(`[verify-factual] ${result.correcciones.length} correcciones aplicadas en ${tipoProducto}:`);
      for (const c of result.correcciones) {
        console.log(`  [${c.tipo}] "${c.original}" → "${c.corregido}" (${c.razon})`);
      }
    }

    if (result.alertas.length > 0) {
      console.warn(`[verify-factual] Alertas en ${tipoProducto}: ${result.alertas.join('; ')}`);
    }

    return result;

  } catch (err) {
    // No bloquear pipeline si falla la verificacion
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[verify-factual] Error en verificacion LLM para ${tipoProducto}: ${msg.substring(0, 200)}`);
    return resultadoVacio;
  }
}

// ─── Funciones Auxiliares ─────────────────────────────────────────

/**
 * Extrae nombres y cargos de las menciones para referencia
 */
function extractNamesAndPositions(menciones: MencionFactual[]): string {
  const items: string[] = [];
  const seen = new Set<string>();

  for (const m of menciones) {
    if (m.persona && !seen.has(m.persona)) {
      seen.add(m.persona);
      items.push(`- Persona: "${m.persona}"`);
    }
    // Extraer nombres del titulo
    const nombres = extractProperNames(m.titulo);
    for (const n of nombres) {
      if (!seen.has(n)) {
        seen.add(n);
        items.push(`- Nombre en titular: "${n}" (medio: ${m.medio || '?'})`);
      }
    }
  }

  return items.length > 0 ? items.join('\n') : 'No se encontraron nombres especificos en las menciones.';
}

/**
 * Extrae nombres propios de un texto
 */
function extractProperNames(texto: string): string[] {
  if (!texto) return [];
  const names: string[] = [];
  // Patrones: "Nombre Apellido" (2+ palabras con mayuscula inicial)
  const pattern = /\b([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)+)\b/g;
  let match;
  while ((match = pattern.exec(texto)) !== null) {
    const name = match[1].trim();
    if (name.length > 4 && name.length < 60) {
      names.push(name);
    }
  }
  return names;
}

/**
 * Parsea la respuesta JSON del LLM, tolerando markdown wrapper
 */
function parseJsonResponse(text: string): Record<string, unknown> | null {
  // Intentar parsear directamente
  try {
    return JSON.parse(text);
  } catch {}

  // Intentar extraer JSON de bloques markdown ```json ... ```
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[1].trim());
    } catch {}
  }

  // Intentar encontrar primer { y ultimo }
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(text.substring(firstBrace, lastBrace + 1));
    } catch {}
  }

  return null;
}
