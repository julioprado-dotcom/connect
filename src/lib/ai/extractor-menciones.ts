// Extraer menciones de legisladores Y temas relevantes de texto de noticias usando LLM
// DECODEX Bolivia — Pipeline A (scrape-fuente)
// FASE 4: Integración del Marco Conceptual (MC) del sistema de IA
// FASE 4D: Intención del Medio + Ejes por Cliente

import db from '@/lib/db';
import ZAI from 'z-ai-web-dev-sdk';
import { deduplicarMencion, actualizarCoberturaDuplicado } from '@/lib/deduplicacion';

// ─── Interfaces ──────────────────────────────────────────────────

interface LegisladorMencionado {
  persona_id: string;
  cita: string;
  contexto: string;
}

interface EjeMencionado {
  eje_id: string;
  cita: string;
  relevancia: 'alta' | 'media' | 'baja';
}

interface EjeClienteMencionado {
  eje_cliente_id: number;
  cita: string;
  relevancia: 'alta' | 'media' | 'baja';
}

export interface ExtractionResult {
  es_relevante: boolean;
  tratamientoPeriodistico: string;
  intencionMedio: string;
  confianzaClasificacion: string;
  resumen: string;
  legisladores_mencionados: LegisladorMencionado[];
  ejes_mencionados: EjeMencionado[];
  ejes_cliente: EjeClienteMencionado[];
  temas_detectados: string[];
  preguntas_fundamentales: Record<string, unknown>;
  sentimiento_general: string; // backward compatibility
}

// ─── Default Treatment Scale ──────────────────────────────────

const DEFAULT_ESCALA = [
  { codigo: 'tratamiento_informativo', nombre: 'Informativo' },
  { codigo: 'tratamiento_analitico', nombre: 'Analítico' },
  { codigo: 'tratamiento_critico', nombre: 'Crítico' },
  { codigo: 'tratamiento_editorial', nombre: 'Editorializante' },
  { codigo: 'tratamiento_agresivo', nombre: 'Agresivo' },
  { codigo: 'tratamiento_elogioso', nombre: 'Elogioso' },
  { codigo: 'tratamiento_ambiguo', nombre: 'Ambiguo' },
  // tratamiento_agregado es SOLO un valor INTERNO del sistema (asignado por deduplicación).
  // No se expone al LLM porque el LLM jamás debe generar este valor.
  { codigo: 'sin_tratamiento', nombre: 'Sin clasificar' },
];

// ─── Default Intención del Medio ───────────────────────────────

const DEFAULT_INTENCION = [
  { codigo: 'informativa', nombre: 'Informativa', definicion: 'El medio busca informar sobre un hecho o evento, sin tomar posición ni buscar generar opinión.' },
  { codigo: 'opinion', nombre: 'Opinión', definicion: 'El medio publica una posición editorial, columna de opinión o análisis valorativo.' },
  { codigo: 'critica', nombre: 'Crítica', definicion: 'El medio busca cuestionar, denunciar o generar descrédito hacia un actor o situación.' },
  { codigo: 'elogiosa', nombre: 'Elogiosa', definicion: 'El medio busca resaltar positivamente, promocionar o legitimar a un actor o acción.' },
  { codigo: 'reactiva', nombre: 'Reactiva', definicion: 'El medio responde a una declaración, acusación o publicación previa de otro medio o actor.' },
  { codigo: 'sin_intencion', nombre: 'Sin intención identificable', definicion: 'No se puede determinar la intención del medio o el texto es insuficiente.' },
];

const VALID_INTENCIONES = new Set(DEFAULT_INTENCION.map(i => i.codigo));

// ─── In-memory cache for master data (TTL 60s) ──────────────

let cacheMarcoConceptual: { data: MarcoData | null; expiry: number } | null = null;
let cachePersonas: { data: any[]; expiry: number } | null = null;
let cacheEjes: { data: any[]; expiry: number } | null = null;
let cacheTemasRecientes: { data: any[]; expiry: number } | null = null;
let cacheIndicadores: { data: any[]; expiry: number } | null = null;
const CACHE_TTL = 60000; // 60 seconds

async function getMarcoConceptualCached(): Promise<MarcoData | null> {
  if (cacheMarcoConceptual && cacheMarcoConceptual.expiry > Date.now()) {
    return cacheMarcoConceptual.data;
  }
  const data = await db.marcoConceptual.findFirst({ where: { activa: true } });
  cacheMarcoConceptual = { data, expiry: Date.now() + CACHE_TTL };
  return data;
}

async function getPersonasCached(): Promise<any[]> {
  if (cachePersonas && cachePersonas.expiry > Date.now()) {
    return cachePersonas.data;
  }
  const data = await db.persona.findMany({
    where: { activa: true },
    select: { id: true, nombre: true, partidoSigla: true, camara: true },
  });
  cachePersonas = { data, expiry: Date.now() + CACHE_TTL };
  return data;
}

async function getEjesCached(): Promise<any[]> {
  if (cacheEjes && cacheEjes.expiry > Date.now()) {
    return cacheEjes.data;
  }
  const data = await db.ejeTematico.findMany({
    where: { activo: true },
    select: { id: true, nombre: true, slug: true, keywords: true },
  });
  cacheEjes = { data, expiry: Date.now() + CACHE_TTL };
  return data;
}

async function getTemasRecientesCached(): Promise<any[]> {
  if (cacheTemasRecientes && cacheTemasRecientes.expiry > Date.now()) {
    return cacheTemasRecientes.data;
  }
  const treintaDiasAtras = new Date();
  treintaDiasAtras.setDate(treintaDiasAtras.getDate() - 30);
  const data = await db.mencionTema.findMany({
    where: { mencion: { fechaCaptura: { gte: treintaDiasAtras } } },
    include: { ejeTematico: { select: { nombre: true, keywords: true } } },
    distinct: ['ejeTematicoId'],
  });
  cacheTemasRecientes = { data, expiry: Date.now() + CACHE_TTL };
  return data;
}

async function getIndicadoresCached(): Promise<any[]> {
  if (cacheIndicadores && cacheIndicadores.expiry > Date.now()) {
    return cacheIndicadores.data;
  }
  // Obtener últimos valores de indicadores activos (uno por indicador, el más reciente)
  const indicadores = await db.indicador.findMany({
    where: { activo: true },
    select: {
      id: true,
      nombre: true,
      slug: true,
      categoria: true,
      unidad: true,
      formatoNumero: true,
      valores: {
        orderBy: { fecha: 'desc' },
        take: 1,
        select: { valor: true, valorTexto: true, fecha: true, confiable: true },
      },
    },
  });
  cacheIndicadores = { data: indicadores, expiry: Date.now() + CACHE_TTL };
  return indicadores;
}

// ─── Default Fundamental Questions ────────────────────────────

const DEFAULT_PREGUNTAS = [
  { codigo: 'que', nombre: '¿Qué pasó?', descripcion: 'Evento principal' },
  { codigo: 'quien', nombre: '¿Quién?', descripcion: 'Actores involucrados' },
  { codigo: 'cuando', nombre: '¿Cuándo?', descripcion: 'Temporalidad' },
  { codigo: 'como', nombre: '¿Cómo?', descripcion: 'Mecanismo / modalidad' },
  { codigo: 'por_que', nombre: '¿Por qué?', descripcion: 'Causas (no intenciones)' },
  { codigo: 'para_que', nombre: '¿Para qué?', descripcion: 'Intenciones declaradas o inferidas' },
  { codigo: 'a_quienes_afecta', nombre: '¿A quiénes afecta?', descripcion: 'Grupos impactados' },
  { codigo: 'donde', nombre: '¿Dónde?', descripcion: 'Lugar / ámbito geográfico' },
];

// ─── Default Principles ───────────────────────────────────────

const DEFAULT_PRINCIPIOS = [
  { codigo: 'fiel_al_origen', nombre: 'Fidelidad al texto fuente', reglas_operativas: 'Nunca mejorar, suavizar ni reinterpretar el tono original' },
  { codigo: 'no_inventar', nombre: 'Cero invención', reglas_operativas: 'Si el texto no responde una pregunta, devolver null' },
  { codigo: 'tratamiento_no_sentimiento', nombre: 'Tratamiento periodístico (NO sentimiento)', reglas_operativas: 'Usar la escala de tratamiento, nunca la palabra sentimiento' },
  { codigo: 'clasificacion_fiel', nombre: 'Clasificación fiel', reglas_operativas: 'Si el texto es 100% crítico, clasificar como 100% crítico. No inventar balance' },
  { codigo: 'terminologia_controlada', nombre: 'Terminología controlada', reglas_operativas: 'Usar solo términos permitidos. Nunca usar términos prohibidos' },
  { codigo: 'ironia_editorial', nombre: 'Ironía/sarcasmo → editorial', reglas_operativas: 'Detectar ironía o sarcasmo y clasificar como tratamiento_editorial' },
  { codigo: 'resumen_fiel', nombre: 'Resumen fiel', reglas_operativas: 'Máximo 200 palabras, reflejar calidad y tono ORIGINAL' },
  { codigo: 'separar_causa_intencion', nombre: 'Separar causa de intención', reglas_operativas: '"por qué" = causa, "para qué" = intención. Son preguntas distintas' },
  { codigo: 'contexto_boliviano', nombre: 'Contexto boliviano', reglas_operativas: 'Aplicar conocimiento del contexto político e institucional de Bolivia' },
];

// ─── Helpers ──────────────────────────────────────────────────

type MarcoData = NonNullable<Awaited<ReturnType<typeof db.marcoConceptual.findFirst>>>;

function safeJson<T>(field: unknown, fallback: T): T {
  if (field === null || field === undefined) return fallback;
  try {
    if (typeof field === 'string') {
      const parsed = JSON.parse(field);
      // Si esperamos un array pero no lo es, usar fallback
      if (Array.isArray(fallback) && !Array.isArray(parsed)) return fallback;
      return parsed as T;
    }
    // Prisma puede devolver JSON como objeto ya parseado
    if (typeof field === 'object') {
      // Si esperamos un array pero field no lo es, usar fallback
      if (Array.isArray(fallback) && !Array.isArray(field)) return fallback;
      return field as T;
    }
    return fallback;
  } catch {
    return fallback;
  }
}

/**
 * Build the system prompt dynamically from the Marco Conceptual.
 * FASE 4D: Added INTENCIÓN DEL MEDIO section.
 */
function buildSystemPrompt(marco: MarcoData | null): string {
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
  if (marco) {
    const cr = safeJson<string[] | { criterio: string }[]>(marco.criteriosRelevancia, []);
    if (Array.isArray(cr)) {
      criteriosRelevancia = cr.map(c => typeof c === 'string' ? c : c.criterio || '').filter(Boolean);
    }
  }
  if (criteriosRelevancia.length === 0) {
    criteriosRelevancia = [
      'Menciona al menos un legislador monitoreado',
      'Se refiere a al menos un eje temático monitoreado',
      'Contiene al menos una keyword de interés',
    ];
  }

  const criteriosSection = criteriosRelevancia.map(c => `- ${c}`).join('\n');

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

## PRINCIPIOS FUNDANTES (INMUTABLES)

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
function tratamientoToSentimiento(tratamiento: string): string {
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
function tratamientoToTipoMencion(tratamiento: string, tieneCitaDirecta: boolean): string {
  if (!tieneCitaDirecta) return 'mencion_pasiva';
  if (tratamiento === 'tratamiento_critico' || tratamiento === 'tratamiento_agresivo') return 'mencion_critica';
  if (tratamiento === 'tratamiento_elogioso') return 'mencion_activa';
  return 'mencion_directa';
}

// ─── Main extraction function ─────────────────────────────────

/**
 * Extraer menciones (legisladores + ejes temáticos) de un texto usando LLM.
 * Integración con el Marco Conceptual del sistema de IA.
 * FASE 4D: Añadido soporte para clientId (ejes personalizados) e intencionMedio.
 * Tolerancia a fallos: si el LLM falla, devuelve resultado vacío.
 */
export interface ExtractorOptions {
  clientId?: string;
}

export async function extraerMencionesDeTexto(
  texto: string,
  medioId: string,
  options?: ExtractorOptions,
): Promise<ExtractionResult> {
  const emptyResult: ExtractionResult = {
    es_relevante: false,
    tratamientoPeriodistico: 'sin_tratamiento',
    intencionMedio: 'sin_intencion',
    confianzaClasificacion: 'baja',
    resumen: '',
    legisladores_mencionados: [],
    ejes_mencionados: [],
    ejes_cliente: [],
    temas_detectados: [],
    preguntas_fundamentales: {},
    sentimiento_general: 'no_clasificado',
  };

  try {
    // 1. Load Marco Conceptual (cached)
    let marco: MarcoData | null = null;
    try {
      marco = await getMarcoConceptualCached();
    } catch {
      console.warn('[extractor-menciones] Error cargando marco conceptual, usando valores default');
    }

    if (!marco) {
      console.warn('[extractor-menciones] Marco conceptual no inicializado, usando valores default');
    }

    // 2. Build system prompt from marco
    const systemPrompt = buildSystemPrompt(marco);

    // 3. Cargar datos de contexto desde la DB en paralelo (cached)
    const dbQueries: Promise<unknown>[] = [
      getPersonasCached(),
      getEjesCached(),
      getTemasRecientesCached(),
      getIndicadoresCached(),
    ];

    // Load client-specific ejes if clientId is provided (FASE 4D)
    let ejesCliente: Array<{ id: number; nombre: string; keywords: string }> = [];
    if (options?.clientId) {
      dbQueries.push(
        db.ejeTematicoCliente.findMany({
          where: { clienteId: options.clientId, activo: true },
          select: { id: true, nombre: true, keywords: true },
        }).then(result => { ejesCliente = result; }),
      );
    }

    const [personas, ejes, temasRecientes, indicadores] = await Promise.all(dbQueries) as [any[], any[], any[], any[]];

    if (personas.length === 0 && ejes.length === 0) return emptyResult;

    // 4. Construir sección de legisladores
    const listaLegisladores = personas.length > 0
      ? personas
          .map(p => `- ID: ${p.id} | ${p.nombre} (${p.partidoSigla || 'Sin partido'}, ${p.camara || 'Sin cámara'})`)
          .join('\n')
      : '(Sin legisladores registrados)';

    // 5. Construir sección de ejes temáticos con keywords
    const listaEjes = ejes.length > 0
      ? ejes
          .map(e => `- ID: ${e.id} | ${e.nombre} (keywords: ${e.keywords || 'sin keywords'})`)
          .join('\n')
      : '(Sin ejes temáticos registrados)';

    // 6. Construir lista combinada de keywords de interés
    const todasKeywords = new Set<string>();
    for (const eje of ejes) {
      if (eje.keywords && typeof eje.keywords === 'string') {
        for (const kw of eje.keywords.split(',').map((k: string) => k.trim().toLowerCase()).filter(Boolean)) {
          todasKeywords.add(kw);
        }
      }
    }
    // Agregar keywords de temas recientes para detección de tendencias
    for (const tm of temasRecientes) {
      if (tm.ejeTematico?.keywords && typeof tm.ejeTematico.keywords === 'string') {
        for (const kw of tm.ejeTematico.keywords.split(',').map((k: string) => k.trim().toLowerCase()).filter(Boolean)) {
          todasKeywords.add(kw);
        }
      }
    }
    const listaKeywords = todasKeywords.size > 0
      ? Array.from(todasKeywords).slice(0, 100).join(', ')
      : '';

    // 6b. Build client ejes section for prompt (if any)
    let ejesClienteSection = '';
    if (ejesCliente.length > 0) {
      ejesClienteSection = `\nEJES TEMÁTICOS DEL CLIENTE (clasifica solo si el texto coincide claramente):\n${ejesCliente.map(e => `- CLIENTE_EJE_ID: ${e.id} | ${e.nombre} (keywords: ${e.keywords})`).join('\n')}\n`;
    }

    // 6c. Build indicadores actuales section (insumos para productos + contexto)
    // Los indicadores NO se extraen con IA (Pipeline A es 100% regex), pero sus valores
    // cumplen una doble función: (1) contexto de referencia para clasificar notas económicas
    // y (2) insumos para generación de productos (boletines, reportes, alertas).
    // El LLM debe usar estos valores para enriquecer clasificaciones temáticas y detectar
    // si la noticia contiene datos que actualicen o contradigan estos indicadores.
    let indicadoresSection = '';
    const indicadoresConValor = indicadores.filter(ind =>
      ind.valores && ind.valores.length > 0 && ind.valores[0].confiable
    );
    if (indicadoresConValor.length > 0) {
      const fechaMasReciente = indicadoresConValor
        .reduce((max, ind) => {
          const f = new Date(ind.valores[0].fecha);
          return f > max ? f : max;
        }, new Date(0));
      indicadoresSection = `\nINDICADORES ACTUALES (doble uso: contexto de clasificación + insumos para productos como boletines y reportes):\n`;
      indicadoresSection += `(Última actualización: ${fechaMasReciente.toISOString().split('T')[0]})\n`;
      indicadoresSection += `Estos valores son referencia real para tu análisis. Si la noticia menciona datos que contradigan\n`;
      indicadoresSection += `o actualicen algún indicador, destácalo en el resumen — esa información alimenta productos del sistema.\n\n`;
      for (const ind of indicadoresConValor) {
        const v = ind.valores[0];
        const valorFormateado = v.valorTexto || v.valor.toFixed(ind.formatoNumero || 2);
        indicadoresSection += `- ${ind.nombre}: ${valorFormateado} ${ind.unidad}\n`;
      }
      indicadoresSection += '\n';
    }

    // 7. Truncar texto si es muy largo (max ~4000 chars para el LLM)
    const textoTruncado = texto.length > 4000
      ? texto.substring(0, 4000) + '...'
      : texto;

    // 8. Construir prompt del usuario
    let userContent = `LEGISLADORES MONITOREADOS:\n${listaLegisladores}\n\n`;
    userContent += `EJES TEMÁTICOS:\n${listaEjes}\n\n`;
    userContent += ejesClienteSection;
    if (listaKeywords) {
      userContent += `KEYWORDS DE INTERÉS: ${listaKeywords}\n\n`;
    }
    userContent += indicadoresSection;
    userContent += `TEXTO DE LA NOTICIA:\n${textoTruncado}`;

    // 9. Llamada al LLM
    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      temperature: 0.1,
      signal: AbortSignal.timeout(60000), // 60s timeout
    });

    const raw = (completion?.choices?.[0]?.message?.content || '').trim();
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return emptyResult;

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch (parseErr) {
      console.warn('[extractor-menciones] JSON parse falló, primerosp 500 chars:', raw.substring(0, 500));
      return emptyResult;
    }

    if (!parsed || typeof parsed !== 'object') {
      console.warn('[extractor-menciones] LLM no devolvió objeto válido');
      return emptyResult;
    }

    // Garantizar que todos los campos array sean realmente arrays
    function ensureArray(val: unknown): any[] {
      if (Array.isArray(val)) return val;
      if (val && typeof val === 'object' && 'length' in val) return Array.from(val as ArrayLike<unknown>);
      return [];
    }

    // 10. Validar y normalizar resultado
    const validPersonIds = new Set(personas.map(p => p.id));
    const validEjeIds = new Set(ejes.map(e => e.id));
    const validEjeClienteIds = new Set(ejesCliente.map(e => e.id));
    const relevanciasValidas = new Set(['alta', 'media', 'baja']);
    const tratamientosValidos = new Set(DEFAULT_ESCALA.map(e => e.codigo));
    const confianzasValidas = new Set(['alta', 'media', 'baja']);

    // Legisladores (key in LLM output: legisladores_mencionados)
    const legisladores = ensureArray(parsed.legisladores_mencionados)
          .filter((m: Record<string, unknown>) =>
            m.persona_id && validPersonIds.has(m.persona_id as string) && m.cita
          )
          .slice(0, 5)
          .map((m: { persona_id: string; cita: string; contexto?: string }) => ({
            persona_id: m.persona_id,
            cita: String(m.cita),
            contexto: String(m.contexto || ''),
          }));

    // Ejes (LLM returns "ejes_institucionales", we map to ejes_mencionados)
    const ejesRaw = parsed.ejes_institucionales || parsed.ejes_mencionados;
    const ejesMencionados = ensureArray(ejesRaw)
          .filter((e: Record<string, unknown>) =>
            e.eje_id && validEjeIds.has(e.eje_id as string) && e.cita
          )
          .slice(0, 3)
          .map((e: { eje_id: string; cita: string; relevancia?: string }) => ({
            eje_id: e.eje_id,
            cita: String(e.cita),
            relevancia: relevanciasValidas.has(String(e.relevancia || ''))
              ? String(e.relevancia) as 'alta' | 'media' | 'baja'
              : 'media' as const,
          }));

    // Ejes del cliente (LLM returns "ejes_cliente") — FASE 4D
    const ejesClienteParsed = ensureArray(parsed.ejes_cliente)
          .filter((e: Record<string, unknown>) =>
            e.eje_cliente_id && validEjeClienteIds.has(Number(e.eje_cliente_id)) && e.cita
          )
          .slice(0, 3)
          .map((e: { eje_cliente_id: number; cita: string; relevancia?: string }) => ({
            eje_cliente_id: Number(e.eje_cliente_id),
            cita: String(e.cita),
            relevancia: relevanciasValidas.has(String(e.relevancia || ''))
              ? String(e.relevancia) as 'alta' | 'media' | 'baja'
              : 'media' as const,
          }));

    // Temas
    const temas = ensureArray(parsed.temas_detectados)
          .map((t: string) => String(t).trim().toLowerCase())
          .filter(Boolean)
          .slice(0, 5);

    // Tratamiento periodístico
    const tratamiento = tratamientosValidos.has(String(parsed.tratamiento_periodistico || ''))
      ? String(parsed.tratamiento_periodistico)
      : 'sin_tratamiento';

    // Intención del medio — FASE 4D
    const intencionRaw = String(parsed.intencion_medio || '').toLowerCase().trim();
    const intencionMedio = VALID_INTENCIONES.has(intencionRaw) ? intencionRaw : 'sin_intencion';

    // Confianza clasificación
    const confianza = confianzasValidas.has(String(parsed.confianza_clasificacion || ''))
      ? String(parsed.confianza_clasificacion)
      : 'baja';

    // Preguntas fundamentales
    const preguntas_fundamentales = parsed.preguntas_fundamentales && typeof parsed.preguntas_fundamentales === 'object'
      ? parsed.preguntas_fundamentales as Record<string, unknown>
      : {};

    // Backward-compatible sentimiento
    const sentimiento = tratamientoToSentimiento(tratamiento);

    return {
      es_relevante: parsed.es_relevante === true || legisladores.length > 0 || ejesMencionados.length > 0,
      tratamientoPeriodistico: tratamiento,
      intencionMedio,
      confianzaClasificacion: confianza,
      resumen: String(parsed.resumen || '').substring(0, 200),
      legisladores_mencionados: legisladores,
      ejes_mencionados: ejesMencionados,
      ejes_cliente: ejesClienteParsed,
      temas_detectados: temas,
      preguntas_fundamentales,
      sentimiento_general: sentimiento,
    };
  } catch (err) {
    console.warn('[extractor-menciones] Error en extracción LLM:', err);
    return emptyResult;
  }
}

// ─── Extraer texto de HTML (UNCHANGED) ────────────────────────

/**
 * Extraer texto relevante de un HTML.
 * Busca selectores comunes de contenido de artículos.
 */
export function extraerTextoDeHtml(html: string): string {
  // Remover scripts y styles
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '');

  // Intentar extraer de selectores prioritarios
  const selectores = [
    /<article[^>]*>([\s\S]*?)<\/article>/gi,
    /<main[^>]*>([\s\S]*?)<\/main>/gi,
    /<div[^>]*class="[^"]*(?:content|article|post|entry|story|body-text)[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
  ];

  for (const regex of selectores) {
    const match = regex.exec(text);
    if (match && match[1].length > 200) {
      text = match[1];
      break;
    }
  }

  // Limpiar tags HTML y normalizar espacios
  return text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#\d+;/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

// ─── Crear menciones en DB ─────────────────────────────────────

/**
 * Crear menciones en la DB a partir del resultado de extracción.
 *
 * Lógica:
 * - Si hay legisladores: crear Mencion con personaId por cada uno, vincular ejes via MencionTema
 * - Si NO hay legisladores PERO hay ejes: crear Mencion sin personaId (referencia_tematica)
 *
 * FASE 4: tratamientoPeriodistico, confianzaClasificacion, preguntasFundamentales
 * FASE 4D: intencionMedio, ejes_cliente (MencionClienteEje)
 */
export async function crearMencionesExtraidas(
  resultado: ExtractionResult,
  medioId: string,
  url: string,
  titulo: string,
): Promise<number> {
  if (!resultado.es_relevante) return 0;

  let creadas = 0;
  const ejeIds = resultado.ejes_mencionados.map(e => e.eje_id);

  // Shared data fields for all menciones
  const sharedData = {
    tratamientoPeriodistico: resultado.tratamientoPeriodistico,
    intencionMedio: resultado.intencionMedio,
    confianzaClasificacion: resultado.confianzaClasificacion,
    preguntasFundamentales: resultado.preguntas_fundamentales as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    sentimiento: resultado.sentimiento_general, // backward-compatible sentiment from tratamiento
    temas: resultado.temas_detectados.join(', '),
  };

  // 1. Crear menciones por legislador (si hay)
  for (const leg of resultado.legisladores_mencionados) {
    try {
      // Verificar que no existe ya una mencion con misma persona, medio y URL
      const existente = await db.mencion.findFirst({
        where: { personaId: leg.persona_id, medioId, url },
      });
      if (existente) {
        creadas++;
        continue;
      }

      // DEDUPLICACION CROSS-MEDIO (FASE 4C)
      let dedupResult: Awaited<ReturnType<typeof deduplicarMencion>> | null = null;
      try {
        dedupResult = await deduplicarMencion({
          personaId: leg.persona_id,
          ejesTematicos: ejeIds,
          resumen: resultado.resumen,
          fecha: new Date(),
          medioId,
          textoOriginal: leg.contexto || leg.cita,
        });
      } catch (dedupError) {
        console.error('[DEDUP-ERROR] Deduplicacion fallo, creando como original:', dedupError instanceof Error ? dedupError.message : dedupError);
        // NO continue — la mención se crea como original (sin deduplicar) pero NO se pierde
      }

      if (dedupResult && dedupResult.decision === 'es_duplicado' && dedupResult.mencionOriginalId) {
        const medioObj = await db.medio.findUnique({ where: { id: medioId }, select: { nombre: true } });
        await actualizarCoberturaDuplicado(dedupResult.mencionOriginalId, {
          medioId,
          medioNombre: medioObj?.nombre || 'Desconocido',
          resumen: resultado.resumen,
          fecha: new Date(),
          tratamientoPeriodistico: resultado.tratamientoPeriodistico,
        });
        console.log(`[DEDUP] Mencion deduplicada: medio ${medioObj?.nombre || medioId} → original #${dedupResult.mencionOriginalId}`);
        creadas++;
        continue;
      }

      // Build dedup log
      const dedupLog = JSON.stringify({
        decision: dedupResult?.decision || 'crear_original',
        razon: dedupResult?.razon || 'dedup_fallo',
        timestamp: new Date().toISOString(),
        ...(dedupResult?.mencionOriginalId ? { candidatoId: dedupResult.mencionOriginalId } : {}),
      });

      const mencion = await db.mencion.create({
        data: {
          personaId: leg.persona_id,
          medioId,
          titulo,
          texto: leg.cita,
          textoCompleto: leg.contexto,
          url,
          tipoMencion: tratamientoToTipoMencion(resultado.tratamientoPeriodistico, Boolean(leg.cita)),
          verificado: false,
          ...(dedupResult?.eventoId ? { eventoId: dedupResult.eventoId } : {}),
          deduplicacionLog: dedupLog,
          ...sharedData,
        },
      });

      // Vincular ejes temáticos via MencionTema
      for (const ejeId of ejeIds) {
        try {
          await db.mencionTema.create({
            data: { mencionId: mencion.id, ejeTematicoId: ejeId },
          });
        } catch {
          // Duplicado o error, ignorar
        }
      }

      // Vincular ejes del cliente via MencionClienteEje (FASE 4D)
      for (const ejeCli of resultado.ejes_cliente) {
        try {
          await db.mencionClienteEje.create({
            data: {
              mencionId: mencion.id,
              ejeClienteId: ejeCli.eje_cliente_id,
              confianza: ejeCli.relevancia === 'alta' ? 0.9 : ejeCli.relevancia === 'media' ? 0.7 : 0.5,
            },
          });
        } catch {
          // Duplicado o error, ignorar
        }
      }

      creadas++;
    } catch {
      // Tolerancia a fallos: continuar con la siguiente
    }
  }

  // 2. Si NO hay legisladores PERO hay ejes temáticos: crear mencion temática
  if (resultado.legisladores_mencionados.length === 0 && resultado.ejes_mencionados.length > 0) {
    try {
      // Verificar si ya existe una mencion tematica para esta URL
      const existente = await db.mencion.findFirst({
        where: { medioId, url, personaId: null },
      });
      if (!existente) {
        const mencion = await db.mencion.create({
          data: {
            personaId: null,
            medioId,
            titulo,
            texto: resultado.resumen || resultado.ejes_mencionados[0]?.cita || '',
            textoCompleto: resultado.resumen || '',
            url,
            tipoMencion: 'referencia_tematica',
            verificado: false,
            ...sharedData,
          },
        });

        // Vincular ejes temáticos via MencionTema
        for (const ejeId of ejeIds) {
          try {
            await db.mencionTema.create({
              data: { mencionId: mencion.id, ejeTematicoId: ejeId },
            });
          } catch {
            // Duplicado o error, ignorar
          }
        }

        // Vincular ejes del cliente (FASE 4D)
        for (const ejeCli of resultado.ejes_cliente) {
          try {
            await db.mencionClienteEje.create({
              data: {
                mencionId: mencion.id,
                ejeClienteId: ejeCli.eje_cliente_id,
                confianza: ejeCli.relevancia === 'alta' ? 0.9 : ejeCli.relevancia === 'media' ? 0.7 : 0.5,
              },
            });
          } catch {
            // Duplicado o error, ignorar
          }
        }

        creadas++;
      }
    } catch {
      // Tolerancia a fallos
    }
  }

  return creadas;
}
