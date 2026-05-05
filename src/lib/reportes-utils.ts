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

import { db } from '@/lib/db';
import { type TipoBoletin, type VentanaTipo } from '@/types/bulletin';
import { formatFechaBolivia } from '@/lib/bulletin/product-generator';

// Re-exportar para uso por otros módulos del Equipo B
export { formatFechaBolivia } from '@/lib/bulletin/product-generator';
import { getIndicadoresParaEje, getIndicadoresParaEjes, formatearIndicadoresPrompt } from '@/lib/indicadores/injector';

// ============================================
// Tipos exportados para reportes
// ============================================

/** Mencion con relaciones incluidas (persona, medio, ejesTematicos) */
export interface MencionConRelaciones {
  id: string
  personaId: string
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
  persona: {
    id: string
    nombre: string
    camara: string
    departamento: string
    partidoSigla: string
  } | null
  medio: {
    id: string
    nombre: string
    tipo: string
    nivel: string
  } | null
  ejesTematicos: {
    ejeTematico: {
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

/** Calcula fecha inicio y fin segun el tipo de ventana */
export function calculateWindow(
  ventana: VentanaTipo,
  fechaStr?: string
): { fechaInicio: Date; fechaFin: Date; ventanaLabel: string } {
  const fechaBase = fechaStr ? new Date(fechaStr + 'T12:00:00') : new Date()
  const fechaFin = new Date(fechaBase)
  const fechaInicio = new Date(fechaBase)

  switch (ventana) {
    case 'nocturna':
      // Ayer 19:00 → hoy 07:00
      fechaInicio.setDate(fechaInicio.getDate() - 1)
      fechaInicio.setHours(19, 0, 0, 0)
      fechaFin.setHours(7, 0, 0, 0)
      return { fechaInicio, fechaFin, ventanaLabel: `${formatFechaBolivia(fechaInicio)} — ${formatFechaBolivia(fechaFin)}` }

    case 'diurna':
      // Hoy 07:00 → 19:00
      fechaInicio.setHours(7, 0, 0, 0)
      fechaFin.setHours(19, 0, 0, 0)
      return { fechaInicio, fechaFin, ventanaLabel: `${formatFechaBolivia(fechaInicio)} — ${formatFechaBolivia(fechaFin)}` }

    case 'dia_completo':
      // 00:00 → 23:59 del día
      fechaInicio.setHours(0, 0, 0, 0)
      fechaFin.setHours(23, 59, 59, 999)
      return { fechaInicio, fechaFin, ventanaLabel: formatFechaBolivia(fechaInicio) }

    case 'semanal':
      // Lunes 00:00 → domingo 23:59
      const dayOfWeek = fechaInicio.getDay()
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
      fechaInicio.setDate(fechaInicio.getDate() - daysToMonday)
      fechaInicio.setHours(0, 0, 0, 0)
      fechaFin.setDate(fechaInicio.getDate() + 6)
      fechaFin.setHours(23, 59, 59, 999)
      return { fechaInicio, fechaFin, ventanaLabel: `${formatFechaBolivia(fechaInicio)} al ${formatFechaBolivia(fechaFin)}` }

    case 'quincenal':
      fechaInicio.setDate(fechaInicio.getDate() - 14)
      fechaInicio.setHours(0, 0, 0, 0)
      fechaFin.setHours(23, 59, 59, 999)
      return { fechaInicio, fechaFin, ventanaLabel: `${formatFechaBolivia(fechaInicio)} al ${formatFechaBolivia(fechaFin)}` }

    case 'mensual':
      fechaInicio.setMonth(fechaInicio.getMonth() - 1, 1)
      fechaInicio.setHours(0, 0, 0, 0)
      fechaFin.setDate(0)
      fechaFin.setHours(23, 59, 59, 999)
      return { fechaInicio, fechaFin, ventanaLabel: `${formatFechaBolivia(fechaInicio)} al ${formatFechaBolivia(fechaFin)}` }

    case 'estandar':
    default:
      // 7 días por defecto
      fechaInicio.setDate(fechaInicio.getDate() - 7)
      fechaInicio.setHours(0, 0, 0, 0)
      fechaFin.setHours(23, 59, 59, 999)
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

const SENTIMENT_SCORES: Record<string, number> = {
  positivo: 5,
  ligeramente_positivo: 4,
  neutral: 3,
  ligeramente_negativo: 2,
  negativo: 1,
  no_clasificado: 3,
}

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
    const score = SENTIMENT_SCORES[m.sentimiento] ?? 3
    total += score
    distribucion[m.sentimiento] = (distribucion[m.sentimiento] || 0) + 1
  }
  const promedio = total / menciones.length
  const label =
    promedio >= 4 ? 'POSITIVO' :
    promedio >= 3.5 ? 'MODERADAMENTE POSITIVO' :
    promedio >= 3 ? 'NEUTRAL' :
    promedio >= 2 ? 'NEGATIVO' :
    'CRITICO'

  return { promedio, distribucion, label }
}

/** Obtiene el label extendido del sentimiento */
export function getSentimientoLabelExtendido(sentimientoPromedio: number): string {
  if (sentimientoPromedio >= 4.5) return 'MUY POSITIVO'
  if (sentimientoPromedio >= 4) return 'POSITIVO'
  if (sentimientoPromedio >= 3.5) return 'MODERADAMENTE POSITIVO'
  if (sentimientoPromedio >= 3) return 'NEUTRAL'
  if (sentimientoPromedio >= 2.5) return 'MODERADAMENTE NEGATIVO'
  if (sentimientoPromedio >= 2) return 'NEGATIVO'
  return 'MUY NEGATIVO'
}

/** Obtiene los top N actores por menciones */
export function calculateTopActores(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  menciones: any[],
  limit: number = 10
): TopActorItem[] {
  const counts: Record<string, { nombre: string; partido: string; camara: string; departamento: string; count: number }> = {}
  for (const m of menciones) {
    if (m.persona) {
      const key = m.persona.id
      if (!counts[key]) {
        counts[key] = {
          nombre: m.persona.nombre,
          partido: m.persona.partidoSigla,
          camara: m.persona.camara,
          departamento: m.persona.departamento,
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
    if (m.medio) {
      const key = m.medio.id
      if (!counts[key]) {
        counts[key] = { nombre: m.medio.nombre, tipo: m.medio.tipo, nivel: m.medio.nivel, count: 0 }
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
    if (m.ejesTematicos) {
      for (const et of m.ejesTematicos) {
        const slug = et.ejeTematico.slug
        if (!counts[slug]) {
          counts[slug] = { slug, nombre: et.ejeTematico.nombre, menciones: 0 }
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
    const positivos = menciones.filter(m => m.sentimiento === 'positivo').length;
    const negativos = menciones.filter(m => m.sentimiento === 'negativo').length;
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
  datosExtra?: string
): string {
  const partes: string[] = [
    `## Datos de Menciones\n${menciones}`,
  ];

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

  return partes.join('\n\n');
}

// ============================================
// Formateo de Menciones para Prompts
// ============================================

/**
 * Formatea una lista de menciones como texto para prompts.
 * Acepta menciones de Prisma (con relaciones incluidas) u objetos planos.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function formatearMencionesPrompt(menciones: any[]): string {
  if (menciones.length === 0) {
    return 'No se encontraron menciones en el periodo consultado.';
  }

  return menciones.map((m, i) => {
    const parts = [
      `${i + 1}. **${m.titulo}**`,
      `   - Medio: ${m.medio ?? 'No especificado'}`,
      `   - Fecha: ${m.fechaPublicacion ?? 'N/D'}`,
    ];
    if (m.persona) parts.push(`   - Persona: ${m.persona}`);
    if (m.sentimiento) parts.push(`   - Sentimiento: ${m.sentimiento}`);
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
}): Promise<string | null> {
  try {
    const reporte = await db.reporte.create({
      data: {
        tipo: params.tipoProducto,
        resumen: params.resumen ?? params.titulo ?? '',
        contenido: params.contenido,
        fechaInicio: params.fechaInicio,
        fechaFin: params.fechaFin,
      },
    });
    return reporte.id;
  } catch (error) {
    console.error('[reportes-utils] Error registrando reporte:', error);
    return null;
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
  };

  return titulos[tipo];
}
