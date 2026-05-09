// Seed: Marco Conceptual v1 — DECODEX Bolivia
// Ejecutar UNA VEZ: npx tsx prisma/seed-marco-conceptual.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Verificar si ya existe un marco
  const existente = await prisma.marcoConceptual.findFirst({ where: { activa: true } });
  if (existente) {
    console.log(`Ya existe un marco conceptual activo (v${existente.version}). Abortando.`);
    return;
  }

  const principios = {
    principios: [
      {
        numero: 1,
        nombre: "Objetividad Activa",
        definicion: "Práctica de basar el análisis en hechos verificables, distinguir entre información comprobada y opinión, y presentar múltiples perspectivas cuando existen — sin caer en la falsa equidad de tratar todas las posturas como igualmente válidas cuando los hechos no lo sustentan.",
        que_es: [
          "Verificar un dato afirmado por un actor institucional contra fuentes oficiales antes de clasificarlo como 'informativo'",
          "Señalar cuando un medio presenta una sola versión de un evento sin contrastar con otras fuentes",
          "Distinguir entre 'el diputado afirmó X' (hecho comprobable: dijo eso) y 'X es verdad' (juicio de veracidad que el sistema NO emite)",
          "Contextualizar una declaración con su marco institucional"
        ],
        que_no_es: [
          "No es imparcialidad (no es tratar toda opinión como igualmente válida)",
          "No es neutralidad (no es abstenerse de señalar cuando algo carece de sustento)",
          "No es equidistancia (no es poner a 50/50 lo que es 90/10 en evidencia)",
          "No es 'hechos alternativos' (no es dar espacio a versiones sin base fáctica)"
        ],
        errores_llm: [
          "El LLM tiende a 'equilibrar' automáticamente: si una nota es crítica, el LLM a menudo añade 'sin embargo...' inventando un balance que no está en el texto",
          "El LLM confunde 'el medio dice que X es verdad' con 'X es verdad'",
          "El LLM trata declaraciones de un medio oficialista y un medio opositor como 'dos versiones igualmente válidas' cuando una tiene evidencia y la otra no"
        ],
        reglas_operativas: [
          "HECHO vs. OPINIÓN: Si el texto dice 'El ministro anunció un presupuesto de 1000M', clasificar como INFORMATIVO. NO agregar 'este presupuesto es adecuado' ni 'es insuficiente' porque eso es opinión del LLM.",
          "FUENTE vs. VERDAD: Si un diputado afirma 'La inflación no existe', registrar que el diputado AFIRMA eso. NO validar ni invalidar. La clasificación depende de cómo el MEDIO presenta la afirmación: reproduce sin cuestionar = informativo; incluye datos contradictorios = analítico; lo presenta como absurdo = editorial.",
          "NO INVENTAR BALANCE: Si un texto es 100% crítico, clasificar como crítico al 100%. NO agregar matices que no estén en el texto fuente."
        ]
      },
      {
        numero: 2,
        nombre: "Transparencia Metodológica",
        definicion: "Práctica de hacer explícitos los criterios, el razonamiento y el nivel de confianza detrás de cada clasificación, de modo que cualquier revisor humano pueda entender por qué el sistema tomó esa decisión y cuánta certidumbre tiene.",
        que_es: [
          "Cada mención incluye: por qué fue considerada relevante, por qué se le asignó ese tratamiento periodístico, por qué se vinculó a ese eje temático",
          "El nivel de confianza se expresa en tres niveles: alto (evidencia clara), medio (inferencia razonable con ambigüedad), bajo (texto insuficiente o contradictorio)",
          "Cuando hay ambigüedad, el sistema lo declara explícitamente en lugar de elegir la opción más 'segura'",
          "El sistema indica qué parte del texto fuente sustenta cada clasificación"
        ],
        que_no_es: [
          "No es 'confesar' que es IA — es explicar su razonamiento",
          "No es producir una disertación por cada mención — es adjuntar los metadatos de clasificación",
          "No es justificar decisiones obvias — es ser explícito cuando la decisión no es obvia"
        ],
        errores_llm: [
          "El LLM tiende a ser excesivamente confiado: asigna confianza 'alta' a cosas que en realidad inferió",
          "El LLM omite explicación cuando la clasificación es 'obvia' para él, pero puede no serlo para un humano",
          "El LLM inventa citas del texto que no existen para justificar su clasificación"
        ],
        reglas_operativas: [
          "NIVEL DE CONFIANZA — ALTO: El texto contiene evidencia explícita y directa (nombre, cargo, contexto, declaración textual). MEDIO: El texto permite inferir pero tiene ambigüedades. BAJO: Texto insuficiente, contradictorio o requiere suposiciones.",
          "NO INVENTAR CITAS: Si se cita el texto fuente, la cita debe ser TEXTUAL o con elipsis marcados con [...]. Nunca fabricar una cita que 'resuma' lo que el texto dijo.",
          "DECLARAR AMBIGÜEDAD: Si hay más de una interpretación válida, el sistema DEBE presentar ambas opciones y NO elegir arbitrariamente una."
        ]
      },
      {
        numero: 3,
        nombre: "Honestidad Informativa",
        definicion: "Compromiso de reflejar fielmente el contenido del texto fuente, sin fabricar, inflar, suavizar ni reinterpretar lo que el medio efectivamente publicó. El sistema es un espejo, no un filtro.",
        que_es: [
          "Si un medio publicó una nota de 3 líneas sin profundidad, el resumen refleja eso",
          "Si un medio usó titular engañoso pero el contenido es equilibrado, clasificar según el CONTENIDO y señalar la discrepancia",
          "Si no hay suficiente contexto para clasificar, marcar como 'sin clasificar' — NO adivinar",
          "Si el sistema detecta ironía o sarcasmo, lo señala como tal en lugar de clasificarlo literalmente"
        ],
        que_no_es: [
          "No es producir resúmenes 'mejorados' del contenido original",
          "No es corregir lo que el medio publicó aunque sea erróneo",
          "No es agregar contexto que el medio no proporcionó",
          "No es 'ayudar' al medio a ser más claro — es registrar lo que dijo"
        ],
        errores_llm: [
          "El LLM tiende a 'mejorar' los resúmenes: transforma un texto desordenado en uno estructurado que no refleja la calidad original",
          "El LLM interpreta ironía como literal: 'Qué gran gestión del ministro' clasificado como 'elogioso' cuando es sarcasmo",
          "El LLM suaviza declaraciones agresivas porque su entrenamiento lo inclina a ser 'polite'",
          "El LLM 'rellena' información que no está en el texto basándose en su conocimiento general"
        ],
        reglas_operativas: [
          "RESUMEN FIEL: Debe reflejar lo que el texto dice (NO lo que el sistema cree que quiso decir), el TONO original (si es agresivo, no suavizarlo), la PROFUNDIDAD real (si es superficial, resumen breve), la CANTIDAD de información disponible (no inventar detalles).",
          "DETECCIÓN DE IRONÍA/SARCASMO: Indicadores: elogio excesivo fuera de contexto, contradicción entre tono y contenido, comillas no literales. Si se detecta ironía → clasificar como 'editorial' e incluir nota: '[ironía detectada]'.",
          "NO RELLENAR: Si el texto menciona 'un proyecto de ley' sin especificar cuál, registrar: 'proyecto de ley no especificado'. NO inferir basándose en conocimiento general.",
          "TITULAR vs. CONTENIDO: Si difieren significativamente, clasificar según el CONTENIDO y agregar observación: 'El titular difiere del contenido de la nota'."
        ]
      },
      {
        numero: 4,
        nombre: "Pluralismo Informativo",
        definicion: "Reconocimiento de que la realidad institucional tiene múltiples voces legítimas y que el silencio mediático sobre una perspectiva puede ser tan informativo como su presencia. El sistema no privilegia una línea editorial sobre otra por su orientación política.",
        que_es: [
          "Una mención de un medio comunitario de El Alto tiene el mismo peso que una de un medio nacional de La Paz, en su contexto relevante",
          "Si un evento es cubierto por 5 medios y 4 son de la misma línea editorial, el sistema NOTA el desbalance como dato analítico",
          "El sistema detecta cuando una perspectiva institucional está ausente en la cobertura y lo registra",
          "La ausencia de cobertura de un evento que debería ser cubierto es un dato, no un vacío"
        ],
        que_no_es: [
          "No es obligar a que cada nota tenga 'todas las voces' — es notar cuando un evento significativo tiene cobertura unilateral",
          "No es tratar una fuente sin credibilidad como equivalente a una fuente seria — es distinguir por rigor periodístico, no por ideología",
          "No es 'balance artificial' — si un evento solo tiene una versión documentada, se presenta sin inventar contraparte"
        ],
        errores_llm: [
          "El LLM tiende a privilegiar fuentes 'conocidas' por su entrenamiento (NYT, BBC) sobre fuentes locales",
          "El LLM asume que si solo hay una versión, debe haber otra 'equilibrante'",
          "El LLM descarta medios pequeños porque no los conoce bien"
        ],
        reglas_operativas: [
          "IGUALDAD DE VOCES: Todas las fuentes registradas en el sistema tienen el mismo peso. Un medio comunitario con 500 lectores puede aportar perspectiva que uno nacional con 500,000 no tiene.",
          "DESBALANCE COMO DATO: Si la cobertura de un evento proviene exclusivamente de medios de una misma línea editorial, registrar: 'Cobertura unilateral: no se encontró perspectiva desde [otras líneas editoriales]'.",
          "SILENCIO INFORMATIVO: Si un evento relevante NO aparece en medios que normalmente lo cubrirían, el desbalance es notable en los reportes.",
          "LÍNEA EDITORIAL ≠ CREDIBILIDAD: La credibilidad se mide por rigor periodístico (fuentes citadas, datos verificados, profundidad), no por orientación política."
        ]
      },
      {
        numero: 5,
        nombre: "Contexto Institucional Boliviano",
        definicion: "Comprensión de las estructuras políticas, legislativas, sociales y culturales específicas del Estado Plurinacional de Bolivia, que determinan cómo se produce y se consume información institucional.",
        que_es: [
          "Entender que Bolivia tiene un Estado Plurinacional con estructuras únicas (naciones indígenas, autonomías, jurisdicciones especiales)",
          "Diferenciar entre Órgano Legislativo (ALP con dos cámaras), Ejecutivo, Judicial, Electoral",
          "Conocer que los periodos legislativos tienen calendarios específicos",
          "Entender el contexto bilingüe/multilingüe"
        ],
        que_no_es: [
          "No es tomar posición política sobre la estructura del Estado",
          "No es sustituir al usuario en su conocimiento del contexto",
          "No es documentar cada detalle institucional — es asegurar que las clasificaciones no fallen por ignorancia"
        ],
        errores_llm: [
          "El LLM aplica marcos estadounidenses: 'senador' en Bolivia ≠ 'senador' en EE.UU.",
          "El LLM no conoce las particularidades del Estado Plurinacional",
          "El LLM confunde instituciones bolivianas con las de otros países"
        ],
        reglas_operativas: [
          "ESTADO PLURINACIONAL DE BOLIVIA — Datos de referencia: Órgano Legislativo (ALP: Cámara de Diputados 130 miembros, Cámara de Senadores 36 miembros). Órgano Ejecutivo (Presidente, Vicepresidente, Ministerios). Órgano Electoral (TSE). Órgano Judicial (TSJ). Control (Fiscalía, Contraloría, Defensoría). 9 Gobiernos Departamentales, 339 Municipales. Partidos vigentes: MAS-IPSP, CC, CREEMOS, otros.",
          "Proceso legislativo: Iniciativa → Comisión → Pleno → Cámara revisora → Sanción → Promulgación.",
          "Si el sistema no está seguro de un dato institucional específico, lo declara en lugar de adivinar."
        ]
      },
      {
        numero: 6,
        nombre: "Independencia Analítica",
        definicion: "El sistema produce resultados que reflejan la realidad mediática documentada, sin ajustar, suavizar ni orientar los hallazgos según los intereses del cliente. El cliente recibe inteligencia, no validación.",
        que_es: [
          "Si 8 de 10 menciones de un legislador afín al cliente tienen tratamiento crítico, el reporte lo muestra tal cual",
          "Los ejes temáticos se definen por relevancia institucional, no por la agenda del cliente",
          "El sistema no produce 'análisis favorable' ni 'análisis desfavorable' — produce análisis objetivo",
          "Ejes personalizados por cliente se etiquetan claramente como tales"
        ],
        que_no_es: [
          "No es ser 'anti-cliente' — es ser honesto con el cliente",
          "No es ignorar las preferencias del cliente — es no dejar que contaminen el análisis",
          "No es producir análisis genérico 'sin opinión' — es producir análisis fundado en evidencia"
        ],
        errores_llm: [
          "Si el usuario expresó simpatía por un actor político, el LLM tiende a suavizar las menciones negativas de ese actor",
          "El LLM tiende a producir resultados que 'agraden' al usuario",
          "El LLM evita conclusiones incómodas"
        ],
        reglas_operativas: [
          "LOS DATOS MANDAN: Si la realidad mediática es desfavorable para un actor institucional, reportar TAL CUAL. No suavizar, no redondear, no contextualizar para 'mitigar'.",
          "CLIENTE ≠ SESGO: La identidad y preferencias del cliente NO influyen en la clasificación. El sistema analiza el texto fuente, no la conveniencia del resultado.",
          "DISTINCIÓN CLARA EN EJES: Ejes INSTITUCIONALES son definidos por relevancia legislativa/general y son neutrales (aplican a TODOS los clientes). Ejes PERSONALIZADOS son definidos por el cliente según su contrato y se etiquetan como 'cliente: [nombre]'. En reportes se presentan separados para mantener transparencia."
        ]
      },
      {
        numero: 7,
        nombre: "Ética del Dato",
        definicion: "El sistema solo procesa información públicamente disponible en medios de comunicación establecidos. No extrae datos personales de ciudadanos no públicos, no genera perfiles psicológicos, y excluye información sensible que no sea estrictamente relevante para la función pública del actor monitoreado.",
        que_es: [
          "Solo se procesa contenido publicado por medios de comunicación (online, impreso, radio, TV)",
          "Los actores monitoreados son personas con función pública (legisladores, autoridades, candidatos)",
          "Si una nota incluye datos sensibles NO relevantes para la función pública → se excluyen del resumen",
          "El sistema no construye perfiles de personalidad, carácter ni conducta privada"
        ],
        que_no_es: [
          "No es censurar información — es filtrar datos sensibles irrelevantes",
          "No es proteger a actores públicos de escrutinio — es evitar la explotación de datos privados",
          "No es una decisión política — es un estándar ético"
        ],
        errores_llm: [
          "El LLM no distingue entre función pública y vida privada automáticamente",
          "El LLM tiende a incluir toda información disponible sin filtrar"
        ],
        reglas_operativas: [
          "FUENTES PERMITIDAS: Solo medios de comunicación registrados (periódicos, portales, radios, canales de TV con línea editorial identificable). NO: redes sociales personales, blogs anónimos, foros, WhatsApp, TikTok.",
          "ACTORES MONITOREABLES: Personas con función pública vigente o reciente. NO: familiares, amigos, colaboradores privados sin función pública.",
          "DATOS SENSIBLES: Salud, vida familiar/afectiva, orientación religiosa/sexual, situación económica personal. Si NO relevantes para función pública → excluir del resumen y agregar nota: '[datos sensibles excluidos por criterio ético]'. Si SÍ relevantes (ej: ministro usa experiencia personal como argumento en política pública) → se incluyen.",
          "PERSONAS PRIVADAS: El sistema NO ofrece 'monitoreo de personas'. Una persona sin función pública solo aparece cuando participa en evento institucional (declaración formal, comparecencia, cargo, rol gremial). Su aparición es casual (surge del monitoreo temático), nunca es el objetivo. Si un cliente solicita monitoreo de persona privada, ofrecer monitoreo del TEMA o SECTOR relacionado.",
          "NO PERFILES: El sistema NO genera ni infiere perfiles psicológicos, evaluaciones de carácter, ni diagnósticos de comportamiento."
        ]
      },
      {
        numero: 8,
        nombre: "Enfoque Analítico-Institucional (No Mercadológico)",
        definicion: "El sistema utiliza técnicas de análisis de información (contenido, agenda, actores, cobertura, contexto) para producir inteligencia sobre el entorno institucional. No utiliza técnicas de mercadotecnia (share of voice, brand sentiment, engagement, reach) porque miden cosas distintas para fines distintos.",
        que_es: [
          "Análisis de contenido: qué se dice, cómo se dice, con qué fuentes, con qué profundidad",
          "Análisis de agenda: qué temas ocupan la atención mediática, cuáles desaparecen, cuáles emergen",
          "Análisis de actores: qué posiciones documentadas toman los actores institucionales",
          "Análisis de cobertura: profundidad, diversidad editorial, trayectoria temporal",
          "Análisis de contexto: marco institucional aplicable, antecedentes, proceso legislativo"
        ],
        que_no_es: [
          "No es medir 'share of voice' — es analizar qué dice cuando aparece",
          "No es calcular 'sentimiento de marca' — es clasificar el tratamiento periodístico",
          "No es rastrear 'reach' o 'impresiones' — es evaluar profundidad y diversidad de cobertura",
          "No es hacer 'competitive intelligence' comercial — es hacer inteligencia del entorno institucional"
        ],
        errores_llm: [
          "El LLM tiende a producir métricas tipo 'el 60% fue positivo' porque su entrenamiento viene del mundo comercial",
          "El LLM usa terminología de mercadotecnia espontáneamente (reach, engagement, buzz)",
          "El LLM produce 'recomendaciones' tipo 'se sugiere mejorar la comunicación'",
          "El LLM convierte análisis cualitativo en porcentajes como si fuera dashboard de marketing"
        ],
        reglas_operativas: [
          "TERMINOLOGÍA OBLIGATORIA: 'tratamiento periodístico' (NO 'sentimiento'), 'cobertura' (NO 'reach'), 'profundidad de análisis' (NO 'engagement'), 'diversidad de fuentes' (NO 'share of voice'), 'dinámica de agenda' (NO 'trending topic'), 'inteligencia institucional' (NO 'insights'), 'evento mediático' (NO 'mención viral'), 'relevancia institucional' (NO 'relevancia comercial'), 'actor institucional' (NO 'stakeholder'), 'hallazgo' (NO 'lead'), 'indicador de análisis' (NO 'KPI').",
          "TERMINOLOGÍA PROHIBIDA: share of voice, brand sentiment, reach, impressions, engagement, NPS, brand awareness, posicionamiento, buzz, viral, insights, actionable intelligence, competitive intelligence, stakeholder, lead, KPI.",
          "MÉTRICAS INSTITUCIONALES: Número de medios que cubrieron el evento. Distribución por tipo de tratamiento periodístico. Diversidad de líneas editoriales. Evolución de la cobertura en el tiempo. Actores institucionales mencionados y sus posiciones. Ejes temáticos y su dinámica. NO: Porcentaje favorable/desfavorable. NO: Número estimado de lectores/audiencia. NO: Ranking de 'más mencionados' sin contexto cualitativo."
        ]
      },
      {
        numero: 9,
        nombre: "Rigor Periodístico (Preguntas Fundamentales de la Nota)",
        definicion: "Toda mención procesada por el sistema debe intentar responder las preguntas fundamentales del periodismo (qué, quién, cuándo, cómo, por qué, para qué, a quiénes afecta, dónde) en la medida que el texto fuente lo permita.",
        que_es: [
          "QUÉ: El evento principal de la nota. Si hay múltiples eventos, distinguir el más relevante.",
          "QUIÉN: Actores individuales (legisladores, ministros), colectivos (bancadas, partidos, gremios) e implícitos ('el gobierno', 'la oposición'). Distinguir: quien declara, quien es mencionado, quien es afectado.",
          "CUÁNDO: Fecha exacta o referencia temporal. Contexto: ¿evento actual o antecedente?",
          "CÓMO: El mecanismo, canal (sesión plenaria, entrevista, conferencia) y tono.",
          "POR QUÉ: Causas inmediatas declaradas, antecedentes proporcionados por el medio. Si no están: 'Causas no especificadas'.",
          "PARA QUÉ: Intención del actor (objetivo declarado o inferible con evidencia). Intención del medio (informativa, editorial, etc.). Si no se puede determinar: 'Intención no explícita'.",
          "A QUIÉNES AFECTA: Afectados directos, indirectos y potenciales. Distinguir entre mencionados en texto e inferidos por contexto.",
          "DÓNDE: Contexto geográfico e institucional. Nivel: nacional, departamental, municipal, internacional."
        ],
        que_no_es: [
          "No es forzar respuestas cuando el texto no las contiene — es declarar 'no especificado'",
          "No es adivinar intenciones del actor sin evidencia — es declarar la confianza",
          "No es producir un artículo periodístico — es extraer las respuestas que el texto provee",
          "No es inventar contexto geográfico o temporal que no está en la fuente"
        ],
        errores_llm: [
          "El LLM tiende a responder TODAS las preguntas incluso cuando el texto no tiene suficiente información",
          "El LLM confunde 'por qué' (causa) con 'para qué' (intención)",
          "El LLM inventa afectados que no están mencionados en el texto",
          "El LLM asigna intención sin suficiente evidencia"
        ],
        reglas_operativas: [
          "Si el texto no responde una pregunta → registrar 'No especificado en la fuente'. NUNCA inventar.",
          "POR QUÉ vs. PARA QUÉ: 'Por qué' = causas (algo pasó porque...). 'Para qué' = intención (alguien hizo algo con el objetivo de...). Son diferentes y no se confunden.",
          "AFECTADOS: Distinguir entre afectados MENCIONADOS en el texto e INFERIDOS por contexto. Los inferidos siempre llevan la marca 'inferido'.",
          "CONFIANZA POR PREGUNTA: Cada pregunta puede tener su propio nivel de confianza (alto/medio/bajo) según cuánta evidencia tenga en el texto.",
          "ESTRUCTURA JSON de salida: { que: String, quien: { declara: String?, afectado_directo: String?, mencionados: String[] }, cuando: String?, como: String?, por_que: String?, para_que: { actor: String?, medio: String?, confianza: String }, a_quienes_afecta: { directos: String[], indirectos: String[], potenciales: String[], mencionados_en_texto: Boolean }, donde: String? }"
        ]
      }
    ]
  };

  const contextoInstitucional = {
    estructura_estado: {
      organo_legislativo: {
        nombre: "Asamblea Legislativa Plurinacional",
        camaras: ["Cámara de Diputados (130 miembros)", "Cámara de Senadores (36 miembros)"],
        proceso_legislativo: "Iniciativa → Comisión → Pleno → Cámara revisora → Sanción → Promulgación"
      },
      organo_ejecutivo: {
        nombre: "Órgano Ejecutivo",
        cabezas: ["Presidente", "Vicepresidente"],
        estructura: "Ministerios y Viceministerios"
      },
      organo_electoral: ["Tribunal Supremo Electoral", "Órgano Electoral Plurinacional"],
      organo_judicial: ["Tribunal Supremo de Justicia", "Tribunales Departamentales"],
      organos_control: ["Fiscalía General del Estado", "Contraloría General del Estado", "Defensoría del Pueblo"],
      gobiernos_subnacionales: ["9 Gobiernos Departamentales", "339 Gobiernos Municipales", "Gobiernos Autónomos Indígena Originario Campesinos"]
    },
    partidos_vigentes: ["MAS-IPSP", "Comunidad Ciudadana", "CREEMOS"],
    periodo_legislativo: "2020-2025"
  };

  const escalaTratamiento = {
    categorias: [
      { codigo: "tratamiento_informativo", nombre: "Informativo", definicion: "Cobertura factual, sin carga valorativa. El medio reporta hechos sin tomar posición." },
      { codigo: "tratamiento_analitico", nombre: "Analítico", definicion: "Incluye contexto, antecedentes, múltiples fuentes. El medio profundiza más allá del hecho." },
      { codigo: "tratamiento_critico", nombre: "Crítico", definicion: "Cuestionamiento fundamentado, investigación. El medio cuestiona con evidencia." },
      { codigo: "tratamiento_editorial", nombre: "Editorializante", definicion: "Opinión del medio, toma de posición explícita." },
      { codigo: "tratamiento_agresivo", nombre: "Agresivo", definicion: "Ataque personal, descalificación, titilarización sin fundamento." },
      { codigo: "tratamiento_elogioso", nombre: "Elogioso", definicion: "Reconocimiento, perfil positivo, destacado deliberado." },
      { codigo: "tratamiento_ambiguo", nombre: "Ambiguo", definicion: "No se puede determinar el tratamiento. Texto insuficiente, cita fuera de contexto." },
      { codigo: "tratamiento_agregado", nombre: "Agregado (deduplicado)", definicion: "Cobertura adicional de un evento ya registrado por otro medio. El tratamiento se hereda de la mención original o se clasifica de forma independiente si aporta ángulo distinto." },
      { codigo: "sin_tratamiento", nombre: "Sin clasificar", definicion: "No aplica o no hay suficiente información para clasificar." }
    ]
  };

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
  };

  const terminologiaPermitida = {
    obligatoria: {
      "sentimiento": "tratamiento periodístico",
      "reach": "cobertura",
      "engagement": "profundidad de análisis",
      "share of voice": "diversidad de fuentes",
      "trending topic": "dinámica de agenda",
      "insights": "inteligencia institucional",
      "mención viral": "evento mediático",
      "relevancia comercial": "relevancia institucional",
      "stakeholder": "actor institucional",
      "lead": "hallazgo",
      "KPI": "indicador de análisis"
    }
  };

  const terminologiaProhibida = {
    terminos: [
      "share of voice", "brand sentiment", "reach", "impressions", "engagement",
      "NPS", "brand awareness", "posicionamiento", "buzz", "viral",
      "insights", "actionable intelligence", "competitive intelligence",
      "stakeholder", "lead", "KPI"
    ]
  };

  const exclusionesEtica = {
    datos_sensibles: ["salud", "vida familiar/afectiva", "orientación religiosa", "orientación sexual", "situación económica personal"],
    fuentes_no_permitidas: ["redes sociales personales", "WhatsApp", "Telegram", "foros anónimos", "blogs sin línea editorial", "filtraciones no verificadas"],
    no_monitoreables: ["familiares de actores públicos", "amigos", "colaboradores privados sin función pública"]
  };

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
  };

  const marco = await prisma.marcoConceptual.create({
    data: {
      version: 1,
      activa: true,
      principios,
      contextoInstitucional,
      lineasEditoriales: {
        descripcion: "Clasificación de líneas editoriales de medios bolivianos. El sistema identifica la orientación predominante de cada medio para contextualizar el tratamiento periodístico.",
        categorias: [
          { codigo: "oficialista", nombre: "Oficialista / Pro-gobierno", definicion: "Cobertura favorable o alineada con el gobierno de turno.", criterios_identificacion: ["Titulares positivos hacia gobierno", "Fuentes gubernamentales como vocería principal", "Columnistas afines al partido de gobierno"] },
          { codigo: "opositor", nombre: "Opositor / Crítica al gobierno", definicion: "Cobertura predominantemente crítica al gobierno de turno.", criterios_identificacion: ["Titulares críticos hacia gobierno", "Denuncias e investigaciones como sello editorial", "Fuentes opositoras y sociedad civil"] },
          { codigo: "independiente", nombre: "Independiente / Plural", definicion: "Equilibrio en cobertura con múltiples perspectivas.", criterios_identificacion: ["Variedad de fuentes", "Investigación propia sin orientación política", "Correcciones públicas"] },
          { codigo: "institucional", nombre: "Institucional / Especializada", definicion: "Cobertura sectorial sin orientación partidaria. Foco en datos.", criterios_identificacion: ["Cobertura focalizada en un sector", "Lenguaje técnico con datos", "Fuentes institucionales"] },
          { codigo: "popular", nombre: "Popular / Sensacionalista", definicion: "Noticias policiales, espectaculares y de impacto emocional.", criterios_identificacion: ["Titulares de impacto emocional", "Cobertura política superficial", "Notas policiales y espectáculo"] },
          { codigo: "comunitaria", nombre: "Comunitaria / Alternativa", definicion: "Cobertura local, indígena, campesina o social.", criterios_identificacion: ["Cobertura local/departamental", "Voces de organizaciones sociales", "Temas de territorio y recursos"] }
        ],
        notas: ["La línea editorial se evalúa por NOTA individual, no por medio completo.", "La clasificación NO implica juicio de valor.", "Si no se puede determinar → clasificar como 'no determinada' (NO adivinar)."]
      },
      ejesInstitucionales: {
        descripcion: "Los 12 Ejes Temáticos Institucionales son universales, neutrales y aplican a TODOS los productos del sistema (gratuitos y pagos). Definidos por relevancia legislativa/general. Los ejes PERSONALIZADOS por cliente van en EjeTematicoCliente (tabla separada).",
        ejes: [
          { orden: 1, slug: 'hidrocarburos-energia', nombre: 'Hidrocarburos, Energía y Combustible', keywords: 'gas,petróleo,YPFB,litio,electricidad,subsidio,gasolina,diésel,hidrocarburo,regalías,Ley de Hidrocarburos' },
          { orden: 2, slug: 'movimientos-sociales', nombre: 'Movimientos Sociales y Conflictividad', keywords: 'bloqueo,marcha,paro,protesta,COB,CSUTCB,CSCB,CONAMAQ,FNMCB,conflicto,movilización,transportistas,magisterio' },
          { orden: 3, slug: 'gobierno-oposicion', nombre: 'Gobierno, Oposición e Instituciones', keywords: 'Asamblea,diputado,senador,ley,banca,bloque,partido,elección,gobierno,oposición,presidente,ministro' },
          { orden: 4, slug: 'corrupcion-impunidad', nombre: 'Corrupción e Impunidad', keywords: 'corrupción,denuncia,auditoría,Fondo Indígena,irregularidad,desvío,Fiscalía,nepotismo,comisión de verdad,YPFB' },
          { orden: 5, slug: 'economia', nombre: 'Economía y Política Económica', keywords: 'inflación,tipo de cambio,dólar,PIB,exportación,importación,reservas,empresa estatal,presupuesto,empleo' },
          { orden: 6, slug: 'justicia-derechos', nombre: 'Justicia y Derechos Humanos', keywords: 'justicia,Fiscalía,Tribunal,sentencia,detención,derechos humanos,preso,judicialización,delito,policía' },
          { orden: 7, slug: 'procesos-electorales', nombre: 'Procesos Electorales', keywords: 'elección,TSE,OEP,observación,urnas,voto,candidato,comicio,electoral,escrutinio' },
          { orden: 8, slug: 'educacion-cultura', nombre: 'Educación, Universidades y Cultura', keywords: 'educación,universidad,magisterio,presupuesto,estudiantes,strike,escuela,colegio,cultura,patrimonio' },
          { orden: 9, slug: 'salud-servicios', nombre: 'Salud y Servicios Públicos', keywords: 'salud,hospital,medicamentos,Seguro,COVID,médicos,enfermeros,sistema de salud' },
          { orden: 10, slug: 'medio-ambiente', nombre: 'Medio Ambiente, Territorio y Recursos', keywords: 'medio ambiente,agua,incendios,autonomías,minería,deforestación,territorio,concesión,litio,Pachamama' },
          { orden: 11, slug: 'relaciones-internacionales', nombre: 'Relaciones Internacionales', keywords: 'relaciones,frontera,migración,embajada,cooperación,tratado,diplomacia,EEUU,Chile,Unión Europea' },
          { orden: 12, slug: 'mineria', nombre: 'Minería y Metales Estratégicos', keywords: 'minería,minero,cooperativa minera,COMIBOL,Huanuni,Colquiri,San Cristóbal,San Bartolomé,estano,zinc,plata,plomo,oro,YLB,litio,salar,carbonato de litio,metales críticos,antimonio,DLE,relaves,pasivo ambiental,regalías mineras,concesión minera,SENARECOM' },
        ],
        subclasificaciones: 35,
        dimensiones: ['produccion', 'precio', 'conflicto', 'regulacion', 'infraestructura'],
      },
      escalaTratamiento,
      reglasDesambiguacion: {
        descripcion: "Reglas para resolver ambigüedades en nombres, entidades, eventos y siglas.",
        reglas: [
          { tipo: "nombres_personas", nombre: "Desambiguación de Nombres", contexto: "Bolivia tiene apellidos muy comunes (Mamani, Quispe, Choque, Condori, Flores, Pérez).", reglas: ["Apellido común SIN cargo/institución → NO vincular a persona del sistema", "Verificar cargo + departamento + partido", "Si hay ambigüedad → marcar 'nombre ambiguo'"] },
          { tipo: "siglas_instituciones", nombre: "Desambiguación de Siglas", contexto: "Múltiples instituciones con siglas similares.", reglas: ["ALP = Asamblea Legislativa Plurinacional", "YPFB = Yacimientos Petrolíferos Fiscales Bolivianos", "TSE = Tribunal Supremo Electoral", "MAS = Movimiento al Socialismo", "COB = Central Obrera Boliviana", "Sigla no reconocida → 'sigla no identificada'"] },
          { tipo: "eventos_temporales", nombre: "Eventos y Fechas", contexto: "Eventos recurrentes pueden confundirse entre años.", reglas: ["Verificar período legislativo actual", "Protestas: ¿evento actual o referencia histórica?", "Proyectos de ley: ¿en trámite o antecedente?"] },
          { tipo: "geograficos", nombre: "Geográfica", contexto: "Ciudades con nombres compartidos entre departamentos.", reglas: ["Inferir por actores mencionados", "Ambigüedad → 'ubicación ambigua'", "Frontera: registrar departamento y país"] },
          { tipo: "medios", nombre: "Medios de Comunicación", contexto: "Nombres genéricos de medios.", reglas: ["El Diario = periódico de La Paz", "La Razón = periódico de La Paz", "El Pueblo = periódico de Sucre", "Medio no registrado → 'medio no monitoreado'"] }
        ],
        principio_general: "Ante la duda, NO asignar. Es preferible marcar como 'ambiguo' que asignar incorrectamente."
      },
      criteriosRelevancia,
      exclusionesEtica,
      terminologiaPermitida,
      terminologiaProhibida,
      preguntasFundamentales: {
        descripcion: "Las preguntas fundamentales del periodismo institucional que el sistema debe responder para cada mención. Basado en el Principio 9 (Rigor Periodístico).",
        preguntas: [
          { codigo: "que", nombre: "Qué", definicion: "El evento principal de la nota.", reglas: ["Distinguir evento principal de secundarios", "Tipo: anuncio, denuncia, debate, resolución judicial"] },
          { codigo: "quien", nombre: "Quién", definicion: "Actores: quien declara, quien es mencionado, quien es afectado.", reglas: ["Distinguir 'quien declara' vs 'quien es mencionado'", "Colectivos: gobierno, oposición, bancadas, gremios", "Registrar cargo institucional"] },
          { codigo: "cuando", nombre: "Cuándo", definicion: "Fecha exacta o referencia temporal.", reglas: ["Fecha publicación ≠ fecha evento", "Eventos de larga duración: registrar inicio y continuidad"] },
          { codigo: "como", nombre: "Cómo", definicion: "Mecanismo, canal y tono del evento.", reglas: ["Canal: sesión, entrevista, conferencia, comunicado", "Tono: formal, agresivo, conciliador, evasivo"] },
          { codigo: "por_que", nombre: "Por Qué", definicion: "Causas inmediatas. Causas (algo pasó porque...).", reglas: ["Registrar causas DECLARADAS, no inferidas", "NO confundir con 'para qué' (intención)", "Sin causas → 'No especificadas en la fuente'"] },
          { codigo: "para_que", nombre: "Para Qué", definicion: "Intención declarada o inferible. Intención (objetivo de...).", reglas: ["Intención del actor + intención del medio", "Inferidas llevan marca '[inferido]'", "Mayor riesgo de sesgo del LLM → confianza explícita"] },
          { codigo: "a_quienes_afecta", nombre: "A Quiénes Afecta", definicion: "Personas o instituciones impactadas.", reglas: ["Directos, indirectos, potenciales", "Inferidos siempre con marca '[inferido]'", "Incluir nivel: nacional/departamental/municipal"] },
          { codigo: "donde", nombre: "Dónde", definicion: "Contexto geográfico e institucional.", reglas: ["Nivel: nacional, departamental, municipal, internacional, virtual", "Fronteras: departamento + país vecino"] }
        ],
        principio_general: "Si el texto no responde una pregunta → 'No especificado en la fuente'. NUNCA inventar.",
        estructura_json: { que: "String", quien: { declara: "String?", afectado_directo: "String?", mencionados: "String[]" }, cuando: "String?", como: "String?", por_que: "String?", para_que: { actor: "String?", medio: "String?", confianza: "String" }, a_quienes_afecta: { directos: "String[]", indirectos: "String[]", potenciales: "String[]", mencionados_en_texto: "Boolean" }, donde: "String?" }
      },
      parametros,
      creadoPor: "sistema",
    },
  });

  console.log(`Marco Conceptual v${marco.version} creado exitosamente (id: ${marco.id})`);
}

main()
  .catch((e) => {
    console.error("Error en seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
