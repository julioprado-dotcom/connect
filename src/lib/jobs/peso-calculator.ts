/**
 * Calculadora de Peso Informativo — DECODEX Bolivia
 * 
 * Score compuesto que combina múltiples factores del medio
 * para determinar su prioridad de captura. Rango: 0-100.
 * 
 * Factores:
 *   - credibilidad (0-100): peso 30%
 *   - ambito: NACIONAL=100, REGIONAL=60, LOCAL=30, INTERNACIONAL=50 (peso 25%)
 *   - naturaleza: ESTATAL=80, PRIVADO=70, COMUNITARIO=40, MIXTO=60, ONG=50 (peso 20%)
 *   - nivel: 1=100, 2=60, 3=30 (peso 15%)
 *   - menciones recientes (bonus hasta 10 puntos)
 */

interface MedioForPeso {
  nombre: string;
  credibilidad: number;
  ambito: string;
  naturaleza: string;
  nivel: string;
  tipo: string;
  mencionesCount?: number;
}

const AMBITO_SCORES: Record<string, number> = {
  NACIONAL: 100,
  REGIONAL: 60,
  LOCAL: 30,
  INTERNACIONAL: 50,
}

const NATURALEZA_SCORES: Record<string, number> = {
  ESTATAL: 80,
  PRIVADO: 70,
  COMUNITARIO: 40,
  MIXTO: 60,
  ONG: 50,
}

const NIVEL_SCORES: Record<string, number> = {
  '1': 100,
  '2': 60,
  '3': 30,
}

// Medios que siempre tienen peso máximo (hardcoded priority)
const PRIORITY_MEDIA: Record<string, number> = {
  'Los Tiempos': 95,
  'La Razón': 85,
  'El Deber': 85,
  'Opinión': 75,
  'ABI': 70,
  'ATB Digital': 65,
  'Unitel': 60,
  'Red Uno': 55,
}

export function calcularPesoInformativo(medio: MedioForPeso): number {
  // Hardcoded priority override for known media
  if (PRIORITY_MEDIA[medio.nombre] !== undefined) {
    return PRIORITY_MEDIA[medio.nombre]
  }

  // Factor 1: Credibilidad (30%)
  const credScore = Math.min(100, Math.max(0, medio.credibilidad || 50))

  // Factor 2: Ámbito (25%)
  const ambitoScore = AMBITO_SCORES[medio.ambito] || 50

  // Factor 3: Naturaleza (20%)
  const natScore = NATURALEZA_SCORES[medio.naturaleza] || 50

  // Factor 4: Nivel (15%)
  const nivelScore = NIVEL_SCORES[medio.nivel] || 30

  // Factor 5: Menciones recientes (bonus hasta 10 puntos)
  const mencionesBonus = Math.min(10, Math.floor((medio.mencionesCount || 0) / 5))

  // Ponderación final
  const peso =
    (credScore * 0.30) +
    (ambitoScore * 0.25) +
    (natScore * 0.20) +
    (nivelScore * 0.15) +
    mencionesBonus

  return Math.round(Math.min(100, Math.max(0, peso)) * 10) / 10
}

// Batch calculate for multiple medios
export function calcularPesosBatch(medios: MedioForPeso[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const medio of medios) {
    // If medio has a manual override (pesoInformativo > 0), use it directly
    // Otherwise calculate automatically
    const peso = (medio as unknown as { pesoInformativo?: number }).pesoInformativo
      ? (medio as unknown as { pesoInformativo: number }).pesoInformativo
      : calcularPesoInformativo(medio)
    // We'll use the nombre as key since we don't have id here
    map.set(medio.nombre || '', peso)
  }
  return map
}
