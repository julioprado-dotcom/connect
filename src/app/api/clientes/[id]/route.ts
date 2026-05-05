import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { rateGuard, RATE } from '@/lib/rate-guard';
import { isRateLimited, getClientIp } from '@/lib/rate-limit';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cliente = await db.cliente.findUnique({
      where: { id },
      include: {
        contratos: { orderBy: { fechaCreacion: 'desc' } },
      },
    });

    if (!cliente) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    }

    // Enriquecer parlamentarios
    let parlamentariosList: Array<{ id: string; nombre: string; camara: string; partidoSigla: string }> = [];
    try {
      const ids = JSON.parse(cliente.parlamentarios || '[]');
      if (Array.isArray(ids) && ids.length > 0) {
        parlamentariosList = await db.persona.findMany({
          where: { id: { in: ids } },
          select: { id: true, nombre: true, camara: true, partidoSigla: true },
        });
      }
    } catch { /* JSON parse error */ }

    return NextResponse.json({ ...cliente, parlamentariosList });
  } catch (error) {
    console.error('Error fetching cliente:', error);
    return NextResponse.json({ error: 'Error al obtener cliente' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rateCheck = rateGuard(request, RATE.WRITE);
    if (rateCheck) return rateCheck;

    const { id } = await params;
    const body = await request.json();

    const cliente = await db.cliente.update({
      where: { id },
      data: {
        ...(body.nombre !== undefined ? { nombre: body.nombre.trim() } : {}),
        ...(body.nombreContacto !== undefined ? { nombreContacto: body.nombreContacto } : {}),
        ...(body.email !== undefined ? { email: body.email.trim() } : {}),
        ...(body.telefono !== undefined ? { telefono: body.telefono } : {}),
        ...(body.whatsapp !== undefined ? { whatsapp: body.whatsapp } : {}),
        ...(body.organizacion !== undefined ? { organizacion: body.organizacion } : {}),
        ...(body.segmento !== undefined ? { segmento: body.segmento } : {}),
        ...(body.plan !== undefined ? { plan: body.plan } : {}),
        ...(body.estado !== undefined ? { estado: body.estado } : {}),
        ...(body.parlamentarios !== undefined ? {
          parlamentarios: Array.isArray(body.parlamentarios) ? JSON.stringify(body.parlamentarios) : body.parlamentarios,
        } : {}),
        ...(body.ejesContratados !== undefined ? {
          ejesContratados: Array.isArray(body.ejesContratados) ? JSON.stringify(body.ejesContratados) : body.ejesContratados,
        } : {}),
        ...(body.notas !== undefined ? { notas: body.notas } : {}),
        ...(body.ci !== undefined ? { ci: body.ci.trim ? body.ci.trim() : body.ci } : {}),
        ...(body.razonSocial !== undefined ? { razonSocial: body.razonSocial.trim ? body.razonSocial.trim() : body.razonSocial } : {}),
        ...(body.nit !== undefined ? { nit: body.nit.trim ? body.nit.trim() : body.nit } : {}),
      },
    });

    return NextResponse.json({ cliente });
  } catch (error) {
    console.error('Error updating cliente:', error);
    return NextResponse.json({ error: 'Error al actualizar cliente' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ip = getClientIp(request);
    const { limited } = isRateLimited(ip, RATE.WRITE);
    if (limited) return NextResponse.json({ error: 'Demasiadas peticiones' }, { status: 429 });

    const { id } = await params;
    await db.cliente.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting cliente:', error);
    return NextResponse.json({ error: 'Error al eliminar cliente' }, { status: 500 });
  }
}
