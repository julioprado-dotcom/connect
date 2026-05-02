/**
 * Product Generator — ONION200 / DECODEX Bolivia
 * Genera la configuración necesaria para producir cada tipo de boletín.
 */

import { PRODUCTOS } from '@/constants/products'
import { type TipoBoletin, type ProductoConfig } from '@/types/bulletin'
import { db as prisma } from '@/lib/db'

// ─── Obtener configuración de producto ────────────────────────────

export function getProductConfig(tipo: TipoBoletin): ProductoConfig | null {
  return PRODUCTOS[tipo] ?? null
}

// ─── Obtener todos los productos activos ──────────────────────────

export function getActiveProducts(): ProductoConfig[] {
  return Object.values(PRODUCTOS).filter(p => p.activo)
}

// ─── Calcular rango de fechas para un producto ────────────────────

export function getDateRange(tipo: TipoBoletin, customDays?: number): {
  fechaInicio: Date
  fechaFin: Date
} {
  const config = PRODUCTOS[tipo]
  const days = customDays ?? config.periodoDefault

  const fechaFin = new Date()
  const fechaInicio = new Date()

  if (tipo === 'SALDO_DEL_DIA') {
    // Saldo del Día: rango del día de hoy (jornada completa)
    fechaInicio.setHours(0, 0, 0, 0)
    fechaFin.setHours(23, 59, 59, 999)
  } else if (tipo === 'EL_TERMOMETRO') {
    // Termómetro: desde ayer hasta ahora (para dar contexto de apertura)
    fechaInicio.setDate(fechaInicio.getDate() - 1)
    fechaInicio.setHours(0, 0, 0, 0)
  } else if (config.frecuencia === 'semanal') {
    // Semanales: lunes anterior a domingo
    const dayOfWeek = fechaInicio.getDay()
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
    fechaInicio.setDate(fechaInicio.getDate() - daysToMonday - 7)
    fechaInicio.setHours(0, 0, 0, 0)
    fechaFin.setDate(fechaFin.getDate() - daysToMonday)
    fechaFin.setHours(23, 59, 59, 999)
  } else if (config.frecuencia === 'mensual') {
    // Mensuales: primer día del mes anterior al último
    fechaInicio.setMonth(fechaInicio.getMonth() - 1, 1)
    fechaInicio.setHours(0, 0, 0, 0)
    fechaFin.setDate(0) // último día del mes anterior
    fechaFin.setHours(23, 59, 59, 999)
  } else {
    // Diarios por defecto
    fechaInicio.setDate(fechaInicio.getDate() - days)
    fechaInicio.setHours(0, 0, 0, 0)
  }

  return { fechaInicio, fechaFin }
}

// ─── Obtener menciones para un boletín ───────────────────────────

export async function getMencionesForBulletin(
  tipo: TipoBoletin,
  options?: {
    ejesTematicos?: string[]
    personaId?: string
    customDays?: number
  }
) {
  const { fechaInicio, fechaFin } = getDateRange(tipo, options?.customDays)

  const where: Record<string, unknown> = {
    fechaCaptura: {
      gte: fechaInicio,
      lte: fechaFin,
    },
  }

  if (options?.personaId) {
    where.personaId = options.personaId
  }

  const menciones = await prisma.mencion.findMany({
    where,
    include: {
      persona: { select: { id: true, nombre: true, partidoSigla: true, camara: true } },
      medio: { select: { id: true, nombre: true, nivel: true, tipo: true } },
      ejesTematicos: {
        include: {
          ejeTematico: { select: { id: true, nombre: true, slug: true } },
        },
      },
    },
    orderBy: { fechaPublicacion: 'desc' },
    take: tipo === 'EL_FOCO' ? 50 : 100,
  })

  // Filtrar por ejes temáticos si se especificaron
  const mencionesFiltradas = options?.ejesTematicos && options.ejesTematicos.length > 0
    ? menciones.filter(m =>
        m.ejesTematicos.some(et =>
          options.ejesTematicos!.includes(et.ejeTematico.slug)
        )
      )
    : menciones

  return {
    menciones: mencionesFiltradas,
    fechaInicio,
    fechaFin,
    totalMenciones: mencionesFiltradas.length,
  }
}

// ─── Formatear fecha para Bolivia ─────────────────────────────────

export function formatFechaBolivia(fecha: Date): string {
  return fecha.toLocaleDateString('es-BO', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'America/La_Paz',
  })
}

export function formatHoraBolivia(fecha: Date): string {
  return fecha.toLocaleTimeString('es-BO', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/La_Paz',
  })
}
