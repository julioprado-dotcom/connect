import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { safeError } from '@/lib/rate-guard';
import { medioCreateSchema } from '@/lib/validations';
import { guardedParse, RATE } from '@/lib/rate-guard';

const CATEGORIAS_VALIDAS = ['oficial', 'corporativo', 'regional', 'alternativo', 'red_social'];
const TIPOS_VALIDOS = [
  'agencia_noticias', 'diario', 'portal_web', 'television', 'radio', 'revista',
  'institucional', 'ente_regulador', 'tribunal', 'red_social', 'otro',
];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const categoria = searchParams.get('categoria');
    const nivel = searchParams.get('nivel');
    const tipo = searchParams.get('tipo');
    const departamento = searchParams.get('departamento');
    const activo = searchParams.get('activo');

    const where: Record<string, unknown> = {};
    if (categoria && CATEGORIAS_VALIDAS.includes(categoria)) where.categoria = categoria;
    if (nivel) where.nivel = nivel;
    if (tipo) where.tipo = tipo;
    if (departamento) where.departamento = departamento;
    if (activo !== null && activo !== undefined) where.activo = activo === 'true';

    // Fetch medios and mention counts in a single groupBy — no N+1
    const [medios, conteosRaw] = await Promise.all([
      db.medio.findMany({
        where,
        orderBy: [{ categoria: 'asc' }, { nombre: 'asc' }],
      }),
      db.mencion.groupBy({
        by: ['medioId'],
        _count: { id: true },
      }),
    ]);

    // Build O(1) lookup map for mention counts
    const conteoMap = new Map(conteosRaw.map((c) => [c.medioId, c._count.id]));

    const mediosConConteo = medios.map((medio) => ({
      ...medio,
      mencionesCount: conteoMap.get(medio.id) || 0,
    }));

    // Resumen por categoría
    const categoriaLabels: Record<string, string> = {
      oficial: 'Medios Oficiales',
      corporativo: 'Corporativos',
      regional: 'Regionales',
      alternativo: 'Alternativos',
      red_social: 'Redes Sociales',
    };

    const [mediosPorCategoria, mencionesPorMedio] = await Promise.all([
      db.medio.groupBy({
        by: ['categoria'],
        where: { activo: true },
        _count: { id: true },
      }),
      db.medio.findMany({
        where: { activo: true },
        select: { id: true, categoria: true },
      }),
    ]);

    const categoriaMap = new Map(mediosPorCategoria.map((m) => [m.categoria, m._count.id]));
    const activosIds = new Set(mencionesPorMedio.map((m) => m.id));

    // Count menciones for all active medios in a single groupBy
    const mencionesActivasRaw = activosIds.size > 0
      ? await db.mencion.groupBy({
          by: ['medioId'],
          where: { medioId: { in: [...activosIds] } },
          _count: { id: true },
        })
      : [];

    const mencionesCategoriaMap = new Map(mencionesPorMedio.map((m) => [m.id, m.categoria]));
    const conteoActivasMap = new Map(mencionesActivasRaw.map((c) => [c.medioId, c._count.id]));

    // Aggregate by category
    const conteosPorCategoria = new Map<string, number>();
    for (const [medioId, cat] of mencionesCategoriaMap) {
      const count = conteoActivasMap.get(medioId) || 0;
      conteosPorCategoria.set(cat, (conteosPorCategoria.get(cat) || 0) + count);
    }

    const resumenPorCategoria = CATEGORIAS_VALIDAS.map((c) => ({
      categoria: c,
      etiqueta: categoriaLabels[c] || c,
      totalMedios: categoriaMap.get(c) || 0,
      mencionesCount: conteosPorCategoria.get(c) || 0,
    }));

    return NextResponse.json({
      medios: mediosConConteo,
      totalMedios: medios.length,
      resumenPorCategoria,
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: safeError(error, 'medios') }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const parsed = await guardedParse(request, medioCreateSchema, RATE.WRITE);
    if (parsed instanceof NextResponse) return parsed;
    const { nombre, url, tipo, categoria, nivel, departamento, plataformas, notas, pais } = parsed.body;

    if (!TIPOS_VALIDOS.includes(tipo)) {
      return NextResponse.json({ error: `Tipo inválido. Valores: ${TIPOS_VALIDOS.join(', ')}` }, { status: 400 });
    }
    if (categoria && !CATEGORIAS_VALIDAS.includes(categoria)) {
      return NextResponse.json({ error: `Categoría inválida. Valores: ${CATEGORIAS_VALIDAS.join(', ')}` }, { status: 400 });
    }

    const medio = await db.medio.create({
      data: {
        nombre,
        url,
        tipo,
        categoria,
        nivel,
        departamento,
        plataformas,
        notas,
        pais,
        activo: true,
      },
    });

    // Auto-crear FuenteEstado para que el scheduler pueda capturar este medio
    if (medio.url) {
      const nivelNum = parseInt(medio.nivel) || 3;
      const frecuenciaMap: Record<number, string> = { 1: '30m', 2: '2h', 3: '6h' };
      const frecuenciaBase = frecuenciaMap[nivelNum] || '6h';

      await db.fuenteEstado.create({
        data: {
          medioId: medio.id,
          url: medio.url,
          activo: medio.activo,
          frecuenciaBase,
          frecuenciaActual: frecuenciaBase,
          tipoCheck: medio.tipo === 'red_social' ? 'api' : 'head',
        },
      }).catch(err => {
        console.warn(`[medios] Error creando FuenteEstado para ${medio.id}:`, err);
      });
    }

    return NextResponse.json({ medio }, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json({ error: safeError(error, 'medios') }, { status: 500 });
  }
}
