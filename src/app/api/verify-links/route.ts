import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { safeError } from '@/lib/rate-guard';

/**
 * Validación SSRF: verifica que una URL no apunte a recursos internos.
 * Bloquea IPs privadas, localhost, cloud metadata, y esquemas peligrosos.
 */
function isSafeUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);

    // Solo permitir HTTP y HTTPS
    if (!['http:', 'https:'].includes(url.protocol)) {
      return false;
    }

    const hostname = url.hostname.toLowerCase();

    // Bloquear localhost
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
      return false;
    }

    // Bloquear cloud metadata endpoints
    if (hostname === '169.254.169.254' || hostname === 'metadata.google.internal') {
      return false;
    }

    // Bloquear rangos IP privados
    const ipMatch = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (ipMatch) {
      const [, a, b] = ipMatch.map(Number);
      // 10.0.0.0/8
      if (a === 10) return false;
      // 172.16.0.0/12
      if (a === 172 && b >= 16 && b <= 31) return false;
      // 192.168.0.0/16
      if (a === 192 && b === 168) return false;
      // 169.254.0.0/16 (link-local / cloud metadata)
      if (a === 169 && b === 254) return false;
      // 0.0.0.0
      if (a === 0) return false;
    }

    return true;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get menciones with URLs that haven't been verified recently
    const { searchParams } = new URL(request.url);
    const batchSize = Math.min(50, Math.max(1, parseInt(searchParams.get('batch') || '20')));

    // Get menciones with non-empty URLs, prioritize ones not yet verified
    const menciones = await db.mencion.findMany({
      where: {
        url: { not: '' },
        fechaVerificacion: null,
      },
      select: { id: true, url: true },
      take: batchSize,
    });

    // If none with null verification, get the oldest verified ones
    const mencionesToCheck = menciones.length > 0
      ? menciones
      : await db.mencion.findMany({
          where: { url: { not: '' } },
          select: { id: true, url: true },
          orderBy: { fechaVerificacion: 'asc' },
          take: batchSize,
        });

    if (mencionesToCheck.length === 0) {
      return NextResponse.json({
        verified: 0,
        activos: 0,
        rotos: 0,
        detalles: [],
        mensaje: 'No hay enlaces para verificar',
      });
    }

    // Filtrar URLs peligrosas (SSRF protection)
    const safeMenciones = mencionesToCheck.filter((m) => isSafeUrl(m.url));
    const skipped = mencionesToCheck.length - safeMenciones.length;

    let activos = 0;
    let rotos = 0;
    const detalles: Array<{ id: string; url: string; status: number | string; activo: boolean }> = [];

    // Verify URLs in parallel (max 5 concurrent)
    const concurrency = 5;
    for (let i = 0; i < safeMenciones.length; i += concurrency) {
      const batch = safeMenciones.slice(i, i + concurrency);

      const results = await Promise.allSettled(
        batch.map(async (m) => {
          try {
            const res = await fetch(m.url, {
              method: 'HEAD',
              signal: AbortSignal.timeout(10000), // 10s timeout
              redirect: 'follow',
            });
            return {
              id: m.id,
              url: m.url,
              status: res.status,
              activo: res.ok,
            };
          } catch {
            // If fetch fails, consider it broken
            return {
              id: m.id,
              url: m.url,
              status: 'error',
              activo: false,
            };
          }
        })
      );

      for (const result of results) {
        if (result.status === 'fulfilled') {
          const r = result.value;
          detalles.push(r);
          if (r.activo) {
            activos++;
          } else {
            rotos++;
          }

          // Update DB
          await db.mencion.update({
            where: { id: r.id },
            data: {
              enlaceActivo: r.activo,
              fechaVerificacion: new Date(),
            },
          });
        } else {
          rotos++;
          // Still update DB for failed verifications
          if (batch.length > 0) {
            const idx = results.indexOf(result);
            if (idx >= 0 && batch[idx]) {
              detalles.push({
                id: batch[idx].id,
                url: batch[idx].url,
                status: 'error_verificacion',
                activo: false,
              });
              await db.mencion.update({
                where: { id: batch[idx].id },
                data: {
                  enlaceActivo: false,
                  fechaVerificacion: new Date(),
                },
              });
            }
          }
        }
      }
    }

    return NextResponse.json({
      verified: safeMenciones.length,
      activos,
      rotos,
      skipped,
      detalles,
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: safeError(error, 'verify-links') }, { status: 500 });
  }
}

// GET: Return verification stats
export async function GET() {
  try {
    const total = await db.mencion.count({ where: { url: { not: '' } } });
    const activos = await db.mencion.count({ where: { url: { not: '' }, enlaceActivo: true, fechaVerificacion: { not: null } } });
    const rotos = await db.mencion.count({ where: { enlaceActivo: false } });
    const sinVerificar = await db.mencion.count({ where: { fechaVerificacion: null } });

    // Get recently verified links
    const recientes = await db.mencion.findMany({
      where: { fechaVerificacion: { not: null } },
      select: {
        id: true,
        url: true,
        enlaceActivo: true,
        fechaVerificacion: true,
        titulo: true,
      },
      orderBy: { fechaVerificacion: 'desc' },
      take: 20,
    });

    return NextResponse.json({
      total,
      activos,
      rotos,
      sinVerificar,
      recientes,
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: safeError(error, 'verify-links') }, { status: 500 });
  }
}
