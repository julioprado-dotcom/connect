/**
 * CONNECTIVITY TEST — Estado de fuentes monitoreadas
 *
 * Google + 3 fuentes: latencia real (HEAD request) + datos de monitoreo
 */

import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-helpers';
import { safeError } from '@/lib/safe-error';
import db from '@/lib/db';

export const runtime = 'nodejs';

async function headCheck(url: string, timeoutMs = 8000): Promise<{ ok: boolean; ms: number }> {
  const start = Date.now();
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        'User-Agent': 'DECODEX-Bot/1.0',
        'Accept': 'text/html',
        'Accept-Language': 'es-BO,es;q=0.9',
      },
    });
    return { ok: res.ok || res.redirected, ms: Date.now() - start };
  } catch {
    return { ok: false, ms: Date.now() - start };
  }
}

export async function GET() {
  const { error: authError } = await withAuth();
  if (authError) return authError;

  try {
    // Google en vivo
    const google = await headCheck('https://www.google.com');

    // Fuentes desde la DB
    const mediosValidos = await db.medio.findMany({ select: { id: true } });
    const medioIds = new Set(mediosValidos.map((m: any) => m.id));

    const fuentes = await db.fuenteEstado.findMany({
      where: {
        medioId: { in: [...medioIds] },
        estado: 'activa',
        totalCambios: { gt: 0 },
      },
      include: { Medio: { select: { nombre: true } } },
      orderBy: { totalCambios: 'desc' },
      take: 3,
    });

    // Latencia real para cada fuente (HEAD request rápido)
    const fuenteResults = await Promise.all(
      fuentes.map(async (f: any) => {
        const latency = await headCheck(f.url, 8000);
        return {
          label: f.Medio?.nombre || 'Desconocido',
          url: f.url,
          ok: latency.ok,
          source: 'live',
          latencyMs: latency.ms,
          totalCambios: f.totalCambios,
          ultimoCheck: f.ultimoCheckOk
            ? new Date(f.ultimoCheckOk).toLocaleString('es-BO', { timeZone: 'America/La_Paz' })
            : 'nunca',
        };
      })
    );

    const results = [
      {
        label: 'Google',
        url: 'https://www.google.com',
        ok: google.ok,
        source: 'live',
        latencyMs: google.ms,
      },
      ...fuenteResults,
    ];

    const okCount = results.filter(r => r.ok).length;
    const failedCount = results.filter(r => !r.ok).length;

    return NextResponse.json({
      connectivity: {
        total: results.length,
        ok: okCount,
        failed: failedCount,
        verdict: okCount >= 3 ? 'OK' : okCount >= 1 ? 'PARTIAL' : 'CRITICAL',
      },
      tests: results,
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: safeError(error) }, { status: 500 });
  }
}
