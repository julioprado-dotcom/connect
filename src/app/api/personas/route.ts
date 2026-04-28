import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const camara = searchParams.get('camara');
    const partido = searchParams.get('partido');
    const departamento = searchParams.get('departamento');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    const where: Record<string, unknown> = { activa: true };
    if (camara) where.camara = camara;
    if (partido) where.partidoSigla = partido;
    if (departamento) where.departamento = departamento;
    if (search) where.nombre = { contains: search };

    const [personas, total] = await Promise.all([
      db.persona.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { nombre: 'asc' },
      }),
      db.persona.count({ where }),
    ]);

    return NextResponse.json({
      personas,
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
    const persona = await db.persona.create({
      data: {
        nombre: body.nombre,
        camara: body.camara || 'Diputados',
        departamento: body.departamento || '',
        partido: body.partido || '',
        partidoSigla: body.partidoSigla || '',
        tipo: body.tipo || 'plurinominal',
        cargoDirectiva: body.cargoDirectiva,
        email: body.email,
        fotoUrl: body.fotoUrl || '',
      },
    });
    return NextResponse.json(persona, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
