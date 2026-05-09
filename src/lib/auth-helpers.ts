import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

// Types extendidos para incluir `role` en la sesión
// (NextAuth v5 usa type augmentation en auth.ts directamente)

/**
 * Verifica que el usuario actual tenga autenticación.
 * Lanza error 401 si no hay sesión.
 */
export async function requireAuth() {
  const session = await auth();
  if (!session?.user) {
    throw new Response('No autenticado', { status: 401 });
  }
  return session;
}

/**
 * Verifica que el usuario tenga un rol específico.
 * Lanza error 403 si no tiene el rol requerido.
 */
export async function requireRole(role: string) {
  const session = await requireAuth();
  const userRole = (session.user as unknown as Record<string, unknown>)?.role as string;
  if (userRole !== role && userRole !== 'admin') {
    throw new Response('Sin permisos', { status: 403 });
  }
  return session;
}

/**
 * Wrapper para API routes con verificación de autenticación.
 * Retorna error 401 si no hay sesión, o null si está autenticado.
 */
export async function withAuth() {
  const session = await auth();
  if (!session) {
    return {
      session: null as null,
      error: NextResponse.json({ error: 'Autenticación requerida' }, { status: 401 }),
    };
  }
  return {
    session,
    error: null as null,
  };
}
