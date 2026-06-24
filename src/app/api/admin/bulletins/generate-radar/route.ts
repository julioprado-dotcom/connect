/**
 * DECODEX — Generador: El Radar (REDIRECT)
 *
 * Este route dedicado esta OBSOLETO. Redirige toda la logica
 * a generate-generic que tiene: contexto historico, ejes V3,
 * scoring epistemologico, y el prompt actualizado.
 *
 * POST /api/admin/bulletins/generate-radar
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const baseUrl = request.nextUrl.origin;
  const targetUrl = `${baseUrl}/api/admin/bulletins/generate-generic`;

  try {
    const body = await request.json();
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Forward auth cookies
        cookie: request.headers.get('cookie') ?? '',
      },
      body: JSON.stringify({ tipo: 'EL_RADAR', ...body }),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('[generate-radar] Error redirigiendo a generate-generic:', error);
    return NextResponse.json(
      { exito: false, error: 'Error interno al generar EL_RADAR' },
      { status: 500 }
    );
  }
}