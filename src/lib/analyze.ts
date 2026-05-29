import { Prisma } from '@prisma/client';
import ZAI from 'z-ai-web-dev-sdk';
import db from '@/lib/db';

// ─── Helpers ──────────────────────────────────────────────────

/**
 * Map tratamiento_periodistico to backward-compatible sentimiento.
 */
function tratamientoToSentimiento(tratamiento: string): string {
  switch (tratamiento) {
    case 'tratamiento_informativo':
    case 'tratamiento_analitico':
    case 'tratamiento_editorial':
      return 'neutro';
    case 'tratamiento_critico':
    case 'tratamiento_agresivo':
      return 'negativo';
    case 'tratamiento_elogioso':
      return 'positivo';
    case 'tratamiento_ambiguo':
      return 'mixto';
    default:
      return 'no_clasificado';
  }
}

// ─── Ejes temáticos — cargados dinámicamente desde la DB ──────
// Ya NO usamos slugs hardcodeados. Los ejes se cargan desde EjeTematico.
// Se mantiene EJES_TEMATICOS como fallback para el prompt del LLM.

export const EJES_TEMATICOS = [
  { slug: 'hidrocarburos-energia', nombre: 'Hidrocarburos, Energía y Combustible' },
  { slug: 'movimientos-sociales', nombre: 'Movimientos Sociales y Conflictividad' },
  { slug: 'gobierno-oposicion', nombre: 'Gobierno, Oposición e Instituciones' },
  { slug: 'corrupcion-impunidad', nombre: 'Corrupción e Impunidad' },
  { slug: 'economia', nombre: 'Economía y Política Económica' },
  { slug: 'justicia-derechos', nombre: 'Justicia y Derechos Humanos' },
  { slug: 'procesos-electorales', nombre: 'Procesos Electorales' },
  { slug: 'educacion-cultura', nombre: 'Educación, Universidades y Cultura' },
  { slug: 'salud-servicios', nombre: 'Salud y Servicios Públicos' },
  { slug: 'medio-ambiente', nombre: 'Medio Ambiente, Territorio y Recursos' },
  { slug: 'relaciones-internacionales', nombre: 'Relaciones Internacionales' },
];

export const VALID_SLUGS = new Set(EJES_TEMATICOS.map(e => e.slug));

// ─── Cache dinámico de ejes desde la DB (TTL 120s) ─────────────
let _ejesCache: { data: Map<string, string>; expiry: number } | null = null;

async function getEjesSlugMap(): Promise<Map<string, string>> {
  if (_ejesCache && _ejesCache.expiry > Date.now()) {
    return _ejesCache.data;
  }
  const ejes = await db.ejeTematico.findMany({
    where: { activo: true },
    select: { id: true, slug: true },
  });
  const map = new Map(ejes.map(e => [e.slug.toLowerCase().trim(), e.id]));
  _ejesCache = { data: map, expiry: Date.now() + 120_000 };
  return map;
}

// ─── Default escala when Marco Conceptual is not loaded ──────

const DEFAULT_ESCALA = [
  { codigo: 'tratamiento_informativo', nombre: 'Informativo', definicion: 'Cobertura factual, sin carga valorativa.' },
  { codigo: 'tratamiento_analitico', nombre: 'Analítico', definicion: 'Incluye contexto, antecedentes, múltiples fuentes.' },
  { codigo: 'tratamiento_critico', nombre: 'Crítico', definicion: 'Cuestionamiento fundamentado con evidencia.' },
  { codigo: 'tratamiento_editorial', nombre: 'Editorializante', definicion: 'Opinión del medio, toma de posición.' },
  { codigo: 'tratamiento_agresivo', nombre: 'Agresivo', definicion: 'Ataque personal, descalificación.' },
  { codigo: 'tratamiento_elogioso', nombre: 'Elogioso', definicion: 'Reconocimiento, perfil positivo.' },
  { codigo: 'tratamiento_ambiguo', nombre: 'Ambiguo', definicion: 'No se puede determinar el tratamiento.' },
  { codigo: 'sin_tratamiento', nombre: 'Sin clasificar', definicion: 'Insuficiente información.' },
];

const VALID_TRATAMIENTOS = new Set(DEFAULT_ESCALA.map(e => e.codigo));

// ─── Tipo de retorno ──────────────────────────────────────────

export interface AnalyzeResult {
  tipoMencion: string;
  sentimiento: string;                    // backward compat — mapped from tratamiento
  tratamientoPeriodistico: string;        // the actual classification
  intencionMedio: string;                 // FASE 4D: informativa|opinion|critica|elogiosa|reactiva|sin_intencion
  confianzaClasificacion: string;         // "alta" | "media" | "baja"
  ejesTematicos: string[];
  preguntasFundamentales: Record<string, unknown> | null;  // the 8 fundamental questions
}

// ─── Helpers ──────────────────────────────────────────────────

/**
 * Build the treatment scale section of the system prompt.
 * Accepts the array from marco.escalaTratamiento.categorias or falls back to DEFAULT_ESCALA.
 */
function buildEscalaPrompt(categorias: Array<{ codigo: string; nombre: string; definicion: string }>): string {
  const lines = categorias.map((c, i) => `${i + 1}. ${c.codigo}: ${c.nombre} — ${c.definicion}`).join('\n');
  return `TRATAMIENTO PERIODÍSTICO (del medio/fuente hacia el legislador):
${lines}`;
}

/**
 * Extract the categorias array from the marco's escalaTratamiento JSON field.
 */
function extractCategorias(escalaJson: unknown): Array<{ codigo: string; nombre: string; definicion: string }> | null {
  if (!escalaJson || typeof escalaJson !== 'object') return null;
  const obj = escalaJson as Record<string, unknown>;
  const cats = obj.categorias;
  if (!Array.isArray(cats)) return null;
  return cats
    .filter(
      (c: unknown) =>
        c !== null &&
        typeof c === 'object' &&
        typeof (c as Record<string, unknown>).codigo === 'string' &&
        typeof (c as Record<string, unknown>).nombre === 'string',
    )
    .map((c: unknown) => {
      const item = c as Record<string, unknown>;
      return {
        codigo: String(item.codigo),
        nombre: String(item.nombre),
        definicion: item.definicion ? String(item.definicion) : '',
      };
    });
}

/**
 * Check text against prohibited terminology from Marco Conceptual.
 * Accepts string[] or { terminos: string[] } format.
 * Returns list of found terms (empty = clean).
 */
function checkProhibitedTerms(
  texto: string,
  terminologiaProhibida: unknown,
): string[] {
  if (!terminologiaProhibida) return [];

  // Support both string[] and { terminos: string[] } formats
  let terms: unknown[];
  if (Array.isArray(terminologiaProhibida)) {
    terms = terminologiaProhibida as unknown[];
  } else if (typeof terminologiaProhibida === 'object' && terminologiaProhibida !== null) {
    const obj = terminologiaProhibida as Record<string, unknown>;
    terms = Array.isArray(obj.terminos) ? obj.terminos as unknown[] : [];
  } else {
    return [];
  }

  const found: string[] = [];
  const lowerText = texto.toLowerCase();
  for (const t of terms) {
    if (typeof t === 'string' && t.trim() && lowerText.includes(t.trim().toLowerCase())) {
      found.push(t.trim());
    }
  }
  return found;
}

// ─── Build system prompt dynamically ──────────────────────────

function buildSystemPrompt(
  escala: Array<{ codigo: string; nombre: string; definicion: string }>,
): string {
  const escalaSection = buildEscalaPrompt(escala);

  return `Eres un analista de medios boliviano especializado en cobertura política y legislativa. Analiza la siguiente mención de un legislador boliviano en un medio de comunicación y clasifícala usando la escala de TRATAMIENTO PERIODÍSTICO (NO sentimiento) y la INTENCIÓN DEL MEDIO.

Responde ÚNICAMENTE con un JSON válido (sin markdown, sin backticks) con esta estructura exacta:
{
  "tipoMencion": "cita_directa | mencion_pasiva | cobertura_declaracion | contexto | foto_video",
  "tratamiento_periodistico": "${escala.map(e => e.codigo).join(' | ')}",
  "intencion_medio": "informativa | opinion | critica | elogiosa | reactiva | sin_intencion",
  "confianza_clasificacion": "alta | media | baja",
  "ejesTematicos": ["slug1", "slug2"],
  "preguntas_fundamentales": {
    "que": "... or null",
    "quien": { "declara": "... or null", "afectado_directo": "... or null", "mencionados": [] },
    "cuando": "... or null",
    "como": "... or null",
    "por_que": "... or null",
    "para_que": { "actor": "... or null", "medio": "... or null", "confianza": "alta|media|baja" },
    "a_quienes_afecta": { "directos": [], "indirectos": [], "potenciales": [], "mencionados_en_texto": false },
    "donde": "... or null"
  }
}

TIPOS DE MENCIÓN:
- cita_directa: el legislador es citado textualmente con comillas
- mencion_pasiva: se nombra al legislador pero no como fuente principal
- cobertura_declaracion: cobertura de una declaración o rueda de prensa del legislador
- contexto: aparece mencionado en el contexto de un artículo sobre otro tema
- foto_video: aparece en fotografía o video

INTENCIÓN DEL MEDIO (qué busca el medio al publicar, independiente del tratamiento):
- informativa: busca informar sobre un hecho/evento, sin tomar posición
- opinion: publica posición editorial, columna o análisis valorativo
- critica: busca cuestionar, denunciar o generar descrédito
- elogiosa: busca resaltar positivamente, promocionar o legitimar
- reactiva: responde a declaración/acusación/publicación previa de otro medio o actor
- sin_intencion: no se puede determinar o el texto es insuficiente

${escalaSection}

CONFIANZA DE CLASIFICACIÓN:
- alta: el texto es claro y no deja duda sobre el tratamiento
- media: hay indicios pero la interpretación puede variar
- baja: el texto es insuficiente o ambiguo para clasificar con certeza

PREGUNTAS FUNDAMENTALES — Responde SOLO con lo que el texto diga explícitamente. Si el texto no responde una pregunta, usa null. NO inventes ni infieras datos.
- que: ¿Qué ocurrió / qué se declara?
- quien: ¿Quién declara? ¿Quién es afectado directo? ¿Quiénes son mencionados?
- cuando: ¿Cuándo ocurrió?
- como: ¿Cómo ocurrió?
- por_que: ¿Por qué ocurrió?
- para_que: ¿Con qué propósito? Incluye actor, medio y confianza de la atribución.
- a_quienes_afecta: ¿A quiénes afecta? Listar directos, indirectos, potenciales y si se mencionan en el texto.
- donde: ¿Dónde ocurrió?

EJES TEMÁTICOS — clasifica en máximo 3 ejes (de mayor a menor relevancia):
1. hidrocarburos-energia: gas, petróleo, YPFB, litio, electricidad, subsidios, gasolina, diésel
2. movimientos-sociales: bloqueos, marchas, paros, protestas, COB, CSUTCB, CSCB, conflictos
3. gobierno-oposicion: Asamblea, diputados, senadores, leyes, bancadas, partidos, gestión
4. corrupcion-impunidad: denuncias, auditorías, irregularidades, Fondo Indígena, comisiones
5. economia: inflación, dólar, tipo de cambio, PIB, presupuesto, reservas, empleo
6. justicia-derechos: Fiscalía, tribunales, sentencias, derechos humanos, detenciones
7. procesos-electorales: elecciones, TSE, candidatos, votación, escrutinio
8. educacion-cultura: magisterio, universidades, presupuesto educativo, cultura
9. salud-servicios: hospitales, medicamentos, sistema de salud, servicios públicos
10. medio-ambiente: agua, incendios, minería, deforestación, territorio, autonomías
11. relaciones-internacionales: fronteras, migración, embajadas, cooperación, tratados

Si la mención no encaja en ningún eje, devuelve un array vacío.`;
}

// ─── Función principal de análisis ────────────────────────────

export async function analyzeMencion(titulo: string, texto: string): Promise<AnalyzeResult> {
  const defaultResult: AnalyzeResult = {
    tipoMencion: 'contexto',
    sentimiento: 'sin_tratamiento',
    tratamientoPeriodistico: 'sin_tratamiento',
    intencionMedio: 'sin_intencion',
    confianzaClasificacion: 'baja',
    ejesTematicos: [],
    preguntasFundamentales: null,
  };

  try {
    // ── Load active Marco Conceptual ──────────────────────────
    let escala = DEFAULT_ESCALA;
    let terminologiaProhibida: unknown = null;

    try {
      const marco = await db.marco_conceptual.findFirst({ where: { activa: true } });

      if (marco) {
        // Extract treatment scale categories
        const cats = extractCategorias(marco.escalaTratamiento);
        if (cats && cats.length > 0) {
          escala = cats;
          console.log(`[MC] Marco Conceptual v${marco.version} loaded — ${cats.length} categorías de tratamiento.`);
        } else {
          console.warn('[MC] Marco Conceptual found but escalaTratamiento.categorias is empty or malformed. Using DEFAULT_ESCALA.');
        }

        // Store prohibited terminology for post-check
        terminologiaProhibida = marco.terminologiaProhibida;
      } else {
        console.warn('[MC] No active Marco Conceptual found in DB. Using DEFAULT_ESCALA.');
      }
    } catch (err) {
      console.warn('[MC] Error loading Marco Conceptual from DB. Using DEFAULT_ESCALA.', err);
    }

    // ── Build prompt and call LLM ─────────────────────────────
    const systemPrompt = buildSystemPrompt(escala);
    const fullText = `${titulo}\n${texto}`.trim();

    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      model: 'glm-4.7-flash',
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Analiza esta mención:\n\nTítulo: ${titulo}\nTexto: ${texto}`,
        },
      ],
      temperature: 0.2,
      signal: AbortSignal.timeout(60000), // 60s timeout
    });

    const raw = (completion?.choices?.[0]?.message?.content || '').trim();
    console.log(`[analyze] LLM raw response (${raw.length} chars): ${raw.substring(0, 500)}`);
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn(`[analyze] No JSON found in LLM response for: ${titulo.substring(0, 80)}`);
      return defaultResult;
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch (parseErr) {
      console.warn(`[analyze] JSON parse failed for: ${titulo.substring(0, 80)}. Raw: ${raw.substring(0, 300)}`);
      return defaultResult;
    }
    console.log(`[analyze] Parsed OK: tipoMencion=${parsed.tipoMencion}, tratamiento=${parsed.tratamiento_periodistico}, ejes=${JSON.stringify(parsed.ejesTematicos)}`);

    // ── Validate tratamiento_periodistico ──────────────────────
    let tratamientoRaw = String(
      parsed.tratamiento_periodistico || parsed.tratamientoPeriodistico || parsed.tratamiento || 'sin_tratamiento',
    )
      .toLowerCase()
      .trim();
    // Accept with or without "tratamiento_" prefix
    if (
      !VALID_TRATAMIENTOS.has(tratamientoRaw) &&
      tratamientoRaw.startsWith('tratamiento_')
    ) {
      // Already has prefix, keep as-is
    } else if (!VALID_TRATAMIENTOS.has(tratamientoRaw)) {
      // Try adding prefix
      const withPrefix = `tratamiento_${tratamientoRaw}`;
      if (VALID_TRATAMIENTOS.has(withPrefix)) {
        tratamientoRaw = withPrefix;
      } else {
        tratamientoRaw = 'sin_tratamiento';
      }
    }

    // ── Validate confianza_clasificacion ───────────────────────
    const confianzaRaw = String(
      parsed.confianza_clasificacion || parsed.confianzaClasificacion || 'media',
    )
      .toLowerCase()
      .trim();
    const confianzaValida = ['alta', 'media', 'baja'].includes(confianzaRaw) ? confianzaRaw : 'media';

    // ── Validate ejes temáticos ────────────────────────────────
    const ejesRaw = Array.isArray(parsed.ejesTematicos)
      ? parsed.ejesTematicos
      : Array.isArray(parsed.ejes)
        ? parsed.ejes
        : Array.isArray(parsed.temas)
          ? parsed.temas
          : [];

    // Validar ejes contra la DB (slug → id) con fallback a slugs hardcodeados
    const slugMap = await getEjesSlugMap();
    const dbSlugs = new Set(slugMap.keys());

    const ejesValidados = ejesRaw
      .map((s: string) => String(s).toLowerCase().trim())
      .filter((s: string) => dbSlugs.has(s) || VALID_SLUGS.has(s))
      .slice(0, 3);

    // ── Extract preguntas_fundamentales ────────────────────────
    const pfRaw = parsed.preguntas_fundamentales || parsed.preguntasFundamentales || null;
    const preguntasFundamentales: Record<string, unknown> | null =
      pfRaw && typeof pfRaw === 'object' && !Array.isArray(pfRaw) ? (pfRaw as Record<string, unknown>) : null;

    // ── Intención del medio (FASE 4D) ──────────────────────────
    const VALID_INTENCIONES = ['informativa', 'opinion', 'critica', 'elogiosa', 'reactiva', 'sin_intencion'];
    const intencionRaw = String(parsed.intencion_medio || '').toLowerCase().trim();
    const intencionMedio = VALID_INTENCIONES.includes(intencionRaw) ? intencionRaw : 'sin_intencion';

    // ── Check prohibited terminology ───────────────────────────
    if (terminologiaProhibida) {
      const foundTerms = checkProhibitedTerms(fullText, terminologiaProhibida);
      if (foundTerms.length > 0) {
        console.warn(
          `[MC] ⚠ Términos prohibidos detectados en mención "${titulo.substring(0, 60)}...": ${foundTerms.join(', ')}`,
        );
      }
    }

    return {
      tipoMencion: parsed.tipoMencion || 'contexto',
      sentimiento: tratamientoToSentimiento(tratamientoRaw),
      tratamientoPeriodistico: tratamientoRaw,
      intencionMedio,
      confianzaClasificacion: confianzaValida,
      ejesTematicos: ejesValidados,
      preguntasFundamentales,
    };
  } catch (err) {
    console.error('[analyze] Error in analyzeMencion:', err instanceof Error ? err.message : String(err));
    return defaultResult;
  }
}

// ─── Actualizar mención en DB con resultado del análisis ──────

export async function applyAnalysisToMencion(mencionId: string, result: AnalyzeResult): Promise<void> {
  // Obtener mapa dinámico slug → id desde la DB
  const slugMap = await getEjesSlugMap();

  // Resolver slugs a IDs de ejes
  const ejeIdsRelacionar: string[] = [];
  for (const slug of result.ejesTematicos) {
    const ejeId = slugMap.get(slug.toLowerCase().trim());
    if (ejeId) {
      ejeIdsRelacionar.push(ejeId);
    }
  }

  await db.mencion.update({
    where: { id: mencionId },
    data: {
      tipoMencion: result.tipoMencion,
      sentimiento: result.sentimiento,
      tratamientoPeriodistico: result.tratamientoPeriodistico,
      intencionMedio: result.intencionMedio,
      confianzaClasificacion: result.confianzaClasificacion,
      preguntasFundamentales: result.preguntasFundamentales
        ? (result.preguntasFundamentales as Prisma.InputJsonValue)
        : Prisma.JsonNull,
      temas: result.ejesTematicos.join(', '),
      // FIX: Asignar el primer eje como ejeEstructuralId para la relación directa
      ejeEstructuralId: ejeIdsRelacionar.length > 0 ? ejeIdsRelacionar[0] : null,
    },
  });

  // Crear relaciones con ejes temáticos via tabla intermedia MencionTema
  if (ejeIdsRelacionar.length > 0) {
    await db.mencionTema.deleteMany({ where: { mencionId } });
    for (const ejeId of ejeIdsRelacionar) {
      try {
        await db.mencionTema.create({
          data: { mencionId, ejeTematicoId: ejeId },
        });
      } catch {
        // Duplicado, ignorar
      }
    }
  }
}
