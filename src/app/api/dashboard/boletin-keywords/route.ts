/**
 * /api/dashboard/boletin-keywords?q=...
 * Autocomplete endpoint for BoletinExpress.
 * Searches EjeTematico names, Keyword terms, and Persona names.
 */
import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface KeywordResult {
  label: string;
  type: 'eje' | 'keyword' | 'persona';
}

export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams.get('q')?.trim();
    if (!q || q.length < 2) {
      return NextResponse.json({ results: [] });
    }

    const [ejes, keywords, personas] = await Promise.all([
      db.ejeTematico.findMany({
        where: { activo: true, nombre: { contains: q } },
        select: { nombre: true },
        take: 8,
        orderBy: { orden: 'asc' },
      }),
      db.keyword.findMany({
        where: { activo: true, termino: { contains: q } },
        select: { termino: true },
        take: 12,
      }),
      db.persona.findMany({
        where: { activa: true, nombre: { contains: q } },
        select: { nombre: true },
        take: 8,
        orderBy: { nombre: 'asc' },
      }),
    ]);

    const results: KeywordResult[] = [];

    for (const e of ejes) {
      const label = e.nombre.trim();
      if (label && !results.some((r) => r.label === label)) {
        results.push({ label, type: 'eje' });
      }
    }
    for (const k of keywords) {
      const label = k.termino.trim();
      if (label && !results.some((r) => r.label === label)) {
        results.push({ label, type: 'keyword' });
      }
    }
    for (const p of personas) {
      const label = p.nombre.trim();
      if (label && !results.some((r) => r.label === label)) {
        results.push({ label, type: 'persona' });
      }
    }

    return NextResponse.json({ results: results.slice(0, 20) });
  } catch (error: unknown) {
    console.error('[boletin-keywords]', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
