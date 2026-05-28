/**
 * Capturer Tier 1 — Capturadores individuales
 * TC Oficial BCB: Yahoo Finance (BOB=X) + scraper BCB como respaldo.
 * LME/Yahoo/Stooq para metales y commodities.
 */

import { fetchIndicadores, getIndicador } from '@/lib/services/indicadores'
import type { SlugIndicador } from '@/lib/services/indicadores.types'
import type { CapturaResult } from './capturer-tier1.config'

// ─── Utilidades para BCB ─────────────────────────────────────────

/**
 * Extrae el URL del iframe de cotizaciones del HTML principal del BCB.
 * La tabla de tipos de cambio está dentro de un iframe embebido.
 */
function extraerIframeUrl(html: string): string | null {
  // Buscar iframe con src que contenga cotizaciones o tipo de cambio
  const iframePatterns = [
    /<iframe[^>]+src=["']([^"']*cotizacion[^"']*)["']/i,
    /<iframe[^>]+src=["']([^"']*tipo_cambio[^"']*)["']/i,
    /<iframe[^>]+src=["']([^"']*cambio[^"']*)["']/i,
    /<iframe[^>]+src=["']([^"']+)/i,  // Último recurso: cualquier iframe
  ]
  for (const pattern of iframePatterns) {
    const match = pattern.exec(html)
    if (match?.[1]) {
      // Resolver URL relativa a absoluta
      let url = match[1]
      if (url.startsWith('/')) {
        url = `https://www.bcb.gob.bo${url}`
      } else if (!url.startsWith('http')) {
        url = `https://www.bcb.gob.bo/${url}`
      }
      return url
    }
  }
  return null
}

/**
 * Parsea el tipo de cambio USD Venta del HTML de la tabla del BCB.
 * Busca específicamente "DOLAR VENTA" (sin tilde) seguido del valor numérico.
 */
function parsearTcBcb(html: string): number | null {
  // Estrategia 1: Buscar fila con "DOLAR VENTA" y extraer el valor de la 4ta columna
  const dolarVentaPatterns = [
    /DOLAR\s*VENTA[\s\S]*?<td[^>]*>\s*<div[^>]*>[\s\S]*?<\/div>\s*<\/td>\s*<td[^>]*>\s*<div[^>]*>[\s\S]*?<\/div>\s*<\/td>\s*<td[^>]*>\s*<div[^>]*>[\s\S]*?<\/div>\s*<\/td>\s*<td[^>]*>\s*<div[^>]*align=["']right["'][^>]*>([\d.,]+)\s*<\/div>/i,
    /DOLAR\s*VENTA[\s\S]*?(\d{1,2}\.\d{2})/,
    /DOLAR\s*VENTA[\s\S]*?(\d{1,2},\d{2})/,
  ]

  for (const pattern of dolarVentaPatterns) {
    const match = pattern.exec(html)
    if (match?.[1]) {
      const rawValue = match[1].replace(',', '.')
      const valor = parseFloat(rawValue)
      if (valor >= 5 && valor <= 15) {
        return valor
      }
    }
  }

  // Estrategia 2: Buscar cualquier número entre 6.50 y 8.00 (rango plausible para Bs/USD)
  const allNumbers = html.match(/\b(6\.[5-9]\d|7\.\d{2}|6\.\d{2})\b/g)
  if (allNumbers && allNumbers.length > 0) {
    // Tomar el primero que esté en rango válido
    for (const numStr of allNumbers) {
      const val = parseFloat(numStr.replace(',', '.'))
      if (val >= 6.50 && val <= 8.00) {
        return val
      }
    }
  }

  return null
}

// ─── Capturadores individuales ───────────────────────────────────

export async function capturarTcOficial(): Promise<CapturaResult> {
  const fecha = new Date()
  const logs: string[] = []

  // ── Estrategia 1: Yahoo Finance BOB=X (confiable, rápida) ──────
  try {
    const yahooUrl = 'https://query1.finance.yahoo.com/v8/finance/chart/BOB=X?interval=1d&range=2d'
    const resp = await fetch(yahooUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      signal: AbortSignal.timeout(10000),
    })
    if (resp.ok) {
      const data = await resp.json()
      const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice
      const prevClose = data?.chart?.result?.[0]?.meta?.previousClose
      logs.push(`Yahoo BOB=X raw: ${price}, prevClose: ${prevClose}`)
      // Validación estricta: el tipo de cambio BOB/USD debe estar entre 5 y 12
      if (price && price > 5 && price < 12) {
        console.log(`[TC Oficial] Yahoo Finance OK: ${price.toFixed(2)} Bs/USD`)
        return {
          slug: 'tc-oficial-bcb',
          valor: Number(price.toFixed(2)),
          valorTexto: `${price.toFixed(2)} Bs/USD`,
          confiable: true,
          fecha,
          metadata: JSON.stringify({ fuente: 'Yahoo Finance (BOB=X)', metodo: 'api_yahoo', rawPrice: price, prevClose }),
        }
      } else {
        logs.push(`Yahoo BOB=X valor fuera de rango: ${price}`)
      }
    } else {
      logs.push(`Yahoo BOB=X HTTP ${resp.status}`)
    }
  } catch (err) {
    logs.push(`Yahoo BOB=X error: ${err instanceof Error ? err.message : 'unknown'}`)
  }

  // ── Estrategia 2: BCB — Intentar obtener iframe y parsear tabla ─
  try {
    const bcbUrl = 'https://www.bcb.gob.bo/?q=cotizaciones_tc'
    const response = await fetch(bcbUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(15000),
    })

    if (response.ok) {
      const html = await response.text()

      // Intentar extraer URL del iframe
      const iframeUrl = extraerIframeUrl(html)
      if (iframeUrl) {
        logs.push(`BCB iframe encontrado: ${iframeUrl}`)
        // Fetch del iframe directamente
        try {
          const iframeResp = await fetch(iframeUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
            signal: AbortSignal.timeout(10000),
          })
          if (iframeResp.ok) {
            const iframeHtml = await iframeResp.text()
            const tcValor = parsearTcBcb(iframeHtml)
            if (tcValor) {
              console.log(`[TC Oficial] BCB iframe OK: ${tcValor.toFixed(2)} Bs/USD (desde ${iframeUrl})`)
              return {
                slug: 'tc-oficial-bcb',
                valor: Number(tcValor.toFixed(2)),
                valorTexto: `${tcValor.toFixed(2)} Bs/USD`,
                confiable: true,
                fecha,
                metadata: JSON.stringify({ fuente: 'bcb.gob.bo (iframe)', metodo: 'iframe_scraping', iframeUrl }),
              }
            }
            logs.push(`BCB iframe: no se pudo parsear TC del HTML`)
          }
        } catch (iframeErr) {
          logs.push(`BCB iframe fetch error: ${iframeErr instanceof Error ? iframeErr.message : 'unknown'}`)
        }
      } else {
        logs.push(`BCB: no se encontró iframe en la página`)
      }

      // Intentar parsear directamente del HTML principal (por si los datos están inline)
      const tcDirecto = parsearTcBcb(html)
      if (tcDirecto) {
        console.log(`[TC Oficial] BCB directo OK: ${tcDirecto.toFixed(2)} Bs/USD`)
        return {
          slug: 'tc-oficial-bcb',
          valor: Number(tcDirecto.toFixed(2)),
          valorTexto: `${tcDirecto.toFixed(2)} Bs/USD`,
          confiable: true,
          fecha,
          metadata: JSON.stringify({ fuente: 'bcb.gob.bo (directo)', metodo: 'html_direct' }),
        }
      }
    } else {
      logs.push(`BCB HTTP ${response.status}`)
    }
  } catch (err) {
    logs.push(`BCB error: ${err instanceof Error ? err.message : 'unknown'}`)
  }

  // ── Estrategia 3: Servicio de indicadores (fallback chain completa) ─
  try {
    const indicador = await getIndicador('tc-oficial-bcb' as SlugIndicador)
    if (indicador && indicador.valor > 5 && indicador.valor < 12) {
      console.log(`[TC Oficial] Servicio indicadores OK: ${indicador.valor} Bs/USD (fuente: ${indicador.fuente})`)
      return {
        slug: 'tc-oficial-bcb',
        valor: Number(indicador.valor.toFixed(2)),
        valorTexto: `${indicador.valor.toFixed(2)} Bs/USD`,
        confiable: indicador.confiable,
        fecha,
        metadata: JSON.stringify({ fuente: indicador.fuente, metodo: 'servicio_indicadores_fallback' }),
      }
    }
    logs.push(`Servicio indicadores: valor ${indicador?.valor} fuera de rango o null`)
  } catch (err) {
    logs.push(`Servicio indicadores error: ${err instanceof Error ? err.message : 'unknown'}`)
  }

  // ── Fallback: valor estático (señalar como no confiable) ──────
  console.warn(`[TC Oficial] Todas las fuentes fallaron. Logs:`, logs)
  return {
    slug: 'tc-oficial-bcb',
    valor: 6.91,
    valorTexto: '6.91 Bs/USD',
    confiable: false,
    fecha,
    metadata: JSON.stringify({ error: 'Todas las fuentes fallaron', metodo: 'fallback_estatico', logs }),
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
