import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

// GET /api/indicadores/[id]/history?dias=30
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const searchParams = request.nextUrl.searchParams;
    const diasParam = parseInt(searchParams.get('dias') || '30', 10);
    const dias = Math.min(Math.max(diasParam, 1), 365);

    // Look up the indicador by id (accepts both id and slug)
    const indicador = await db.indicador.findFirst({
      where: {
        OR: [{ id }, { slug: id }],
      },
    });

    if (!indicador) {
      return NextResponse.json(
        { error: `Indicador no encontrado: ${id}` },
        { status: 404 }
      );
    }

    // Only return history for cuantitativo indicators
    if (indicador.tipo !== 'cuantitativo') {
      return NextResponse.json(
        { error: 'Solo indicadores cuantitativos tienen historial numérico' },
        { status: 400 }
      );
    }

    const valores = await db.indicadorValor.findMany({
      where: {
        indicadorId: indicador.id,
      },
      orderBy: { fecha: 'desc' },
      take: dias,
    });

    const data = valores.map((v) => ({
      fecha: v.fecha.toISOString().split('T')[0],
      valor: v.valor,
      valorTexto: v.valorTexto,
      confiable: v.confiable,
    }));

    return NextResponse.json({
      slug: indicador.slug,
      nombre: indicador.nombre,
      dias,
      data,
    });
  } catch (error) {
    console.error('Error fetching history:', error);
    return NextResponse.json(
      { error: 'Error al obtener historial' },
      { status: 500 }
    );
  }
}
