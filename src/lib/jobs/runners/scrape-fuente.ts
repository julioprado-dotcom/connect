// Runner: scrape_fuente - Scraping completo de una fuente de medios
// DECODEX Bolivia
// Se ejecuta DESPUES de que check-first detecta un cambio

import db from '@/lib/db'
import { CHECK_FIRST_CONFIG } from '../constants'
import { getRandomUserAgent, domainRateLimiter } from '../anti-ban'
import { registrarCambio } from '../histogram/tracker'
import { evaluarFrecuencia } from '../frequency/adapter'
import type { JobPayload, RunnerResult } from '../types'
import { extraerTextoDeHtml, extraerMencionesDeTexto, crearMencionesExtraidas, type ExtractionResult } from '@/lib/ai/extractor-menciones'

export async function run(payload: JobPayload): Promise<RunnerResult> {
  const fuenteId = payload.fuenteId as string
  const medioId = payload.medioId as string
  const urls = payload.urls as string[] | undefined

  if (!fuenteId || !medioId) {
    return { success: false, error: 'scrape_fuente requiere fuenteId y medioId' }
  }

  const startTime = Date.now()
  let totalMencionesCreadas = 0

  try {
    // 1. Obtener datos de la fuente
    const fuente = await db.fuenteEstado.findUnique({
      where: { id: fuenteId },
      include: { medio: true },
    })

    if (!fuente) {
      return { success: false, error: `FuenteEstado ${fuenteId} no encontrada` }
    }

    // 2. Descargar contenido de las URLs a scrape
    const urlsToScrape = urls && urls.length > 0
      ? urls
      : [fuente.url]

    const resultados: { url: string; status: number; titulo: string; menciones: number }[] = []

    for (const url of urlsToScrape) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), CHECK_FIRST_CONFIG.timeoutMs)

        // Rate limiting por dominio anti-ban
        await domainRateLimiter.waitIfNecessary(url)

        const response = await fetch(url, {
          headers: {
            'User-Agent': getRandomUserAgent(),
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'es-BO,es;q=0.9,en;q=0.8',
            'Accept-Encoding': 'gzip, deflate',
          },
          signal: controller.signal,
        })
        domainRateLimiter.recordRequest(url)
        clearTimeout(timeoutId)

        if (!response.ok) {
          resultados.push({ url, status: response.status, titulo: '', menciones: 0 })
          continue
        }

        const html = await response.text()

        // 3. Extraer titulo y texto del contenido
        const tituloMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
        const titulo = tituloMatch ? tituloMatch[1].trim() : ''
        const texto = extraerTextoDeHtml(html)

        // 4. Extraer menciones con LLM si hay suficiente texto
        let mencionesEncontradas = 0
        if (texto.length > 100) {
          try {
            const resultado: ExtractionResult = await extraerMencionesDeTexto(texto, medioId)
            mencionesEncontradas = await crearMencionesExtraidas(resultado, medioId, url, titulo)
          } catch (err) {
            console.warn(`[scrape-fuente] Error extrayendo menciones de ${url}:`, err)
          }
        }

        totalMencionesCreadas += mencionesEncontradas

        // Registrar captura log
        await db.capturaLog.create({
          data: {
            medioId,
            nivel: fuente.medio.nivel,
            exitosa: true,
            totalArticulos: 1,
            mencionesEncontradas,
          },
        })

        resultados.push({ url, status: response.status, titulo, menciones: mencionesEncontradas })
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        resultados.push({ url, status: 0, titulo: '', menciones: 0 })

        // Registrar captura fallida
        await db.capturaLog.create({
          data: {
            medioId,
            nivel: fuente.medio.nivel,
            exitosa: false,
            errores: msg,
          },
        })
      }
    }

    const responseTime = Date.now() - startTime

    // 5. Actualizar histograma (registrar hora de cambio)
    await registrarCambio(fuenteId).catch(err => {
      console.warn(`[Runner:scrape] Error actualizando histograma:`, err)
    })

    // 6. Evaluar frecuencia (restaurar si estaba degradada)
    await evaluarFrecuencia(fuenteId, true).catch(err => {
      console.warn(`[Runner:scrape] Error evaluando frecuencia:`, err)
    })

    return {
      success: true,
      data: {
        fuenteId,
        medioId,
        medioNombre: fuente.medio.nombre,
        urlsProcesadas: resultados.length,
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

const handler = run

export default { handler }
