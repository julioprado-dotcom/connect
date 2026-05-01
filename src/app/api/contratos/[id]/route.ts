import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const contrato = await db.contrato.findUnique({
      where: { id },
      include: {
        cliente: { select: { id: true, nombre: true, email: true, plan: true } },
      },
    });

    if (!contrato) {
      return NextResponse.json({ error: 'Contrato no encontrado' }, { status: 404 });
    }

    // Enriquecer medios y parlamentarios
    let mediosList: Array<{ id: string; nombre: string; activo: boolean; tipo: string }> = [];
    let parlList: Array<{ id: string; nombre: string; camara: string; partidoSigla: string }> = [];

    try {
      const mIds = JSON.parse(contrato.mediosAsignados || '[]');
      if (Array.isArray(mIds) && mIds.length > 0) {
        mediosList = await db.medio.findMany({
          where: { id: { in: mIds } },
          select: { id: true, nombre: true, activo: true, tipo: true },
        });
      }
    } catch { /* parse error */ }

    try {
      const pIds = JSON.parse(contrato.parlamentarios || '[]');
      if (Array.isArray(pIds) && pIds.length > 0) {
        parlList = await db.persona.findMany({
          where: { id: { in: pIds } },
          select: { id: true, nombre: true, camara: true, partidoSigla: true },
        });
      }
    } catch { /* parse error */ }

    return NextResponse.json({ ...contrato, mediosList, parlamentariosList: parlList });
  } catch (error) {
    console.error('Error fetching contrato:', error);
    return NextResponse.json({ error: 'Error al obtener contrato' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const contrato = await db.contrato.update({
      where: { id },
      data: {
        ...(body.tipoProducto !== undefined ? { tipoProducto: body.tipoProducto } : {}),
        ...(body.mediosAsignados !== undefined ? {
          mediosAsignados: Array.isArray(body.mediosAsignados) ? JSON.stringify(body.mediosAsignados) : body.mediosAsignados,
        } : {}),
        ...(body.ejesTematicos !== undefined ? {
          ejesTematicos: Array.isArray(body.ejesTematicos) ? JSON.stringify(body.ejesTematicos) : body.ejesTematicos,
        } : {}),
        ...(body.parlamentarios !== undefined ? {
          parlamentarios: Array.isArray(body.parlamentarios) ? JSON.stringify(body.parlamentarios) : body.parlamentarios,
        } : {}),
        ...(body.frecuencia !== undefined ? { frecuencia: body.frecuencia } : {}),
        ...(body.formatoEntrega !== undefined ? { formatoEntrega: body.formatoEntrega } : {}),
        ...(body.fechaInicio !== undefined ? { fechaInicio: new Date(body.fechaInicio) } : {}),
        ...(body.fechaFin !== undefined ? { fechaFin: body.fechaFin ? new Date(body.fechaFin) : null } : {}),
        ...(body.montoMensual !== undefined ? { montoMensual: body.montoMensual } : {}),
        ...(body.moneda !== undefined ? { moneda: body.moneda } : {}),
        ...(body.estado !== undefined ? { estado: body.estado } : {}),
        ...(body.notas !== undefined ? { notas: body.notas } : {}),
      },
    });

    return NextResponse.json({ contrato });
  } catch (error) {
    console.error('Error updating contrato:', error);
    return NextResponse.json({ error: 'Error al actualizar contrato' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await db.contrato.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting contrato:', error);
    return NextResponse.json({ error: 'Error al eliminar contrato' }, { status: 500 });
  }
}
