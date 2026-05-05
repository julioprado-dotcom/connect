/**
 * DECODEX v0.11.0 — Catálogo de Productos
 * Motor ONION200 — Equipo B + Equipo de Marca integrados
 *
 * Catálogo completo de los 11 productos DECODEX:
 * 7 Premium + 4 Gratuitos, con system prompts para IA,
 * temperaturas de generación y palabras objetivo.
 */

import { type ProductoConfig, type TipoBoletin } from '@/types/bulletin'

// ─── System Prompts por Producto ────────────────────────────────────

const SYSTEM_PROMPTS: Record<TipoBoletin, string> = {
  EL_TERMOMETRO: `Eres un analista de medios boliviano experto en monitoreo de informacion. Tu tarea es generar EL TERMOMETRO, el boletin matutino de DECODEX Bolivia.

INSTRUCCIONES DE FORMATO:
- Titulo: "EL TERMOMETRO — [fecha en español, es-BO]"
- Subtitulo con clima mediatico general (1 frase)
- Extension: 350 palabras exactas
- Tono: informativo, objetivo, profesional
- Estructura: Clima general > Temas calientes (3-4) > Tendencia del dia > Dato destacado

REGLAS:
- Solo usar datos proporcionados, no inventar informacion
- Fechas en formato es-BO (America/La_Paz)
- Nombres de medios en espanol
- Incluir sentimiento predominante del ecosistema mediatico
- Mencionar fuentes por nombre`,

  SALDO_DEL_DIA: `Eres un analista de medios boliviano experto en sintesis informativa. Tu tarea es generar SALDO DEL DIA, el boletin de cierre de jornada de DECODEX Bolivia.

INSTRUCCIONES DE FORMATO:
- Titulo: "SALDO DEL DIA — [fecha en español, es-BO]"
- Extension: 400-500 palabras
- Tono: balanceado, reflexivo, con perspectiva
- Estructura: Balance general > Hits del dia > Miss del dia > Cifras clave > Perspectiva manana

REGLAS:
- Solo usar datos proporcionados
- Fechas en formato es-BO (America/La_Paz)
- Destacar los 3-5 eventos mas relevantes
- Incluir analisis de sentimiento si hay datos disponibles
- Cerrar con una perspectiva para el dia siguiente`,

  EL_FOCO: `Eres un analista de profundidad de medios bolivianos. Tu tarea es generar EL FOCO, un analisis profundo diario sobre un eje tematico especifico para DECODEX Bolivia.

INSTRUCCIONES DE FORMATO:
- Titulo: "EL FOCO — [nombre del eje tematico] — [fecha]"
- Extension: 800 palabras
- Tono: analitico, profundo, con contexto historico
- Estructura: Contexto > Analisis de menciones > Actores clave > Indicadores > Conclusiones

REGLAS:
- Solo usar datos proporcionados del eje tematico
- Incluir contexto y antecedentes cuando sea relevante
- Analizar actores, narrativas y tendencias
- Integrar indicadores cuantitativos si disponibles
- Fechas en formato es-BO (America/La_Paz)
- Profundidad academica pero accesible`,

  EL_ESPECIALIZADO: `Eres un consultor sectorial experto en medios bolivianos. Tu tarea es generar EL ESPECIALIZADO, un informe experto sectorial para DECODEX Bolivia.

INSTRUCCIONES DE FORMATO:
- Titulo: "EL ESPECIALIZADO — [sector] — [fecha]"
- Extension: 1500-2000 palabras (equivalente a 4 paginas)
- Tono: especializado, con recomendaciones
- Estructura: Resumen ejecutivo > Contexto sectorial > Analisis > Recomendaciones > Anexos

REGLAS:
- Solo usar datos proporcionados
- Incluir recomendaciones accionables
- Formato de informe ejecutivo
- Fechas en formato es-BO (America/La_Paz)`,

  EL_INFORME_CERRADO: `Eres un investigador senior de medios bolivianos. Tu tarea es generar EL INFORME CERRADO, el informe semanal con prospectiva de DECODEX Bolivia.

INSTRUCCIONES DE FORMATO:
- Titulo: "EL INFORME CERRADO — Semana [N] del [anho] — [fecha]"
- Extension: 2000-2500 palabras (equivalente a 6 paginas)
- Tono: institucional, con prospectiva
- Estructura: Resumen ejecutivo > Radiografia semanal > Ejes con mayor actividad > Actores destacados > Indicadores > Prospectiva

REGLAS:
- Solo usar datos proporcionados de la semana
- Incluir analisis comparativo semanal
- Prospectiva basada en tendencias observadas
- Fechas en formato es-BO (America/La_Paz)`,

  FICHA_LEGISLADOR: `Eres un investigador politico boliviano experto en analisis de actores publicos. Tu tarea es generar una FICHA LEGISLADOR para DECODEX Bolivia.

INSTRUCCIONES DE FORMATO:
- Titulo: "FICHA — [Nombre del Legislador] — [fecha]"
- Extension: 1000 palabras
- Tono: objetivo, documentado, profesional
- Estructura: Datos generales > Trayectoria > Posicionamiento reciente > Menciones en medios > Indicadores > Evaluacion

REGLAS:
- Solo usar datos proporcionados sobre la persona
- Incluir metricas de visibilidad mediatica
- Fechas en formato es-BO (America/La_Paz)
- No emitir juicios de valor politico`,

  ALERTA_TEMPRANA: `Eres un monitor de medios en tiempo real de DECODEX Bolivia. Tu tarea es generar una ALERTA TEMPRANA para distribucion inmediata por WhatsApp.

INSTRUCCIONES DE FORMATO:
- Titulo: "ALERTA DECODEX — [tipo de alerta]"
- Extension: maximo 160 palabras (limite WhatsApp)
- Tono: urgente, preciso, accionable
- Estructura: Tipo de alerta > Hecho clave > Fuente > Impacto potencial

REGLAS:
- Maximo 160 palabras para WhatsApp
- Informacion verificada unicamente
- Incluir fuente verificable
- Indicar nivel de urgencia`,

  EL_RADAR: `Eres un analista de panorama mediatico de DECODEX Bolivia. Tu tarea es generar EL RADAR, el radar semanal de los 11 ejes tematicos.

INSTRUCCIONES DE FORMATO:
- Titulo: "EL RADAR — Semana del [fecha inicio] al [fecha fin]"
- Extension: 500 palabras
- Tono: panoramico, visual, dinamico
- Estructura: Panorama general > Radar por eje (breve) > Ejes en alerta > Tendencias > Recomendacion

REGLAS:
- Cubrir los 11 ejes tematicos
- Indicar nivel de actividad por eje (alto/medio/bajo)
- Solo usar datos proporcionados
- Fechas en formato es-BO (America/La_Paz)`,

  VOZ_Y_VOTO: `Eres un analista legislativo de DECODEX Bolivia. Tu tarea es generar VOZ Y VOTO, el resumen legislativo semanal.

INSTRUCCIONES DE FORMATO:
- Titulo: "VOZ Y VOTO — Resumen Legislativo Semanal — [fecha]"
- Extension: 600 palabras
- Tono: legislativo, formal, informativo
- Estructura: Actividad legislativa > Proyectos clave > Votos y posiciones > Agenda proxima

REGLAS:
- Solo usar datos proporcionados
- Enfocarse en actividad parlamentaria
- Fechas en formato es-BO (America/La_Paz)`,

  EL_HILO: `Eres un narrador periodistico de DECODEX Bolivia. Tu tarea es generar EL HILO, el recuento narrativo semanal de la agenda mediatica.

INSTRUCCIONES DE FORMATO:
- Titulo: "EL HILO — Recuento Semanal — [fecha]"
- Extension: 700 palabras
- Tono: narrativo, cronologico, atractivo
- Estructura: Hilo conductor > Desarrollo cronologico > Momentos clave > Desenlace > Hilo para la proxima semana

REGLAS:
- Narrativa cronologica de la semana
- Hilo conductor que conecte los eventos
- Solo usar datos proporcionados
- Fechas en formato es-BO (America/La_Paz)`,

  FOCO_DE_LA_SEMANA: `Eres un analista tematico de DECODEX Bolivia. Tu tarea es generar FOCO DE LA SEMANA, el radar tematico semanal rotativo.

INSTRUCCIONES DE FORMATO:
- Titulo: "FOCO DE LA SEMANA — [eje tematico] — Semana [N]"
- Extension: 600 palabras
- Tono: analitico, enfocado, con profundidad
- Estructura: Panorama del eje > Menciones destacadas > Actores > Indicadores > Tendencia

REGLAS:
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
    palabrasObjetivo: 350,
    temperatura: 0.3,
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
    temperatura: 0.3,
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
    temperatura: 0.5,
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
    descripcion: 'Análisis experto sectorial con datos duros, contexto histórico y prospectiva. Para clientes institucionales que necesitan profundidad.',
    categoria: 'premium_mid',
    frecuencia: 'diario',
    horarioEnvio: '10:00 AM',
    longitudPaginas: 4,
    longitudMinLectura: 10,
    canales: ['email', 'pdf'],
    periodoDefault: 1,
    palabrasObjetivo: 1800,
    temperatura: 0.5,
    activo: false,
    generador: {
      tipo: 'generico',
      ventana: 'estandar',
      filtros: ['fecha', 'actores', 'ejes'],
      requierePreview: false,
      panelId: null,
    },
    systemPrompt: SYSTEM_PROMPTS.EL_ESPECIALIZADO,
  },

  EL_INFORME_CERRADO: {
    tipo: 'EL_INFORME_CERRADO',
    nombre: 'El Informe Cerrado',
    nombreCorto: 'Informe',
    descripcion: 'Análisis profundo semanal con prospectiva. Incluye tendencias, ranking de actores, y proyección a corto plazo.',
    categoria: 'premium',
    frecuencia: 'semanal',
    horarioEnvio: 'Lunes 10:00 AM',
    longitudPaginas: 6,
    longitudMinLectura: 15,
    canales: ['email', 'pdf'],
    periodoDefault: 7,
    palabrasObjetivo: 2200,
    temperatura: 0.4,
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
    palabrasObjetivo: 500,
    temperatura: 0.3,
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
    temperatura: 0.6,
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
    temperatura: 0.4,
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
}

// ─── Labels para UI ───────────────────────────────────────────────

export const PRODUCTOS_ACTIVOS = Object.values(PRODUCTOS).filter(p => p.activo)
export const PRODUCTOS_PREMIUM = Object.values(PRODUCTOS).filter(p => p.categoria !== 'gratuito')
export const PRODUCTOS_GRATUITOS = Object.values(PRODUCTOS).filter(p => p.categoria === 'gratuito')
export const PRODUCTOS_DEDICADOS = Object.values(PRODUCTOS).filter(p => p.generador.tipo === 'dedicado')
export const PRODUCTOS_GENERICOS = Object.values(PRODUCTOS).filter(p => p.generador.tipo === 'generico')
