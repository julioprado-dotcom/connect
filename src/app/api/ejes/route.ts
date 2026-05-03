import { NextResponse } from 'next/server';
import db from '@/lib/db';

function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
}

export async function GET() {
  try {
    const ejes = await db.ejeTematico.findMany({
      where: { activo: true },
      orderBy: { orden: 'asc' },
    });

    // Single groupBy query instead of N+1 per eje
    const conteosRaw = await db.mencionTema.groupBy({
      by: ['ejeTematicoId'],
      _count: { id: true },
    });

    const conteoMap = new Map(conteosRaw.map((c) => [c.ejeTematicoId, c._count.id]));

    const ejesConConteo = ejes.map((eje) => ({
      ...eje,
      mencionesCount: conteoMap.get(eje.id) || 0,
    }));

    return NextResponse.json({
      ejes: ejesConConteo,
      totalEjes: ejes.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const nombre = (body.nombre || '').trim();
    if (!nombre) {
      return NextResponse.json({ error: 'El campo "nombre" es requerido' }, { status: 400 });
    }

    // Auto-generate slug from nombre if not provided
    const slug = (body.slug || '').trim() || generateSlug(nombre);
    if (!slug) {
      return NextResponse.json({ error: 'No se pudo generar un slug válido' }, { status: 400 });
    }

    // Check unique slug
    const existing = await db.ejeTematico.findFirst({
      where: { slug },
    });
    if (existing) {
      return NextResponse.json({ error: `Ya existe un eje temático con el slug "${slug}"` }, { status: 409 });
    }

    const eje = await db.ejeTematico.create({
      data: {
        nombre,
        slug,
        icono: body.icono || '',
        color: body.color || '#6b7280',
        descripcion: body.descripcion || '',
        keywords: body.keywords || '',
        activo: body.activo !== undefined ? body.activo : true,
        orden: body.orden ?? 0,
      },
    });

    return NextResponse.json({ eje, message: 'Eje temático creado correctamente' }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'El parámetro "id" es requerido' }, { status: 400 });
    }

    // Validate ID exists
    const existing = await db.ejeTematico.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Eje temático no encontrado' }, { status: 404 });
    }

    // Soft delete: set activo=false
    await db.ejeTematico.update({
      where: { id },
      data: { activo: false },
    });

    return NextResponse.json({ message: 'Eje temático desactivado correctamente' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
