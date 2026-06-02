import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

/**
 * GET /api/rechazos — Consultar artículos rechazados por el pipeline de captura.
 * Soporta filtros por motivo, medioId, y rango de fecha.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const motivo = searchParams.get('motivo');
    const medioId = searchParams.get('medioId');
    const desde = searchParams.get('desde');
    const hasta = searchParams.get('hasta');
    const limit = Math.min(Number(searchParams.get('limit') || '50'), 200);
    const offset = Number(searchParams.get('offset') || '0');

    const where: Record<string, unknown> = {};

    if (motivo) where.motivo = motivo;
    if (medioId) where.medioId = medioId;
    if (desde || hasta) {
      where.createdAt = {};
      if (desde) (where.createdAt as Record<string, unknown>).gte = new Date(desde);
      if (hasta) (where.createdAt as Record<string, unknown>).lte = new Date(hasta);
    }

    // Obtener rechazos con nombre del medio
    const rechazos = await db.rechazoCaptura.findMany({
      where,
      include: {
        Medio: { select: { nombre: true, url: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    // Conteo total
    const total = await db.rechazoCaptura.count({ where });

    // Resumen por motivo
    const porMotivo = await db.rechazoCaptura.groupBy({
      by: ['motivo'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    });

    // Resumen por medio (top 10)
    const porMedio = await db.$queryRaw<
      Array<{ medioId: string; nombre: string; total: number }>
    >`
      SELECT r.medioId, m.nombre, COUNT(*) as total
      FROM RechazoCaptura r
      JOIN Medio m ON r.medioId = m.id
      GROUP BY r.medioId, m.nombre
      ORDER BY total DESC
      LIMIT 10
    `;

    return NextResponse.json({
      rechazos: rechazos.map(r => ({
        id: r.id,
        medio: r.Medio?.nombre || 'Desconocido',
        medioId: r.medioId,
        url: r.url,
        titulo: r.titulo,
        texto: r.texto,
        motivo: r.motivo,
        respuestaLLM: r.respuestaLLM,
        es_relevante: r.es_relevante,
        tratamiento: r.tratamiento,
        sentimiento: r.sentimiento,
        confianza: r.confianza,
        textoLen: r.textoLen,
        createdAt: r.createdAt,
      })),
      total,
      limit,
      offset,
      resumen: {
        porMotivo: porMotivo.map(m => ({ motivo: m.motivo, cantidad: m._count.id })),
        porMedio,
      },
    });
  } catch (error) {
    console.error('[rechazos] Error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

/**
 * DELETE /api/rechazos — Limpiar rechazos antiguos (mantener últimos N días).
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dias = Number(searchParams.get('dias') || '7');
    const fechaCorte = new Date();
    fechaCorte.setDate(fechaCorte.getDate() - dias);

    const resultado = await db.rechazoCaptura.deleteMany({
      where: { createdAt: { lt: fechaCorte } },
    });

    return NextResponse.json({
      eliminados: resultado.count,
      fechaCorte: fechaCorte.toISOString(),
      dias,
    });
  } catch (error) {
    console.error('[rechazos] Error limpiando:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
