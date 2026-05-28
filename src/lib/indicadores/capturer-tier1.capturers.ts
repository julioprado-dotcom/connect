/**
 * Capturer Tier 1 — Capturadores individuales
 *
 * Estrategia de datos:
 * - BCB (fuente primaria): Parsea la tabla de cotizaciones del BCB
 *   identificando cada moneda por CÓDIGO (ARS, CLP, EUR, etc.)
 *   con fallback por NOMBRE si el código no coincide.
 * - Yahoo Finance / Stooq: Fallback para metales y commodities.
 * - SIN validaciones por rango numérico que puedan romperse en crisis.
 *
 * Estructura real del HTML del BCB (otras/ultimo.php):
 *   <tr>
 *     <td><div align="left"> ESTADOS UNIDOS </div></td>       ← PAÍS (cells[0])
 *     <td><div align="center"> DOLAR VENTA </div></td>        ← UNIDAD MONETARIA (cells[1])
 *     <td><div align="center"> USD.VENTA </div></td>          ← MONEDA/CÓDIGO (cells[2])
 *     <td><div align="right"> 6.96 </div></td>                ← TC EN Bs (cells[3])
 *     <td><div align="right"> 0.86014 </div></td>             ← TC EN M.E. (cells[4])
 *   </tr>
 */

import { fetchIndicadores, getIndicador } from '@/lib/services/indicadores'
import type { SlugIndicador } from '@/lib/services/indicadores.types'
import type { CapturaResult } from './capturer-tier1.config'

// ─── Mapeo PRIMARIO: Código de moneda → Slug ───────────────────────
// Usar el campo MONEDA (cells[2]) del BCB — 100% preciso.

const BCB_CODIGO_MAP: Record<string, {
  slug: string
  unidad: string
  decimales: number
}> = {
  // ─── Tipo de Cambio Oficial USD ─────────────────────────
  'USD.VENTA': {
    slug: 'tc-oficial-bcb',
    unidad: 'Bs/USD',
    decimales: 2,
  },
  'USD.COMPRA': {
    slug: 'tc-oficial-compra',
    unidad: 'Bs/USD',
    decimales: 2,
  },
  // ─── Divisas en Bs (directo del BCB, sin multiplicar) ──
  'EUR':              { slug: 'fx-eur-usd',  unidad: 'Bs/EUR', decimales: 5 },
  'JPY':              { slug: 'fx-jpy-usd',  unidad: 'Bs/JPY', decimales: 5 },
  'ARS':              { slug: 'fx-ars-usd',  unidad: 'Bs/ARS', decimales: 5 },
  'BRL':              { slug: 'fx-brl-usd',  unidad: 'Bs/BRL', decimales: 5 },
  'CLP':              { slug: 'fx-clp-usd',  unidad: 'Bs/CLP', decimales: 5 },
  'PEN':              { slug: 'fx-pen-usd',  unidad: 'Bs/PEN', decimales: 5 },
  'PYG':              { slug: 'fx-pyg-usd',  unidad: 'Bs/PYG', decimales: 5 },
  'GBP':              { slug: 'fx-gbp-usd',  unidad: 'Bs/GBP', decimales: 5 },
  'CNY':              { slug: 'fx-cny-usd',  unidad: 'Bs/CNY', decimales: 5 },
  'CHF':              { slug: 'fx-chf-usd',  unidad: 'Bs/CHF', decimales: 5 },
  'CZK':              { slug: 'fx-czk-usd',  unidad: 'Bs/CZK', decimales: 5 },
  // ─── Metales preciosos (directo del BCB en USD) ─────────
  'USD./O.T.F.':     { slug: 'com-oro-bcb', unidad: 'USD/oz', decimales: 2 },
}

// Mapa separado para la plata (mismo código "USD./O.T.F." pero diferente fila)
// Se resuelve con contexto de fila (ONZA TROY ORO vs ONZA TROY PLATA)

// ─── Mapeo SECUNDARIO: Nombre de moneda → Slug (fallback) ──────────
// Usado cuando el código no está en BCB_CODIGO_MAP.
// Se identifica por la columna UNIDAD MONETARIA (cells[1]) + país (cells[0]).

const BCB_NOMBRE_MAP: Record<string, {
  slug: string
  unidad: string
  decimales: number
  requierePais?: string  // Si se necesita verificar el país (cells[0])
}> = {
  'ONZA TROY PLATA':   { slug: 'com-plata-bcb', unidad: 'USD/oz', decimales: 3 },
}

// ─── Datos adicionales del BCB que no son divisas ──────────────────
// Estos se extraen de filas especiales del HTML.

interface DatoAdicional {
  slug: string
  unidad: string
  decimales: number
  buscarTexto: string          // Texto a buscar en la fila
  columnaValor: number          // Índice de la columna con el valor
  parsearComo?: 'numero' | 'porcentaje'
}

const BCB_DATOS_ADICIONALES: DatoAdicional[] = [
  {
    slug: 'macro-sofr-bcb',
    unidad: '% anual',
    decimales: 2,
    buscarTexto: 'SOFR',
    columnaValor: 1,
    parsearComo: 'porcentaje',
  },
  {
    slug: 'macro-ufv-bcb',
    unidad: 'Bs/UFV',
    decimales: 5,
    buscarTexto: 'UNIDAD DE FOMENTO DE VIVIENDA',
    columnaValor: 1,
    parsearComo: 'numero',
  },
]

// ─── Utilidades de parseo BCB ─────────────────────────────────────

/**
 * Limpia un número con formato boliviano: "4.451,89" → 4451.89, "6.96" → 6.96
 */
function parsearNumeroBoliviano(texto: string): number | null {
  if (!texto) return null
  // Quitar espacios, &nbsp; y caracteres no numéricos excepto , .
  const limpio = texto.replace(/[\s\u00A0]/g, '').replace(/&nbsp;/gi, '').trim()
  if (!limpio) return null

  // Formato boliviano: 4.451,89 (punto = miles, coma = decimal)
  if (limpio.includes(',') && limpio.includes('.')) {
    const ultimaComa = limpio.lastIndexOf(',')
    const ultimoPunto = limpio.lastIndexOf('.')
    if (ultimaComa > ultimoPunto) {
      // Formato boliviano: 4.451,89
      const sinMiles = limpio.replace(/\./g, '')
      const conPunto = sinMiles.replace(',', '.')
      const val = parseFloat(conPunto)
      return Number.isFinite(val) ? val : null
    } else {
      // Formato anglosajón: 4,451.89
      const sinMiles = limpio.replace(/,/g, '')
      const val = parseFloat(sinMiles)
      return Number.isFinite(val) ? val : null
    }
  } else if (limpio.includes(',')) {
    // Solo coma: podría ser decimal 0,56 o miles 1,234
    const partes = limpio.split(',')
    if (partes.length === 2 && partes[1]!.length <= 2) {
      // Probablemente decimal
      const val = parseFloat(limpio.replace(',', '.'))
      return Number.isFinite(val) ? val : null
    }
    // Miles
    const val = parseFloat(limpio.replace(',', ''))
    return Number.isFinite(val) ? val : null
  } else {
    // Solo punto o solo dígitos
    const val = parseFloat(limpio)
    return Number.isFinite(val) ? val : null
  }
}

/**
 * Extrae la URL del iframe de cotizaciones del HTML principal del BCB.
 */
function extraerIframeUrl(html: string): string | null {
  const patterns = [
    /<iframe[^>]+src=["']([^"']*ultimo\.php[^"']*)["']/i,
    /<iframe[^>]+src=["']([^"']*otras[^"']*)["']/i,
    /<iframe[^>]+src=["']([^"']*cotizacion[^"']*)["']/i,
    /<iframe[^>]+src=["']([^"']*tipo_cambio[^"']*)["']/i,
    /<iframe[^>]+src=["']([^"']*cambio[^"']*)["']/i,
    /<iframe[^>]+src=["']([^"']+)/i,
  ]
  for (const p of patterns) {
    const m = p.exec(html)
    if (m?.[1]) {
      let url = m[1]
      if (url.startsWith('/')) url = `https://www.bcb.gob.bo${url}`
      else if (!url.startsWith('http')) url = `https://www.bcb.gob.bo/${url}`
      return url
    }
  }
  return null
}

/**
 * Parsea la tabla completa de cotizaciones del BCB.
 *
 * Estructura real (5 columnas):
 *   cells[0] = PAÍS
 *   cells[1] = UNIDAD MONETARIA (nombre descriptivo)
 *   cells[2] = MONEDA (código ISO o abreviatura)
 *   cells[3] = TIPO DE CAMBIO EN Bs
 *   cells[4] = TIPO CAMBIO EN M.E. (opcional)
 *
 * Para metales (4 columnas, sin M.E.):
 *   cells[0] = PAÍS/METAL
 *   cells[1] = UNIDAD MONETARIA
 *   cells[2] = MONEDA
 *   cells[3] = TIPO DE CAMBIO EN M.E.
 *
 * Identificación por CÓDIGO de moneda (cells[2]) — 100% preciso.
 * Sin validaciones por rango numérico.
 *
 * @returns Map<string, { valor: number, valorME?: number }>
 */
function parsearTablaBcb(html: string): Map<string, { valor: number; valorME?: number }> {
  const resultados = new Map<string, { valor: number; valorME?: number }>()

  // Patrón para filas de la tabla del BCB
  const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
  let rowMatch: RegExpExecArray | null

  // Track previo para la plata (misma columna código que oro)
  let ultimaFilaEsOro = false

  while ((rowMatch = rowPattern.exec(html)) !== null) {
    const rowHtml = rowMatch[1]

    // Extraer celdas de la fila
    const cells: string[] = []
    const cellPattern = /<td[^>]*>\s*<div[^>]*>([\s\S]*?)<\/div>\s*<\/td>/gi
    let cellMatch: RegExpExecArray | null
    while ((cellMatch = cellPattern.exec(rowHtml)) !== null) {
      cells.push(cellMatch[1].trim())
    }

    if (cells.length < 3) continue

    const pais = cells[0]?.toUpperCase().trim() ?? ''
    const unidadMonetaria = cells[1]?.toUpperCase().trim() ?? ''
    const codigoMoneda = cells[2]?.toUpperCase().trim() ?? ''
    const tcEnBs = cells[3]?.trim()
    const tcEnME = cells.length > 4 ? cells[4]?.trim() : undefined

    // ─── Estrategia 1: Match por código de moneda (cells[2]) ───
    if (codigoMoneda && BCB_CODIGO_MAP[codigoMoneda]) {
      const config = BCB_CODIGO_MAP[codigoMoneda]

      // Para oro/plata: mismo código "USD./O.T.F.", resolver por contexto
      if (codigoMoneda === 'USD./O.T.F.') {
        if (unidadMonetaria.includes('ORO')) {
          ultimaFilaEsOro = true
          const valor = parsearNumeroBoliviano(tcEnBs)
          if (valor !== null && valor > 0) {
            resultados.set(config.slug, { valor })
          }
          continue
        } else if (unidadMonetaria.includes('PLATA')) {
          const plataConfig = BCB_NOMBRE_MAP['ONZA TROY PLATA']
          if (plataConfig) {
            const valor = parsearNumeroBoliviano(tcEnBs)
            if (valor !== null && valor > 0) {
              resultados.set(plataConfig.slug, { valor })
            }
          }
          continue
        }
      }

      // Para divisas: usar cells[3] como TC en Bs
      if (tcEnBs) {
        const valor = parsearNumeroBoliviano(tcEnBs)
        if (valor !== null && valor > 0) {
          const valorME = tcEnME ? parsearNumeroBoliviano(tcEnME) ?? undefined : undefined
          resultados.set(config.slug, { valor, valorME })
        }
      }
      continue
    }

    // ─── Estrategia 2: Match por nombre (fallback) ────────────
    for (const [nombre, config] of Object.entries(BCB_NOMBRE_MAP)) {
      if (unidadMonetaria.includes(nombre)) {
        // Verificar país si es necesario
        if (config.requierePais && !pais.includes(config.requierePais)) continue

        const valor = parsearNumeroBoliviano(tcEnBs)
        if (valor !== null && valor > 0) {
          resultados.set(config.slug, { valor, valorME: undefined })
        }
        break
      }
    }

    // ─── Estrategia 3: Datos adicionales (SOFR, UFV, etc.) ────
    for (const dato of BCB_DATOS_ADICIONALES) {
      if (
        unidadMonetaria.includes(dato.buscarTexto) ||
        (cells.length > 1 && cells[1]?.toUpperCase().includes(dato.buscarTexto))
      ) {
        const colIdx = dato.columnaValor
        if (cells[colIdx]) {
          let valorTexto = cells[colIdx]!.trim()
          // Si es porcentaje, quitar el %
          if (dato.parsearComo === 'porcentaje') {
            valorTexto = valorTexto.replace('%', '')
          }
          const valor = parsearNumeroBoliviano(valorTexto)
          if (valor !== null && valor > 0) {
            resultados.set(dato.slug, { valor })
          }
        }
      }
    }
  }

  return resultados
}

// ─── Cache del HTML del BCB (para no fetchear N veces) ──────────

let bcbCache: { html: string; timestamp: number } | null = null
const BCB_CACHE_TTL = 55 * 60 * 1000 // 55 minutos (se actualiza cada hora aprox.)

/**
 * Obtiene el HTML de la tabla de cotizaciones del BCB.
 * Intenta: iframe directo (otras/ultimo.php) → iframe extraído → HTML directo.
 * Cachea el resultado para evitar requests duplicados.
 */
async function obtenerHtmlBcb(): Promise<{ html: string; fuente: string } | null> {
  // Verificar caché
  if (bcbCache && Date.now() - bcbCache.timestamp < BCB_CACHE_TTL) {
    return { html: bcbCache.html, fuente: 'cache' }
  }

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/html,application/xhtml+xml',
  }

  // ── Intento 1: URL directa del iframe (más confiable) ──────
  const urlsDirectas = [
    'https://www.bcb.gob.bo/librerias/indicadores/otras/ultimo.php',
  ]

  for (const url of urlsDirectas) {
    try {
      const resp = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(15000),
      })
      if (resp.ok) {
        const html = await resp.text()
        // Verificar que tiene datos de cotización
        if (html.includes('DOLAR') && html.includes('EURO') && html.includes('TIPO DE CAMBIO')) {
          bcbCache = { html, timestamp: Date.now() }
          console.log(`[BCB] Datos obtenidos de URL directa: ${url}`)
          return { html, fuente: 'url_directa' }
        }
      }
    } catch (err) {
      console.warn(`[BCB] Error accediendo a ${url}:`, err instanceof Error ? err.message : 'unknown')
    }
  }

  // ── Intento 2: Página principal + extraer iframe ────────────
  const bcbUrl = 'https://www.bcb.gob.bo/?q=cotizaciones_tc'
  try {
    const response = await fetch(bcbUrl, {
      headers,
      signal: AbortSignal.timeout(15000),
    })

    if (response.ok) {
      const html = await response.text()
      const iframeUrl = extraerIframeUrl(html)

      if (iframeUrl) {
        try {
          const iframeResp = await fetch(iframeUrl, {
            headers,
            signal: AbortSignal.timeout(10000),
          })
          if (iframeResp.ok) {
            const iframeHtml = await iframeResp.text()
            if (iframeHtml.includes('DOLAR') && iframeHtml.includes('TIPO DE CAMBIO')) {
              bcbCache = { html: iframeHtml, timestamp: Date.now() }
              console.log(`[BCB] Datos obtenidos del iframe: ${iframeUrl}`)
              return { html: iframeHtml, fuente: 'iframe' }
            }
          }
        } catch (iframeErr) {
          console.warn(`[BCB] Error accediendo al iframe:`, iframeErr instanceof Error ? iframeErr.message : 'unknown')
        }
      }

      // Intentar parsear directamente del HTML principal
      if (html.includes('DOLAR') && html.includes('TIPO DE CAMBIO')) {
        bcbCache = { html, timestamp: Date.now() }
        console.log(`[BCB] Datos obtenidos del HTML directo`)
        return { html, fuente: 'directo' }
      }
    }
  } catch (err) {
    console.error(`[BCB] Error obteniendo página principal:`, err)
  }

  console.warn('[BCB] No se encontraron datos de cotización')
  return null
}

/**
 * Invalida el caché del BCB (para forzar re-fetch).
 */
export function invalidarCacheBcb(): void {
  bcbCache = null
}

// ─── Capturadores individuales ───────────────────────────────────

/**
 * Obtiene TODOS los datos del BCB en una sola llamada.
 * Retorna un Map con slug → { valor, valorME }.
 *
 * Datos disponibles:
 * - tc-oficial-bcb: Dólar Venta (Bs/USD)
 * - tc-oficial-compra: Dólar Compra (Bs/USD)
 * - fx-eur-usd, fx-jpy-usd, fx-brl-usd, fx-pen-usd, fx-clp-usd,
 *   fx-ars-usd, fx-pyg-usd, fx-cny-usd, fx-gbp-usd, fx-chf-usd, fx-czk-usd
 * - com-oro-bcb: Oro (USD/oz)
 * - com-plata-bcb: Plata (USD/oz)
 * - macro-sofr-bcb: Tasa SOFR (%)
 * - macro-ufv-bcb: UFV (Bs/UFV)
 */
export async function capturarTodosBcb(): Promise<Map<string, { valor: number; valorME?: number }>> {
  const resultado = await obtenerHtmlBcb()
  if (!resultado) {
    console.warn('[BCB] No se pudo obtener datos del BCB')
    return new Map()
  }

  return parsearTablaBcb(resultado.html)
}

/**
 * Captura el Tipo de Cambio Oficial (USD Venta o Compra) del BCB.
 * Usa la función genérica capturarTodosBcb() y extrae el slug solicitado.
 *
 * @param tipo - 'venta' (default) o 'compra'
 */
export async function capturarTcOficial(tipo: 'venta' | 'compra' = 'venta'): Promise<CapturaResult> {
  const slug = tipo === 'compra' ? 'tc-oficial-compra' : 'tc-oficial-bcb'
  const fecha = new Date()

  // ── Estrategia 1: BCB (fuente oficial primaria) ─────────────
  try {
    const datos = await capturarTodosBcb()
    const tcData = datos.get(slug)

    if (tcData && tcData.valor > 0) {
      const etiqueta = tipo === 'compra' ? 'Compra' : 'Venta'
      console.log(`[TC Oficial ${etiqueta}] BCB OK: ${tcData.valor.toFixed(2)} Bs/USD`)
      return {
        slug,
        valor: Number(tcData.valor.toFixed(2)),
        valorTexto: `${tcData.valor.toFixed(2)} Bs/USD`,
        confiable: true,
        fecha,
        metadata: JSON.stringify({
          fuente: 'Banco Central de Bolivia',
          metodo: 'bcb_tabla_cotizaciones',
          valorME: tcData.valorME,
        }),
      }
    }
  } catch (err) {
    console.warn(`[TC Oficial ${tipo}] BCB error:`, err)
  }

  // ── Estrategia 2: Yahoo Finance BOB=X (respaldo) ────────────
  try {
    const yahooUrl = 'https://query1.finance.yahoo.com/v8/finance/chart/BOB=X?interval=1d&range=2d'
    const resp = await fetch(yahooUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      signal: AbortSignal.timeout(10000),
    })
    if (resp.ok) {
      const data = await resp.json()
      const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice
      if (price && price > 0) {
        console.log(`[TC Oficial ${tipo}] Yahoo fallback OK: ${price.toFixed(2)} Bs/USD`)
        return {
          slug,
          valor: Number(price.toFixed(2)),
          valorTexto: `${price.toFixed(2)} Bs/USD`,
          confiable: true,
          fecha,
          metadata: JSON.stringify({ fuente: 'Yahoo Finance (BOB=X)', metodo: 'fallback_yahoo' }),
        }
      }
    }
  } catch { /* seguir */ }

  // ── Estrategia 3: Servicio de indicadores (fallback final) ──
  try {
    const indicador = await getIndicador(slug as SlugIndicador)
    if (indicador && indicador.valor > 0) {
      console.log(`[TC Oficial ${tipo}] Servicio fallback: ${indicador.valor} Bs/USD`)
      return {
        slug,
        valor: Number(indicador.valor.toFixed(2)),
        valorTexto: `${indicador.valor.toFixed(2)} Bs/USD`,
        confiable: indicador.confiable,
        fecha,
        metadata: JSON.stringify({ fuente: indicador.fuente, metodo: 'fallback_servicio' }),
      }
    }
  } catch { /* seguir */ }

  // ── Fallback: valor estático ─────────────────────────────────
  console.warn(`[TC Oficial ${tipo}] Todas las fuentes fallaron — usando fallback estático`)
  return {
    slug,
    valor: 6.96,
    valorTexto: '6.96 Bs/USD',
    confiable: false,
    fecha,
    metadata: JSON.stringify({ error: 'Todas las fuentes fallaron', metodo: 'fallback_estatico' }),
  }
}

/**
 * Captura una divisa específica del BCB.
 * Usa los datos directos de la tabla del BCB (ya en Bs, sin multiplicar).
 * Si el BCB falla, hace fallback a Yahoo × TC oficial.
 */
export async function capturarDivisaBcb(slug: string): Promise<CapturaResult> {
  const fecha = new Date()

  // Buscar configuración de la moneda en los mapas
  const config =
    Object.values(BCB_CODIGO_MAP).find(c => c.slug === slug) ??
    Object.values(BCB_NOMBRE_MAP).find(c => c.slug === slug)

  if (!config) {
    return {
      slug,
      valor: 0,
      valorTexto: 'N/D',
      confiable: false,
      fecha,
      metadata: JSON.stringify({ error: 'Moneda no configurada en BCB maps' }),
    }
  }

  // ── Estrategia 1: BCB directo (datos ya en Bs) ─────────────
  try {
    const datos = await capturarTodosBcb()
    const dato = datos.get(slug)

    if (dato && dato.valor > 0) {
      const valorFinal = Number(dato.valor.toFixed(config.decimales))
      console.log(`[FX] ${slug} BCB OK: ${valorFinal} ${config.unidad}`)
      return {
        slug,
        valor: valorFinal,
        valorTexto: `${valorFinal} ${config.unidad}`,
        confiable: true,
        fecha,
        metadata: JSON.stringify({
          fuente: 'Banco Central de Bolivia',
          metodo: 'bcb_cotizacion_directa',
          valorME: dato.valorME,
        }),
      }
    }
  } catch (err) {
    console.warn(`[FX] ${slug} BCB error:`, err)
  }

  // ── Estrategia 2: Yahoo Finance × TC Oficial (fallback) ────
  try {
    const response = await fetchIndicadores([slug as SlugIndicador])
    const found = response.indicadores.find(i => i.slug === slug)
    if (found && found.valor > 0) {
      // Obtener TC oficial para convertir a Bs
      const datosBcb = await capturarTodosBcb()
      const tcOficial = datosBcb.get('tc-oficial-bcb')
      const tc = tcOficial?.valor ?? 6.96 // Fallback si no hay TC
      const valorBs = Number((found.valor * tc).toFixed(config.decimales))
      console.log(`[FX] ${slug} Yahoo fallback: ${found.valor} × ${tc} = ${valorBs} ${config.unidad}`)
      return {
        slug,
        valor: valorBs,
        valorTexto: `${valorBs} ${config.unidad}`,
        confiable: found.confiable,
        fecha,
        metadata: JSON.stringify({
          fuente: found.fuente,
          metodo: `yahoo × TC ${tc.toFixed(2)}`,
          valorRaw: found.valor,
          tcUsado: tc,
        }),
      }
    }
  } catch { /* seguir */ }

  // ── Fallback: valor conocido ────────────────────────────────
  const { knownValues } = await import('@/lib/services/indicadores.constants')
  const fallback = (knownValues as Record<string, number>)[slug]
  if (fallback && fallback > 0) {
    return {
      slug,
      valor: fallback,
      valorTexto: `${Number(fallback.toFixed(config.decimales))} ${config.unidad}`,
      confiable: false,
      fecha,
      metadata: JSON.stringify({ error: 'BCB y Yahoo fallaron', metodo: 'fallback_estatico' }),
    }
  }

  return {
    slug,
    valor: 0,
    valorTexto: 'N/D',
    confiable: false,
    fecha,
    metadata: JSON.stringify({ error: 'Sin datos disponibles' }),
  }
}

/**
 * Captura metales preciosos del BCB (Oro y Plata en USD/oz).
 * Usa datos directos de la tabla de cotizaciones del BCB.
 */
export async function capturarMetalesBcb(slug: string): Promise<CapturaResult> {
  const fecha = new Date()

  const config =
    Object.values(BCB_CODIGO_MAP).find(c => c.slug === slug) ??
    Object.values(BCB_NOMBRE_MAP).find(c => c.slug === slug)

  if (!config) {
    return {
      slug,
      valor: 0,
      valorTexto: 'N/D',
      confiable: false,
      fecha,
      metadata: JSON.stringify({ error: 'Metal no configurado en BCB maps' }),
    }
  }

  // ── Estrategia 1: BCB (fuente oficial) ─────────────────────
  try {
    const datos = await capturarTodosBcb()
    const dato = datos.get(slug)

    if (dato && dato.valor > 0) {
      const valorFinal = Number(dato.valor.toFixed(config.decimales))
      console.log(`[Metal] ${slug} BCB OK: ${valorFinal} ${config.unidad}`)
      return {
        slug,
        valor: valorFinal,
        valorTexto: `${valorFinal.toLocaleString('es-BO')} ${config.unidad}`,
        confiable: true,
        fecha,
        metadata: JSON.stringify({
          fuente: 'Banco Central de Bolivia',
          metodo: 'bcb_cotizacion_metales',
        }),
      }
    }
  } catch (err) {
    console.warn(`[Metal] ${slug} BCB error:`, err)
  }

  // ── Estrategia 2: Yahoo Finance (fallback) ──────────────────
  try {
    const response = await fetchIndicadores([slug as SlugIndicador])
    const found = response.indicadores.find(i => i.slug === slug)
    if (found && found.valor > 0) {
      console.log(`[Metal] ${slug} Yahoo fallback: ${found.valor} ${config.unidad}`)
      return {
        slug,
        valor: found.valor,
        valorTexto: `${Math.round(found.valor).toLocaleString('es-BO')} ${config.unidad}`,
        confiable: found.confiable,
        fecha,
        metadata: JSON.stringify({ fuente: found.fuente, metodo: 'fallback_yahoo' }),
      }
    }
  } catch { /* seguir */ }

  // ── Fallback ────────────────────────────────────────────────
  const { knownValues } = await import('@/lib/services/indicadores.constants')
  const fallback = (knownValues as Record<string, number>)[slug]
  if (fallback && fallback > 0) {
    return {
      slug,
      valor: fallback,
      valorTexto: `${Math.round(fallback).toLocaleString('es-BO')} ${config.unidad}`,
      confiable: false,
      fecha,
      metadata: JSON.stringify({ error: 'BCB y Yahoo fallaron', metodo: 'fallback_estatico' }),
    }
  }

  return {
    slug,
    valor: 0,
    valorTexto: 'N/D',
    confiable: false,
    fecha,
    metadata: JSON.stringify({ error: 'Sin datos disponibles' }),
  }
}

/**
 * Captura precios LME y commodities via servicio de indicadores (Yahoo + Stooq).
 * Usado para metales que NO están en la tabla del BCB (cobre, zinc, estaño, plomo).
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
