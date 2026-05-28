// Extraer menciones de legisladores Y temas relevantes de texto de noticias usando LLM
// DECODEX Bolivia — Pipeline A (scrape-fuente)
// Configuration constants extracted from extractor-menciones.ts

// ─── Default Treatment Scale ──────────────────────────────────

export const DEFAULT_ESCALA = [
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

export const DEFAULT_INTENCION = [
  { codigo: 'informativa', nombre: 'Informativa', definicion: 'El medio busca informar sobre un hecho o evento, sin tomar posición ni buscar generar opinión.' },
  { codigo: 'opinion', nombre: 'Opinión', definicion: 'El medio publica una posición editorial, columna de opinión o análisis valorativo.' },
  { codigo: 'critica', nombre: 'Crítica', definicion: 'El medio busca cuestionar, denunciar o generar descrédito hacia un actor o situación.' },
  { codigo: 'elogiosa', nombre: 'Elogiosa', definicion: 'El medio busca resaltar positivamente, promocionar o legitimar a un actor o acción.' },
  { codigo: 'reactiva', nombre: 'Reactiva', definicion: 'El medio responde a una declaración, acusación o publicación previa de otro medio o actor.' },
  { codigo: 'sin_intencion', nombre: 'Sin intención identificable', definicion: 'No se puede determinar la intención del medio o el texto es insuficiente.' },
];

export const VALID_INTENCIONES = new Set(DEFAULT_INTENCION.map(i => i.codigo));

// ─── Default Fundamental Questions ────────────────────────────

export const DEFAULT_PREGUNTAS = [
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

export const DEFAULT_PRINCIPIOS = [
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
