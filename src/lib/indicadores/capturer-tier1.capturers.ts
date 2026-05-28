/**
 * Capturer Tier 1 — Capturadores individuales
 * Scraper BCB para TC Oficial y fetcher LME/Yahoo/Stooq para metales y commodities.
 */

import { fetchIndicadores } from '@/lib/services/indicadores'
import type { SlugIndicador } from '@/lib/services/indicadores.types'
import type { CapturaResult } from './capturer-tier1.config'

// ─── Capturadores individuales ───────────────────────────────────

export async function capturarTcOficial(): Promise<CapturaResult> {
  const fecha = new Date()

  try {
    const response = await fetch('https://www.bcb.gob.bo/?q=cotizaciones_tc', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(15000),
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const html = await response.text()

    // Parseo: buscar "Tipo de cambio Bs por 1 Dólar USA" y luego "Venta" con número
    // La nueva página muestra: Compra 6,86 y Venta 6,96
    let valor = 0

    // Buscar patrón "Venta" seguido de un número con formato boliviano (X,XX)
    const ventaPattern = /Venta[\s\S]*?(\d+)[,.](\d{2})/i
    const ventaMatch = ventaPattern.exec(html)
    if (ventaMatch) {
      valor = parseFloat(`${ventaMatch[1]}.${ventaMatch[2]}`)
    }

    // Fallback: buscar cualquier número en rango tipo de cambio (6.50 - 10.50)
    if (valor === 0) {
      const tcPattern = /(\d+)[.,](\d{2})/g
      let match = tcPattern.exec(html)
      while (match !== null) {
        const num = parseFloat(`${match[1]}.${match[2]}`)
        if (num >= 6.5 && num <= 10.5) {
          valor = num
          break
        }
        match = tcPattern.exec(html)
      }
    }

    if (valor === 0) {
      // Fallback: valor por defecto si no se puede parsear
      valor = 6.96
      return {
        slug: 'tc-oficial-bcb',
        valor,
        valorTexto: `${valor.toFixed(2)} Bs/USD`,
        confiable: false,
        fecha,
        metadata: JSON.stringify({ error: 'No se encontró patrón TC en HTML', url: 'bcb.gob.bo' }),
      }
    }

    return {
      slug: 'tc-oficial-bcb',
      valor,
      valorTexto: `${valor.toFixed(2)} Bs/USD`,
      confiable: true,
      fecha,
      metadata: JSON.stringify({ fuente: 'bcb.gob.bo', metodo: 'html_scraping' }),
    }
  } catch (error) {
    return {
      slug: 'tc-oficial-bcb',
      valor: 0,
      valorTexto: 'N/D',
      confiable: false,
      fecha,
      metadata: JSON.stringify({ error: error instanceof Error ? error.message : 'unknown' }),
    }
  }
}

/**
 * Captura precios LME reales usando el servicio de indicadores (Yahoo Finance + Stooq).
 * Ya NO usa datos mock — conecta a fuentes reales con fallback chain.
 */
export async function capturarLmeReal(
  lmeSlugs: SlugIndicador[]
): Promise<CapturaResult[]> {
  const fecha = new Date()
  const resultados: CapturaResult[] = []

  try {
    const response = await fetchIndicadores(lmeSlugs)

    for (const ind of response.indicadores) {
      resultados.push({
        slug: ind.slug,
        valor: ind.valor,
        valorTexto: `${Math.round(ind.valor).toLocaleString('es-BO')} ${ind.unidad}`,
        confiable: ind.confiable,
        fecha,
        metadata: JSON.stringify({
          fuente: ind.fuente,
          metodo: ind.confiable ? 'api_real' : 'fallback',
          valorRaw: ind.valor,
          variacionPct: ind.variacion,
          fuentesUsadas: response.fuentesUsadas,
          timestamp: response.timestamp,
        }),
      })
    }

    // Log errores para debugging
    if (response.errores.length > 0) {
      console.warn('[LME capturer] Errores parciales:', response.errores.map(e => e.mensaje))
    }

    return resultados
  } catch (error) {
    console.error('[LME capturer] Error obteniendo datos reales:', error)
    return lmeSlugs.map(slug => ({
      slug,
      valor: 0,
      valorTexto: 'N/D',
      confiable: false,
      fecha,
      metadata: JSON.stringify({ error: error instanceof Error ? error.message : 'unknown' }),
    }))
  }
}
