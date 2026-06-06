/**
 * /api/dashboard/nota-raw/recover — Recuperar notas descartadas
 *
 * POST body: { id: string } — Recupera una nota descartada, poniéndola
 * de vuelta en la cola para que batch_llm la procese.
 *
 * POST body: { ids: string[] } — Recuperar múltiples notas.
 *
 * La nota se marca como procesada=false, descartada=false para que
 * el próximo ciclo de batch_llm la recoja y reclasifique con el LLM.
 */
import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const ids: string[] = body.ids || (body.id ? [body.id] : []);

    if (ids.length === 0) {
      return NextResponse.json({ error: 'Se requiere id o ids' }, { status: 400 });
    }

    // Verificar que las notas existen y están descartadas
    const existentes = await db.notaRaw.findMany({
      where: {
        id: { in: ids },
        descartada: true,
      },
      select: { id: true, titulo: true },
    });

    if (existentes.length === 0) {
      return NextResponse.json({ error: 'No se encontraron notas descartadas con esos IDs', recuperadas: 0 });
    }

    // Recuperar: marcar como pendiente de reprocesamiento
    const result = await db.notaRaw.updateMany({
      where: {
        id: { in: existentes.map(n => n.id) },
      },
      data: {
        procesada: false,
        descartada: false,
        fechaProcesada: null,
        mencionesCreadas: 0,
      },
    });

    console.log(`[nota-raw/recover] ${result.count} notas recuperadas para reprocesamiento`);

    return NextResponse.json({
      recuperadas: result.count,
      notas: existentes.map(n => ({ id: n.id, titulo: n.titulo?.substring(0, 60) })),
    });
  } catch (error: unknown) {
    console.error('[nota-raw/recover] Error:', error);
    return NextResponse.json(
      { error: 'Error interno al recuperar notas' },
      { status: 500 }
    );
  }
}
