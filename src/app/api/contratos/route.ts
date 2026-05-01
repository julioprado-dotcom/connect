import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const clienteId = searchParams.get('clienteId') || '';
    const estado = searchParams.get('estado') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const where: Record<string, unknown> = {};
    if (clienteId) where.clienteId = clienteId;
    if (estado) where.estado = estado;

    const [contratos, total] = await Promise.all([
      db.contrato.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { fechaCreacion: 'desc' },
        include: {
          cliente: { select: { id: true, nombre: true, email: true, plan: true } },
        },
      }),
      db.contrato.count({ where }),
    ]);

    // Enriquecer con nombres de medios y parlamentarios
    const enriched = await Promise.all(
      contratos.map(async (c) => {
        let mediosList: Array<{ id: string; nombre: string; activo: boolean }> = [];
        let parlList: Array<{ id: string; nombre: string; camara: string }> = [];

        try {
          const mIds = JSON.parse(c.mediosAsignados || '[]');
          if (Array.isArray(mIds) && mIds.length > 0) {
            mediosList = await db.medio.findMany({
              where: { id: { in: mIds } },
              select: { id: true, nombre: true, activo: true },
            });
          }
        } catch { /* parse error */ }

        try {
          const pIds = JSON.parse(c.parlamentarios || '[]');
          if (Array.isArray(pIds) && pIds.length > 0) {
            parlList = await db.persona.findMany({
              where: { id: { in: pIds } },
              select: { id: true, nombre: true, camara: true },
            });
          }
        } catch { /* parse error */ }

        return {
          ...c,
          mediosList,
          mediosCount: mediosList.length,
          parlamentariosList: parlList,
          parlamentariosCount: parlList.length,
        };
      })
    );

    return NextResponse.json({ contratos: enriched, total, page, limit });
  } catch (error) {
    console.error('Error fetching contratos:', error);
    return NextResponse.json({ error: 'Error al obtener contratos' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      clienteId, tipoProducto, mediosAsignados, ejesTematicos,
      parlamentarios, frecuencia, formatoEntrega, fechaInicio,
      fechaFin, montoMensual, moneda, estado, notas,
    } = body;

    if (!clienteId || !tipoProducto || !fechaInicio) {
      return NextResponse.json({ error: 'Cliente, tipo de producto y fecha inicio son obligatorios' }, { status: 400 });
    }

    // Verificar que el cliente existe
    const cliente = await db.cliente.findUnique({ where: { id: clienteId } });
    if (!cliente) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    }

    const contrato = await db.contrato.create({
      data: {
        clienteId,
        tipoProducto,
        mediosAsignados: Array.isArray(mediosAsignados) ? JSON.stringify(mediosAsignados) : (mediosAsignados || '[]'),
        ejesTematicos: Array.isArray(ejesTematicos) ? JSON.stringify(ejesTematicos) : (ejesTematicos || '[]'),
        parlamentarios: Array.isArray(parlamentarios) ? JSON.stringify(parlamentarios) : (parlamentarios || '[]'),
        frecuencia: frecuencia || 'diario',
        formatoEntrega: formatoEntrega || 'whatsapp',
        fechaInicio: new Date(fechaInicio),
        fechaFin: fechaFin ? new Date(fechaFin) : null,
        montoMensual: montoMensual || 0,
        moneda: moneda || 'Bs',
        estado: estado || 'activo',
        notas: notas || '',
      },
    });

    return NextResponse.json({ contrato }, { status: 201 });
  } catch (error) {
    console.error('Error creating contrato:', error);
    return NextResponse.json({ error: 'Error al crear contrato' }, { status: 500 });
  }
}
