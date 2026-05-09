// Product Generator - Generacion de productos ONION200
// DECODEX Bolivia
// Delega la config de productos a constants/products.ts

import db from '@/lib/db'
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
  const { fechaInicio, fechaFin } = getDateRange(tipo)

  // Construir filtros base
  const where: Record<string, unknown> = {
    fechaCaptura: { gte: fechaInicio, lt: fechaFin },
    esDuplicado: false,
  }

  if (options.personaId) {
    where.personaId = options.personaId
  }

  // Si se piden ejes tematicos, filtrar menciones que tengan esos ejes
  if (options.ejesTematicos && options.ejesTematicos.length > 0) {
    where.ejesTematicos = {
      some: {
        ejeTematicoId: { in: options.ejesTematicos },
      },
    }
  }

  const menciones = await db.mencion.findMany({
    where,
    include: {
      persona: {
        select: { id: true, nombre: true, partidoSigla: true, camara: true, departamento: true },
      },
      medio: {
        select: { id: true, nombre: true, tipo: true },
      },
      ejesTematicos: {
        select: {
          ejeTematico: { select: { id: true, nombre: true, slug: true, color: true } },
        },
      },
    },
    orderBy: { fechaCaptura: 'desc' },
  })

  // Formatear para consumo del generador
  const mencionesFormateadas = menciones.map((m) => ({
    id: m.id,
    titulo: m.titulo,
    texto: m.texto,
    textoCompleto: m.textoCompleto,
    url: m.url,
    fechaPublicacion: m.fechaPublicacion,
    fechaCaptura: m.fechaCaptura,
    tipoMencion: m.tipoMencion,
    persona: m.persona?.nombre ?? null,
    personaId: m.personaId,
    partidoSigla: m.persona?.partidoSigla ?? null,
    camara: m.persona?.camara ?? null,
    medio: m.medio?.nombre ?? 'Desconocido',
    medioTipo: m.medio?.tipo ?? null,
    sentimiento: m.tratamientoPeriodistico || m.sentimiento,
    tratamientoPeriodistico: m.tratamientoPeriodistico,
    intencionMedio: m.intencionMedio,
    confianzaClasificacion: m.confianzaClasificacion,
    temas: m.ejesTematicos.map((et) => et.ejeTematico.nombre),
    temasSlugs: m.ejesTematicos.map((et) => et.ejeTematico.slug),
    temasColores: m.ejesTematicos.map((et) => et.ejeTematico.color),
    reach: m.reach,
    verificado: m.verificado,
  }))

  return {
    menciones: mencionesFormateadas as Record<string, unknown>[],
    fechaInicio,
    fechaFin,
    totalMenciones: menciones.length,
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
