export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { withAuth } from '@/lib/auth-helpers';

export async function POST(request: NextRequest) {
  const { error: authError } = await withAuth();
  if (authError) return authError;

  try {
    // Find medios with activo=true but empty/invalid URL or no FuenteEstado
    const medios = await db.medio.findMany({
      where: { activo: true },
      include: { FuenteEstado: true },
    });

    let fixed = 0;
    const results: Array<{ nombre: string; action: string; detail: string }> = [];

    for (const medio of medios) {
      // Try to extract domain from URL
      if (medio.url && medio.url.startsWith('http')) {
        try {
          const hostname = new URL(medio.url).hostname.replace('www.', '');
          // Create FuenteEstado if missing
          if (!medio.FuenteEstado) {
            const nivelNum = parseInt(medio.nivel) || 3;
            const frecuenciaMap: Record<number, string> = { 1: '30m', 2: '2h', 3: '6h' };
            await db.fuenteEstado.create({
              data: {
                medioId: medio.id,
                url: medio.url,
                activo: true,
                estado: 'validando',
                frecuenciaBase: frecuenciaMap[nivelNum] || '6h',
                frecuenciaActual: frecuenciaMap[nivelNum] || '6h',
              },
            });
            results.push({ nombre: medio.nombre, action: 'CREADO', detail: `FuenteEstado creado con URL: ${hostname}` });
            fixed++;
          } else if (!medio.FuenteEstado.activo && medio.FuenteEstado.estado === 'inactiva') {
            // Try reactivating if it was inactivated
            await db.fuenteEstado.update({
              where: { medioId: medio.id },
              data: { activo: true, estado: 'validando', ultimoError: '' },
            });
            results.push({ nombre: medio.nombre, action: 'REACTIVADO', detail: `Estado cambiado a validando` });
            fixed++;
          }
        } catch {
          // URL parse error, skip
        }
      } else if (!medio.url || !medio.url.startsWith('http')) {
        results.push({ nombre: medio.nombre, action: 'SIN_URL', detail: 'Medio sin URL válida — requiere intervención manual' });
      }
    }

    // Auto-classify: suggest naturaleza for medios with .gob.bo (batch updateMany)
    const gobMedios = await db.medio.findMany({
      where: { 
        url: { contains: '.gob.bo' },
        naturaleza: { not: 'ESTATAL' },
      },
    });
    if (gobMedios.length > 0) {
      await db.medio.updateMany({
        where: { id: { in: gobMedios.map(m => m.id) } },
        data: { naturaleza: 'ESTATAL' },
      });
      for (const m of gobMedios) {
        results.push({ nombre: m.nombre, action: 'CLASIFICADO', detail: 'Naturaleza sugerida: ESTATAL (dominio .gob.bo)' });
        fixed++;
      }
    }

    return NextResponse.json({
      totalScanned: medios.length,
      fixed,
      results,
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: (error as Error).message || 'Error interno' }, { status: 500 });
  }
}
