// Extraer menciones de legisladores Y temas relevantes de texto de noticias usando LLM
// DECODEX Bolivia — Pipeline A (scrape-fuente)
// Caching logic extracted from extractor-menciones.ts

import db from '@/lib/db';

// ─── Type for Marco Conceptual data ──────────────────────────

export type MarcoData = NonNullable<Awaited<ReturnType<typeof db.marco_conceptual.findFirst>>>;

// ─── safeJson helper ──────────────────────────────────────────

export function safeJson<T>(field: unknown, fallback: T): T {
  if (field === null || field === undefined) return fallback;
  try {
    if (typeof field === 'string') {
      const parsed = JSON.parse(field);
      // Si esperamos un array pero no lo es, usar fallback
      if (Array.isArray(fallback) && !Array.isArray(parsed)) return fallback;
      return parsed as T;
    }
    // Prisma puede devolver JSON como objeto ya parseado
    if (typeof field === 'object') {
      // Si esperamos un array pero field no lo es, usar fallback
      if (Array.isArray(fallback) && !Array.isArray(field)) return fallback;
      return field as T;
    }
    return fallback;
  } catch {
    return fallback;
  }
}

// ─── In-memory cache for master data (TTL 60s) ──────────────

let cacheMarcoConceptual: { data: MarcoData | null; expiry: number } | null = null;
let cachePersonas: { data: any[]; expiry: number } | null = null;
let cacheEjes: { data: any[]; expiry: number } | null = null;
let cacheTemasRecientes: { data: any[]; expiry: number } | null = null;
let cacheIndicadores: { data: any[]; expiry: number } | null = null;
const CACHE_TTL = 60000; // 60 seconds

export async function getMarcoConceptualCached(): Promise<MarcoData | null> {
  if (cacheMarcoConceptual && cacheMarcoConceptual.expiry > Date.now()) {
    return cacheMarcoConceptual.data;
  }
  const data = await db.marco_conceptual.findFirst({ where: { activa: true } });
  cacheMarcoConceptual = { data, expiry: Date.now() + CACHE_TTL };
  return data;
}

export async function getPersonasCached(): Promise<any[]> {
  if (cachePersonas && cachePersonas.expiry > Date.now()) {
    return cachePersonas.data;
  }
  const data = await db.persona.findMany({
    where: { activa: true },
    select: { id: true, nombre: true, partidoSigla: true, camara: true, cargoDirectiva: true, tipo: true },
  });
  cachePersonas = { data, expiry: Date.now() + CACHE_TTL };
  return data;
}

export async function getEjesCached(): Promise<any[]> {
  if (cacheEjes && cacheEjes.expiry > Date.now()) {
    return cacheEjes.data;
  }
  const data = await db.ejeTematico.findMany({
    where: { activo: true },
    select: { id: true, nombre: true, slug: true, keywords: true },
  });
  cacheEjes = { data, expiry: Date.now() + CACHE_TTL };
  return data;
}

export async function getTemasRecientesCached(): Promise<any[]> {
  if (cacheTemasRecientes && cacheTemasRecientes.expiry > Date.now()) {
    return cacheTemasRecientes.data;
  }
  const treintaDiasAtras = new Date();
  treintaDiasAtras.setDate(treintaDiasAtras.getDate() - 30);
  const data = await db.mencionTema.findMany({
    where: { Mencion: { fechaCaptura: { gte: treintaDiasAtras } } },
    include: { EjeTematico: { select: { nombre: true, keywords: true } } },
    distinct: ['ejeTematicoId'],
  });
  cacheTemasRecientes = { data, expiry: Date.now() + CACHE_TTL };
  return data;
}

export async function getIndicadoresCached(): Promise<any[]> {
  if (cacheIndicadores && cacheIndicadores.expiry > Date.now()) {
    return cacheIndicadores.data;
  }
  // Obtener últimos valores de indicadores activos (uno por indicador, el más reciente)
  const indicadores = await db.indicador.findMany({
    where: { activo: true },
    select: {
      id: true,
      nombre: true,
      slug: true,
      categoria: true,
      unidad: true,
      formatoNumero: true,
      IndicadorValor: {
        orderBy: { fecha: 'desc' },
        take: 1,
        select: { valor: true, valorTexto: true, fecha: true, confiable: true },
      },
    },
  });
  cacheIndicadores = { data: indicadores, expiry: Date.now() + CACHE_TTL };
  return indicadores;
}
