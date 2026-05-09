import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { safeError } from '@/lib/rate-guard';

// GET /api/indicadores/[id] — Detalle de un indicador con valores o evaluaciones
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const indicador = await db.indicador.findUnique({
      where: { id },
      include: {
        _count: { select: { valores: true, evaluaciones: true } },
      },
    });

    if (!indicador) {
      return NextResponse.json({ error: 'Indicador no encontrado' }, { status: 404 });
    }

    // Obtener valores o evaluaciones segun tipo
    let valores: unknown[] = [];
    let evaluaciones: unknown[] = [];

    if (indicador.tipo === 'cuantitativo') {
      valores = await db.indicadorValor.findMany({
        where: { indicadorId: id },
        orderBy: { fechaCaptura: 'desc' },
        take: 100,
      });
    } else {
      evaluaciones = await db.indicadorEvaluacion.findMany({
        where: { indicadorId: id },
        orderBy: { fechaEvaluacion: 'desc' },
        take: 50,
      });
    }

    // Parsear variables JSON
    let parsedVariables: string[] = [];
    try {
      parsedVariables = JSON.parse(indicador.variables || '[]');
    } catch { /* keep empty */ }

    return NextResponse.json({
      ...indicador,
      variablesParsed: parsedVariables,
      valores,
      evaluaciones,
    });
  } catch (error) {
    console.error('Error fetching indicador:', error);
    return NextResponse.json({ error: 'Error al obtener indicador' }, { status: 500 });
  }
}

// PUT /api/indicadores/[id] — Actualizar indicador
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const data: Record<string, unknown> = {};
    const allowedFields = [
      'nombre', 'slug', 'categoria', 'tipo', 'fuente', 'url',
      'periodicidad', 'unidad', 'formatoNumero', 'activo', 'orden',
      'ejesTematicos', 'tier', 'notas', 'metodologia',
      'escalaMin', 'escalaMax',
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (typeof body[field] === 'string') {
          data[field] = body[field].trim();
        } else {
          data[field] = body[field];
        }
      }
    }

    // Variables como JSON
    if (body.variables !== undefined) {
      data.variables = Array.isArray(body.variables)
        ? JSON.stringify(body.variables)
        : typeof body.variables === 'string'
          ? body.variables
          : '[]';
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No se proporcionaron campos para actualizar' }, { status: 400 });
    }

    const indicador = await db.indicador.update({
      where: { id },
      data,
    });

    return NextResponse.json({ indicador });
  } catch (error: unknown) {
    return NextResponse.json({ error: safeError(error, 'indicadores/[id]') }, { status: 500 });
  }
}

// DELETE /api/indicadores/[id] — Eliminar indicador
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await db.indicador.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting indicador:', error);
    return NextResponse.json({ error: 'Error al eliminar indicador' }, { status: 500 });
  }
}
