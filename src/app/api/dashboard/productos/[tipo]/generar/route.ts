// POST /api/dashboard/productos/[tipo]/generar — Trigger generación de producto
//
// Recibe: {} (el tipo viene en la URL)
// Encola el job correcto según el tipo de producto:
//   - Productos LLM → job "generar_boletin" → runner con generateProductoInterno()
//   - REPORTE_SECTORIAL_MINERO → job "generar_reporte_sectorial" → pipeline especializado
//
// Este es un TRIGGER endpoint — no genera el producto directamente.
// Toda la generación es 100% interna via job queue, SIN fetch HTTP a endpoints.

import { NextRequest, NextResponse } from 'next/server';
import { enqueue } from '@/lib/jobs/queue';
import { PRODUCTOS } from '@/constants/products';
import db from '@/lib/db';
import type { TipoBoletin, JobTipo } from '@/types/bulletin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Product name mapping for display
const PRODUCT_NAMES: Record<string, string> = {};
for (const [key, config] of Object.entries(PRODUCTOS)) {
  PRODUCT_NAMES[key] = config.nombre;
}

// Productos con pipeline especializado → su propio job type
const PRODUCTOS_PIPELINE_PROPIO: Record<string, JobTipo> = {
  REPORTE_SECTORIAL_MINERO: 'generar_reporte_sectorial',
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

    // Determinar el job type correcto según el producto
    const jobType = PRODUCTOS_PIPELINE_PROPIO[tipoUpper] || 'generar_boletin';

    // Dedup: verificar si ya existe un job para este producto
    const existingJob = await db.job.findFirst({
      where: {
        tipo: jobType,
        estado: { in: ['pendiente', 'en_progreso'] },
        payload: { contains: tipoUpper },
        fechaCreacion: { gte: new Date(Date.now() - 3600 * 1000) },
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

    // Enqueue job con el tipo correcto
    const payload: Record<string, unknown> = {
      tipoBoletin: tipoUpper,
      tipoProducto: tipoUpper,
      productoNombre,
      triggeredBy: 'dashboard-manual',
      ...extraPayload,
    };

    const jobId = await enqueue({
      tipo: jobType,
      prioridad: 3,
      payload,
      programa: 'dashboard-product-generation',
      proximaEjecucion: new Date(),
    });

    return NextResponse.json({
      ok: true,
      jobId,
      mensaje: `Generación de ${productoNombre} iniciada`,
      tipo: tipoUpper,
      jobType,
    });
  } catch (error) {
    console.error('[API /dashboard/productos/[tipo]/generar]', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Error interno del servidor' },
      { status: 500 },
    );
  }
}