import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

// ─── Middleware de Seguridad Global ─────────────────────────────
// Protege TODAS las rutas /api/* exigiendo autenticación JWT.
// Excepciones (rutas públicas):
//   - /api/auth/*          → Login, signup, callbacks de NextAuth
//   - /api/suscriptores/*  → Formulario público de suscripción
//   - /api/alertas/estado  → Health check público (sin datos sensibles)
//
// Cualquier ruta NO listada aquí requerirá token JWT válido.

const PUBLIC_API_ROUTES = [
  '/api/auth',
  '/api/suscriptores',
  '/api/alertas/estado',
];

export { PUBLIC_API_ROUTES };

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Solo interceptar rutas /api/*
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Permitir rutas públicas
  const isPublic = PUBLIC_API_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + '/')
  );
  if (isPublic) {
    return NextResponse.next();
  }

  // Verificar token JWT
  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
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
}

export const config = {
  matcher: [
    // Todas las rutas /api/* (excepto _next/static, _next/image, favicon, etc.)
    '/api/:path*',
    // También proteger páginas del dashboard
    '/((?!login|_next/static|_next/image|favicon.ico).*)',
  ],
};
