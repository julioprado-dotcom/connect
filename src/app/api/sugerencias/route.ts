import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { safeError } from '@/lib/safe-error';
import { withAuth } from '@/lib/auth-helpers';

// ═══════════════════════════════════════════════════════════════
// GET /api/sugerencias — Listar sugerencias de inteligencia
// ═══════════════════════════════════════════════════════════════
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const estado = searchParams.get('estado') || 'pendiente';
    const tipo = searchParams.get('tipo') || '';
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const where: Record<string, unknown> = { estado };
    if (tipo) where.tipo = tipo;

    const sugerencias = await db.sugerenciaInteligencia.findMany({
      where,
      orderBy: [{ confianza: 'desc' }, { createdAt: 'desc' }],
      take: limit,
    });

    // Conteo por estado
    const [pendientes, aprobadas, rechazadas] = await Promise.all([
      db.sugerenciaInteligencia.count({ where: { estado: 'pendiente' } }),
      db.sugerenciaInteligencia.count({ where: { estado: 'aprobada' } }),
      db.sugerenciaInteligencia.count({ where: { estado: 'rechazada' } }),
    ]);

    return NextResponse.json({
      sugerencias,
      conteos: { pendientes, aprobadas, rechazadas, total: pendientes + aprobadas + rechazadas },
    });
  } catch (error: unknown) {
    const { error: msg } = safeError(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════
// POST /api/sugerencias — Ejecutar descubrimiento + crear sugerencias
// ═══════════════════════════════════════════════════════════════
export async function POST(request: NextRequest) {
  try {
    const { error: authError } = await withAuth();
    if (authError) return authError;

    const body = await request.json().catch(() => ({}));
    const { action } = body as { action?: string };

    if (action === 'ejecutar') {
      // Ejecutar motor de descubrimiento
      const { ejecutarDescubrimiento } = await import('@/lib/ai/discovery');
      const resultado = await ejecutarDescubrimiento();

      return NextResponse.json({
        success: true,
        ...resultado,
      });
    }

    return NextResponse.json({ error: 'Acción no válida. Usa "ejecutar".' }, { status: 400 });
  } catch (error: unknown) {
    const { error: msg } = safeError(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
