// CRUD de ejes temáticos personalizados por cliente — DECODEX Bolivia
// FASE 4D: Ejes por Cliente

import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { safeError } from '@/lib/safe-error';

// ─── GET: Listar ejes del cliente ───────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: clienteId } = await params;

    // Verificar que el cliente existe
    const cliente = await db.cliente.findUnique({
      where: { id: clienteId },
      select: { id: true, nombre: true },
    });
    if (!cliente) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    }

    const searchParams = _request.nextUrl.searchParams;
    const mostrarInactivos = searchParams.get('activo') === 'false';

    const ejes = await db.ejeTematicoCliente.findMany({
      where: {
        clienteId,
        ...(mostrarInactivos ? {} : { activo: true }),
      },
      orderBy: { creadoEn: 'desc' },
      include: {
        _count: { select: { menciones: true } },
      },
    });

    return NextResponse.json({
      cliente: { id: cliente.id, nombre: cliente.nombre },
      total: ejes.length,
      ejes,
    });
  } catch (error: unknown) {
    const { error: msg, code, details } = safeError(error);
    return NextResponse.json({ error: msg, code, ...(details && { details }) }, { status: 500 });
  }
}

// ─── POST: Crear eje personalizado ──────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: clienteId } = await params;

    // Verificar cliente
    const cliente = await db.cliente.findUnique({
      where: { id: clienteId },
      select: { id: true },
    });
    if (!cliente) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    }

    const body = await request.json();
    const { nombre, descripcion, keywords, activo } = body as {
      nombre?: string;
      descripcion?: string;
      keywords?: string[];
      activo?: boolean;
    };

    // Validaciones
    if (!nombre || typeof nombre !== 'string' || nombre.trim().length < 2) {
      return NextResponse.json(
        { error: 'El nombre es obligatorio (mínimo 2 caracteres)' },
        { status: 400 },
      );
    }
    if (!Array.isArray(keywords) || keywords.length === 0) {
      return NextResponse.json(
        { error: 'Se requiere al menos una keyword' },
        { status: 400 },
      );
    }

    const eje = await db.ejeTematicoCliente.create({
      data: {
        clienteId,
        nombre: nombre.trim(),
        descripcion: descripcion?.trim() || null,
        keywords: JSON.stringify(keywords.map((k: string) => String(k).trim().toLowerCase()).filter(Boolean)),
        activo: typeof activo === 'boolean' ? activo : true,
        creadoPor: 'sistema',
      },
    });

    return NextResponse.json(eje, { status: 201 });
  } catch (error: unknown) {
    const { error: msg, code, details } = safeError(error);
    return NextResponse.json({ error: msg, code, ...(details && { details }) }, { status: 500 });
  }
}
