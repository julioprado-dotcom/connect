// Calculadora de horarios optimos por histograma - DECODEX Bolivia
// Dado un histograma de horas de publicacion y un numero de chequeos,
// determina las mejores horas para chequear cada fuente

import type { Histograma, HorariosConfig } from '../types'
import { HORARIOS_CONFIG_DEFAULT, HORARIOS_DEFAULT } from '../constants'

// Ventana de datos historicos para el histograma (dias)
export const HISTOGRAM_WINDOW_DAYS = 30

// Calcular horarios optimos de chequeo basados en el histograma
export function calcularHorariosOptimos(
  histograma: Histograma,
  numChequeos: number,
  config: HorariosConfig = HORARIOS_CONFIG_DEFAULT,
): number[] {
  // Si no hay chequeos que hacer, devolver vacio
  if (numChequeos <= 0) return []

  // 1. Obtener horas con datos, ordenadas por frecuencia descendente
  const horasConDatos = Object.entries(histograma)
    .filter(([_, count]) => count > 0)
    .map(([hora, count]) => ({ hora: parseInt(hora), count }))
    .sort((a, b) => b.count - a.count)

  // 2. Si no hay datos historicos, distribuir uniformemente
  if (horasConDatos.length === 0) {
    return distribuirUniforme(numChequeos, config.ventanaInicio, config.ventanaFin)
  }

  // 3. Seleccionar horas con separacion minima (algoritmo greedy)
  const seleccionados: number[] = []

  for (const { hora } of horasConDatos) {
    if (seleccionados.length >= numChequeos) break

    // Verificar que la hora esta dentro de la ventana
    if (hora < config.ventanaInicio || hora > config.ventanaFin) continue

    // Verificar separacion minima con todos los ya seleccionados
    const cumpleSeparacion = seleccionados.every(
      sel => Math.abs(sel - hora) >= config.separacionMinima,
    )

    if (cumpleSeparacion) {
      seleccionados.push(hora)
    } else {
      // Buscar la hora mas cercana que cumpla la separacion
      const ajustada = findNearestValidHour(hora, seleccionados, config)
      if (ajustada !== null && !seleccionados.includes(ajustada)) {
        seleccionados.push(ajustada)
      }
    }
  }

  // 4. Si no se llenaron todos los slots, distribuir los faltantes
  while (seleccionados.length < numChequeos) {
    const inicio = seleccionados.length > 0
      ? Math.max(...seleccionados) + config.separacionMinima
      : config.ventanaInicio
    const nuevaHora = Math.min(inicio, config.ventanaFin)
    if (seleccionados.includes(nuevaHora)) break // evitar duplicados
    seleccionados.push(nuevaHora)
  }

  return seleccionados.sort((a, b) => a - b)
}

// Encontrar la hora mas cercana que cumpla la separacion minima
function findNearestValidHour(
  targetHour: number,
  selected: number[],
  config: HorariosConfig,
): number | null {
  for (let offset = 1; offset < config.separacionMinima; offset++) {
    // Probar antes
    const antes = targetHour - offset
    if (antes >= config.ventanaInicio && antes <= config.ventanaFin) {
      const cumple = selected.every(sel => Math.abs(sel - antes) >= config.separacionMinima)
      if (cumple) return antes
    }

    // Probar despues
    const despues = targetHour + offset
    if (despues >= config.ventanaInicio && despues <= config.ventanaFin) {
      const cumple = selected.every(sel => Math.abs(sel - despues) >= config.separacionMinima)
      if (cumple) return despues
    }
  }

  return null
}

// Distribuir horarios uniformemente en una ventana (fallback sin datos)
export function distribuirUniforme(
  numChequeos: number,
  ventanaInicio: number,
  ventanaFin: number,
): number[] {
  if (numChequeos <= 0) return []
  if (numChequeos === 1) {
    // Un solo chequeo: ponerlo al inicio de la ventana
    return [ventanaInicio + 1]
  }

  const rango = ventanaFin - ventanaInicio
  const paso = rango / (numChequeos + 1)

  return Array.from({ length: numChequeos }, (_, i) =>
    Math.round(ventanaInicio + paso * (i + 1)),
  )
}

// Obtener horarios por defecto para un medio (de HORARIOS_DEFAULT en constants)
export function getHorariosDefault(
  medioNombre: string,
  medioUrl: string,
): number[] | null {
  // Buscar por dominio
  const dominio = extractDomain(medioUrl)
  if (dominio && HORARIOS_DEFAULT[dominio]) {
    return HORARIOS_DEFAULT[dominio]
  }

  // Buscar por nombre parcial
  for (const key of Object.keys(HORARIOS_DEFAULT)) {
    if (medioNombre.toLowerCase().includes(key.toLowerCase())) {
      return HORARIOS_DEFAULT[key]
    }
  }

  return null
}

// Obtener el score de calidad de los horarios (0-1)
// Mide que tan bien los horarios cubren las horas de publicacion real
export function getHorariosScore(
  horarios: number[],
  histograma: Histograma,
): number {
  if (horarios.length === 0 || Object.keys(histograma).length === 0) return 0

  // Total de publicaciones en el histograma
  const totalPublicaciones = Object.values(histograma).reduce((a, b) => a + b, 0)
  if (totalPublicaciones === 0) return 0

  // Publicaciones cubiertas por los horarios (dentro de 1 hora de un horario)
  let cubiertas = 0
  for (const [horaStr, count] of Object.entries(histograma)) {
    const hora = parseInt(horaStr)
    // Si la hora esta a menos de 1 hora de algun horario programado
    const cercano = horarios.some(h => Math.abs(h - hora) <= 1)
    if (cercano) {
      cubiertas += count
    }
  }

  return Math.round((cubiertas / totalPublicaciones) * 100) / 100
}

// Extraer dominio de una URL
function extractDomain(url: string): string | null {
  if (!url) return null
  try {
    let clean = url.replace(/^https?:\/\//, '').replace(/^www\./, '')
    const parts = clean.split('/')
    return (parts[0]?.toLowerCase()) || null
  } catch {
    return null
  }
}
