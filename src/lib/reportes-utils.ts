/**
 * DECODEX v0.8.0 — Utilidades de Reportes
 * Motor ONION200 — Equipo B
 *
 * Registry de funciones de resumen dedicadas por tipo de producto,
 * helpers para construccion de prompts y registro en base de datos.
 *
 * Tambien incluye funciones de calculo para estadisticas de menciones
 * usadas por los endpoints de reportes.
 */

import db from '@/lib/db';
import { type TipoBoletin, type VentanaTipo } from '@/types/bulletin';
import { SENTIMENT_SCORES, sentimentScoreLabel } from '@/constants/colors';
import { boliviaNow, boliviaStartOfDay, boliviaStartOfWeek, boliviaEndOfDay, boliviaDaysAgo, formatFechaBolivia } from '@/lib/date-bolivia';

// Re-exportar para uso por otros módulos
export { formatFechaBolivia } from '@/lib/date-bolivia';
import { getIndicadoresParaEje, getIndicadoresParaEjes, formatearIndicadoresPrompt } from '@/lib/indicadores/injector';

// ─── Nombres legibles por tipo de producto (para identidad) ───
const NOMBRE_PRODUCTO: Record<TipoBoletin, string> = {
  EL_TERMOMETRO: 'El Termómetro',
  SALDO_DEL_DIA: 'El Saldo del Día',
  EL_FOCO: 'El Foco',
  EL_ESPECIALIZADO: 'El Especializado',
  EL_INFORME_CERRADO: 'El Informe Cerrado',
  EL_RADAR: 'El Radar',
  VOZ_Y_VOTO: 'Voz y Voto',
  EL_HILO: 'El Hilo',
  FOCO_DE_LA_SEMANA: 'Foco de la Semana',
  ALERTA_TEMPRANA: 'Alerta Temprana',
  FICHA_LEGISLADOR: 'Ficha del Legislador',
  BOLETIN_DEL_GRANO: 'Boletín del Grano',
};

// ─── Descripción tipo de producto (para identidad Regla 17) ───
const TIPO_PRODUCTO: Record<TipoBoletin, string> = {
  EL_TERMOMETRO: 'boletín matutino de clima mediático',
  SALDO_DEL_DIA: 'boletín de cierre de jornada',
  EL_FOCO: 'análisis profundo diario de un eje temático',
  EL_ESPECIALIZADO: 'informe experto sectorial',
  EL_INFORME_CERRADO: 'informe semanal de tendencias y escenarios prospectivos',
  EL_RADAR: 'escaneo semanal de la agenda mediática',
  VOZ_Y_VOTO: 'resumen semanal de actividad legislativa e institucional',
  EL_HILO: 'recuento semanal temático de la agenda mediática',
  FOCO_DE_LA_SEMANA: 'radar temático semanal rotativo',
  ALERTA_TEMPRANA: 'alerta inmediata de medios',
  FICHA_LEGISLADOR: 'informe de presencia mediática individual de un legislador',
  BOLETIN_DEL_GRANO: 'reporte semanal del sector cafetero boliviano',
};

// ============================================
// Tipos exportados para reportes
// ============================================

/** Mencion con relaciones incluidas (persona, medio, ejesTematicos) */
export interface MencionConRelaciones {
  id: string
  personaId: string | null
  medioId: string
  titulo: string
  texto: string
  url: string
  fechaPublicacion: Date | null
  fechaCaptura: Date
  tipoMencion: string
  sentimiento: string
  temas: string
  reach: number
  verificado: boolean
  fechaCreacion: Date
  enlaceActivo: boolean
  fechaVerificacion: Date | null
  textoCompleto: string
  comentariosCount: number
  comentariosResumen: string
  Persona: {
    id: string
    nombre: string
    camara: string
    departamento: string
    partidoSigla: string
  } | null
  Medio: {
    id: string
    nombre: string
    tipo: string
    nivel: string
  } | null
  MencionTema: {
    EjeTematico: {
      id: string
      nombre: string
      slug: string
      color?: string
    }
  }[]
}

/** Parametros para generar el resumen textual */
export interface ResumenParams {
  tipo: string
  personaNombre?: string | null
  totalMenciones: number
  sentimientoPromedio: number
  clasificadores: ClasificadorItem[]
  topMedios: TopMedioItem[]
  topActores: TopActorItem[] | null
  totalComentarios: number
  sentimientoComentarios: string
  enlacesRotos: number
  mencionesPorNivel: Record<string, number>
  ventanaLabel?: string
  ejesSlugs?: string[]
}

export interface ClasificadorItem {
  slug: string
  nombre: string
  menciones: number
}

export interface TopMedioItem {
  nombre: string
  count: number
  tipo?: string
  nivel?: string
}

export interface TopActorItem {
  nombre: string
  partido: string
  camara: string
  departamento?: string
  count: number
}

// ============================================
// Helpers de fecha y semana
// ============================================

/** Obtiene la semana del año para una fecha (ISO 8601) */
export function getSemanaAnho(fecha?: Date): number {
  const d = fecha ?? new Date();
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

/** Obtiene la fecha/hora actual en la zona horaria de Bolivia */
export function getNowBolivia(): Date {
  const now = new Date()
  const boliviaOffset = -4 * 60 // UTC-4
  const utc = now.getTime() + now.getTimezoneOffset() * 60000
  return new Date(utc + boliviaOffset * 60000)
}

// ============================================
// Calculo de ventana de tiempo
// ============================================

/** Calcula fecha inicio y fin segun el tipo de ventana (Bolivia timezone) */
export function calculateWindow(
  ventana: VentanaTipo,
  fechaStr?: string
): { fechaInicio: Date; fechaFin: Date; ventanaLabel: string } {
  const fechaBase = fechaStr ? new Date(fechaStr + 'T12:00:00') : boliviaNow();
  let fechaFin = new Date(fechaBase);
  let fechaInicio = new Date(fechaBase);

  switch (ventana) {
    case 'nocturna':
      // Ayer 19:00 → hoy 07:00 (Bolivia timezone)
      fechaInicio.setDate(fechaInicio.getDate() - 1);
      const nocturnaBase = boliviaStartOfDay();
      fechaInicio.setTime(nocturnaBase.getTime() + 19 * 60 * 60 * 1000);
      fechaInicio.setDate(fechaInicio.getDate() - 1);
      fechaFin.setTime(nocturnaBase.getTime() + 7 * 60 * 60 * 1000);
      return { fechaInicio, fechaFin, ventanaLabel: `${formatFechaBolivia(fechaInicio)} — ${formatFechaBolivia(fechaFin)}` }

    case 'diurna':
      // Hoy 07:00 → 19:00 (Bolivia timezone)
      {
        const diurnaBase = boliviaStartOfDay();
        fechaInicio.setTime(diurnaBase.getTime() + 7 * 60 * 60 * 1000);
        fechaFin.setTime(diurnaBase.getTime() + 19 * 60 * 60 * 1000);
      }
      return { fechaInicio, fechaFin, ventanaLabel: `${formatFechaBolivia(fechaInicio)} — ${formatFechaBolivia(fechaFin)}` }

    case 'dia_completo':
      // 00:00 → 23:59 del día (Bolivia timezone)
      {
        const diaBase = boliviaStartOfDay();
        fechaInicio.setTime(diaBase.getTime());
        fechaFin.setTime(diaBase.getTime() + 24 * 60 * 60 * 1000 - 1);
      }
      return { fechaInicio, fechaFin, ventanaLabel: formatFechaBolivia(fechaInicio) }

    case 'semanal':
      // Lunes 00:00 → domingo 23:59 (Bolivia timezone)
      {
        const lunesBase = boliviaStartOfWeek();
        fechaInicio.setTime(lunesBase.getTime());
        fechaFin.setTime(lunesBase.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
      }
      return { fechaInicio, fechaFin, ventanaLabel: `${formatFechaBolivia(fechaInicio)} al ${formatFechaBolivia(fechaFin)}` }

    case 'quincenal':
      {
        const quinBase = boliviaDaysAgo(14);
        fechaInicio.setTime(quinBase.getTime());
        fechaFin.setTime(boliviaEndOfDay().getTime());
      }
      return { fechaInicio, fechaFin, ventanaLabel: `${formatFechaBolivia(fechaInicio)} al ${formatFechaBolivia(fechaFin)}` }

    case 'mensual':
      {
        const boNow = boliviaNow();
        fechaInicio = new Date(boNow.getFullYear(), boNow.getMonth() - 1, 1);
        const lastDay = new Date(boNow.getFullYear(), boNow.getMonth(), 0);
        fechaFin = new Date(lastDay.getTime() + 24 * 60 * 60 * 1000 - 1);
      }
      return { fechaInicio, fechaFin, ventanaLabel: `${formatFechaBolivia(fechaInicio)} al ${formatFechaBolivia(fechaFin)}` }

    case 'estandar':
    default:
      // 7 días por defecto (Bolivia timezone)
      {
        const estBase = boliviaDaysAgo(7);
        fechaInicio.setTime(estBase.getTime());
        fechaFin.setTime(boliviaEndOfDay().getTime());
      }
      return { fechaInicio, fechaFin, ventanaLabel: `${formatFechaBolivia(fechaInicio)} al ${formatFechaBolivia(fechaFin)}` }
  }
}

/** Genera un label legible para la ventana */
export function formatVentanaLabel(
  ventana: VentanaTipo,
  fecha?: string,
  ejesSlugs?: string[]
): string {
  const { ventanaLabel } = calculateWindow(ventana, fecha)
  const ejesStr = ejesSlugs && ejesSlugs.length > 0 ? ` | Ejes: ${ejesSlugs.join(', ')}` : ''
  return ventanaLabel + ejesStr
}

// ============================================
// Calculo de estadísticas sobre menciones
// ============================================

/** Calcula el sentimiento promedio y distribución */
export function calculateSentimiento(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  menciones: any[]
): { promedio: number; distribucion: Record<string, number>; label: string } {
  if (menciones.length === 0) {
    return { promedio: 3, distribucion: {}, label: 'Sin datos' }
  }

  let total = 0
  const distribucion: Record<string, number> = {}
  for (const m of menciones) {
    const score = SENTIMENT_SCORES[m.tratamientoPeriodistico] ?? 3
    total += score
    distribucion[m.tratamientoPeriodistico] = (distribucion[m.tratamientoPeriodistico] || 0) + 1
  }
  const promedio = total / menciones.length
  const label = sentimentScoreLabel(promedio)

  return { promedio, distribucion, label }
}

/** Obtiene el label extendido del sentimiento */
export function getSentimientoLabelExtendido(sentimientoPromedio: number): string {
  if (sentimientoPromedio >= 4) return 'Positivo'
  if (sentimientoPromedio >= 2.5) return 'Neutral'
  if (sentimientoPromedio >= 1) return 'Negativo'
  return 'Sin datos'
}

/** Obtiene los top N actores por menciones */
export function calculateTopActores(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  menciones: any[],
  limit: number = 10
): TopActorItem[] {
  const counts: Record<string, { nombre: string; partido: string; camara: string; departamento: string; count: number }> = {}
  for (const m of menciones) {
    if (m.Persona) {
      const key = m.Persona.id
      if (!counts[key]) {
        counts[key] = {
          nombre: m.Persona.nombre,
          partido: m.Persona.partidoSigla,
          camara: m.Persona.camara,
          departamento: m.Persona.departamento,
          count: 0,
        }
      }
      counts[key].count++
    }
  }
  return Object.values(counts)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}

/** Obtiene los top N medios por menciones */
export function calculateTopMedios(
  menciones: MencionConRelaciones[],
  limit: number = 10
): TopMedioItem[] {
  const counts: Record<string, { nombre: string; tipo: string; nivel: string; count: number }> = {}
  for (const m of menciones) {
    if (m.Medio) {
      const key = m.Medio.id
      if (!counts[key]) {
        counts[key] = { nombre: m.Medio.nombre, tipo: m.Medio.tipo, nivel: m.Medio.nivel, count: 0 }
      }
      counts[key].count++
    }
  }
  return Object.values(counts)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}

/** Clasifica menciones por eje temático */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function calculateClasificadores(
  menciones: any[]
): ClasificadorItem[] {
  const counts: Record<string, { slug: string; nombre: string; menciones: number }> = {}
  for (const m of menciones) {
    if (m.MencionTema) {
      for (const et of m.MencionTema) {
        const slug = et.EjeTematico.slug
        if (!counts[slug]) {
          counts[slug] = { slug, nombre: et.EjeTematico.nombre, menciones: 0 }
        }
        counts[slug].menciones++
      }
    }
  }
  const result: ClasificadorItem[] = Object.values(counts).sort((a, b) => b.menciones - a.menciones);
  return result;
}

/** Cuenta menciones por nivel de medio */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function calculateMencionesPorNivel(
  menciones: any[]
): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const m of menciones) {
    const nivel = m.medio?.nivel ?? '0'
    counts[nivel] = (counts[nivel] || 0) + 1
  }
  return counts
}

/** Cuenta enlaces rotos */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function countEnlacesRotos(
  menciones: any[]
): number {
  return menciones.filter(m => !m.enlaceActivo).length
}

/** Calcula sub-temas por frecuencia de keywords en ejes temáticos */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function calculateSubTemas(
  menciones: any[],
  limit: number = 10
): { tema: string; count: number }[] {
  const temas: Record<string, string> = {}
  const counts: Record<string, number> = {}
  for (const m of menciones) {
    if (m.temas) {
      for (const t of m.temas.split(',').map((s: string) => s.trim()).filter(Boolean)) {
        if (!temas[t]) temas[t] = t
        counts[t] = (counts[t] || 0) + 1
      }
    }
  }
  return Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([tema, count]) => ({ tema, count }))
}

/** Calcula distribución horaria de menciones */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function calculateEvolucionHoraria(
  menciones: any[],
  horaInicio: number = 6,
  horaFin: number = 22
): { hora: number; count: number }[] {
  const counts: Record<number, number> = {}
  for (let h = horaInicio; h <= horaFin; h++) {
    counts[h] = 0
  }
  for (const m of menciones) {
    const hora = m.fechaCaptura.getHours()
    if (hora >= horaInicio && hora <= horaFin) {
      counts[hora] = (counts[hora] || 0) + 1
    }
  }
  return Object.entries(counts)
    .map(([hora, count]) => ({ hora: parseInt(hora), count }))
    .sort((a, b) => a.hora - b.hora)
}

// ============================================
// Registry DEDICATED_RESUMEN_MAP (Equipo B)
// Funciones de resumen especializadas por tipo
// ============================================

type ResumenFn = (data: Record<string, unknown>) => Promise<string>;

const DEDICATED_RESUMEN_MAP: Partial<Record<TipoBoletin, ResumenFn>> = {
  EL_TERMOMETRO: async (data) => {
    const menciones = (data.menciones as Array<Record<string, string>>) ?? [];
    const fecha = data.fecha as string;
    const total = menciones.length;
    const positivos = menciones.filter(m => m.tratamientoPeriodistico === 'positivo').length;
    const negativos = menciones.filter(m => m.tratamientoPeriodistico === 'negativo').length;
    return `Periodo: ${fecha} | Menciones: ${total} | Positivas: ${positivos} | Negativas: ${negativos}`;
  },

  SALDO_DEL_DIA: async (data) => {
    const menciones = (data.menciones as Array<Record<string, string>>) ?? [];
    const fecha = data.fecha as string;
    const total = menciones.length;
    const medios = new Set(menciones.map(m => m.medio)).size;
    return `Cierre jornada ${fecha} | ${total} menciones en ${medios} medios monitoreados`;
  },

  EL_FOCO: async (data) => {
    const eje = data.ejeSlug as string;
    const menciones = (data.menciones as Array<Record<string, string>>) ?? [];
    const indicadores = data.indicadores as string;
    return `Eje: ${eje} | ${menciones.length} menciones | Indicadores disponibles: ${indicadores ? 'Si' : 'No'}`;
  },

  EL_RADAR: async (data) => {
    const ejes = data.ejes as Record<string, number> | undefined;
    const fecha = data.fecha as string;
    if (ejes) {
      const totalMenciones = Object.values(ejes).reduce((a, b) => a + b, 0);
      return `Radar semanal ${fecha} | ${Object.keys(ejes).length} ejes | ${totalMenciones} menciones totales`;
    }
    // Fallback cuando viene desde generate-generic (sin ejes)
    const total = (data.totalMenciones as number) ?? 0;
    return `Radar semanal ${fecha} | ${total} menciones (top scoring epistemologico)`;
  },

  EL_INFORME_CERRADO: async (data) => {
    const semana = data.semana as number;
    const menciones = (data.menciones as Array<Record<string, string>>) ?? [];
    return `Informe semana ${semana} | ${menciones.length} menciones analizadas`;
  },

  FICHA_LEGISLADOR: async (data) => {
    const nombre = data.nombre as string;
    const menciones = (data.menciones as Array<Record<string, string>>) ?? [];
    return `Ficha: ${nombre} | ${menciones.length} menciones en el periodo`;
  },
};

/**
 * Obtiene el resumen dedicado para un tipo de producto.
 */
export async function getDedicatedResumen(
  tipo: TipoBoletin,
  data: Record<string, unknown>
): Promise<string> {
  const fn = DEDICATED_RESUMEN_MAP[tipo];
  if (fn) {
    return fn(data);
  }
  return `Producto: ${tipo} | Generado: ${formatFechaBolivia(new Date())}`;
}

// ============================================
// Construccion de Prompts
// ============================================

/**
 * Construye el prompt de usuario para un generador de boletin.
 * @param tipo - Tipo de producto
 * @param menciones - Menciones formateadas como texto
 * @param indicadores - Indicadores formateados como texto
 * @param datosExtra - Datos adicionales por producto
 */
export function construirPrompt(
  tipo: TipoBoletin,
  menciones: string,
  indicadores: string,
  datosExtra?: string,
  contextoHistorico?: string,
  totalDisponibles?: number,
): string {
  const partes: string[] = [
    `## Datos de Menciones\n${menciones}`,
  ];

  if (contextoHistorico && contextoHistorico.trim()) {
    partes.push(
      `## Contexto Historico (ultimos 7 dias — SOLO para analisis de tendencias)`,
      `INSTRUCCION: Estas menciones son de dias ANTERIORES al periodo del producto.`,
      `NO las incluyas como contenido del producto. Usalas UNICAMENTE para:`,
      `- Detectar si un tema esta escalando, estable o bajando`,
      `- Identificar temas nuevos o emergentes`,
      `- Entender la evolucion de hechos noticiosos`,
      `- Comparar el sentimiento de hoy con la tendencia de la semana`,
      contextoHistorico,
    );
  }

  if (indicadores && indicadores !== 'No hay indicadores disponibles para este periodo.') {
    partes.push(indicadores);
  }

  if (datosExtra) {
    partes.push(`## Informacion Adicional\n${datosExtra}`);
  }

  // ═══ IDENTIDAD DEL PRODUCTO + TRANSPARENCIA DE DATOS ═══
  const mLineas = menciones.split('\n')
  const mCount = mLineas.filter(l => l.includes('MEDIO:')).length
  const mMediosSet = new Set(
    mLineas
      .filter(l => l.includes('MEDIO:'))
      .map(l => { const m = l.match(/MEDIO:\s*(.+)/); return m ? m[1].trim() : null; })
      .filter(Boolean),
  )

  // ═══ SUJETOS OBLIGATORIOS — Anti Ghost Subjects ═══
  // Extraer todos los nombres de persona de las menciones para forzar
  // que el LLM los use como sujetos explicitos en lugar de omitirlos.
  const personaNames = new Set<string>()
  for (const linea of mLineas) {
    const personaMatch = linea.match(/Persona:\s*(.+)/)
    if (personaMatch) {
      const nombre = personaMatch[1].trim()
      if (nombre && nombre !== 'null' && nombre !== 'undefined') {
        personaNames.add(nombre)
      }
    }
  }
  const sujetosObligatorios = [...personaNames]

  partes.push(
    `\nIDENTIDAD DEL PRODUCTO: ${NOMBRE_PRODUCTO[tipo]} es un ${TIPO_PRODUCTO[tipo]} de DECODEX Bolivia. DECODEX es un observatorio de medios que monitorea, clasifica y analiza menciones de fuentes de informacion bolivianas en tiempo real, utilizando inteligencia artificial y el marco epistemologico ONION200.`,
    `TRANSPARENCIA: Este producto se generó con ${mCount} menciones de ${mMediosSet.size} medios distintos en el periodo indicado${totalDisponibles && totalDisponibles > mCount ? ` (de ${totalDisponibles} menciones disponibles; ${totalDisponibles - mCount} no se incluyeron por seleccion epistemologica ONION200)` : ''}. El sistema monitorea 53 fuentes de informacion bolivianas; ${mMediosSet.size} de 53 (${Math.round((mMediosSet.size / 53) * 100)}%) reportaron en este periodo.`,
    `Genera ${NOMBRE_PRODUCTO[tipo]} siguiendo las instrucciones del sistema.`,
    `Fecha de referencia: ${formatFechaBolivia(new Date())}.`,
    `Semana del ano: ${getSemanaAnho()}.`
  );

  // Inyectar SUJETOS OBLIGATORIOS si hay personas identificadas
  if (sujetosObligatorios.length > 0) {
    partes.push(
      `\nSUJETOS OBLIGATORIOS — Las siguientes personas aparecen en las menciones y DEBEN ser nombradas con sujeto explicito (nombre + cargo) en cada accion, declaracion o evento que les corresponda. NUNCA inicies una oracion con un verbo sin sujeto cuando una de estas personas realizo la accion:`,
      sujetosObligatorios.map((n, i) => `  ${i + 1}. ${n}`).join('\n'),
      `Si una persona de esta lista realizo una accion pero el LLM la reporta sin nombrarla (ej: "Se aprobo el proyecto..." en vez de "El diputado X aprobo el proyecto..."), es un ERROR DE SUJETO FANTASMA y debe corregirse.`
    );
  }

  // ═══ REFUERZO FINAL — REGLAS DE GENERACIÓN ═══
  // Se repiten al FINAL del user prompt para combatir el recency bias del LLM.
  partes.push(
    `\n\nREGLAS FINALES DE ESTE PRODUCTO:`,
    `1. SOLO DATOS DE MENCIONES: Cada dato que escribas debe estar en las menciones proporcionadas. No inventes, no deduzcas, no rellenes.`,
    `2. ATRIBUCION: Cada afirmacion va con (Fuente: nombre del medio). Si un medio reporta que alguien dijo algo sin cita directa, usa "según [medio]". Si dos o más medios reportan lo mismo de forma independiente, puedes usar "según varios medios". Si hay cita textual con comillas, presenta como declaracion directa del actor.`,
    `3. FECHAS CONCRETAS: Si una mencion dice "mañana", "hoy", "la proxima semana" u otra referencia temporal vaga, conviértela a la fecha concreta correspondiente usando la fecha de referencia proporcionada. Nunca uses "dia siguiente" ni expresiones temporales vagas.`,
    `4. PLURALIDAD DE VOCES: Si hay versiones contrapuestas entre actores, reporta AMBAS con sus fuentes. Ningun actor (gobierno, oposicion, sector social, organismo internacional) es fuente de verdad por defecto.`,
    `5. SINTESIS PERMITIDA: Puedes agrupar menciones por tema, cruzar fuentes, e identificar patrones — siempre citando fuentes. No se permite inventar causas, intenciones ni contextos que no esten en las menciones.`,
    `6. CERO PLACEHOLDERS EN INGLES: NUNCA escribas "N/A" ni ningun placeholder en ingles. Si no tienes un nombre, usa cargo generico ("el dirigente", "el concejal") u omite la informacion.`,
    `VIOLACION DE LAS REGLAS 1-6 = PRODUCTO INVALIDO.`
  );

  return partes.join('\n\n');
}

// ============================================
// Formateo de Menciones para Prompts
// ============================================

/**
 * Formatea una lista de menciones como texto para prompts.
 * Acepta menciones de Prisma (con relaciones incluidas) u objetos planos.
 * 
 * Estrategia de seleccion cuando hay mas menciones que el limite:
 * - Diario: simple sort por relevancia (pocas menciones, 24h)
 * - Semanal: relevancia epistemologica — diversidad de medios, profundidad
 *   de tratamiento, cobertura de ejes, actores clave.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MAX_MENCIONES_PROMPT = 200;
const MAX_MENCIONES_DIARIO = 150;

/**
 * Score composite de relevancia epistemologica.
 * Integra marco epistemologico (ejes, lentes, confianza, intencion, tratamiento)
 * con senales cuantitativas (peso del medio) y de calidad periodistica (profundidad).
 *
 * El score se usa INTERNAMENTE para seleccionar menciones al armar prompts.
 * El cliente no ve el score — ve la hamburguesa, no los condimentos.
 */
function puntuarRelevanciaEpistemologica(m: any): number {
  let score = 0;

  // ═══ 1. MARCO EPISTEMOLOGICO (40%) ═══

  // 1A. Alineacion con ejes estructurales — mapeo del marco conceptual
  // Cuantos mas ejes del marco activa, mas relevante es la mencion
  const ejes = m.temas?.length ?? 0;
  if (ejes >= 3) score += 15;      // Fenomeno multi-eje: complejo, articula varias dimensiones
  else if (ejes === 2) score += 10; // Cruce de ejes
  else if (ejes === 1) score += 6;  // Un solo eje
  // 0 ejes = fuera del marco, no suma

  // 1B. Peso del eje mas fuerte (NotaEje.peso o clasificador v2)
  // Un eje con peso alto = la mencion encaja profundamente en el marco
  const pesoEjeMax = m.pesoEjeMax ?? 0;
  score += Math.round(pesoEjeMax * 10); // 0-10 puntos

  // 1C. Confianza de clasificacion (alta/media/baja) — juicio del LLM
  const confianza = (m.confianzaClasificacion || '').toLowerCase();
  if (confianza === 'alta') score += 5;
  else if (confianza === 'media') score += 3;
  else if (confianza === 'baja') score += 1;
  else score += 2; // sin dato

  // 1D. Intencion del medio — taxonomy del marco (denunciar > analizar > opinar > informar)
  const intencion = (m.intencionMedio || '').toLowerCase();
  if (intencion.includes('denunciar')) score += 5;
  else if (intencion.includes('analizar')) score += 4;
  else if (intencion.includes('opinar')) score += 3;
  else if (intencion.includes('informar')) score += 2;
  // entretener = 0

  // 1E. Tratamiento periodistico — profundidad segun escala del marco
  const tp = (m.tratamientoPeriodistico || '').toLowerCase();
  if (tp.includes('investigacion')) score += 10;
  else if (tp.includes('editorial') || tp.includes('analisis')) score += 9;
  else if (tp.includes('reportaje') || tp.includes('entrevista') || tp.includes('cronica')) score += 7;
  else if (tp.includes('nota') || tp.includes('informacion')) score += 4;
  else if (tp.includes('mencion') || tp.includes('referencia')) score += 2;
  else score += 5; // sin dato

  // ═══ 2. CUANTITATIVO (20%) ═══

  // 2A. Peso informativo del medio (calculo del peso-calculator: 0-100)
  // Normalizado a 0-15 puntos (15% del total)
  const pesoMedio = m.pesoInformativo ?? 0;
  score += Math.round(pesoMedio * 0.15);

  // ═══ 3. CALIDAD PERIODISTICA (25%) ═══

  // 3A. Resumen con contexto verificable
  if (m.resumen && m.resumen.length > 50) score += 10;
  else if (m.resumen) score += 5;

  // ═══ 4. ACTORES (15%) ═══

  // 4A. Persona identificada — mismo peso que eje tematico fuerte
  if (m.persona) score += 10;

  // 4B. Reach moderado
  if (m.reach > 0) score += Math.min(Math.round(m.reach * 0.05), 5);

  return score;
}

function seleccionarMencionesEpistemologicas(menciones: any[], max: number): any[] {
  const scored = menciones.map((m) => ({
    m,
    score: puntuarRelevanciaEpistemologica(m),
  }));

  // Ordenar por score epistemologico (desc)
  scored.sort((a, b) => b.score - a.score);

  // Tomar el top, pero garantizar diversidad de medios:
  // no mas del 25% de un mismo medio en la seleccion final
  const seleccionados: any[] = [];
  const conteoMedios: Record<string, number> = {};
  const limitePorMedio = Math.max(Math.ceil(max * 0.25), 5);

  for (const item of scored) {
    if (seleccionados.length >= max) break;
    const medio = item.m.medio || 'desconocido';
    conteoMedios[medio] = (conteoMedios[medio] || 0) + 1;
    if (conteoMedios[medio] <= limitePorMedio) {
      seleccionados.push(item.m);
    }
  }

  // Si nos quedamos cortos por el filtro de medios, llenar con los restantes
  if (seleccionados.length < max) {
    const seleccionadosIds = new Set(seleccionados.map((m: any) => m.id || m.titulo));
    for (const item of scored) {
      if (seleccionados.length >= max) break;
      if (!seleccionadosIds.has(item.m.id || item.m.titulo)) {
        seleccionados.push(item.m);
        seleccionadosIds.add(item.m.id || item.m.titulo);
      }
    }
  }

  return seleccionados;
}

/**
 * Temperatura dinamica basada en el perfil del dia.
 * Ajusta la temperatura base del producto segun la densidad y complejidad
 * de las menciones seleccionadas. El cliente no ve este ajuste — es interna.
 *
 * Reglas:
 * - Dia denso (>40 menciones con score > 30) → +0.05 (necesita sintesis)
 * - Dia complejo (>6 ejes distintos) → +0.05 (necesita hilado narrativo)
 * - Dia polarizado (>30% denuncias/opiniones) → +0.03 (tono viene del contenido)
 * - Dia sparse (<10 menciones) → -0.02 (fidelidad literal)
 * - Clamp: [0.05, 0.4]
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function calcularTemperaturaDinamica(
  baseTemp: number,
  menciones: any[],
): number {
  if (!menciones || menciones.length < 5) return Math.max(baseTemp, 0.05);

  // Score cada mencion rapido (reusa el mismo scoring)
  const scored = menciones.map(m => ({ m, score: puntuarRelevanciaEpistemologica(m) }));

  // Densidad: menciones con score alto (relevancia real, no solo presencia)
  const relevantes = scored.filter(item => item.score > 30).length;
  let ajuste = 0;

  if (relevantes > 40) ajuste += 0.05;      // Dia denso
  else if (relevantes > 20) ajuste += 0.02;  // Dia medio

  // Complejidad: cantidad de ejes distintos
  const ejesSet = new Set<string>();
  for (const item of scored) {
    const temas = item.m.temas;
    if (Array.isArray(temas)) temas.forEach(t => ejesSet.add(String(t)));
  }
  if (ejesSet.size > 6) ajuste += 0.05;     // Multi-eje complejo
  else if (ejesSet.size > 3) ajuste += 0.02; // Multi-eje moderado

  // Polarizacion: proporcion de intencion "denunciar" u "opinar"
  const polarizadas = scored.filter(item => {
    const intencion = (item.m.intencionMedio || '').toLowerCase();
    return intencion.includes('denunciar') || intencion.includes('opinar');
  }).length;
  if (polarizadas / scored.length > 0.3) ajuste += 0.03;

  // Sparse: pocas menciones
  if (menciones.length < 10) ajuste -= 0.02;

  // Clamp
  return Math.max(0.05, Math.min(baseTemp + ajuste, 0.4));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function formatearMencionesPrompt(
  menciones: any[],
  tipo?: string,
  options?: { maxMenciones?: number; maxTextoLength?: number },
): string {
  if (menciones.length === 0) {
    return 'No se encontraron menciones en el periodo consultado.';
  }

  const esDiario = tipo && ['EL_TERMOMETRO_AM', 'EL_TERMOMETRO_PM', 'EL_FOCO', 'SALDO_DEL_DIA', 'EL_ALERTA', 'ALERTA_TEMPRANA'].includes(tipo);
  const limiteDefault = esDiario ? MAX_MENCIONES_DIARIO : MAX_MENCIONES_PROMPT;
  const limite = options?.maxMenciones ?? limiteDefault;
  const textoMaxLen = options?.maxTextoLength ?? 300;

  let seleccionadas: any[];
  if (menciones.length > limite) {
    // Diario y semanal: relevancia epistemologica composite (unificado)
    seleccionadas = seleccionarMencionesEpistemologicas(menciones, limite);
    console.log(`[formatearMencionesPrompt] ${esDiario ? 'Diario' : 'Semanal'}: truncando ${menciones.length} → ${seleccionadas.length} (relevancia epistemologica composite, maxTexto=${textoMaxLen})`);
  } else {
    seleccionadas = menciones;
  }

  return seleccionadas.map((m, i) => {
    const parts = [
      `${i + 1}. **${m.titulo}**`,
      `   - Medio: ${m.medio ?? 'No especificado'}`,
      `   - Fecha: ${m.fechaPublicacion ?? 'N/D'}`,
    ];
    if (m.persona) parts.push(`   - Persona: ${m.persona}`);
    if (m.tratamientoPeriodistico) parts.push(`   - Sentimiento: ${m.tratamientoPeriodistico}`);
    // Incluir snippet del texto del artículo para dar contexto real al LLM
    const textoArticulo = m.texto ?? m.textoCompleto ?? '';
    if (textoArticulo && textoMaxLen > 0) {
      const textoCorto = textoArticulo.length > textoMaxLen
        ? textoArticulo.substring(0, textoMaxLen) + '...'
        : textoArticulo;
      parts.push(`   - Texto: ${textoCorto}`);
    }
    if (m.resumen) parts.push(`   - Resumen: ${m.resumen}`);
    if (m.temas && m.temas.length > 0) parts.push(`   - Ejes: ${m.temas.join(', ')}`);
    if (m.relevancia) parts.push(`   - Relevancia: ${m.relevancia}/10`);
    return parts.join('\n');
  }).join('\n\n');
}

/**
 * Formatea menciones agrupadas por eje tematico.
 */
export function formatearMencionesPorEje(
  mencionesPorEje: Record<string, Array<Record<string, unknown>>>
): string {
  return Object.entries(mencionesPorEje)
    .map(([eje, menciones]) => {
      const lista = menciones.map((m, i) =>
        `  ${i + 1}. ${(m.titulo as string)} — ${(m.medio as string) ?? 'Sin medio'}`
      ).join('\n');
      return `### Eje: ${eje} (${menciones.length} menciones)\n${lista}`;
    })
    .join('\n\n');
}

/**
 * Formatea menciones de contexto historico de forma compacta, agrupadas por dia.
 * Solo: titulo, medio, persona, sentimiento, temas. Sin texto completo.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function formatearContextoHistorico(menciones: any[]): string {
  if (!menciones || menciones.length === 0) return '';

  const porDia: Record<string, typeof menciones> = {};
  for (const m of menciones) {
    const ts = m.fechaCaptura as number | null;
    let dia: string;
    if (ts) {
      const d = new Date(ts);
      dia = d.toLocaleDateString('es-BO', { day: 'numeric', month: 'short', timeZone: 'America/La_Paz' });
    } else {
      dia = 'Sin fecha';
    }
    if (!porDia[dia]) porDia[dia] = [];
    porDia[dia].push(m);
  }

  return Object.entries(porDia)
    .map(([dia, items]) => {
      const lista = items.slice(0, 30).map((m, i) => {
        const partes = [`  ${i + 1}. ${m.titulo ?? 'Sin titulo'} (${m.medio ?? '?'})`];
        if (m.persona) partes[0] += ` — ${m.persona}`;
        if (m.sentimiento) partes.push(`   Sentimiento: ${m.sentimiento}`);
        if (m.temas && m.temas.length > 0) partes.push(`   Ejes: ${m.temas.join(', ')}`);
        return partes.join('\n');
      }).join('\n');
      return `**${dia}** (${items.length} menciones)\n${lista}`;
    })
    .join('\n\n');
}

// ============================================
// Registro de Reportes en BD
// ============================================

/**
 * Registra un reporte generado en la base de datos.
 * Mapea los parámetros al schema real de Reporte.
 */
export async function registrarReporte(params: {
  tipoProducto: TipoBoletin;
  titulo?: string;
  contenido: string;
  resumen?: string;
  fechaInicio: Date;
  fechaFin: Date;
  temperatura?: number;
  tokensUsados?: number;
  modeloIA?: string;
  metadata?: string;
  puntuacionCalidad?: number;
  clienteId?: string;
  totalMenciones?: number;
}): Promise<string> {
  // Generar ID unico para el reporte (campo @id sin auto-generacion en schema)
  const { randomBytes } = await import('crypto');
  const reporteId = 'rpt_' + randomBytes(12).toString('hex');

  try {
    const reporte = await db.reporte.create({
      data: {
        id: reporteId,
        tipo: params.tipoProducto,
        resumen: params.resumen ?? params.titulo ?? '',
        contenido: params.contenido,
        fechaInicio: params.fechaInicio,
        fechaFin: params.fechaFin,
        totalMenciones: params.totalMenciones ?? 0,
        sentimientoPromedio: 0,
        temasPrincipales: '',
        clasificadores: params.puntuacionCalidad != null
          ? JSON.stringify({ puntuacionCalidad: params.puntuacionCalidad, evaluadoEn: new Date().toISOString() })
          : '',
      },
    });

    // Push DB to GitHub as part of the generation flow
    try {
      const { pushProductosToGithub } = await import('@/lib/git-utils');
      const nombreProducto = params.tipoProducto.replace(/_/g, ' ');
      await pushProductosToGithub(`prod: ${nombreProducto} generado — ${new Date().toISOString().slice(0, 10)}`);
    } catch (gitErr) {
      console.warn('[reportes-utils] Git push falló (producto registrado localmente):', gitErr);
    }

    return reporte.id;
  } catch (error) {
    console.error('[reportes-utils] Error registrando reporte:', error);
    // Generar ID fallback para que downstream nunca reciba null
    const fallbackId = 'rpt_fb_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 8);
    console.warn(`[reportes-utils] Usando reporteId fallback: ${fallbackId}`);
    return fallbackId;
  }
}

/**
 * Actualiza el estado de un reporte.
 * El schema usa `enviado: boolean` en lugar de un campo `estado`.
 */
export async function actualizarEstadoReporte(
  reporteId: string,
  estado: 'generado' | 'aprobado' | 'entregado' | 'fallido'
): Promise<boolean> {
  try {
    const enviado = estado === 'entregado' || estado === 'aprobado';
    await db.reporte.update({
      where: { id: reporteId },
      data: { enviado },
    });
    return true;
  } catch (error) {
    console.error('[reportes-utils] Error actualizando estado:', error);
    return false;
  }
}

/**
 * Genera el titulo estandar para un producto.
 */
export function generarTituloProducto(
  tipo: TipoBoletin,
  fecha?: Date,
  ejeNombre?: string
): string {
  const fechaStr = formatFechaBolivia(fecha ?? new Date());
  const semana = getSemanaAnho(fecha);

  const titulos: Record<TipoBoletin, string> = {
    EL_TERMOMETRO: `EL TERMOMETRO — ${fechaStr}`,
    SALDO_DEL_DIA: `SALDO DEL DIA — ${fechaStr}`,
    EL_FOCO: `EL FOCO — ${ejeNombre ?? 'Eje Tematico'} — ${fechaStr}`,
    EL_ESPECIALIZADO: `EL ESPECIALIZADO — ${fechaStr}`,
    EL_INFORME_CERRADO: `EL INFORME CERRADO — Semana ${semana} — ${fechaStr}`,
    FICHA_LEGISLADOR: `FICHA — ${ejeNombre ?? 'Legislador'} — ${fechaStr}`,
    ALERTA_TEMPRANA: `ALERTA DECODEX — ${fechaStr}`,
    EL_RADAR: `EL RADAR — Semana ${semana} — ${fechaStr}`,
    VOZ_Y_VOTO: `VOZ Y VOTO — Resumen Semanal — ${fechaStr}`,
    EL_HILO: `EL HILO — Recuento Semanal — ${fechaStr}`,
    FOCO_DE_LA_SEMANA: `FOCO DE LA SEMANA — ${ejeNombre ?? 'Eje Tematico'} — Semana ${semana}`,
    BOLETIN_DEL_GRANO: `BOLETÍN DEL GRANO — Semana ${semana} — ${fechaStr}`,
  };

  return titulos[tipo];
}

// ============================================
// Preprocesamiento Epistemológico por Producto
// ============================================

/**
 * Perfil epistemológico que define qué tipo de menciones son relevantes
 * para cada producto. Se usa para filtrar ANTES de formatear el prompt.
 *
 * Cada filtro se aplica sobre campos que ya existen en la mención
 * (clasificador-v2, extractor-menciones, peso-calculator).
 */
interface FiltroEpistemologico {
  /** Tratamiento periodístico mínimo para incluir. Si la mención tiene un tratamiento menor, se excluye. */
  tratamientoMinimo?: number;  // score de tratamiento (mencion=2, nota=4, reportaje=7, investigacion=10)
  /** Peso mínimo del eje estructural más fuerte (NotaEje.peso). Por defecto 0. */
  pesoEjeMinimo?: number;      // 0.0-1.0
  /** Lentes que activan la mención como relevante (slugs). Vacío = cualquier lente. */
  lentesRequeridos?: string[];
  /** Lentes que excluyen la mención (slugs). */
  lentesExcluidos?: string[];
  /** Confianza mínima de clasificación. 'baja' | 'media' | 'alta'. Por defecto 'baja'. */
  confianzaMinima?: 'baja' | 'media' | 'alta';
  /** Tratamientos periodísticos específicos a excluir (substrings). */
  tratamientosExcluidos?: string[];
  /**
   * Keywords de contenido: la mención DEBE contener al menos uno para ser incluida.
   * Se evalúa sobre titulo + texto normalizado.
   * Si está vacío, no se filtra por contenido (comportamiento por defecto).
   */
  keywordsRequeridos?: string[];
  /**
   * Keywords de exclusión de contenido: si la mención contiene alguno, se excluye.
   * Se evalúa sobre titulo + texto normalizado.
   */
  keywordsExcluidos?: string[];
}

/**
 * Perfiles por producto. Solo se definen los que necesitan filtrado
 * epistemológico más fino que el scoring genérico.
 * Los productos sin perfil usan el flujo estándar (scoring epistemológico genérico).
 */
const PERFILES_EPISTEMOLOGICOS: Partial<Record<TipoBoletin, FiltroEpistemologico>> = {
  VOZ_Y_VOTO: {
    // Excluir menciones pasivas (solo "mención" o "referencia" de alguien que dijo algo)
    tratamientoMinimo: 4,  // nota informativa o superior
    // Peso mínimo del eje estructural — excluir ruido de menciones tangenciales
    pesoEjeMinimo: 0.5,
    // Excluir lentes de entretenimiento, deportes, cultura que puedan colarse
    lentesExcluidos: ['entretenimiento', 'deportes', 'cultura', 'espectaculos'],
    confianzaMinima: 'media',
    // Excluir menciones que son solo referencias de paso
    tratamientosExcluidos: ['mencion', 'referencia'],
    // Keywords de contenido LEGISLATIVO/INSTITUCIONAL — la mención DEBE contener al menos uno
    keywordsRequeridos: [
      // Nivel nacional (ALP)
      'asamblea legislativa', 'camara de diputados', 'camara de senadores', 'senado',
      'proyecto de ley', 'ley ', 'leyes ', 'ley aprobada', 'ley promulgada',
      'diputado', 'diputada', 'senador', 'senadora', 'legislador', 'legisladora',
      'comision de', 'comisiones de', 'sesion de', 'sesion plenaria', 'pleno de',
      'votacion', 'aprobacion', 'sancion', 'promulgacion', 'veto', 'objecion',
      'estado de excepcion', 'decreto', 'resolucion legislativa',
      'vicepresidente', 'presidente de la asamblea',
      // Nivel departamental
      'asamblea departamental', 'gobernador', 'gobernadora', 'consejo departamental',
      'resolucion departamental', 'ley departamental',
      // Nivel municipal
      'concejo municipal', 'concejales', 'concejal', 'concejala',
      'ordenanza', 'ordenanza municipal', 'sesion de concejo',
      'gobierno municipal', 'gobierno autonomo municipal',
      // Autonomías indígenas
      'autonomia indigena', 'nacion originaria', 'consejo de naciones',
      'tierras comunitarias de origen',
      // Procesos electorales vinculados a legislación
      'tribunal supremo electoral', ' tribunal electoral departamental',
      'normativa electoral', 'reforma electoral', 'eleccion',
      // Repercusiones de normativa
      'repercusion', 'observaciones a la ley', 'objecion a la ley',
      'sectores afectados por la ley', 'aplicacion de la ley',
      'promulgacion de la ley', 'entrada en vigencia',
      'estado situacional', 'estado de sitio',
      // Control y fiscalización
      'contraloria', 'fiscalizacion', 'auditoria', 'control social',
      'juicio de responsabilidades', 'comision de investigacion',
    ],
    // Keywords que NUNCA pertenecen a VOZ_Y_VOTO aunque estén en el eje
    keywordsExcluidos: [
      'avioneta', 'accidente aereo', 'accidente de transito',
      'homicidio', 'asesinato', 'fallecimiento de', 'muerte de', 'fallecio',
      'partido de futbol', 'futbol', 'mundial', 'seleccion',
      'concierto', 'festival', 'feria de',
      'clima', 'pronostico del tiempo', 'temperatura',
      'resultado de la loteria', 'loteria',
      'curandero', 'hechicero',
    ],
  },
  EL_RADAR: {
    // El Radar es el producto más amplio, pero excluye el ruido más fino
    pesoEjeMinimo: 0.3,
    tratamientosExcluidos: ['referencia'],
  },
  EL_TERMOMETRO: {
    // Producto diario: alta confianza, excluir referencias pasivas
    confianzaMinima: 'media',
    tratamientosExcluidos: ['referencia'],
  },
};

/** Mapping de confianza a score numérico para comparación */
const CONFIANZA_SCORE: Record<string, number> = { alta: 3, media: 2, baja: 1 };

/**
 * Clasifica una mención de VOZ_Y_VOTO en un sub-nivel institucional
 * basándose en los slugs de los ejes temáticos asignados.
 * Retorna el nivel y un flag de si es repercusión social.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function clasificarNivelInstitucional(m: any): { nivel: string; esRepercusion: boolean } {
  const slugs: string[] = m.temasSlugs ?? [];
  const texto = `${(m.titulo as string) ?? ''} ${(m.texto as string) ?? ''}`.toLowerCase();

  // Mapeo slug → nivel institucional
  const MAPA_NIVEL: Record<string, string> = {
    'gobierno-legislativo': 'ALP',
    'procesos-normativa-electoral': 'ALP',
    // Gobiernos departamentales
    'gobierno-poder-instituciones': 'Gobierno Departamental',
    'gobierno-control-fiscalizacion': 'Gobierno Departamental',
    // Municipal
    // (no hay slug específico municipal, se detecta por keywords)
    // Autonomías indígenas
    // (no hay slug específico, se detecta por keywords)
  };

  // Detectar nivel por keywords si no hay slug directo
  const KW_MUNICIPAL = ['concejo municipal', 'concejales', 'ordenanza municipal', 'alcalde', 'alcaldesa', 'gobierno municipal', 'concejo'];
  const KW_INDIGENA = ['autonomia indigena', 'pueblo indigena', 'nacion originaria', 'tierras comunitarias', 'tco', 'consejo de naciones'];
  const KW_DEPARTAMENTAL = ['asamblea departamental', 'gobierno departamental', 'gobernador', 'gobernadora', 'prefectura'];

  let nivel = 'Otro nivel institucional';
  let esRepercusion = false;

  // Primero verificar por slug
  for (const slug of slugs) {
    if (MAPA_NIVEL[slug]) {
      nivel = MAPA_NIVEL[slug];
      break;
    }
  }

  // Refinar por keywords si es "Otro nivel"
  if (nivel === 'Otro nivel') {
    if (KW_MUNICIPAL.some(kw => texto.includes(kw))) nivel = 'Concejo Municipal';
    else if (KW_INDIGENA.some(kw => texto.includes(kw))) nivel = 'Autonomía Indígena';
    else if (KW_DEPARTAMENTAL.some(kw => texto.includes(kw))) nivel = 'Gobierno Departamental';
  }

  // Detectar si es repercusión (menciona impacto social de una ley/proyecto)
  const KW_REPERCUSION = ['rechazo', 'apoyo', 'bloqueo', 'protesta', 'demand', 'observacion', 'promulgacion', 'vet', 'objecion', 'consecuencia', 'afecta', 'beneficia', 'perjudica', 'sectores afectados', 'implica', ' repercut'];
  if (KW_REPERCUSION.some(kw => texto.includes(kw)) || slugs.includes('organizaciones-sociales-gremiales')) {
    // Solo es repercusion si NO es actividad legislativa directa
    const esActividadDirecta = ['proyecto de ley', 'ley aprobada', 'sesion de', 'comision de', 'pleno de la asamblea', 'diputado', 'senador', 'votacion'].some(kw => texto.includes(kw));
    if (!esActividadDirecta) {
      esRepercusion = true;
    }
  }

  return { nivel, esRepercusion };
}

/**
 * Preprocesa menciones según el perfil epistemológico del producto.
 * Filtra, reordena y opcionalmente clasifica por sub-categorías.
 *
 * Retorna las menciones procesadas + metadatos de la clasificación.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function preprocesarMencionesParaProducto(
  tipo: TipoBoletin,
  menciones: any[],
): { menciones: any[]; clasificacion?: Record<string, any[]>; stats: { antes: number; despues: number; motivosExclusion: Record<string, number> } } {
  const perfil = PERFILES_EPISTEMOLOGICOS[tipo];

  // Sin perfil = devolver tal cual
  if (!perfil) {
    return { menciones, stats: { antes: menciones.length, despues: menciones.length, motivosExclusion: {} } };
  }

  const motivosExclusion: Record<string, number> = {};

  const confianzaMinScore = CONFIANZA_SCORE[perfil.confianzaMinima ?? 'baja'] ?? 1;
  const lentesReq = new Set(perfil.lentesRequeridos ?? []);
  const lentesExc = new Set(perfil.lentesExcluidos ?? []);
  const tratExc = new Set(perfil.tratamientosExcluidos ?? []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filtradas = menciones.filter((m: any) => {
    // 1. Peso del eje estructural
    const pesoEje = m.pesoEjeMax ?? 0;
    if (perfil.pesoEjeMinimo && pesoEje > 0 && pesoEje < perfil.pesoEjeMinimo) {
      motivosExclusion['peso_eje_bajo'] = (motivosExclusion['peso_eje_bajo'] ?? 0) + 1;
      return false;
    }

    // 2. Confianza de clasificación
    const confScore = CONFIANZA_SCORE[(m.confianzaClasificacion ?? '').toLowerCase()] ?? 1;
    if (confScore < confianzaMinScore) {
      motivosExclusion['confianza_baja'] = (motivosExclusion['confianza_baja'] ?? 0) + 1;
      return false;
    }

    // 3. Lentes excluidos
    if (lentesExc.size > 0 && m.lenteSlugs) {
      const mlentes = Array.isArray(m.lenteSlugs) ? m.lenteSlugs : [];
      if (mlentes.some((l: string) => lentesExc.has(l))) {
        motivosExclusion['lente_excluido'] = (motivosExclusion['lente_excluido'] ?? 0) + 1;
        return false;
      }
    }

    // 4. Tratamiento periodístico excluido
    const tp = (m.tratamientoPeriodistico ?? '').toLowerCase();
    if (tratExc.size > 0 && tratExc.has(tp)) {
      motivosExclusion['tratamiento_excluido'] = (motivosExclusion['tratamiento_excluido'] ?? 0) + 1;
      return false;
    }

    // 5. Score mínimo de tratamiento (usa el mismo scoring que puntuarRelevanciaEpistemologica)
    if (perfil.tratamientoMinimo) {
      let tpScore = 5; // default
      if (tp.includes('investigacion')) tpScore = 10;
      else if (tp.includes('editorial') || tp.includes('analisis')) tpScore = 9;
      else if (tp.includes('reportaje') || tp.includes('entrevista') || tp.includes('cronica')) tpScore = 7;
      else if (tp.includes('nota') || tp.includes('informacion')) tpScore = 4;
      else if (tp.includes('mencion') || tp.includes('referencia')) tpScore = 2;

      if (tpScore < perfil.tratamientoMinimo) {
        motivosExclusion['tratamiento_minimo'] = (motivosExclusion['tratamiento_minimo'] ?? 0) + 1;
        return false;
      }
    }

    // 6. Keywords de contenido — normalizar titulo + texto para comparación
    const textoNorm = `${(m.titulo as string) ?? ''} ${(m.texto as string) ?? ''}`.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // 6A. Keywords excluidos (se evalúan primero — prioridad)
    if (perfil.keywordsExcluidos && perfil.keywordsExcluidos.length > 0) {
      if (perfil.keywordsExcluidos.some(kw => textoNorm.includes(kw.normalize('NFD').replace(/[\u0300-\u036f]/g, '')))) {
        motivosExclusion['keyword_excluido'] = (motivosExclusion['keyword_excluido'] ?? 0) + 1;
        return false;
      }
    }

    // 6B. Keywords requeridos (la mención DEBE contener al menos uno)
    if (perfil.keywordsRequeridos && perfil.keywordsRequeridos.length > 0) {
      const tieneKw = perfil.keywordsRequeridos.some(kw =>
        textoNorm.includes(kw.normalize('NFD').replace(/[\u0300-\u036f]/g, ''))
      );
      if (!tieneKw) {
        motivosExclusion['sin_keyword_requerido'] = (motivosExclusion['sin_keyword_requerido'] ?? 0) + 1;
        return false;
      }
    }

    return true;
  });

  // Reordenar por scoring epistemológico (reutiliza la misma función)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scored = filtradas.map((m: any) => ({
    m,
    score: puntuarRelevanciaEpistemologica(m),
  }));
  scored.sort((a, b) => b.score - a.score);

  const procesadas = scored.map(s => s.m);

  // Para VOZ_Y_VOTO: clasificar por sub-nivel institucional
  let clasificacion: Record<string, any[]> | undefined;
  if (tipo === 'VOZ_Y_VOTO') {
    clasificacion = {};
    for (const m of procesadas) {
      const { nivel, esRepercusion } = clasificarNivelInstitucional(m);
      const key = esRepercusion ? `${nivel} (Repercusión)` : nivel;
      if (!clasificacion[key]) clasificacion[key] = [];
      clasificacion[key].push(m);
    }
  }

  return {
    menciones: procesadas,
    clasificacion,
    stats: {
      antes: menciones.length,
      despues: procesadas.length,
      motivosExclusion,
    },
  };
}
