import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { INDICADOR_PROTOCOL } from '@/constants/products';

/**
 * GET /api/productos/[tipo]/indicadores
 * Devuelve los indicadores ONION200 asociados a un tipo de producto,
 * con stats básicos para mostrar en el preview.
 *
 * Query params:
 * - dias: ventana en días (default: 7)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tipo: string }> }
) {
  try {
    const { tipo } = await params;
    const searchParams = request.nextUrl.searchParams;
    const dias = Math.min(Math.max(parseInt(searchParams.get('dias') || '7', 10), 1), 365);

    const protocol = INDICADOR_PROTOCOL[tipo as keyof typeof INDICADOR_PROTOCOL];
    if (!protocol || !protocol.activo || protocol.formato === 'ninguno') {
      return NextResponse.json({ indicadores: [] });
    }

    const fechaLimite = new Date();
    fechaLimite.setDate(fechaLimite.getDate() - dias);

    const indicadores = await db.indicador.findMany({
      where: {
        activo: true,
        tipo: 'cuantitativo',
        ...(protocol.categorias.length > 0
          ? { categoria: { in: protocol.categorias } }
          : {}),
      },
      include: {
        IndicadorValor: {
          where: { fecha: { gte: fechaLimite } },
          orderBy: { fecha: 'desc' },
          take: dias,
        },
      },
      orderBy: { nombre: 'asc' },
      take: protocol.take || 10,
    });

    const result = indicadores
      .map(ind => {
        const valores = ind.IndicadorValor
          .map(v => v.valor as number)
          .filter(v => v != null && !isNaN(v));
        if (valores.length === 0) return null;

        const actual = valores[0];
        const promedio = valores.reduce((a, b) => a + b, 0) / valores.length;
        const maximo = Math.max(...valores);
        const minimo = Math.min(...valores);
        const variacion = valores.length >= 2
          ? ((actual - valores[valores.length - 1]) / (valores[valores.length - 1] || 1)) * 100
          : 0;

        return {
          slug: ind.slug,
          nombre: ind.nombre,
          unidad: ind.unidad || '',
          categoria: ind.categoria,
          formato: ind.formatoNumero ?? 2,
          actual,
          promedio,
          maximo,
          minimo,
          variacion,
          dataPoints: valores.length,
        };
      })
      .filter(Boolean);

    return NextResponse.json({
      tipo,
      dias,
      indicadores: result,
    });
  } catch (error) {
    console.error('[indicadores-producto]', error);
    return NextResponse.json({ error: 'Error al obtener indicadores' }, { status: 500 });
  }
}
