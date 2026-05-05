import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { contratoCreateSchema } from '@/lib/validations';
import { guardedParse, RATE } from '@/lib/rate-guard';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const clienteId = searchParams.get('clienteId') || '';
    const estado = searchParams.get('estado') || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));

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

    // Batch enrichment — collect ALL IDs, single queries each
    const allMedioIds = new Set<string>();
    const allPersonaIds = new Set<string>();
    const contratoMedioIds = new Map<string, string[]>();
    const contratoPersonaIds = new Map<string, string[]>();

    for (const c of contratos) {
      try {
        const mIds: string[] = JSON.parse(c.mediosAsignados || '[]');
        if (Array.isArray(mIds) && mIds.length > 0) {
          contratoMedioIds.set(c.id, mIds);
          for (const id of mIds) allMedioIds.add(id);
        }
      } catch { /* parse error */ }
      try {
        const pIds: string[] = JSON.parse(c.parlamentarios || '[]');
        if (Array.isArray(pIds) && pIds.length > 0) {
          contratoPersonaIds.set(c.id, pIds);
          for (const id of pIds) allPersonaIds.add(id);
        }
      } catch { /* parse error */ }
    }

    // 2 queries total instead of N×2
    const [allMedios, allPersonas] = await Promise.all([
      allMedioIds.size > 0
        ? db.medio.findMany({ where: { id: { in: [...allMedioIds] } }, select: { id: true, nombre: true, activo: true } })
        : Promise.resolve([]),
      allPersonaIds.size > 0
        ? db.persona.findMany({ where: { id: { in: [...allPersonaIds] } }, select: { id: true, nombre: true, camara: true } })
        : Promise.resolve([]),
    ]);

    const medioMap = new Map(allMedios.map((m) => [m.id, m]));
    const personaMap = new Map(allPersonas.map((p) => [p.id, p]));

    const enriched = contratos.map((c) => {
      const mIds = contratoMedioIds.get(c.id) || [];
      const pIds = contratoPersonaIds.get(c.id) || [];
      const mediosList = mIds.map((id) => medioMap.get(id)).filter(Boolean) as Array<{ id: string; nombre: string; activo: boolean }>;
      const parlList = pIds.map((id) => personaMap.get(id)).filter(Boolean) as Array<{ id: string; nombre: string; camara: string }>;

      return {
        ...c,
        mediosList,
        mediosCount: mediosList.length,
        parlamentariosList: parlList,
        parlamentariosCount: parlList.length,
      };
    });

    return NextResponse.json({ contratos: enriched, total, page, limit });
  } catch (error) {
    console.error('Error fetching contratos:', error);
    return NextResponse.json({ error: 'Error al obtener contratos' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const parsed = await guardedParse(request, contratoCreateSchema, RATE.WRITE);
    if (parsed instanceof NextResponse) return parsed;
    const body = parsed.body;

    const {
      clienteId, tipoProducto, mediosAsignados, ejesTematicos,
      parlamentarios, frecuencia, formatoEntrega, fechaInicio,
      fechaFin, montoMensual, moneda, estado, notas,
    } = body;

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
