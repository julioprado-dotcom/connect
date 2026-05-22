import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

// ─── Middleware de Seguridad Global ─────────────────────────────
// Protege TODAS las rutas /api/* y páginas del dashboard.
// Exige autenticación JWT válida para cualquier acceso.
//
// Excepciones (rutas públicas):
//   - /api/auth/*          → Login, signup, callbacks de NextAuth
//   - /api/suscriptores/*  → Formulario público de suscripción
//   - /api/alertas/estado  → Health check público (sin datos sensibles)
//   - /login               → Página de inicio de sesión
//   - /suscribir           → Landing de suscripción
//   - /                    → Homepage pública
//   - Assets estáticos     → _next/static, _next/image, favicon, etc.
//
// Cualquier ruta NO listada aquí requerirá token JWT válido.

const PUBLIC_API_ROUTES = [
  '/api/auth',
  '/api/suscriptores',
  '/api/alertas/estado',
];

const PUBLIC_PAGE_ROUTES = [
  '/login',
  '/suscribir',
];

// Rutas que siempre se permiten (sin auth)
function isPublicRoute(pathname: string): boolean {
  // Root path
  if (pathname === '/') return true;

  // Assets estáticos de Next.js
  if (
    pathname.startsWith('/_next/static') ||
    pathname.startsWith('/_next/image') ||
    pathname === '/favicon.ico'
  ) {
    return true;
  }

  // Rutas de API públicas
  if (PUBLIC_API_ROUTES.some((route) => pathname === route || pathname.startsWith(route + '/'))) {
    return true;
  }

  // Páginas públicas
  if (PUBLIC_PAGE_ROUTES.some((route) => pathname === route || pathname.startsWith(route + '/'))) {
    return true;
  }

  return false;
}

export { PUBLIC_API_ROUTES };

export async function middleware(request: NextRequest) {
  try {
    const { pathname } = request.nextUrl;

    // Permitir rutas públicas sin verificación
    if (isPublicRoute(pathname)) {
      return NextResponse.next();
    }

    // Verificar token JWT (compatible con Edge Runtime)
    const token = await getToken({
      req: request,
      secret: process.env.AUTH_SECRET,
      secureCookie: process.env.NODE_ENV === 'production',
    });

    if (!token) {
      // Si es solicitud de API, devolver 401 JSON
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { error: 'Autenticacion requerida' },
          { status: 401 }
        );
      }
      // Si es página, redirigir a login
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Token válido — continuar
    return NextResponse.next();
  } catch (error) {
    console.error('[middleware] Error de autenticacion:', error);
    const { pathname } = request.nextUrl;
    // Ante cualquier error, denegar acceso (fail-closed)
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Error de autenticacion' },
        { status: 401 }
      );
    }
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
