import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { safeError } from '@/lib/rate-guard';

// GET /api/indicadores/evaluaciones — Listar evaluaciones
// Query params: indicadorId, escalaNivel, limit
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const indicadorId = searchParams.get('indicadorId') || '';
    const escalaNivel = searchParams.get('escalaNivel') || '';
    const limit = parseInt(searchParams.get('limit') || '50');

    const where: Record<string, unknown> = {};
    if (indicadorId) where.indicadorId = indicadorId;
    if (escalaNivel) where.escalaNivel = escalaNivel;

    const evaluaciones = await db.indicadorEvaluacion.findMany({
      where,
      orderBy: { fechaEvaluacion: 'desc' },
      take: limit,
      include: {
        indicador: {
          select: { id: true, nombre: true, slug: true, categoria: true, tipo: true },
        },
      },
    });

    const total = await db.indicadorEvaluacion.count({ where });

    return NextResponse.json({ evaluaciones, total });
  } catch (error) {
    console.error('Error fetching evaluaciones:', error);
    return NextResponse.json({ error: 'Error al obtener evaluaciones' }, { status: 500 });
  }
}

// POST /api/indicadores/evaluaciones — Crear nueva evaluacion
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.indicadorId) {
      return NextResponse.json({ error: 'indicadorId es obligatorio' }, { status: 400 });
    }

    // Verificar que el indicador existe y es cualitativo
    const indicador = await db.indicador.findUnique({
      where: { id: body.indicadorId },
    });

    if (!indicador) {
      return NextResponse.json({ error: 'Indicador no encontrado' }, { status: 404 });
    }

    // Calcular valor compuesto si no se proporciona
    let valorCompuesto = body.valorCompuesto ?? 0;
    const puntuaciones = body.puntuaciones || {};

    if (body.valorCompuesto === undefined || body.valorCompuesto === null) {
      const vals = Object.values(puntuaciones) as number[];
      if (vals.length > 0) {
        valorCompuesto = Math.round((vals.reduce((a: number, b: number) => a + b, 0) / vals.length) * 10) / 10;
      }
    }

    // Determinar escalaNivel segun el valor compuesto
    let escalaNivel = body.escalaNivel || '';
    if (!escalaNivel && valorCompuesto > 0) {
      const min = indicador.escalaMin || 0;
      const max = indicador.escalaMax || 10;
      const range = max - min || 1;
      const pct = (valorCompuesto - min) / range;

      if (pct >= 0.75) escalaNivel = 'critico';
      else if (pct >= 0.55) escalaNivel = 'alto';
      else if (pct >= 0.35) escalaNivel = 'medio';
      else escalaNivel = 'bajo';
    }

    const evaluacion = await db.indicadorEvaluacion.create({
      data: {
        indicadorId: body.indicadorId,
        valorCompuesto,
        valorTexto: body.valorTexto || escalaNivel || '',
        escalaNivel,
        puntuaciones: typeof body.puntuaciones === 'string'
          ? body.puntuaciones
          : JSON.stringify(body.puntuaciones || {}),
        observaciones: body.observaciones || '',
        fuentes: Array.isArray(body.fuentes)
          ? JSON.stringify(body.fuentes)
          : (body.fuentes || '[]'),
        evaluador: body.evaluador || 'sistema',
        confiable: body.confiable !== undefined ? body.confiable : true,
      },
    });

    return NextResponse.json({ evaluacion }, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json({ error: safeError(error, 'indicadores/evaluaciones') }, { status: 500 });
  }
}
