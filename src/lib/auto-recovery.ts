// Auto-recovery post-caída — DECODEX Bolivia
// Detecta DB vacía o degradada y ejecuta seed automático.
// Se ejecuta desde instrumentation.ts en el arranque del servidor.
// Solución integral: no parches — recovery completo en un solo punto.

import db from '@/lib/db'
import { readFileSync, copyFileSync, existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'fs'
import { join } from 'path'

// ── Configuración ──────────────────────────────────────────────────────

// Umbrales mínimos para considerar la DB "sana"
const SALUD_THRESHOLDS = {
  personas: 50,      // Al menos 50 personas (senadores + diputados)
  medios: 10,        // Al menos 10 medios configurados
  fuentes: 5,        // Al menos 5 fuentes monitoreadas
  ejes: 5,           // Al menos 5 ejes temáticos
} as const

// Frecuencia base por nivel (del motor de captura)
const FRECUENCIA_POR_NIVEL: Record<string, string> = {
  '1': '1h',
  '2': '4h',
  '3': '6h',
}

// Tipo de check por categoría de medio
function tipoCheckParaCategoria(tipo: string): string {
  if (tipo.includes('TV') || tipo.includes('Radio')) return 'rss'
  if (tipo === 'Agencia' || tipo === 'Agencia estatal') return 'rss'
  if (tipo === 'Fact-checking' || tipo === 'Portal') return 'head'
  return 'head'
}

// ── Diagnóstico ────────────────────────────────────────────────────────

interface DBDiagnosis {
  sana: boolean
  problemas: string[]
  conteos: {
    personas: number
    medios: number
    fuentes: number
    ejes: number
    indicadores: number
    marcoConceptual: boolean
  }
}

/**
 * Diagnostica el estado de la DB comparando contra umbrales mínimos.
 * Retorna un diagnóstico con los problemas detectados.
 */
export async function diagnosticarDB(): Promise<DBDiagnosis> {
  const [personas, medios, fuentes, ejes, indicadores, mcActivos] = await Promise.all([
    db.persona.count(),
    db.medio.count(),
    db.fuenteEstado.count(),
    db.ejeTematico.count(),
    db.indicador.count(),
    db.marcoConceptual.count({ where: { activa: true } }),
  ])

  const problemas: string[] = []

  if (personas < SALUD_THRESHOLDS.personas) {
    problemas.push(`Personas insuficientes: ${personas}/${SALUD_THRESHOLDS.personas}`)
  }
  if (medios < SALUD_THRESHOLDS.medios) {
    problemas.push(`Medios insuficientes: ${medios}/${SALUD_THRESHOLDS.medios}`)
  }
  if (fuentes < SALUD_THRESHOLDS.fuentes) {
    problemas.push(`Fuentes insuficientes: ${fuentes}/${SALUD_THRESHOLDS.fuentes}`)
  }
  if (ejes < SALUD_THRESHOLDS.ejes) {
    problemas.push(`Ejes insuficientes: ${ejes}/${SALUD_THRESHOLDS.ejes}`)
  }
  if (mcActivos === 0) {
    problemas.push('Marco Conceptual no configurado')
  }

  return {
    sana: problemas.length === 0,
    problemas,
    conteos: { personas, medios, fuentes, ejes, indicadores, marcoConceptual: mcActivos > 0 },
  }
}

// ── Recovery: Seed de Fuentes ─────────────────────────────────────────

/**
 * Crea FuenteEstado para todos los medios activos que no tienen uno.
 * Lógica idéntica a /api/seed-fuentes pero invocable desde instrumentation.
 */
export async function seedFuentes(): Promise<{ creados: number }> {
  const medios = await db.medio.findMany({
    where: { activo: true, url: { not: '' } },
    orderBy: [{ nivel: 'asc' }, { nombre: 'asc' }],
  })

  if (medios.length === 0) {
    console.log('[AutoRecovery] No hay medios para crear fuentes')
    return { creados: 0 }
  }

  const existentes = await db.fuenteEstado.findMany({
    select: { medioId: true },
  })
  const existentesSet = new Set(existentes.map(e => e.medioId))

  let creados = 0

  for (const medio of medios) {
    const frecuenciaBase = FRECUENCIA_POR_NIVEL[medio.nivel] || '6h'
    const tipoCheck = tipoCheckParaCategoria(medio.tipo)
    // Sources start as "validando" — not activated by level
    // They become "activa" only after a successful check-first validation
    try {
      await db.fuenteEstado.upsert({
        where: { medioId: medio.id },
        create: {
          medioId: medio.id,
          url: medio.url,
          tipoCheck,
          frecuenciaBase,
          frecuenciaActual: frecuenciaBase,
          activo: false,
          estado: 'validando',
        },
        update: {
          // Only re-create if missing — never auto-reactivate
        },
      })
      creados++
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      console.warn(`[AutoRecovery] Error creando fuente para ${medio.nombre}: ${msg}`)
    }
  }

  console.log(
    `[AutoRecovery] Fuentes: ${creados} creadas/actualizadas (estado: validando — requieren check-first)`
  )
  return { creados }
}

// ── Recovery: Reactivar Scheduler ────────────────────────────────────

/**
 * Verifica si el scheduler tiene tareas programadas.
 * Si no tiene ninguna y hay fuentes activas, fuerza reschedule.
 * No requiere reinicio — usa el mismo sistema de rescheduleAll.
 */
export async function verificarScheduler(): Promise<boolean> {
  const fuentesActivas = await db.fuenteEstado.count({
    where: { activo: true },
  })

  if (fuentesActivas === 0) {
    console.log('[AutoRecovery] No hay fuentes activas — scheduler no necesita tareas')
    return false
  }

  // El scheduler se reinicia automáticamente desde instrumentation.ts
  // Esta función solo verifica que las fuentes están listas
  console.log(`[AutoRecovery] ${fuentesActivas} fuentes activas — scheduler las programará al iniciar`)
  return true
}

// ── Recovery: Seed Marco Conceptual ─────────────────────────────────

/**
 * Ejecuta el seed del Marco Conceptual v1 si no existe uno activo.
 * Importa y reutiliza la misma lógica de prisma/seed-marco-conceptual.ts
 * pero como función invocable desde el auto-recovery.
 */
export async function seedMarcoConceptual(): Promise<boolean> {
  const existente = await db.marcoConceptual.findFirst({ where: { activa: true } })
  if (existente) {
    console.log(`[AutoRecovery] Marco Conceptual ya existe (v${existente.version}). Omitiendo.`)
    return false
  }

  console.log('[AutoRecovery] Marco Conceptual no encontrado — ejecutando seed...')

  try {
    // Datos del MC v1 inline (mismos que prisma/seed-marco-conceptual.ts)
    const principios = {
      principios: [
        { numero: 1, nombre: "Objetividad Activa", definicion: "Práctica de basar el análisis en hechos verificables, distinguir entre información comprobada y opinión, y presentar múltiples perspectivas cuando existen — sin caer en la falsa equidad de tratar todas las posturas como igualmente válidas cuando los hechos no lo sustentan.", que_es: ["Verificar un dato afirmado por un actor institucional contra fuentes oficiales antes de clasificarlo como 'informativo'", "Señalar cuando un medio presenta una sola versión de un evento sin contrastar con otras fuentes", "Distinguir entre 'el diputado afirmó X' (hecho comprobable: dijo eso) y 'X es verdad' (juicio de veracidad que el sistema NO emite)", "Contextualizar una declaración con su marco institucional"], que_no_es: ["No es imparcialidad (no es tratar toda opinión como igualmente válida)", "No es neutralidad (no es abstenerse de señalar cuando algo carece de sustento)", "No es equidistancia (no es poner a 50/50 lo que es 90/10 en evidencia)", "No es 'hechos alternativos' (no es dar espacio a versiones sin base fáctica)"], errores_llm: ["El LLM tiende a 'equilibrar' automáticamente: si una nota es crítica, el LLM a menudo añade 'sin embargo...' inventando un balance que no está en el texto", "El LLM confunde 'el medio dice que X es verdad' con 'X es verdad'", "El LLM trata declaraciones de un medio oficialista y un medio opositor como 'dos versiones igualmente válidas' cuando una tiene evidencia y la otra no"], reglas_operativas: ["HECHO vs. OPINIÓN: Si el texto dice 'El ministro anunció un presupuesto de 1000M', clasificar como INFORMATIVO. NO agregar 'este presupuesto es adecuado' ni 'es insuficiente' porque eso es opinión del LLM.", "FUENTE vs. VERDAD: Si un diputado afirma 'La inflación no existe', registrar que el diputado AFIRMA eso. NO validar ni invalidar.", "NO INVENTAR BALANCE: Si un texto es 100% crítico, clasificar como crítico al 100%. NO agregar matices que no estén en el texto fuente."] },
        { numero: 2, nombre: "Transparencia Metodológica", definicion: "Práctica de hacer explícitos los criterios, el razonamiento y el nivel de confianza detrás de cada clasificación, de modo que cualquier revisor humano pueda entender por qué el sistema tomó esa decisión y cuánta certidumbre tiene.", que_es: ["Cada mención incluye: por qué fue considerada relevante, por qué se le asignó ese tratamiento periodístico, por qué se vinculó a ese eje temático", "El nivel de confianza se expresa en tres niveles: alto (evidencia clara), medio (inferencia razonable con ambigüedad), bajo (texto insuficiente o contradictorio)", "Cuando hay ambigüedad, el sistema lo declara explícitamente en lugar de elegir la opción más 'segura'", "El sistema indica qué parte del texto fuente sustenta cada clasificación"], que_no_es: ["No es 'confesar' que es IA — es explicar su razonamiento", "No es producir una disertación por cada mención — es adjuntar los metadatos de clasificación", "No es justificar decisiones obvias — es ser explícito cuando la decisión no es obvia"], errores_llm: ["El LLM tiende a ser excesivamente confiado: asigna confianza 'alta' a cosas que en realidad inferió", "El LLM omite explicación cuando la clasificación es 'obvia' para él, pero puede no serlo para un humano", "El LLM inventa citas del texto que no existen para justificar su clasificación"], reglas_operativas: ["NIVEL DE CONFIANZA — ALTO: El texto contiene evidencia explícita y directa. MEDIO: El texto permite inferir pero tiene ambigüedades. BAJO: Texto insuficiente, contradictorio o requiere suposiciones.", "NO INVENTAR CITAS: Si se cita el texto fuente, la cita debe ser TEXTUAL o con elipsis marcados con [...].", "DECLARAR AMBIGÜEDAD: Si hay más de una interpretación válida, el sistema DEBE presentar ambas opciones y NO elegir arbitrariamente una."] },
        { numero: 3, nombre: "Honestidad Informativa", definicion: "Compromiso de reflejar fielmente el contenido del texto fuente, sin fabricar, inflar, suavizar ni reinterpretar lo que el medio efectivamente publicó. El sistema es un espejo, no un filtro.", que_es: ["Si un medio publicó una nota de 3 líneas sin profundidad, el resumen refleja eso", "Si un medio usó titular engañoso pero el contenido es equilibrado, clasificar según el CONTENIDO y señalar la discrepancia", "Si no hay suficiente contexto para clasificar, marcar como 'sin clasificar' — NO adivinar", "Si el sistema detecta ironía o sarcasmo, lo señala como tal en lugar de clasificarlo literalmente"], que_no_es: ["No es producir resúmenes 'mejorados' del contenido original", "No es corregir lo que el medio publicó aunque sea erróneo", "No es agregar contexto que el medio no proporcionó", "No es 'ayudar' al medio a ser más claro — es registrar lo que dijo"], errores_llm: ["El LLM tiende a 'mejorar' los resúmenes: transforma un texto desordenado en uno estructurado que no refleja la calidad original", "El LLM interpreta ironía como literal: 'Qué gran gestión del ministro' clasificado como 'elogioso' cuando es sarcasmo", "El LLM suaviza declaraciones agresivas porque su entrenamiento lo inclina a ser 'polite'", "El LLM 'rellena' información que no está en el texto basándose en su conocimiento general"], reglas_operativas: ["RESUMEN FIEL: Debe reflejar lo que el texto dice, el TONO original, la PROFUNDIDAD real, la CANTIDAD de información disponible.", "DETECCIÓN DE IRONÍA/SARCASMO: Indicadores: elogio excesivo fuera de contexto, contradicción entre tono y contenido. Si se detecta ironía → clasificar como 'editorial' e incluir nota: '[ironía detectada]'.", "NO RELLENAR: Si el texto menciona 'un proyecto de ley' sin especificar cuál, registrar: 'proyecto de ley no especificado'.", "TITULAR vs. CONTENIDO: Si difieren significativamente, clasificar según el CONTENIDO."] },
        { numero: 4, nombre: "Pluralismo Informativo", definicion: "Reconocimiento de que la realidad institucional tiene múltiples voces legítimas y que el silencio mediático sobre una perspectiva puede ser tan informativo como su presencia.", que_es: ["Una mención de un medio comunitario de El Alto tiene el mismo peso que una de un medio nacional de La Paz, en su contexto relevante", "Si un evento es cubierto por 5 medios y 4 son de la misma línea editorial, el sistema NOTA el desbalance como dato analítico", "El sistema detecta cuando una perspectiva institucional está ausente en la cobertura y lo registra", "La ausencia de cobertura de un evento que debería ser cubierto es un dato, no un vacío"], que_no_es: ["No es obligar a que cada nota tenga 'todas las voces'", "No es tratar una fuente sin credibilidad como equivalente a una fuente seria — es distinguir por rigor periodístico, no por ideología", "No es 'balance artificial' — si un evento solo tiene una versión documentada, se presenta sin inventar contraparte"], errores_llm: ["El LLM tiende a privilegiar fuentes 'conocidas' por su entrenamiento sobre fuentes locales", "El LLM asume que si solo hay una versión, debe haber otra 'equilibrante'", "El LLM descarta medios pequeños porque no los conoce bien"], reglas_operativas: ["IGUALDAD DE VOCES: Todas las fuentes registradas tienen el mismo peso.", "DESBALANCE COMO DATO: Si la cobertura proviene exclusivamente de medios de una misma línea editorial, registrarlo.", "SILENCIO INFORMATIVO: Si un evento relevante NO aparece en medios que normalmente lo cubrirían, el desbalance es notable en los reportes.", "LÍNEA EDITORIAL ≠ CREDIBILIDAD: La credibilidad se mide por rigor periodístico, no por orientación política."] },
        { numero: 5, nombre: "Contexto Institucional Boliviano", definicion: "Comprensión de las estructuras políticas, legislativas, sociales y culturales específicas del Estado Plurinacional de Bolivia.", que_es: ["Entender que Bolivia tiene un Estado Plurinacional con estructuras únicas", "Diferenciar entre Órgano Legislativo (ALP), Ejecutivo, Judicial, Electoral", "Conocer que los periodos legislativos tienen calendarios específicos", "Entender el contexto bilingüe/multilingüe"], que_no_es: ["No es tomar posición política sobre la estructura del Estado", "No es sustituir al usuario en su conocimiento del contexto", "No es documentar cada detalle institucional — es asegurar que las clasificaciones no fallen por ignorancia"], errores_llm: ["El LLM aplica marcos estadounidenses: 'senador' en Bolivia ≠ 'senador' en EE.UU.", "El LLM no conoce las particularidades del Estado Plurinacional", "El LLM confunde instituciones bolivianas con las de otros países"], reglas_operativas: ["ESTADO PLURINACIONAL DE BOLIVIA — Datos de referencia: ALP (Diputados 130, Senadores 36). Órgano Ejecutivo (Presidente, Vicepresidente, Ministerios). Órgano Electoral (TSE). Órgano Judicial (TSJ). Control (Fiscalía, Contraloría, Defensoría). 9 Gobiernos Departamentales, 339 Municipales.", "Proceso legislativo: Iniciativa → Comisión → Pleno → Cámara revisora → Sanción → Promulgación.", "Si el sistema no está seguro de un dato institucional específico, lo declara en lugar de adivinar."] },
        { numero: 6, nombre: "Independencia Analítica", definicion: "El sistema produce resultados que reflejan la realidad mediática documentada, sin ajustar, suavizar ni orientar los hallazgos según los intereses del cliente. El cliente recibe inteligencia, no validación.", que_es: ["Si 8 de 10 menciones de un legislador tienen tratamiento crítico, el reporte lo muestra tal cual", "Los ejes temáticos se definen por relevancia institucional, no por la agenda del cliente", "El sistema no produce 'análisis favorable' ni 'análisis desfavorable' — produce análisis objetivo", "Ejes personalizados por cliente se etiquetan claramente como tales"], que_no_es: ["No es ser 'anti-cliente' — es ser honesto con el cliente", "No es ignorar las preferencias del cliente — es no dejar que contaminen el análisis", "No es producir análisis genérico 'sin opinión' — es producir análisis fundado en evidencia"], errores_llm: ["Si el usuario expresó simpatía por un actor político, el LLM tiende a suavizar las menciones negativas", "El LLM tiende a producir resultados que 'agraden' al usuario", "El LLM evita conclusiones incómodas"], reglas_operativas: ["LOS DATOS MANDAN: Si la realidad mediática es desfavorable, reportar TAL CUAL. No suavizar, no redondear.", "CLIENTE ≠ SESGO: La identidad del cliente NO influye en la clasificación.", "DISTINCIÓN CLARA EN EJES: Institucionales son neutrales (todos los clientes). Personalizados se etiquetan 'cliente: [nombre]'."] },
        { numero: 7, nombre: "Ética del Dato", definicion: "El sistema solo procesa información públicamente disponible en medios de comunicación establecidos. No extrae datos personales de ciudadanos no públicos, no genera perfiles psicológicos.", que_es: ["Solo se procesa contenido publicado por medios de comunicación", "Los actores monitoreados son personas con función pública", "Si una nota incluye datos sensibles NO relevantes → se excluyen del resumen", "El sistema no construye perfiles de personalidad ni conducta privada"], que_no_es: ["No es censurar información — es filtrar datos sensibles irrelevantes", "No es proteger a actores públicos de escrutinio — es evitar la explotación de datos privados", "No es una decisión política — es un estándar ético"], errores_llm: ["El LLM no distingue entre función pública y vida privada automáticamente", "El LLM tiende a incluir toda información disponible sin filtrar"], reglas_operativas: ["FUENTES PERMITIDAS: Solo medios registrados. NO: redes sociales personales, blogs anónimos, foros, WhatsApp, TikTok.", "ACTORES MONITOREABLES: Personas con función pública vigente o reciente.", "DATOS SENSIBLES: Salud, vida familiar, orientación religiosa/sexual, situación económica personal. No relevantes → excluir. Sí relevantes → incluir con nota.", "NO PERFILES: El sistema NO genera ni infiere perfiles psicológicos ni diagnósticos de comportamiento."] },
        { numero: 8, nombre: "Enfoque Analítico-Institucional (No Mercadológico)", definicion: "El sistema utiliza técnicas de análisis de información para producir inteligencia sobre el entorno institucional. No utiliza técnicas de mercadotecnia (share of voice, brand sentiment, engagement, reach).", que_es: ["Análisis de contenido: qué se dice, cómo se dice, con qué fuentes, con qué profundidad", "Análisis de agenda: qué temas ocupan la atención mediática", "Análisis de actores: qué posiciones documentadas toman los actores institucionales", "Análisis de cobertura: profundidad, diversidad editorial, trayectoria temporal"], que_no_es: ["No es medir 'share of voice' — es analizar qué dice cuando aparece", "No es calcular 'sentimiento de marca' — es clasificar el tratamiento periodístico", "No es rastrear 'reach' o 'impresiones' — es evaluar profundidad y diversidad de cobertura", "No es hacer 'competitive intelligence' comercial — es hacer inteligencia del entorno institucional"], errores_llm: ["El LLM tiende a producir métricas tipo 'el 60% fue positivo'", "El LLM usa terminología de mercadotecnia espontáneamente (reach, engagement, buzz)", "El LLM produce 'recomendaciones' tipo 'se sugiere mejorar la comunicación'", "El LLM convierte análisis cualitativo en porcentajes"], reglas_operativas: ["TERMINOLOGÍA OBLIGATORIA: 'tratamiento periodístico' (NO 'sentimiento'), 'cobertura' (NO 'reach'), 'profundidad de análisis' (NO 'engagement'), 'diversidad de fuentes' (NO 'share of voice'), 'dinámica de agenda' (NO 'trending topic').", "TERMINOLOGÍA PROHIBIDA: share of voice, brand sentiment, reach, impressions, engagement, NPS, brand awareness, posicionamiento, buzz, viral, insights, actionable intelligence, competitive intelligence, stakeholder, lead, KPI.", "MÉTRICAS INSTITUCIONALES: Número de medios, distribución por tratamiento, diversidad de líneas editoriales. NO: porcentaje favorable/desfavorable, número estimado de lectores."] },
        { numero: 9, nombre: "Rigor Periodístico (Preguntas Fundamentales de la Nota)", definicion: "Toda mención procesada debe intentar responder las preguntas fundamentales del periodismo (qué, quién, cuándo, cómo, por qué, para qué, a quiénes afecta, dónde).", que_es: ["QUÉ: El evento principal de la nota", "QUIÉN: Actores individuales, colectivos e implícitos", "CUÁNDO: Fecha exacta o referencia temporal", "CÓMO: Mecanismo, canal y tono del evento", "POR QUÉ: Causas inmediatas declaradas", "PARA QUÉ: Intención del actor (declarada o inferible con evidencia)", "A QUIÉNES AFECTA: Afectados directos, indirectos y potenciales", "DÓNDE: Contexto geográfico e institucional"], que_no_es: ["No es forzar respuestas cuando el texto no las contiene", "No es adivinar intenciones del actor sin evidencia", "No es producir un artículo periodístico — es extraer las respuestas que el texto provee", "No es inventar contexto geográfico o temporal que no está en la fuente"], errores_llm: ["El LLM tiende a responder TODAS las preguntas incluso cuando el texto no tiene suficiente información", "El LLM confunde 'por qué' (causa) con 'para qué' (intención)", "El LLM inventa afectados que no están mencionados en el texto", "El LLM asigna intención sin suficiente evidencia"], reglas_operativas: ["Si el texto no responde una pregunta → registrar 'No especificado en la fuente'. NUNCA inventar.", "POR QUÉ vs. PARA QUÉ: 'Por qué' = causas (algo pasó porque...). 'Para qué' = intención (alguien hizo algo con el objetivo de...).", "AFECTADOS: Distinguir entre afectados MENCIONADOS en el texto e INFERIDOS por contexto.", "CONFIANZA POR PREGUNTA: Cada pregunta puede tener su propio nivel de confianza."] },
      ]
    }

    const contextoInstitucional = {
      estructura_estado: {
        organo_legislativo: { nombre: "Asamblea Legislativa Plurinacional", camaras: ["Cámara de Diputados (130 miembros)", "Cámara de Senadores (36 miembros)"], proceso_legislativo: "Iniciativa → Comisión → Pleno → Cámara revisora → Sanción → Promulgación" },
        organo_ejecutivo: { nombre: "Órgano Ejecutivo", cabezas: ["Presidente", "Vicepresidente"], estructura: "Ministerios y Viceministerios" },
        organo_electoral: ["Tribunal Supremo Electoral", "Órgano Electoral Plurinacional"],
        organo_judicial: ["Tribunal Supremo de Justicia", "Tribunales Departamentales"],
        organos_control: ["Fiscalía General del Estado", "Contraloría General del Estado", "Defensoría del Pueblo"],
        gobiernos_subnacionales: ["9 Gobiernos Departamentales", "339 Gobiernos Municipales", "Gobiernos Autónomos Indígena Originario Campesinos"]
      },
      partidos_vigentes: ["MAS-IPSP", "Comunidad Ciudadana", "CREEMOS"],
      periodo_legislativo: "2020-2025"
    }

    const escalaTratamiento = {
      categorias: [
        { codigo: "tratamiento_informativo", nombre: "Informativo", definicion: "Cobertura factual, sin carga valorativa." },
        { codigo: "tratamiento_analitico", nombre: "Analítico", definicion: "Incluye contexto, antecedentes, múltiples fuentes." },
        { codigo: "tratamiento_critico", nombre: "Crítico", definicion: "Cuestionamiento fundamentado, investigación." },
        { codigo: "tratamiento_editorial", nombre: "Editorializante", definicion: "Opinión del medio, toma de posición explícita." },
        { codigo: "tratamiento_agresivo", nombre: "Agresivo", definicion: "Ataque personal, descalificación, titilarización sin fundamento." },
        { codigo: "tratamiento_elogioso", nombre: "Elogioso", definicion: "Reconocimiento, perfil positivo, destacado deliberado." },
        { codigo: "tratamiento_ambiguo", nombre: "Ambiguo", definicion: "No se puede determinar el tratamiento." },
        { codigo: "tratamiento_agregado", nombre: "Agregado (deduplicado)", definicion: "Cobertura adicional de un evento ya registrado." },
        { codigo: "sin_tratamiento", nombre: "Sin clasificar", definicion: "No aplica o no hay suficiente información." }
      ]
    }

    const lineasEditoriales = {
      descripcion: "Clasificación de líneas editoriales de medios bolivianos.",
      categorias: [
        { codigo: "oficialista", nombre: "Oficialista / Pro-gobierno", definicion: "Cobertura favorable o alineada con el gobierno de turno." },
        { codigo: "opositor", nombre: "Opositor / Crítica al gobierno", definicion: "Cobertura predominantemente crítica al gobierno de turno." },
        { codigo: "independiente", nombre: "Independiente / Plural", definicion: "Equilibrio en cobertura con múltiples perspectivas." },
        { codigo: "institucional", nombre: "Institucional / Especializada", definicion: "Cobertura sectorial sin orientación partidaria." },
        { codigo: "popular", nombre: "Popular / Sensacionalista", definicion: "Noticias policiales, espectaculares y de impacto emocional." },
        { codigo: "comunitaria", nombre: "Comunitaria / Alternativa", definicion: "Cobertura local, indígena, campesina o social." }
      ],
      notas: ["La línea editorial se evalúa por NOTA individual, no por medio completo.", "La clasificación NO implica juicio de valor.", "Si no se puede determinar → clasificar como 'no determinada'."]
    }

    const ejesInstitucionales = {
      descripcion: "Los 12 Ejes Temáticos Institucionales son universales, neutrales y aplican a TODOS los productos.",
      ejes: [
        { orden: 1, slug: 'hidrocarburos-energia', nombre: 'Hidrocarburos, Energía y Combustible', keywords: 'gas,petróleo,YPFB,litio,electricidad,subsidio,gasolina,diésel,hidrocarburo,regalías' },
        { orden: 2, slug: 'movimientos-sociales', nombre: 'Movimientos Sociales y Conflictividad', keywords: 'bloqueo,marcha,paro,protesta,COB,CSUTCB,CSCB,CONAMAQ,FNMCB,conflicto,movilización' },
        { orden: 3, slug: 'gobierno-oposicion', nombre: 'Gobierno, Oposición e Instituciones', keywords: 'Asamblea,diputado,senador,ley,banca,bloque,partido,elección,gobierno,oposición,presidente,ministro' },
        { orden: 4, slug: 'corrupcion-impunidad', nombre: 'Corrupción e Impunidad', keywords: 'corrupción,denuncia,auditoría,Fondo Indígena,irregularidad,desvío,Fiscalía,nepotismo' },
        { orden: 5, slug: 'economia', nombre: 'Economía y Política Económica', keywords: 'inflación,tipo de cambio,dólar,PIB,exportación,importación,reservas,empresa estatal,presupuesto' },
        { orden: 6, slug: 'justicia-derechos', nombre: 'Justicia y Derechos Humanos', keywords: 'justicia,Fiscalía,Tribunal,sentencia,detención,derechos humanos,preso,judicialización' },
        { orden: 7, slug: 'procesos-electorales', nombre: 'Procesos Electorales', keywords: 'elección,TSE,OEP,observación,urnas,voto,candidato,comicio,electoral' },
        { orden: 8, slug: 'educacion-cultura', nombre: 'Educación, Universidades y Cultura', keywords: 'educación,universidad,magisterio,presupuesto,estudiantes,escuela,colegio,cultura' },
        { orden: 9, slug: 'salud-servicios', nombre: 'Salud y Servicios Públicos', keywords: 'salud,hospital,medicamentos,Seguro,COVID,médicos,enfermeros' },
        { orden: 10, slug: 'medio-ambiente', nombre: 'Medio Ambiente, Territorio y Recursos', keywords: 'medio ambiente,agua,incendios,autonomías,minería,deforestación,territorio,concesión' },
        { orden: 11, slug: 'relaciones-internacionales', nombre: 'Relaciones Internacionales', keywords: 'relaciones,frontera,migración,embajada,cooperación,tratado,diplomacia' },
        { orden: 12, slug: 'mineria', nombre: 'Minería y Metales Estratégicos', keywords: 'minería,minero,cooperativa minera,COMIBOL,Huanuni,Colquiri,estano,zinc,plata,plomo,oro,YLB,litio,salar' },
      ]
    }

    const reglasDesambiguacion = {
      descripcion: "Reglas para resolver ambigüedades en nombres, entidades, eventos y siglas.",
      reglas: [
        { tipo: "nombres_personas", nombre: "Desambiguación de Nombres", contexto: "Bolivia tiene apellidos muy comunes (Mamani, Quispe, Choque, Condori, Flores, Pérez)." },
        { tipo: "siglas_instituciones", nombre: "Desambiguación de Siglas", contexto: "Múltiples instituciones con siglas similares." },
        { tipo: "eventos_temporales", nombre: "Eventos y Fechas", contexto: "Eventos recurrentes pueden confundirse entre años." },
        { tipo: "geograficos", nombre: "Geográfica", contexto: "Ciudades con nombres compartidos entre departamentos." },
        { tipo: "medios", nombre: "Medios de Comunicación", contexto: "Nombres genéricos de medios." },
      ],
      principio_general: "Ante la duda, NO asignar. Es preferible marcar como 'ambiguo' que asignar incorrectamente."
    }

    const criteriosRelevancia = {
      es_relevante_si: [
        "Menciona a una Persona activa en el sistema (legislador, autoridad)",
        "Se refiere a un EjeTematico activo con al menos 2 keywords coincidentes",
        "Contiene datos cuantitativos (porcentajes, montos, fechas de eventos)",
        "Es opinión editorial o columna de un medio monitoreado",
        "Genera reacción política verificable (rechazo, apoyo, convocatoria)"
      ],
      no_es_relevante_si: [
        "Es mención pasajera en listado, agenda o cronograma sin análisis",
        "Es contenido publicitario o entretenimiento",
        "Es repetición literal de cable de agencia sin valor agregado",
        "Es nota de farándula, deportes o cultura (salvo que afecte imagen política)"
      ]
    }

    const exclusionesEtica = {
      datos_sensibles: ["salud", "vida familiar/afectiva", "orientación religiosa", "orientación sexual", "situación económica personal"],
      fuentes_no_permitidas: ["redes sociales personales", "WhatsApp", "Telegram", "foros anónimos", "blogs sin línea editorial", "filtraciones no verificadas"],
      no_monitoreables: ["familiares de actores públicos", "amigos", "colaboradores privados sin función pública"]
    }

    const terminologiaPermitida = {
      obligatoria: { "sentimiento": "tratamiento periodístico", "reach": "cobertura", "engagement": "profundidad de análisis", "share of voice": "diversidad de fuentes", "trending topic": "dinámica de agenda", "insights": "inteligencia institucional", "mención viral": "evento mediático", "relevancia comercial": "relevancia institucional", "stakeholder": "actor institucional", "lead": "hallazgo", "KPI": "indicador de análisis" }
    }

    const terminologiaProhibida = {
      terminos: ["share of voice", "brand sentiment", "reach", "impressions", "engagement", "NPS", "brand awareness", "posicionamiento", "buzz", "viral", "insights", "actionable intelligence", "competitive intelligence", "stakeholder", "lead", "KPI"]
    }

    const preguntasFundamentales = {
      descripcion: "Las preguntas fundamentales del periodismo institucional que el sistema debe responder para cada mención.",
      preguntas: [
        { codigo: "que", nombre: "Qué", definicion: "El evento principal de la nota." },
        { codigo: "quien", nombre: "Quién", definicion: "Actores: quien declara, quien es mencionado, quien es afectado." },
        { codigo: "cuando", nombre: "Cuándo", definicion: "Fecha exacta o referencia temporal." },
        { codigo: "como", nombre: "Cómo", definicion: "Mecanismo, canal y tono del evento." },
        { codigo: "por_que", nombre: "Por Qué", definicion: "Causas inmediatas. Causas (algo pasó porque...)." },
        { codigo: "para_que", nombre: "Para Qué", definicion: "Intención declarada o inferible. Intención (objetivo de...)." },
        { codigo: "a_quienes_afecta", nombre: "A Quiénes Afecta", definicion: "Personas o instituciones impactadas." },
        { codigo: "donde", nombre: "Dónde", definicion: "Contexto geográfico e institucional." }
      ],
      principio_general: "Si el texto no responde una pregunta → 'No especificado en la fuente'. NUNCA inventar."
    }

    const parametros = {
      umbral_similitud_duplicado: 0.80,
      ventana_deduplicacion_hs: 48,
      confianza_minima_auto: 0.75,
      confianza_minima_revision: 0.50,
      max_menciones_por_medio_dia: 50,
      historial_contexto_dias: 30,
      costo_maximo_diario_usd: 5.00,
      activar_deduplicacion: true,
      activar_clasificacion_auto: true
    }

    await db.marcoConceptual.create({
      data: {
        version: 1,
        activa: true,
        principios,
        contextoInstitucional,
        lineasEditoriales,
        ejesInstitucionales,
        escalaTratamiento,
        reglasDesambiguacion,
        criteriosRelevancia,
        exclusionesEtica,
        terminologiaPermitida,
        terminologiaProhibida,
        preguntasFundamentales,
        parametros,
        creadoPor: 'sistema (auto-recovery)',
      },
    })

    console.log('[AutoRecovery] Marco Conceptual v1 creado exitosamente')
    return true
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error(`[AutoRecovery] Error creando Marco Conceptual: ${msg}`)
    return false
  }
}

// ── Recovery: Seed de Personas (legisladores) ───────────────────────

// Mapeo de siglas de partido — normalización (mismo que /api/seed)
const PARTIDO_MAP: Record<string, string> = {
  'PDC': 'Partido Demócrata Cristiano',
  'LIBRE': 'Libre', 'UNIDAD': 'Unidad',
  'APB SÚMATE': 'APB Súmate', 'AP': 'Acción Panamericana',
  'MAS IPSP': 'Movimiento al Socialismo - IPSP',
  'BIA YUQUI': 'Bia Yuqui', 'CC': 'Comunidad Ciudadana',
  'MNR': 'Movimiento Nacionalista Revolucionario',
  'MTS': 'Movimiento Tercer Sistema',
  'PAN-BOL': 'Poder Andino Amazónico', 'JUNTOS': 'Juntos',
  'FRI': 'Frente Revolucionario de Izquierda', 'VERDE': 'Partido Verde',
  'PODEMOS': 'Poder Democrático Social', 'MIR': 'Movimiento de Izquierda Revolucionaria',
  'ADN': 'Acción Democrática Nacionalista', 'NFR': 'Nueva Fuerza Republicana',
  'UCS': 'Unidad Cívica Solidaridad',
}

const DEPARTAMENTOS: Record<string, string> = {
  'Chuquisaca': 'Chuquisaca', 'La paz': 'La Paz', 'La Paz': 'La Paz',
  'Cochabamba': 'Cochabamba', 'Oruro': 'Oruro', 'Potosí': 'Potosí', 'Potosi': 'Potosí',
  'Tarija': 'Tarija', 'Santa cruz': 'Santa Cruz', 'Santa Cruz': 'Santa Cruz',
  'Beni': 'Beni', 'Pando': 'Pando',
}

function normalizarPartido(sigla: string, nombre: string): { sigla: string; nombre: string } {
  let siglaLimpia = (sigla || '').toUpperCase().trim()
  const sNorm = siglaLimpia.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  if (sNorm.includes('APB') && sNorm.includes('SUMATE')) siglaLimpia = 'APB SÚMATE'
  return { sigla: siglaLimpia, nombre: PARTIDO_MAP[siglaLimpia] || nombre || siglaLimpia }
}

function normalizarDepto(dep: string): string {
  if (!dep) return ''
  const d = dep.charAt(0).toUpperCase() + dep.slice(1).toLowerCase()
  return DEPARTAMENTOS[d] || d
}

/**
 * Carga legisladores desde JSON si la tabla Persona está vacía/degradada.
 * Fuentes: data/senadores_completo.json + data/legisladores_2025_2030.json
 * No elimina datos existentes — solo inserta los que faltan (idempotente).
 */
export async function seedPersonas(): Promise<{ senadores: number; diputados: number }> {
  const existentes = await db.persona.count()
  if (existentes >= SALUD_THRESHOLDS.personas) {
    console.log(`[AutoRecovery] Personas ya cargadas: ${existentes}. Omitiendo seed.`)
    return { senadores: 0, diputados: 0 }
  }

  console.log(`[AutoRecovery] Personas insuficientes: ${existentes}/${SALUD_THRESHOLDS.personas}. Ejecutando seed...`)

  let senadores = 0
  let diputados = 0

  // 1. Senadores desde senadores_completo.json
  try {
    const senadoresRaw = JSON.parse(
      readFileSync(join(process.cwd(), 'data', 'senadores_completo.json'), 'utf-8')
    )
    for (const sen of senadoresRaw) {
      const nombre = String(sen.nombre || '').replace(/\s+/g, ' ').trim()
      if (!nombre) continue

      // Evitar duplicados: verificar por nombre + camara
      const existe = await db.persona.findFirst({
        where: { nombre, camara: 'Senadores' },
      })
      if (existe) { senadores++; continue }

      const partido = normalizarPartido(String(sen.partido_sigla || ''), String(sen.partido || ''))
      await db.persona.create({
        data: {
          nombre,
          camara: 'Senadores',
          departamento: normalizarDepto(String(sen.departamento || '')),
          partido: partido.nombre,
          partidoSigla: partido.sigla,
          tipo: String(sen.es_titular) === 'true' ? 'Titular' : 'Suplente',
          cargoDirectiva: sen.cargo_directiva ? String(sen.cargo_directiva) : null,
          email: sen.email ? String(sen.email) : null,
          fotoUrl: sen.foto_url ? String(sen.foto_url) : '',
          periodo: '2025-2030',
        },
      })
      senadores++
    }
    console.log(`[AutoRecovery] Senadores insertados: ${senadores}`)
  } catch (error) {
    console.error('[AutoRecovery] Error cargando senadores:', error instanceof Error ? error.message : error)
  }

  // 2. Diputados desde legisladores_2025_2030.json (array de 334, filtrar camara='Diputados')
  try {
    const legisladoresRaw = JSON.parse(
      readFileSync(join(process.cwd(), 'data', 'legisladores_2025_2030.json'), 'utf-8')
    )
    const diputadosData = (Array.isArray(legisladoresRaw) ? legisladoresRaw : legisladoresRaw.diputados || [])
      .filter((d: Record<string, unknown>) => d.camara === 'Diputados' || d.tipo === 'Diputados')

    for (const dip of diputadosData) {
      const nombre = String(dip.nombre || '').replace(/\s+/g, ' ').trim()
      if (!nombre) continue

      const existe = await db.persona.findFirst({
        where: { nombre, camara: 'Diputados' },
      })
      if (existe) { diputados++; continue }

      const partido = normalizarPartido(String(dip.partidoSigla || dip.partido_sigla || ''), String(dip.partido || ''))
      await db.persona.create({
        data: {
          nombre,
          camara: 'Diputados',
          departamento: normalizarDepto(String(dip.departamento || '')),
          partido: partido.nombre,
          partidoSigla: partido.sigla,
          tipo: String(dip.tipo || 'Titular'),
          cargoDirectiva: dip.cargoDirectiva ? String(dip.cargoDirectiva) : null,
          email: null,
          fotoUrl: String(dip.foto_url || ''),
          periodo: '2025-2030',
        },
      })
      diputados++
    }
    console.log(`[AutoRecovery] Diputados insertados: ${diputados}`)
  } catch (error) {
    console.error('[AutoRecovery] Error cargando diputados:', error instanceof Error ? error.message : error)
  }

  const total = senadores + diputados
  console.log(`[AutoRecovery] Seed Personas completado: ${total} legisladores (${senadores} senadores, ${diputados} diputados)`)
  return { senadores, diputados }
}

// ── Recovery: Seed de Indicadores (Tier 1) ───────────────────────────

/**
 * Ejecuta seed de indicadores si la tabla está vacía/degradada.
 * Reutiliza seedIndicadores() de capturer-tier1 (mismos 50 indicadores ONION200).
 * Idempotente: usa upsert por slug, no duplica.
 */
export async function seedIndicadoresAuto(): Promise<number> {
  const existentes = await db.indicador.count()
  if (existentes >= 10) {
    console.log(`[AutoRecovery] Indicadores ya cargados: ${existentes}. Omitiendo seed.`)
    return 0
  }

  console.log(`[AutoRecovery] Indicadores insuficientes: ${existentes}. Ejecutando seed...`)

  try {
    const { seedIndicadores } = await import('@/lib/indicadores/capturer-tier1')
    await seedIndicadores()

    const nuevos = await db.indicador.count()
    const creados = nuevos - existentes
    console.log(`[AutoRecovery] Indicadores: ${creados} creados, total ${nuevos}`)
    return creados
  } catch (error) {
    console.error('[AutoRecovery] Error cargando indicadores:', error instanceof Error ? error.message : error)
    return 0
  }
}

// ── Recovery Principal ────────────────────────────────────────────────

export interface RecoveryResult {
  ejecutado: boolean
  acciones: string[]
  diagnostico: DBDiagnosis
}

/**
 * Ejecuta el ciclo completo de auto-recovery.
 * Se llama UNA VEZ desde instrumentation.ts al arrancar.
 *
 * Lógica:
 * 1. Diagnosticar DB
 * 2. Si hay problemas, ejecutar recovery parcial o total
 * 3. No tocar datos existentes que estén correctos
 *
 * IMPORTANTE: Esta función es idempotente — llamarla varias veces
 * no causa efectos secundarios.
 */
export async function ejecutarAutoRecovery(): Promise<RecoveryResult> {
  const diagnostico = await diagnosticarDB()
  const acciones: string[] = []

  if (diagnostico.sana) {
    console.log(
      `[AutoRecovery] DB sana — ${diagnostico.conteos.personas} personas, ` +
      `${diagnostico.conteos.medios} medios, ${diagnostico.conteos.fuentes} fuentes`
    )
    return { ejecutado: false, acciones, diagnostico }
  }

  console.log(`[AutoRecovery] DB degradada detectada:`)
  for (const problema of diagnostico.problemas) {
    console.log(`  ⚠️  ${problema}`)
  }

  // ── Recovery de Marco Conceptual ──
  if (!diagnostico.conteos.marcoConceptual) {
    const mcCreado = await seedMarcoConceptual()
    if (mcCreado) {
      acciones.push('Marco Conceptual v1 creado (seed automático)')
    } else {
      acciones.push('Marco Conceptual: error al crear (requiere intervención manual)')
    }
  }

  // ── Recovery de Personas ──
  if (diagnostico.conteos.personas < SALUD_THRESHOLDS.personas) {
    const resultado = await seedPersonas()
    acciones.push(`Personas seed: ${resultado.senadores} senadores + ${resultado.diputados} diputados`)
  }

  // ── Recovery de Indicadores ──
  if (diagnostico.conteos.indicadores < 10) {
    const creados = await seedIndicadoresAuto()
    acciones.push(`Indicadores seed: ${creados} creados`)
  }

  // ── Recovery de Fuentes ──
  if (diagnostico.conteos.fuentes < SALUD_THRESHOLDS.fuentes) {
    const resultado = await seedFuentes()
    acciones.push(
      `Fuentes seed: ${resultado.creados} creadas/actualizadas (estado: validando)`
    )

    // Verificar fuentes con checks vacíos — resetear fingerprint para re-check
    const fuentesSinCheck = await db.fuenteEstado.count({
      where: { ultimoCheck: null, activo: true },
    })
    if (fuentesSinCheck > 0) {
      acciones.push(`${fuentesSinCheck} fuentes sin checks previos — listas para monitoreo`)
    }
  }

  // ── Verificar Scheduler ──
  const schedulerOk = await verificarScheduler()
  if (schedulerOk) {
    acciones.push('Scheduler verificado con fuentes activas')
  }

  console.log(`[AutoRecovery] Recovery completado: ${acciones.length} acciones`)
  for (const accion of acciones) {
    console.log(`  ✅ ${accion}`)
  }

  return { ejecutado: true, acciones, diagnostico }
}

// ── Backup Periódico de DB ────────────────────────────────────────────

// Configuración de backup
const BACKUP_CONFIG = {
  maxBackups: 5,           // Máximo de backups a mantener
  intervalMs: 6 * 60 * 60 * 1000,  // 6 horas entre backups
  cycleThreshold: 100,     // O cada 100 ciclos de scraping
} as const

// Estado del contador de ciclos (persiste en memoria durante la sesión)
let scrapeCycleCount = 0
let lastBackupTime = 0

/**
 * Incrementa el contador de ciclos de scraping y ejecuta backup
 * si se alcanza el umbral de ciclos o el intervalo de tiempo.
 *
 * Llamar después de cada ciclo completo de scrape-fuente.
 * Usa fs.copyFileSync() — NO usa git para el backup.
 *
 * Backups se guardan en: prisma/db/backups/custom-YYYY-MM-DD-HHMMSS.db
 */
export function checkAndBackupDB(): { backed: boolean; path?: string; error?: string } {
  scrapeCycleCount++
  const now = Date.now()
  const timeElapsed = now - lastBackupTime

  // Verificar si toca backup por ciclos O por tiempo
  const byCycles = scrapeCycleCount >= BACKUP_CONFIG.cycleThreshold
  const byTime = lastBackupTime === 0 || timeElapsed >= BACKUP_CONFIG.intervalMs

  if (!byCycles && !byTime) {
    return { backed: false }
  }

  // Ejecutar backup
  try {
    const dbPath = join(process.cwd(), 'prisma', 'db', 'custom.db')
    const backupDir = join(process.cwd(), 'prisma', 'db', 'backups')

    // Verificar que la DB existe
    if (!existsSync(dbPath)) {
      return { backed: false, error: `DB no encontrada: ${dbPath}` }
    }

    // Crear directorio de backups si no existe
    if (!existsSync(backupDir)) {
      mkdirSync(backupDir, { recursive: true })
    }

    // Generar nombre de backup con timestamp
    const now_date = new Date()
    const ts = now_date.toISOString()
      .replace(/[:.]/g, '-')
      .replace('T', '_')
      .slice(0, 19)  // YYYY-MM-DD_HH-MM-SS
    const backupPath = join(backupDir, `custom-${ts}.db`)

    // Copiar DB (sincrono — bloqueante pero seguro para SQLite)
    copyFileSync(dbPath, backupPath)

    // Obtener tamaño del backup
    const backupStats = statSync(backupPath)
    const sizeKB = Math.round(backupStats.size / 1024)

    // Limpiar backups antiguos (mantener solo los últimos N)
    cleanOldBackups(backupDir)

    // Resetear contadores
    scrapeCycleCount = 0
    lastBackupTime = now

    console.log(
      `[Backup] DB respaldada: ${backupPath} (${sizeKB} KB) ` +
      `[${byCycles ? `${scrapeCycleCount} ciclos` : `${Math.round(timeElapsed / 60000)}min`}]`
    )

    return { backed: true, path: backupPath }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error(`[Backup] Error al respaldar DB: ${msg}`)
    return { backed: false, error: msg }
  }
}

/**
 * Limpia los backups más antiguos, manteniendo solo los últimos MAX_BACKUPS.
 * Ordena por fecha de modificación (más reciente primero).
 */
function cleanOldBackups(backupDir: string): void {
  try {
    const files = readdirSync(backupDir)
      .filter(f => f.startsWith('custom-') && f.endsWith('.db'))
      .map(f => ({
        name: f,
        path: join(backupDir, f),
        mtime: statSync(join(backupDir, f)).mtimeMs,
      }))
      .sort((a, b) => b.mtime - a.mtime)  // Más reciente primero

    // Eliminar los que exceden el máximo
    if (files.length > BACKUP_CONFIG.maxBackups) {
      const toDelete = files.slice(BACKUP_CONFIG.maxBackups)
      for (const file of toDelete) {
        try {
          unlinkSync(file.path)
          console.log(`[Backup] Backup antiguo eliminado: ${file.name}`)
        } catch {
          // Ignorar errores al eliminar — no es crítico
        }
      }
    }
  } catch {
    // Si el directorio no existe o hay error, no es crítico
  }
}

/**
 * Ejecuta un backup inmediato (forzado).
 * Útil para antes de operaciones destructivas o al cerrar sesión.
 */
export function backupNow(): { backed: boolean; path?: string; error?: string } {
  scrapeCycleCount = BACKUP_CONFIG.cycleThreshold  // Forzar trigger
  return checkAndBackupDB()
}
