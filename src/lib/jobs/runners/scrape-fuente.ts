// Runner: scrape_fuente - Pipeline optimizado 3 fases
// DECODEX Bolivia v0.15.0
// Se ejecuta DESPUÉS de que check-first detecta un cambio
//
// FASE 1: Extraer links de notas del HTML de homepage (regex, SIN IA)
// FASE 2: Triaje por keywords local (SIN IA, SIN descargas extra)
// FASE 3: Clasificar notas relevantes con LLM (solo las que matchearon)

import db from '@/lib/db'
import { CHECK_FIRST_CONFIG } from '../constants'
import { domainRateLimiter } from '../anti-ban'
import { registrarCambio } from '../histogram/tracker'
import { evaluarFrecuencia } from '../frequency/adapter'
import type { JobPayload, RunnerResult } from '../types'
import { extraerTextoDeHtml, extraerMencionesDeTexto, crearMencionesExtraidas } from '@/lib/ai/extractor-menciones'
import { zaiFetch } from '../fetch/zai-fetcher'
import { extraerLinksDeNoticias, extraerLeadDeBloque, type NotaLink } from '../link-extractor'
import { trijarNotas, type TriajeResult } from '../keyword-triaje'
import { checkAndBackupDB } from '@/lib/auto-recovery'
import { getHtml, clearHtml } from '../html-cache'

// ─── Configuración ───────────────────────────────────────────

const MAX_LINKS = 40          // Máximo de links a extraer de la homepage
const MAX_NOTAS_A_CLASIFICAR = 15 // Límite de notas a clasificar con LLM por fuente
const MAX_NOTAS_A_DESCARGAR = 20  // Límite de notas a descargar por fuente
const DELAY_ENTRE_NOTAS = 2000    // 2s entre descargas para no saturar

// ─── Runner principal ────────────────────────────────────────

export async function run(payload: JobPayload): Promise<RunnerResult> {
  const fuenteId = payload.fuenteId as string
  const medioId = payload.medioId as string
  const urls = payload.urls as string[] | undefined
  // FIX MEMORIA: Leer HTML desde cache compartido en lugar del payload del job
  const homepageHtmlFromCheck = getHtml(fuenteId) ?? undefined

  if (!fuenteId || !medioId) {
    return { success: false, error: 'scrape_fuente requiere fuenteId y medioId' }
  }

  const startTime = Date.now()

  try {
    // 0. Obtener datos de la fuente
    const fuente = await db.fuenteEstado.findUnique({
      where: { id: fuenteId },
      include: { Medio: true },
    })

    if (!fuente) {
      return { success: false, error: `FuenteEstado ${fuenteId} no encontrada` }
    }

    // ─── CASO A: URLs específicas (viene de RSS con links de notas) ───
    if (urls && urls.length > 0) {
      console.log(`[scrape-fuente] Modo RSS: ${urls.length} URLs directas para ${fuente.Medio.nombre}`)
      return await procesarUrlsDirectas(urls, medioId, fuenteId, fuente.Medio.nivel)
    }

    // ─── CASO B: Pipeline completo 3 fases (homepage) ───
    console.log(`[scrape-fuente] Pipeline 3 fases para ${fuente.Medio.nombre}`)

    // FASE 1: Obtener HTML de la homepage
    // Optimización: reutilizar HTML que check-first (Z.ai) ya descargó
    let html = ''
    if (homepageHtmlFromCheck && homepageHtmlFromCheck.length > 500) {
      html = homepageHtmlFromCheck
      console.log(`[scrape-fuente] HTML reutilizado de html-cache (${(html.length / 1024).toFixed(0)} KB) — sin descarga extra`)
      // FIX MEMORIA: Liberar cache después de consumirlo
      clearHtml(fuenteId)
    } else {
      html = await descargarHomepage(fuente.url)
      console.log(`[scrape-fuente] HTML descargado de nuevo (${html ? (html.length / 1024).toFixed(0) : 0} KB)`)
    }
    if (!html) {
      return { success: false, error: `No se pudo obtener homepage de ${fuente.url}` }
    }

    // FASE 1: Extraer links de notas
    const notas = extraerLinksDeNoticias(html, fuente.url, MAX_LINKS)
    console.log(`[scrape-fuente] FASE 1: ${notas.length} links de notas extraídos de ${fuente.Medio.nombre}`)

    // Update capacity: headline extraction succeeded
    await db.fuenteEstado.update({
      where: { id: fuenteId },
      data: {
        ultimoHeadline: new Date(),
        totalHeadlines: { increment: notas.length },
        strategyScrape: 'link-extraction',
      },
    }).catch(() => {})

    if (notas.length === 0) {
      // Fallback: si no se pudieron extraer links, procesar la homepage como antes
      console.log(`[scrape-fuente] No se extrajeron links, fallback a procesamiento de homepage`)
      return await procesarFallbackHomepage(html, medioId, fuenteId, fuente.Medio.nivel, fuente.url)
    }

    // Enriquecer con leads del HTML de la homepage
    for (const nota of notas) {
      nota.lead = extraerLeadDeBloque(html, nota.url)
    }

    // FASE 2: Triaje por keywords (SIN IA, SIN descargas extra)
    const seleccionadas = await trijarNotas(notas)
    console.log(`[scrape-fuente] FASE 2: ${seleccionadas.length} de ${notas.length} notas pasaron el triaje para ${fuente.Medio.nombre}`)

    if (seleccionadas.length === 0) {
      // Sin notas relevantes — registrar y salir sin gastar LLM
      await db.capturaLog.create({
        data: {
          medioId,
          nivel: fuente.Medio.nivel,
          exitosa: true,
          totalArticulos: notas.length,
          mencionesEncontradas: 0,
          errores: `Triaje: 0 de ${notas.length} notas relevantes`,
        },
      })

      await registrarCambio(fuenteId).catch(() => {})
      await evaluarFrecuencia(fuenteId, true).catch(() => {})

      return {
        success: true,
        data: {
          fuenteId,
          medioId,
          medioNombre: fuente.Medio.nombre,
          fase1_links: notas.length,
          fase2_seleccionadas: 0,
          fase3_clasificadas: 0,
          totalMencionesCreadas: 0,
          responseTime: Date.now() - startTime,
        },
      }
    }

    // FASE 3: Clasificar notas relevantes con LLM (secuencial, una por una)
    const aClasificar = seleccionadas.slice(0, MAX_NOTAS_A_CLASIFICAR)
    console.log(`[scrape-fuente] FASE 3: clasificando ${aClasificar.length} notas con LLM...`)

    let totalMencionesCreadas = 0
    const resultados: {
      url: string
      titulo: string
      puntaje: number
      razon: string
      descargada: boolean
      menciones: number
    }[] = []

    for (let i = 0; i < aClasificar.length; i++) {
      const nota = aClasificar[i]
      const maxDescargar = Math.min(aClasificar.length, MAX_NOTAS_A_DESCARGAR)

      if (i >= maxDescargar) break

      // Delay entre descargas para conexiones lentas
      if (i > 0) {
        await sleep(DELAY_ENTRE_NOTAS)
      }

      console.log(`[scrape-fuente] Nota ${i + 1}/${aClasificar.length}: "${nota.titulo.substring(0, 50)}..." (${nota.puntaje}pts, ${nota.razon})`)

      // Descargar texto completo de la nota individual
      const notaHtml = await descargarNota(nota.url)

      if (!notaHtml) {
        resultados.push({
          url: nota.url,
          titulo: nota.titulo,
          puntaje: nota.puntaje,
          razon: nota.razon,
          descargada: false,
          menciones: 0,
        })
        continue
      }

      // Extraer texto limpio del artículo
      let texto = extraerTextoDeHtml(notaHtml)

      // FIX: Prepend título + lead al texto para dar contexto al LLM
      // Muchos sitios bolivianos cargan contenido vía JS; el texto extraído
      // puede ser solo navegación/ads. Título + lead del homepage son confiables.
      const textoCompleto = [
        nota.titulo ? `TÍTULO: ${nota.titulo}` : '',
        nota.lead ? `RESUMEN: ${nota.lead}` : '',
        texto,
      ].filter(Boolean).join('\n\n')

      if (textoCompleto.length < 100) {
        resultados.push({
          url: nota.url,
          titulo: nota.titulo,
          puntaje: nota.puntaje,
          razon: nota.razon,
          descargada: true,
          menciones: 0,
        })
        continue
      }

      console.log(`[scrape-fuente] Texto al LLM: ${textoCompleto.length} chars (título: ${nota.titulo ? 'sí' : 'no'}, lead: ${nota.lead ? 'sí' : 'no'})`)

      // Clasificar con LLM (1 llamada por nota)
      try {
        const resultado = await extraerMencionesDeTexto(textoCompleto, medioId)
        const menciones = await crearMencionesExtraidas(resultado, medioId, nota.url, nota.titulo)

        totalMencionesCreadas += menciones
        resultados.push({
          url: nota.url,
          titulo: nota.titulo,
          puntaje: nota.puntaje,
          razon: nota.razon,
          descargada: true,
          menciones,
        })

        // Update capacity: mentions created from this source
        await db.fuenteEstado.update({
          where: { id: fuenteId },
          data: {
            ultimoMencion: new Date(),
            totalMenciones: { increment: menciones },
            totalTexto: { increment: 1 },
          },
        }).catch(() => {})

        console.log(`[scrape-fuente] → ${menciones} menciones (${resultado.es_relevante ? 'RELEVANTE' : 'no relevante'}, ${resultado.tratamientoPeriodistico})`)
      } catch (err) {
        console.warn(`[scrape-fuente] Error clasificando nota ${nota.url}:`, err)
        resultados.push({
          url: nota.url,
          titulo: nota.titulo,
          puntaje: nota.puntaje,
          razon: nota.razon,
          descargada: true,
          menciones: 0,
        })
      }
    }

    const responseTime = Date.now() - startTime

    // Actualizar histograma y frecuencia
    await registrarCambio(fuenteId).catch(() => {})
    await evaluarFrecuencia(fuenteId, true).catch(() => {})

    // Registrar captura log
    await db.capturaLog.create({
      data: {
        medioId,
        nivel: fuente.Medio.nivel,
        exitosa: true,
        totalArticulos: notas.length,
        mencionesEncontradas: totalMencionesCreadas,
      },
    })

    console.log(`[scrape-fuente] Completado ${fuente.Medio.nombre}: ${notas.length} notas → ${seleccionadas.length} seleccionadas → ${totalMencionesCreadas} menciones [${responseTime}ms]`)

    // Ejecutar descubrimiento inteligente si hay menciones huérfanas (best-effort, no bloquea)
    if (totalMencionesCreadas > 0) {
      try {
        const { ejecutarDescubrimiento } = await import('@/lib/ai/discovery');
        const discovery = await ejecutarDescubrimiento();
        if (discovery.sugerenciasCreadas > 0) {
          console.log(`[scrape-fuente] Descubrimiento: ${discovery.sugerenciasCreadas} sugerencias nuevas`);
        }
      } catch (err) {
        console.warn('[scrape-fuente] Descubrimiento falló (no bloqueante):', err instanceof Error ? err.message : err);
      }
    }

    // Backup periódico de DB (cada 100 ciclos o 6h)
    const backup = checkAndBackupDB()
    if (backup.backed) {
      console.log(`[scrape-fuente] Backup ejecutado: ${backup.path}`)
    }

    return {
      success: true,
      data: {
        fuenteId,
        medioId,
        medioNombre: fuente.Medio.nombre,
        fase1_links: notas.length,
        fase2_seleccionadas: seleccionadas.length,
        fase3_clasificadas: aClasificar.length,
        totalMencionesCreadas,
        resultados,
        responseTime,
      },
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    return { success: false, error: `scrape_fuente fallo: ${msg}` }
  }
}

// ─── Funciones auxiliares ────────────────────────────────────

/**
 * Descargar homepage de una fuente (fetch directo → fallback Z.ai)
 */
async function descargarHomepage(url: string): Promise<string> {
  // Intento 1: fetch directo
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), CHECK_FIRST_CONFIG.timeoutMs)

    await domainRateLimiter.waitIfNecessary(url)

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-BO,es;q=0.9,en;q=0.8',
      },
      signal: controller.signal,
    })
    // recordRequest ya se llama dentro de waitIfNecessary — no duplicar
    clearTimeout(timeoutId)

    if (response.ok) {
      const html = await response.text()
      if (html.length > 500) return html
    }
  } catch (e) {
    console.warn(`[scrape-fuente] fetch directo homepage falló: ${e instanceof Error ? e.message : e}`)
  }

  // Intento 2: Z.ai page_reader
  console.log(`[scrape-fuente] Intentando Z.ai para homepage ${url}...`)
  const zaiResult = await zaiFetch(url)
  if (zaiResult && zaiResult.html.length > 500) {
    return zaiResult.html
  }

  return ''
}

/**
 * Descargar una nota individual (fetch directo → fallback Z.ai)
 */
async function descargarNota(url: string): Promise<string> {
  // Intento 1: fetch directo
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000) // 15s para notas

    await domainRateLimiter.waitIfNecessary(url)

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-BO,es;q=0.9,en;q=0.8',
      },
      signal: controller.signal,
    })
    // recordRequest ya se llama dentro de waitIfNecessary — no duplicar
    clearTimeout(timeoutId)

    if (response.ok) {
      const html = await response.text()
      if (html.length > 200) return html
    }
  } catch {
    // fetch falló, intentar Z.ai
  }

  // Intento 2: Z.ai page_reader
  const zaiResult = await zaiFetch(url)
  if (zaiResult && zaiResult.html.length > 200) {
    return zaiResult.html
  }

  return ''
}

/**
 * Procesar URLs directas (modo RSS: vienen con links específicos)
 */
async function procesarUrlsDirectas(
  urls: string[],
  medioId: string,
  fuenteId: string,
  nivel: string,
): Promise<RunnerResult> {
  const startTime = Date.now()
  let totalMenciones = 0

  for (let i = 0; i < urls.length; i++) {
    if (i > 0) await sleep(DELAY_ENTRE_NOTAS)

    const html = await descargarNota(urls[i])
    if (!html) continue

    const texto = extraerTextoDeHtml(html)
    if (texto.length < 100) continue

    try {
      const resultado = await extraerMencionesDeTexto(texto, medioId)
      totalMenciones += await crearMencionesExtraidas(resultado, medioId, urls[i], '')
    } catch (err) {
      console.warn(`[scrape-fuente] Error en URL directa ${urls[i]}:`, err)
    }
  }

  await registrarCambio(fuenteId).catch(() => {})
  await evaluarFrecuencia(fuenteId, true).catch(() => {})

  await db.capturaLog.create({
    data: { medioId, nivel, exitosa: true, totalArticulos: urls.length, mencionesEncontradas: totalMenciones },
  })

  // Backup periódico de DB (cada 100 ciclos o 6h)
  const backup = checkAndBackupDB()
  if (backup.backed) {
    console.log(`[scrape-fuente] Backup ejecutado: ${backup.path}`)
  }

  return {
    success: true,
    data: { urlsProcesadas: urls.length, totalMencionesCreadas: totalMenciones, responseTime: Date.now() - startTime },
  }
}

/**
 * Fallback: procesar homepage completa (comportamiento anterior)
 */
async function procesarFallbackHomepage(
  html: string,
  medioId: string,
  fuenteId: string,
  nivel: string,
  url: string,
): Promise<RunnerResult> {
  const startTime = Date.now()
  const texto = extraerTextoDeHtml(html)
  let menciones = 0

  if (texto.length > 100) {
    try {
      const resultado = await extraerMencionesDeTexto(texto, medioId)
      menciones = await crearMencionesExtraidas(resultado, medioId, url, '')
    } catch (err) {
      console.warn(`[scrape-fuente] Fallback error:`, err)
    }
  }

  await registrarCambio(fuenteId).catch(() => {})
  await evaluarFrecuencia(fuenteId, true).catch(() => {})

  await db.capturaLog.create({
    data: { medioId, nivel, exitosa: true, totalArticulos: 1, mencionesEncontradas: menciones },
  })

  // Backup periódico de DB (cada 100 ciclos o 6h)
  const backup = checkAndBackupDB()
  if (backup.backed) {
    console.log(`[scrape-fuente] Backup ejecutado: ${backup.path}`)
  }

  return {
    success: true,
    data: { modo: 'fallback_homepage', totalMencionesCreadas: menciones, responseTime: Date.now() - startTime },
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

const handler = run

export default { handler }
