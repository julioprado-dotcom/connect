import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { suscriptorCreateSchema } from '@/lib/validations';
import { guardedParse, rateGuard, RATE } from '@/lib/rate-guard';
import { isRateLimited, getClientIp } from '@/lib/rate-limit';

/* ═══════════════════════════════════════════════════════════
   GET /api/suscriptores
   Query params: search, activo, origen, page, limit
   ═══════════════════════════════════════════════════════════ */

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const search = sp.get('search') || '';
    const activoParam = sp.get('activo');
    const origen = sp.get('origen') || '';
    const page = parseInt(sp.get('page') || '1');
    const limit = Math.min(parseInt(sp.get('limit') || '50'), 200);

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { nombre: { contains: search } },
        { email: { contains: search } },
      ];
    }

    if (activoParam !== null && activoParam !== '') {
      where.activo = activoParam === 'true';
    }

    if (origen) {
      where.origen = origen;
    }

    const [suscriptores, total] = await Promise.all([
      db.suscriptorGratuito.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { fechaSuscripcion: 'desc' },
        select: {
          id: true,
          nombre: true,
          origen: true,
          activo: true,
          fechaSuscripcion: true,
          // PII solo visible con header de autorización
          email: request.headers.get('authorization') ? true : false,
          whatsapp: request.headers.get('authorization') ? true : false,
        },
      }),
      db.suscriptorGratuito.count({ where }),
    ]);

    return NextResponse.json({ suscriptores, total, page, limit });
  } catch (error) {
    console.error('Error fetching suscriptores:', error);
    return NextResponse.json({ error: 'Error al obtener suscriptores' }, { status: 500 });
  }
}

/* ═══════════════════════════════════════════════════════════
   POST /api/suscriptores
   Body: { nombre?, email, whatsapp?, origen?, activo? }
   ═══════════════════════════════════════════════════════════ */

export async function POST(request: NextRequest) {
  try {
    const parsed = await guardedParse(request, suscriptorCreateSchema, RATE.WRITE);
    if (parsed instanceof NextResponse) return parsed;
    const { nombre, email, whatsapp, origen, activo } = parsed.body;

    const suscriptor = await db.suscriptorGratuito.create({
      data: {
        nombre: typeof nombre === 'string' ? nombre.trim() : '',
        email: email.trim(),
        whatsapp: typeof whatsapp === 'string' ? whatsapp.trim() : null,
        origen: typeof origen === 'string' ? origen : 'admin',
        activo: typeof activo === 'boolean' ? activo : true,
      },
    });

    return NextResponse.json({ suscriptor }, { status: 201 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    if (msg.includes('Unique')) {
      return NextResponse.json({ error: 'Ya existe un suscriptor con ese email' }, { status: 409 });
    }
    console.error('Error creating suscriptor:', error);
    return NextResponse.json({ error: 'Error al crear suscriptor' }, { status: 500 });
  }
}

/* ═══════════════════════════════════════════════════════════
   PUT /api/suscriptores?id=xxx
   Body: { nombre?, email?, whatsapp?, origen?, activo? }
   ═══════════════════════════════════════════════════════════ */

export async function PUT(request: NextRequest) {
  try {
    const rateCheck = rateGuard(request, RATE.WRITE);
    if (rateCheck) return rateCheck;

    const id = request.nextUrl.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'El parámetro "id" es obligatorio' }, { status: 400 });
    }

    const existing = await db.suscriptorGratuito.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Suscriptor no encontrado' }, { status: 404 });
    }

    const body = await request.json();

    const data: Record<string, unknown> = {};
    if (body.nombre !== undefined) data.nombre = String(body.nombre).trim();
    if (body.email !== undefined) data.email = String(body.email).trim();
    if (body.whatsapp !== undefined) data.whatsapp = body.whatsapp === '' ? null : String(body.whatsapp).trim();
    if (body.origen !== undefined) data.origen = String(body.origen);
    if (body.activo !== undefined) data.activo = Boolean(body.activo);

    const suscriptor = await db.suscriptorGratuito.update({
      where: { id },
      data,
    });

    return NextResponse.json({ suscriptor });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    if (msg.includes('Unique')) {
      return NextResponse.json({ error: 'Ya existe un suscriptor con ese email' }, { status: 409 });
    }
    console.error('Error updating suscriptor:', error);
    return NextResponse.json({ error: 'Error al actualizar suscriptor' }, { status: 500 });
  }
}

/* ═══════════════════════════════════════════════════════════
   DELETE /api/suscriptores?id=xxx
   ═══════════════════════════════════════════════════════════ */

export async function DELETE(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const { limited } = isRateLimited(ip, RATE.WRITE);
    if (limited) return NextResponse.json({ error: 'Demasiadas peticiones' }, { status: 429 });

    const id = request.nextUrl.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'El parámetro "id" es obligatorio' }, { status: 400 });
    }

    await db.suscriptorGratuito.delete({ where: { id } });
    return NextResponse.json({ success: true, message: 'Suscriptor eliminado correctamente' });
  } catch (error) {
    console.error('Error deleting suscriptor:', error);
    return NextResponse.json({ error: 'Error al eliminar suscriptor' }, { status: 500 });
  }
}
