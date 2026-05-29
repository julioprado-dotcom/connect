import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { boliviaStartOfDay } from '@/lib/date-bolivia';

/**
 * GET /api/dashboard/ai/usage
 * Retorna estadísticas de uso de IA: tokens, costo USD, desglose por fuente y modelo.
 */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dias = parseInt(searchParams.get('dias') || '7', 10);
    const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);

    // ─── Totales generales ──────────────────────────
    const totales = await db.usoIA.aggregate({
      where: { createdAt: { gte: desde } },
      _sum: {
        promptTokens: true,
        completionTokens: true,
        totalTokens: true,
        costoUSD: true,
      },
      _count: true,
    });

    // ─── Por fuente ──────────────────────────
    const porFuente = await db.usoIA.groupBy({
      by: ['fuente'],
      where: { createdAt: { gte: desde } },
      _sum: {
        promptTokens: true,
        completionTokens: true,
        totalTokens: true,
        costoUSD: true,
      },
      _count: true,
      orderBy: { _sum: { totalTokens: 'desc' } },
    });

    // ─── Por modelo ──────────────────────────
    const porModelo = await db.usoIA.groupBy({
      by: ['modelo'],
      where: { createdAt: { gte: desde } },
      _sum: {
        promptTokens: true,
        completionTokens: true,
        totalTokens: true,
        costoUSD: true,
      },
      _count: true,
      orderBy: { _sum: { totalTokens: 'desc' } },
    });

    // ─── Por día ──────────────────────────
    const porDiaRaw = await db.$queryRaw<Array<{
      fecha: string;
      total_llamadas: number;
      total_tokens: number;
      costo_usd: number;
    }>>`
      SELECT
        date(createdAt) as fecha,
        COUNT(*) as total_llamadas,
        COALESCE(SUM(totalTokens), 0) as total_tokens,
        ROUND(COALESCE(SUM(costoUSD), 0), 6) as costo_usd
      FROM UsoIA
      WHERE createdAt >= ${desde.toISOString()}
      GROUP BY date(createdAt)
      ORDER BY fecha DESC
    `;

    // ─── Últimas 20 llamadas ──────────────────────────
    const recientes = await db.usoIA.findMany({
      where: { createdAt: { gte: desde } },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        Medio: { select: { nombre: true } },
      },
    });

    // ─── Llamadas hoy (Bolivia timezone) ──────────────────────────
    const hoyInicio = boliviaStartOfDay();

    const hoy = await db.usoIA.aggregate({
      where: { createdAt: { gte: hoyInicio } },
      _sum: {
        promptTokens: true,
        completionTokens: true,
        totalTokens: true,
        costoUSD: true,
      },
      _count: true,
    });

    return NextResponse.json({
      periodo: `${dias} días`,
      desde: desde.toISOString(),
      totales: {
        llamadas: totales._count || 0,
        promptTokens: totales._sum.promptTokens || 0,
        completionTokens: totales._sum.completionTokens || 0,
        totalTokens: totales._sum.totalTokens || 0,
        costoUSD: parseFloat((totales._sum.costoUSD || 0).toFixed(4)),
      },
      hoy: {
        llamadas: hoy._count || 0,
        totalTokens: hoy._sum.totalTokens || 0,
        costoUSD: parseFloat((hoy._sum.costoUSD || 0).toFixed(4)),
      },
      porFuente: porFuente.map(f => ({
        fuente: f.fuente,
        llamadas: f._count,
        totalTokens: f._sum.totalTokens || 0,
        costoUSD: parseFloat((f._sum.costoUSD || 0).toFixed(4)),
      })),
      porModelo: porModelo.map(m => ({
        modelo: m.modelo,
        llamadas: m._count,
        totalTokens: m._sum.totalTokens || 0,
        costoUSD: parseFloat((m._sum.costoUSD || 0).toFixed(4)),
      })),
      porDia: porDiaRaw.map(d => ({
        fecha: d.fecha,
        llamadas: d.total_llamadas,
        totalTokens: d.total_tokens,
        costoUSD: parseFloat(d.costo_usd.toString()),
      })),
      recientes: recientes.map(r => ({
        id: r.id,
        modelo: r.modelo,
        fuente: r.fuente,
        totalTokens: r.totalTokens,
        costoUSD: parseFloat(r.costoUSD.toFixed(4)),
        medio: r.Medio?.nombre || null,
        detalles: r.detalles,
        createdAt: r.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('[AI Usage] Error:', error);
    return NextResponse.json(
      { error: 'Error obteniendo estadísticas de uso IA' },
      { status: 500 }
    );
  }
}
