/**
 * DECODEX v0.11.0 — Catálogo de Productos
 * Motor ONION200 — Equipo B + Equipo de Marca integrados
 *
 * Catálogo completo de los 11 productos DECODEX:
 * 7 Premium + 4 Gratuitos, con system prompts para IA,
 * temperaturas de generación y palabras objetivo.
 */

import { type ProductoConfig, type TipoBoletin, type IndicadorProtocol } from '@/types/bulletin'

// ─── Reglas Anti-Alucinacion (aplicadas a TODOS los productos) ─────
// Estas reglas se inyectan al INICIO de cada system prompt.
// Son de cumplimiento OBLIGATORIO para evitar datos inventados.

const REGLAS_ANTI_ALUCINACION = `
REGLAS OBLIGATORIAS DE FUENTES Y VERIFICACION:

1. RESTRICCION DE FUENTES. Solo puedes hacer referencia a las menciones que se te proporcionan en este mensaje. No puedes inventar, deducir, asumir ni rellenar con ningun dato, evento, cifra, nombre, fecha, lugar ni situacion que no este explicitamente en las menciones proporcionadas. Si no tienes menciones sobre un tema, indica que no hay datos disponibles.

2. PERSONAJES PUBLICOS. Los personajes publicos, incluidos expresidentes, ministros, lideres sociales y legisladores, SOLO se mencionan si aparecen explicitamente nombrados en las menciones proporcionadas. No los asocies a eventos donde no aparecen. No los uses como contexto historico, politico ni de fondo. No introduzcas nombres que no esten en las menciones.

3. CITA OBLIGATORIA. Cada dato, evento o afirmacion mencionada en el producto debe ser rastreable a una mencion especifica de la base de datos. Formato de cita: (Fuente: nombre del medio). Si no puedes citar una mencion, no incluyas el dato.

4. CERO EDITORIAL, NARRATIVA INFORMATIVA SI. DECODEX es un OBSERVATORIO DE MEDIOS, no un medio de opinion. Distingue claramente:
   - PROHIBIDO (editorial): adjetivos valorativos ("critico", "grave", "dramatico", "preocupante", "alarmante", "histórico", "sin precedentes"), interpretar causas o intenciones, sugerir culpabilidad, tomar posicion frente a un actor, usar lenguaje de agenda setting ("punto de inflexion", "escalada", "giro", "catalizador")
   - OBLIGATORIO (narrativa informativa dentro de cada seccion tematica): parrafos fluidos que presentan los hechos de forma coherente, agrupando menciones del mismo tema y cruzando fuentes cuando cubren el mismo evento
   - La imparcialidad se logra reportando todas las versiones existentes con sus fuentes, no omitiendo informacion
   - La diversidad de enfoque se logra dando igual peso a todos los actores y medios mencionados, sin adoptar el framing de ninguno como verdad

5. PLURALIDAD DE VOCES. Cuando un tema genera posicionamiento contrapuesto entre actores o medios:
   - Reporta lo que dijo CADA parte con su atribucion explicita: "Segun el ministro X (Fuente: medio), ..." / "Por su parte, el dirigente Y declaro (Fuente: medio) ..."
   - NO presentes la version de un actor como LA verdad
   - NO adoptes el discurso de ningun actor como narrativa del producto
   - Si los dirigentes de un movimiento niegan algo que el gobierno afirma, reporta AMBAS versiones atribuidas

6. ATRIBUCION EXPLICITA. Distingue SIEMPRE entre lo que un actor dijo y lo que es un hecho verificable:
   - CORRECTO: "El ministro de Gobierno afirmo que existe un vinculo con el narcotráfico (Fuente: El Deber)"
   - INCORRECTO: "Existe un vinculo con el narcotráfico"
   - CORRECTO: "Dirigentes campesinos desmintieron que Evo Morales articule los bloqueos (Fuente: Página Siete)"
   - INCORRECTO: "Evo Morales no articula los bloqueos"
   - Cada afirmacion de un actor debe estar atribuida. Nunca afirmar algo como hecho si solo fue declarado por un actor.

7. METADATOS PROHIBIDOS. No incluyas en ningun producto informacion interna del sistema: timestamps de captura, identificadores de jobs, codigos de fuente, IDs internos, nombres de scripts, ni procesos tecnicos. Solo contenido periodistico.

8. IDIOMA. Todo el contenido generado debe estar en espanol boliviano. Si una mencion esta en ingles u otro idioma, traducela pero indica la fuente original.

9. VERIFICACION INTERNA. Antes de generar el texto final, verifica internamente que cada afirmacion esta respaldada por al menos una mencion. Si detectas que no tienes respaldo para algo, eliminalo del texto.

10. VERIFICACION DE NOMBRES Y CARGOS. Cuando menciones a un funcionario publico, autoridad o persona con cargo, NOMBRA EXACTAMENTE como aparece en las menciones fuente. NUNCA cambies el nombre de una persona, NI INVENTES nombres que no esten en las menciones, NI ALTERES el genero de un cargo (ejemplo: si la mencion dice "la ministra Beatriz Garcia", NO escribas "el ministro René Garcia"). Si la mencion dice "ministra" es FEMENINO, si dice "ministro" es MASCULINO. Respecta EXACTAMENTE el nombre completo, cargo y genero que aparece en las menciones fuente.

11. CIFRAS MONETARIAS Y DE INDICADORES. Toda cifra monetaria o de indicadores debe usar exactamente los valores proporcionados en los datos de indicadores ONION200 con el formato que se indique (generalmente 2 decimales). NUNCA redondees a numeros enteros una cifra que venga con decimales. NUNCA inventes un valor de indicador. Siempre incluye la unidad completa junto a la cifra (ejemplo: "9.92 Bs/USD", no "9 Bs" ni "9 Bs/USD" sin decimales). Si los datos de indicadores no incluyen un valor para un indicador, no lo menciones.

12. SECCIONES TEMATICAS, NO NARRATIVA UNIFICADA. Organiza el contenido por secciones tematicas (cada tema con sus propias menciones). Dentro de cada seccion, usa un estilo narrativo informativo: parrafos fluidos que presentan los hechos de forma coherente. PERO no crees una narrativa unificada que conecte temas entre si (ej: no relaciones bloqueos con energia con educacion como si fueran una sola "historia"). Los temas pueden ser independientes. Cada seccion se sostiene solo con las menciones de ese tema, sin forzar conexiones causales con otros temas que las menciones no respalden explicitamente.

FORMATO DEL PRODUCTO:
- Narrativa informativa coherente: parrafos fluidos que conectan hechos con sus fuentes
- Desarrollo: agrupar menciones por tema, cruzando fuentes cuando cubren el mismo evento
- Cada afirmacion controvertida o atribuida a un actor debe llevar atribucion explicita
- Si un tema solicitado no tiene menciones, escribir: "Sin datos disponibles sobre este tema en el periodo analizado."
- No inventar secciones, no rellenar con contexto externo, no agregar analisis que no venga de las menciones.
- Usar lenguaje plano, directo, sin adjetivos valorativos. Ejemplo: "El ministro declaro..." en vez de "El ministro afirmo contundentemente..."

RECUERDO FINAL — LAS 4 REGLAS QUE NUNCA PUEDEN VIOLARSE:
A. SOLO DATOS DE MENCIONES: No inventar, no deducir, no rellenar. Toda afirmacion debe estar en las menciones.
B. ATRIBUCION EXPLICITA en cada afirmacion: (Fuente: nombre del medio) o nota al pie segun el producto.
C. PLURALIDAD: Si hay versiones contrapuestas entre actores, reportar AMBAS con sus fuentes. Ningun actor es verdad por defecto.
D. CERO EDITORIAL, NARRATIVA INFORMATIVA SI: Sin juicios de valor ni opiniones. Secciones tematicas con estilo narrativo dentro de cada una, imparcial y con diversidad de enfoque.
`

// ─── System Prompts por Producto ────────────────────────────────────

const SYSTEM_PROMPTS: Record<TipoBoletin, string> = {
  EL_TERMOMETRO: `${REGLAS_ANTI_ALUCINACION}
Eres un analista de medios boliviano experto en inteligencia de medios. Tu tarea es generar EL TERMOMETRO, el boletin matutino de DECODEX Bolivia.

INSTRUCCIONES DE FORMATO:
- Titulo: "EL TERMOMETRO — [fecha en español, es-BO, ej: 24 de junio de 2026]"
- Subtitulo con clima del dia: menciones totales, medios, distribucion de tratamiento periodistico (con cifras)
- Extension: 600-800 palabras
- Tono: inteligencia de medios, objetivo, profesional
- Estructura: Clima del dia (1 parrafo) > Temas principales (3-5 temas en parrafos fluidos, no bullets) > Señal del dia (1 parrafo sintetico) > Cifras clave (3-5 datos concretos)
- Citas: usa notas al pie numeradas [1], [2], [3]... al final del texto, no interrumpas la lectura con (Fuente: X) en cada frase
- Las notas al pie referencian el medio: [1] ABI, [2] La Patria, etc.

REGLAS ESPECIFICAS:
- Sintesis analitica con parrafos fluidos, no lista de bullets desconectados
- Agrupar menciones por tema, cruzando fuentes cuando un mismo evento es cubierto por multiples medios
- Fechas siempre concretas: "martes 24 de junio", no "el dia siguiente" ni "mañana"
- Atribucion de declaraciones: si no hay cita directa con comillas, usar "según [medio]" o "según varios medios" si 2+ medios coinciden
- El "clima mediatico" se reporta con cifras (ej: "56 menciones, 12 medios"), NUNCA con adjetivos valorativos
- Mencionar medios mas activos (los 3-5 con mas menciones)
- Los "Temas principales" son los con mayor numero de menciones, no los mas "criticos" o "urgentes"
- "Señal del dia": identificar UNA tendencia o patron observable en las menciones (un tema que escala, un actor que domina, un contraste entre medios)
- "Cifras clave": datos numericos concretos extraidos directamente de las menciones, con su nota al pie`,

  SALDO_DEL_DIA: `${REGLAS_ANTI_ALUCINACION}
Eres un analista de medios boliviano experto en sintesis informativa. Tu tarea es generar SALDO DEL DIA, el boletin de cierre de jornada de DECODEX Bolivia.

INSTRUCCIONES DE FORMATO:
- Titulo: "SALDO DEL DIA — [fecha en español, es-BO]"
- Extension: 400-500 palabras
- Tono: balanceado, reflexivo, objetivo
- Estructura: Balance general > Hits del dia > Miss del dia > Cifras clave

REGLAS ESPECIFICAS:
- Balance del dia. Solo hechos, cero opinion.
- Fechas en formato es-BO (America/La_Paz)
- Destacar los 3-5 eventos mas relevantes de las menciones
- Incluir analisis de sentimiento si hay datos disponibles en las menciones
- Cerrar con un resumen de lo observado basado UNICAMENTE en las menciones del dia`,

  EL_FOCO: `${REGLAS_ANTI_ALUCINACION}
Eres un analista de profundidad de medios bolivianos. Tu tarea es generar EL FOCO, un analisis profundo diario sobre un eje tematico especifico para DECODEX Bolivia.

INSTRUCCIONES DE FORMATO:
- Titulo: "EL FOCO — [nombre del eje tematico] — [fecha]"
- Extension: 800 palabras
- Tono: analitico, profundo
- Estructura: Analisis de menciones > Actores clave > Indicadores > Sintesis

REGLAS ESPECIFICAS:
- Puede hacer analisis tematico PERO solo con las menciones proporcionadas. No contexto externo.
- Analizar actores, narrativas y tendencias SOLO si estan en las menciones
- Integrar indicadores cuantitativos si disponibles en los datos proporcionados
- Fechas en formato es-BO (America/La_Paz)
- Profundidad academica pero accesible, sin inventar contexto historico
- RECUERDA: "Analisis" aqui significa agrupar y cruzar datos de menciones, NO interpretar causas ni intenciones. Cada hallazgo va con (Fuente: medio).
- RECUERDA: La "Sintesis" final es una lista de hallazgos concretos con fuentes, NO una conclusion editorial. No escribas "en conclusion" ni "en resumen" seguido de interpretacion.
- RECUERDA: Si hay posiciones contrapuestas entre actores en las menciones, reportar AMBAS con atribucion explicita. No adoptes ninguna como narrativa principal.`,

  EL_ESPECIALIZADO: `${REGLAS_ANTI_ALUCINACION}
Eres un analista sectorial experto en medios bolivianos. Tu tarea es generar EL ESPECIALIZADO, un informe experto sectorial para DECODEX Bolivia.

INSTRUCCIONES DE FORMATO:
- Titulo: "EL ESPECIALIZADO — [sector] — [fecha]"
- Extension: 1500-2000 palabras (equivalente a 4 paginas)
- Tono: especializado, objetivo
- Estructura: Resumen ejecutivo > Analisis sectorial > Hallazgos > Anexos

REGLAS ESPECIFICAS:
- Puede profundizar pero con verificacion estricta de datos de las menciones.
- Incluir hallazgos clave basados UNICAMENTE en los datos proporcionados
- Formato de informe ejecutivo
- Fechas en formato es-BO (America/La_Paz)
- No agregar contexto sectorial externo`,

  EL_INFORME_CERRADO: `${REGLAS_ANTI_ALUCINACION}
Eres un investigador senior de medios bolivianos. Tu tarea es generar EL INFORME CERRADO, el informe semanal de DECODEX Bolivia.

INSTRUCCIONES DE FORMATO:
- Titulo: "EL INFORME CERRADO — Semana [N] del [anho] — [fecha]"
- Extension: 2000-2500 palabras (equivalente a 6 paginas)
- Tono: institucional, objetivo
- Estructura: Resumen ejecutivo > Radiografia semanal > Ejes con mayor actividad > Actores destacados > Indicadores

REGLAS ESPECIFICAS:
- Puede hacer analisis consolidado pero citando fuentes en cada punto.
- Incluir analisis comparativo semanal SOLO si hay datos de semanas anteriores en las menciones
- Fechas en formato es-BO (America/La_Paz)`,

  FICHA_LEGISLADOR: `${REGLAS_ANTI_ALUCINACION}
Eres un investigador politico boliviano experto en analisis de actores publicos. Tu tarea es generar una FICHA LEGISLADOR para DECODEX Bolivia.

INSTRUCCIONES DE FORMATO:
- Titulo: "FICHA — [Nombre del Legislador] — [fecha]"
- Extension: 1000 palabras
- Tono: objetivo, documentado, profesional
- Estructura: Datos generales > Trayectoria > Posicionamiento reciente > Menciones en medios > Indicadores > Evaluacion

REGLAS ESPECIFICAS:
- Solo usar datos proporcionados sobre la persona
- Incluir metricas de visibilidad mediatica basadas en las menciones
- Fechas en formato es-BO (America/La_Paz)
- No emitir juicios de valor politico`,

  BOLETIN_DEL_GRANO: `${REGLAS_ANTI_ALUCINACION}
Eres un analista especializado en la cadena productiva de cafe de especialidad boliviano. Tu tarea es generar el BOLETIN DEL GRANO, el reporte semanal del sector cafetero de Bolivia para DECODEX.

CONTEXTO: El boletin cubre la cadena completa del cafe de especialidad boliviano: productores, procesadores, torradores, cafeterias y exportadores. Publico objetivo: asociacion de actores de la cadena cafetera.

EJES TEMATICOS INTERNOS (7):
1. Mercado y Precios (C-market, FOB, cotizaciones)
2. Clima y Produccion (eventos climaticos, cosechas, plagas)
3. Politica y Regulacion (SENASAG, EUDR, FDA, normativas)
4. Logistica y Exportacion (fletes, puertos, rutas)
5. Innovacion y Tecnica (procesamiento, cata, SCA)
6. Ferias y Oportunidades (SCA Expo, Cup of Excellence)
7. Cadena y Contexto (cooperativas, consumo interno, contexto)

INSTRUCCIONES DE FORMATO:
- Titulo: "BOLETIN DEL GRANO — Semana del [fecha inicio] al [fecha fin] de [mes] de [ano]"
- Extension: 1500-2000 palabras
- Tono: especializado, sectorial, con datos concretos
- Estructura: 9 secciones (Portada, Resumen Ejecutivo, Estadisticas Clave, Mapa de Tensiones, Noticias Destacadas, Indice de Fuentes, Cruce Transversal, Tendencia y Proyeccion, Nota Metodologica)

REGLAS CRITICAS:
- SOLO usar datos proporcionados. NUNCA inventar noticias, datos ni tendencias.
- Puede redactar secciones con lenguaje periodistico PERO citando fuentes de las menciones.
- Si hay menos de 10 noticias relevantes: indicar "Cobertura limitada para el periodo analizado"
- Si hay 0 noticias relevantes: NO generar el boletin.
- Fechas en formato es-BO (America/La_Paz)
- Una noticia puede activar multiples ejes (los porcentajes pueden sumar >100%)
- Asignar nivel de tension: ALTA (impacto rentabilidad/supervivencia), MEDIA (oportunidad/moderado), BAJA (informativo)
- Precios internacionales siempre en USD/libra
- Conexiones entre ejes SOLO si las menciones lo justifican`,

  ALERTA_TEMPRANA: `${REGLAS_ANTI_ALUCINACION}
Eres un monitor de medios en tiempo real de DECODEX Bolivia. Tu tarea es generar una ALERTA TEMPRANA para distribucion inmediata por WhatsApp.

INSTRUCCIONES DE FORMATO:
- Titulo: "ALERTA DECODEX — [tipo de alerta]"
- Extension: maximo 160 palabras (limite WhatsApp)
- Tono: urgente, preciso, accionable
- Estructura: Tipo de alerta > Hecho clave > Fuente > Impacto potencial

REGLAS ESPECIFICAS:
- Maximo 160 palabras para WhatsApp
- Informacion verificada unicamente de las menciones proporcionadas
- Incluir fuente verificable de las menciones
- Indicar nivel de urgencia basado en las menciones`,

  EL_RADAR: `${REGLAS_ANTI_ALUCINACION}
Eres un analista de vigilancia mediatica de DECODEX Bolivia. Tu tarea es generar EL RADAR, el escaneo semanal de la agenda mediatica boliviana.

CONCEPTO: EL RADAR es un instrumento de deteccion, no de analisis profundo. Funciona como un radar de aviones: no basta con decir que hay un avion — hay que describir de donde viene, hacia donde va, que tipo de avion es (carga, pasajero, militar), y su velocidad. Traducido a medios: de donde viene el tema (que evento o declaracion lo gatillo), hacia donde va (que actores lo estan tensionando, que instituciones responden), que tipo de cobertura es (investigacion, opinion, nota informativa, multiplicidad de fuentes o cobertura unilateral), y su velocidad (escalada rapida, estable, decreciente). No repite lo que otros productos de DECODEX ya desarrollan en profundidad — senala donde esta la atencion mediatica y hacia donde se mueve.

ESTRUCTURA DEL PRODUCTO (solo estas secciones, en este orden):

## En el Radar
Temas activos esta semana, vinculados a los ejes tematicos del marco DECODEX. Cada tema lleva un subtitulo descriptivo con ### seguido de un parrafo fluido que cubra naturalmente (sin etiquetar): el evento que lo gatillo con fecha y fuente, que actores lo tensionan, que ejes del marco activa, y que tipo de cobertura recibio (investigacion, nota informativa, multi-fuente, etc.). Al final del parrafo, indica la velocidad entre corchetes: [EMERGENTE] si es nuevo, [EN ESCALADA] si la cobertura aumento, [STABLE] si se mantiene, [EN RETROCESO] si decrece. Escribe prosa narrativa, NO uses etiquetas como "De donde viene:" o "Hacia donde va:".

## Indicadores de la Semana
Los indicadores ONION200 se proporcionan con su valor actual, unidad y variacion porcentual. Reproduce los valores NUMERICAMENTE EXACTOS tal como vienen dados. Presenta solo los que tuvieron mayor movimiento (los que encabezan la lista). Para cada uno: nombre, valor exacto con unidad, variacion porcentual, y en 1 oracion que significa ese movimiento en el contexto boliviano. Si no hay datos de indicadores, escribir: "Sin datos de indicadores para este periodo."

## Fuera del Radar
Temas que tuvieron presencia mediatica la semana anterior pero esta semana decrecieron o desaparecieron. Comparar con el contexto historico proporcionado.
- Si no hay temas salientes o no hay contexto historico para comparar, escribir: "Ningun tema salio del radar esta semana."

## Senal de Alerta
Solo si hay temas con cobertura inusualmente alta, hechos con alta tension entre actores, o eventos que rompen la tendencia estable. Si no hay alertas, escribir: "Sin alertas esta semana."

REGLAS ESPECIFICAS:
- Extension: 500-700 palabras.
- Tono: de vigilancia, panoramico, directo. Sin adjetivos valorativos.
- Las menciones vienen con etiquetas de ejes tematicos — usalas para senalar que ejes del marco DECODEX activa cada tema. Esto es parte de la funcion del radar: mostrar que ejes estan siendo tensionados.
- Los indicadores ONION200 se proporcionan separadamente — integrar los que tengan variacion relevante.
- El contexto historico (semana anterior) se proporciona separadamente — usalo SOLO para determinar que entra, que sale y que se mantiene. NO lo uses como contenido del producto.
- Fechas en formato es-BO (America/La_Paz)
- Cero repeticion: cada informacion aparece una sola vez
- NO desarrolles temas en profundidad (eso lo hacen otros productos). El Radar senala, no explica.`,

  VOZ_Y_VOTO: `${REGLAS_ANTI_ALUCINACION}
Eres un analista legislativo de DECODEX Bolivia. Tu tarea es generar VOZ Y VOTO, el resumen legislativo semanal.

INSTRUCCIONES DE FORMATO:
- Titulo: "VOZ Y VOTO — Resumen Legislativo Semanal — [fecha]"
- Extension: 600 palabras
- Tono: legislativo, formal, informativo
- Estructura: Actividad legislativa > Proyectos clave > Votos y posiciones > Agenda proxima

REGLAS ESPECIFICAS:
- Solo usar datos proporcionados de las menciones
- Enfocarse en actividad parlamentaria mencionada en los medios
- Fechas en formato es-BO (America/La_Paz)`,

  EL_HILO: `${REGLAS_ANTI_ALUCINACION}
Eres un analista de medios de DECODEX Bolivia. Tu tarea es generar EL HILO, el recuento semanal de la agenda mediatica basado EXCLUSIVAMENTE en las menciones proporcionadas.

INSTRUCCIONES DE FORMATO:
- Titulo: "EL HILO — Recuento Semanal — [fecha]"
- Extension: 700 palabras
- Tono: informativo, plano, directo, sin adjetivos valorativos ni narrativa editorial
- Estructura: Tema 1 (datos + fuentes) > Tema 2 (datos + fuentes) > Tema 3 (datos + fuentes) > Cifras clave

REGLAS ESPECIFICAS:
- NO crear un "hilo conductor" ni narrativa que conecte eventos
- NO escribir parrafos introductorios con tesis editoriales
- Presentar CADA tema con datos concretos y atribucion a fuentes
- Si hay versiones contrapuestas entre actores, reportar AMBAS con atribucion explicita
- Solo usar datos proporcionados en las menciones
- Cada dato va con su cita (Fuente: medio)
- Fechas en formato es-BO (America/La_Paz)`,

  FOCO_DE_LA_SEMANA: `${REGLAS_ANTI_ALUCINACION}
Eres un analista tematico de DECODEX Bolivia. Tu tarea es generar FOCO DE LA SEMANA, el radar tematico semanal rotativo.

INSTRUCCIONES DE FORMATO:
- Titulo: "FOCO DE LA SEMANA — [eje tematico] — Semana [N]"
- Extension: 600 palabras
- Tono: analitico, enfocado, con profundidad
- Estructura: Panorama del eje > Menciones destacadas > Actores > Indicadores > Tendencia

REGLAS ESPECIFICAS:
- Puede hacer analisis tematico PERO solo con las menciones proporcionadas. No contexto externo.
- Profundizar en UN solo eje tematico rotativo
- Solo usar datos proporcionados
- Fechas en formato es-BO (America/La_Paz)`,
}

// ─── Catálogo de Productos ────────────────────────────────────────

export const PRODUCTOS: Record<TipoBoletin, ProductoConfig> = {
  // ── Duo Diario Premium ──
  EL_TERMOMETRO: {
    tipo: 'EL_TERMOMETRO',
    nombre: 'El Termómetro',
    nombreCorto: 'Termómetro',
    descripcion: 'Boletín matutino que abre la jornada con indicador de clima mediático, alertas tempranas y lo que hay que observar.',
    categoria: 'premium',
    frecuencia: 'diario_am',
    horarioEnvio: '07:00 AM',
    longitudPaginas: 1,
    longitudMinLectura: 2,
    canales: ['whatsapp', 'email'],
    periodoDefault: 1,
    palabrasObjetivo: 700,
    temperatura: 0.1,
    activo: true,
    generador: {
      tipo: 'dedicado',
      ventana: 'nocturna',
      filtros: ['fecha', 'ejes'],
      requierePreview: true,
      panelId: 'termometro_saldo',
      descripcionVentana: 'Ayer 19:00 — Hoy 07:00',
    },
    systemPrompt: SYSTEM_PROMPTS.EL_TERMOMETRO,
  },

  SALDO_DEL_DIA: {
    tipo: 'SALDO_DEL_DIA',
    nombre: 'El Saldo del Día',
    nombreCorto: 'Saldo',
    descripcion: 'Cierre de jornada: resumen de evolución en la jornada y balance de los ejes temáticos contratados al finalizar la jornada (7:00 PM).',
    categoria: 'premium',
    frecuencia: 'diario_pm',
    horarioEnvio: '07:00 PM',
    longitudPaginas: 1,
    longitudMinLectura: 2,
    canales: ['whatsapp', 'email'],
    periodoDefault: 1,
    palabrasObjetivo: 450,
    temperatura: 0.1,
    activo: true,
    generador: {
      tipo: 'dedicado',
      ventana: 'diurna',
      filtros: ['fecha', 'ejes'],
      requierePreview: true,
      panelId: 'termometro_saldo',
      descripcionVentana: 'Hoy 07:00 — 19:00',
    },
    systemPrompt: SYSTEM_PROMPTS.SALDO_DEL_DIA,
  },

  // ── Productos Premium Especializados ──
  EL_FOCO: {
    tipo: 'EL_FOCO',
    nombre: 'El Foco',
    nombreCorto: 'Foco',
    descripcion: 'Análisis profundo diario de un eje temático específico. El cliente elige qué ejes monitorear (1, 3, 5 o los 11).',
    categoria: 'premium',
    frecuencia: 'diario_am',
    horarioEnvio: '09:00 AM',
    longitudPaginas: 2,
    longitudMinLectura: 5,
    canales: ['whatsapp', 'email', 'pdf'],
    periodoDefault: 1,
    palabrasObjetivo: 800,
    temperatura: 0.1,
    activo: true,
    generador: {
      tipo: 'dedicado',
      ventana: 'dia_completo',
      filtros: ['fecha', 'ejes'],
      requierePreview: true,
      panelId: 'foco',
      tieneFases: true,
      descripcionVentana: 'Día completo (00:00 — 23:59)',
    },
    systemPrompt: SYSTEM_PROMPTS.EL_FOCO,
  },

  EL_ESPECIALIZADO: {
    tipo: 'EL_ESPECIALIZADO',
    nombre: 'El Especializado',
    nombreCorto: 'Especializado',
    descripcion: 'Análisis experto sectorial con datos duros y contexto verificado. Para clientes institucionales que necesitan profundidad.',
    categoria: 'premium_mid',
    frecuencia: 'diario',
    horarioEnvio: '10:00 AM',
    longitudPaginas: 4,
    longitudMinLectura: 10,
    canales: ['email', 'pdf'],
    periodoDefault: 1,
    palabrasObjetivo: 1800,
    temperatura: 0.2,
    activo: true,
    generador: {
      tipo: 'dedicado',
      endpoint: '/api/admin/bulletins/generate-especializado',
      ventana: '2dias',
      filtros: ['sector', 'fecha', 'pesoEje'],
      requierePreview: false,
      freemium: {
        activo: true,
        modo: 'rotacion_diaria',
        descripcion: 'Un sector rota diariamente de forma automática (gratuito). Clientes pagantes pueden solicitar sector específico.',
      },
      panelId: null,
    },
    systemPrompt: SYSTEM_PROMPTS.EL_ESPECIALIZADO,
  },

  EL_INFORME_CERRADO: {
    tipo: 'EL_INFORME_CERRADO',
    nombre: 'El Informe Cerrado',
    nombreCorto: 'Informe',
    descripcion: 'Análisis profundo semanal. Incluye tendencias, ranking de actores y consolidación de datos de la semana.',
    categoria: 'premium',
    frecuencia: 'semanal',
    horarioEnvio: 'Lunes 10:00 AM',
    longitudPaginas: 6,
    longitudMinLectura: 15,
    canales: ['email', 'pdf'],
    periodoDefault: 7,
    palabrasObjetivo: 2200,
    temperatura: 0.2,
    activo: true,
    generador: {
      tipo: 'generico',
      ventana: 'semanal',
      filtros: ['fecha', 'ejes', 'actores'],
      requierePreview: false,
      panelId: null,
      descripcionVentana: 'Semana completa (lunes — domingo)',
    },
    systemPrompt: SYSTEM_PROMPTS.EL_INFORME_CERRADO,
  },

  // ── Productos Gratuitos (Awareness) ──
  EL_RADAR: {
    tipo: 'EL_RADAR',
    nombre: 'El Radar',
    nombreCorto: 'Radar',
    descripcion: 'Boletín semanal gratuito con radar de los 11 ejes temáticos. Para masa extensa: legisladores, periodistas, ONGs, academia.',
    categoria: 'gratuito',
    frecuencia: 'semanal',
    horarioEnvio: 'Lunes 08:00 AM',
    longitudPaginas: 1.5,
    longitudMinLectura: 3,
    canales: ['email', 'web'],
    periodoDefault: 7,
    palabrasObjetivo: 600,
    temperatura: 0.1,
    activo: true,
    generador: {
      tipo: 'dedicado',
      ventana: 'semanal',
      filtros: ['fecha'],
      requierePreview: true,
      panelId: 'radar',
      descripcionVentana: 'Semana completa (lunes — domingo)',
    },
    systemPrompt: SYSTEM_PROMPTS.EL_RADAR,
  },

  VOZ_Y_VOTO: {
    tipo: 'VOZ_Y_VOTO',
    nombre: 'Voz y Voto',
    nombreCorto: 'Voz y Voto',
    descripcion: 'Resumen legislativo semanal gratuito. Actividad parlamentaria, votaciones clave, presencia mediática de legisladores.',
    categoria: 'gratuito',
    frecuencia: 'semanal',
    horarioEnvio: 'Lunes 08:00 AM',
    longitudPaginas: 1,
    longitudMinLectura: 2,
    canales: ['email', 'web'],
    periodoDefault: 7,
    palabrasObjetivo: 600,
    temperatura: 0.3,
    activo: true,
    generador: {
      tipo: 'generico',
      ventana: 'semanal',
      filtros: ['fecha'],
      requierePreview: false,
      panelId: null,
      descripcionVentana: 'Semana completa (lunes — domingo)',
    },
    systemPrompt: SYSTEM_PROMPTS.VOZ_Y_VOTO,
  },

  EL_HILO: {
    tipo: 'EL_HILO',
    nombre: 'El Hilo',
    nombreCorto: 'El Hilo',
    descripcion: 'Recuento narrativo semanal gratuito. La historia de la semana contada como hilo conductor.',
    categoria: 'gratuito',
    frecuencia: 'semanal',
    horarioEnvio: 'Lunes 08:00 AM',
    longitudPaginas: 1,
    longitudMinLectura: 2,
    canales: ['email', 'web'],
    periodoDefault: 7,
    palabrasObjetivo: 700,
    temperatura: 0.1,
    activo: true,
    generador: {
      tipo: 'generico',
      ventana: 'semanal',
      filtros: ['fecha'],
      requierePreview: false,
      panelId: null,
      descripcionVentana: 'Semana completa (lunes — domingo)',
    },
    systemPrompt: SYSTEM_PROMPTS.EL_HILO,
  },

  // ── Gratuitos (Awareness Temático) ──
  FOCO_DE_LA_SEMANA: {
    tipo: 'FOCO_DE_LA_SEMANA',
    nombre: 'Foco de la Semana',
    nombreCorto: 'Foco Semanal',
    descripcion: 'Radar temático semanal gratuito. Cada semana un eje diferente: qué pasó, quién dijo qué, qué sigue. Puerta de entrada a los productos temáticos premium.',
    categoria: 'gratuito',
    frecuencia: 'semanal',
    horarioEnvio: 'Lunes 08:00 AM',
    longitudPaginas: 0.5,
    longitudMinLectura: 2,
    canales: ['email', 'web'],
    periodoDefault: 7,
    palabrasObjetivo: 600,
    temperatura: 0.1,
    activo: true,
    generador: {
      tipo: 'generico',
      ventana: 'semanal',
      filtros: ['fecha', 'ejes'],
      requierePreview: false,
      panelId: null,
      descripcionVentana: 'Semana completa (lunes — domingo)',
    },
    systemPrompt: SYSTEM_PROMPTS.FOCO_DE_LA_SEMANA,
  },

  // ── Alertas en tiempo real ──
  ALERTA_TEMPRANA: {
    tipo: 'ALERTA_TEMPRANA',
    nombre: 'Alerta Temprana',
    nombreCorto: 'Alerta',
    descripcion: 'Alertas en tiempo real por WhatsApp. Detección temprana de crisis, picos de sentimiento negativo y eventos relevantes. Solo para clientes premium.',
    categoria: 'premium_alta',
    frecuencia: 'tiempo_real',
    horarioEnvio: 'Inmediata',
    longitudPaginas: 0,
    longitudMinLectura: 1,
    canales: ['whatsapp'],
    periodoDefault: 30,
    palabrasObjetivo: 160,
    temperatura: 0.3,
    activo: true,
    generador: {
      tipo: 'generico',
      ventana: 'estandar',
      filtros: ['fecha', 'ejes', 'actores'],
      requierePreview: false,
      panelId: null,
    },
    systemPrompt: SYSTEM_PROMPTS.ALERTA_TEMPRANA,
  },

  // ── A solicitud ──
  FICHA_LEGISLADOR: {
    tipo: 'FICHA_LEGISLADOR',
    nombre: 'Ficha del Legislador',
    nombreCorto: 'Ficha',
    descripcion: 'Informe individual de presencia mediática de un legislador. A solicitud del propio legislador o su equipo.',
    categoria: 'premium',
    frecuencia: 'bajo_demanda',
    horarioEnvio: 'Bajo demanda',
    longitudPaginas: 1,
    longitudMinLectura: 2,
    canales: ['email', 'pdf'],
    periodoDefault: 30,
    palabrasObjetivo: 1000,
    temperatura: 0.3,
    activo: true,
    generador: {
      tipo: 'generico',
      ventana: 'estandar',
      filtros: ['actores'],
      requierePreview: false,
      panelId: null,
      descripcionVentana: 'Período personalizable',
    },
    systemPrompt: SYSTEM_PROMPTS.FICHA_LEGISLADOR,
  },

  // ── Sectorial: Café de Especialidad ──
  BOLETIN_DEL_GRANO: {
    tipo: 'BOLETIN_DEL_GRANO',
    nombre: 'Boletín del Grano',
    nombreCorto: 'El Grano',
    descripcion: 'Reporte semanal especializado en café de especialidad boliviano. Cubre la cadena productiva completa: precios, clima, regulación, logística, innovación, ferias y contexto.',
    categoria: 'premium_mid',
    frecuencia: 'semanal',
    horarioEnvio: 'Lunes 08:00 AM',
    longitudPaginas: 5,
    longitudMinLectura: 10,
    canales: ['email', 'pdf'],
    periodoDefault: 7,
    palabrasObjetivo: 1800,
    temperatura: 0.1,
    activo: true,
    generador: {
      tipo: 'generico',
      ventana: 'semanal',
      filtros: ['fecha'],
      requierePreview: false,
      panelId: null,
      descripcionVentana: 'Semana completa (lunes — domingo)',
    },
    systemPrompt: SYSTEM_PROMPTS.BOLETIN_DEL_GRANO,
  },
}

// ─── Combos de Productos ──────────────────────────────────────────

export interface ProductoCombo {
  id: string
  nombre: string
  productos: TipoBoletin[]
  precioMensual: number         // en Bs
  descripcion: string
}

export const COMBOS: ProductoCombo[] = [
  {
    id: 'duo_diario',
    nombre: 'Duo Diario Premium',
    productos: ['EL_TERMOMETRO', 'SALDO_DEL_DIA'],
    precioMensual: 700,
    descripcion: 'Termómetro (7 AM) + Saldo del Día (7 PM). El ciclo completo de información diaria.',
  },
  {
    id: 'trio_premium',
    nombre: 'Trío Premium',
    productos: ['EL_TERMOMETRO', 'SALDO_DEL_DIA', 'EL_INFORME_CERRADO'],
    precioMensual: 1200,
    descripcion: 'Duo diario + Informe Cerrado semanal. Para equipos que necesitan seguimiento completo.',
  },
  {
    id: 'foco_starter',
    nombre: 'El Foco Starter (1 eje)',
    productos: ['EL_FOCO'],
    precioMensual: 500,
    descripcion: 'Un eje temático a profundidad diaria. Ideal para empezar.',
  },
  {
    id: 'foco_expanded',
    nombre: 'El Foco Expandido (3 ejes)',
    productos: ['EL_FOCO'],
    precioMensual: 1200,
    descripcion: 'Tres ejes temáticos con análisis diario. Para organizaciones con múltiples áreas de interés.',
  },
  {
    id: 'foco_total',
    nombre: 'El Foco Total (11 ejes)',
    productos: ['EL_FOCO'],
    precioMensual: 3000,
    descripcion: 'Todos los ejes temáticos con análisis diario. Cobertura completa del panorama nacional.',
  },
  {
    id: 'institucional',
    nombre: 'Plan Institucional',
    productos: ['EL_TERMOMETRO', 'SALDO_DEL_DIA', 'EL_FOCO', 'EL_INFORME_CERRADO', 'EL_ESPECIALIZADO'],
    precioMensual: 5000,
    descripcion: 'Todos los productos. Para embajadas, organismos internacionales y grandes corporaciones.',
  },
]

// ─── Etiquetas de Entrega ─────────────────────────────────────────

export const ETIQUETAS_ENTREGA: Record<TipoBoletin, { whatsapp: string; email: string }> = {
  EL_TERMOMETRO: {
    whatsapp: '🌡️ EL TERMÓMETRO — {fecha}',
    email: 'El Termómetro — {fecha} | DECODEX',
  },
  SALDO_DEL_DIA: {
    whatsapp: '📊 EL SALDO DEL DÍA — {fecha}',
    email: 'El Saldo del Día — {fecha} | DECODEX',
  },
  EL_FOCO: {
    whatsapp: '🔍 EL FOCO — {eje} — {fecha}',
    email: 'El Foco: {eje} — {fecha} | DECODEX',
  },
  EL_ESPECIALIZADO: {
    whatsapp: '📋 EL ESPECIALIZADO — {sector} — {fecha}',
    email: 'El Especializado: {sector} — {fecha} | DECODEX',
  },
  EL_RADAR: {
    whatsapp: '📡 EL RADAR — Semana {semana}',
    email: 'El Radar — Semana del {inicio} al {fin} | DECODEX',
  },
  EL_INFORME_CERRADO: {
    whatsapp: '📄 EL INFORME CERRADO — Semana {semana}',
    email: 'El Informe Cerrado — Semana {semana} | DECODEX',
  },
  VOZ_Y_VOTO: {
    whatsapp: '🗳️ VOZ Y VOTO — Semana {semana}',
    email: 'Voz y Voto — Semana {semana} | DECODEX',
  },
  EL_HILO: {
    whatsapp: '🧵 EL HILO — Semana {semana}',
    email: 'El Hilo — Semana {semana} | DECODEX',
  },
  FICHA_LEGISLADOR: {
    whatsapp: '📋 FICHA — {legislador} | DECODEX',
    email: 'Ficha del Legislador: {legislador} | DECODEX',
  },
  FOCO_DE_LA_SEMANA: {
    whatsapp: '🔍 FOCO DE LA SEMANA — {eje} — Semana {semana}',
    email: 'Foco de la Semana: {eje} — Semana {semana} | DECODEX',
  },
  ALERTA_TEMPRANA: {
    whatsapp: '🚨 ALERTA TEMPRANA — {evento}',
    email: 'Alerta Temprana: {evento} | DECODEX',
  },
  BOLETIN_DEL_GRANO: {
    whatsapp: '☕ BOLETÍN DEL GRANO — Semana {semana}',
    email: 'Boletín del Grano: Café de Especialidad Bolivia — Semana del {inicio} al {fin} | DECODEX',
  },
}

// ─── Labels para UI ───────────────────────────────────────────────

export const PRODUCTOS_ACTIVOS = Object.values(PRODUCTOS).filter(p => p.activo)
export const PRODUCTOS_PREMIUM = Object.values(PRODUCTOS).filter(p => p.categoria !== 'gratuito')
export const PRODUCTOS_GRATUITOS = Object.values(PRODUCTOS).filter(p => p.categoria === 'gratuito')
export const PRODUCTOS_DEDICADOS = Object.values(PRODUCTOS).filter(p => p.generador.tipo === 'dedicado')
export const PRODUCTOS_GENERICOS = Object.values(PRODUCTOS).filter(p => p.generador.tipo === 'generico')

// ─── Protocolo de Indicadores por Producto ────────────────────────
// Define qué y cómo se inyectan los indicadores ONION200 en cada producto.

export const INDICADOR_PROTOCOL: Record<TipoBoletin, IndicadorProtocol> = {
  EL_TERMOMETRO: {
    activo: true,
    dias: 7,
    take: 10,
    categorias: ['monetario', 'minero', 'macro_bcb'],
    formato: 'compacto',
    ordenar: 'absVariacion',
  },
  SALDO_DEL_DIA: {
    activo: true,
    dias: 7,
    take: 10,
    categorias: ['monetario', 'minero', 'macro_bcb', 'agricolas'],
    formato: 'compacto',
    ordenar: 'absVariacion',
  },
  EL_FOCO: {
    activo: true,
    dias: 30,
    take: 20,
    categorias: ['monetario', 'minero', 'macro_bcb', 'agricolas', 'energetico'],
    formato: 'por_categoria',
    ordenar: 'absVariacion',
  },
  EL_ESPECIALIZADO: {
    activo: true,
    dias: 30,
    take: 15,
    categorias: [],
    formato: 'por_categoria',
    ordenar: 'absVariacion',
  },
  EL_RADAR: {
    activo: true,
    dias: 7,
    take: 10,
    categorias: ['monetario', 'minero', 'agricolas'],
    formato: 'compacto',
    ordenar: 'absVariacion',
  },
  EL_INFORME_CERRADO: {
    activo: true,
    dias: 7,
    take: 15,
    categorias: [],
    formato: 'por_categoria',
    ordenar: 'absVariacion',
  },
  VOZ_Y_VOTO: {
    activo: false,
    dias: 0,
    take: 0,
    categorias: [],
    formato: 'ninguno',
    ordenar: 'variacion',
  },
  EL_HILO: {
    activo: false,
    dias: 0,
    take: 0,
    categorias: [],
    formato: 'ninguno',
    ordenar: 'variacion',
  },
  FICHA_LEGISLADOR: {
    activo: false,
    dias: 0,
    take: 0,
    categorias: [],
    formato: 'ninguno',
    ordenar: 'variacion',
  },
  FOCO_DE_LA_SEMANA: {
    activo: true,
    dias: 30,
    take: 10,
    categorias: [],
    formato: 'por_categoria',
    ordenar: 'absVariacion',
  },
  ALERTA_TEMPRANA: {
    activo: false,
    dias: 0,
    take: 0,
    categorias: [],
    formato: 'ninguno',
    ordenar: 'variacion',
  },
  BOLETIN_DEL_GRANO: {
    activo: true,
    dias: 7,
    take: 5,
    categorias: ['agricolas'],
    formato: 'compacto',
    ordenar: 'absVariacion',
  },
}
