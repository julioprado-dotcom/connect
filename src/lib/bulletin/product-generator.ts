// Product Generator - Generacion de productos ONION200
// DECODEX Bolivia
// Delega la config de productos a constants/products.ts

import type { TipoBoletin, ProductoConfig } from '@/types/bulletin'
import { PRODUCTOS } from '@/constants/products'

// Obtener config de un producto por tipo
export function getProductConfig(tipo: TipoBoletin): ProductoConfig | null {
  return PRODUCTOS[tipo] || null
}

// Obtener menciones para un boletin
export async function getMencionesForBulletin(
  tipo: TipoBoletin,
  options: { personaId?: string; ejesTematicos?: string[] } = {},
): Promise<{
  menciones: Record<string, unknown>[]
  fechaInicio: Date
  fechaFin: Date
  totalMenciones: number
}> {
  const now = new Date()
  const config = getProductConfig(tipo)
  const dias = config?.periodoDefault || 1

  const fechaFin = new Date(now)
  const fechaInicio = new Date(now)
  fechaInicio.setDate(fechaInicio.getDate() - dias)

  return {
    menciones: [],
    fechaInicio,
    fechaFin,
    totalMenciones: 0,
  }
}

// Formatear fecha en zona horaria de Bolivia (America/La_Paz, UTC-4)
export function formatFechaBolivia(date: Date): string {
  const opciones: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/La_Paz',
  }
  return date.toLocaleDateString('es-BO', opciones)
}

// Obtener rango de fechas por tipo de producto
export function getDateRange(tipo: string): { fechaInicio: Date; fechaFin: Date } {
  const ahora = new Date()
  const hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate())

  switch (tipo) {
    case 'EL_RADAR': {
      // Semana pasada (lunes a domingo)
      const diaSemana = hoy.getDay()
      const lunesPasado = new Date(hoy)
      lunesPasado.setDate(hoy.getDate() - ((diaSemana === 0 ? 6 : diaSemana - 1) + 7))
      const domingoPasado = new Date(lunesPasado)
      domingoPasado.setDate(lunesPasado.getDate() + 6)
      return { fechaInicio: lunesPasado, fechaFin: domingoPasado }
    }

    case 'EL_TERMOMETRO':
    case 'EL_FOCO':
    case 'EL_ESPECIALIZADO':
    default: {
      // Ultimos 7 dias
      const inicio = new Date(hoy)
      inicio.setDate(hoy.getDate() - 7)
      return { fechaInicio: inicio, fechaFin: hoy }
    }

    case 'FICHA_LEGISLADOR': {
      // Ultimos 30 dias
      const inicio30 = new Date(hoy)
      inicio30.setDate(hoy.getDate() - 30)
      return { fechaInicio: inicio30, fechaFin: hoy }
    }
  }
}
