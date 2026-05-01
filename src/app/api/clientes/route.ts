import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search') || '';
    const estado = searchParams.get('estado') || '';
    const segmento = searchParams.get('segmento') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { nombre: { contains: search } },
        { nombreContacto: { contains: search } },
        { email: { contains: search } },
        { organizacion: { contains: search } },
      ];
    }
    if (estado) where.estado = estado;
    if (segmento) where.segmento = segmento;

    const [clientes, total] = await Promise.all([
      db.cliente.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { fechaCreacion: 'desc' },
        include: {
          contratos: {
            where: { estado: 'activo' },
            select: { id: true, tipoProducto: true, estado: true },
          },
        },
      }),
      db.cliente.count({ where }),
    ]);

    // Enriquecer con nombres de parlamentarios
    const enriched = await Promise.all(
      clientes.map(async (c) => {
        let parlamentariosList: Array<{ id: string; nombre: string; camara: string }> = [];
        try {
          const ids = JSON.parse(c.parlamentarios || '[]');
          if (Array.isArray(ids) && ids.length > 0) {
            const personas = await db.persona.findMany({
              where: { id: { in: ids } },
              select: { id: true, nombre: true, camara: true },
            });
            parlamentariosList = personas;
          }
        } catch { /* JSON parse error */ }

        return {
          ...c,
          parlamentariosList,
          parlamentariosCount: parlamentariosList.length,
          contratosActivos: c.contratos.length,
        };
      })
    );

    return NextResponse.json({ clientes: enriched, total, page, limit });
  } catch (error) {
    console.error('Error fetching clientes:', error);
    return NextResponse.json({ error: 'Error al obtener clientes' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      nombre, nombreContacto, email, telefono, whatsapp,
      organizacion, segmento, plan, estado, parlamentarios, ejesContratados, notas,
    } = body;

    if (!nombre || !email) {
      return NextResponse.json({ error: 'Nombre y email son obligatorios' }, { status: 400 });
    }

    const cliente = await db.cliente.create({
      data: {
        nombre: nombre.trim(),
        nombreContacto: nombreContacto ? nombreContacto.trim() : '',
        email: email.trim(),
        telefono: telefono || '',
        whatsapp: whatsapp || '',
        organizacion: organizacion || '',
        segmento: segmento || 'otro',
        plan: plan || 'basico',
        estado: estado || 'activo',
        parlamentarios: Array.isArray(parlamentarios) ? JSON.stringify(parlamentarios) : (parlamentarios || '[]'),
        ejesContratados: Array.isArray(ejesContratados) ? JSON.stringify(ejesContratados) : (ejesContratados || '[]'),
        notas: notas || '',
      },
    });

    return NextResponse.json({ cliente }, { status: 201 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    if (msg.includes('Unique')) {
      return NextResponse.json({ error: 'Ya existe un cliente con ese email' }, { status: 409 });
    }
    console.error('Error creating cliente:', error);
    return NextResponse.json({ error: 'Error al crear cliente' }, { status: 500 });
  }
}
