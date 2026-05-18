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
    const ambito = searchParams.get('ambito');

    const where: Record<string, unknown> = {};
    if (categoria && CATEGORIAS_VALIDAS.includes(categoria)) where.categoria = categoria;
    if (nivel) where.nivel = nivel;
    if (tipo) where.tipo = tipo;
    if (departamento) where.departamento = departamento;
    if (activo !== null && activo !== undefined) where.activo = activo === 'true';
    if (ambito) where.ambito = ambito;

    // Sorting
    const sortBy = searchParams.get('sortBy');
    let orderBy: any = [{ categoria: 'asc' }, { nombre: 'asc' }];
    if (sortBy === 'peso') {
      orderBy = [{ pesoInformativo: 'desc' as const }, { nombre: 'asc' as const }];
    }

    // Lightweight query — no groupBy
    const medios = await db.medio.findMany({
      where,
      orderBy,
    });

    // Count menciones per medio using simple count queries (not groupBy)
    // Batch: count total menciones grouped by medioId using a single raw query
    const mediosIds = medios.map(m => m.id);
    let conteoMap = new Map<string, number>();

    if (mediosIds.length > 0) {
      try {
        // Use raw SQL for efficient counting — groupBy in raw SQL is fine on SQLite
        const conteosRaw = await db.$queryRaw<Array<{ medioId: string; _count: number }>>(
          `SELECT medioId, COUNT(*) as _count FROM Mencion WHERE medioId IN (${mediosIds.map(() => '?').join(',')}) GROUP BY medioId`,
          ...mediosIds
        );
        conteoMap = new Map(conteosRaw.map(c => [c.medioId, c._count]));
      } catch {
        // Fallback: skip mention counts if query fails
        console.warn('[medios] Could not count menciones, skipping');
      }
    }

    const mediosConConteo = medios.map((medio) => ({
      ...medio,
      mencionesCount: conteoMap.get(medio.id) || 0,
    }));

    // Simple category summary using the already-fetched medios
    const categoriaLabels: Record<string, string> = {
      oficial: 'Medios Oficiales',
      corporativo: 'Corporativos',
      regional: 'Regionales',
      alternativo: 'Alternativos',
      red_social: 'Redes Sociales',
    };

    const conteosPorCategoria = new Map<string, number>();
    for (const medio of medios) {
      const cat = medio.categoria || 'otro';
      conteosPorCategoria.set(cat, (conteosPorCategoria.get(cat) || 0) + 1);
    }

    const resumenPorCategoria = CATEGORIAS_VALIDAS.map((c) => ({
      categoria: c,
      etiqueta: categoriaLabels[c] || c,
      totalMedios: conteosPorCategoria.get(c) || 0,
      mencionesCount: 0, // Omit heavy mention counting for categories
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
    const { nombre, url, tipo, categoria, nivel, departamento, plataformas, notas, pais, naturaleza, ambito, enfoque, credibilidad } = parsed.body;

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
        naturaleza: naturaleza || 'PRIVADO',
        ambito: ambito || 'NACIONAL',
        enfoque: enfoque || 'GENERALISTA',
        credibilidad: credibilidad || 50,
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
          activo: false,
          estado: 'validando',
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
