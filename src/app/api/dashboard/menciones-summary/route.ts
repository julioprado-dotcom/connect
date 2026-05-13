/**
 * /api/dashboard/menciones-summary — Menciones dashboard
 * Returns mention counts (today, yesterday, week), trend, and latest 10 menciones.
 * Uses $queryRaw to avoid Prisma DateTime conversion issues.
 */
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { safeError } from '@/lib/rate-guard';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const manana = new Date(hoy);
    manana.setDate(manana.getDate() + 1);

    const ayer = new Date(hoy);
    ayer.setDate(ayer.getDate() - 1);

    const inicioSemana = new Date(hoy);
    inicioSemana.setDate(inicioSemana.getDate() - inicioSemana.getDay() + 1); // Monday

    const hoyISO = hoy.toISOString();
    const mananaISO = manana.toISOString();
    const ayerISO = ayer.toISOString();
    const semanaISO = inicioSemana.toISOString();

    // Use $queryRawUnsafe to bypass Prisma type conversion issues with DateTime columns
    const [hoyResult, ayerResult, semanaResult, totalResult, ultimasResult] = await Promise.all([
      db.mencion.count({ where: { fechaCaptura: { gte: hoy, lt: manana } } }).catch(() => ({ _raw: 0 })),
      db.mencion.count({ where: { fechaCaptura: { gte: ayer, lt: hoy } } }).catch(() => ({ _raw: 0 })),
      db.mencion.count({ where: { fechaCaptura: { gte: inicioSemana } } }).catch(() => ({ _raw: 0 })),
      db.mencion.count().catch(() => ({ _raw: 0 })),
    ]);

    // Fallback: use raw SQL if Prisma counts fail
    let hoyCount: number;
    let ayerCount: number;
    let semanaCount: number;
    let total: number;

    try {
      hoyCount = typeof hoyResult === 'number' ? hoyResult : Number(hoyResult) || 0;
      ayerCount = typeof ayerResult === 'number' ? ayerResult : Number(ayerResult) || 0;
      semanaCount = typeof semanaResult === 'number' ? semanaResult : Number(semanaResult) || 0;
      total = typeof totalResult === 'number' ? totalResult : Number(totalResult) || 0;
    } catch {
      hoyCount = 0; ayerCount = 0; semanaCount = 0; total = 0;
    }

    // If all counts are 0, try raw SQL as fallback
    if (total === 0) {
      try {
        const rawTotal = await db.$queryRawUnsafe<{ c: bigint }[]>('SELECT COUNT(*) as c FROM Mencion');
        total = Number(rawTotal[0]?.c || 0);

        const rawHoy = await db.$queryRawUnsafe<{ c: bigint }[]>(`SELECT COUNT(*) as c FROM Mencion WHERE fechaCaptura >= '${hoyISO}' AND fechaCaptura < '${mananaISO}'`);
        hoyCount = Number(rawHoy[0]?.c || 0);

        const rawAyer = await db.$queryRawUnsafe<{ c: bigint }[]>(`SELECT COUNT(*) as c FROM Mencion WHERE fechaCaptura >= '${ayerISO}' AND fechaCaptura < '${hoyISO}'`);
        ayerCount = Number(rawAyer[0]?.c || 0);

        const rawSemana = await db.$queryRawUnsafe<{ c: bigint }[]>(`SELECT COUNT(*) as c FROM Mencion WHERE fechaCaptura >= '${semanaISO}'`);
        semanaCount = Number(rawSemana[0]?.c || 0);
      } catch (e) {
        console.error('[menciones-summary] Raw SQL fallback error:', e);
      }
    }

    // Get latest 10 menciones using raw SQL
    let ultimas: Array<{
      id: string;
      titulo: string;
      fechaCaptura: string;
      tratamientoPeriodistico: string | null;
      persona: { nombre: string } | null;
      medio: { nombre: string };
    }> = [];

    try {
      const rows = await db.$queryRawUnsafe<any[]>(`
        SELECT 
          m.id, m.titulo, m.fechaCaptura, m.tratamientoPeriodistico,
          p.nombre as personaNombre,
          md.nombre as medioNombre
        FROM Mencion m
        LEFT JOIN Persona p ON p.id = m.personaId
        LEFT JOIN Medio md ON md.id = m.medioId
        ORDER BY m.rowid DESC
        LIMIT 10
      `);
      ultimas = rows.map((r: any) => ({
        id: r.id,
        titulo: r.titulo || '',
        fechaCaptura: r.fechaCaptura || '',
        tratamientoPeriodistico: r.tratamientoPeriodistico || null,
        persona: r.personaNombre ? { nombre: r.personaNombre } : null,
        medio: { nombre: r.medioNombre || 'Desconocido' },
      }));
    } catch (e) {
      console.error('[menciones-summary] Raw SQL ultimas error:', e);
    }

    let tendencia: 'up' | 'down' | 'stable' = 'stable';
    if (ayerCount === 0 && hoyCount > 0) tendencia = 'up';
    else if (ayerCount > 0 && hoyCount > ayerCount) tendencia = 'up';
    else if (hoyCount < ayerCount) tendencia = 'down';

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      hoy: hoyCount,
      ayer: ayerCount,
      semana: semanaCount,
      total,
      tendencia,
      ultimas,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[menciones-summary] ERROR:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
