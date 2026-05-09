/**
 * scraping-state.ts — Estado compartido de la fase de scraping
 *
 * Centraliza las variables en memoria que controlan la fase de scraping,
 * para que tanto /api/scraping/phase como /api/stats puedan acceder
 * al mismo estado sin duplicar lógica.
 */

export type EstadoFase = 'inactivo' | 'listo' | 'ejecutando' | 'pausado' | 'detenido'

export interface ScrapeFuente {
  id: string
  medioId: string
  nombre: string
}

export const scrapingState = {
  faseActual: 0 as number,
  estadoFase: 'inactivo' as EstadoFase,
  scrapeEnProgreso: false,
  scrapePausado: false,
  scrapeFuentes: [] as ScrapeFuente[],
  fuentesSeleccionadasIds: new Set<string>(),
}
