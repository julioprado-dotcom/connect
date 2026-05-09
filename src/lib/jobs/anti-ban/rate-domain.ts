/**
 * Limitador de tasa por dominio
 *
 * Este módulo implementa un limitador de velocidad que controla la
 * frecuencia de solicitudes a cada dominio, añadiendo jitter aleatorio
 * para simular comportamiento humano y evitar detección.
 */

/** Estadísticas de solicitud para un dominio individual */
interface DomainStats {
  /** Marca de tiempo de la última solicitud realizada */
  lastRequest: Date | null
  /** Contador total de solicitudes realizadas al dominio */
  requestCount: number
  /** Marca de tiempo de la primera solicitud (para limpieza) */
  firstRequest: number | null
}

/** Intervalo mínimo predeterminado entre solicitudes al mismo dominio (15 segundos) */
const DEFAULT_MIN_INTERVAL_MS = 15_000

/** Duración máxima para mantener estadísticas de un dominio sin actividad (1 hora) */
const MAX_STATS_AGE_MS = 60 * 60 * 1000

/** Intervalo de limpieza automática (10 minutos) */
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000

/**
 * Limitador de tasa por dominio.
 *
 * Garantiza un intervalo mínimo entre solicitudes consecutivas al mismo
 * dominio, con jitter aleatorio para parecer tráfico orgánico.
 * Limpia automáticamente entradas inactivas cada 10 minutos.
 */
export class DomainRateLimiter {
  /** Mapa de estadísticas por dominio */
  private stats: Map<string, DomainStats> = new Map()

  /** Identificador del temporizador de limpieza periódica */
  private cleanupTimer: ReturnType<typeof setInterval> | null = null

  constructor() {
    // Iniciar limpieza periódica cada 10 minutos
    this.cleanupTimer = setInterval(() => {
      this.pruneStale()
    }, CLEANUP_INTERVAL_MS)

    // Asegurar que el temporizador no impida la salida del proceso
    if (this.cleanupTimer?.unref) {
      this.cleanupTimer.unref()
    }
  }

  /**
   * Espera si es necesario antes de realizar una solicitud a un dominio.
   *
   * Calcula el tiempo restante desde la última solicitud y, si es menor
   * que el intervalo mínimo, duerme la diferencia más un jitter aleatorio
   * (hasta el 30% del intervalo mínimo).
   *
   * @param domain - Dominio al que se desea solicitar
   * @param minIntervalMs - Intervalo mínimo en milisegundos (por defecto 15000)
   */
  async waitIfNecessary(domain: string, minIntervalMs: number = DEFAULT_MIN_INTERVAL_MS): Promise<void> {
    const domainStats = this.getOrCreateStats(domain)

    if (domainStats.lastRequest === null) {
      // Primera solicitud a este dominio, no hay espera
      return
    }

    const elapsed = Date.now() - domainStats.lastRequest.getTime()

    if (elapsed < minIntervalMs) {
      // Calcular el tiempo restante más jitter (hasta 30% del intervalo)
      const remaining = minIntervalMs - elapsed
      const jitterMax = Math.floor(minIntervalMs * 0.3)
      const jitter = jitterMax > 0 ? crypto.getRandomValues(new Uint32Array(1))[0] % jitterMax : 0
      const totalDelay = remaining + jitter

      // Esperar el tiempo calculado
      await new Promise<void>((resolve) => {
        setTimeout(resolve, totalDelay)
      })
    }

    // Registrar la solicitud después de la espera
    this.recordRequest(domain)
  }

  /**
   * Registra que se realizó una solicitud a un dominio específico.
   *
   * @param domain - Dominio al que se realizó la solicitud
   */
  recordRequest(domain: string): void {
    const domainStats = this.getOrCreateStats(domain)
    domainStats.lastRequest = new Date()
    domainStats.requestCount += 1
  }

  /**
   * Obtiene las estadísticas actuales de todos los dominios rastreados.
   *
   * @returns Registro de dominios con su última solicitud y contador
   */
  getStats(): Record<string, { lastRequest: Date | null; requestCount: number }> {
    const result: Record<string, { lastRequest: Date | null; requestCount: number }> = {}

    for (const [domain, domainStats] of this.stats) {
      result[domain] = {
        lastRequest: domainStats.lastRequest,
        requestCount: domainStats.requestCount,
      }
    }

    return result
  }

  /**
   * Elimina las estadísticas de dominios que no han recibido solicitudes
   * en más de 1 hora, liberando memoria.
   */
  pruneStale(): void {
    const now = Date.now()

    for (const [domain, domainStats] of this.stats) {
      // Usar firstRequest como referencia: si no ha habido actividad en 1 hora, eliminar
      const lastActivity = domainStats.lastRequest?.getTime() ?? domainStats.firstRequest ?? 0

      if (now - lastActivity > MAX_STATS_AGE_MS) {
        this.stats.delete(domain)
      }
    }
  }

  /**
   * Obtiene o crea las estadísticas para un dominio.
   * @private
   */
  private getOrCreateStats(domain: string): DomainStats {
    let domainStats = this.stats.get(domain)

    if (!domainStats) {
      domainStats = {
        lastRequest: null,
        requestCount: 0,
        firstRequest: Date.now(),
      }
      this.stats.set(domain, domainStats)
    }

    return domainStats
  }

  /**
   * Detiene el temporizador de limpieza. Debe llamarse al cerrar la aplicación.
   */
  destroy(): void {
    if (this.cleanupTimer !== null) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }
  }
}

/** Instancia única (singleton) del limitador de tasa por dominio */
export const domainRateLimiter = new DomainRateLimiter()
