/**
 * /api/dashboard/nota-raw — NotaRaw pipeline status
 *
 * Returns pending count, processed today, total, and last 5 processed.
 * Used by CommandCenter to show the NotaRaw → batch LLM → Menciones pipeline.
 *
 * BLINDAJE: NUNCA devuelve HTTP 500. Si falla, devuelve datos degradados con status 200.
 */
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { boliviaStartOfDay } from '@/lib/date-bolivia';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const startOfDay = boliviaStartOfDay();

    const [pendientes, procesadasHoy, total, ultimasProcesadas] = await Promise.all([
      db.notaRaw.count({ where: { procesada: false, descartada: false } }),
      db.notaRaw.count({
        where: {
          procesada: true,
          fechaProcesada: { gte: startOfDay },
        },
      }),
      db.notaRaw.count(),
      db.notaRaw.findMany({
        where: { procesada: true },
        orderBy: { fechaProcesada: 'desc' },
        take: 5,
        select: {
          id: true,
          titulo: true,
          mencionesCreadas: true,
          puntajeTriaje: true,
          fechaCaptura: true,
          fechaProcesada: true,
          medioId: true,
        },
      }),
    ]);

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      pendientes,
      procesadasHoy,
      total,
      ultimasProcesadas: ultimasProcesadas.map((nr) => ({
        id: nr.id,
        titulo: nr.titulo || '(sin titulo)',
        mencionesCreadas: nr.mencionesCreadas,
        puntajeTriaje: nr.puntajeTriaje,
        fechaCaptura: nr.fechaCaptura.toISOString(),
        fechaProcesada: nr.fechaProcesada?.toISOString() ?? null,
        medioId: nr.medioId,
      })),
    });
  } catch (error) {
    console.error('[/api/dashboard/nota-raw] Error (returning degraded):', error);
    return NextResponse.json(
      {
        timestamp: new Date().toISOString(),
        pendientes: 0,
        procesadasHoy: 0,
        total: 0,
        ultimasProcesadas: [],
        status: 'degraded',
        message: 'Metricas de NotaRaw no disponibles temporalmente',
      },
      { status: 200 }
    );
  }
}
