import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { clienteCreateSchema } from '@/lib/validations';
import { guardedParse, RATE } from '@/lib/rate-guard';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search') || '';
    const estado = searchParams.get('estado') || '';
    const segmento = searchParams.get('segmento') || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { nombre: { contains: search } },
        { nombreContacto: { contains: search } },
        { email: { contains: search } },
        { organizacion: { contains: search } },
        { ci: { contains: search } },
        { nit: { contains: search } },
        { razonSocial: { contains: search } },
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

    // Batch parlamentarios lookup — collect ALL IDs, single query
    const allPersonaIds = new Set<string>();
    const clientePersonaMap = new Map<string, string[]>(); // clienteId -> personaIds

    for (const c of clientes) {
      try {
        const ids: string[] = JSON.parse(c.parlamentarios || '[]');
        if (Array.isArray(ids) && ids.length > 0) {
          clientePersonaMap.set(c.id, ids);
          for (const id of ids) allPersonaIds.add(id);
        }
      } catch { /* JSON parse error */ }
    }

    // Single query for ALL parlamentarios
    const allPersonas = allPersonaIds.size > 0
      ? await db.persona.findMany({
          where: { id: { in: [...allPersonaIds] } },
          select: { id: true, nombre: true, camara: true },
        })
      : [];

    const personaMap = new Map(allPersonas.map((p) => [p.id, p]));

    const enriched = clientes.map((c) => {
      const pIds = clientePersonaMap.get(c.id) || [];
      const parlamentariosList = pIds
        .map((id) => personaMap.get(id))
        .filter(Boolean) as Array<{ id: string; nombre: string; camara: string }>;

      return {
        ...c,
        parlamentariosList,
        parlamentariosCount: parlamentariosList.length,
        contratosActivos: c.contratos.length,
      };
    });

    return NextResponse.json({ clientes: enriched, total, page, limit });
  } catch (error) {
    console.error('Error fetching clientes:', error);
    return NextResponse.json({ error: 'Error al obtener clientes' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const parsed = await guardedParse(request, clienteCreateSchema, RATE.WRITE);
    if (parsed instanceof NextResponse) return parsed;
    const body = parsed.body;

    const {
      nombre, nombreContacto, email, telefono, whatsapp,
      organizacion, segmento, plan, estado, parlamentarios, ejesContratados, notas,
      ci, razonSocial, nit,
    } = body;

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
        ci: ci ? ci.trim() : '',
        razonSocial: razonSocial ? razonSocial.trim() : '',
        nit: nit ? nit.trim() : '',
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
