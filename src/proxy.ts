import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

/**
 * Proxy de seguridad — convención Next.js 16 (reemplaza middleware.ts).
 *
 * Protege TODAS las rutas API destructivas con validación REAL de JWT.
 * Usa `jose` (Edge-compatible) para verificar firma JWT contra AUTH_SECRET.
 * NO invoca auth() — no necesita DB. Compatible con Edge Runtime.
 * NO agrega headers de seguridad (preserva iframe proxy Z.ai).
 *
 * Estrategia de autenticación:
 * - Bearer token → verificación JWT contra AUTH_SECRET
 * - Cookie de sesión NextAuth → verificación JWT del token de sesión
 * - Fallback presencial → solo si AUTH_SECRET no está configurado (dev)
 */

// ── Endpoints públicos específicos por método ──────────────────
const PUBLIC_ENDPOINTS: Array<{ path: string; methods: string[] }> = [
  { path: '/api/auth/',                     methods: ['GET', 'POST'] },
  { path: '/api/suscriptores',              methods: ['GET', 'POST'] },
  { path: '/api/search',                    methods: ['GET', 'POST'] },
  { path: '/api/medios/health',             methods: ['GET'] },
  { path: '/api/stats',                     methods: ['GET'] },
  { path: '/api/indicadores/historico',     methods: ['GET'] },
  { path: '/api/indicadores',               methods: ['GET'] },
  { path: '/api/medios',                    methods: ['GET'] },
  { path: '/api/personas',                  methods: ['GET'] },
  { path: '/api/reportes/stats',            methods: ['GET'] },
  { path: '/api/reportes/generator-data',   methods: ['GET'] },
  { path: '/api/ejes',                      methods: ['GET'] },
  { path: '/api/menciones',                 methods: ['GET'] },
  { path: '/api/entregas',                  methods: ['GET'] },
  { path: '/api/jobs/stats',                methods: ['GET'] },
  { path: '/api/dashboard/pipeline',         methods: ['GET'] },
  { path: '/api/productos',                  methods: ['GET', 'POST'] },
  { path: '/api/jobs/fuentes',              methods: ['GET'] },
  { path: '/api/scraping/phase',            methods: ['GET', 'POST'] },
  { path: '/api/jobs/scheduler',            methods: ['POST'] },
  { path: '/api/jobs',                      methods: ['GET', 'POST'] },
  { path: '/api/marco-conceptual',          methods: ['GET'] },
  { path: '/api/backup',                    methods: ['GET', 'POST', 'PATCH'] },
];

// ── Rutas que SIEMPRE requieren auth (todos los métodos) ──────
const ALWAYS_PROTECTED: string[] = [
  '/api/admin/',
  '/api/seed',
  '/api/auth/setup',
];

// ── Rutas GET que exponen PII y requieren auth ─────────────────
const PII_PROTECTED_GET: string[] = [
  '/api/clientes',
  '/api/contratos',
];

const DESTRUCTIVE_METHODS = ['POST', 'PUT', 'DELETE', 'PATCH'];

// ── API Key auth (FIX P0: Auth para endpoints de escritura) ─────
const WRITE_METHODS = ['POST', 'PUT', 'DELETE', 'PATCH'];
const API_KEY_PROTECTED_WRITE_ROUTES = [
  '/api/admin',
  '/api/jobs/worker',
  '/api/jobs/scheduler',
  '/api/jobs/maintenance',
  '/api/capture',
  '/api/backup',
];
const API_KEY_PROTECTED_PATCH_ROUTES = [
  '/api/marco-conceptual',
];
const API_KEY_PROTECTED_POST_ROUTES = [
  '/api/personas',
  '/api/medios',
  '/api/clientes',
  '/api/ejes-cliente',
  '/api/suscriptores',
  '/api/boletines',
];

function isApiKeyProtectedRoute(pathname: string, method: string): boolean {
  for (const route of API_KEY_PROTECTED_WRITE_ROUTES) {
    if (pathname.startsWith(route) && WRITE_METHODS.includes(method)) return true;
  }
  if (method === 'PATCH') {
    for (const route of API_KEY_PROTECTED_PATCH_ROUTES) {
      if (pathname.startsWith(route)) return true;
    }
  }
  if (method === 'POST') {
    for (const route of API_KEY_PROTECTED_POST_ROUTES) {
      if (pathname.startsWith(route)) return true;
    }
  }
  return false;
}

function checkApiKey(request: NextRequest): NextResponse | null {
  if (!isApiKeyProtectedRoute(request.nextUrl.pathname, request.method)) {
    return null; // not a protected route, skip
  }
  const validKey = process.env.ADMIN_API_KEY;
  if (!validKey && process.env.NODE_ENV === 'development') {
    console.warn(`[AUTH SKIP - DEV] ${request.method} ${request.nextUrl.pathname}`);
    return null; // allow in dev without key
  }
  const apiKey = request.headers.get('x-api-key');
  if (!apiKey || apiKey !== validKey) {
    return NextResponse.json(
      { error: 'No autorizado', code: 'UNAUTHORIZED' },
      { status: 401 }
    );
  }
  return null; // valid
}

// ── Rate limit store (Edge-compatible, per-instance) ───────────
const rateStore = new Map<string, { count: number; resetAt: number }>();

/**
 * Rate-limited endpoints config.
 * Each entry: { pathPrefix, methods to rate-limit, max requests, window in seconds }
 */
const RATE_LIMITED_ENDPOINTS: Array<{
  path: string;
  methods: string[];
  max: number;
  windowSec: number;
}> = [
  { path: '/api/capture',            methods: ['POST'], max: 3,  windowSec: 60 },
  { path: '/api/verify-links',       methods: ['POST'], max: 5,  windowSec: 60 },
  { path: '/api/admin/purge',        methods: ['POST'], max: 2,  windowSec: 60 },
  { path: '/api/jobs/worker',        methods: ['POST'], max: 5,  windowSec: 60 },
  { path: '/api/jobs/scheduler',     methods: ['POST'], max: 3,  windowSec: 60 },
  { path: '/api/indicadores/sync',   methods: ['POST'], max: 3,  windowSec: 60 },
  { path: '/api/indicadores/capture',methods: ['POST'], max: 5,  windowSec: 60 },
  { path: '/api/jobs',               methods: ['POST'], max: 10, windowSec: 60 },
  { path: '/api/medios',             methods: ['POST'], max: 20, windowSec: 60 },
  { path: '/api/personas',           methods: ['POST'], max: 20, windowSec: 60 },
  { path: '/api/menciones',          methods: ['POST'], max: 20, windowSec: 60 },
];

/**
 * Check rate limit for a given key. Returns true if limited.
 */
function checkRateLimit(key: string, max: number, windowSec: number): boolean {
  const now = Date.now();
  const entry = rateStore.get(key);
  if (!entry || now > entry.resetAt) {
    rateStore.set(key, { count: 1, resetAt: now + windowSec * 1000 });
    return false; // not limited
  }
  if (entry.count >= max) return true; // limited
  entry.count++;
  return false;
}

/**
 * Find a matching rate limit rule for the given pathname + method.
 */
function findRateLimitRule(pathname: string, method: string) {
  return RATE_LIMITED_ENDPOINTS.find(
    (r) => pathname.startsWith(r.path) && r.methods.includes(method)
  );
}

// ── AUTH_SECRET ────────────────────────────────────────────────
// Edge Runtime: leer env var en cada invocación (sin cache estático)
// porque el módulo puede cargar antes de que las env vars estén disponibles.
function getSecret(): Uint8Array | null {
  const env = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!env) return null;
  return new TextEncoder().encode(env);
}

// ── Helpers ──────────────────────────────────────────────────────

function isPublicEndpoint(pathname: string, method: string): boolean {
  return PUBLIC_ENDPOINTS.some(
    (e) => pathname.startsWith(e.path) && e.methods.includes(method)
  );
}

function isAlwaysProtected(pathname: string): boolean {
  return ALWAYS_PROTECTED.some((r) => pathname.startsWith(r));
}

/**
 * Extrae el token JWT de un header Authorization Bearer.
 */
function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
  return parts[1];
}

/**
 * Extrae el token JWT de las cookies de sesión NextAuth / Auth.js v5.
 */
function extractSessionToken(cookies: { get: (name: string) => { value: string } | undefined }): string | null {
  // NextAuth v4 cookie names
  const v4 = cookies.get('next-auth.session-token');
  if (v4?.value) return v4.value;

  // NextAuth v5 / Auth.js cookie names
  const v5 = cookies.get('authjs.session-token');
  if (v5?.value) return v5.value;

  // Secure variants (HTTPS)
  const secureV5 = cookies.get('__Secure-authjs.session-token');
  if (secureV5?.value) return secureV5.value;

  const secureV4 = cookies.get('__Secure-next-auth.session-token');
  if (secureV4?.value) return secureV4.value;

  return null;
}

/**
 * Extract client IP from request headers.
 */
function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp;
  return 'unknown';
}

/**
 * Verificación REAL de JWT usando jose + AUTH_SECRET.
 * Edge-compatible, no requiere acceso a DB.
 * Retorna true solo si el token tiene firma válida.
 */
async function verifyJwt(token: string): Promise<boolean> {
  const secret = getSecret();
  if (!secret) {
    // Sin AUTH_SECRET configurado, fallar cerrado (no permitir bypass)
    return false;
  }

  try {
    await jwtVerify(token, secret, { algorithms: ['HS256'] });
    return true;
  } catch {
    return false;
  }
}

/**
 * Verificación de autenticación con JWT real.
 * Extrae token de Bearer header o cookies de sesión,
 * luego verifica su firma contra AUTH_SECRET.
 */
async function isAuthenticated(request: NextRequest): Promise<boolean> {
  // 1. Intentar Bearer token
  const bearerToken = extractBearerToken(request.headers.get('authorization'));
  if (bearerToken) {
    return verifyJwt(bearerToken);
  }

  // 2. Intentar cookie de sesión
  const sessionToken = extractSessionToken(request.cookies);
  if (sessionToken) {
    return verifyJwt(sessionToken);
  }

  return false;
}

// ── Proxy principal (convención Next.js 16) ────────────────────

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method.toUpperCase();

  // Solo interceptar rutas API
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // ── Rate limit check (before auth, to protect against brute force) ──
  const rateRule = findRateLimitRule(pathname, method);
  if (rateRule) {
    const ip = getClientIp(request);
    const rateKey = `rl:${ip}:${rateRule.path}:${method}`;
    const resetInSec = rateRule.windowSec;
    if (checkRateLimit(rateKey, rateRule.max, resetInSec)) {
      return NextResponse.json(
        {
          error: 'Demasiadas peticiones. Intenta de nuevo más tarde.',
          retryAfter: resetInSec,
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(resetInSec),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(resetInSec),
          },
        }
      );
    }
  }

  // ── API Key check (P0: escritura administrativa) ──
  const apiKeyBlocked = checkApiKey(request);
  if (apiKeyBlocked) return apiKeyBlocked;

  // Rutas de administración siempre protegidas (todos los métodos)
  if (isAlwaysProtected(pathname)) {
    const authed = await isAuthenticated(request);
    if (!authed) {
      return NextResponse.json(
        { error: 'Autenticación requerida para esta operación' },
        { status: 401 }
      );
    }
    return NextResponse.next();
  }

  // Rutas GET que exponen PII — requieren auth incluso para lectura
  if (method === 'GET' && PII_PROTECTED_GET.some((r) => pathname.startsWith(r))) {
    const authed = await isAuthenticated(request);
    if (!authed) {
      return NextResponse.json(
        { error: 'Autenticación requerida para acceder a estos datos' },
        { status: 401 }
      );
    }
    return NextResponse.next();
  }

  // Si la ruta NO está en la lista pública, requerir auth para métodos destructivos
  if (!isPublicEndpoint(pathname, method)) {
    if (DESTRUCTIVE_METHODS.includes(method)) {
      const authed = await isAuthenticated(request);
      if (!authed) {
        return NextResponse.json(
          { error: 'Autenticación requerida para esta operación' },
          { status: 401 }
        );
      }
    }
  }

  return NextResponse.next();
}

// ── Matcher: todas las rutas API ────────────────────────────────
export const config = {
  matcher: [
    '/api/:path*',
  ],
};
