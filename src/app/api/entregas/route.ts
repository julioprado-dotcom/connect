import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { entregaCreateSchema } from '@/lib/validations';
import { guardedParse, RATE } from '@/lib/rate-guard';

// GET /api/entregas — Listar entregas con filtros
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const contratoId = searchParams.get('contratoId');
    const tipoBoletin = searchParams.get('tipoBoletin');
    const estado = searchParams.get('estado');
    const canal = searchParams.get('canal');
    const fechaDesde = searchParams.get('fechaDesde');
    const fechaHasta = searchParams.get('fechaHasta');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')));

    const where: Record<string, unknown> = {};

    if (contratoId) where.contratoId = contratoId;
    if (tipoBoletin) where.tipoBoletin = tipoBoletin;
    if (estado) where.estado = estado;
    if (canal) where.canal = canal;
    if (fechaDesde || fechaHasta) {
      where.fechaEnvio = {} as Record<string, unknown>;
      if (fechaDesde) (where.fechaEnvio as Record<string, unknown>).gte = new Date(fechaDesde);
      if (fechaHasta) (where.fechaEnvio as Record<string, unknown>).lte = new Date(fechaHasta);
    }

    const [entregas, total] = await Promise.all([
      db.entrega.findMany({
        where,
        include: {
          contrato: {
            include: { cliente: { select: { id: true, nombre: true, organizacion: true } } },
          },
        },
        orderBy: { fechaCreacion: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.entrega.count({ where }),
    ]);

    // Stats rápidos
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const manana = new Date(hoy);
    manana.setDate(manana.getDate() + 1);

    const [enviadasHoy, fallidasHoy, pendientes] = await Promise.all([
      db.entrega.count({ where: { estado: 'enviado', fechaEnvio: { gte: hoy, lt: manana } } }),
      db.entrega.count({ where: { estado: 'fallido', fechaEnvio: { gte: hoy, lt: manana } } }),
      db.entrega.count({ where: { estado: 'pendiente' } }),
    ]);

    return NextResponse.json({
      entregas,
      total,
      page,
      limit,
      stats: { enviadasHoy, fallidasHoy, pendientes },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/entregas — Registrar una entrega
export async function POST(req: NextRequest) {
  try {
    const parsed = await guardedParse(req, entregaCreateSchema, RATE.WRITE);
    if (parsed instanceof NextResponse) return parsed;
    const { contratoId, tipoBoletin, contenido, fechaProgramada, fechaEnvio, estado, canal, destinatarios, error } = parsed.body;

    // Verificar que el contrato existe
    const contrato = await db.contrato.findUnique({ where: { id: contratoId } });
    if (!contrato) {
      return NextResponse.json({ error: 'Contrato no encontrado' }, { status: 404 });
    }

    const entrega = await db.entrega.create({
      data: {
        contratoId,
        tipoBoletin,
        contenido: contenido || '',
        fechaProgramada: fechaProgramada ? new Date(fechaProgramada) : null,
        fechaEnvio: fechaEnvio ? new Date(fechaEnvio) : new Date(),
        estado: estado || 'enviado',
        canal: canal || 'whatsapp',
        destinatarios: JSON.stringify(destinatarios || []),
        error: error || null,
      },
      include: {
        contrato: {
          include: { cliente: { select: { id: true, nombre: true, organizacion: true } } },
        },
      },
    });

    return NextResponse.json({ entrega }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
