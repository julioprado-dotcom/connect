/**
 * /api/dashboard/search — Buscador global unificado
 *
 * Busca en paralelo: Keywords/Ejes, Personas, Menciones, Fuentes (Medios),
 * Lentes, Productos (Entregas).
 *
 * Soporta búsqueda compuesta con operador "más":
 *   "mineria más bloqueo más Cochabamba" → menciones con TODOS los términos (AND)
 *
 * Query params:
 *   q — término(s) de búsqueda
 */

import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { guardError } from '@/lib/rate-guard';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ─── Tipos de respuesta ────────────────────────────────────

interface SearchResult {
  keywords: Array<{
    id: string;
    nombre: string;
    tipo: 'eje' | 'lente' | 'keyword';
    mencionesCount: number;
  }>;
  personas: Array<{
    id: string;
    nombre: string;
    tipo: string;
    partidoSigla: string;
    mencionesCount: number;
  }>;
  menciones: Array<{
    id: string;
    titulo: string;
    medioNombre: string;
    medio: string;
    fechaCaptura: string;
    fecha: string | null;
    snippet: string;
    ejes: Array<{ id: string; nombre: string }>;
    lentes: Array<{ id: string; nombre: string }>;
  }>;
  fuentes: Array<{
    id: string;
    nombre: string;
    url: string;
    estado: string;
    mencionesHoy: number;
  }>;
  productos: Array<{
    tipo: string;
    nombre: string;
    ultimaEdicion: string | null;
  }>;
  compositeAnalysis?: {
    terminos: string[];
    mencionesCount: number;
    fuentesCount: number;
    ejePredominante?: string;
  };
}

// ─── Helpers ───────────────────────────────────────────────

/** Genera snippet truncando textoCompleto alrededor del término */
function makeSnippet(textoCompleto: string, term: string, maxLen = 120): string {
  if (!textoCompleto) return '';
  const lower = textoCompleto.toLowerCase();
  const idx = lower.indexOf(term.toLowerCase());
  if (idx === -1) return textoCompleto.slice(0, maxLen) + '...';
  const start = Math.max(0, idx - 40);
  const end = Math.min(textoCompleto.length, idx + term.length + 80);
  const snippet = textoCompleto.slice(start, end);
  return (start > 0 ? '...' : '') + snippet + (end < textoCompleto.length ? '...' : '');
}

/** Detecta si la consulta contiene el operador " más " (composite search) */
function parseCompositeQuery(q: string): { terms: string[]; isComposite: boolean } {
  const trimmed = q.trim();
  if (trimmed.includes(' más ')) {
    return {
      terms: trimmed.split(/\s+más\s+/).map(t => t.trim()).filter(Boolean),
      isComposite: true,
    };
  }
  return { terms: [trimmed], isComposite: false };
}

/** Inicio del día (Bolivia UTC-4 aproximado) */
function todayStart(): Date {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return start;
}

// ─── GET Handler ───────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams.get('q');
    if (!q || !q.trim()) {
      return NextResponse.json(
        { error: 'Parámetro "q" es obligatorio' },
        { status: 400 }
      );
    }

    const { terms, isComposite } = parseCompositeQuery(q);
    const mainTerm = terms[0];
    const today = todayStart();

    // ─── Búsqueda paralela ────────────────────────────────
    const [
      ejesResult,
      keywordsResult,
      personasResult,
      mencionesResult,
      fuentesResult,
      lentesResult,
      productosResult,
    ] = await Promise.all([
      // Ejes temáticos
      db.ejeTematico.findMany({
        where: {
          activo: true,
          OR: [
            { nombre: { contains: mainTerm } },
            { slug: { contains: mainTerm } },
            { keywords: { contains: mainTerm } },
          ],
        },
        select: {
          id: true,
          nombre: true,
          tipo: true,
          _count: { select: { Mencion: true } },
        },
        take: 10,
      }),

      // Keywords
      db.keyword.findMany({
        where: {
          activo: true,
          termino: { contains: mainTerm },
        },
        select: {
          id: true,
          termino: true,
          ejeId: true,
          lenteId: true,
        },
        take: 10,
      }),

      // Personas
      db.persona.findMany({
        where: {
          activa: true,
          nombre: { contains: mainTerm },
        },
        select: {
          id: true,
          nombre: true,
          tipo: true,
          partidoSigla: true,
          _count: { select: { Mencion: true } },
        },
        take: 10,
      }),

      // Menciones
      db.mencion.findMany({
        where: isComposite
          ? {
              esDuplicado: false,
              AND: terms.map(t => ({
                textoCompleto: { contains: t },
              })),
            }
          : {
              esDuplicado: false,
              OR: [
                { titulo: { contains: mainTerm } },
                { textoCompleto: { contains: mainTerm } },
              ],
            },
        select: {
          id: true,
          titulo: true,
          textoCompleto: true,
          fechaCaptura: true,
          fechaPublicacion: true,
          Medio: { select: { nombre: true } },
          MencionTema: {
            select: {
              EjeTematico: { select: { id: true, nombre: true } },
            },
          },
          MencionLente: {
            select: {
              Lente: { select: { id: true, nombre: true } },
            },
          },
        },
        orderBy: { fechaCaptura: 'desc' },
        take: 10,
      }),

      // Fuentes (Medios)
      db.medio.findMany({
        where: {
          activo: true,
          OR: [
            { nombre: { contains: mainTerm } },
            { url: { contains: mainTerm } },
          ],
        },
        select: {
          id: true,
          nombre: true,
          url: true,
          activo: true,
          _count: {
            select: {
              Mencion: {
                where: { fechaCaptura: { gte: today } },
              },
            },
          },
        },
        take: 10,
      }),

      // Lentes (try/catch por si no existe)
      db.lente
        .findMany({
          where: {
            activo: true,
            nombre: { contains: mainTerm },
          },
          select: {
            id: true,
            nombre: true,
            _count: { select: { MencionLente: true } },
          },
          take: 10,
        })
        .catch(() => [] as Array<{ id: string; nombre: string; _count: { MencionLente: number } }>),

      // Productos (Entregas)
      db.entrega.findMany({
        where: {
          tipoBoletin: { contains: mainTerm },
        },
        select: {
          id: true,
          tipoBoletin: true,
          fechaEnvio: true,
        },
        orderBy: { fechaEnvio: 'desc' },
        take: 10,
      }),
    ]);

    // ─── Transformar resultados ───────────────────────────

    // Keywords: mezclar ejes y keywords
    const keywords = [
      ...ejesResult.map(e => ({
        id: e.id,
        nombre: e.nombre,
        tipo: 'eje' as const,
        mencionesCount: e._count.Mencion,
      })),
      ...keywordsResult.map(k => ({
        id: k.id,
        nombre: k.termino,
        tipo: (k.lenteId ? 'lente' : k.ejeId ? 'eje' : 'keyword') as 'eje' | 'lente' | 'keyword',
        mencionesCount: 0,
      })),
      ...lentesResult.map(l => ({
        id: l.id,
        nombre: l.nombre,
        tipo: 'lente' as const,
        mencionesCount: l._count.MencionLente,
      })),
    ];

    const personas = personasResult.map(p => ({
      id: p.id,
      nombre: p.nombre,
      tipo: p.tipo,
      partidoSigla: p.partidoSigla,
      mencionesCount: p._count.Mencion,
    }));

    const menciones = mencionesResult.map(m => ({
      id: m.id,
      titulo: m.titulo,
      medioNombre: m.Medio?.nombre ?? 'Sin fuente',
      medio: m.Medio?.nombre ?? 'Sin fuente',
      fechaCaptura: m.fechaCaptura.toISOString(),
      fecha: m.fechaPublicacion ? m.fechaPublicacion.toISOString() : null,
      snippet: makeSnippet(m.textoCompleto, mainTerm),
      ejes: (m.MencionTema ?? []).map(mt => ({
        id: mt.EjeTematico.id,
        nombre: mt.EjeTematico.nombre,
      })),
      lentes: (m.MencionLente ?? []).map(ml => ({
        id: ml.Lente.id,
        nombre: ml.Lente.nombre,
      })),
    }));

    // Obtener estados de fuentes via FuenteEstado
    const fuentesIds = fuentesResult.map(f => f.id);
    const fuenteEstados = fuentesIds.length > 0
      ? await db.fuenteEstado.findMany({
          where: { medioId: { in: fuentesIds } },
          select: { medioId: true, estado: true },
        })
      : [];
    const estadoMap = new Map(fuenteEstados.map(fe => [fe.medioId, fe.estado ?? 'desconocido']));

    const fuentes = fuentesResult.map(f => ({
      id: f.id,
      nombre: f.nombre,
      url: f.url,
      estado: estadoMap.get(f.id) ?? 'desconocido',
      mencionesHoy: f._count.Mencion,
    }));

    const productos = productosResult.map(p => ({
      tipo: p.tipoBoletin,
      nombre: p.tipoBoletin,
      ultimaEdicion: p.fechaEnvio?.toISOString() ?? null,
    }));

    // ─── Análisis compuesto (si aplica) ───────────────────
    let compositeAnalysis: SearchResult['compositeAnalysis'] = undefined;

    if (isComposite && terms.length >= 2) {
      // Ya buscamos menciones con AND arriba, pero necesitamos
      // contar fuentes únicas y encontrar eje predominante
      const compositeMenciones = await db.mencion.findMany({
        where: {
          esDuplicado: false,
          AND: terms.map(t => ({
            textoCompleto: { contains: t },
          })),
        },
        select: {
          medioId: true,
          ejeEstructuralId: true,
        },
        take: 1000,
      });

      const uniqueMedioIds = new Set(compositeMenciones.map(m => m.medioId));
      const ejeIds = compositeMenciones.filter(m => m.ejeEstructuralId).map(m => m.ejeEstructuralId!);

      // Encontrar eje predominante
      let ejePredominante: string | undefined;
      if (ejeIds.length > 0) {
        const ejeCountMap = new Map<string, number>();
        for (const eid of ejeIds) {
          ejeCountMap.set(eid, (ejeCountMap.get(eid) || 0) + 1);
        }
        const topEjeId = [...ejeCountMap.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
        if (topEjeId) {
          const topEje = await db.ejeTematico.findUnique({
            where: { id: topEjeId },
            select: { nombre: true },
          });
          ejePredominante = topEje?.nombre;
        }
      }

      compositeAnalysis = {
        terminos: terms,
        mencionesCount: compositeMenciones.length,
        fuentesCount: uniqueMedioIds.size,
        ejePredominante,
      };
    }

    // ─── Respuesta ────────────────────────────────────────
    const result: SearchResult = {
      keywords,
      personas,
      menciones,
      fuentes,
      productos,
      compositeAnalysis,
    };

    return NextResponse.json(result);
  } catch (error: unknown) {
    return NextResponse.json(
      { error: guardError(error, 'global-search') },
      { status: 500 }
    );
  }
}
