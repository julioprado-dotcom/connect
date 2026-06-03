// POST /api/dashboard/productos/[tipo]/generar — Trigger generación de producto
//
// Recibe: {} (el tipo viene en la URL)
// Encola un job de tipo generar_boletin que el scheduler/worker procesará.
// Este es un TRIGGER endpoint — no genera el producto directamente.

import { NextRequest, NextResponse } from 'next/server';
import { enqueue } from '@/lib/jobs/queue';
import { PRODUCTOS } from '@/constants/products';
import db from '@/lib/db';
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

    // ═══ FIX 2: Dedup — verificar si ya existe un job para este producto ═══
    const existingJob = await db.job.findFirst({
      where: {
        tipo: 'generar_boletin',
        estado: { in: ['pendiente', 'en_progreso'] },
        payload: { contains: tipoUpper },
        fechaCreacion: { gte: new Date(Date.now() - 3600 * 1000) }, // Solo jobs recientes (1h)
      },
    });

    if (existingJob) {
      return NextResponse.json({
        ok: false,
        error: `Ya existe un job de ${productoNombre} en estado "${existingJob.estado}" (ID: ${existingJob.id}). Espere a que termine antes de generar otro.`,
        existingJobId: existingJob.id,
        existingJobState: existingJob.estado,
      }, { status: 409 });
    }

    // Enqueue a generar_boletin job
    const jobId = await enqueue({
      tipo: 'generar_boletin',
      prioridad: 3, // P3 — Media priority for manual generation
      payload: {
        tipoBoletin: tipoUpper,     // FIX 4: Normalizar — ambos campos para dedup
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
