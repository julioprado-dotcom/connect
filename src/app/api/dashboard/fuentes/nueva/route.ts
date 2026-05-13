// POST /api/dashboard/fuentes/nueva — Añadir nueva fuente
//
// Recibe: { nombre, url, tipo: 'rss' | 'html', categoria? }
// Crea un registro Medio + FuenteEstado.

import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { withAuth } from '@/lib/auth-helpers';
import { TIPO_CHECK_PATTERNS } from '@/lib/jobs/constants';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function inferTipoCheck(url: string, tipo: string): string {
  // If the user already specified a tipo, check URL patterns
  if (tipo === 'rss') return 'rss';
  // Check URL patterns for auto-detection
  for (const pattern of TIPO_CHECK_PATTERNS) {
    if (pattern.patron.test(url)) return pattern.tipo;
  }
  return 'head';
}

export async function POST(request: NextRequest) {
  // Auth check
  const { error: authError } = await withAuth();
  if (authError) return authError;

  try {
    const body = await request.json();
    const { nombre, url, tipo, categoria } = body;

    if (!nombre || typeof nombre !== 'string' || nombre.trim().length === 0) {
      return NextResponse.json(
        { ok: false, error: 'nombre es requerido' },
        { status: 400 },
      );
    }

    if (!url || typeof url !== 'string' || url.trim().length === 0) {
      return NextResponse.json(
        { ok: false, error: 'url es requerida' },
        { status: 400 },
      );
    }

    if (!tipo || !['rss', 'html'].includes(tipo)) {
      return NextResponse.json(
        { ok: false, error: "tipo debe ser 'rss' o 'html'" },
        { status: 400 },
      );
    }

    // Check for duplicate URL
    const existing = await db.medio.findFirst({
      where: { url: url.trim() },
    });

    if (existing) {
      return NextResponse.json(
        { ok: false, error: `Ya existe una fuente con esa URL: ${existing.nombre}` },
        { status: 409 },
      );
    }

    // Infer tipo check from URL
    const tipoCheck = inferTipoCheck(url.trim(), tipo);

    // Create Medio record
    const medio = await db.medio.create({
      data: {
        nombre: nombre.trim(),
        url: url.trim(),
        tipo: tipo === 'rss' ? 'rss' : 'web',
        categoria: categoria?.trim() || 'corporativo',
        nivel: '3', // New sources default to nivel 3
        activo: true,
      },
    });

    // Create FuenteEstado record
    const fuenteEstado = await db.fuenteEstado.create({
      data: {
        medioId: medio.id,
        url: url.trim(),
        tipoCheck,
        estado: 'creada',
        activo: true,
        frecuenciaBase: '6h',
        frecuenciaActual: '6h',
      },
    });

    return NextResponse.json({
      ok: true,
      id: medio.id,
      fuenteEstadoId: fuenteEstado.id,
      mensaje: `Fuente ${medio.nombre} añadida`,
    });
  } catch (error) {
    console.error('[API /dashboard/fuentes/nueva]', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Error interno del servidor' },
      { status: 500 },
    );
  }
}
