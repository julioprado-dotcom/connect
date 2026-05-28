/**
 * Capturer Tier 1 — ONION200 Indicadores
 * Captura diaria de indicadores macroeconómicos de Bolivia y metales LME.
 *
 * Tier 1: TC Oficial BCB, TC Paralelo, RIN, LME (5 metales)
 *
 * v0.13.0 — LME datos reales via Yahoo Finance + Stooq
 */

import db from '@/lib/db'
import { fetchIndicadores } from '@/lib/services/indicadores'
import type { SlugIndicador } from '@/lib/services/indicadores.types'


// ─── Re-exports from sub-modules (backward compatibility) ────────
export { type CapturaResult, INDICADORES_TIER1, getEjesForIndicador } from './capturer-tier1.config'
export { capturarTcOficial, capturarLmeReal, capturarTodosBcb, capturarDivisaBcb, capturarMetalesBcb, invalidarCacheBcb } from './capturer-tier1.capturers'

// ─── Local imports ───────────────────────────────────────────────
import { INDICADORES_TIER1, getEjesForIndicador } from './capturer-tier1.config'
import type { CapturaResult } from './capturer-tier1.config'
import { capturarTcOficial, capturarDivisaBcb, capturarMetalesBcb } from './capturer-tier1.capturers'

// ─── Seed de indicadores (ejecutar una vez) ──────────────────────

export async function seedIndicadores() {
  for (const ind of INDICADORES_TIER1) {
    const existing = await db.indicador.findUnique({
      where: { slug: ind.slug },
    })

    if (!existing) {
      await db.indicador.create({
        data: {
          ...ind,
          activo: true,
          orden: INDICADORES_TIER1.indexOf(ind),
          ejesTematicos: getEjesForIndicador(ind.slug),
        },
      })
      console.log(`✅ Indicador creado: ${ind.nombre} (${ind.slug})`)
    } else {
      console.log(`⏭️  Indicador ya existe: ${ind.nombre} (${ind.slug})`)
    }
  }
}

// ─── Captura individual (micro-llamada) ───────────────────────────

/**
 * Captura un SOLO indicador por slug. 
 * Retorna resultado aislado — el error de uno nunca afecta a otro.
 * Pensado para micro-llamadas desde la UI (sync uno por uno).
 */
export async function capturarUno(slug: string): Promise<CapturaResult> {
  const fecha = new Date()

  // 1) Buscar definición del indicador en la DB
  let indicadorDef
  try {
    indicadorDef = await db.indicador.findUnique({ where: { slug } })
  } catch {
    return {
      slug,
      valor: 0,
      valorTexto: 'N/D',
      confiable: false,
      fecha,
      metadata: JSON.stringify({ error: 'Error buscando indicador en DB' }),
      error: 'Error buscando indicador en DB',
    }
  }

  if (!indicadorDef) {
    // Si el slug tiene fuente automática, crearlo en la DB al vuelo
    const autoDef = INDICADORES_TIER1.find(d => d.slug === slug)
    if (autoDef) {
      try {
        indicadorDef = await db.indicador.create({
          data: {
            ...autoDef,
            id: autoDef.slug, // Usar slug como ID (es único por definición)
            activo: true,
            orden: INDICADORES_TIER1.indexOf(autoDef),
            ejesTematicos: getEjesForIndicador(autoDef.slug),
            fechaActualizacion: new Date(), // Requerido por schema (sin @default)
          },
        })
        console.log(`[capturarUno] Indicador auto-creado: ${autoDef.nombre} (${slug})`)
      } catch (createErr) {
        console.error(`[capturarUno] Error creando indicador ${slug}:`, createErr)
        return {
          slug,
          valor: 0,
          valorTexto: 'N/D',
          confiable: false,
          fecha,
          metadata: JSON.stringify({ error: 'Indicador no encontrado y error al crearlo' }),
          error: 'Indicador no encontrado',
        }
      }
    } else {
      return {
        slug,
        valor: 0,
        valorTexto: 'N/D',
        confiable: false,
        fecha,
        metadata: JSON.stringify({ error: 'Indicador no encontrado' }),
        error: 'Indicador no encontrado',
      }
    }
  }

  // 2) Intentar obtener dato real según el slug
  let resultado: CapturaResult | null = null

  try {
    // ── TC Oficial: scraper BCB (fuente primaria) ──────────
    if (slug === 'tc-oficial-bcb' || slug === 'tc-oficial-compra') {
      resultado = await capturarTcOficial()
    }
    // ── Divisas FX: BCB directo (ya en Bs, sin multiplicar) ──
    else if (slug.startsWith('fx-')) {
      resultado = await capturarDivisaBcb(slug)
    }
    // ── Metales del BCB: Oro y Plata ─────────────────────────
    else if (slug === 'com-oro-bcb' || slug === 'com-plata-bcb') {
      resultado = await capturarMetalesBcb(slug)
    }
    // ── LME, commodities y energéticos: Yahoo/Stooq ───────────
    else if (
      ['lme-cobre', 'lme-zinc', 'lme-estano', 'lme-plata', 'lme-plomo',
       'com-oro', 'com-litio', 'com-tierras-raras',
       'agr-cafe', 'agr-soya', 'agr-arroz', 'agr-azucar', 'agr-maiz', 'agr-trigo',
       'nrg-petroleo', 'nrg-gas-natural', 'nrg-gasolina', 'nrg-diesel', 'nrg-glp'
      ].includes(slug)
    ) {
      const response = await fetchIndicadores([slug as SlugIndicador])
      const found = response.indicadores.find(i => i.slug === slug)
      if (found) {
        resultado = {
          slug,
          valor: found.valor,
          valorTexto: `${found.valor.toLocaleString('es-BO', { minimumFractionDigits: indicadorDef.formatoNumero > 0 ? indicadorDef.formatoNumero : 0, maximumFractionDigits: indicadorDef.formatoNumero })} ${indicadorDef.unidad}`,
          confiable: found.confiable,
          fecha,
          metadata: JSON.stringify({
            fuente: found.fuente,
            metodo: found.confiable ? 'api_real' : 'fallback',
            valorRaw: found.valor,
            variacionPct: found.variacion,
            fuentesUsadas: response.fuentesUsadas,
          }),
        }
      }
    }
    // Indicadores Tier 2/3 sin fuente automática — dato disponible solo si ya existe en DB
    if (!resultado) {
      resultado = {
        slug,
        valor: 0,
        valorTexto: 'N/D',
        confiable: false,
        fecha,
        metadata: JSON.stringify({ 
          error: 'Sin fuente automática de datos',
          hint: 'Este indicador se actualiza manualmente o tiene periodicidad mayor a diaria',
        }),
        error: 'Sin fuente automática — datos manuales',
      }
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Error desconocido'
    resultado = {
      slug,
      valor: 0,
      valorTexto: 'N/D',
      confiable: false,
      fecha,
      metadata: JSON.stringify({ error: errorMsg }),
      error: errorMsg,
    }
  }

  // 3) Persistir resultado en DB (independientemente del éxito o fracaso)
  try {
    const valorId = `${indicadorDef.id}-${resultado.fecha.toISOString().slice(0, 10)}`
    await db.indicadorValor.create({
      data: {
        id: valorId,
        indicadorId: indicadorDef.id,
        fecha: resultado.fecha,
        valor: resultado.valor,
        valorTexto: resultado.valorTexto,
        confiable: resultado.confiable,
        metadata: resultado.metadata,
      },
    })
  } catch (dbError) {
    console.error(`[capturarUno] Error guardando ${slug}:`, dbError)
    // No propagar — el error de DB no frena al indicador
  }

  return resultado
}

// ─── Capturar todos los Tier 1 (paralelo, con fallback) ─────────

/**
 * Captura todos los Tier 1 de forma PARALELA.
 * Cada indicador se procesa de forma aislada — si uno falla, no frena los demás.
 * Se aceptan valores de fallback (confiable=false) como datos válidos
 * porque proporcionan información útil aunque no sean de fuente primaria.
 *
 * Tiempo estimado: ~15-25s (vs ~240s secuencial anterior)
 */
export async function capturarTier1(): Promise<{
  exitosos: CapturaResult[]
  fallidos: CapturaResult[]
  total: number
}> {
  const exitosos: CapturaResult[] = []
  const fallidos: CapturaResult[] = []

  // Slugs que tienen fuente automática (Tier 1)
  const slugsTier1 = [
    'tc-oficial-bcb', 'tc-oficial-compra',
    'fx-eur-usd', 'fx-cny-usd', 'fx-brl-usd', 'fx-pen-usd', 'fx-clp-usd',
    'fx-ars-usd', 'fx-pyg-usd', 'fx-jpy-usd', 'fx-gbp-usd', 'fx-chf-usd',
    'com-oro-bcb', 'com-plata-bcb',
    'lme-cobre', 'lme-zinc', 'lme-estano', 'lme-plata', 'lme-plomo',
    'com-oro', 'com-litio', 'com-tierras-raras',
    'agr-cafe', 'agr-soya', 'agr-arroz', 'agr-azucar', 'agr-maiz', 'agr-trigo',
    'nrg-petroleo', 'nrg-gas-natural', 'nrg-gasolina', 'nrg-diesel', 'nrg-glp',
  ]

  // Procesar TODOS en paralelo — reduce tiempo de ~240s a ~20s
  const resultados = await Promise.allSettled(
    slugsTier1.map(async (slug) => {
      try {
        return await capturarUno(slug)
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Error desconocido'
        return {
          slug,
          valor: 0,
          valorTexto: 'N/D',
          confiable: false,
          fecha: new Date(),
          metadata: JSON.stringify({ error: errorMsg }),
          error: errorMsg,
        } as CapturaResult
      }
    })
  )

  for (const result of resultados) {
    if (result.status === 'fulfilled') {
      const r = result.value
      // Aceptar cualquier valor > 0, incluso fallback (confiable=false)
      // porque es mejor mostrar un valor estimado que "---"
      if (r.valor > 0) {
        exitosos.push(r)
      } else {
        fallidos.push(r)
      }
    } else {
      // Promise rejected (shouldn't happen with our wrapper, but just in case)
      fallidos.push({
        slug: 'unknown',
        valor: 0,
        valorTexto: 'N/D',
        confiable: false,
        fecha: new Date(),
        metadata: JSON.stringify({ error: result.reason?.message || 'Promise rejected' }),
      })
    }
  }

  return {
    exitosos,
    fallidos,
    total: exitosos.length + fallidos.length,
  }
}

// ─── Obtener último valor de un indicador ─────────────────────────

export async function getUltimoValor(slug: string): Promise<{
  valor: number
  valorTexto: string
  fecha: Date
  confiable: boolean
} | null> {
  const indicador = await db.indicador.findUnique({
    where: { slug },
  })

  if (!indicador) return null

  const ultimo = await db.indicadorValor.findFirst({
    where: { indicadorId: indicador.id },
    orderBy: { fecha: 'desc' },
  })

  if (!ultimo) return null

  return {
    valor: ultimo.valor,
    valorTexto: ultimo.valorTexto,
    fecha: ultimo.fecha,
    confiable: ultimo.confiable,
  }
}

// ─── Obtener variación de un indicador ───────────────────────────

export async function getVariacion(slug: string, periodos: number = 2): Promise<{
  actual: number
  anterior: number
  variacion: number
  variacionPct: number
} | null> {
  const indicador = await db.indicador.findUnique({
    where: { slug },
  })

  if (!indicador) return null

  const valores = await db.indicadorValor.findMany({
    where: { indicadorId: indicador.id },
    orderBy: { fecha: 'desc' },
    take: periodos + 1,
  })

  if (valores.length < 2) return null

  const actual = valores[0].valor
  const anterior = valores[valores.length - 1].valor

  const variacion = actual - anterior
  const variacionPct = anterior !== 0 ? (variacion / anterior) * 100 : 0

  return { actual, anterior, variacion, variacionPct }
}
