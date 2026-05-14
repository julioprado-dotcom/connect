/**
 * /api/dashboard/clasificacion — Clasificación REAL
 * Datos derivados de Mencion, MencionTema, MencionLente, EjeTematico.
 * Muestra cobertura real de clasificación.
 */
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { safeError } from '@/lib/rate-guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const totalMenciones = await db.mencion.count({ where: { esDuplicado: false } });

    // ── Menciones con tratamiento periodístico asignado ─────
    const clasificadas = await db.mencion.count({
      where: { esDuplicado: false, tratamientoPeriodistico: { not: null } },
    });
    const sinClasificar = totalMenciones - clasificadas;

    // ── Distribución por tratamiento periodístico ──────────
    const porTratamiento = await db.mencion.groupBy({
      by: ['tratamientoPeriodistico'],
      where: { esDuplicado: false },
      _count: { id: true },
    });

    const distribucionTratamiento: Array<{ tratamiento: string; count: number }> = porTratamiento.map(g => ({
      tratamiento: g.tratamientoPeriodistico || 'sin clasificar',
      count: g._count.id,
    }));

    // ── Ejes temáticos con menciones reales ─────────────────
    let ejes: Array<{
      id: string;
      nombre: string;
      slug: string;
      menciones: number;
      porcentaje: number;
    }> = [];

    try {
      // Usar MencionTema para contar menciones por eje (más preciso que la relación directa Mencion→EjeTematico)
      const mencionesPorEje = await db.mencionTema.groupBy({
        by: ['ejeTematicoId'],
        _count: { id: true },
      });

      const ejeIds = mencionesPorEje.map(g => g.ejeTematicoId);
      const ejesMap = new Map<string, { id: string; nombre: string; slug: string }>();

      if (ejeIds.length > 0) {
        const ejesData = await db.ejeTematico.findMany({
          where: { id: { in: ejeIds }, activo: true },
          select: { id: true, nombre: true, slug: true },
        });
        for (const e of ejesData) ejesMap.set(e.id, e);
      }

      // Ordenar por cantidad descendente
      const sorted = [...mencionesPorEje].sort((a, b) => b._count.id - a._count.id);

      ejes = sorted.map(g => {
        const info = ejesMap.get(g.ejeTematicoId);
        if (!info) return null;
        const porcentaje = totalMenciones > 0 ? Math.round((g._count.id / totalMenciones) * 100) : 0;
        return {
          id: g.ejeTematicoId,
          nombre: info.nombre,
          slug: info.slug,
          menciones: g._count.id,
          porcentaje,
        };
      }).filter(Boolean).slice(0, 15);
    } catch {
      console.log('[API /dashboard/clasificacion] Ejes query failed');
    }

    // ── Lentes con menciones clasificadas ──────────────────
    let lentes: Array<{
      id: string;
      nombre: string;
      slug: string;
      clasificadas: number;
      porcentaje: number;
    }> = [];

    try {
      const mencionesPorLente = await db.mencionLente.groupBy({
        by: ['lenteId'],
        _count: { id: true },
      });

      const lenteIds = mencionesPorLente.map(g => g.lenteId);
      const lentesMap = new Map<string, { id: string; nombre: string; slug: string }>();

      if (lenteIds.length > 0) {
        const lentesData = await db.lente.findMany({
          where: { id: { in: lenteIds }, activo: true },
          select: { id: true, nombre: true, slug: true },
        });
        for (const l of lentesData) lentesMap.set(l.id, l);
      }

      const sortedLentes = [...mencionesPorLente].sort((a, b) => b._count.id - a._count.id);

      lentes = sortedLentes.map(g => {
        const info = lentesMap.get(g.lenteId);
        if (!info) return null;
        const porcentaje = totalMenciones > 0 ? Math.round((g._count.id / totalMenciones) * 100) : 0;
        return {
          id: g.lenteId,
          nombre: info.nombre,
          slug: info.slug,
          clasificadas: g._count.id,
          porcentaje,
        };
      }).filter(Boolean).slice(0, 10);
    } catch {
      console.log('[API /dashboard/clasificacion] Lentes query failed');
    }

    // ── Menciones sin clasificar (lista para UI) ─────────
    let pendientesList: Array<{
      id: string;
      titulo: string;
      medioNombre: string;
      fechaCaptura: string;
    }> = [];

    try {
      const pendientesData = await db.mencion.findMany({
        where: {
          tratamientoPeriodistico: null,
          esDuplicado: false,
        },
        include: {
          Medio: { select: { nombre: true } },
        },
        orderBy: { fechaCaptura: 'desc' },
        take: 20,
        select: {
          id: true,
          titulo: true,
          fechaCaptura: true,
        },
      });

      pendientesList = pendientesData.map(m => ({
        id: m.id,
        titulo: m.titulo || 'Sin título',
        medioNombre: m.Medio?.nombre || 'Desconocido',
        fechaCaptura: m.fechaCaptura.toISOString(),
      }));
    } catch {
      console.log('[API /dashboard/clasificacion] Pendientes query failed');
    }

    // ── Menciones con sentimiento asignado ─────────────────
    const conSentimiento = await db.mencion.count({
      where: { esDuplicado: false, sentimiento: { not: null } },
    });

    const conIntencionMedio = await db.mencion.count({
      where: { esDuplicado: false, intencionMedio: { not: null } },
    });

    return NextResponse.json({
      // ── KPIs principales ───────────────────────────────
      totalMenciones,
      clasificadas,
      sinClasificar,
      porcentajeCobertura: totalMenciones > 0
        ? Math.round((clasificadas / totalMenciones) * 100)
        : 0,

      // ── Distribución por tratamiento ─────────────────────
      distribucionTratamiento,

      // ── Ejes temáticos ───────────────────────────────────
      ejes,
      totalEjesActivos: ejes.length,

      // ── Lentes ───────────────────────────────────────────
      lentes,
      totalLentesActivos: lentes.length,

      // ── Pendientes ───────────────────────────────────────
      pendientes: sinClasificar,
      pendientesList,

      // ── Datos adicionales ────────────────────────────────
      conSentimiento,
      conIntencionMedio,
    });
  } catch (error: unknown) {
    console.error('[API /dashboard/clasificacion GET]', error);
    return NextResponse.json(
      { error: safeError(error, 'dashboard/clasificacion') },
      { status: 500 },
    );
  }
}
