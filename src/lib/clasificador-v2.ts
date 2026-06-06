// Clasificador v3 — Ejes estructurales + Lentes transversales + Multi-eje con pesos
// DECODEX Bolivia ONION200
//
// Algoritmo:
// 1. Normalizar texto (título + textoCompleto)
// 2. Evaluar contra 12 ejes estructurales → eje principal + ejes secundarios con pesos
// 3. Evaluar contra 11 lentes transversales → activar lentes
// 4. REGLA ESPECIAL: movilización social → lente + determinar MOTIVO
// 5. REGLA ESPECIAL: seguridad ciudadana → NUNCA prioritario (siempre baja prioridad)
// 6. Max 6 ejes por nota, threshold ≥ 0.5
// 7. Crear NotaEje (pesos) + MencionLente + ejeEstructuralId (principal)

import db from '@/lib/db'; // Uses canonical DB path

// ─── Cache ──────────────────────────────────────────────────────
interface EjeData { id: string; nombre: string; slug: string; keywords: string[] }
interface LenteData { id: string; nombre: string; slug: string; keywords: string[] }

let cachedEjes: EjeData[] | null = null;
let cachedLentes: LenteData[] | null = null;
let cacheExpiry = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 min

// ─── Keyword extraction helpers ────────────────────────────────

function normalize(s: string): string {
  return s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/[^a-z0-9áéíóúñü\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── Load data from DB ─────────────────────────────────────────

async function loadEjes(): Promise<EjeData[]> {
  const rows = await db.ejeTematico.findMany({
    where: { tipo: 'estructural', activo: true },
    include: { Keyword: { where: { activo: true }, select: { termino: true } } },
    orderBy: { orden: 'asc' },
  });

  return rows.map((r: any) => ({
    id: r.id,
    nombre: r.nombre,
    slug: r.slug,
    keywords: r.Keyword?.map((k: any) => k.termino.toLowerCase().trim()) || [],
  }));
}

async function loadLentes(): Promise<LenteData[]> {
  const rows = await db.lente.findMany({
    where: { activo: true },
    include: { Keyword: { where: { activo: true }, select: { termino: true } } },
  });

  return rows.map((r: any) => ({
    id: r.id,
    nombre: r.nombre,
    slug: r.slug,
    keywords: r.Keyword?.map((k: any) => k.termino.toLowerCase().trim()) || [],
  }));
}

async function getEjes(): Promise<EjeData[]> {
  if (cachedEjes && Date.now() < cacheExpiry) return cachedEjes;
  cachedEjes = await loadEjes();
  cachedLentes = await loadLentes();
  cacheExpiry = Date.now() + CACHE_TTL;
  return cachedEjes!;
}

async function getLentes(): Promise<LenteData[]> {
  if (cachedLentes && Date.now() < cacheExpiry) return cachedLentes;
  await getEjes(); // loads both
  return cachedLentes!;
}

// ─── Classification result ─────────────────────────────────────

export interface EjePeso {
  id: string;
  slug: string;
  nombre: string;
  peso: number; // 0.0-1.0, threshold >= 0.5
  coincidencias: number;
}

export interface ClasificacionV2 {
  ejePrincipalId: string | null;
  ejePrincipalSlug: string | null;
  ejePrincipalNombre: string | null;
  ejesSecundarios: Array<{ id: string; slug: string; coincidencias: number }>;
  ejesConPeso: EjePeso[]; // multi-eje: todos los ejes con peso >= 0.5, max 6
  lenteIds: string[];
  lenteSlugs: string[];
  motivoMovilizacion: string | null;
  confianza: 'alta' | 'media' | 'baja';
}

// ─── Main classification function ──────────────────────────────

const MAX_EJES_POR_NOTA = 6;
const PESO_MINIMO = 0.5;
const SEGURIDAD_CIUDADANA_SLUG = 'seguridad-ciudadana';
const MOVILIZACION_SOCIAL_SLUG = 'movilizacion-social';

export async function clasificarV2(titulo: string, texto: string): Promise<ClasificacionV2> {
  const empty: ClasificacionV2 = {
    ejePrincipalId: null, ejePrincipalSlug: null, ejePrincipalNombre: null,
    ejesSecundarios: [], ejesConPeso: [],
    lenteIds: [], lenteSlugs: [],
    motivoMovilizacion: null, confianza: 'baja',
  };

  const textNorm = normalize(`${titulo} ${texto}`);
  if (textNorm.length < 10) return empty;

  const ejes = await getEjes();
  const lentes = await getLentes();

  // ── PASO 2: Evaluar ejes ──
  const ejeScores: Array<{ eje: EjeData; coincidencias: number; kwMatched: string[] }> = [];
  for (const eje of ejes) {
    let coincidencias = 0;
    const kwMatched: string[] = [];
    for (const kw of eje.keywords) {
      const kwNorm = normalize(kw);
      if (kwNorm.length >= 3 && textNorm.includes(kwNorm)) {
        coincidencias++;
        kwMatched.push(kw);
      }
    }
    if (coincidencias > 0) ejeScores.push({ eje, coincidencias, kwMatched });
  }

  ejeScores.sort((a, b) => b.coincidencias - a.coincidencias);

  // ── PASO 3: Evaluar lentes ──
  const lenteActivados: LenteData[] = [];
  for (const lente of lentes) {
    for (const kw of lente.keywords) {
      const kwNorm = normalize(kw);
      if (kwNorm.length >= 3 && textNorm.includes(kwNorm)) {
        lenteActivados.push(lente);
        break; // one match is enough
      }
    }
  }

  // ── PASO 4: REGLA ESPECIAL — Movilización Social ──
  const lenteMovilizacion = lenteActivados.find(l =>
    l.slug === 'movilizacion-social' || l.slug === 'movilizacion-social-lente'
  );
  let motivoMovilizacion: string | null = null;
  let ejeOverride: EjeData | null = null;

  if (lenteMovilizacion) {
    // Determine the MOTIVO of the mobilization
    // Remove movilization keywords from consideration and find the strongest remaining eje
    const movilKwSet = new Set(lenteMovilizacion.keywords.map(k => normalize(k)));

    // Also remove movilizacion-social eje keywords from consideration
    const movilEje = ejes.find(e =>
      e.slug === MOVILIZACION_SOCIAL_SLUG ||
      e.slug === 'movilizacion-social-eje'
    );

    // Find the motive: which non-mobilization eje has the most keywords?
    const motiveScores = ejeScores.filter(s => {
      if (movilEje && s.eje.id === movilEje.id) return false;
      if (s.eje.slug === MOVILIZACION_SOCIAL_SLUG || s.eje.slug === 'movilizacion-social-eje') return false;
      return s.coincidencias > 0;
    });

    if (motiveScores.length > 0 && motiveScores[0].coincidencias >= 1) {
      // There IS a clear motive → use that eje as principal, NOT movilizacion
      ejeOverride = motiveScores[0].eje;
      motivoMovilizacion = motiveScores[0].kwMatched.slice(0, 3).join(', ');
    } else {
      // No clear motive → the mobilization IS the topic → use movilizacion eje
      ejeOverride = movilEje || null;
      motivoMovilizacion = 'la movilización es el tema central';
    }
  }

  // ── PASO 5: REGLA ESPECIAL — Seguridad Ciudadana NUNCA prioritaria ──
  // Si seguridad ciudadana es el eje con más coincidencias PERO hay otro eje
  // con coincidencias >= 1, degradar seguridad ciudadana a secundario.
  const seguridadEje = ejeScores.find(s => s.eje.slug === SEGURIDAD_CIUDADANA_SLUG);

  // ── Determine final eje principal ──
  let ejePrincipal: EjeData | null = ejeOverride;
  if (!ejePrincipal && ejeScores.length > 0) {
    // Si el top es seguridad ciudadana pero hay otros ejes, usar el siguiente
    if (ejeScores[0].eje.slug === SEGURIDAD_CIUDADANA_SLUG && ejeScores.length > 1) {
      ejePrincipal = ejeScores[1].eje;
    } else if (ejeScores[0].eje.slug === SEGURIDAD_CIUDADANA_SLUG) {
      ejePrincipal = ejeScores[0].eje; // solo queda seguridad como opción
    } else {
      ejePrincipal = ejeScores[0].eje;
    }
  }

  // ── PASO 6: Ejes secundarios (2+ keywords, different from principal) ──
  const ejesSec = ejeScores
    .filter(s => s.eje.id !== ejePrincipal?.id && s.coincidencias >= 2)
    .map(s => ({ id: s.eje.id, slug: s.eje.slug, coincidencias: s.coincidencias }));

  // ── PASO 7: Multi-eje con pesos (max 6, threshold >= 0.5) ──
  const maxCoincidencias = Math.max(...ejeScores.map(s => s.coincidencias), 1);
  const ejesConPeso: EjePeso[] = ejeScores
    .map(s => ({
      id: s.eje.id,
      slug: s.eje.slug,
      nombre: s.eje.nombre,
      coincidencias: s.coincidencias,
      peso: Math.round((s.coincidencias / maxCoincidencias) * 100) / 100, // normalize 0-1
    }))
    .filter(e => e.peso >= PESO_MINIMO)
    .sort((a, b) => b.peso - a.peso)
    .slice(0, MAX_EJES_POR_NOTA);

  // ── Confidence ──
  const totalKw = ejeScores.reduce((sum, s) => sum + s.coincidencias, 0);
  const confianza: 'alta' | 'media' | 'baja' = totalKw >= 5 ? 'alta' : totalKw >= 2 ? 'media' : 'baja';

  return {
    ejePrincipalId: ejePrincipal?.id || null,
    ejePrincipalSlug: ejePrincipal?.slug || null,
    ejePrincipalNombre: ejePrincipal?.nombre || null,
    ejesSecundarios: ejesSec,
    ejesConPeso,
    lenteIds: lenteActivados.map(l => l.id),
    lenteSlugs: lenteActivados.map(l => l.slug),
    motivoMovilizacion,
    confianza,
  };
}

// ─── Apply classification to a Mencion in DB ───────────────────

export async function reclasificarMencion(mencionId: string): Promise<boolean> {
  try {
    const mencion = await db.mencion.findUnique({
      where: { id: mencionId },
      select: { id: true, titulo: true, texto: true, textoCompleto: true },
    });
    if (!mencion) return false;

    const resultado = await clasificarV2(
      mencion.titulo || '',
      mencion.textoCompleto || mencion.texto || ''
    );

    if (!resultado.ejePrincipalId) return false;

    // Update ejeEstructuralId
    await db.mencion.update({
      where: { id: mencionId },
      data: { ejeEstructuralId: resultado.ejePrincipalId },
    });

    // Create MencionLente records
    for (const lenteId of resultado.lenteIds) {
      try {
        await db.mencionLente.create({
          data: { mencionId, lenteId },
        });
      } catch {
        // Duplicate, ignore
      }
    }

    // Create NotaEje records (multi-eje with weights)
    for (const ejePeso of resultado.ejesConPeso) {
      try {
        await db.notaEje.create({
          data: { mencionId, ejeId: ejePeso.id, peso: ejePeso.peso },
        });
      } catch {
        // Duplicate, ignore
      }
    }

    return true;
  } catch (err) {
    console.error(`[clasificador-v2] Error reclasificando ${mencionId}:`, err);
    return false;
  }
}

// ─── Batch reclassification ────────────────────────────────────

export async function reclasificarLote(offset: number, limit: number): Promise<{ procesadas: number; reclasificadas: number }> {
  const menciones = await db.mencion.findMany({
    where: { ejeEstructuralId: null },
    select: { id: true },
    skip: offset,
    take: limit,
  });

  let reclasificadas = 0;
  for (const m of menciones) {
    const ok = await reclasificarMencion(m.id);
    if (ok) reclasificadas++;
  }

  return { procesadas: menciones.length, reclasificadas };
}
