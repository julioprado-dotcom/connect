// POST /api/dashboard/distribucion/envios/[id]/reintentar — Reintentar envío fallido
//
// Recibe: {} (el ID viene en la URL)
// Busca la Entrega y crea un nuevo job de enviar_entrega.

import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { enqueue } from '@/lib/jobs/queue';
import { withAuth } from '@/lib/auth-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // Auth check
  const { error: authError } = await withAuth();
  if (authError) return authError;

  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { ok: false, error: 'ID de envío requerido' },
        { status: 400 },
      );
    }

    // Find the Entrega by id
    const entrega = await db.entrega.findUnique({
      where: { id },
      include: {
        Contrato: {
          select: {
            id: true,
            tipoProducto: true,
            Cliente: {
              select: { nombre: true, email: true },
            },
          },
        },
      },
    });

    if (!entrega) {
      return NextResponse.json(
        { ok: false, error: 'Entrega no encontrada' },
        { status: 404 },
      );
    }

    // Reset error state and schedule retry
    await db.entrega.update({
      where: { id },
      data: {
        estado: 'pendiente',
        error: null,
        fechaEnvio: null,
      },
    });

    // Enqueue a new enviar_entrega job
    const jobId = await enqueue({
      tipo: 'enviar_entrega',
      prioridad: 3, // P3 — Normal
      payload: {
        entregaId: entrega.id,
        contratoId: entrega.contratoId,
        tipoProducto: entrega.tipoBoletin,
        canal: entrega.canal,
        destinatarios: entrega.destinatarios,
        triggeredBy: 'dashboard-manual-retry',
      },
      programa: 'dashboard-delivery-retry',
    });

    return NextResponse.json({
      ok: true,
      jobId,
      mensaje: 'Reenvío programado',
      entrega: {
        id: entrega.id,
        tipoProducto: entrega.tipoBoletin,
        canal: entrega.canal,
        contrato: entrega.Contrato?.tipoProducto,
      },
    });
  } catch (error) {
    console.error('[API /dashboard/distribucion/envios/[id]/reintentar]', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Error interno del servidor' },
      { status: 500 },
    );
  }
}
