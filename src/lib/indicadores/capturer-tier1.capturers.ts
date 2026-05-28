/**
 * Capturer Tier 1 — Capturadores individuales
 * TC Oficial BCB: Yahoo Finance (BOB=X) + scraper BCB como respaldo.
 * LME/Yahoo/Stooq para metales y commodities.
 */

import { fetchIndicadores } from '@/lib/services/indicadores'
import type { SlugIndicador } from '@/lib/services/indicadores.types'
import type { CapturaResult } from './capturer-tier1.config'

// ─── Capturadores individuales ───────────────────────────────────

export async function capturarTcOficial(): Promise<CapturaResult> {
  const fecha = new Date()

  // Estrategia 1: Yahoo Finance BOB=X (confiable, rápida)
  try {
    const yahooUrl = 'https://query1.finance.yahoo.com/v8/finance/chart/BOB=X?interval=1d&range=2d'
    const resp = await fetch(yahooUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      signal: AbortSignal.timeout(10000),
    })
    if (resp.ok) {
      const data = await resp.json()
      const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice
      if (price && price > 5 && price < 12) {
        return {
          slug: 'tc-oficial-bcb',
          valor: Number(price.toFixed(2)),
          valorTexto: `${price.toFixed(2)} Bs/USD`,
          confiable: true,
          fecha,
          metadata: JSON.stringify({ fuente: 'Yahoo Finance (BOB=X)', metodo: 'api_yahoo' }),
        }
      }
    }
  } catch { /* seguir al respaldo */ }

  // Estrategia 2: Scraper BCB (la página ahora carga datos vía JS, puede fallar)
  try {
    const response = await fetch('https://www.bcb.gob.bo/?q=cotizaciones_tc', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(15000),
    })

    if (response.ok) {
      const html = await response.text()

      // Buscar patrón "Venta" seguido de un número con formato boliviano (X,XX)
      const ventaPattern = /Venta[\s\S]*?(\d+)[,.](\d{2})/i
      const ventaMatch = ventaPattern.exec(html)
      if (ventaMatch) {
        const valor = parseFloat(`${ventaMatch[1]}.${ventaMatch[2]}`)
        if (valor >= 6 && valor <= 10) {
          return {
            slug: 'tc-oficial-bcb',
            valor,
            valorTexto: `${valor.toFixed(2)} Bs/USD`,
            confiable: true,
            fecha,
            metadata: JSON.stringify({ fuente: 'bcb.gob.bo', metodo: 'html_scraping' }),
          }
        }
      }
    }
  } catch { /* seguir al fallback */ }

  // Fallback: valor estático (señalar como no confiable)
  return {
    slug: 'tc-oficial-bcb',
    valor: 6.91,
    valorTexto: '6.91 Bs/USD',
    confiable: false,
    fecha,
    metadata: JSON.stringify({ error: 'Yahoo y BCB fallaron', metodo: 'fallback_estatico' }),
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
