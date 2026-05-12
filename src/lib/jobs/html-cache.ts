// HTML Cache — Memoria compartida para pasar homepageHtml entre
// check_fuente → scrape_fuente SIN almacenarlo en el payload del job.
// Esto evita que megabytes de HTML se serialicen en la tabla Job.
//
// Estrategia: Map con TTL de 5 min y max 10 entradas.
// El HTML se escribe DESPUÉS del check y se lee durante el scrape.
// Si expira, scrape-fuente hace fetch directo (comportamiento original).
//
// DECODEX Bolivia / ONION200 v0.15.0

interface CacheEntry {
  html: string
  ts: number
}

const htmlCache = new Map<string, CacheEntry>()
const CACHE_TTL_MS = 5 * 60 * 1000   // 5 minutos
const CACHE_MAX_SIZE = 10              // máximo 10 entradas

/**
 * Guarda HTML de homepage en cache para una fuente dada.
 * Se invoca desde check-fuente.ts después de detectar cambio.
 */
export function setHtml(key: string, html: string): void {
  // Evitar strings vacíos o triviales
  if (!html || html.length < 500) return

  // Evitar duplicar la misma entrada si el contenido no cambió
  const existing = htmlCache.get(key)
  if (existing && existing.html === html) {
    existing.ts = Date.now() // renovar TTL
    return
  }

  // Eviction: eliminar la entrada más vieja si se alcanzó el máximo
  if (htmlCache.size >= CACHE_MAX_SIZE) {
    let oldestKey = ''
    let oldestTs = Infinity
    for (const [k, v] of htmlCache) {
      if (v.ts < oldestTs) {
        oldestTs = v.ts
        oldestKey = k
      }
    }
    if (oldestKey) {
      htmlCache.delete(oldestKey)
      console.log(`[html-cache] Evicted entry for ${oldestKey} (age: ${Math.round((Date.now() - oldestTs) / 1000)}s)`)
    }
  }

  const sizeKB = Math.round(html.length / 1024)
  htmlCache.set(key, { html, ts: Date.now() })
  console.log(`[html-cache] Cached ${sizeKB} KB for ${key} (TTL: ${CACHE_TTL_MS / 1000}s, entries: ${htmlCache.size}/${CACHE_MAX_SIZE})`)
}

/**
 * Recupera HTML de homepage del cache para una fuente dada.
 * Se invoca desde scrape-fuente.ts al inicio del pipeline.
 * Retorna null si no existe o expiró.
 */
export function getHtml(key: string): string | null {
  const entry = htmlCache.get(key)
  if (!entry) return null

  const age = Date.now() - entry.ts
  if (age > CACHE_TTL_MS) {
    htmlCache.delete(key)
    console.log(`[html-cache] Expired entry for ${key} (age: ${Math.round(age / 1000)}s)`)
    return null
  }

  console.log(`[html-cache] Hit for ${key} (${Math.round(entry.html.length / 1024)} KB, age: ${Math.round(age / 1000)}s)`)
  return entry.html
}

/**
 * Elimina la entrada del cache (llamado después de que scrape-fuente la consume).
 * No es obligatorio — el TTL se encarga — pero libera memoria más rápido.
 */
export function clearHtml(key: string): void {
  htmlCache.delete(key)
}

/**
 * Retorna estadísticas del cache para monitoreo.
 */
export function getHtmlCacheStats(): { size: number; maxSize: number; totalKB: number } {
  let totalKB = 0
  for (const entry of htmlCache.values()) {
    totalKB += Math.round(entry.html.length / 1024)
  }
  return {
    size: htmlCache.size,
    maxSize: CACHE_MAX_SIZE,
    totalKB,
  }
}
