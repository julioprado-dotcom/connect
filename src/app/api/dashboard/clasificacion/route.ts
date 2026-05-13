// GET /api/dashboard/clasificacion — Lentes, ejes y pendientes
//
// Retorna datos de clasificación: lentes con menciones clasificadas,
// ejes temáticos, y menciones pendientes de clasificación.
// Usa try/catch para el modelo Lente (puede no existir).

import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { safeError } from '@/lib/rate-guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // ── Lentes ────────────────────────────────────────────
    let lentes: Array<{
      id: string;
      nombre: string;
      slug: string;
      menciones: number;
      clasificadas: number;
      porcentaje: number;
    }> = [];

    try {
      // Check if Lente model exists by querying it
      const lentesData = await db.lente.findMany({
        where: { activo: true },
        include: {
          _count: {
            select: { MencionLente: true, Keyword: true },
          },
        },
        orderBy: { nombre: 'asc' },
      });

      // Total menciones in DB (for porcentaje calculation)
      const totalMenciones = await db.mencion.count({
        where: {
          esDuplicado: false,
        },
      });

      lentes = lentesData.map(l => {
        const clasificadas = l._count.MencionLente;
        const porcentaje = totalMenciones > 0
          ? Math.round((clasificadas / totalMenciones) * 100)
          : 0;
        return {
          id: l.id,
          nombre: l.nombre,
          slug: l.slug,
          menciones: totalMenciones,
          clasificadas,
          porcentaje,
        };
      });
    } catch {
      // Lente model might not exist or table is missing
      console.log('[API /dashboard/clasificacion] Lente model not available');
    }

    // ── Ejes Temáticos ────────────────────────────────────
    let ejes: Array<{
      id: string;
      nombre: string;
      slug: string;
      menciones: number;
      porcentaje: number;
    }> = [];

    try {
      const ejesData = await db.ejeTematico.findMany({
        where: { activo: true, parentId: null },
        include: {
          _count: {
            select: { Mencion: true, MencionTema: true },
          },
        },
        orderBy: { orden: 'asc' },
      });

      const totalMenciones = await db.mencion.count({
        where: { esDuplicado: false },
      });

      ejes = ejesData.map(e => {
        const menciones = e._count.Mencion;
        const porcentaje = totalMenciones > 0
          ? Math.round((menciones / totalMenciones) * 100)
          : 0;
        return {
          id: e.id,
          nombre: e.nombre,
          slug: e.slug,
          menciones,
          porcentaje,
        };
      });
    } catch {
      console.log('[API /dashboard/clasificacion] EjeTematico query failed');
    }

    // ── Pendientes (sin tratamientoPeriodistico) ──────────
    let pendientes = 0;
    let pendientesList: Array<{
      id: string;
      titulo: string;
      medioNombre: string;
      fechaCaptura: string;
    }> = [];

    try {
      pendientes = await db.mencion.count({
        where: {
          tratamientoPeriodistico: null,
          esDuplicado: false,
        },
      });

      const pendientesData = await db.mencion.findMany({
        where: {
          tratamientoPeriodistico: null,
          esDuplicado: false,
        },
        include: {
          medio: {
            select: { nombre: true },
          },
        },
        orderBy: { fechaCaptura: 'desc' },
        take: 20,
        select: {
          id: true,
          titulo: true,
          fechaCaptura: true,
          medio: { select: { nombre: true } },
        },
      });

      pendientesList = pendientesData.map(m => ({
        id: m.id,
        titulo: m.titulo,
        medioNombre: m.medio.nombre,
        fechaCaptura: m.fechaCaptura.toISOString(),
      }));
    } catch {
      console.log('[API /dashboard/clasificacion] Pendientes query failed');
    }

    return NextResponse.json({
      lentes,
      ejes,
      pendientes,
      pendientesList,
      resumen: {
        totalLentes: lentes.length,
        totalEjes: ejes.length,
        totalPendientes: pendientes,
      },
    });
  } catch (error: unknown) {
    console.error('[API /dashboard/clasificacion GET]', error);
    return NextResponse.json(
      { error: safeError(error, 'dashboard/clasificacion') },
      { status: 500 },
    );
  }
}
