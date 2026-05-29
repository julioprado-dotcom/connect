/**
 * reporte-sectorial.narrative.ts — DECODEX Bolivia
 * Generación de narrativa mediante LLM para el Reporte Sectorial Minero.
 */

import ZAI from 'z-ai-web-dev-sdk';
import type { PrecioMetal } from '@/lib/yahoo-finance';
import type { EjeAgregado, ActorAgregado, FactorExterno } from './reporte-sectorial.queries';
import type { AlertaSectorial, MarcoPrinciples } from './reporte-sectorial.alerts';
import { formatMarcoForPrompt } from './reporte-sectorial.alerts';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface LLMNarrative {
  resumenEjecutivo: string;
  hitos: Array<{ titulo: string; detalle: string; tipo: string }>;
  factoresExternosNarrativa: string;
  tendenciaResumen: string;
}

// ─── Generación de narrativa LLM ──────────────────────────────────────────────

export async function generateLLMNarrative(
  datosEstructurados: {
    ejes: EjeAgregado[];
    actores: ActorAgregado[];
    factoresExternos: FactorExterno[];
    precios: PrecioMetal[];
    alertas: AlertaSectorial[];
    totalMenciones: number;
    totalMedios: number;
    periodoLabel: string;
    variacionTotal: number;
  },
  marco: MarcoPrinciples | null,
): Promise<LLMNarrative> {
  const defaultNarrative: LLMNarrative = {
    resumenEjecutivo:
      'No se pudo generar el resumen ejecutivo mediante inteligencia artificial.',
    hitos: [],
    factoresExternosNarrativa:
      datosEstructurados.factoresExternos.length > 0
        ? `Se detectaron ${datosEstructurados.factoresExternos.length} factores externos que podrían afectar al sector minero.`
        : 'No se detectaron factores externos significativos en este periodo.',
    tendenciaResumen: `La cobertura total del sector fue de ${datosEstructurados.totalMenciones} menciones en ${datosEstructurados.totalMedios} medios.`,
  };

  try {
    // ── Construir datos para el prompt ──
    const ejesText = datosEstructurados.ejes
      .map(
        (e) =>
          `- ${e.ejeTematico}: ${e.mencionCount} menciones, tratamiento predominante: ${e.tratamientoTop}, medio más activo: ${e.medioTop}`,
      )
      .join('\n');

    const actoresText = datosEstructurados.actores
      .map((a) => `- ${a.nombre}: ${a.menciones} menciones, tratamiento: ${a.tratamientoTop}`)
      .join('\n');

    const factoresText = datosEstructurados.factoresExternos
      .map((f) => `- "${f.titulo}" (${f.medio}, ${f.fecha}) — keyword: ${f.keyword}`)
      .join('\n');

    const preciosText =
      datosEstructurados.precios.length > 0
        ? datosEstructurados.precios
            .map(
              (p) =>
                `- ${p.metal}: ${p.precioActual.toFixed(2)} ${p.moneda} (var. semanal: ${p.variacionSemanal > 0 ? '+' : ''}${p.variacionSemanal.toFixed(2)}%)`,
            )
            .join('\n')
        : 'Datos no disponibles para este periodo.';

    const alertasText = datosEstructurados.alertas
      .map((a) => `- [${a.nivel}] ${a.mensaje}${a.eje ? ` (Eje: ${a.eje})` : ''}`)
      .join('\n');

    const marcoSection = marco
      ? `\n\n## MARCO CONCEPTUAL DEL SISTEMA (respetar estos principios en la narrativa):\n${formatMarcoForPrompt(marco)}\n`
      : '';

    const userPrompt = `## DATOS DEL REPORTE SECTORIAL MINERO
Periodo: ${datosEstructurados.periodoLabel}
Total menciones: ${datosEstructurados.totalMenciones}
Total medios: ${datosEstructurados.totalMedios}
Variación vs semana anterior: ${datosEstructurados.variacionTotal > 0 ? '+' : ''}${datosEstructurados.variacionTotal}%

### Cobertura por Eje Temático
${ejesText || 'Sin datos'}

### Actores Más Mencionados
${actoresText || 'Sin datos'}

### Precios Internacionales de Metales
${preciosText}

### Factores Externos Detectados
${factoresText || 'Ninguno detectado en este periodo.'}

### Alertas Sectoriales
${alertasText || 'Sin alertas para este periodo.'}

---
INSTRUCCIONES:
1. Escribe un RESUMEN EJECUTIVO de máximo 3 párrafos que capture la situación general del sector minero.
2. Identifica hasta 5 HITOS RELEVANTES de la semana (eventos, declaraciones, decisiones regulatorias, etc.).
3. Narra los FACTORES EXTERNOS en un párrafo breve.
4. Escribe un RESUMEN DE TENDENCIA comparando con la semana anterior.
5. NO INVENTES DATOS. Usa únicamente la información proporcionada arriba.
6. Usa un tono periodístico profesional, objetivo y analítico.
7. Responde ÚNICAMENTE con un JSON válido (sin markdown, sin backticks) con esta estructura exacta:
{
  "resumenEjecutivo": "...",
  "hitos": [{"titulo": "...", "detalle": "...", "tipo": "operativo|regulatorio|conflicto|negocio|otro"}],
  "factoresExternosNarrativa": "...",
  "tendenciaResumen": "..."
}`;

    const systemPrompt = `Eres un analista de información con formación periodística, especializado en el sector minero boliviano. Tu función es generar narrativas de reportes sectoriales basadas EXCLUSIVAMENTE en los datos proporcionados.

REGLAS ESTRICTAS:
- NUNCA inventes datos, cifras, nombres de personas ni eventos que no estén explícitamente mencionados en los datos.
- Mantén un tono profesional, objetivo y analítico.
- Usa terminología precisa del sector minero boliviano.
- Si un dato no está disponible, indícalo claramente.
- Estructura la información de forma clara y concisa.
- Los hitos deben ser eventos concretos, no generalidades.${marcoSection}`;

    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      model: 'glm-4.7-flash',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      signal: AbortSignal.timeout(60_000),
    });

    const raw = (completion?.choices?.[0]?.message?.content || '').trim();
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('[reporte-sectorial] LLM no retornó JSON válido. Usando narrativa por defecto.');
      return defaultNarrative;
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validar estructura
    return {
      resumenEjecutivo: typeof parsed.resumenEjecutivo === 'string'
        ? parsed.resumenEjecutivo
        : defaultNarrative.resumenEjecutivo,
      hitos: Array.isArray(parsed.hitos)
        ? parsed.hitos
            .filter(
              (h: Record<string, unknown>) =>
                typeof h.titulo === 'string' &&
                typeof h.detalle === 'string',
            )
            .map((h: Record<string, unknown>) => ({
              titulo: String(h.titulo),
              detalle: String(h.detalle),
              tipo: typeof h.tipo === 'string' ? String(h.tipo) : 'otro',
            }))
            .slice(0, 5)
        : [],
      factoresExternosNarrativa: typeof parsed.factoresExternosNarrativa === 'string'
        ? parsed.factoresExternosNarrativa
        : defaultNarrative.factoresExternosNarrativa,
      tendenciaResumen: typeof parsed.tendenciaResumen === 'string'
        ? parsed.tendenciaResumen
        : defaultNarrative.tendenciaResumen,
    };
  } catch (err) {
    console.error(
      '[reporte-sectorial] Error generando narrativa LLM:',
      err instanceof Error ? err.message : err,
    );
    return defaultNarrative;
  }
}
