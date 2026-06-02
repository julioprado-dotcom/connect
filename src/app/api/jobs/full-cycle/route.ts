// POST /api/jobs/full-cycle
//
// Endpoint manual para forzar un ciclo completo de procesamiento:
// 1. Check todas las fuentes (enqueua check_fuente para cada una)
// 2. (Opcional) Trigger batch_llm después
//
// Query params:
//   ?mode=check        — Solo check todas las fuentes (default)
//   ?mode=check+llm    — Check + batch_llm secuencial
//   ?mode=llm          — Solo batch_llm (procesa NotaRaw pendientes)
//   ?mode=all           — Check + LLM + Boletines
//   ?limit=N           — Máximo fuentes a checkear (default: all)
//   ?filter=activas    — Solo fuentes activas (default: all)

import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { enqueue } from '@/lib/jobs/queue';
import { guardError } from '@/lib/rate-guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode') || 'check';
    const limit = parseInt(searchParams.get('limit') || '0') || 999;
    const filter = searchParams.get('filter') || 'all';

    const results: Record<string, unknown> = {};

    // ── 1. PHASE: Check all fuentes ──
    if (mode === 'check' || mode === 'check+llm' || mode === 'all') {
      // Get all medios with FuenteEstado
      const whereClause: Record<string, unknown> = {};
      if (filter === 'activas') whereClause.activo = true;

      const medios = await db.medio.findMany({
        where: whereClause,
        select: { id: true, nombre: true, url: true, activo: true },
        orderBy: { nombre: 'asc' },
      });

      // Get FuenteEstado map
      const estados = await db.fuenteEstado.findMany({
        select: { medioId: true, estado: true, activo: true, ultimoCheck: true },
      });
      const estadoMap = new Map(estados.map(e => [e.medioId, e]));

      const mediosToCheck = medios.slice(0, limit);
      let enqueued = 0;
      let skipped = 0;
      const detalles: Array<{ nombre: string; medioId: string; razon: string }> = [];

      for (const medio of mediosToCheck) {
        const estado = estadoMap.get(medio.id);
        const hasEstado = !!estado;
        const isActive = estado?.activo === true;
        const estadoStr = (estado?.estado as string) || 'sin_estado';

        // Check if there's already a pending check for this medio
        const pendingJob = await db.job.findFirst({
          where: {
            tipo: 'check_fuente',
            estado: 'pendiente',
            payload: { contains: medio.id },
          },
        });

        if (pendingJob) {
          skipped++;
          detalles.push({ nombre: medio.nombre, medioId: medio.id, razon: 'ya tiene job pendiente' });
          continue;
        }

        // Enqueue check_fuente using the fuenteId from FuenteEstado or medioId
        const fuenteId = hasEstado ? estado.medioId : medio.id;
        try {
          await enqueue({
            tipo: 'check_fuente',
            payload: { fuenteId, medioId: medio.id },
            prioridad: medio.id === 'los-tiempos' ? 0 : 2, // P0 for Los Tiempos
            programa: 'full-cycle-manual',
          });
          enqueued++;
        } catch (err) {
          skipped++;
          detalles.push({ nombre: medio.nombre, medioId: medio.id, razon: String(err).slice(0, 60) });
        }
      }

      results.check = {
        mediosTotal: medios.length,
        seleccionados: mediosToCheck.length,
        enqueued,
        skipped,
        filter,
        detalles: detalles.slice(0, 20), // max 20 details
      };
    }

    // ── 2. PHASE: Batch LLM ──
    if (mode === 'llm' || mode === 'check+llm' || mode === 'all') {
      const pendientes = await db.notaRaw.count({
        where: { procesada: false, descartada: false },
      });

      if (pendientes > 0) {
        // Check if batch_llm already pending
        const pendingBatch = await db.job.findFirst({
          where: { tipo: 'batch_llm', estado: 'pendiente' },
        });

        if (!pendingBatch) {
          await enqueue({
            tipo: 'batch_llm',
            payload: { trigger: 'full-cycle-manual' },
            prioridad: 1,
            programa: 'full-cycle-manual',
          });
          results.llm = { enqueued: true, notasPendientes: pendientes };
        } else {
          results.llm = { enqueued: false, razon: 'batch_llm ya pendiente', notasPendientes: pendientes };
        }
      } else {
        results.llm = { enqueued: false, razon: 'sin NotaRaw pendientes' };
      }
    }

    // ── 3. PHASE: Boletines (mode=all) ──
    if (mode === 'all') {
      const mencionCount = await db.mencion.count();
      if (mencionCount > 0) {
        const productos = ['EL_TERMOMETRO', 'EL_FOCO'];
        const boletinResults: string[] = [];
        for (const tipo of productos) {
          const pendingBoletin = await db.job.findFirst({
            where: { tipo: 'generar_boletin', estado: 'pendiente', payload: { contains: tipo } },
          });
          if (!pendingBoletin) {
            await enqueue({
              tipo: 'generar_boletin',
              payload: { tipoBoletin: tipo, trigger: 'full-cycle-manual' },
              prioridad: 2,
              programa: 'full-cycle-manual',
            });
            boletinResults.push(tipo + ': enqueued');
          } else {
            boletinResults.push(tipo + ': ya pendiente');
          }
        }
        results.boletines = { mencionesDisponibles: mencionCount, productos: boletinResults };
      } else {
        results.boletines = { razon: 'sin menciones disponibles' };
      }
    }

    // ── Summary ──
    const totalJobs = await db.job.count({ where: { estado: 'pendiente' } });

    return NextResponse.json({
      ok: true,
      mode,
      timestamp: new Date().toISOString(),
      totalJobsPendientes: totalJobs,
      results,
    });
  } catch (error: unknown) {
    console.error('[API /jobs/full-cycle POST]', error);
    return NextResponse.json(
      { error: guardError(error, 'jobs/full-cycle') },
      { status: 500 },
    );
  }
}

// GET — return status of current cycle
export async function GET() {
  try {
    const totalPend = await db.job.count({ where: { estado: 'pendiente' } });
    const enProg = await db.job.count({ where: { estado: 'en_progreso' } });
    const completados = await db.job.count({ where: { estado: 'completado' } });

    const byType = await db.job.groupBy({
      by: ['tipo', 'estado'],
      where: { estado: { in: ['pendiente', 'en_progreso'] } },
      _count: { id: true },
    });

    const notaRawPend = await db.notaRaw.count({ where: { procesada: false } }).catch(() => 0);
    const menciones = await db.mencion.count();

    return NextResponse.json({
      jobs: { pendientes: totalPend, enProgreso: enProg, completadosHoy: completados },
      byType,
      notaRawPendientes: notaRawPend,
      mencionesTotal: menciones,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: guardError(error, 'jobs/full-cycle') },
      { status: 500 },
    );
  }
}
