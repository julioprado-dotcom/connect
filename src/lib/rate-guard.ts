/**
 * rate-guard.ts — Helper para wiring fácil de rate-limit + Zod en API routes
 *
 * Uso:
 *   import { rateGuard, parseBody } from '@/lib/rate-guard';
 *
 *   export async function POST(request: NextRequest) {
 *     const rateCheck = rateGuard(request, { maxRequests: 30 });
 *     if (rateCheck) return rateCheck;  // 429 si excede
 *
 *     const body = parseBody(request, clienteCreateSchema);
 *     if (!body) return;  // parseBody ya respondió con 400
 *     // body está validado y tipado
 *   }
 */

import { NextRequest, NextResponse } from 'next/server';
import { isRateLimited, getClientIp } from './rate-limit';
import type { RateLimitConfig } from './rate-limit';
import { z } from 'zod';

/**
 * Verifica rate-limit. Retorna Response(429) si está limitado, o null si OK.
 */
export function rateGuard(
  request: NextRequest,
  config: Partial<RateLimitConfig> = {}
): NextResponse | null {
  const ip = getClientIp(request);
  const { limited, remaining, resetIn } = isRateLimited(ip, config);

  if (limited) {
    return NextResponse.json(
      {
        error: 'Demasiadas peticiones. Intenta de nuevo más tarde.',
        retryAfter: resetIn,
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(resetIn),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(resetIn),
        },
      }
    );
  }

  // Adjuntar headers informativos a la respuesta (se usarán en el return final)
  return null;
}

/**
 * Headers de rate-limit para agregar a respuestas exitosas.
 */
export function rateLimitHeaders(remaining: number, resetIn: number): Record<string, string> {
  return {
    'X-RateLimit-Remaining': String(remaining),
    'X-RateLimit-Reset': String(resetIn),
  };
}

/**
 * Parsea y valida el body con Zod. Si falla, responde con 400 y retorna null.
 * Si OK, retorna el body parseado y tipado.
 */
export async function parseBody<T extends z.ZodTypeAny>(
  request: NextRequest,
  schema: T
): Promise<z.infer<T> | null> {
  try {
    const raw = await request.json();
    const result = schema.safeParse(raw);

    if (!result.success) {
      const errors = result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));
      NextResponse.json(
        {
          error: 'Datos inválidos',
          details: errors,
        },
        { status: 400 }
      );
      return null;
    }

    return result.data as z.infer<T>;
  } catch {
    NextResponse.json(
      { error: 'Body debe ser JSON válido' },
      { status: 400 }
    );
    return null;
  }
}

/**
 * Combina rateGuard + parseBody en un solo paso.
 * Retorna { body, rateHeaders } si OK, o Response si error.
 */
export async function guardedParse<T extends z.ZodTypeAny>(
  request: NextRequest,
  schema: T,
  rateConfig: Partial<RateLimitConfig> = {}
): Promise<
  | { body: z.infer<T>; ip: string }
  | NextResponse
> {
  // 1. Rate limit check
  const ip = getClientIp(request);
  const { limited, remaining, resetIn } = isRateLimited(ip, rateConfig);

  if (limited) {
    return NextResponse.json(
      {
        error: 'Demasiadas peticiones. Intenta de nuevo más tarde.',
        retryAfter: resetIn,
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(resetIn),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(resetIn),
        },
      }
    );
  }

  // 2. Parse & validate body
  try {
    const raw = await request.json();
    const result = schema.safeParse(raw);

    if (!result.success) {
      const errors = result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));
      return NextResponse.json(
        { error: 'Datos inválidos', details: errors },
        { status: 400, headers: { 'X-RateLimit-Remaining': String(remaining) } }
      );
    }

    return { body: result.data as z.infer<T>, ip };
  } catch {
    return NextResponse.json(
      { error: 'Body debe ser JSON válido' },
      { status: 400 }
    );
  }
}

/** Rate-limit configs predefinidos por categoría */
export const RATE = {
  /** Operaciones CRUD de escritura (POST/PUT/DELETE) */
  WRITE: { maxRequests: 30, windowMs: 60_000 },
  /** Endpoints que usan IA (costosos) */
  AI: { maxRequests: 5, windowMs: 60_000 },
  /** Operaciones destructivas (seed, auth setup) */
  DESTRUCTIVE: { maxRequests: 2, windowMs: 60_000 },
  /** Búsqueda web */
  SEARCH: { maxRequests: 10, windowMs: 60_000 },
} as const;
