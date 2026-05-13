// POST /api/dashboard/distribucion/suscriptores/nueva — Añadir nuevo suscriptor
//
// Recibe: { producto, canal: 'email' | 'telegram' | 'whatsapp', destinatario }
// Crea un registro SuscriptorGratuito.

import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { withAuth } from '@/lib/auth-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  // Auth check
  const { error: authError } = await withAuth();
  if (authError) return authError;

  try {
    const body = await request.json();
    const { producto, canal, destinatario, nombre } = body as {
      producto?: string;
      canal?: string;
      destinatario?: string;
      nombre?: string;
    };

    if (!canal || !['email', 'telegram', 'whatsapp'].includes(canal)) {
      return NextResponse.json(
        { ok: false, error: "canal debe ser 'email', 'telegram' o 'whatsapp'" },
        { status: 400 },
      );
    }

    if (!destinatario || typeof destinatario !== 'string' || destinatario.trim().length === 0) {
      return NextResponse.json(
        { ok: false, error: 'destinatario es requerido' },
        { status: 400 },
      );
    }

    // For email, check if already subscribed
    if (canal === 'email') {
      const existing = await db.suscriptorGratuito.findUnique({
        where: { email: destinatario.trim() },
      });
      if (existing) {
        return NextResponse.json(
          { ok: false, error: `Ya existe un suscriptor con ese email: ${destinatario}` },
          { status: 409 },
        );
      }
    }

    // Build boletines list from producto
    const boletines = producto ? JSON.stringify([producto]) : '[]';

    // Create SuscriptorGratuito record
    const suscriptor = await db.suscriptorGratuito.create({
      data: {
        nombre: nombre?.trim() || '',
        email: canal === 'email' ? destinatario.trim() : '',
        whatsapp: canal === 'whatsapp' ? destinatario.trim() : '',
        canal,
        boletines,
        activo: true,
        origen: 'dashboard',
      },
    });

    return NextResponse.json({
      ok: true,
      id: suscriptor.id,
      mensaje: 'Suscriptor añadido',
    });
  } catch (error) {
    console.error('[API /dashboard/distribucion/suscriptores/nueva]', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Error interno del servidor' },
      { status: 500 },
    );
  }
}
