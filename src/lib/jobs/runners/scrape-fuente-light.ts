// Runner: scrape_fuente_light — Pipeline desacoplado (FASE 1 del sistema E)
// DECODEX Bolivia v0.16.0
//
// Scrapea, triaje keywords, descarga texto → persiste en NotaRaw (SIN LLM).
// El batch LLM runner procesa las notas después.
//
// Backward compatible: NO modifica scrape-fuente.ts (usado por captura manual).

import db from '@/lib/db'
import { domainRateLimiter } from '../anti-ban'
import { registrarCambio } from '../histogram/tracker'
import { evaluarFrecuencia } from '../frequency/adapter'
import type { JobPayload, RunnerResult } from '../types'
import { extraerTextoDeHtml } from '@/lib/ai/extractor-menciones'
import { fetchPage } from '../fetch/fetcher'
import { extraerLinksDeNoticias, type NotaLink } from '../link-extractor'
import { trijarNotas, type TriajeResult } from '../keyword-triaje'
import { getHtml, clearHtml } from '../html-cache'

// ─── Configuración ───────────────────────────────────────────

const MAX_LINKS = 40
const MAX_NOTAS_A_DESCARGAR = 20
const DELAY_ENTRE_NOTAS = 2000

// ─── Helpers ────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function descargarHomepage(url: string): Promise<string> {
  try {
    return await fetchPage(url, { timeoutMs: 15000 })
  } catch {
    return ''
  }
}

async function descargarNota(url: string): Promise<string> {
  try {
    const html = await fetchPage(url, { timeoutMs: 15000 })
    return html || ''
  } catch {
    return ''
  }
}

// ─── Runner principal ────────────────────────────────────────

export async function run(payload: JobPayload): Promise<RunnerResult> {
  const fuenteId = payload.fuenteId as string
  const medioId = payload.medioId as string
  const urls = payload.urls as string[] | undefined
  const homepageHtmlFromCheck = getHtml(fuenteId) ?? undefined

  if (!fuenteId || !medioId) {
    return { success: false, error: 'scrape_fuente_light requiere fuenteId y medioId' }
  }

  const startTime = Date.now()

  try {
    const fuente = await db.fuenteEstado.findUnique({
      where: { id: fuenteId },
      include: { Medio: true },
    })

    if (!fuente) {
      return { success: false, error: `FuenteEstado ${fuenteId} no encontrada` }
    }

    // ─── CASO A: URLs específicas (RSS) ───
    if (urls && urls.length > 0) {
      console.log(`[scrape-light] Modo RSS: ${urls.length} URLs para ${fuente.Medio.nombre}`)
      return await procesarUrlsDirectas(urls, medioId, fuenteId, fuente.Medio.nivel)
    }

    // ─── CASO B: Pipeline homepage ───
    console.log(`[scrape-light] Pipeline light para ${fuente.Medio.nombre}`)

    // FASE 1: HTML de homepage
    let html = ''
    if (homepageHtmlFromCheck && homepageHtmlFromCheck.length > 500) {
      html = homepageHtmlFromCheck
      console.log(`[scrape-light] HTML reutilizado (${(html.length / 1024).toFixed(0)} KB)`)
      clearHtml(fuenteId)
    } else {
      html = await descargarHomepage(fuente.url)
      console.log(`[scrape-light] HTML descargado (${html ? (html.length / 1024).toFixed(0) : 0} KB)`)
    }

    if (!html) {
      await db.capturaLog.create({
        data: {
          id: `clog_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
          medioId,
          nivel: fuente.Medio.nivel,
          exitosa: false,
          totalArticulos: 0,
          mencionesEncontradas: 0,
          errores: `No se pudo obtener homepage de ${fuente.url}`,
        },
      }).catch(() => {})
      return { success: false, error: `No se pudo obtener homepage de ${fuente.url}` }
    }

    // FASE 1: Extraer links
    const notas = extraerLinksDeNoticias(html, fuente.url, MAX_LINKS)
    console.log(`[scrape-light] FASE 1: ${notas.length} links extraídos de ${fuente.Medio.nombre}`)

    if (notas.length === 0) {
      await db.capturaLog.create({
        data: {
          id: `clog_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
          medioId,
          nivel: fuente.Medio.nivel,
          exitosa: true,
          totalArticulos: 0,
          mencionesEncontradas: 0,
          errores: '0 links extraídos de homepage',
        },
      }).catch(() => {})
      return { success: true, data: { notas: 0, guardadas: 0 } }
    }

    // FASE 2: Triaje por keywords
    const seleccionadas = await trijarNotas(notas)
    console.log(`[scrape-light] FASE 2: ${seleccionadas.length}/${notas.length} pasaron triaje`)

    if (seleccionadas.length === 0) {
      await db.capturaLog.create({
        data: {
          id: `clog_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
          medioId,
          nivel: fuente.Medio.nivel,
          exitosa: true,
          totalArticulos: notas.length,
          mencionesEncontradas: 0,
          errores: `Triaje: 0 de ${notas.length}`,
        },
      }).catch(() => {})
      await registrarCambio(fuenteId).catch(() => {})
      await evaluarFrecuencia(fuenteId, true).catch(() => {})
      return { success: true, data: { notas: notas.length, guardadas: 0 } }
    }

    // FASE 3 LIGHT: Descargar texto → guardar en NotaRaw (SIN LLM)
    const maxDescargar = Math.min(seleccionadas.length, MAX_NOTAS_A_DESCARGAR)
    let guardadas = 0
    let duplicadas = 0

    for (let i = 0; i < maxDescargar; i++) {
      const nota = seleccionadas[i]

      if (i > 0) {
        await sleep(DELAY_ENTRE_NOTAS)
      }

      console.log(`[scrape-light] Nota ${i + 1}/${maxDescargar}: "${nota.titulo.substring(0, 50)}..." (${nota.puntaje}pts)`)

      // Descargar texto
      const notaHtml = await descargarNota(nota.url)
      if (!notaHtml) continue

      const texto = extraerTextoDeHtml(notaHtml)
      const textoCompleto = [
        nota.titulo ? `TÍTULO: ${nota.titulo}` : '',
        nota.lead ? `RESUMEN: ${nota.lead}` : '',
        texto,
      ].filter(Boolean).join('\n\n')

      if (textoCompleto.length < 100) continue

      // Persistir en NotaRaw (upsert por unique [medioId, url])
      try {
        const existing = await db.notaRaw.findUnique({
          where: { medioId_url: { medioId, url: nota.url } },
        })

        if (existing) {
          duplicadas++
          continue
        }

        await db.notaRaw.create({
          data: {
            medioId,
            fuenteId,
            url: nota.url,
            titulo: nota.titulo || '',
            lead: nota.lead || '',
            texto: textoCompleto,
            puntajeTriaje: nota.puntaje,
            razonTriaje: nota.razon || '',
          },
        })
        guardadas++
      } catch (err: unknown) {
        // Unique constraint violation = nota ya existe
        const msg = err instanceof Error ? err.message : String(err)
        if (msg.includes('Unique')) {
          duplicadas++
        } else {
          console.error(`[scrape-light] Error guardando nota: ${msg}`)
        }
      }
    }

    // Actualizar histograma y frecuencia
    await registrarCambio(fuenteId).catch(() => {})
    await evaluarFrecuencia(fuenteId, guardadas > 0).catch(() => {})

    // Registrar captura log
    await db.capturaLog.create({
      data: {
        id: `clog_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        medioId,
        nivel: fuente.Medio.nivel,
        exitosa: true,
        totalArticulos: notas.length,
        mencionesEncontradas: 0, // Se actualiza cuando batch LLM procese
        errores: `${guardadas} notas guardadas en NotaRaw, ${duplicadas} duplicadas`,
      },
    })

    console.log(`[scrape-light] ${fuente.Medio.nombre}: ${notas.length} links → ${seleccionadas.length} triaje → ${guardadas} guardadas, ${duplicadas} duplicadas [${Date.now() - startTime}ms]`)

    return {
      success: true,
      data: { notas: notas.length, seleccionadas: seleccionadas.length, guardadas, duplicadas, responseTime: Date.now() - startTime },
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error(`[scrape-light] Error: ${msg}`)

    try {
      await db.capturaLog.create({
        data: {
          id: `clog_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
          medioId,
          nivel: '0',
          exitosa: false,
          totalArticulos: 0,
          mencionesEncontradas: 0,
          errores: msg.substring(0, 500),
        },
      }).catch(() => {})
    } catch { /* ignore */ }

    return { success: false, error: msg }
  }
}

// ─── Procesar URLs directas (modo RSS) ────────────────────────

async function procesarUrlsDirectas(
  urls: string[],
  medioId: string,
  fuenteId: string,
  nivel: string,
): Promise<RunnerResult> {
  const startTime = Date.now()
  let guardadas = 0
  let duplicadas = 0

  for (const url of urls) {
    try {
      const html = await fetchPage(url, { timeoutMs: 15000 })
      if (!html) continue

      const texto = extraerTextoDeHtml(html)
      if (texto.length < 100) continue

      const existing = await db.notaRaw.findUnique({
        where: { medioId_url: { medioId, url } },
      })

      if (existing) {
        duplicadas++
        continue
      }

      // Intentar extraer título del HTML
      const tituloMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
      const titulo = tituloMatch ? tituloMatch[1].trim() : url

      await db.notaRaw.create({
        data: {
          medioId,
          fuenteId,
          url,
          titulo,
          texto,
          puntajeTriaje: 5, // RSS = ya pre-filtrado
          razonTriaje: 'rss_direct',
        },
      })
      guardadas++
    } catch {
      // continue
    }
  }

  await db.capturaLog.create({
    data: {
      id: `clog_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      medioId,
      nivel,
      exitosa: true,
      totalArticulos: urls.length,
      mencionesEncontradas: 0,
      errores: `RSS: ${guardadas} guardadas, ${duplicadas} duplicadas`,
    },
  }).catch(() => {})

  return {
    success: true,
    data: { notas: urls.length, guardadas, duplicadas, responseTime: Date.now() - startTime },
  }
}
