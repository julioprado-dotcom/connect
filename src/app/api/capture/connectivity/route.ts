/**
 * ═══════════════════════════════════════════════════════════════════════
 * CONNECTIVITY TEST — Diagnóstico de red desde el servidor
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Permite probar desde el dashboard si el VPS puede llegar a los medios.
 * Prueba: fetch nativo + Z.ai SDK para cada URL.
 * ═══════════════════════════════════════════════════════════════════════
 */

import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-helpers';
import { safeError } from '@/lib/safe-error';
import { zaiFetch } from '@/lib/jobs/fetch/zai-fetcher';

export const runtime = 'nodejs';

export async function GET() {
  const { error: authError } = await withAuth();
  if (authError) return authError;

  try {
    // Probar conectividad con 3 sitios de referencia
    const testUrls = [
      { label: 'Google', url: 'https://www.google.com' },
      { label: 'ABI', url: 'https://abi.bo' },
      { label: 'La Razón', url: 'https://www.la-razon.com' },
      { label: 'El Deber', url: 'https://eldeber.com.bo' },
      { label: 'Opinión Bolivia', url: 'https://www.opinion.com.bo' },
    ];

    const results = [];

    for (const test of testUrls) {
      const start = Date.now();
      try {
        const result = await zaiFetch(test.url, 10000);
        const elapsed = Date.now() - start;

        results.push({
          label: test.label,
          url: test.url,
          ok: !!result,
          source: result?.source || 'none',
          htmlLength: result?.html?.length || 0,
          title: result?.title?.substring(0, 60) || '',
          latencyMs: elapsed,
        });
      } catch (err) {
        results.push({
          label: test.label,
          url: test.url,
          ok: false,
          source: 'none',
          htmlLength: 0,
          title: '',
          latencyMs: Date.now() - start,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const ok = results.filter(r => r.ok).length;
    const failed = results.filter(r => !r.ok).length;

    return NextResponse.json({
      connectivity: {
        total: results.length,
        ok,
        failed,
        verdict: ok >= 3 ? 'OK' : ok >= 1 ? 'PARTIAL' : 'CRITICAL',
      },
      tests: results,
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: safeError(error) }, { status: 500 });
  }
}
