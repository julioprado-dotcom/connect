/**
 * DECODEX v0.8.0 — Inyector de Indicadores
 * Motor ONION200 — Equipo B
 *
 * Funciones para obtener indicadores por eje tematico,
 * formatearlos para inyeccion en prompts de la IA
 * y calcular tendencias.
 */

import { db } from '@/lib/db';
import { type IndicadorFormateado } from '@/types/bulletin';

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
        valores: {
          orderBy: { fecha: 'desc' },
          take: 2,
        },
      },
    });

    return indicadores.map((ind) => {
      const ultimo = ind.valores[0];
      const anterior = ind.valores[1];
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
