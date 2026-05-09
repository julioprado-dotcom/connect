// Tracker de histograma de publicacion - DECODEX Bolivia
// Actualiza horasPublicacion en FuenteEstado con cada cambio detectado
// El histograma registra en que horas se detectaron cambios reales

import db from '@/lib/db'
import type { Histograma } from '../types'
import { HISTOGRAM_WINDOW_DAYS } from './calculator'

// Registrar un cambio en el histograma de una fuente
export async function registrarCambio(
  fuenteId: string,
  fechaCambio?: Date,
): Promise<Histograma> {
  const ahora = fechaCambio || new Date()
  const hora = ahora.getHours()

  const fuente = await db.fuenteEstado.findUnique({
    where: { id: fuenteId },
  })

  if (!fuente) throw new Error(`FuenteEstado ${fuenteId} no encontrada`)

  // Parsear histograma existente
  let histograma: Histograma = {}
  try {
    const parsed = JSON.parse(fuente.horasPublicacion || '{}')
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      histograma = parsed
    }
  } catch {
    // Corrupto, resetear
    histograma = {}
  }

  // Incrementar contador de la hora actual
  const horaKey = String(hora)
  histograma[horaKey] = (histograma[horaKey] || 0) + 1

  // Limpiar datos antiguos (recalcular solo con ultimos 30 dias)
  const histogramaLimpio = await recalcularHistograma(fuenteId, histograma)

  // Guardar en DB
  await db.fuenteEstado.update({
    where: { id: fuenteId },
    data: {
      horasPublicacion: JSON.stringify(histogramaLimpio),
    },
  })

  return histogramaLimpio
}

// Recalcular histograma basandose en datos de cambios reales en los ultimos 30 dias
async function recalcularHistograma(
  fuenteId: string,
  histogramaActual: Histograma,
): Promise<Histograma> {
  // Si no tenemos datos de ultimo cambio, mantener el histograma incremental
  const fuente = await db.fuenteEstado.findUnique({
    where: { id: fuenteId },
    select: { ultimoCambio: true, totalCambios: true },
  })

  if (!fuente || !fuente.ultimoCambio) return histogramaActual

  // Si el total de cambios coincide aproximadamente con la suma del histograma,
  // el histograma esta sincronizado. Si no, podria estar corrupto.
  const sumaHistograma = Object.values(histogramaActual).reduce((a, b) => a + b, 0)

  // Si hay mas del doble de diferencia, limitar al rango de 30 dias estimado
  if (sumaHistograma > fuente.totalCambios * 2) {
    // Normalizar: reducir proporcionalmente
    const factor = fuente.totalCambios / sumaHistograma
    const normalizado: Histograma = {}
    for (const [hora, count] of Object.entries(histogramaActual)) {
      const nuevoCount = Math.round(count * factor)
      if (nuevoCount > 0) {
        normalizado[hora] = nuevoCount
      }
    }
    return normalizado
  }

  return histogramaActual
}

// Obtener el histograma actual de una fuente
export async function getHistograma(fuenteId: string): Promise<Histograma> {
  const fuente = await db.fuenteEstado.findUnique({
    where: { id: fuenteId },
    select: { horasPublicacion: true },
  })

  if (!fuente) return {}

  try {
    const parsed = JSON.parse(fuente.horasPublicacion || '{}')
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Histograma
    }
  } catch {
    // Corrupto
  }
  return {}
}

// Limpiar histograma de una fuente (reset)
export async function resetHistograma(fuenteId: string): Promise<void> {
  await db.fuenteEstado.update({
    where: { id: fuenteId },
    data: {
      horasPublicacion: '{}',
    },
  })
}

// Recalcular horarios optimos para una fuente y guardarlos
export async function recalcularHorarios(fuenteId: string): Promise<number[]> {
  const { calcularHorariosOptimos } = await import('./calculator')
  const { frecuenciaToChecksDia } = await import('../frequency/calculator')

  const fuente = await db.fuenteEstado.findUnique({
    where: { id: fuenteId },
  })

  if (!fuente) throw new Error(`FuenteEstado ${fuenteId} no encontrada`)

  // Obtener histograma
  const histograma = await getHistograma(fuenteId)

  // Numero de chequeos basado en frecuencia efectiva
  const numChecks = frecuenciaToChecksDia(fuente.frecuenciaActual)

  // Calcular horarios optimos
  const horarios = calcularHorariosOptimos(histograma, Math.max(numChecks, 1))

  // Guardar en DB
  await db.fuenteEstado.update({
    where: { id: fuenteId },
    data: {
      horariosOptimos: JSON.stringify(horarios),
    },
  })

  return horarios
}

// Batch: recalcular horarios para todas las fuentes activas (mantenimiento)
export async function batchRecalcularHorarios(): Promise<number> {
  const fuentes = await db.fuenteEstado.findMany({
    where: { activo: true },
    select: { id: true },
  })

  let count = 0
  for (const fuente of fuentes) {
    try {
      await recalcularHorarios(fuente.id)
      count++
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      console.warn(`[Histograma] Error recalculando horarios para ${fuente.id}: ${msg}`)
    }
  }

  return count
}
