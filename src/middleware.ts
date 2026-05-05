import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

// Rutas que requieren autenticación
const PROTECTED_ROUTES = ['/dashboard', '/agente'];

// Rutas que requieren rol admin
const ADMIN_ROUTES = ['/dashboard'];

// API routes que requieren autenticación (métodos de escritura)
const PROTECTED_API_METHODS = ['POST', 'PUT', 'DELETE', 'PATCH'];

// APIs que siempre son públicas (lectura sin auth)
const PUBLIC_API_ROUTES = [
  '/api/auth/',
  '/api/medios/health',
  '/api/seed',
  '/api/indicadores/capture',
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Permitir rutas públicas sin autenticación
  const isPublicPage =
    pathname === '/' ||
    pathname === '/login' ||
    pathname.startsWith('/suscribir') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/auth/') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.') // archivos estáticos

  if (isPublicPage) {
    return NextResponse.next();
  }

  // Verificar sesión
  const session = await auth();

  // Proteger rutas de dashboard y agente
  if (PROTECTED_ROUTES.some(route => pathname.startsWith(route))) {
    if (!session) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Verificar rol para rutas de admin
    if (ADMIN_ROUTES.some(route => pathname.startsWith(route))) {
      const userRole = (session.user as unknown as Record<string, unknown>)?.role;
      if (userRole !== 'admin') {
        const agenteUrl = new URL('/agente', request.url);
        return NextResponse.redirect(agenteUrl);
      }
    }

    return NextResponse.next();
  }

  // Proteger API routes de escritura
  if (pathname.startsWith('/api/') && !PUBLIC_API_ROUTES.some(r => pathname.startsWith(r))) {
    const method = request.method.toUpperCase();

    if (PROTECTED_API_METHODS.includes(method)) {
      if (!session) {
        return NextResponse.json(
          { error: 'Autenticación requerida' },
          { status: 401 }
        );
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - public folder files
     */
    '/((?!_next/static|_next/image|public/).*)',
  ],
};
