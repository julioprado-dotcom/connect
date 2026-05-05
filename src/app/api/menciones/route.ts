import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const personaId = searchParams.get('personaId');
    const medioId = searchParams.get('medioId');
    const sentimiento = searchParams.get('sentimiento');
    const tipoMencion = searchParams.get('tipoMencion');
    const fechaDesde = searchParams.get('fechaDesde');
    const fechaHasta = searchParams.get('fechaHasta');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));

    const where: Record<string, unknown> = {};
    if (personaId) where.personaId = personaId;
    if (medioId) where.medioId = medioId;
    if (sentimiento) where.sentimiento = sentimiento;
    if (tipoMencion) where.tipoMencion = tipoMencion;
    if (fechaDesde || fechaHasta) {
      where.fechaCaptura = {};
      if (fechaDesde) (where.fechaCaptura as Record<string, unknown>).gte = new Date(fechaDesde);
      if (fechaHasta) (where.fechaCaptura as Record<string, unknown>).lte = new Date(fechaHasta);
    }

    const [menciones, total] = await Promise.all([
      db.mencion.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { fechaCaptura: 'desc' },
        include: {
          persona: { select: { id: true, nombre: true, partidoSigla: true, camara: true } },
          medio: { select: { id: true, nombre: true, tipo: true } },
        },
      }),
      db.mencion.count({ where }),
    ]);

    return NextResponse.json({
      menciones,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
