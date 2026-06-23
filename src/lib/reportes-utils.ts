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
    const ejes = data.ejes as Record<string, number>;
    const fecha = data.fecha as string;
    const totalMenciones = Object.values(ejes).reduce((a, b) => a + b, 0);
    return `Radar semanal ${fecha} | ${Object.keys(ejes).length} ejes | ${totalMenciones} menciones totales`;
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

  partes.push(
    `\nGenera el producto "${tipo}" siguiendo las instrucciones del sistema.`,
    `Fecha de referencia: ${formatFechaBolivia(new Date())}.`,
    `Semana del ano: ${getSemanaAnho()}.`
  );

  // ═══ REFUERZO FINAL — REGLAS DE GENERACIÓN ═══
  // Se repiten al FINAL del user prompt para combatir el recency bias del LLM.
  partes.push(
    `\n\nREGLAS FINALES DE ESTE PRODUCTO:`,
    `1. SOLO DATOS DE MENCIONES: Cada dato que escribas debe estar en las menciones proporcionadas. No inventes, no deduzcas, no rellenes.`,
    `2. ATRIBUCION: Cada afirmacion va con (Fuente: nombre del medio). Si un medio reporta que alguien dijo algo sin cita directa, usa "según [medio]". Si dos o más medios reportan lo mismo de forma independiente, puedes usar "según varios medios". Si hay cita textual con comillas, presenta como declaracion directa del actor.`,
    `3. FECHAS CONCRETAS: Si una mencion dice "mañana", "hoy", "la proxima semana" u otra referencia temporal vaga, conviértela a la fecha concreta correspondiente usando la fecha de referencia proporcionada. Nunca uses "dia siguiente" ni expresiones temporales vagas.`,
    `4. PLURALIDAD DE VOCES: Si hay versiones contrapuestas entre actores, reporta AMBAS con sus fuentes. Ningun actor (gobierno, oposicion, sector social, organismo internacional) es fuente de verdad por defecto.`,
    `5. SINTESIS PERMITIDA: Puedes agrupar menciones por tema, cruzar fuentes, e identificar patrones — siempre citando fuentes. No se permite inventar causas, intenciones ni contextos que no esten en las menciones.`,
    `VIOLACION DE LAS REGLAS 1-4 = PRODUCTO INVALIDO.`
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
export function formatearMencionesPrompt(menciones: any[], tipo?: string): string {
  if (menciones.length === 0) {
    return 'No se encontraron menciones en el periodo consultado.';
  }

  const esDiario = tipo && ['EL_TERMOMETRO_AM', 'EL_TERMOMETRO_PM', 'EL_FOCO', 'SALDO_DEL_DIA', 'EL_ALERTA', 'ALERTA_TEMPRANA'].includes(tipo);
  const limite = esDiario ? MAX_MENCIONES_DIARIO : MAX_MENCIONES_PROMPT;

  let seleccionadas: any[];
  if (menciones.length > limite) {
    // Diario y semanal: relevancia epistemologica composite (unificado)
    seleccionadas = seleccionarMencionesEpistemologicas(menciones, limite);
    console.log(`[formatearMencionesPrompt] ${esDiario ? 'Diario' : 'Semanal'}: truncando ${menciones.length} → ${seleccionadas.length} (relevancia epistemologica composite)`);
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
    // Incluir primeros 300 caracteres del texto del artículo para dar contexto real al LLM
    const textoArticulo = m.texto ?? m.textoCompleto ?? '';
    if (textoArticulo) {
      const textoCorto = textoArticulo.length > 300
        ? textoArticulo.substring(0, 300) + '...'
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
  clienteId?: string;
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
        totalMenciones: 0,
        sentimientoPromedio: 0,
        temasPrincipales: '',
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
