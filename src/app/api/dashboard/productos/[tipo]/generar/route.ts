// POST /api/dashboard/productos/[tipo]/generar — Trigger generación de producto
//
// Recibe: {} (el tipo viene en la URL)
// Encola un job de tipo generar_boletin que el scheduler/worker procesará.
// Este es un TRIGGER endpoint — no genera el producto directamente.

import { NextRequest, NextResponse } from 'next/server';
import { enqueue } from '@/lib/jobs/queue';
import { withAuth } from '@/lib/auth-helpers';
import { PRODUCTOS } from '@/constants/products';
import type { TipoBoletin } from '@/types/bulletin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Product name mapping for display
const PRODUCT_NAMES: Record<string, string> = {};
for (const [key, config] of Object.entries(PRODUCTOS)) {
  PRODUCT_NAMES[key] = config.nombre;
}

// Dedicated endpoint mapping (matching GeneratorScheduler logic)
const DEDICATED_ENDPOINTS: Partial<Record<TipoBoletin, string>> = {
  EL_TERMOMETRO: '/api/admin/bulletins/generate-termometro',
  SALDO_DEL_DIA: '/api/admin/bulletins/generate-saldo',
  EL_FOCO: '/api/admin/bulletins/generate-foco',
  EL_RADAR: '/api/admin/bulletins/generate-radar',
  BOLETIN_DEL_GRANO: '/api/admin/bulletins/generate-boletin-grano',
  FICHA_LEGISLADOR: '/api/admin/bulletins/generate-ficha',
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tipo: string }> },
) {
  // Auth check
  const { error: authError } = await withAuth();
  if (authError) return authError;

  try {
    const { tipo } = await params;
    const tipoUpper = tipo?.toUpperCase() as TipoBoletin;

    if (!tipoUpper || !PRODUCT_NAMES[tipoUpper]) {
      return NextResponse.json(
        {
          ok: false,
          error: `Tipo de producto inválido: ${tipo}. Tipos válidos: ${Object.keys(PRODUCT_NAMES).join(', ')}`,
        },
        { status: 400 },
      );
    }

    // Check if product is active
    const config = PRODUCTOS[tipoUpper];
    if (!config.activo) {
      return NextResponse.json(
        { ok: false, error: `El producto ${config.nombre} no está activo` },
        { status: 400 },
      );
    }

    const productoNombre = config.nombre;

    // Parse optional body (for additional params like ejeSlug)
    let extraPayload: Record<string, unknown> = {};
    try {
      const body = await request.json();
      extraPayload = body || {};
    } catch {
      // Empty body is fine
    }

    // Enqueue a generar_boletin job
    const jobId = await enqueue({
      tipo: 'generar_boletin',
      prioridad: 2, // P2 — Media priority for generation
      payload: {
        tipoProducto: tipoUpper,
        productoNombre,
        endpoint: DEDICATED_ENDPOINTS[tipoUpper] || '/api/admin/bulletins/generate-generic',
        triggeredBy: 'dashboard-manual',
        ...extraPayload,
      },
      programa: 'dashboard-product-generation',
      proximaEjecucion: new Date(), // Execute ASAP
    });

    return NextResponse.json({
      ok: true,
      jobId,
      mensaje: `Generación de ${productoNombre} iniciada`,
      tipo: tipoUpper,
    });
  } catch (error) {
    console.error('[API /dashboard/productos/[tipo]/generar]', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Error interno del servidor' },
      { status: 500 },
    );
  }
}
