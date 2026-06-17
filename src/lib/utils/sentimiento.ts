/**
 * Derive sentimiento from tratamientoPeriodistico (backward-compatible mapping).
 * LOSSY: multiple tratamientos map to the same sentimiento value.
 * The canonical field is tratamientoPeriodistico; this is a convenience
 * for any display that still needs a simple positive/negative/neutral label.
 */
export function tratamientoToSentimiento(tratamiento: string | null | undefined): string {
  if (!tratamiento) return 'no_clasificado';
  switch (tratamiento) {
    case 'tratamiento_informativo':
    case 'tratamiento_analitico':
    case 'tratamiento_editorial':
      return 'neutro';
    case 'tratamiento_critico':
    case 'tratamiento_agresivo':
      return 'negativo';
    case 'tratamiento_elogioso':
      return 'positivo';
    case 'tratamiento_ambiguo':
      return 'mixto';
    default:
      return 'no_clasificado';
  }
}
