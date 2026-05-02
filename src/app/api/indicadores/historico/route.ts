/**
 * API: Indicadores con profundidad histórica
 * GET /api/indicadores/historico?periodo=7d&categoria=monetario&slug=tc_oficial
 *
 * Soporta:
 * - Filtro por período (7d, 30d, 90d, 1y)
 * - Filtro por categoría (monetario, minero, social)
 * - Filtro por slug individual
 * - Historial de valores con variación
 * - Estadísticas (min, max, promedio, tendencia)
 */
import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const periodo = searchParams.get('periodo') || '30d';
    const categoria = searchParams.get('categoria') || '';
    const slug = searchParams.get('slug') || '';
    const incluirInactivos = searchParams.get('incluirInactivos') === 'true';

    // Calcular ventana de tiempo
    const ahora = new Date();
    const fechaInicio = new Date();
    switch (periodo) {
      case '7d': fechaInicio.setDate(fechaInicio.getDate() - 7); break;
      case '30d': fechaInicio.setDate(fechaInicio.getDate() - 30); break;
      case '90d': fechaInicio.setDate(fechaInicio.getDate() - 90); break;
      case '1y': fechaInicio.setFullYear(fechaInicio.getFullYear() - 1); break;
      default: fechaInicio.setDate(fechaInicio.getDate() - 30);
    }

    // ─── Where clause ───
    const where: Record<string, unknown> = {};
    if (categoria) where.categoria = categoria;
    if (slug) where.slug = slug;
    if (!incluirInactivos) where.activo = true;

    // ─── Obtener indicadores con historial ───
    const indicadores = await db.indicador.findMany({
      where,
      orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
      include: {
        valores: {
          where: { fechaCaptura: { gte: fechaInicio } },
          orderBy: { fechaCaptura: 'asc' },
        },
      },
    });

    // ─── Enriquecer con estadísticas ───
    const resultado = indicadores.map(ind => {
      const valores = ind.valores;
      const tieneDatos = valores.length > 0;

      if (!tieneDatos) {
        return {
          slug: ind.slug,
          nombre: ind.nombre,
          categoria: ind.categoria,
          categoriaLabel: getCatLabel(ind.categoria),
          fuente: ind.fuente,
          periodicidad: ind.periodicidad,
          unidad: ind.unidad,
          tier: ind.tier,
          activo: ind.activo,
          historial: [],
          ultimoValor: null,
          estadisticas: null,
        };
      }

      // Último valor
      const ultimo = valores[valores.length - 1];

      // Primer valor del período
      const primero = valores[0];

      // Calcular variación
      const variacion = calcularVariacion(primero.valor, ultimo.valor);

      // Estadísticas
      const rawValues = valores.map(v => v.valor).filter(v => v !== null) as number[];
      const min = Math.min(...rawValues);
      const max = Math.max(...rawValues);
      const promedio = rawValues.reduce((a, b) => a + b, 0) / rawValues.length;

      // Tendencia: comparar promedio primera mitad vs segunda mitad
      const midPoint = Math.floor(rawValues.length / 2);
      const primeraMitad = rawValues.slice(0, midPoint);
      const segundaMitad = rawValues.slice(midPoint);
      const promPrimera = primeraMitad.length > 0 ? primeraMitad.reduce((a, b) => a + b, 0) / primeraMitad.length : 0;
      const promSegunda = segundaMitad.length > 0 ? segundaMitad.reduce((a, b) => a + b, 0) / segundaMitad.length : 0;

      let tendencia: 'ascendente' | 'estable' | 'descendente' = 'estable';
      const diffPct = promPrimera > 0 ? ((promSegunda - promPrimera) / promPrimera) * 100 : 0;
      if (diffPct > 3) tendencia = 'ascendente';
      else if (diffPct < -3) tendencia = 'descendente';

      // Historial simplificado (serie temporal)
      const historial = valores.map(v => ({
        fecha: v.fechaCaptura.toISOString().slice(0, 10),
        fechaHora: v.fechaCaptura.toISOString(),
        valor: v.valorTexto,
        valorRaw: v.valor,
        confiable: v.confiable,
      }));

      return {
        slug: ind.slug,
        nombre: ind.nombre,
        categoria: ind.categoria,
        categoriaLabel: getCatLabel(ind.categoria),
        fuente: ind.fuente,
        periodicidad: ind.periodicidad,
        unidad: ind.unidad,
        tier: ind.tier,
        activo: ind.activo,
        historial,
        ultimoValor: {
          valor: ultimo.valorTexto,
          valorRaw: ultimo.valor,
          fecha: ultimo.fecha,
          confiable: ultimo.confiable,
          fechaCaptura: ultimo.fechaCaptura.toISOString(),
        },
        estadisticas: {
          periodo,
          puntos: valores.length,
          min: Number(min.toFixed(4)),
          max: Number(max.toFixed(4)),
          promedio: Number(promedio.toFixed(4)),
          variacionPeriodo: variacion,
          tendencia,
          diffPct: Number(diffPct.toFixed(1)),
        },
      };
    });

    // ─── Resumen por categoría ───
    const porCategoria = new Map<string, { total: number; conDatos: number }>();
    for (const r of resultado) {
      if (!porCategoria.has(r.categoria)) {
        porCategoria.set(r.categoria, { total: 0, conDatos: 0 });
      }
      const cat = porCategoria.get(r.categoria)!;
      cat.total++;
      if (r.ultimoValor) cat.conDatos++;
    }

    return NextResponse.json({
      periodo,
      fechaInicio: fechaInicio.toISOString(),
      fechaFin: ahora.toISOString(),
      totalIndicadores: resultado.length,
      conDatos: resultado.filter(r => r.ultimoValor !== null).length,
      porCategoria: Object.fromEntries(porCategoria),
      indicadores: resultado,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: 'Error al cargar indicadores', details: message }, { status: 500 });
  }
}

function getCatLabel(cat: string): string {
  const labels: Record<string, string> = {
    monetario: 'Monetario',
    minero: 'Minero',
    climatico: 'Climático',
    economico: 'Económico',
    hidrocarburos: 'Hidrocarburos',
    social: 'Social',
  };
  return labels[cat] || cat;
}

function calcularVariacion(primero: number | null, ultimo: number | null): string {
  if (primero === null || ultimo === null || primero === 0) return 'N/D';
  const diff = ((ultimo - primero) / primero) * 100;
  const sign = diff >= 0 ? '+' : '';
  return `${sign}${diff.toFixed(1)}%`;
}
