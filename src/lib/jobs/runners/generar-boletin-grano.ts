// Runner: generar_boletin_grano - Boletín del Grano (HTML/PDF, SIN LLM)
// DECODEX Bolivia
//
// Este producto NO usa IA. Genera un boletín sectorial cafetero con:
//   - Clasificación por keywords (no LLM)
//   - Generación de HTML estructurado
//   - Generación de PDF
//   - Guardado como Reporte en DB

import db from '@/lib/db'
import { boliviaStartOfWeek } from '@/lib/date-bolivia'
import { generarHTMLBoletinDelGrano, generarPDFBoletinDelGrano } from '@/lib/services/boletin-del-grano'
import type { JobPayload, RunnerResult } from '../types'

export async function run(payload: JobPayload): Promise<RunnerResult> {
  const startTime = Date.now()
  const modoPrueba = payload.modoPrueba === true

  try {
    console.log('[generar_boletin_grano] Iniciando generacion (HTML/PDF)')

    // Calcular rango de fechas: semana pasada (lunes a domingo) en Bolivia timezone
    const lunesActual = boliviaStartOfWeek()
    const lunesPasado = new Date(lunesActual.getTime() - 7 * 24 * 60 * 60 * 1000)
    const domingoPasado = new Date(lunesPasado.getTime() + 6 * 24 * 60 * 60 * 1000)

    // Buscar menciones con keywords de café (via Lente 9)
    const lente9 = await db.lente.findFirst({ where: { slug: 'cafe-economicas-regionales' } })
    const mencionesRelacionadas = lente9
      ? await db.mencionLente.findMany({
          where: { lenteId: lente9.id },
          include: {
            Mencion: {
              include: {
                Medio: { select: { nombre: true } },
              },
            },
          },
        })
      : []

    // Filtrar por fecha (Bolivia timezone)
    const inicioSemana = boliviaStartOfWeek()
    const lunesPasadoInicio = new Date(inicioSemana.getTime() - 7 * 24 * 60 * 60 * 1000)
    const finSemana = new Date(inicioSemana.getTime() - 1)

    const mencionesSemana = mencionesRelacionadas.filter((mr) => {
      const fechaPub = mr.Mencion.fechaPublicacion || mr.Mencion.fechaCaptura
      const fecha = new Date(fechaPub)
      return fecha >= lunesPasadoInicio && fecha <= finSemana
    })

    let totalNoticias = mencionesSemana.length
    let coberturaLimitada = totalNoticias < 3

    if (totalNoticias < 3 && !modoPrueba) {
      return {
        success: true,
        data: {
          tipoBoletin: 'BOLETIN_DEL_GRANO',
          alerta: true,
          severity: 'baja',
          mensaje: `BOLETIN_DEL_GRANO: Solo ${totalNoticias} noticias relevantes. Minimo: 3.`,
          totalMenciones: 0,
          responseTime: Date.now() - startTime,
        },
      }
    }

    // Clasificar y procesar menciones
    const clasificadas = mencionesSemana.map((mr) => {
      const texto = `${mr.Mencion.titulo} ${mr.Mencion.texto || ''} ${mr.Mencion.textoCompleto || ''}`
      const { ejes, tension } = clasificarNoticia(texto)
      return {
        titulo: mr.Mencion.titulo,
        medio: mr.Mencion.Medio?.nombre || 'Desconocido',
        fecha: mr.Mencion.fechaPublicacion
          ? new Date(mr.Mencion.fechaPublicacion).toLocaleDateString('es-BO')
          : '',
        resumen: (mr.Mencion.texto || mr.Mencion.titulo).slice(0, 200),
        ejes,
        tension,
        fuentes: 1,
        url: mr.Mencion.url || undefined,
      }
    })

    // Ordenar por tensión (ALTA primero)
    const ordenTension: Record<string, number> = { ALTA: 0, MEDIA: 1, BAJA: 2 }
    clasificadas.sort((a, b) => ordenTension[a.tension] - ordenTension[b.tension])
    const noticias = clasificadas.slice(0, 10)
    const fuentesMonitoreadas = new Set(noticias.map((n) => n.medio)).size

    // Construir datos completos (misma lógica del endpoint original)
    const data = buildBoletinData(noticias, fuentesMonitoreadas, totalNoticias, coberturaLimitada, modoPrueba, lunesPasado, domingoPasado)

    // Generar HTML
    const html = generarHTMLBoletinDelGrano(data)

    // Generar PDF
    const pdfBuffer = await generarPDFBoletinDelGrano(data)

    // Guardar como Reporte
    const reporte = await db.reporte.create({
      data: {
        id: crypto.randomUUID(),
        tipo: 'BOLETIN_DEL_GRANO',
        fechaInicio: lunesPasadoInicio,
        fechaFin: finSemana,
        resumen: `Semana ${data.semanaNumero} — ${totalNoticias} noticias — Tension ${data.tensionGeneral}`,
        contenido: JSON.stringify(data),
        totalMenciones: totalNoticias,
        pdfUrl: pdfBuffer.length > 0 ? `/download/boletin-del-grano-semana-${data.semanaNumero}.pdf` : '',
      },
    })

    // Push a GitHub
    try {
      const { pushProductosToGithub } = await import('@/lib/git-utils')
      await pushProductosToGithub(`prod: Boletin del Grano — semana ${data.semanaNumero}`)
    } catch (err) {
      console.warn('[generar_boletin_grano] GitHub push error:', err)
    }

    console.log(`[generar_boletin_grano] OK: semana ${data.semanaNumero}, ${totalNoticias} noticias [${Date.now() - startTime}ms]`)

    return {
      success: true,
      data: {
        tipoBoletin: 'BOLETIN_DEL_GRANO',
        reporteId: reporte.id,
        semana: data.semanaNumero,
        totalNoticias,
        tensionGeneral: data.tensionGeneral,
        responseTime: Date.now() - startTime,
      },
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error(`[generar_boletin_grano] Error: ${msg}`)
    return { success: false, error: msg }
  }
}

const handler = run
export default { handler }

// ─── Funciones auxiliares (extraídas del endpoint original) ─────

const KEYWORDS_EJES: Record<string, string[]> = {
  'Mercado y Precios': ['precio', 'cotización', 'C-market', 'ICE', 'arábica', 'robusta', 'FOB', 'bolsa', 'índice', 'coffee price', 'coffee market'],
  'Clima y Producción': ['clima', 'helada', 'sequía', 'lluvia', 'roya', 'broca', 'cosecha', 'floración', 'producción', 'cafetal', 'Yungas', 'Caranavi', 'incendio'],
  'Política y Regulación': ['SENASAG', 'IBCE', 'EUDR', 'FDA', 'normativa', 'arancel', 'regulación', 'ley', 'decreto', 'certificación', 'exportación', 'gobierno'],
  'Logística y Exportación': ['flete', 'puerto', 'Arica', 'Ilo', 'contenedor', 'ruta', 'transporte', 'logística', 'bloqueo frontera'],
  'Innovación y Técnica': ['procesamiento', 'lavado', 'honey', 'natural', 'anaeróbico', 'torrefacción', 'tueste', 'cata', 'SCA', 'fermentación', 'Geisha', 'Pacamara', 'variedad'],
  'Ferias y Oportunidades': ['feria', 'Expo', 'SCA', 'Cup of Excellence', 'concurso', 'Best of Bolivia', 'capacitación', 'cooperación', 'USAID'],
  'Cadena y Contexto': ['cooperativa', 'CENAPROC', 'COAINE', 'COABOL', 'productor', 'cafetería', 'consumo', 'relevo generacional', 'comunidad'],
}

function clasificarNoticia(texto: string): { ejes: string[]; tension: 'ALTA' | 'MEDIA' | 'BAJA' } {
  const textoLower = texto.toLowerCase()
  const ejesActivados: string[] = []
  let maxDensity = 0

  for (const [eje, keywords] of Object.entries(KEYWORDS_EJES)) {
    let matches = 0
    for (const kw of keywords) {
      if (textoLower.includes(kw.toLowerCase())) matches++
    }
    if (matches > 0) {
      ejesActivados.push(eje)
      if (matches > maxDensity) maxDensity = matches
    }
  }

  if (ejesActivados.length === 0) ejesActivados.push('Cadena y Contexto')

  const altaKeywords = ['caída', 'crisis', 'alerta', 'emergencia', 'huelga', 'bloqueo', 'helada', 'plaga', 'roya', 'daño', 'pérdida', 'cerrar', 'prohibir']
  const mediaKeywords = ['nueva', 'convocatoria', 'cambio', 'variación', 'programa', 'aumento', 'reducción', 'oportunidad', 'regulación', 'acuerdo']

  const altaCount = altaKeywords.filter(k => textoLower.includes(k)).length
  const mediaCount = mediaKeywords.filter(k => textoLower.includes(k)).length

  let tension: 'ALTA' | 'MEDIA' | 'BAJA' = 'BAJA'
  if (altaCount >= 1) tension = 'ALTA'
  else if (mediaCount >= 1) tension = 'MEDIA'

  return { ejes: ejesActivados, tension }
}

function getSemanaNumero(fecha: Date): number {
  const d = new Date(Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

interface NoticiaItem {
  titulo: string
  medio: string
  fecha: string
  resumen: string
  ejes: string[]
  tension: 'ALTA' | 'MEDIA' | 'BAJA'
  fuentes: number
  url?: string
}

function buildBoletinData(
  noticias: NoticiaItem[],
  fuentesMonitoreadas: number,
  totalNoticias: number,
  coberturaLimitada: boolean,
  modoPrueba: boolean,
  lunesPasado: Date,
  domingoPasado: Date,
) {
  const EJES_INTERNOS = ['Mercado y Precios', 'Clima y Producción', 'Política y Regulación', 'Logística y Exportación', 'Innovación y Técnica', 'Ferias y Oportunidades', 'Cadena y Contexto']

  const ejesMap = new Map<string, { count: number; news: Set<string> }>()
  for (const eje of EJES_INTERNOS) ejesMap.set(eje, { count: 0, news: new Set() })
  for (const n of noticias) {
    for (const eje of n.ejes) {
      const entry = ejesMap.get(eje)
      if (entry) { entry.count++; entry.news.add(n.titulo) }
    }
  }
  const totalEjeActivaciones = [...ejesMap.values()].reduce((s, e) => s + e.count, 0)
  const ejesData = [...ejesMap.entries()].map(([nombre, data]) => ({
    nombre,
    cobertura: totalEjeActivaciones > 0 ? Math.round((data.count / totalEjeActivaciones) * 100) : 0,
    noticias: data.count,
    tendencia: data.count > 2 ? '↑' : data.count > 0 ? '→' : '↓',
  }))

  const fuentesMap = new Map<string, number>()
  for (const n of noticias) fuentesMap.set(n.medio, (fuentesMap.get(n.medio) || 0) + 1)
  const fuentesRanking = [...fuentesMap.entries()].sort(([, a], [, b]) => b - a).map(([nombre, cnt]) => ({ nombre, noticias: cnt, nuevas: false }))

  const tensiones = noticias.map((n) => n.tension)
  const tensionGeneral: 'ALTA' | 'MEDIA' | 'BAJA' = tensiones.includes('ALTA') ? 'ALTA' : tensiones.includes('MEDIA') ? 'MEDIA' : 'BAJA'
  const nivelActividad: 'MODERADO' | 'ALTO' | 'CRÍTICO' = totalNoticias >= 15 ? 'CRÍTICO' : totalNoticias >= 8 ? 'ALTO' : 'MODERADO'
  const semanaNumero = getSemanaNumero(domingoPasado)

  const fmtFecha = (d: Date) => d.toLocaleDateString('es-BO', { day: 'numeric', month: 'long', year: 'numeric' })

  return {
    periodoInicio: fmtFecha(lunesPasado),
    periodoFin: fmtFecha(domingoPasado),
    semanaNumero,
    version: 'DECODEX v0.16.0',
    tensionGeneral,
    resumenEjecutivo: coberturaLimitada
      ? 'Cobertura limitada para el período analizado.'
      : `Se identificaron ${totalNoticias} noticias relevantes al sector cafetero boliviano durante la semana del ${fmtFecha(lunesPasado)} al ${fmtFecha(domingoPasado)}.`,
    totalNoticias,
    fuentesMonitoreadas,
    ejesActivados: ejesData.filter((e) => e.noticias > 0).length,
    nivelActividad,
    ejes: ejesData,
    noticiasDestacadas: noticias.slice(0, 5),
    fuentesRanking,
    cruceTransversal: coberturaLimitada ? 'Datos insuficientes.' : `Las ${totalNoticias} noticias activaron ${ejesData.filter((e) => e.noticias > 0).length} de 7 ejes temáticos.`,
    tendenciaProyeccion: 'Se recomienda monitorear: evolución del precio C-market, pronósticos climáticos para zonas cafeteras, y avances en implementación EUDR.',
  }
}