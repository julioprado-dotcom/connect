/**
 * DECODEX v0.8.0 — Inyector de Indicadores
 * Motor ONION200 — Equipo B
 *
 * Funciones para obtener indicadores por eje tematico,
 * formatearlos para inyeccion en prompts de la IA
 * y calcular tendencias.
 */

import db from '@/lib/db';
import { type IndicadorFormateado, type IndicadorConStats, type IndicadorProtocol } from '@/types/bulletin';

// ============================================
// Obtencion de Indicadores
// ============================================

/**
 * Obtiene los indicadores mas recientes para un eje tematico.
 * @param slug - Slug del eje tematico
 * @returns Lista de indicadores formateados
 */
export async function getIndicadoresParaEje(
  slug: string
): Promise<IndicadorFormateado[]> {
  try {
    const indicadores = await db.indicador.findMany({
      where: {
        ejesTematicos: { contains: slug },
        activo: true,
      },
      include: {
        IndicadorValor: {
          orderBy: { fecha: 'desc' },
          take: 2,
        },
      },
    });

    return indicadores.map((ind) => {
      const ultimo = ind.IndicadorValor[0];
      const anterior = ind.IndicadorValor[1];
      const tendencia = calcularTendencia(
        ultimo?.valor,
        anterior?.valor
      );

      return {
        nombre: ind.nombre,
        valor: ultimo ? `${ultimo.valor} ${ind.unidad ?? ''}`.trim() : 'N/D',
        tendencia,
        unidad: ind.unidad,
      };
    });
  } catch (error) {
    console.error('[indicadores-injector] Error obteniendo indicadores para eje:', slug, error);
    return [];
  }
}

/**
 * Obtiene indicadores para multiples ejes tematicos.
 * @param slugs - Lista de slugs de ejes
 * @returns Record con indicadores por eje
 */
export async function getIndicadoresParaEjes(
  slugs: string[]
): Promise<Record<string, IndicadorFormateado[]>> {
  const result: Record<string, IndicadorFormateado[]> = {};

  const promises = slugs.map(async (slug) => {
    result[slug] = await getIndicadoresParaEje(slug);
  });

  await Promise.all(promises);
  return result;
}

// ============================================
// Formateo para Prompts
// ============================================

/**
 * Formatea una lista de indicadores como texto para inyeccion en prompts.
 * @param indicadores - Lista de indicadores formateados
 * @param tituloEje - Titulo del eje tematico (opcional)
 */
export function formatearIndicadoresPrompt(
  indicadores: IndicadorFormateado[],
  tituloEje?: string
): string {
  if (indicadores.length === 0) {
    return 'No hay indicadores disponibles para este periodo.';
  }

  const header = tituloEje ? `## Indicadores: ${tituloEje}\n` : '## Indicadores\n';
  const lines = indicadores.map((ind) => {
    const trendEmoji = getTrendSymbol(ind.tendencia);
    return `- ${ind.nombre}: ${ind.valor} ${trendEmoji} (${ind.tendencia})`;
  });

  return header + lines.join('\n');
}

/**
 * Formatea indicadores de multiples ejes para un solo prompt.
 * @param indicadoresPorEje - Record con indicadores por eje
 */
export function formatearIndicadoresMultiplesPrompt(
  indicadoresPorEje: Record<string, IndicadorFormateado[]>
): string {
  const secciones = Object.entries(indicadoresPorEje)
    .filter(([, inds]) => inds.length > 0)
    .map(([slug, inds]) => formatearIndicadoresPrompt(inds, slug));

  if (secciones.length === 0) {
    return 'No hay indicadores disponibles para los ejes consultados.';
  }

  return '## Indicadores por Eje Tematico\n\n' + secciones.join('\n\n');
}

// ============================================
// Funciones Auxiliares
// ============================================

/**
 * Calcula la tendencia comparando valor actual vs anterior.
 */
function calcularTendencia(
  actual?: number,
  anterior?: number
): 'ascendente' | 'descendente' | 'estable' {
  if (actual === undefined || anterior === undefined) return 'estable';

  const diff = actual - anterior;
  const threshold = anterior * 0.02; // 2% de variacion minima

  if (diff > threshold) return 'ascendente';
  if (diff < -threshold) return 'descendente';
  return 'estable';
}

/**
 * Obtiene el simbolo visual de tendencia.
 */
function getTrendSymbol(tendencia: string): string {
  switch (tendencia) {
    case 'ascendente': return '↑';
    case 'descendente': return '↓';
    default: return '→';
  }
}

// ============================================
// Protocolo de Indicadores con Estadísticas
// ============================================

/**
 * Obtiene indicadores con estadísticas (actual, promedio, max, min, % variación)
 * para inyección en prompts según el protocolo del producto.
 */
export async function getIndicadoresConStats(
  options: IndicadorProtocol
): Promise<IndicadorConStats[]> {
  if (!options.activo || options.formato === 'ninguno') return [];

  try {
    const fechaLimite = new Date();
    fechaLimite.setDate(fechaLimite.getDate() - options.dias);

    const whereClause: any = {
      activo: true,
      ...(options.categorias.length > 0
        ? { categoria: { in: options.categorias } }
        : {}),
    };

    const indicadores = await db.indicador.findMany({
      where: whereClause,
      include: {
        IndicadorValor: {
          where: { fecha: { gte: fechaLimite } },
          orderBy: { fecha: 'desc' },
        },
      },
    });

    const stats = indicadores
      .map((ind): IndicadorConStats | null => {
        const valores = ind.IndicadorValor.map((v) => v.valor as number).filter((v) => v != null && !isNaN(v));
        if (valores.length === 0) return null;

        const actual = valores[0];
        const promedio = valores.reduce((a, b) => a + b, 0) / valores.length;
        const maximo = Math.max(...valores);
        const minimo = Math.min(...valores);
        const variacionPercent = valores.length >= 2
          ? ((actual - valores[valores.length - 1]) / (valores[valores.length - 1] || 1)) * 100
          : 0;
        const disAnalisis = valores.length >= 2
          ? Math.sqrt(valores.reduce((sum, v) => sum + (v - promedio) ** 2, 0) / (valores.length - 1))
          : 0;
        const tendencia = calcularTendencia(actual, valores.length >= 2 ? valores[1] : undefined);
        const fechaActual = ind.IndicadorValor[0]?.fecha?.toISOString().split('T')[0] ?? '';
        const formato = ind.formatoNumero ?? 2;

        return {
          nombre: ind.nombre,
          valor: `${actual.toFixed(formato)} ${ind.unidad ?? ''}`.trim(),
          tendencia,
          unidad: ind.unidad,
          slug: ind.slug,
          categoria: ind.categoria,
          actual,
          promedio,
          maximo,
          minimo,
          variacionPercent,
          disAnalisis,
          fechaActual,
        };
      })
      .filter((s): s is IndicadorConStats => s !== null) as IndicadorConStats[];

    // Ordenar según estrategia
    if (options.ordenar === 'variacion') {
      stats.sort((a, b) => b.variacionPercent - a.variacionPercent);
    } else if (options.ordenar === 'absVariacion') {
      stats.sort((a, b) => Math.abs(b.variacionPercent) - Math.abs(a.variacionPercent));
    } else if (options.ordenar === 'categoria') {
      stats.sort((a, b) => a.categoria.localeCompare(b.categoria));
    }

    return stats.slice(0, options.take);
  } catch (error) {
    console.error('[indicadores-injector] Error en getIndicadoresConStats:', error);
    return [];
  }
}

/**
 * Formatea indicadores con estadísticas para inyección en prompts.
 * Formato compacto: 1 línea por indicador con valor actual + % variación.
 * Formato detallado: tarjeta-style con ACTUAL|PROMEDIO|MAX|MIN|Variación agrupados por categoría.
 */
export function formatearIndicadoresConStatsPrompt(
  indicadores: IndicadorConStats[],
  titulo: string = 'Indicadores ONION200',
  opciones?: { formato?: IndicadorProtocol['formato'] }
): string {
  if (!indicadores || indicadores.length === 0) {
    return '';
  }

  const formato = opciones?.formato ?? 'compacto';

  if (formato === 'compacto') {
    const lines = indicadores.map((ind) => {
      const trendSymbol = getTrendSymbol(ind.tendencia);
      const variacionSign = ind.variacionPercent >= 0 ? '+' : '';
      return `- ${ind.nombre}: ${ind.valor} (${variacionSign}${ind.variacionPercent.toFixed(2)}%) ${trendSymbol}`;
    });
    return `## ${titulo}\n${lines.join('\n')}`;
  }

  if (formato === 'por_categoria' || formato === 'detallado') {
    // Agrupar por categoría
    const grouped = new Map<string, IndicadorConStats[]>();
    for (const ind of indicadores) {
      const cat = ind.categoria;
      if (!grouped.has(cat)) grouped.set(cat, []);
      grouped.get(cat)!.push(ind);
    }

    const secciones = [...grouped.entries()].map(([categoria, inds]) => {
      const header = `\n### ${categoria.toUpperCase()} (${inds.length})\n`;
      const lines = inds.map((ind) => {
        const fmt = (n: number) => n.toFixed(2);
        const variacionSign = ind.variacionPercent >= 0 ? '+' : '';
        const trendSymbol = getTrendSymbol(ind.tendencia);
        return `**${ind.nombre}**: ACTUAL ${fmt(ind.actual)} ${ind.unidad ?? ''} | PROMEDIO ${fmt(ind.promedio)} | MAX ${fmt(ind.maximo)} | MIN ${fmt(ind.minimo)} | Variación ${variacionSign}${ind.variacionPercent.toFixed(2)}% ${trendSymbol} (fecha: ${ind.fechaActual})`;
      });
      return header + lines.join('\n');
    });

    return `## ${titulo}\n${secciones.join('\n')}`;
  }

  return '';
}
