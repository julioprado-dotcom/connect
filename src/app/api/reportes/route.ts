import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tipo = searchParams.get('tipo');
    const personaId = searchParams.get('personaId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');

    const where: Record<string, unknown> = {};
    if (tipo) where.tipo = tipo;
    if (personaId) where.personaId = personaId;

    const [reportes, total] = await Promise.all([
      db.reporte.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { fechaCreacion: 'desc' },
        include: {
          persona: { select: { id: true, nombre: true, partidoSigla: true } },
        },
      }),
      db.reporte.count({ where }),
    ]);

    return NextResponse.json({
      reportes,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const reporte = await db.reporte.create({
      data: {
        tipo: body.tipo || 'semanal',
        personaId: body.personaId || null,
        fechaInicio: body.fechaInicio ? new Date(body.fechaInicio) : new Date(),
        fechaFin: body.fechaFin ? new Date(body.fechaFin) : new Date(),
        resumen: body.resumen || '',
        totalMenciones: body.totalMenciones || 0,
        sentimientoPromedio: body.sentimientoPromedio || 0,
        temasPrincipales: body.temasPrincipales || '[]',
      },
    });
    return NextResponse.json(reporte, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
