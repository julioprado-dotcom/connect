import { NextRequest, NextResponse } from 'next/server';

/**
 * Minimal middleware — protects the most dangerous API routes
 * by rejecting unauthenticated POST requests.
 *
 * Does NOT call auth() to avoid database dependency in edge runtime.
 * Does NOT add security headers (preserves Z.ai iframe proxy).
 */

const DANGEROUS_ROUTES = [
  '/api/admin/purge',
  '/api/seed',
  '/api/auth/setup',
];

function isDangerousRoute(pathname: string): boolean {
  return DANGEROUS_ROUTES.some((r) => pathname.startsWith(r));
}

function isJobsPost(pathname: string, method: string): boolean {
  return (
    pathname.startsWith('/api/jobs/') &&
    method.toUpperCase() === 'POST'
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method.toUpperCase();

  // Protect dangerous routes — only allow if a Bearer token is present
  // (lightweight check that doesn't require database)
  if (isDangerousRoute(pathname) && method === 'POST') {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Autenticación requerida para esta operación' },
        { status: 401 }
      );
    }
  }

  // Protect /api/jobs/* POST routes
  if (isJobsPost(pathname, method)) {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Autenticación requerida para esta operación' },
        { status: 401 }
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/api/admin/purge/:path*',
    '/api/seed/:path*',
    '/api/auth/setup/:path*',
    '/api/jobs/:path*',
  ],
};
