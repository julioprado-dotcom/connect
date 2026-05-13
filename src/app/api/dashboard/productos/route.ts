// GET /api/dashboard/productos — Productos del pipeline
//
// Retorna los 10 productos con estado, última edición y estadísticas.
// Data del modelo Entrega agrupado por tipoBoletin.

import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { safeError } from '@/lib/rate-guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ─── Product catalog ─────────────────────────────────────

interface ProductDef {
  tipo: string;
  nombre: string;
  tipoProducto: 'premium' | 'gratuito';
}

const PRODUCTOS: ProductDef[] = [
  { tipo: 'termometro', nombre: 'El Termómetro', tipoProducto: 'premium' },
  { tipo: 'saldo_del_dia', nombre: 'Saldo del Día', tipoProducto: 'premium' },
  { tipo: 'el_foco', nombre: 'El Foco', tipoProducto: 'premium' },
  { tipo: 'el_especializado', nombre: 'El Especializado', tipoProducto: 'premium' },
  { tipo: 'el_informe_cerrado', nombre: 'El Informe Cerrado', tipoProducto: 'premium' },
  { tipo: 'ficha_legislador', nombre: 'Ficha Legislador', tipoProducto: 'gratuito' },
  { tipo: 'el_radar', nombre: 'El Radar', tipoProducto: 'premium' },
  { tipo: 'el_hilo', nombre: 'El Hilo', tipoProducto: 'premium' },
  { tipo: 'boletin_del_grano', nombre: 'Boletín del Grano', tipoProducto: 'gratuito' },
  { tipo: 'informe_mineria', nombre: 'Informe de Minería', tipoProducto: 'gratuito' },
];

// ─── Helper: format date as "lunes 06:03" ───────────────

const DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

function formatDateTimeShort(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  const dia = DIAS_SEMANA[d.getDay()];
  const hora = d.getHours().toString().padStart(2, '0');
  const min = d.getMinutes().toString().padStart(2, '0');
  return `${dia} ${hora}:${min}`;
}

// ─── Main ────────────────────────────────────────────────

export async function GET() {
  try {
    // Fetch most recent entrega per tipoBoletin
    const entregas = await db.entrega.findMany({
      orderBy: { fechaCreacion: 'desc' },
      include: {
        contrato: {
          include: {
            cliente: {
              select: { nombre: true },
            },
          },
        },
      },
    });

    // Group by tipoBoletin and pick the most recent per product
    const latestByType = new Map<string, (typeof entregas)[0]>();
    for (const e of entregas) {
      if (!latestByType.has(e.tipoBoletin)) {
        latestByType.set(e.tipoBoletin, e);
      }
    }

    // Also count stats per tipo
    const statsByType = new Map<string, { total: number; enviadas: number; pendientes: number; fallidas: number; totalDestinatarios: number }>();
    for (const e of entregas) {
      const existing = statsByType.get(e.tipoBoletin) || { total: 0, enviadas: 0, pendientes: 0, fallidas: 0, totalDestinatarios: 0 };
      existing.total++;
      if (e.estado === 'enviado') existing.enviadas++;
      else if (e.estado === 'pendiente') existing.pendientes++;
      else if (e.estado === 'fallido') existing.fallidas++;
      try {
        const dests = JSON.parse(e.destinatarios || '[]');
        existing.totalDestinatarios += Array.isArray(dests) ? dests.length : 0;
      } catch { /* ignore */ }
      statsByType.set(e.tipoBoletin, existing);
    }

    // Build product list from catalog
    const productos = PRODUCTOS.map(def => {
      const latest = latestByType.get(def.tipo);
      const stats = statsByType.get(def.tipo);

      // Determine estado
      let estado: 'generado' | 'pendiente' | 'error' | 'sin_datos';
      if (latest) {
        if (latest.estado === 'fallido') estado = 'error';
        else if (latest.estado === 'enviado') estado = 'generado';
        else if (latest.estado === 'pendiente') estado = 'pendiente';
        else estado = 'generado';
      } else {
        estado = 'sin_datos';
      }

      // Determine últimaEdicion
      const ultimaFecha = latest?.fechaEnvio || latest?.fechaCreacion || null;
      const ultimaEdicion = formatDateTimeShort(ultimaFecha?.toISOString() ?? null);

      return {
        tipo: def.tipo,
        nombre: def.nombre,
        tipoProducto: def.tipoProducto,
        estado,
        ultimaEdicion,
        mencionesUsadas: latest
          ? (() => {
              // Try to extract menciones from resultado or contenido
              try {
                const content = latest.contenido || '';
                // Rough estimate from content length
                return Math.max(1, Math.round(content.length / 200));
              } catch {
                return 0;
              }
            })()
          : 0,
        destinatarios: stats?.totalDestinatarios || 0,
      };
    });

    return NextResponse.json({
      productos,
      resumen: {
        total: productos.length,
        generados: productos.filter(p => p.estado === 'generado').length,
        pendientes: productos.filter(p => p.estado === 'pendiente').length,
        errores: productos.filter(p => p.estado === 'error').length,
        sinDatos: productos.filter(p => p.estado === 'sin_datos').length,
        premium: productos.filter(p => p.tipoProducto === 'premium').length,
        gratuitos: productos.filter(p => p.tipoProducto === 'gratuito').length,
      },
    });
  } catch (error: unknown) {
    console.error('[API /dashboard/productos GET]', error);
    return NextResponse.json(
      { error: safeError(error, 'dashboard/productos') },
      { status: 500 },
    );
  }
}
