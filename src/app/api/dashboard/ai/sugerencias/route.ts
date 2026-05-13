import { NextResponse } from 'next/server';
import db from '@/lib/db';

/**
 * GET /api/dashboard/ai/sugerencias
 * Returns proactive suggestions (AdminFeedback where sugerenciaGenerada = true and resultado != 'exito')
 */
export async function GET() {
  try {
    const sugerencias = await db.adminFeedback.findMany({
      where: {
        sugerenciaGenerada: true,
        resultado: { not: 'exito' },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return NextResponse.json({ sugerencias });
  } catch (error) {
    console.error('[AI Sugerencias] Error:', error);
    return NextResponse.json(
      { error: 'Error al obtener sugerencias' },
      { status: 500 }
    );
  }
}
