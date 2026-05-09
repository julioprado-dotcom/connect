// Adaptador de frecuencia con la base de datos - DECODEX Bolivia
// Conecta la logica de calculator.ts con el modelo FuenteEstado
// Se usa desde el scheduler y desde los runners de check

import db from '@/lib/db'
import {
  getFrecuenciaBase,
  shouldDegrade,
  degradeFrecuencia,
  restoreFrecuencia,
  getFrecuenciaEfectiva,
} from './calculator'
import { deserializeOverride, isOverrideActive } from './override'

// Resultado de la evaluacion de frecuencia
export interface FrecuenciaEval {
  fuenteId: string
  medioId: string
  medioNombre: string
  frecuenciaBase: string
  frecuenciaActual: string
  frecuenciaEfectiva: string
  source: 'override' | 'degradada' | 'base'
  checksSinCambio: number
  degradada: boolean
  tieneOverride: boolean
}

// Evaluar y actualizar la frecuencia de una fuente despues de un check
export async function evaluarFrecuencia(
  fuenteId: string,
  huboCambio: boolean,
): Promise<FrecuenciaEval | null> {
  const fuente = await db.fuenteEstado.findUnique({
    where: { id: fuenteId },
    include: { medio: true },
  })

  if (!fuente) return null

  const override = deserializeOverride(fuente.medio.frecuenciaOverride)
  const overrideActivo = override && isOverrideActive(override)

  // Obtener frecuencia efectiva
  const { efectiva, source } = getFrecuenciaEfectiva(
    fuente.frecuenciaBase,
    fuente.frecuenciaActual,
    overrideActivo ? fuente.medio.frecuenciaOverride : null,
  )

  let frecuenciaActualizada = fuente.frecuenciaActual

  if (huboCambio) {
    // Si hubo cambio: restaurar a frecuencia base si estaba degradada
    if (fuente.frecuenciaActual !== fuente.frecuenciaBase) {
      frecuenciaActualizada = restoreFrecuencia(fuente.frecuenciaBase)
      await db.fuenteEstado.update({
        where: { id: fuenteId },
        data: {
          frecuenciaActual: frecuenciaActualizada,
          checksSinCambio: 0,
        },
      })
      console.log(
        `[Frecuencia] Restaurada ${fuente.medio.nombre}: ${fuente.frecuenciaActual} -> ${frecuenciaActualizada} (cambio detectado)`,
      )
    }
    // checksSinCambio ya se resetea a 0 en check-first/strategies.ts
  } else {
    // Sin cambio: verificar si debe degradarse
    if (shouldDegrade(fuente.frecuenciaActual, fuente.checksSinCambio)) {
      // No degradar si hay override activo por contrato
      if (!overrideActivo) {
        const nuevaFreq = degradeFrecuencia(fuente.frecuenciaActual)
        if (nuevaFreq !== fuente.frecuenciaActual) {
          frecuenciaActualizada = nuevaFreq
          await db.fuenteEstado.update({
            where: { id: fuenteId },
            data: {
              frecuenciaActual: nuevaFreq,
              checksSinCambio: 0, // resetear contador despues de degradar
            },
          })
          console.log(
            `[Frecuencia] Degradada ${fuente.medio.nombre}: ${fuente.frecuenciaActual} -> ${nuevaFreq} (${fuente.checksSinCambio} checks sin cambio)`,
          )
        }
      }
    }
  }

  // Recalcular efectiva con el posible cambio
  const { efectiva: efectivaFinal, source: sourceFinal } = getFrecuenciaEfectiva(
    fuente.frecuenciaBase,
    frecuenciaActualizada,
    overrideActivo ? fuente.medio.frecuenciaOverride : null,
  )

  return {
    fuenteId: fuente.id,
    medioId: fuente.medioId,
    medioNombre: fuente.medio.nombre,
    frecuenciaBase: fuente.frecuenciaBase,
    frecuenciaActual: frecuenciaActualizada,
    frecuenciaEfectiva: efectivaFinal,
    source: sourceFinal,
    checksSinCambio: fuente.checksSinCambio,
    degradada: frecuenciaActualizada !== fuente.frecuenciaBase,
    tieneOverride: overrideActivo || false,
  }
}

// Inicializar frecuencia base para una fuente (primera vez o recalculo)
export async function inicializarFrecuencia(fuenteId: string): Promise<string> {
  const fuente = await db.fuenteEstado.findUnique({
    where: { id: fuenteId },
    include: { medio: true },
  })

  if (!fuente) throw new Error(`FuenteEstado ${fuenteId} no encontrada`)

  const base = getFrecuenciaBase(
    fuente.medio.nombre,
    fuente.medio.categoria,
    fuente.url,
  )

  // Solo actualizar si la base cambio o es la primera vez
  if (fuente.frecuenciaBase !== base) {
    await db.fuenteEstado.update({
      where: { id: fuenteId },
      data: {
        frecuenciaBase: base,
        // Si la actual era igual a la vieja base, actualizar tambien
        ...(fuente.frecuenciaActual === fuente.frecuenciaBase
          ? { frecuenciaActual: base }
          : {}),
      },
    })
  }

  return base
}

// Obtener evaluacion de frecuencia sin modificar nada (read-only)
export async function getFrecuenciaEval(fuenteId: string): Promise<FrecuenciaEval | null> {
  const fuente = await db.fuenteEstado.findUnique({
    where: { id: fuenteId },
    include: { medio: true },
  })

  if (!fuente) return null

  const override = deserializeOverride(fuente.medio.frecuenciaOverride)
  const overrideActivo = override && isOverrideActive(override)

  const { efectiva, source } = getFrecuenciaEfectiva(
    fuente.frecuenciaBase,
    fuente.frecuenciaActual,
    overrideActivo ? fuente.medio.frecuenciaOverride : null,
  )

  return {
    fuenteId: fuente.id,
    medioId: fuente.medioId,
    medioNombre: fuente.medio.nombre,
    frecuenciaBase: fuente.frecuenciaBase,
    frecuenciaActual: fuente.frecuenciaActual,
    frecuenciaEfectiva: efectiva,
    source,
    checksSinCambio: fuente.checksSinCambio,
    degradada: fuente.frecuenciaActual !== fuente.frecuenciaBase,
    tieneOverride: overrideActivo || false,
  }
}

// Obtener lista de fuentes degradadas (para el dashboard)
export async function getFuentesDegradadas(): Promise<FrecuenciaEval[]> {
  const fuentes = await db.fuenteEstado.findMany({
    where: {
      activo: true,
    },
    include: { medio: true },
  })

  const degradadas: FrecuenciaEval[] = []
  for (const fuente of fuentes) {
    if (fuente.frecuenciaActual !== fuente.frecuenciaBase) {
      const override = deserializeOverride(fuente.medio.frecuenciaOverride)
      const overrideActivo = override && isOverrideActive(override)
      const { efectiva, source } = getFrecuenciaEfectiva(
        fuente.frecuenciaBase,
        fuente.frecuenciaActual,
        overrideActivo ? fuente.medio.frecuenciaOverride : null,
      )
      degradadas.push({
        fuenteId: fuente.id,
        medioId: fuente.medioId,
        medioNombre: fuente.medio.nombre,
        frecuenciaBase: fuente.frecuenciaBase,
        frecuenciaActual: fuente.frecuenciaActual,
        frecuenciaEfectiva: efectiva,
        source,
        checksSinCambio: fuente.checksSinCambio,
        degradada: true,
        tieneOverride: overrideActivo || false,
      })
    }
  }

  return degradadas.sort((a, b) => b.checksSinCambio - a.checksSinCambio)
}

// Batch: evaluar y actualizar frecuencia para todas las fuentes con checks sin cambio >= umbral
export async function batchDegradar(): Promise<number> {
  const UMBRAL = 7
  const fuentes = await db.fuenteEstado.findMany({
    where: {
      activo: true,
      checksSinCambio: { gte: UMBRAL },
    },
    include: { medio: true },
  })

  let count = 0
  for (const fuente of fuentes) {
    // No degradar si tiene override activo
    const override = deserializeOverride(fuente.medio.frecuenciaOverride)
    if (override && isOverrideActive(override)) continue

    // No degradar si ya esta en el minimo
    if (fuente.frecuenciaActual === '1w') continue

    const nuevaFreq = degradeFrecuencia(fuente.frecuenciaActual)
    if (nuevaFreq !== fuente.frecuenciaActual) {
      await db.fuenteEstado.update({
        where: { id: fuente.id },
        data: {
          frecuenciaActual: nuevaFreq,
          checksSinCambio: 0,
        },
      })
      console.log(
        `[Frecuencia] Batch degradada ${fuente.medio.nombre}: ${fuente.frecuenciaActual} -> ${nuevaFreq}`,
      )
      count++
    }
  }

  return count
}
