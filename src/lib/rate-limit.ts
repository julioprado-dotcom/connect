/**
 * Rate limiter simple en memoria por IP
 * Para producción, considerar Redis o una solución distribuida
 */
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export interface RateLimitConfig {
  /** Máximo de requests en la ventana */
  maxRequests: number;
  /** Ventana de tiempo en milisegundos */
  windowMs: number;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  maxRequests: 30,
  windowMs: 60_000, // 1 minuto
};

/**
 * Verifica si una IP ha excedido el rate limit.
 * Retorna true si la petición debe ser bloqueada.
 */
export function isRateLimited(
  ip: string,
  config: Partial<RateLimitConfig> = {}
): { limited: boolean; remaining: number; resetIn: number } {
  const { maxRequests, windowMs } = { ...DEFAULT_CONFIG, ...config };
  const now = Date.now();

  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetTime) {
    // Crear nueva ventana
    rateLimitMap.set(ip, {
      count: 1,
      resetTime: now + windowMs,
    });
    return { limited: false, remaining: maxRequests - 1, resetIn: Math.ceil(windowMs / 1000) };
  }

  if (entry.count >= maxRequests) {
    const resetIn = Math.ceil((entry.resetTime - now) / 1000);
    return { limited: true, remaining: 0, resetIn };
  }

  entry.count++;
  return { limited: false, remaining: maxRequests - entry.count, resetIn: Math.ceil((entry.resetTime - now) / 1000) };
}

/**
 * Extrae la IP real del request (considera proxies)
 */
export function getClientIp(request: Request): string {
  // En Vercel/standalone, x-forwarded-for viene del proxy
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  return 'unknown';
}

// Limpiar entradas expiradas cada 5 minutos
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap.entries()) {
    if (now > entry.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}, 300_000);
