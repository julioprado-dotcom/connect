/**
 * /api/dashboard/fuentes-summary — Fuentes monitoreadas dashboard
 * Returns all FuenteEstado with layer/capacity data from lifecycle engine.
 */
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { determinarCapa, type CapaFuente } from '@/lib/jobs/source-lifecycle';
import { guardError } from '@/lib/rate-guard';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const fuentes = await db.fuenteEstado.findMany({
      include: {
        Medio: { select: { id: true, nombre: true } },
      },
      orderBy: [
        { activo: 'desc' },
        { capaActual: 'desc' },
        { Medio: { nombre: 'asc' } },
      ],
    });

    // Compute real-time capa for each fuente using lifecycle engine
    const fuentesConCapa = fuentes.map((f) => {
      const capaCalculada = determinarCapa({
        ultimoCheckOk: f.ultimoCheckOk,
        ultimoHeadline: f.ultimoHeadline,
        ultimoTexto: f.ultimoTexto,
        ultimoMencion: f.ultimoMencion,
        estado: f.estado || 'creada',
        activo: f.activo,
        fallosConsecutivos: f.fallosConsecutivos || 0,
        checksSinCambio: f.checksSinCambio,
      });

      return {
        id: f.id,
        medioId: f.medioId,
        nombre: f.Medio.nombre,
        url: f.url,
        tipoCheck: f.tipoCheck,
        estado: f.estado || 'creada',
        activo: f.activo,
        capaActual: capaCalculada as CapaFuente,
        fallosConsecutivos: f.fallosConsecutivos || 0,
        totalChecks: f.totalChecks,
        totalCambios: f.totalCambios,
        checksSinCambio: f.checksSinCambio,
        ultimoCheck: f.ultimoCheck?.toISOString() ?? null,
        ultimoCambio: f.ultimoCambio?.toISOString() ?? null,
        frecuenciaActual: f.frecuenciaActual,
        responseTime: f.responseTime,
      };
    });

    // Aggregate stats
    const total = fuentesConCapa.length;
    const activas = fuentesConCapa.filter(f => f.estado === 'activa').length;
    const inactivas = fuentesConCapa.filter(f => f.estado === 'inactiva').length;
    const degradadas = fuentesConCapa.filter(f => f.fallosConsecutivos >= 1).length;
    const deprecadas = fuentesConCapa.filter(f => f.estado === 'deprecada').length;

    const porCapa: Record<string, number> = {};
    for (const f of fuentesConCapa) {
      const key = String(f.capaActual);
      porCapa[key] = (porCapa[key] || 0) + 1;
    }

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      total,
      activas,
      inactivas,
      degradadas,
      deprecadas,
      porCapa,
      fuentes: fuentesConCapa,
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: guardError(error, 'fuentes-summary') }, { status: 500 });
  }
}
