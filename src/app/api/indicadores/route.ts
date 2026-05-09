import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { safeError } from '@/lib/rate-guard';

// GET /api/indicadores — Listar indicadores (con filtros)
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const categoria = searchParams.get('categoria') || '';
    const tipo = searchParams.get('tipo') || '';
    const activo = searchParams.get('activo') || '';

    const where: Record<string, unknown> = {};
    if (categoria) where.categoria = categoria;
    if (tipo) where.tipo = tipo;
    if (activo !== '') where.activo = activo === 'true';

    const indicadores = await db.indicador.findMany({
      where,
      orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
      include: {
        _count: { select: { valores: true, evaluaciones: true } },
      },
    });

    // Para cada indicador, obtener su ultimo valor o ultima evaluacion
    const enriched = await Promise.all(
      indicadores.map(async (ind) => {
        let ultimoValor = null;
        let ultimaEvaluacion = null;

        if (ind.tipo === 'cuantitativo') {
          const uv = await db.indicadorValor.findFirst({
            where: { indicadorId: ind.id },
            orderBy: { fechaCaptura: 'desc' },
          });
          if (uv) {
            ultimoValor = {
              valor: uv.valorTexto || uv.valor.toFixed(ind.formatoNumero),
              valorRaw: uv.valor,
              fecha: uv.fecha.toISOString().split('T')[0],
              confiable: uv.confiable,
              fechaCaptura: uv.fechaCaptura.toISOString(),
            };
          }
        } else {
          const ue = await db.indicadorEvaluacion.findFirst({
            where: { indicadorId: ind.id },
            orderBy: { fechaEvaluacion: 'desc' },
          });
          if (ue) {
            ultimaEvaluacion = {
              id: ue.id,
              valorCompuesto: ue.valorCompuesto,
              valorTexto: ue.valorTexto,
              escalaNivel: ue.escalaNivel,
              puntuaciones: ue.puntuaciones,
              fechaEvaluacion: ue.fechaEvaluacion.toISOString(),
              evaluador: ue.evaluador,
              confiable: ue.confiable,
            };
          }
        }

        return {
          ...ind,
          ultimoValor,
          ultimaEvaluacion,
          totalValores: ind._count.valores,
          totalEvaluaciones: ind._count.evaluaciones,
        };
      })
    );

    return NextResponse.json({ indicadores: enriched, total: enriched.length });
  } catch (error) {
    console.error('Error fetching indicadores:', error);
    return NextResponse.json({ error: 'Error al obtener indicadores' }, { status: 500 });
  }
}

// POST /api/indicadores — Crear nuevo indicador
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.nombre || !body.slug) {
      return NextResponse.json({ error: 'Nombre y slug son obligatorios' }, { status: 400 });
    }

    // Verificar slug unico
    const exists = await db.indicador.findUnique({ where: { slug: body.slug } });
    if (exists) {
      return NextResponse.json({ error: 'Ya existe un indicador con ese slug' }, { status: 409 });
    }

    const indicador = await db.indicador.create({
      data: {
        nombre: body.nombre.trim(),
        slug: body.slug.trim().toLowerCase().replace(/\s+/g, '-'),
        categoria: body.categoria || 'economico',
        tipo: body.tipo || 'cuantitativo',
        fuente: body.fuente || '',
        url: body.url || '',
        periodicidad: body.periodicidad || 'diaria',
        unidad: body.unidad || '',
        formatoNumero: body.formatoNumero || 2,
        activo: body.activo !== undefined ? body.activo : true,
        orden: body.orden || 0,
        ejesTematicos: body.ejesTematicos || '',
        tier: body.tier || 1,
        notas: body.notas || '',
        metodologia: body.metodologia || '',
        variables: Array.isArray(body.variables) ? JSON.stringify(body.variables) : (body.variables || '[]'),
        escalaMin: body.escalaMin ?? 0,
        escalaMax: body.escalaMax ?? 10,
      },
    });

    return NextResponse.json({ indicador }, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json({ error: safeError(error, 'indicadores') }, { status: 500 });
  }
}
