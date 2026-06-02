/**
 * /api/dashboard/nota-raw — Estado del pipeline NotaRaw
 *
 * El pipeline E v2 funciona así:
 *   check_fuente → scrape_fuente_light → NotaRaw (sin LLM) → batch_llm → Menciones
 *
 * Este endpoint expone el estado de la cola intermedia NotaRaw:
 *   - Cuántas notas pendientes de procesar por batch_llm
 *   - Cuántas procesadas hoy
 *   - Total en BD
 *   - Últimas notas procesadas
 */
import { NextResponse } from 'next/server';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const hoyBo = boStartOfDay();

    // Consultas en paralelo
    const [
      total,
      pendientes,
      procesadas,
      procesadasHoy,
      descartadas,
      capturadasHoy,
      ultimasProcesadas,
    ] = await Promise.all([
      db.notaRaw.count(),
      db.notaRaw.count({ where: { procesada: false, descartada: false } }),
      db.notaRaw.count({ where: { procesada: true } }),
      db.notaRaw.count({
        where: { procesada: true, fechaProcesada: { gte: hoyBo } },
      }),
      db.notaRaw.count({ where: { descartada: true } }),
      db.notaRaw.count({
        where: { fechaCaptura: { gte: hoyBo } },
      }),
      db.notaRaw.findMany({
        where: { procesada: true },
        orderBy: { fechaProcesada: 'desc' },
        take: 8,
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
      pendientes,
      procesadasHoy,
      total,
      capturadasHoy,
      procesadasTotal: procesadas,
      descartadas,
      ultimasProcesadas: ultimasProcesadas.map(n => ({
        ...n,
        fechaCaptura: n.fechaCaptura.toISOString(),
        fechaProcesada: n.fechaProcesada?.toISOString() ?? null,
      })),
    });
  } catch (error: unknown) {
    console.error('[nota-raw] Error:', error);
    return NextResponse.json(
      { pendientes: 0, procesadasHoy: 0, total: 0, ultimasProcesadas: [], error: 'Error al consultar NotaRaw' },
      { status: 500 }
    );
  }
}

// ─── Helper: medianoche Bolivia (America/La_Paz = UTC-4) ──────
function boStartOfDay(): Date {
  const now = new Date();
  // Si el servidor ya está en America/La_Paz, setHours(0,0,0,0)
  // da medianoche Bolivia directamente. Pero usamos Intl como
  // safeguard por si el timezone del runtime cambia.
  const offsetMin = now.getTimezoneOffset(); // positivo = detrás de UTC
  const boOffset = 4 * 60; // Bolivia = UTC-4 → offsetMin debería ser ~240
  // Si el servidor NO está en Bolivia (offset != 240), corregir:
  const diffMin = offsetMin - boOffset;
  const boMidnight = new Date(now);
  boMidnight.setHours(0, 0, 0, 0);
  if (Math.abs(diffMin) > 30) {
    // Servidor en otro timezone — ajustar a medianoche Bolivia
    boMidnight.setTime(boMidnight.getTime() + diffMin * 60000);
  }
  return boMidnight;
}
