/**
 * Capturer Tier 1 — ONION200 Indicadores
 * Captura diaria de indicadores macroeconómicos de Bolivia y metales LME.
 *
 * Tier 1: TC Oficial BCB, TC Paralelo, RIN, LME (4 metales)
 */

import { db as prisma } from '@/lib/db'

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

async function capturarLme(metal: string): Promise<CapturaResult> {
  const fecha = new Date()

  try {
    const urls: Record<string, string> = {
      'lme-cobre': 'https://www.lme.com/en/metals/non-ferrous/copper',
      'lme-zinc': 'https://www.lme.com/en/metals/non-ferrous/zinc',
      'lme-estano': 'https://www.lme.com/en/metals/non-ferrous/tin',
      'lme-plata': 'https://www.lme.com/en/metals/precious-metals/silver',
      'lme-plomo': 'https://www.lme.com/en/metals/non-ferrous/lead',
    }

    const nombres: Record<string, string> = {
      'lme-cobre': 'Cobre',
      'lme-zinc': 'Zinc',
      'lme-estano': 'Estano',
      'lme-plata': 'Plata',
      'lme-plomo': 'Plomo',
    }

    const url = urls[metal]
    if (!url) {
      throw new Error(`Metal no configurado: ${metal}`)
    }

    // Nota: LME usa JavaScript para renderizar precios, scraping directo
    // puede no funcionar. Este es un placeholder que usa un proxy o API alternativa.
    // En producción, se usaría Metal Price API o similar.
    const preciosBase: Record<string, number> = {
      'lme-cobre': 9500,
      'lme-zinc': 2800,
      'lme-estano': 32000,
      'lme-plata': 11500,
      'lme-plomo': 2100,
    }

    // Simular variación aleatoria de ±3% para desarrollo
    const base = preciosBase[metal] ?? 0
    const variacion = 1 + (Math.random() * 0.06 - 0.03)
    const valor = Math.round(base * variacion)

    return {
      slug: metal,
      valor,
      valorTexto: `${valor.toLocaleString('es-BO')} USD/ton`,
      confiable: false, // marcado como no confiable hasta implementar API real
      fecha,
      metadata: JSON.stringify({
        fuente: 'proxy',
        metodo: 'estimado',
        metal: nombres[metal] ?? metal,
        nota: 'Requiere implementar Metal Price API o scraping LME real',
      }),
    }
  } catch (error) {
    return {
      slug: metal,
      valor: 0,
      valorTexto: 'N/D',
      confiable: false,
      fecha,
      metadata: JSON.stringify({ error: error instanceof Error ? error.message : 'unknown' }),
    }
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

  // LME Metales
  const metales = ['lme-cobre', 'lme-zinc', 'lme-estano', 'lme-plata', 'lme-plomo']
  for (const metal of metales) {
    const resultado = await capturarLme(metal)
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
