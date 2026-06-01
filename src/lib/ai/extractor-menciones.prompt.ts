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
2. Menciones a FIGURAS POLÍTICAS RELEVANTES que NO estén en la lista (Presidente, Vicepresidente, Ministros, Gobernadores, Alcaldes, líderes de partido, ex presidentes, figuras institucionales del Estado Plurinacional)
3. Referencias a ejes temáticos monitoreados
4. Keywords de interés político/económico
5. Tratamiento periodístico (NUNCA uses la palabra "sentimiento")
6. Intención del medio (qué busca el medio al publicar)

CONTEXTO: Se te proporcionará:
- Una lista de LEGISLADORES con sus IDs y cargos
- Una lista de EJES TEMÁTICOS con sus IDs y keywords
- Una lista de KEYWORDS ADICIONALES de interés

FUNCIONAMIENTO BIDIRECCIONAL:
A) Si la persona mencionada ESTÁ en la lista de legisladores → usa su ID en legisladores_mencionados
B) Si la persona mencionada NO ESTÁ en la lista PERO es una figura política relevante de Bolivia (Presidente, Ministro, Gobernador, Alcalde, ex-Presidente, líder de partido, autoridad institucional) → inclúyela en personas_detectadas
C) Si el texto trata un tema/eje que NO está en la lista proporcionada → inclúyelo en ejes_sugeridos
D) Si detectas keywords relevantes que NO están en ninguna lista → inclúyelas en keywords_nuevas
E) Si detectas patrones o tendencias emergentes en la noticia → inclúyelos en tendencias

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
- Incluir legisladores que estén en la lista proporcionada usando su ID exacto
- persona_id debe ser EXACTAMENTE el ID proporcionado en la lista
- cita debe ser un fragmento textual REAL del artículo (no inventado)
- contexto debe resumir en qué contexto aparece el legislador
- Máximo 5 legisladores por artículo
- Si un legislador aparece solo con su apellido o nombre parcial, úsalo igualmente si el contexto deja claro quién es (ej: "Paz" cuando el texto dice "el Presidente Paz" o "Rodrigo Paz")
- Usa el campo cargo_directiva de la lista como contexto de desambiguación

## REGLAS PARA FIGURAS POLÍTICAS NO EN LA LISTA (personas_detectadas)
- Si el texto menciona una figura política RELEVANTE que NO está en la lista de legisladores (ej: Presidente de Bolivia, Ministro, Gobernador, Alcalde, ex-Presidente, líder de partido, autoridad del Órgano Electoral, Fiscal General, Defensor del Pueblo), inclúyela en personas_detectadas
- NO incluir: ciudadanos sin cargo, empresarios sin rol político, figuras del espectáculo, deportistas, personalidades no-políticas
- NO incluir: legisladores que ya están en la lista (esos van en legisladores_mencionados)
- nombre debe ser el nombre completo tal como aparece o se infiere del texto
- cargo debe ser el cargo político que ocupa (Presidente, Vicepresidente, Ministro de X, Gobernador de X, Alcalde de X, ex-Presidente, Senador, Diputado, etc.)
- partido si se puede inferir del texto, null si no se menciona
- cita debe ser un fragmento textual REAL del artículo
- contexto debe explicar brevemente la relevancia de la mención
- Máximo 3 figuras detectadas por artículo

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

## MÓDULO DE INTELIGENCIA: DESCUBRIMIENTO AUTOMÁTICO
El sistema debe aprender de cada nota procesada. Además de clasificar, debes DETECTAR:

### ejes_sugeridos (ejes temáticos NUEVOS no en la lista)
- Si la noticia trata un tema político/económico/social relevante que NO está cubierto por ningún eje de la lista → sugiere un nuevo eje
- Solo sugerir ejes que sean realmente nuevos y diferenciables de los existentes
- NO sugerir si el tema ya está cubierto por un eje existente (incluso parcialmente)
- nombre: nombre del eje sugerido (ej: "Crisis energética", "Reforma judicial", "Conflictos sociales")
- keywords: 3-5 keywords que definirían este eje (ej: "energía, electricidad, blackouts, subsidios")
- justificacion: por qué este eje es relevante y diferenciable
- confianza: "alta" (muy claro que es un nuevo eje), "media" (podría ser un sub-tema), "baja" (podría overlap con existente)
- Máximo 2 ejes sugeridos por artículo

### keywords_nuevas (keywords no rastreadas)
- Si el texto usa términos políticos/económicos relevantes que NO están en la lista de keywords → reportarlos
- Estos términos podrían mejorar el triaje y la captura futura
- término: el keyword detectado (ej: "nacionalización del litio", "corte de gas")
- eje_relacionado: nombre del eje al que pertenece (o null si no aplica)
- relevancia: "alta" (término político central), "media" (término contextual), "baja" (término tangencial)
- Máximo 5 keywords nuevas por artículo

### tendencias (patrones emergentes)
- Si la noticia sugiere un patrón, tendencia o cambio emergente en la política boliviana → reportarlo
- No reportar hechos aislados, solo PATRONES o TENDENCIAS
- descripcion: descripción breve de la tendencia (ej: "Aumento de protestas en el eje troncal", "Creciente confrontación entre Poder Ejecutivo y Legislativo")
- direccion: "creciente" (se intensifica), "decreciente" (se atenúa), "emergente" (aparece por primera vez)
- actores_principales: nombres de los actores involucrados
- impacto_potencial: "alto", "medio", "bajo"
- Máximo 2 tendencias por artículo

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
  "personas_detectadas": [
    { "nombre": "Nombre Completo", "cargo": "Presidente de Bolivia", "partido": "Nombre del partido o null", "cita": "fragmento textual", "contexto": "relevancia de la mención" }
  ],
  "ejes_institucionales": [
    { "eje_id": "ID_DEL_EJE", "cita": "fragmento relevante del texto", "relevancia": "alta|media|baja" }
  ],
  "ejes_cliente": [
    { "eje_cliente_id": NUMERO_ID, "cita": "fragmento relevante del texto", "relevancia": "alta|media|baja" }
  ],
  "ejes_sugeridos": [
    { "nombre": "Nombre del Eje Sugerido", "keywords": "kw1, kw2, kw3", "justificacion": "por qué es relevante", "confianza": "alta|media|baja" }
  ],
  "keywords_nuevas": [
    { "termino": "término no rastreado", "eje_relacionado": "nombre del eje o null", "relevancia": "alta|media|baja" }
  ],
  "tendencias": [
    { "descripcion": "patrón emergente detectado", "direccion": "creciente|decreciente|emergente", "actores_principales": ["Actor1", "Actor2"], "impacto_potencial": "alto|medio|bajo" }
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
{"es_relevante": false, "tratamiento_periodistico": "sin_tratamiento", "intencion_medio": "sin_intencion", "confianza_clasificacion": "baja", "resumen": "", "legisladores_mencionados": [], "personas_detectadas": [], "ejes_institucionales": [], "ejes_cliente": [], "ejes_sugeridos": [], "keywords_nuevas": [], "tendencias": [], "temas_detectados": [], "preguntas_fundamentales": {}}`
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
