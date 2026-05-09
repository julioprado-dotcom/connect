// Calculadora de frecuencia adaptativa - DECODEX Bolivia
// Degradacion y restauracion automatica segun actividad de la fuente

import {
  DEGRADACION_CHAIN,
  FRECUENCIA_BASE_POR_CATEGORIA,
  FRECUENCIA_BASE_POR_MEDIO,
} from '../constants'
import type { FrecuenciaKey } from '../types'

// Umbral de checks sin cambio para degradar
const UMBRAL_DEGRADACION = 7

// Obtener la frecuencia base de un medio segun su categoria o override especifico
export function getFrecuenciaBase(
  medioNombre: string,
  medioCategoria: string,
  medioUrl: string,
): string {
  // 1. Override especifico por nombre de medio (coincidencia parcial con dominio)
  const dominio = extractDomain(medioUrl)
  if (dominio && FRECUENCIA_BASE_POR_MEDIO[dominio]) {
    return FRECUENCIA_BASE_POR_MEDIO[dominio]
  }

  // 2. Override por nombre parcial (para fuentes oficiales sin dominio claro)
  for (const key of Object.keys(FRECUENCIA_BASE_POR_MEDIO)) {
    if (medioNombre.toLowerCase().includes(key.toLowerCase())) {
      return FRECUENCIA_BASE_POR_MEDIO[key]
    }
  }

  // 3. Frecuencia por categoria
  if (FRECUENCIA_BASE_POR_CATEGORIA[medioCategoria]) {
    return FRECUENCIA_BASE_POR_CATEGORIA[medioCategoria]
  }

  // 4. Default conservador
  return '6h'
}

// Evaluar si una fuente debe degradarse
export function shouldDegrade(
  frecuenciaActual: string,
  checksSinCambio: number,
): boolean {
  if (checksSinCambio < UMBRAL_DEGRADACION) return false
  if (frecuenciaActual === '1w') return false // ya en el minimo
  return true
}

// Degradar una frecuencia al nivel inmediatamente inferior
export function degradeFrecuencia(frecuenciaActual: string): string {
  const idx = DEGRADACION_CHAIN.indexOf(frecuenciaActual)
  if (idx === -1) return frecuenciaActual // no reconocida, no degradar
  if (idx >= DEGRADACION_CHAIN.length - 1) return frecuenciaActual // ya en minimo
  return DEGRADACION_CHAIN[idx + 1]
}

// Restaurar frecuencia a su valor base
export function restoreFrecuencia(frecuenciaBase: string): string {
  // Verificar que la base es valida
  if (DEGRADACION_CHAIN.includes(frecuenciaBase)) {
    return frecuenciaBase
  }
  return '6h' // fallback seguro
}

// Obtener la siguiente frecuencia en la cadena de degradacion
export function getNextDegradation(frecuenciaActual: string): string | null {
  const idx = DEGRADACION_CHAIN.indexOf(frecuenciaActual)
  if (idx === -1 || idx >= DEGRADACION_CHAIN.length - 1) return null
  return DEGRADACION_CHAIN[idx + 1]
}

// Obtener la frecuencia efectiva considerando override por contrato
// Esta funcion se usa en el scheduler para determinar la frecuencia real
export function getFrecuenciaEfectiva(
  frecuenciaBase: string,
  frecuenciaActual: string,
  overrideActivo?: string | null,
): { efectiva: string; source: 'override' | 'degradada' | 'base' } {
  // 1. Override por contrato tiene maxima prioridad
  if (overrideActivo && overrideActivo !== '' && overrideActivo !== '{}') {
    try {
      const override = JSON.parse(overrideActivo)
      if (override.activo && override.frecuencia) {
        const ahora = new Date()
        const inicio = override.fechaInicio ? new Date(override.fechaInicio) : null
        const fin = override.fechaFin ? new Date(override.fechaFin) : null

        // Verificar que estamos dentro del periodo del override
        const dentroPeriodo = (!inicio || ahora >= inicio) && (!fin || ahora <= fin)
        if (dentroPeriodo) {
          return { efectiva: override.frecuencia, source: 'override' }
        }
      }
    } catch {
      // JSON corrupto, ignorar override
    }
  }

  // 2. Frecuencia degradada (puede ser menor que la base)
  if (frecuenciaActual !== frecuenciaBase) {
    return { efectiva: frecuenciaActual, source: 'degradada' }
  }

  // 3. Frecuencia base normal
  return { efectiva: frecuenciaBase, source: 'base' }
}

// Convertir frecuencia key a numero de checks por dia
export function frecuenciaToChecksDia(frecuencia: string): number {
  const map: Record<string, number> = {
    '15m': 16,
    '30m': 8,
    '1h': 4,
    '2h': 3,
    '4h': 2,
    '6h': 2,
    '12h': 1,
    '1d': 1,
    '1w': 0, // 1 por semana, no aplica checks diarios
  }
  return map[frecuencia] ?? 2
}

// Convertir frecuencia key a milisegundos
export function frecuenciaToMs(frecuencia: string): number {
  const map: Record<string, number> = {
    '15m': 15 * 60 * 1000,
    '30m': 30 * 60 * 1000,
    '1h': 60 * 60 * 1000,
    '2h': 2 * 60 * 60 * 1000,
    '4h': 4 * 60 * 60 * 1000,
    '6h': 6 * 60 * 60 * 1000,
    '12h': 12 * 60 * 60 * 1000,
    '1d': 24 * 60 * 60 * 1000,
    '1w': 7 * 24 * 60 * 60 * 1000,
  }
  return map[frecuencia] ?? 6 * 60 * 60 * 1000
}

// Extraer dominio de una URL para buscar en FRECUENCIA_BASE_POR_MEDIO
function extractDomain(url: string): string | null {
  if (!url) return null
  try {
    // Remover protocolo y path
    let clean = url.replace(/^https?:\/\//, '').replace(/^www\./, '')
    // Tomar solo el dominio (primer segmento)
    const parts = clean.split('/')
    const domain = parts[0]?.toLowerCase() || ''
    return domain
  } catch {
    return null
  }
}
