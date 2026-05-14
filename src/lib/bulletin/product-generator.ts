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

  // Obtener menciones por rango de fechas.
  // Prisma 6.x tiene bug con filtros OR + fecha en SQLite que devuelve 0.
  // Workaround: obtener IDs con raw SQL y luego findMany con id IN.
  const inicioStr = fechaInicio.toISOString();
  const finStr = fechaFin.toISOString();
  const personaFilter = options.personaId ? `AND m.personaId = '${options.personaId}'` : '';
  const sql = [
    'SELECT DISTINCT m.id FROM Mencion m',
    'WHERE m.esDuplicado = 0',
    '  AND (',
    `    (m.fechaPublicacion IS NOT NULL AND m.fechaPublicacion >= '${inicioStr}' AND m.fechaPublicacion < '${finStr}')`,
    '    OR',
    `    (m.fechaPublicacion IS NULL AND m.fechaCaptura >= '${inicioStr}' AND m.fechaCaptura < '${finStr}')`,
    '  )',
    personaFilter,
  ].join('\n');
  const idsRaw = await db.$queryRawUnsafe<Array<{ id: string }>>(sql)
  const mencionesIds = idsRaw.map(r => r.id);

  // Filtrar por ejes tematicos si se piden (post-filter sobre los IDs)
  let finalIds = mencionesIds;
  if (options.ejesTematicos && options.ejesTematicos.length > 0) {
    const withEjes = await db.mencionTema.findMany({
      where: { ejeTematicoId: { in: options.ejesTematicos }, mencionId: { in: mencionesIds } },
      select: { mencionId: true },
    });
    const ejesSet = new Set(withEjes.map(e => e.mencionId));
    finalIds = mencionesIds.filter(id => ejesSet.has(id));
  }

  const where: Record<string, unknown> = finalIds.length > 0
    ? { id: { in: finalIds } }
    : { id: { in: ['__none__'] } } // Forzar vacío si no hay IDs

  const menciones = await db.mencion.findMany({
    where,
    include: {
      Persona: {
        select: { id: true, nombre: true, partidoSigla: true, camara: true, departamento: true },
      },
      Medio: {
        select: { id: true, nombre: true, tipo: true },
      },
      MencionTema: {
        select: {
          EjeTematico: { select: { id: true, nombre: true, slug: true, color: true } },
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
    persona: m.Persona?.nombre ?? null,
    personaId: m.personaId,
    partidoSigla: m.Persona?.partidoSigla ?? null,
    camara: m.Persona?.camara ?? null,
    medio: m.Medio?.nombre ?? 'Desconocido',
    medioTipo: m.Medio?.tipo ?? null,
    sentimiento: m.tratamientoPeriodistico || m.sentimiento,
    tratamientoPeriodistico: m.tratamientoPeriodistico,
    intencionMedio: m.intencionMedio,
    confianzaClasificacion: m.confianzaClasificacion,
    temas: m.MencionTema.map((et) => et.EjeTematico.nombre),
    temasSlugs: m.MencionTema.map((et) => et.EjeTematico.slug),
    temasColores: m.MencionTema.map((et) => et.EjeTematico.color),
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
    case 'EL_RADAR':
    case 'BOLETIN_DEL_GRANO': {
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
    case 'SALDO_DEL_DIA':
    case 'EL_HILO':
    case 'ALERTA_TEMPRANA':
    default: {
      // Últimos 7 días (inclusive hoy hasta fin de día)
      const inicio = new Date(hoy)
      inicio.setDate(hoy.getDate() - 7)
      const maniana = new Date(hoy)
      maniana.setDate(hoy.getDate() + 1)
      return { fechaInicio: inicio, fechaFin: maniana }
    }

    case 'FICHA_LEGISLADOR': {
      // Últimos 30 días (inclusive hoy hasta fin de día)
      const inicio30 = new Date(hoy)
      inicio30.setDate(hoy.getDate() - 30)
      const maniana30 = new Date(hoy)
      maniana30.setDate(hoy.getDate() + 1)
      return { fechaInicio: inicio30, fechaFin: maniana30 }
    }
  }
}
