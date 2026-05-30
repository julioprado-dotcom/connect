// Extraer menciones de legisladores Y temas relevantes de texto de noticias usando LLM
// DECODEX Bolivia — Pipeline A (scrape-fuente)
// Prompt building logic extracted from extractor-menciones.ts

import { MarcoData, safeJson } from './extractor-menciones.cache';
import {
  DEFAULT_ESCALA,
  DEFAULT_PREGUNTAS,
  DEFAULT_PRINCIPIOS,
} from './extractor-menciones.config';

/**
 * Build the system prompt dynamically from the Marco Conceptual.
 * FASE 4D: Added INTENCIÓN DEL MEDIO section.
 */
export function buildSystemPrompt(marco: MarcoData | null): string {
  // ── Principios ──
  const principios = marco
    ? safeJson<{ codigo: string; nombre: string; reglas_operativas?: string }[]>(marco.principios, DEFAULT_PRINCIPIOS)
    : DEFAULT_PRINCIPIOS;

  const principiosSection = principios
    .map((p, i) => `${i + 1}. **${p.nombre}** (${p.codigo})\n   - ${p.reglas_operativas || ''}`)
    .join('\n');

  // ── Escala de Tratamiento Periodístico ──
  let escala: { codigo: string; nombre: string }[];
  if (marco) {
    const escalaRaw = safeJson<{ categorias?: { codigo: string; nombre: string }[] } | { codigo: string; nombre: string }[]>(
      marco.escalaTratamiento,
      DEFAULT_ESCALA,
    );
    escala = Array.isArray(escalaRaw) && escalaRaw.length > 0 && 'codigo' in escalaRaw[0]
      ? escalaRaw as { codigo: string; nombre: string }[]
      : ('categorias' in (escalaRaw as Record<string, unknown>)
          ? ((escalaRaw as { categorias: { codigo: string; nombre: string }[] }).categorias)
          : DEFAULT_ESCALA);
  } else {
    escala = DEFAULT_ESCALA;
  }

  const escalaSection = escala
    .map(e => `- **${e.codigo}**: ${e.nombre}`)
    .join('\n');

  // ── Criterios de Relevancia ──
  let criteriosRelevancia: string[] = [];
  let noCriterios: string[] = [];
  if (marco) {
    const cr = safeJson<unknown>(marco.criteriosRelevancia, null);
    if (Array.isArray(cr)) {
      // Formato array: ['criterio1', ...] o [{criterio: '...'}, ...]
      criteriosRelevancia = (cr as unknown[]).map((c: unknown) =>
        typeof c === 'string' ? c : (c as Record<string, string>)?.criterio || ''
      ).filter(Boolean);
    } else if (cr && typeof cr === 'object') {
      // Formato objeto: { es_relevante_si: [...], no_es_relevante_si: [...] }
      const obj = cr as Record<string, unknown>;
      criteriosRelevancia = Array.isArray(obj.es_relevante_si)
        ? (obj.es_relevante_si as string[]).filter(Boolean) : [];
      noCriterios = Array.isArray(obj.no_es_relevante_si)
        ? (obj.no_es_relevante_si as string[]).filter(Boolean) : [];
    }
  }
  if (criteriosRelevancia.length === 0) {
    criteriosRelevancia = [
      'Menciona al menos un legislador monitoreado',
      'Se refiere a al menos un eje temático monitoreado',
      'Contiene al menos una keyword de interés',
    ];
  }

  let criteriosSection = criteriosRelevancia.map(c => `- ${c}`).join('\n');
  if (noCriterios.length > 0) {
    criteriosSection += '\n\nes_relevante = false SI se cumple ALGUNO de estos:\n' +
      noCriterios.map(c => `- ${c}`).join('\n');
  }

  // ── Terminología ──
  const terminosPermitidos: string[] = marco
    ? safeJson<string[]>(marco.terminologiaPermitida, [])
    : [];
  const terminosProhibidos: string[] = marco
    ? safeJson<string[]>(marco.terminologiaProhibida, [])
    : [];

  let terminologiaSection = '';
  if (terminosPermitidos.length > 0) {
    terminologiaSection += `\n**Términos PERMITIDOS** (usar estos):\n${terminosPermitidos.map(t => `- ${t}`).join('\n')}\n`;
  }
  if (terminosProhibidos.length > 0) {
    terminologiaSection += `\n**Términos PROHIBIDOS** (NUNCA usar estos):\n${terminosProhibidos.map(t => `- ${t}`).join('\n')}\n`;
  }

  // ── Exclusiones Éticas ──
  const exclusionesRaw: unknown[] = marco
    ? safeJson<unknown[]>(marco.exclusionesEtica, [])
    : [];
  let exclusionesSection = '';
  if (exclusionesRaw.length > 0) {
    const exclusionesList = exclusionesRaw
      .map((e) => typeof e === 'string' ? e : (e as Record<string, string>)?.exclusion || '')
      .filter(Boolean);
    if (exclusionesList.length > 0) {
      exclusionesSection = `\n**Exclusiones éticas** (no procesar si la noticia trata de):\n${exclusionesList.map(ex => `- ${ex}`).join('\n')}\n`;
    }
  }

  // ── Preguntas Fundamentales ──
  const preguntas = marco
    ? safeJson<{ codigo: string; nombre: string; descripcion?: string }[]>(marco.preguntasFundamentales, DEFAULT_PREGUNTAS)
    : DEFAULT_PREGUNTAS;

  const preguntasSection = preguntas
    .map(p => `- **${p.codigo}** (${p.nombre}): ${p.descripcion || ''}`)
    .join('\n');

  // ── Assemble full prompt ──
  return `Eres un extractor avanzado de información política boliviana. Analiza textos de noticias y detecta:
1. Menciones a legisladores bolivianos (de la lista proporcionada)
2. Referencias a ejes temáticos monitoreados
3. Keywords de interés político/económico
4. Tratamiento periodístico (NUNCA uses la palabra "sentimiento")
5. Intención del medio (qué busca el medio al publicar)

CONTEXTO: Se te proporcionará:
- Una lista de LEGISLADORES con sus IDs
- Una lista de EJES TEMÁTICOS con sus IDs y keywords
- Una lista de KEYWORDS ADICIONALES de interés

## PRINCIPIOS FUNDAMENTALES (INMUTABLES)

${principiosSection}

## ESCALA DE TRATAMIENTO PERIODÍSTICO

${escalaSection}

## CRITERIOS DE RELEVANCIA

es_relevante = true SI se cumple AL MENOS UNO de estos criterios:
${criteriosSection}

Si la noticia no menciona nada relevante, es_relevante = false y devuelve arrays vacíos.
${terminologiaSection}${exclusionesSection}
## LAS 8 PREGUNTAS FUNDAMENTALES

Debes intentar responder estas preguntas a partir del texto:
${preguntasSection}

## INTENCIÓN DEL MEDIO (dimensión independiente del tratamiento)
Clasifica QUÉ BUSCA EL MEDIO al publicar esta nota (no cómo trata al actor):
- informativa: busca informar sobre un hecho/evento, sin tomar posición
- opinion: publica posición editorial, columna o análisis valorativo
- critica: busca cuestionar, denunciar o generar descrédito
- elogiosa: busca resaltar positivamente, promocionar o legitimar
- reactiva: responde a declaración/acusación/publicación previa de otro medio o actor
- sin_intencion: no se puede determinar o el texto es insuficiente

La intención y el tratamiento son dimensiones INDEPENDIENTES: una nota puede ser informativa (intención) pero con tratamiento crítico, o puede ser elogiosa (intención) con tratamiento informativo.

## REGLAS PARA LEGISLADORES
- Solo incluir legisladores que estén en la lista proporcionada
- persona_id debe ser EXACTAMENTE el ID proporcionado en la lista
- cita debe ser un fragmento textual REAL del artículo (no inventado)
- contexto debe resumir en qué contexto aparece el legislador
- Máximo 5 legisladores por artículo

## REGLAS PARA EJES TEMÁTICOS
- Solo incluir ejes de la lista proporcionada
- eje_id debe ser EXACTAMENTE el ID proporcionado
- cita debe ser un fragmento real del texto que justifica la clasificación
- relevancia: "alta" (artículo central sobre el tema), "media" (mencionado significativamente), "baja" (referencia tangencial)
- Máximo 3 ejes por artículo

## REGLAS PARA EJES DEL CLIENTE
- Solo incluye si se proporciona la sección "EJES TEMÁTICOS DEL CLIENTE"
- CLIENTE_EJE_ID debe ser EXACTAMENTE el ID numérico proporcionado
- Clasifica solo si el texto coincide CLARAMENTE con las keywords del eje del cliente
- Máximo 3 ejes del cliente por artículo

## TEMAS DETECTADOS
- Lista de 1-5 temas o conceptos clave que trata la noticia
- Usar términos cortos y descriptivos (ej: "pensiones", "reforma laboral", "gas natural")

## RESUMEN
- Máximo 200 palabras
- Debe reflejar la CALIDAD Y TONO ORIGINAL del texto fuente
- No mejorar, suavizar ni reinterpretar

## REGLAS CRÍTICAS
- Usa "tratamiento periodístico" NUNCA "sentimiento"
- Sé fiel al texto fuente — no mejorarlo, suavizarlo ni reinterpretarlo
- Si el texto es 100% crítico, clasifícalo como 100% crítico — NO inventes balance
- Si el texto fuente NO responde una pregunta fundamental → null (NUNCA inventes)
- Usa terminología permitida, NUNCA uses términos prohibidos
- Detecta ironía/sarcasmo → clasifica como tratamiento_editorial
- Separa "por qué" (causa) de "para qué" (intención)
- confianza_clasificacion: "alta" (muy seguro), "media" (razonablemente seguro), "baja" (poco seguro)

## FORMATO DE SALIDA

Responde ÚNICAMENTE con un JSON válido (sin markdown, sin backticks) con esta estructura exacta:
{
  "es_relevante": true,
  "tratamiento_periodistico": "tratamiento_informativo",
  "intencion_medio": "informativa",
  "confianza_clasificacion": "alta",
  "resumen": "resumen fiel de max 200 palabras",
  "legisladores_mencionados": [
    { "persona_id": "ID_DE_PERSONA", "cita": "fragmento textual donde aparece el legislador", "contexto": "contexto en 20 palabras" }
  ],
  "ejes_institucionales": [
    { "eje_id": "ID_DEL_EJE", "cita": "fragmento relevante del texto", "relevancia": "alta|media|baja" }
  ],
  "ejes_cliente": [
    { "eje_cliente_id": NUMERO_ID, "cita": "fragmento relevante del texto", "relevancia": "alta|media|baja" }
  ],
  "temas_detectados": ["tema1", "tema2", "tema3"],
  "preguntas_fundamentales": {
    "que": "evento principal or null",
    "quien": { "declara": "nombre or null", "afectado_directo": "nombre or null", "mencionados": [] },
    "cuando": "fecha o null",
    "como": "mecanismo or null",
    "por_que": "causa or null",
    "para_que": { "actor": "intención or null", "medio": "intención or null", "confianza": "alta|media|baja" },
    "a_quienes_afecta": { "directos": [], "indirectos": [], "potenciales": [], "mencionados_en_texto": false },
    "donde": "lugar or null"
  }
}

VALORES VÁLIDOS para tratamiento_periodistico:
${escala.map(e => e.codigo).join(', ')}

VALORES VÁLIDOS para intencion_medio:
informativa, opinion, critica, elogiosa, reactiva, sin_intencion

Si es_relevante = false, devolver:
{"es_relevante": false, "tratamiento_periodistico": "sin_tratamiento", "intencion_medio": "sin_intencion", "confianza_clasificacion": "baja", "resumen": "", "legisladores_mencionados": [], "ejes_institucionales": [], "ejes_cliente": [], "temas_detectados": [], "preguntas_fundamentales": {}}`;
}

/**
 * Map tratamiento_periodistico to a backward-compatible sentimiento value.
 */
export function tratamientoToSentimiento(tratamiento: string): string {
  switch (tratamiento) {
    case 'tratamiento_informativo':
      return 'neutro';
    case 'tratamiento_analitico':
      return 'neutro';
    case 'tratamiento_critico':
      return 'negativo';
    case 'tratamiento_editorial':
      return 'neutro';
    case 'tratamiento_agresivo':
      return 'negativo';
    case 'tratamiento_elogioso':
      return 'positivo';
    case 'tratamiento_ambiguo':
      return 'mixto';
    case 'sin_tratamiento':
    default:
      return 'no_clasificado';
  }
}

/**
 * Derive tipoMencion from tratamiento periodístico + presence of direct quote.
 * - Direct quote + critical/aggressive treatment → mencion_critica
 * - Direct quote + elogioso treatment → mencion_activa
 * - Direct quote (neutral/other) → mencion_directa
 * - No direct quote → mencion_pasiva
 */
export function tratamientoToTipoMencion(tratamiento: string, tieneCitaDirecta: boolean): string {
  if (!tieneCitaDirecta) return 'mencion_pasiva';
  if (tratamiento === 'tratamiento_critico' || tratamiento === 'tratamiento_agresivo') return 'mencion_critica';
  if (tratamiento === 'tratamiento_elogioso') return 'mencion_activa';
  return 'mencion_directa';
}
