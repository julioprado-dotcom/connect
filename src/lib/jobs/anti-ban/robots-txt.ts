/**
 * Verificador de robots.txt con almacenamiento en caché
 *
 * Este módulo implementa un verificador de robots.txt que respeta las
 * directivas de los sitios web, con caché en memoria para evitar
 * solicitudes repetidas al mismo dominio.
 */

/** Entrada de caché para un dominio */
interface CacheEntry {
  /** Reglas Disallow y Allow parseadas del robots.txt */
  rules: RobotsRule[]
  /** Retraso de rastreo especificado por el sitio (en segundos), o null si no se define */
  crawlDelay: number | null
  /** Marca de tiempo de cuando se almacenó en caché */
  cachedAt: number
}

/** Regla individual de un robots.txt */
interface RobotsRule {
  /** Tipo de regla: 'Disallow' o 'Allow' */
  type: 'Disallow' | 'Allow'
  /** Patrón de la regla (puede contener * y $) */
  pattern: string
}

/** Duración de la caché en milisegundos (24 horas) */
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000

/** Tiempo de espera máximo para la solicitud HTTP (5 segundos) */
const FETCH_TIMEOUT_MS = 5000

/**
 * Verificador de robots.txt.
 *
 * Analiza y almacena en caché los archivos robots.txt de cada dominio.
 * En caso de error (red o análisis), permite el acceso (fail-open)
 * para no bloquear el sistema por fallos transitorios.
 */
export class RobotsChecker {
  /** Caché en memoria por dominio */
  private cache: Map<string, CacheEntry> = new Map()

  /**
   * Verifica si una ruta específica está permitida para un dominio dado.
   *
   * @param domain - Dominio a verificar (ej. 'ejemplo.com')
   * @param path - Ruta a verificar (ej. '/admin/panel')
   * @returns Objeto con `allowed` (si está permitido) y opcionalmente la `rule` que lo bloqueó
   */
  async check(
    domain: string,
    path: string
  ): Promise<{ allowed: boolean; rule?: string }> {
    const rules = await this.getRules(domain)

    // Si no hay reglas, el acceso está permitido
    if (rules.length === 0) {
      return { allowed: true }
    }

    // Buscar la regla más específica que coincida con la ruta.
    // Las reglas 'Allow' tienen prioridad sobre 'Disallow' cuando coinciden
    // al mismo nivel de especificidad.
    let matchDisallow: RobotsRule | null = null
    let matchAllow: RobotsRule | null = null
    let matchDisallowLength = -1
    let matchAllowLength = -1

    for (const rule of rules) {
      if (this.matchRule(rule.pattern, path)) {
        // Medir especificidad por la longitud del patrón (más largo = más específico)
        if (rule.type === 'Allow' && rule.pattern.length > matchAllowLength) {
          matchAllow = rule
          matchAllowLength = rule.pattern.length
        } else if (rule.type === 'Disallow' && rule.pattern.length > matchDisallowLength) {
          matchDisallow = rule
          matchDisallowLength = rule.pattern.length
        }
      }
    }

    // La regla más específica tiene prioridad
    if (matchAllow && matchAllowLength >= matchDisallowLength) {
      return { allowed: true }
    }

    if (matchDisallow) {
      return { allowed: false, rule: `${matchDisallow.type}: ${matchDisallow.pattern}` }
    }

    // Sin coincidencias: acceso permitido
    return { allowed: true }
  }

  /**
   * Verifica si un dominio tiene configurado un retraso de rastreo.
   *
   * @param domain - Dominio a verificar
   * @returns El retraso en segundos, o null si no está configurado
   */
  async isCrawlDelaySet(domain: string): Promise<number | null> {
    const entry = await this.fetchAndCache(domain)
    return entry?.crawlDelay ?? null
  }

  /**
   * Obtiene las reglas para un dominio, usando caché si está disponible.
   * @private
   */
  private async getRules(domain: string): Promise<RobotsRule[]> {
    // Verificar si hay entrada en caché válida
    const cached = this.cache.get(domain)
    if (cached && Date.now() - cached.cachedAt < CACHE_DURATION_MS) {
      return cached.rules
    }

    // Obtener y almacenar en caché
    const entry = await this.fetchAndCache(domain)
    return entry?.rules ?? []
  }

  /**
   * Obtiene y almacena en caché el robots.txt de un dominio.
   * En caso de cualquier error, devuelve null (fail-open).
   * @private
   */
  private async fetchAndCache(domain: string): Promise<CacheEntry | null> {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

      const response = await fetch(`https://${domain}/robots.txt`, {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (compatible; DECODEX-Bot/1.0; +https://decodex.bo/bot)',
        },
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        // Si no hay robots.txt (404), almacenar reglas vacías
        const emptyEntry: CacheEntry = { rules: [], crawlDelay: null, cachedAt: Date.now() }
        this.cache.set(domain, emptyEntry)
        return emptyEntry
      }

      const body = await response.text()
      const { rules, crawlDelay } = this.parseRobotsTxt(body)

      const entry: CacheEntry = { rules, crawlDelay, cachedAt: Date.now() }
      this.cache.set(domain, entry)

      return entry
    } catch {
      // Falla abierta: en caso de error de red o análisis, no bloqueamos
      return null
    }
  }

  /**
   * Analiza el contenido de un robots.txt y extrae las reglas Disallow/Allow
   * y la directiva Crawl-delay.
   *
   * Maneja comodines (* = cualquier secuencia) y fin de ruta ($).
   *
   * @param body - Contenido textual del robots.txt
   * @returns Reglas parseadas y retraso de rastreo
   * @private
   */
  private parseRobotsTxt(body: string): { rules: RobotsRule[]; crawlDelay: number | null } {
    const rules: RobotsRule[] = []
    let crawlDelay: number | null = null
    let inUserAgent = false

    const lines = body.split('\n')

    for (const rawLine of lines) {
      // Ignorar comentarios y líneas vacías
      const line = rawLine.split('#')[0].trim()
      if (!line) continue

      // Detectar sección User-agent (solo nos interesa '*' o nuestro bot)
      if (line.toLowerCase().startsWith('user-agent:')) {
        const agent = line.slice(11).trim().toLowerCase()
        // Aplicar reglas para todos los agentes o específicamente para DECODEX-Bot
        inUserAgent = agent === '*' || agent.includes('decodex')
        continue
      }

      // Ignorar líneas fuera de una sección User-agent relevante
      if (!inUserAgent) continue

      const lowerLine = line.toLowerCase()

      if (lowerLine.startsWith('disallow:')) {
        const pattern = line.slice(9).trim()
        if (pattern) {
          rules.push({ type: 'Disallow', pattern })
        }
      } else if (lowerLine.startsWith('allow:')) {
        const pattern = line.slice(6).trim()
        if (pattern) {
          rules.push({ type: 'Allow', pattern })
        }
      } else if (lowerLine.startsWith('crawl-delay:')) {
        const value = parseFloat(line.slice(12).trim())
        if (!isNaN(value) && value >= 0) {
          crawlDelay = value
        }
      }

      // Si encontramos otro User-agent, cerrar la sección actual
      // (esto ya se maneja arriba, pero por seguridad)
    }

    return { rules, crawlDelay }
  }

  /**
   * Verifica si una ruta coincide con un patrón de robots.txt.
   * Soporta comodines: * (cualquier secuencia) y $ (fin de ruta).
   *
   * @param pattern - Patrón del robots.txt (ej. '/admin/*')
   * @param path - Ruta real (ej. '/admin/panel')
   * @returns true si el patrón coincide con la ruta
   * @private
   */
  private matchRule(pattern: string, path: string): boolean {
    // Escapar caracteres especiales de regex, excepto * y $
    const regexStr = pattern
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      // Reemplazar comodín * por .*
      .replace(/\*/g, '.*')
      // Si el patrón termina en $, anclar al final de la ruta
    const anchored = regexStr.endsWith('\\$')
      ? regexStr.slice(0, -2) + '$'
      : regexStr

    try {
      const regex = new RegExp(`^${anchored}`)
      return regex.test(path)
    } catch {
      // Si el regex es inválido, no coincide
      return false
    }
  }

  /**
   * Limpia las entradas de caché que han expirado.
   * Útil para liberar memoria en ejecuciones prolongadas.
   */
  clearExpiredCache(): void {
    const now = Date.now()
    for (const [domain, entry] of this.cache) {
      if (now - entry.cachedAt >= CACHE_DURATION_MS) {
        this.cache.delete(domain)
      }
    }
  }
}

/** Instancia única (singleton) del verificador de robots.txt */
export const robotsChecker = new RobotsChecker()
