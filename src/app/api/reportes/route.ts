import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { reporteCreateSchema } from '@/lib/validations';
import { guardedParse, RATE, safeError } from '@/lib/rate-guard';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tipo = searchParams.get('tipo');
    const personaId = searchParams.get('personaId');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '10')));

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
    return NextResponse.json({ error: safeError(error, 'reportes') }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const parsed = await guardedParse(request, reporteCreateSchema, RATE.WRITE);
    if (parsed instanceof NextResponse) return parsed;
    const body = parsed.body;

    const reporte = await db.reporte.create({
      data: {
        tipo: body.tipo || 'semanal',
        personaId: body.personaId || null,
        fechaInicio: body.fechaInicio ? new Date(body.fechaInicio) : new Date(),
        fechaFin: body.fechaFin ? new Date(body.fechaFin) : new Date(),
        resumen: body.resumen || '',
        totalMenciones: body.totalMenciones || 0,
        sentimientoPromedio: body.sentimientoPromedio || 0,
        temasPrincipales: Array.isArray(body.temasPrincipales) ? JSON.stringify(body.temasPrincipales) : (body.temasPrincipales || '[]'),
      },
    });

    // Push DB to GitHub as part of generation flow
    try {
      const { pushProductosToGithub } = await import('@/lib/git-utils');
      await pushProductosToGithub(`prod: ${(body.tipo || 'reporte').replace(/_/g, ' ')} creado — ${body.totalMenciones || 0} menciones`);
    } catch (gitErr) {
      console.warn('[reportes POST] Git push falló:', gitErr);
    }

    return NextResponse.json(reporte, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json({ error: safeError(error, 'reportes') }, { status: 500 });
  }
}
