// scrape-homepage.ts — DECODEX Bolivia
// Scraper directo de homepages de medios bolivianos (CERO Bing, CERO APIs externas)
//
// Flujo:
// 1. fetch(medio.url) con UA rotativo y TLS fallback
// 2. Regex para extraer todos los links de notas del HTML
// 3. Triaje local por keywords (asambleistas + ejes temáticos)
// 4. Descarga del texto completo de cada nota seleccionada
// 5. Extracción con LLM (extraerMencionesDeTexto)
//
// Reutiliza la misma lógica probada de Pipeline B (scrape-fuente.ts)
// pero en formato invocable desde /api/capture sin pasar por la job queue.

import db from '@/lib/db'
import { safeFetch } from '@/lib/jobs/check-first/safe-fetch'
import { getRandomUserAgent } from '@/lib/jobs/anti-ban/user-agents'
import { extraerLinksDeNoticias, extraerLeadDeBloque, type NotaLink } from '@/lib/jobs/link-extractor'
import { trijarNotas, type TriajeResult } from '@/lib/jobs/keyword-triaje'
import { extraerTextoDeHtml, extraerMencionesDeTexto, crearMencionesExtraidas } from '@/lib/ai/extractor-menciones'

// ─── Interfaces ────────────────────────────────────────────────

export interface ScrapeMedioResult {
  medioNombre: string
  medioId: string
  exito: boolean
  error?: string
  httpStatus?: number
  htmlSizeKb?: number
  fase1_links: number
  fase2_seleccionadas: number
  fase3_clasificadas: number
  mencionesCreadas: number
  detalles: string[]
}

export interface ScrapeSessionResult {
  mediosProcesados: number
  mencionesNuevas: number
  clasificadas: number
  errores: number
  resultados: ScrapeMedioResult[]
  detalles: string[]
}

// ─── Configuración ─────────────────────────────────────────────

const FETCH_TIMEOUT_MS = 20_000      // 20s para homepage
const NOTA_TIMEOUT_MS = 15_000        // 15s para nota individual
const MAX_LINKS = 40                  // Max links a extraer de homepage
const MAX_NOTAS_CLASIFICAR = 10       // Max notas a clasificar con LLM por medio (API route es más limitado)
const DELAY_ENTRE_NOTAS = 2000        // 2s entre descargas
const MIN_HTML_SIZE = 500             // Mínimo HTML para considerar válido

// ─── Función principal: Scraper de homepage ────────────────────

/**
 * Descarga y parsea la homepage de un medio.
 * Retorna el HTML limpio o lanza error con detalles HTTP reales.
 */
export async function fetchHomepage(url: string): Promise<{ html: string; httpStatus: number }> {
  let httpStatus = 0

  // Intento 1: fetch directo con UA rotativo
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

    const response = await safeFetch(url, {
      headers: {
        'User-Agent': getRandomUserAgent(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-BO,es;q=0.9,en;q=0.8',
        'Cache-Control': 'no-cache',
      },
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    httpStatus = response.status

    if (response.ok) {
      const html = await response.text()

      // Detectar CAPTCHA / Cloudflare / bloques
      if (esCaptcha(html)) {
        throw new Error(`CAPTCHA/Bloque detectado en ${url} (HTTP ${response.status}, ${(html.length / 1024).toFixed(0)}KB). El sitio requiere verificación humana.`)
      }

      if (html.length < MIN_HTML_SIZE) {
        throw new Error(`HTML vacío o insignificante de ${url} (HTTP ${response.status}, ${html.length} bytes)`)
      }

      return { html, httpStatus }
    }

    // Status no-OK: loggear el error real
    throw new Error(`HTTP ${response.status} ${response.statusText} al acceder a ${url}`)
  } catch (err) {
    if (err instanceof Error && err.message.includes('CAPTCHA')) throw err
    if (err instanceof Error && err.message.includes('HTTP ')) throw err

    // Error de red / timeout / TLS
    const msg = err instanceof Error ? err.message : String(err)
    httpStatus = 0
    throw new Error(`Error de conexión a ${url}: ${msg}`)
  }
}

/**
 * Descarga el HTML de una nota individual.
 */
async function fetchNota(url: string): Promise<{ html: string; httpStatus: number } | null> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), NOTA_TIMEOUT_MS)

    const response = await safeFetch(url, {
      headers: {
        'User-Agent': getRandomUserAgent(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-BO,es;q=0.9,en;q=0.8',
      },
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    if (response.ok) {
      const html = await response.text()
      if (html.length > 200) {
        return { html, httpStatus: response.status }
      }
    }

    // Loggear error HTTP real, NO silencioso
    console.warn(`[scrape-homepage] Nota falló: HTTP ${response.status} para ${url}`)
    return null
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn(`[scrape-homepage] Nota error de conexión: ${msg} para ${url}`)
    return null
  }
}

// ─── Procesamiento completo de un medio ────────────────────────

/**
 * Scraper completo de un medio: homepage → links → triaje → LLM → menciones
 *
 * @param medioUrl - URL del medio (ej. https://eju.tv)
 * @param medioId - ID del medio en la DB
 * @param medioNombre - Nombre del medio (para logs)
 */
export async function scrapeMedio(
  medioUrl: string,
  medioId: string,
  medioNombre: string,
): Promise<ScrapeMedioResult> {
  const detalles: string[] = []
  let fase1_links = 0
  let fase2_seleccionadas = 0
  let fase3_clasificadas = 0
  let mencionesCreadas = 0
  let httpStatus = 0
  let htmlSizeKb = 0

  // ─── FASE 1: Descargar homepage ───
  let html = ''
  try {
    const result = await fetchHomepage(medioUrl)
    html = result.html
    httpStatus = result.httpStatus
    htmlSizeKb = Math.round(html.length / 1024)
    detalles.push(`Homepage descargada: ${htmlSizeKb}KB (HTTP ${httpStatus})`)
    console.log(`[scrape-homepage] ${medioNombre}: homepage ${htmlSizeKb}KB (HTTP ${httpStatus})`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    detalles.push(`ERROR HOMEPAGE: ${msg}`)
    console.error(`[scrape-homepage] ${medioNombre}: ${msg}`)
    return {
      medioNombre,
      medioId,
      exito: false,
      error: msg,
      httpStatus,
      fase1_links: 0,
      fase2_seleccionadas: 0,
      fase3_clasificadas: 0,
      mencionesCreadas: 0,
      detalles,
    }
  }

  // ─── FASE 2: Extraer links de notas ───
  const notas: NotaLink[] = extraerLinksDeNoticias(html, medioUrl, MAX_LINKS)
  fase1_links = notas.length
  console.log(`[scrape-homepage] ${medioNombre}: ${notas.length} links de notas extraídos`)
  detalles.push(`Links extraídos: ${notas.length}`)

  if (notas.length === 0) {
    // Fallback: procesar homepage completa como texto
    console.log(`[scrape-homepage] ${medioNombre}: sin links, procesando homepage como texto`)
    detalles.push('Sin links, procesando homepage completa')
    const texto = extraerTextoDeHtml(html)

    if (texto.length < 100) {
      detalles.push('Homepage sin texto extraíble')
      return {
        medioNombre, medioId, exito: true, httpStatus, htmlSizeKb,
        fase1_links: 0, fase2_seleccionadas: 0, fase3_clasificadas: 0,
        mencionesCreadas: 0, detalles,
      }
    }

    try {
      const resultado = await extraerMencionesDeTexto(texto, medioId)
      mencionesCreadas = await crearMencionesExtraidas(resultado, medioId, medioUrl, '')
      fase3_clasificadas = 1
      detalles.push(`Homepage procesada: ${mencionesCreadas} menciones`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      detalles.push(`ERROR LLM homepage: ${msg}`)
      console.error(`[scrape-homepage] ${medioNombre}: LLM error en homepage: ${msg}`)
    }

    return {
      medioNombre, medioId, exito: true, httpStatus, htmlSizeKb,
      fase1_links: 0, fase2_seleccionadas: 0, fase3_clasificadas: fase3_clasificadas,
      mencionesCreadas, detalles,
    }
  }

  // Enriquecer con leads del HTML de la homepage
  for (const nota of notas) {
    nota.lead = extraerLeadDeBloque(html, nota.url)
  }

  // ─── FASE 3: Triaje por keywords (SIN IA, SIN descargas extra) ───
  let seleccionadas: TriajeResult[]
  try {
    seleccionadas = await trijarNotas(notas)
    fase2_seleccionadas = seleccionadas.length
    detalles.push(`Triaje: ${seleccionadas.length} de ${notas.length} notas seleccionadas`)
    console.log(`[scrape-homepage] ${medioNombre}: ${seleccionadas.length} de ${notas.length} notas pasaron triaje`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    detalles.push(`ERROR TRIAJE: ${msg}`)
    console.error(`[scrape-homepage] ${medioNombre}: triaje error: ${msg}`)
    return {
      medioNombre, medioId, exito: true, httpStatus, htmlSizeKb,
      fase1_links: notas.length, fase2_seleccionadas: 0, fase3_clasificadas: 0,
      mencionesCreadas: 0, detalles,
    }
  }

  if (seleccionadas.length === 0) {
    detalles.push('Sin notas relevantes después del triaje')
    return {
      medioNombre, medioId, exito: true, httpStatus, htmlSizeKb,
      fase1_links: notas.length, fase2_seleccionadas: 0, fase3_clasificadas: 0,
      mencionesCreadas: 0, detalles,
    }
  }

  // ─── FASE 4: Clasificar notas seleccionadas con LLM ───
  const aClasificar = seleccionadas.slice(0, MAX_NOTAS_CLASIFICAR)
  fase3_clasificadas = aClasificar.length

  for (let i = 0; i < aClasificar.length; i++) {
    const nota = aClasificar[i]
    const tituloCorto = nota.titulo.substring(0, 50)

    // Delay entre descargas
    if (i > 0) await sleep(DELAY_ENTRE_NOTAS)

    console.log(`[scrape-homepage] ${medioNombre} nota ${i + 1}/${aClasificar.length}: "${tituloCorto}..." (${nota.puntaje}pts)`)

    // Descargar texto completo
    const notaResult = await fetchNota(nota.url)
    if (!notaResult) {
      detalles.push(`Nota ${i + 1}: falló descarga (${nota.url.substring(0, 60)}...)`)
      continue
    }

    const texto = extraerTextoDeHtml(notaResult.html)
    if (texto.length < 100) {
      detalles.push(`Nota ${i + 1}: texto insuficiente (${texto.length} chars)`)
      continue
    }

    // Clasificar con LLM
    try {
      const resultado = await extraerMencionesDeTexto(texto, medioId)
      const creadas = await crearMencionesExtraidas(resultado, medioId, nota.url, nota.titulo)
      mencionesCreadas += creadas
      detalles.push(`Nota ${i + 1}: "${tituloCorto}..." → ${creadas} menciones (${resultado.es_relevante ? 'RELEVANTE' : 'no relevante'})`)
      console.log(`[scrape-homepage] → ${creadas} menciones (${resultado.es_relevante ? 'RELEVANTE' : 'no relevante'})`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      detalles.push(`Nota ${i + 1}: ERROR LLM: ${msg}`)
      console.error(`[scrape-homepage] ${medioNombre}: LLM error en nota: ${msg}`)
    }
  }

  detalles.push(`Total: ${mencionesCreadas} menciones creadas`)
  console.log(`[scrape-homepage] ${medioNombre} completado: ${notas.length} links → ${seleccionadas.length} seleccionadas → ${mencionesCreadas} menciones`)

  // Registrar captura log
  try {
    await db.capturaLog.create({
      data: {
        medioId,
        exitosa: true,
        totalArticulos: notas.length,
        mencionesEncontradas: mencionesCreadas,
        errores: detalles.filter(d => d.includes('ERROR')).join('; ') || undefined,
      },
    })
  } catch {
    // No bloquear si el log falla
  }

  return {
    medioNombre,
    medioId,
    exito: true,
    httpStatus,
    htmlSizeKb,
    fase1_links,
    fase2_seleccionadas,
    fase3_clasificadas,
    mencionesCreadas,
    detalles,
  }
}

// ─── Helpers ───────────────────────────────────────────────────

/**
 * Detecta si el HTML contiene un CAPTCHA o bloque (Cloudflare, reCAPTCHA, etc.)
 */
function esCaptcha(html: string): boolean {
  const captchaPatterns = [
    /captcha/i,
    /cloudflare/i,
    /challenge-platform/i,
    /cf-browser-verification/i,
    /just-a-moment/i,
    /checking-your-browser/i,
    /verify-you-are-human/i,
    /robot-check/i,
    /access-denied/i,
    /forbidden.*bot/i,
    /si.*un.*humano/i,   // es: "si eres un humano"
    /verificación.*seguridad/i,
  ]
  // Solo checkear los primeros 10KB (los headers del HTML)
  const head = html.substring(0, 10_000).toLowerCase()
  return captchaPatterns.some(p => p.test(head))
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
