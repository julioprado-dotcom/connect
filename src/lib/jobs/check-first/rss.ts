// Parser y checker de feeds RSS/Atom - DECODEX Bolivia
// Detecta entries nuevas comparando IDs contra cache

import { CHECK_FIRST_CONFIG } from '../constants'
import { getRandomUserAgent } from '../anti-ban'
import { safeFetch } from './safe-fetch'
import type { CheckResult } from '../types'

interface RSSEntry {
  id: string
  title: string
  link: string
  pubDate?: string
  summary?: string
}

// Extraer IDs de un feed RSS/Atom
function parseRSSFeed(xml: string): RSSEntry[] {
  const entries: RSSEntry[] = []

  // Parser sencillo de RSS 2.0: <item> blocks
  // No usamos DOMParser porque esto corre server-side en Node.js
  const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi
  const atomRegex = /<entry[^>]*>([\s\S]*?)<\/entry>/gi

  const extractText = (tag: string, block: string): string => {
    const match = block.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`, 'i'))
      || block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'))
    return match ? match[1].trim() : ''
  }

  // Intentar RSS 2.0 primero
  let match: RegExpExecArray | null
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1]
    const link = extractText('link', block)
    const guid = extractText('guid', block)
    const title = extractText('title', block)
    const pubDate = extractText('pubDate', block)
    const summary = extractText('description', block)

    // El ID es el guid si existe, sino el link
    const id = guid || link
    if (!id) continue

    entries.push({ id, title, link, pubDate, summary })
  }

  // Si no se encontraron items RSS, intentar Atom
  if (entries.length === 0) {
    while ((match = atomRegex.exec(xml)) !== null) {
      const block = match[1]
      const link = extractText('link', block)
      const title = extractText('title', block)
      const published = extractText('published', block) || extractText('updated', block)
      const summary = extractText('summary', block) || extractText('content', block)

      // En Atom, el ID viene del elemento <id>
      const atomId = extractText('id', block)
      if (!atomId) continue

      entries.push({ id: atomId, title, link, pubDate: published, summary })
    }
  }

  return entries.slice(0, CHECK_FIRST_CONFIG.rssMaxEntries)
}

// Obtener los IDs del ultimo chequeo guardados en FuenteEstado
function getUltimosIds(ultimosIdsStr: string): string[] {
  try {
    const parsed = JSON.parse(ultimosIdsStr)
    if (Array.isArray(parsed)) return parsed
  } catch {
    // Corrupto, resetear
  }
  return []
}

// Comparar entries actuales contra los IDs cacheados
function findNewEntries(entries: RSSEntry[], ultimosIds: string[]): RSSEntry[] {
  const idSet = new Set(ultimosIds)
  return entries.filter(e => !idSet.has(e.id))
}

// Descargar y parsear un feed RSS
export async function checkRSS(
  url: string,
  ultimosIdsStr: string,
  cachedETag?: string,
): Promise<CheckResult & { entries: RSSEntry[]; ultimosIdsActualizados: string[] }> {
  const startTime = Date.now()

  try {
    // Construir headers condicionales con UA rotativo anti-ban
    const headers: Record<string, string> = {
      'User-Agent': getRandomUserAgent(),
      'Accept': 'application/rss+xml, application/xml, text/xml, application/atom+xml, */*;q=0.9',
      'Accept-Language': 'es-BO,es;q=0.9,en;q=0.8',
    }
    if (cachedETag) {
      headers['If-None-Match'] = cachedETag
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), CHECK_FIRST_CONFIG.timeoutMs)

    const response = await safeFetch(url, {
      headers,
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    const responseTime = Date.now() - startTime

    // 304 Not Modified - sin cambios
    if (response.status === 304) {
      return {
        cambiado: false,
        tecnica: 'rss',
        detalle: `304 Not Modified (ETag cacheado) [${responseTime}ms]`,
        entries: [],
        ultimosIdsActualizados: getUltimosIds(ultimosIdsStr),
        responseTime,
      }
    }

    if (!response.ok) {
      return {
        cambiado: false,
        tecnica: 'rss',
        detalle: `HTTP ${response.status}: ${response.statusText} [${responseTime}ms]`,
        entries: [],
        ultimosIdsActualizados: getUltimosIds(ultimosIdsStr),
        responseTime,
        error: `HTTP ${response.status}`,
      }
    }

    const xml = await response.text()
    const entries = parseRSSFeed(xml)

    if (entries.length === 0) {
      // Diagnosticar por qué el feed está vacío
      const itemMatches = (xml.match(/<item/gi) || []).length
      const entryMatches = (xml.match(/<entry/gi) || []).length
      console.warn(
        `[checkRSS] Feed vacio para ${url}: xml length=${xml.length}, <item> count=${itemMatches}, <entry> count=${entryMatches}, first 200 chars: ${xml.substring(0, 200)}`,
      )
      return {
        cambiado: false,
        tecnica: 'rss',
        detalle: `Feed vacio o no parseable (xml=${xml.length}b, items=${itemMatches}, entries=${entryMatches}) [${responseTime}ms]`,
        entries: [],
        ultimosIdsActualizados: getUltimosIds(ultimosIdsStr),
        responseTime,
      }
    }

    // Comparar contra IDs cacheados
    const ultimosIds = getUltimosIds(ultimosIdsStr)
    const newEntries = findNewEntries(entries, ultimosIds)

    // Actualizar IDs cacheados (siempre guardar los ultimos N)
    const nuevosIds = entries.slice(0, 20).map(e => e.id)
    const idsActualizados = [...nuevosIds]

    if (newEntries.length > 0) {
      return {
        cambiado: true,
        tecnica: 'rss',
        detalle: `${newEntries.length} entries nuevos de ${entries.length} totales [${responseTime}ms]`,
        datosNuevos: newEntries.map(e => ({ id: e.id, title: e.title, link: e.link })),
        entries,
        ultimosIdsActualizados: idsActualizados,
        responseTime,
      }
    }

    return {
      cambiado: false,
      tecnica: 'rss',
      detalle: `${entries.length} entries, ninguno nuevo [${responseTime}ms]`,
      entries,
      ultimosIdsActualizados: idsActualizados,
      responseTime,
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    return {
      cambiado: false,
      tecnica: 'rss',
      detalle: `Error: ${msg}`,
      entries: [],
      ultimosIdsActualizados: getUltimosIds(ultimosIdsStr),
      responseTime: Date.now() - startTime,
      error: msg,
    }
  }
}
