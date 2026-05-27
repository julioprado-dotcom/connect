// GET /api/dashboard/fuentes — Fuentes con estado legible
//
// Retorna todas las fuentes con nombres de medio legibles y estado derivado.
// Filter query param: ?filter=activas|caidas|bloqueadas|todas

import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { guardError } from '@/lib/rate-guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Medios conocidos detrás de Cloudflare
const CLOUDFLARE_MEDIOS = [
  'la razón',
  'el deber',
  'el mundo',
  'el potosí',
  'los tiempos',
  'la razon',
  'el deber',
  'el mundo',
  'el potosi',
  'los tiempos',
];

function timeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'ahora';
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours}h`;
  return `hace ${Math.floor(hours / 24)}d`;
}

function deriveEstado(fuente: {
  activo: boolean;
  estaMuerto: boolean;
  esDegradado: boolean;
  error: string;
  medioNombre: string;
  fallosConsecutivos: number;
}): string {
  // Check Cloudflare / WAF blocked
  const nombreLower = fuente.medioNombre.toLowerCase().trim();
  if (
    CLOUDFLARE_MEDIOS.some(m => nombreLower.includes(m)) &&
    (fuente.error.toLowerCase().includes('cloudflare') ||
      fuente.error.toLowerCase().includes('waf') ||
      fuente.error.toLowerCase().includes('403'))
  ) {
    return 'bloqueada';
  }

  if (fuente.estaMuerto) return 'caida';
  if (fuente.esDegradado && fuente.fallosConsecutivos >= 5) return 'caida';
  if (fuente.esDegradado) return 'degradada';
  if (!fuente.activo) return 'pausada';
  return 'activa';
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter') || 'todas';

    // Fetch all medios
    const medios = await db.medio.findMany({
      where: { activo: true },
      select: {
        id: true,
        nombre: true,
        url: true,
        tipo: true,
        categoria: true,
        nivel: true,
      },
      orderBy: { nombre: 'asc' },
    });

    // Fetch all fuente estados
    const estados = await db.fuenteEstado.findMany({
      include: {
        Medio: {
          select: { id: true, nombre: true, url: true, tipo: true, categoria: true, nivel: true },
        },
      },
      orderBy: { ultimoCheck: 'desc' },
    });

    // Build map: medioId → FuenteEstado
    const estadoMap = new Map(estados.map(e => [e.medioId, e]));

    // Fetch menciones count per medio (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);
    const mencionesByMedio = await db.mencion.groupBy({
      by: ['medioId'],
      where: { fechaCaptura: { gte: sevenDaysAgo } },
      _count: { id: true },
    });
    const mencionesMap = new Map(mencionesByMedio.map(m => [m.medioId, m._count.id]));

    // Combine all medios with their estado
    const fuentes = medios.map(medio => {
      const estado = estadoMap.get(medio.id);
      const mencionesSemana = mencionesMap.get(medio.id) || 0;

      if (!estado) {
        // No FuenteEstado record — show as "sin estado"
        return {
          id: medio.id,
          medioId: medio.id,
          medioNombre: medio.nombre,
          medioUrl: medio.url,
          estado: 'sin_estado' as string,
          ultimaCaptura: null as string | null,
          mencionesSemana,
          nivel: medio.nivel || null,
        };
      }

      // Derive estado
      const derivedEstado = deriveEstado({
        activo: estado.activo,
        estaMuerto: (Date.now() - (estado.ultimoCheck?.getTime() || 0)) > 48 * 3600 * 1000,
        esDegradado: estado.checksSinCambio >= 7,
        error: estado.error || '',
        medioNombre: medio.nombre,
        fallosConsecutivos: estado.fallosConsecutivos,
      });

      return {
        id: estado.id,
        medioId: medio.id,
        medioNombre: medio.nombre,
        medioUrl: medio.url,
        estado: derivedEstado,
        ultimaCaptura: estado.ultimoCheck?.toISOString() ?? null,
        mencionesSemana,
        nivel: medio.nivel || null,
      };
    });

    // Apply filter
    let filtered = fuentes;
    switch (filter) {
      case 'activas':
        filtered = fuentes.filter(f => f.estado === 'activa');
        break;
      case 'caidas':
        filtered = fuentes.filter(f => f.estado === 'caida' || f.estado === 'degradada');
        break;
      case 'bloqueadas':
        filtered = fuentes.filter(f => f.estado === 'bloqueada');
        break;
      case 'todas':
      default:
        break;
    }

    // Add human-readable timeAgo for frontend convenience
    const enriched = filtered.map(f => ({
      ...f,
      ultimaCapturaHace: f.ultimaCaptura ? timeAgo(new Date(f.ultimaCaptura)) : 'nunca',
    }));

    return NextResponse.json({
      total: fuentes.length,
      filter,
      fuentes: enriched,
      resumen: {
        activas: fuentes.filter(f => f.estado === 'activa').length,
        caidas: fuentes.filter(f => f.estado === 'caida').length,
        degradadas: fuentes.filter(f => f.estado === 'degradada').length,
        bloqueadas: fuentes.filter(f => f.estado === 'bloqueada').length,
        pausadas: fuentes.filter(f => f.estado === 'pausada').length,
        sinEstado: fuentes.filter(f => f.estado === 'sin_estado').length,
      },
    });
  } catch (error: unknown) {
    console.error('[API /dashboard/fuentes GET]', error);
    return NextResponse.json(
      { error: guardError(error, 'dashboard/fuentes') },
      { status: 500 },
    );
  }
}
