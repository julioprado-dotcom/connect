// Gestion de overrides de frecuencia por contrato - DECODEX Bolivia
// Los overrides permiten aumentar temporalmente la frecuencia de chequeo
// para fuentes monitoreadas por contratos especificos

import type { FrecuenciaOverride } from '../types'
import { DEGRADACION_CHAIN } from '../constants'

// Crear un override de frecuencia
export function createOverride(params: {
  frecuencia: string
  motivo: string
  contratoId?: string
  fechaInicio: string
  fechaFin: string
}): FrecuenciaOverride {
  // Validar que la frecuencia este en la cadena
  if (!DEGRADACION_CHAIN.includes(params.frecuencia)) {
    throw new Error(`Frecuencia invalida para override: ${params.frecuencia}. Valores validos: ${DEGRADACION_CHAIN.join(', ')}`)
  }

  return {
    activo: true,
    frecuencia: params.frecuencia,
    motivo: params.motivo,
    contratoId: params.contratoId,
    fechaInicio: params.fechaInicio,
    fechaFin: params.fechaFin,
  }
}

// Serializar override a JSON para almacenar en Medio.frecuenciaOverride
export function serializeOverride(override: FrecuenciaOverride): string {
  return JSON.stringify(override)
}

// Deserializar override desde JSON de Medio.frecuenciaOverride
export function deserializeOverride(json: string): FrecuenciaOverride | null {
  if (!json || json === '' || json === '{}') return null
  try {
    const parsed = JSON.parse(json)
    if (!parsed || typeof parsed !== 'object') return null
    if (!parsed.frecuencia || !parsed.fechaInicio || !parsed.fechaFin) return null
    return parsed as FrecuenciaOverride
  } catch {
    return null
  }
}

// Verificar si un override esta activo en este momento
export function isOverrideActive(override: FrecuenciaOverride): boolean {
  if (!override.activo) return false

  const ahora = new Date()
  const inicio = new Date(override.fechaInicio)
  const fin = new Date(override.fechaFin)

  // Sin fecha de inicio = no activable
  if (isNaN(inicio.getTime())) return false

  // Ya paso la fecha de fin
  if (!isNaN(fin.getTime()) && ahora > fin) return false

  // Todavia no empieza
  if (ahora < inicio) return false

  return true
}

// Desactivar un override (lo mantiene en DB pero marca como inactivo)
export function deactivateOverride(override: FrecuenciaOverride): FrecuenciaOverride {
  return {
    ...override,
    activo: false,
  }
}

// Obtener la frecuencia mas agresiva entre override y base
export function getMostAggressive(base: string, override: string): string {
  const idxBase = DEGRADACION_CHAIN.indexOf(base)
  const idxOverride = DEGRADACION_CHAIN.indexOf(override)

  // Si alguna no esta en la cadena, devolver la que si esta
  if (idxBase === -1) return override
  if (idxOverride === -1) return base

  // Menor indice = mas agresiva (mas frecuente)
  return idxOverride < idxBase ? override : base
}

// Obtener dias restantes de un override activo
export function getDiasRestantes(override: FrecuenciaOverride): number {
  const ahora = new Date()
  const fin = new Date(override.fechaFin)
  const diff = fin.getTime() - ahora.getTime()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}
