// Product Generator - Generacion de productos ONION200
// DECODEX Bolivia
// Delega la config de productos a constants/products.ts

import db from '@/lib/db'
import { Prisma } from '@prisma/client'
import type { TipoBoletin, ProductoConfig } from '@/types/bulletin'
import { PRODUCTOS } from '@/constants/products'
import {
  boliviaStartOfDay,
  boliviaStartOfYesterday,
  boliviaDaysAgo,
  boliviaStartOfWeek,
} from '@/lib/date-bolivia'

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
  // FIX: SQLite almacena DateTime como integer (Unix ms), NO como ISO string.
  // Pasar timestamps numéricos para que la comparación integer >= integer funcione.
  const inicioMs = fechaInicio.getTime();
  const finMs = fechaFin.getTime();
  const sql = Prisma.sql`
    SELECT DISTINCT m.id FROM Mencion m
    WHERE m.esDuplicado = 0
      AND (
        (m.fechaPublicacion IS NOT NULL AND m.fechaPublicacion >= ${inicioMs} AND m.fechaPublicacion < ${finMs})
        OR
        (m.fechaPublicacion IS NULL AND m.fechaCaptura >= ${inicioMs} AND m.fechaCaptura < ${finMs})
      )
      ${options.personaId ? Prisma.sql`AND m.personaId = ${options.personaId}` : Prisma.sql``}
  `;
  const idsRaw = await db.$queryRaw<Array<{ id: string }>>(sql)
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
    sentimiento: m.tratamientoPeriodistico,
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

// ─── CONTEXTO HISTORICO (para tendencias) ─────────────────────────
// Query ligera: 7 dias de menciones con solo titulo, medio, temas y sentimiento.
// NO incluye texto completo. Sirve para que la IA detecte tendencias,
// temas emergentes y evolucion de hechos — pero el producto solo reporta
// las menciones de la ventana principal.
export async function getContextMenciones(
  dias: number = 7,
  excludeAfter?: Date,
): Promise<Array<Record<string, unknown>>> {
  const hoy = boliviaStartOfDay()
  const inicio = boliviaDaysAgo(dias)
  const fin = excludeAfter ?? hoy

  const inicioMs = inicio.getTime()
  const finMs = fin.getTime()

  const sql = Prisma.sql`
    SELECT m.id, m.titulo, m.fechaCaptura,
           p.nombre as persona, p.partidoSigla,
           md.nombre as medio,
           m.sentimiento, m.tratamientoPeriodistico
    FROM Mencion m
    LEFT JOIN Persona p ON m.personaId = p.id
    LEFT JOIN Medio md ON m.medioId = md.id
    WHERE m.esDuplicado = 0
      AND (
        (m.fechaPublicacion IS NOT NULL AND m.fechaPublicacion >= ${inicioMs} AND m.fechaPublicacion < ${finMs})
        OR
        (m.fechaPublicacion IS NULL AND m.fechaCaptura >= ${inicioMs} AND m.fechaCaptura < ${finMs})
      )
    ORDER BY m.fechaCaptura DESC
    LIMIT 200
  `
  const rows = await db.$queryRaw<Array<Record<string, unknown>>>(sql)

  const mids = rows.map(r => r.id as string)
  let temaMap: Record<string, string[]> = {}
  if (mids.length > 0) {
    const temas = await db.mencionTema.findMany({
      where: { mencionId: { in: mids } },
      include: { EjeTematico: { select: { nombre: true } } },
    })
    for (const t of temas) {
      if (!temaMap[t.mencionId]) temaMap[t.mencionId] = []
      temaMap[t.mencionId].push(t.EjeTematico.nombre)
    }
  }

  return rows.map(r => ({
    titulo: r.titulo,
    medio: r.medio ?? 'Desconocido',
    persona: r.persona ?? null,
    partidoSigla: r.partidoSigla ?? null,
    sentimiento: (r.tratamientoPeriodistico as string) || (r.sentimiento as string) || null,
    temas: temaMap[r.id as string] ?? [],
    fechaCaptura: r.fechaCaptura,
  }))
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

// Obtener rango de fechas por tipo de producto.
// Lee la ventana configurada en PRODUCTOS[tipo].generador.ventana.
// Siempre devuelve [inicio, fin) — fin es exclusivo.
export function getDateRange(tipo: string): { fechaInicio: Date; fechaFin: Date } {
  const config = PRODUCTOS[tipo as TipoBoletin]
  const ventana = config?.generador?.ventana ?? 'estandar'
  const hoy = boliviaStartOfDay()
  const maniana = new Date(hoy.getTime() + 24 * 60 * 60 * 1000)

  switch (ventana) {
    // ── EL_TERMOMETRO: ayer 19:00 Bolivia → hoy 07:00 Bolivia ──
    case 'nocturna': {
      const ayerInicio = boliviaStartOfYesterday()
      const inicio = new Date(ayerInicio.getTime() + 19 * 60 * 60 * 1000) // ayer 19:00 BO
      const fin = new Date(hoy.getTime() + 7 * 60 * 60 * 1000)             // hoy 07:00 BO
      return { fechaInicio: inicio, fechaFin: fin }
    }

    // ── SALDO_DEL_DIA: hoy 07:00 Bolivia → hoy 19:00 Bolivia ──
    case 'diurna': {
      const inicio = new Date(hoy.getTime() + 7 * 60 * 60 * 1000)   // hoy 07:00 BO
      const fin = new Date(hoy.getTime() + 19 * 60 * 60 * 1000)     // hoy 19:00 BO
      return { fechaInicio: inicio, fechaFin: fin }
    }

    // ── EL_FOCO: dia completo (00:00 → 23:59:59.999) ──
    case 'dia_completo': {
      const fin = new Date(hoy.getTime() + 24 * 60 * 60 * 1000 - 1) // hoy 23:59:59.999 BO
      return { fechaInicio: hoy, fechaFin: fin }
    }

    // ── EL_ESPECIALIZADO: ultimos 2 dias completos ──
    case '2dias': {
      const inicio = boliviaDaysAgo(2)
      return { fechaInicio: inicio, fechaFin: maniana }
    }

    // ── Semanales: semana pasada lunes 00:00 → domingo 23:59:59.999 ──
    case 'semanal': {
      const lunesActual = boliviaStartOfWeek()
      const lunesPasado = new Date(lunesActual.getTime() - 7 * 24 * 60 * 60 * 1000)
      const domingoFin = new Date(lunesActual.getTime() - 1) // domingo 23:59:59.999
      return { fechaInicio: lunesPasado, fechaFin: domingoFin }
    }

    // ── FICHA_LEGISLADOR: ultimos 30 dias ──
    case 'mensual': {
      const inicio = boliviaDaysAgo(30)
      return { fechaInicio: inicio, fechaFin: maniana }
    }

    // ── Por defecto (estandar): usa periodoDefault de la config ──
    default: {
      const dias = config?.periodoDefault ?? 1
      const inicio = dias > 1 ? boliviaDaysAgo(dias) : hoy
      return { fechaInicio: inicio, fechaFin: maniana }
    }
  }
}