// CRUD individual de eje temático por cliente — DECODEX Bolivia
// FASE 4D: Ejes por Cliente

import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { safeError } from '@/lib/safe-error';

// ─── GET: Detalle de un eje con menciones paginadas ─────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; ejeId: string }> },
) {
  try {
    const { id: clienteId, ejeId } = await params;

    const eje = await db.ejeTematicoCliente.findUnique({
      where: { id: parseInt(ejeId, 10) },
      include: {
        cliente: { select: { id: true, nombre: true } },
        _count: { select: { menciones: true } },
      },
    });

    if (!eje || eje.clienteId !== clienteId) {
      return NextResponse.json({ error: 'Eje no encontrado para este cliente' }, { status: 404 });
    }

    // Menciones paginadas
    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const skip = (page - 1) * limit;

    const [menciones, total] = await Promise.all([
      db.mencionClienteEje.findMany({
        where: { ejeClienteId: eje.id },
        include: {
          mencion: {
            select: {
              id: true,
              titulo: true,
              texto: true,
              fechaCaptura: true,
              medio: { select: { nombre: true } },
              persona: { select: { nombre: true } },
            },
          },
        },
        orderBy: { id: 'desc' },
        skip,
        take: limit,
      }),
      db.mencionClienteEje.count({ where: { ejeClienteId: eje.id } }),
    ]);

    return NextResponse.json({
      ...eje,
      keywords: JSON.parse(eje.keywords || '[]'),
      menciones: {
        items: menciones,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: unknown) {
    const { error: msg, code, details } = safeError(error);
    return NextResponse.json({ error: msg, code, ...(details && { details }) }, { status: 500 });
  }
}

// ─── PATCH: Actualizar eje ─────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; ejeId: string }> },
) {
  try {
    const { id: clienteId, ejeId } = await params;

    // Verificar que el eje pertenece al cliente
    const existente = await db.ejeTematicoCliente.findUnique({
      where: { id: parseInt(ejeId, 10) },
    });
    if (!existente || existente.clienteId !== clienteId) {
      return NextResponse.json({ error: 'Eje no encontrado para este cliente' }, { status: 404 });
    }

    const body = await request.json();
    const updates: Record<string, unknown> = { editadoPor: 'sistema', editadoEn: new Date() };

    if (body.nombre !== undefined) {
      if (typeof body.nombre !== 'string' || body.nombre.trim().length < 2) {
        return NextResponse.json({ error: 'Nombre inválido (mínimo 2 caracteres)' }, { status: 400 });
      }
      updates.nombre = body.nombre.trim();
    }
    if (body.descripcion !== undefined) {
      updates.descripcion = typeof body.descripcion === 'string' ? body.descripcion.trim() : null;
    }
    if (body.keywords !== undefined) {
      if (!Array.isArray(body.keywords) || body.keywords.length === 0) {
        return NextResponse.json({ error: 'Se requiere al menos una keyword' }, { status: 400 });
      }
      updates.keywords = JSON.stringify(
        body.keywords.map((k: unknown) => String(k).trim().toLowerCase()).filter(Boolean),
      );
    }
    if (body.activo !== undefined) {
      updates.activo = Boolean(body.activo);
    }

    const actualizado = await db.ejeTematicoCliente.update({
      where: { id: parseInt(ejeId, 10) },
      data: updates,
    });

    return NextResponse.json({
      ...actualizado,
      keywords: JSON.parse(actualizado.keywords || '[]'),
    });
  } catch (error: unknown) {
    const { error: msg, code, details } = safeError(error);
    return NextResponse.json({ error: msg, code, ...(details && { details }) }, { status: 500 });
  }
}

// ─── DELETE: Soft delete (marcar activo=false) ──────────────────

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; ejeId: string }> },
) {
  try {
    const { id: clienteId, ejeId } = await params;

    const existente = await db.ejeTematicoCliente.findUnique({
      where: { id: parseInt(ejeId, 10) },
    });
    if (!existente || existente.clienteId !== clienteId) {
      return NextResponse.json({ error: 'Eje no encontrado para este cliente' }, { status: 404 });
    }

    // Soft delete
    const desactivado = await db.ejeTematicoCliente.update({
      where: { id: parseInt(ejeId, 10) },
      data: { activo: false, editadoPor: 'sistema', editadoEn: new Date() },
    });

    return NextResponse.json({
      mensaje: 'Eje desactivado correctamente',
      eje: desactivado,
    });
  } catch (error: unknown) {
    const { error: msg, code, details } = safeError(error);
    return NextResponse.json({ error: msg, code, ...(details && { details }) }, { status: 500 });
  }
}
