/**
 * Capturer Tier 1 — ONION200 Indicadores
 * Captura diaria de indicadores macroeconómicos de Bolivia y metales LME.
 *
 * Tier 1: TC Oficial BCB, TC Paralelo, RIN, LME (5 metales)
 *
 * v0.13.0 — LME datos reales via Yahoo Finance + Stooq
 */

import { db as prisma } from '@/lib/db'
import { fetchIndicadores } from '@/lib/services/indicadores'
import type { SlugIndicador } from '@/lib/services/indicadores.types'

// ─── Tipos ────────────────────────────────────────────────────────

interface CapturaResult {
  slug: string
  valor: number
  valorTexto: string
  confiable: boolean
  fecha: Date
  metadata: string
}

// ─── Indicadores Tier 1 configuración ─────────────────────────────

const INDICADORES_TIER1 = [
  {
    slug: 'tc-oficial-bcb',
    nombre: 'Tipo de Cambio Oficial',
    categoria: 'monetario',
    fuente: 'Banco Central de Bolivia',
    url: 'https://www.bcb.gob.bo/?q=tipos_de_cambio',
    periodicidad: 'diaria',
    unidad: 'Bs/USD',
    formatoNumero: 2,
    tier: 1,
  },
  {
    slug: 'tc-paralelo',
    nombre: 'Tipo de Cambio Paralelo',
    categoria: 'monetario',
    fuente: 'Investing.com',
    url: 'https://www.investing.com/currencies/usd-bob',
    periodicidad: 'diaria',
    unidad: 'Bs/USD',
    formatoNumero: 2,
    tier: 1,
  },
  {
    slug: 'rin-bcb',
    nombre: 'Reservas Internacionales Netas',
    categoria: 'monetario',
    fuente: 'Banco Central de Bolivia',
    url: 'https://www.bcb.gob.bo/?q=estadisticas/ri',
    periodicidad: 'semanal',
    unidad: 'USD millones',
    formatoNumero: 1,
    tier: 1,
  },
  {
    slug: 'lme-cobre',
    nombre: 'LME Cobre',
    categoria: 'minero',
    fuente: 'London Metal Exchange',
    url: 'https://www.lme.com/en/metals/non-ferrous/copper',
    periodicidad: 'diaria',
    unidad: 'USD/ton',
    formatoNumero: 2,
    tier: 1,
  },
  {
    slug: 'lme-zinc',
    nombre: 'LME Zinc',
    categoria: 'minero',
    fuente: 'London Metal Exchange',
    url: 'https://www.lme.com/en/metals/non-ferrous/zinc',
    periodicidad: 'diaria',
    unidad: 'USD/ton',
    formatoNumero: 2,
    tier: 1,
  },
  {
    slug: 'lme-estano',
    nombre: 'LME Estano',
    categoria: 'minero',
    fuente: 'London Metal Exchange',
    url: 'https://www.lme.com/en/metals/non-ferrous/tin',
    periodicidad: 'diaria',
    unidad: 'USD/ton',
    formatoNumero: 2,
    tier: 1,
  },
  {
    slug: 'lme-plata',
    nombre: 'LME Plata',
    categoria: 'minero',
    fuente: 'London Metal Exchange',
    url: 'https://www.lme.com/en/metals/precious-metals/silver',
    periodicidad: 'diaria',
    unidad: 'USD/ton',
    formatoNumero: 2,
    tier: 1,
  },
  {
    slug: 'lme-plomo',
    nombre: 'LME Plomo',
    categoria: 'minero',
    fuente: 'London Metal Exchange',
    url: 'https://www.lme.com/en/metals/non-ferrous/lead',
    periodicidad: 'diaria',
    unidad: 'USD/ton',
    formatoNumero: 2,
    tier: 1,
  },
  // ─── Tier 1: Commodities Agrícolas ──────────────────────
  {
    slug: 'agr-cafe',
    nombre: 'Café (Internacional)',
    categoria: 'agricolas',
    fuente: 'Yahoo Finance (ICE Coffee)',
    url: 'https://www.investing.com/commodities/coffee',
    periodicidad: 'diaria',
    unidad: 'USc/lb',
    formatoNumero: 2,
    tier: 1,
  },
  {
    slug: 'agr-quinua',
    nombre: 'Quinua (Mercado Internacional)',
    categoria: 'agricolas',
    fuente: 'FAO / Mercado local',
    url: '',
    periodicidad: 'semanal',
    unidad: 'USD/ton',
    formatoNumero: 0,
    tier: 2,
  },
  {
    slug: 'agr-soya',
    nombre: 'Soya (Internacional)',
    categoria: 'agricolas',
    fuente: 'Yahoo Finance (CBOT Soybeans)',
    url: 'https://www.investing.com/commodities/soybeans',
    periodicidad: 'diaria',
    unidad: 'USc/bushel',
    formatoNumero: 2,
    tier: 1,
  },
  {
    slug: 'agr-arroz',
    nombre: 'Arroz (Internacional)',
    categoria: 'agricolas',
    fuente: 'Yahoo Finance (CBOT Rice)',
    url: 'https://www.investing.com/commodities/rice',
    periodicidad: 'diaria',
    unidad: 'USD/cwt',
    formatoNumero: 2,
    tier: 1,
  },
  {
    slug: 'agr-azucar',
    nombre: 'Azúcar (Internacional)',
    categoria: 'agricolas',
    fuente: 'Yahoo Finance (ICE Sugar)',
    url: 'https://www.investing.com/commodities/sugar',
    periodicidad: 'diaria',
    unidad: 'USc/lb',
    formatoNumero: 2,
    tier: 1,
  },
  {
    slug: 'agr-maiz',
    nombre: 'Maíz (Internacional)',
    categoria: 'agricolas',
    fuente: 'Yahoo Finance (CBOT Corn)',
    url: 'https://www.investing.com/commodities/corn',
    periodicidad: 'diaria',
    unidad: 'USc/bushel',
    formatoNumero: 2,
    tier: 1,
  },
  {
    slug: 'agr-trigo',
    nombre: 'Trigo (Internacional)',
    categoria: 'agricolas',
    fuente: 'Yahoo Finance (CBOT Wheat)',
    url: 'https://www.investing.com/commodities/wheat',
    periodicidad: 'diaria',
    unidad: 'USc/bushel',
    formatoNumero: 2,
    tier: 1,
  },
  // ─── Tier 1: Macroeconomía BCB ──────────────────────
  {
    slug: 'macro-ipc-bcb',
    nombre: 'Inflación (IPC) BCB',
    categoria: 'macro_bcb',
    fuente: 'Banco Central de Bolivia',
    url: 'https://www.bcb.gob.bo/?q=indicadores/indice_precios',
    periodicidad: 'mensual',
    unidad: '% anual',
    formatoNumero: 2,
    tier: 1,
  },
  {
    slug: 'macro-tasa-interes',
    nombre: 'Tasa de Interés de Referencia',
    categoria: 'macro_bcb',
    fuente: 'Banco Central de Bolivia',
    url: 'https://www.bcb.gob.bo/?q=politica_monetaria/tasas',
    periodicidad: 'mensual',
    unidad: '% anual',
    formatoNumero: 2,
    tier: 1,
  },
  {
    slug: 'macro-reservas-internacionales',
    nombre: 'Reservas Internacionales (RIN)',
    categoria: 'macro_bcb',
    fuente: 'Banco Central de Bolivia',
    url: 'https://www.bcb.gob.bo/?q=estadisticas/ri',
    periodicidad: 'semanal',
    unidad: 'MM USD',
    formatoNumero: 1,
    tier: 1,
  },
  {
    slug: 'macro-riesgo-pais',
    nombre: 'Riesgo País (EMBI)',
    categoria: 'macro_bcb',
    fuente: 'JP Morgan / Investing.com',
    url: 'https://www.investing.com/indices/embi-plus-bolivia',
    periodicidad: 'diaria',
    unidad: 'bps',
    formatoNumero: 0,
    tier: 2,
  },
  {
    slug: 'macro-deuda-publica',
    nombre: 'Deuda Pública / PIB',
    categoria: 'macro_bcb',
    fuente: 'Banco Central de Bolivia',
    url: 'https://www.bcb.gob.bo',
    periodicidad: 'trimestral',
    unidad: '% PIB',
    formatoNumero: 1,
    tier: 2,
  },
  {
    slug: 'macro-pib',
    nombre: 'Producto Interno Bruto',
    categoria: 'macro_bcb',
    fuente: 'Banco Central de Bolivia',
    url: 'https://www.bcb.gob.bo/?q=estadisticas/pib',
    periodicidad: 'trimestral',
    unidad: 'MM USD',
    formatoNumero: 1,
    tier: 2,
  },
  {
    slug: 'macro-balanza-comercial',
    nombre: 'Balanza Comercial',
    categoria: 'macro_bcb',
    fuente: 'Banco Central de Bolivia',
    url: 'https://www.bcb.gob.bo/?q=estadisticas/balanza',
    periodicidad: 'mensual',
    unidad: 'MM USD',
    formatoNumero: 1,
    tier: 2,
  },
  // ─── INE ──────────────────────────────────────
  {
    slug: 'ine-poblacion',
    nombre: 'Población Estimada',
    categoria: 'ine',
    fuente: 'Instituto Nacional de Estadística (INE)',
    url: 'https://www.ine.gob.bo',
    periodicidad: 'anual',
    unidad: 'habitantes',
    formatoNumero: 0,
    tier: 3,
  },
  {
    slug: 'ine-pobreza',
    nombre: 'Tasa de Pobreza Extrema',
    categoria: 'ine',
    fuente: 'Instituto Nacional de Estadística (INE)',
    url: 'https://www.ine.gob.bo',
    periodicidad: 'anual',
    unidad: '%',
    formatoNumero: 1,
    tier: 3,
  },
  {
    slug: 'ine-empleo',
    nombre: 'Tasa de Empleo Adecuado',
    categoria: 'ine',
    fuente: 'Instituto Nacional de Estadística (INE)',
    url: 'https://www.ine.gob.bo',
    periodicidad: 'trimestral',
    unidad: '%',
    formatoNumero: 1,
    tier: 3,
  },
  {
    slug: 'ine-pib-departamental',
    nombre: 'PIB Departamental',
    categoria: 'ine',
    fuente: 'Instituto Nacional de Estadística (INE)',
    url: 'https://www.ine.gob.bo',
    periodicidad: 'anual',
    unidad: 'MM USD',
    formatoNumero: 1,
    tier: 3,
  },
  // ─── Salud ──────────────────────────────────────
  {
    slug: 'salud-desnutricion',
    nombre: 'Desnutrición Crónica (< 5 años)',
    categoria: 'salud',
    fuente: 'Ministerio de Salud y Deportes / ENDSA',
    url: 'https://www.minsalud.gob.bo',
    periodicidad: 'anual',
    unidad: '%',
    formatoNumero: 1,
    tier: 3,
  },
  {
    slug: 'salud-materna',
    nombre: 'Mortalidad Materna',
    categoria: 'salud',
    fuente: 'Ministerio de Salud y Deportes / ENDSA',
    url: 'https://www.minsalud.gob.bo',
    periodicidad: 'anual',
    unidad: 'x 100,000 nv',
    formatoNumero: 0,
    tier: 3,
  },
  {
    slug: 'salud-esperanza-vida',
    nombre: 'Esperanza de Vida al Nacer',
    categoria: 'salud',
    fuente: 'Instituto Nacional de Estadística (INE) / ENDSA',
    url: 'https://www.ine.gob.bo',
    periodicidad: 'anual',
    unidad: 'años',
    formatoNumero: 1,
    tier: 3,
  },
  // ─── Tier 2: Indicadores de Conflictividad ──────────────────────
  {
    slug: 'conflictividad-tns',
    nombre: 'Índice de Tensión Social',
    categoria: 'social',
    fuente: 'ONION200 (análisis de menciones)',
    url: '',
    periodicidad: 'diaria',
    unidad: 'escala 1-10',
    formatoNumero: 1,
    tier: 2,
  },
  {
    slug: 'conflictividad-bloqueos',
    nombre: 'Bloqueos / Marchas Activas',
    categoria: 'social',
    fuente: 'ONION200 (análisis de menciones)',
    url: '',
    periodicidad: 'diaria',
    unidad: 'eventos',
    formatoNumero: 0,
    tier: 2,
  },
  {
    slug: 'conflictividad-puntos',
    nombre: 'Puntos de Conflicto',
    categoria: 'social',
    fuente: 'ONION200 (análisis de menciones)',
    url: '',
    periodicidad: 'diaria',
    unidad: 'puntos',
    formatoNumero: 0,
    tier: 2,
  },
  {
    slug: 'conflictividad-escalamiento',
    nombre: 'Nivel de Escalamiento',
    categoria: 'social',
    fuente: 'ONION200 (evaluación general)',
    url: '',
    periodicidad: 'diaria',
    unidad: 'categoría',
    formatoNumero: 0,
    tier: 2,
  },
  // ─── Minería Boliviana ──────────────────────────────────────
  {
    slug: 'mineria-produccion-tm',
    nombre: 'Producción Minera (TMF)',
    categoria: 'minero',
    fuente: 'Servicio Nacional de Registro y Control de la Comercialización de Minerales y Metales (SENARECOM)',
    url: 'https://senarecom.gob.bo',
    periodicidad: 'mensual',
    unidad: 'TMF',
    formatoNumero: 0,
    tier: 2,
  },
  {
    slug: 'mineria-exportaciones-fob',
    nombre: 'Exportaciones Mineras FOB',
    categoria: 'minero',
    fuente: 'Instituto Nacional de Estadística (INE)',
    url: 'https://www.ine.gob.bo',
    periodicidad: 'mensual',
    unidad: 'USD millones',
    formatoNumero: 1,
    tier: 2,
  },
  {
    slug: 'mineria-precios-lme-zinc',
    nombre: 'Precio LME Zinc',
    categoria: 'minero',
    fuente: 'London Metal Exchange',
    url: 'https://www.lme.com/en/metals/non-ferrous/zinc',
    periodicidad: 'diaria',
    unidad: 'USD/ton',
    formatoNumero: 2,
    tier: 1,
  },
  {
    slug: 'mineria-precios-lme-estano',
    nombre: 'Precio LME Estaño',
    categoria: 'minero',
    fuente: 'London Metal Exchange',
    url: 'https://www.lme.com/en/metals/non-ferrous/tin',
    periodicidad: 'diaria',
    unidad: 'USD/ton',
    formatoNumero: 2,
    tier: 1,
  },
  {
    slug: 'mineria-precios-lme-plata',
    nombre: 'Precio LME Plata',
    categoria: 'minero',
    fuente: 'London Metal Exchange',
    url: 'https://www.lme.com/en/metals/precious-metals/silver',
    periodicidad: 'diaria',
    unidad: 'USD/ton',
    formatoNumero: 2,
    tier: 1,
  },
  {
    slug: 'mineria-precios-lme-plomo',
    nombre: 'Precio LME Plomo',
    categoria: 'minero',
    fuente: 'London Metal Exchange',
    url: 'https://www.lme.com/en/metals/non-ferrous/lead',
    periodicidad: 'diaria',
    unidad: 'USD/ton',
    formatoNumero: 2,
    tier: 1,
  },
  {
    slug: 'mineria-precio-litio',
    nombre: 'Precio Carbonato de Litio',
    categoria: 'minero',
    fuente: 'Benchmark Mineral Intelligence',
    url: 'https://www.benchmarkminerals.com',
    periodicidad: 'semanal',
    unidad: 'USD/ton',
    formatoNumero: 0,
    tier: 2,
  },
  {
    slug: 'mineria-litio-ylb',
    nombre: 'Avance Proyecto YLB EV Metals',
    categoria: 'minero',
    fuente: 'Yacimientos de Litio Bolivianos (YLB)',
    url: 'https://www.ylb.gob.bo',
    periodicidad: 'trimestral',
    unidad: '% avance',
    formatoNumero: 1,
    tier: 3,
  },
  {
    slug: 'mineria-conflictividad-cooperativas',
    nombre: 'Conflictividad Minera (Cooperativas)',
    categoria: 'social',
    fuente: 'ONION200 (análisis de menciones)',
    url: '',
    periodicidad: 'diaria',
    unidad: 'eventos',
    formatoNumero: 0,
    tier: 2,
  },
  {
    slug: 'mineria-pasivos-ambientales',
    nombre: 'Pasivos Ambientales Mineros',
    categoria: 'minero',
    fuente: 'Ministerio de Medio Ambiente y Agua',
    url: 'https://www.mmaya.gob.bo',
    periodicidad: 'anual',
    unidad: 'sitios',
    formatoNumero: 0,
    tier: 3,
  },
  {
    slug: 'mineria-regalias-recaudacion',
    nombre: 'Recaudación Regalías Mineras',
    categoria: 'economico',
    fuente: 'Ministerio de Minería y Metalurgia',
    url: 'https://www.mineria.gob.bo',
    periodicidad: 'mensual',
    unidad: 'Bs millones',
    formatoNumero: 1,
    tier: 2,
  },
  {
    slug: 'mineria-dias-perdidos-paros',
    nombre: 'Días Perdidos por Paros Mineros',
    categoria: 'social',
    fuente: 'ONION200 (análisis de menciones)',
    url: '',
    periodicidad: 'semanal',
    unidad: 'días',
    formatoNumero: 0,
    tier: 2,
  },
]

// ─── Seed de indicadores (ejecutar una vez) ──────────────────────

export async function seedIndicadores() {
  for (const ind of INDICADORES_TIER1) {
    const existing = await prisma.indicador.findUnique({
      where: { slug: ind.slug },
    })

    if (!existing) {
      await prisma.indicador.create({
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

// ─── Mapping indicador → ejes temáticos ──────────────────────────

function getEjesForIndicador(slug: string): string {
  const mapping: Record<string, string> = {
    'tc-oficial-bcb': 'economia,hidrocarburos,relaciones-internacionales',
    'tc-paralelo': 'economia,hidrocarburos',
    'rin-bcb': 'economia,relaciones-internacionales',
    'lme-cobre': 'medio-ambiente,economia',
    'lme-zinc': 'medio-ambiente,economia',
    'lme-estano': 'medio-ambiente,economia',
    'lme-plata': 'medio-ambiente,economia',
    'lme-plomo': 'medio-ambiente,economia',
    'conflictividad-tns': 'movimientos-sociales,gobierno-oposicion,corrupcion-impunidad',
    'conflictividad-bloqueos': 'movimientos-sociales,educacion-cultura,salud-servicios',
    'conflictividad-puntos': 'movimientos-sociales,gobierno-oposicion',
    'conflictividad-escalamiento': 'movimientos-sociales,gobierno-oposicion,procesos-electorales',
    // Minería Boliviana
    'mineria-produccion-tm': 'mineria,economia,hidrocarburos-energia',
    'mineria-exportaciones-fob': 'mineria,economia,relaciones-internacionales',
    'mineria-precios-lme-zinc': 'mineria,economia',
    'mineria-precios-lme-estano': 'mineria,economia',
    'mineria-precios-lme-plata': 'mineria,economia',
    'mineria-precios-lme-plomo': 'mineria,economia',
    'mineria-precio-litio': 'mineria,hidrocarburos-energia,relaciones-internacionales',
    'mineria-litio-ylb': 'mineria,gobierno-oposicion,hidrocarburos-energia',
    'mineria-conflictividad-cooperativas': 'mineria,movimientos-sociales,justicia-derechos',
    'mineria-pasivos-ambientales': 'mineria,medio-ambiente',
    'mineria-regalias-recaudacion': 'mineria,economia,gobierno-oposicion',
    'mineria-dias-perdidos-paros': 'mineria,movimientos-sociales',
    // Commodities Agrícolas
    'agr-cafe': 'economia,relaciones-internacionales',
    'agr-quinua': 'economia,medio-ambiente',
    'agr-soya': 'economia,hidrocarburos-energia,relaciones-internacionales',
    'agr-arroz': 'economia,medio-ambiente',
    'agr-azucar': 'economia,relaciones-internacionales',
    'agr-maiz': 'economia,medio-ambiente',
    'agr-trigo': 'economia,relaciones-internacionales',
    // Macroeconomía BCB
    'macro-ipc-bcb': 'economia,gobierno-oposicion',
    'macro-tasa-interes': 'economia,hidrocarburos-energia',
    'macro-reservas-internacionales': 'economia,relaciones-internacionales',
    'macro-riesgo-pais': 'economia,relaciones-internacionales,gobierno-oposicion',
    'macro-deuda-publica': 'economia,gobierno-oposicion',
    'macro-pib': 'economia,relaciones-internacionales',
    'macro-balanza-comercial': 'economia,relaciones-internacionales,hidrocarburos-energia',
    // INE
    'ine-poblacion': 'justicia-derechos,salud-servicios',
    'ine-pobreza': 'justicia-derechos,gobierno-oposicion',
    'ine-empleo': 'economia,justicia-derechos',
    'ine-pib-departamental': 'economia',
    // Salud
    'salud-desnutricion': 'salud-servicios,justicia-derechos,gobierno-oposicion',
    'salud-materna': 'salud-servicios,justicia-derechos',
    'salud-esperanza-vida': 'salud-servicios,justicia-derechos',
  }
  return mapping[slug] ?? ''
}

// ─── Capturadores individuales ───────────────────────────────────

async function capturarTcOficial(): Promise<CapturaResult> {
  const fecha = new Date()

  try {
    const response = await fetch('https://www.bcb.gob.bo/?q=tipos_de_cambio', {
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

    // Parseo: buscar patrones numéricos que parezcan tipo de cambio (6.86 - 8.50 rango)
    const tcPattern = /(\d+)[.,](\d{2})/g
    let match = tcPattern.exec(html)
    let valor = 0

    while (match !== null) {
      const num = parseFloat(`${match[1]}.${match[2]}`)
      if (num >= 6.5 && num <= 9.0) {
        valor = num
        break
      }
      match = tcPattern.exec(html)
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
async function capturarLmeReal(
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

// ─── Capturar todos los Tier 1 ────────────────────────────────────

export async function capturarTier1(): Promise<{
  exitosos: CapturaResult[]
  fallidos: CapturaResult[]
  total: number
}> {
  const exitosos: CapturaResult[] = []
  const fallidos: CapturaResult[] = []

  // TC Oficial
  const tcOficial = await capturarTcOficial()
  if (tcOficial.confiable && tcOficial.valor > 0) {
    exitosos.push(tcOficial)
  } else {
    fallidos.push(tcOficial)
  }

  // LME Metales — datos reales via Yahoo Finance + Stooq
  const lmeSlugs: SlugIndicador[] = ['lme-cobre', 'lme-zinc', 'lme-estano', 'lme-plata', 'lme-plomo']
  const lmeResultados = await capturarLmeReal(lmeSlugs)
  for (const resultado of lmeResultados) {
    if (resultado.valor > 0) {
      exitosos.push(resultado)
    } else {
      fallidos.push(resultado)
    }
  }

  // Commodities Agrícolas — datos reales via Yahoo Finance
  const agrSlugs: SlugIndicador[] = ['agr-cafe', 'agr-soya', 'agr-arroz', 'agr-azucar', 'agr-maiz', 'agr-trigo']
  const agrResultados = await capturarLmeReal(agrSlugs)
  for (const resultado of agrResultados) {
    if (resultado.valor > 0) {
      exitosos.push(resultado)
    } else {
      fallidos.push(resultado)
    }
  }

  // Guardar resultados en DB
  for (const resultado of [...exitosos, ...fallidos]) {
    try {
      const indicador = await prisma.indicador.findUnique({
        where: { slug: resultado.slug },
      })

      if (indicador) {
        await prisma.indicadorValor.create({
          data: {
            indicadorId: indicador.id,
            fecha: resultado.fecha,
            valor: resultado.valor,
            valorTexto: resultado.valorTexto,
            confiable: resultado.confiable,
            metadata: resultado.metadata,
          },
        })
      }
    } catch (dbError) {
      console.error(`Error guardando ${resultado.slug}:`, dbError)
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
  const indicador = await prisma.indicador.findUnique({
    where: { slug },
  })

  if (!indicador) return null

  const ultimo = await prisma.indicadorValor.findFirst({
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
  const indicador = await prisma.indicador.findUnique({
    where: { slug },
  })

  if (!indicador) return null

  const valores = await prisma.indicadorValor.findMany({
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
