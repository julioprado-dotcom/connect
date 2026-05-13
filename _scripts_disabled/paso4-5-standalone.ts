// PASO 4+5: Standalone reclasificacion + tests (no path aliases)
import { PrismaClient } from '@prisma/client';
import { join } from 'path';

// Force canonical DB
process.env.DATABASE_URL = `file:${join('/home/z/my-project', 'prisma', 'db', 'custom.db')}`;
const db = new PrismaClient();

// ─── Types ─────────────────────────────────────────────────────
interface EjeData { id: string; nombre: string; slug: string; keywords: string[] }
interface LenteData { id: string; nombre: string; slug: string; keywords: string[] }

// ─── Normalize ─────────────────────────────────────────────────
function normalize(s: string): string {
  return s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9áéíóúñü\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── Classify ──────────────────────────────────────────────────
interface Result { ejeId: string|null; ejeSlug: string|null; lenteSlugs: string[]; motivo: string|null }

async function clasificar(titulo: string, texto: string, ejes: EjeData[], lentes: LenteData[]): Promise<Result> {
  const norm = normalize(`${titulo} ${texto}`);
  if (norm.length < 10) return { ejeId:null, ejeSlug:null, lenteSlugs:[], motivo:null };

  // Score ejes
  const scores: Array<{ eje: EjeData; hits: number; kw: string[] }> = [];
  for (const e of ejes) {
    let hits = 0; const kw: string[] = [];
    for (const k of e.keywords) {
      if (normalize(k).length >= 3 && norm.includes(normalize(k))) { hits++; kw.push(k); }
    }
    if (hits > 0) scores.push({ eje: e, hits, kw });
  }
  scores.sort((a, b) => b.hits - a.hits);

  // Score lentes
  const activeLentes: LenteData[] = [];
  for (const l of lentes) {
    for (const k of l.keywords) {
      if (normalize(k).length >= 3 && norm.includes(normalize(k))) { activeLentes.push(l); break; }
    }
  }

  // MOVILIZATION RULE
  const lenteMov = activeLentes.find(l => l.slug === 'movilizacion-social');
  let ejeFinal = scores.length > 0 ? scores[0].eje : null;
  let motivo: string|null = null;

  if (lenteMov) {
    const nonMovScores = scores.filter(s => s.eje.slug !== 'movilizacion-social' && s.hits > 0);
    const eje8 = ejes.find(e => e.slug === 'movilizacion-social');
    if (nonMovScores.length > 0) {
      ejeFinal = nonMovScores[0].eje;
      motivo = nonMovScores[0].kw.slice(0,3).join(', ');
    } else {
      ejeFinal = eje8 || ejeFinal;
      motivo = 'movilizacion es el tema central';
    }
  }

  return {
    ejeId: ejeFinal?.id || null,
    ejeSlug: ejeFinal?.slug || null,
    lenteSlugs: activeLentes.map(l => l.slug),
    motivo,
  };
}

// ─── Main ──────────────────────────────────────────────────────
async function main() {
  console.log('Loading ejes and lentes...');
  const ejesRows = await db.ejeTematico.findMany({
    where: { tipo: 'estructural', activo: true },
    include: { keywordEjes: { where: { activo: true }, select: { termino: true } } },
    orderBy: { orden: 'asc' },
  });
  const lentesRows = await db.lente.findMany({
    where: { activo: true },
    include: { keywordLentes: { where: { activo: true }, select: { termino: true } } },
  });

  const ejes: EjeData[] = ejesRows.map((r: any) => ({
    id: r.id, nombre: r.nombre, slug: r.slug,
    keywords: r.keywordEjes?.map((k: any) => k.termino.toLowerCase().trim()) || [],
  }));
  const lentes: LenteData[] = lentesRows.map((r: any) => ({
    id: r.id, nombre: r.nombre, slug: r.slug,
    keywords: r.keywordLentes?.map((k: any) => k.termino.toLowerCase().trim()) || [],
  }));

  console.log(`Loaded: ${ejes.length} ejes (${ejes.reduce((s,e)=>s+e.keywords.length,0)} kw), ${lentes.length} lentes (${lentes.reduce((s,l)=>s+l.keywords.length,0)} kw)`);

  // ═══ PASO 5: Test cases FIRST ═══
  console.log('\n=== PASO 5: Test Cases ===');
  const tests = [
    { input: 'Transportistas realizan bloqueo de carreteras por gasolina basura', eje: 'recursos-naturales', lentes: ['movilizacion-social','hidrocarburos'], noEje: 'movilizacion-social' },
    { input: 'Organizaciones sociales rechazan la Ley 1720 y bloquean rutas', eje: 'gobierno-instituciones', lentes: ['movilizacion-social'] },
    { input: 'CAO paraliza actividades economicas en Santa Cruz', eje: 'v2-economia', lentes: ['movilizacion-social'], noEje: 'movilizacion-social' },
    { input: 'Incendios forestales devoran 100000 hectareas en Santa Cruz', eje: 'recursos-naturales', lentes: ['medio-ambiente'] },
    { input: 'Gobierno anuncia tipificacion penal de bloqueos de carreteras', eje: 'movilizacion-social', lentes: [] },
  ];

  let passed = 0;
  for (const t of tests) {
    const r = await clasificar(t.input, '', ejes, lentes);
    const ok = r.ejeSlug === t.eje && t.lentes.every(l => r.lenteSlugs.includes(l)) && (!t.noEje || r.ejeSlug !== t.noEje);
    if (ok) passed++;
    console.log(`  ${ok ? 'PASS' : 'FAIL'}: "${t.input.substring(0,55)}"`);
    console.log(`    Eje: ${r.ejeSlug} (esperado: ${t.eje}) | Lentes: [${r.lenteSlugs.join(',')}]`);
    if (r.motivo) console.log(`    Motivo: ${r.motivo}`);
  }
  console.log(`  Tests: ${passed}/${tests.length} passed`);

  // ═══ PASO 4: Reclasify ═══
  console.log('\n=== PASO 4: Reclasificacion ===');
  const menciones = await db.mencion.findMany({
    where: { ejeEstructuralId: null },
    select: { id: true, titulo: true, texto: true, textoCompleto: true },
  });
  console.log(`Menciones sin reclasificar: ${menciones.length}`);

  let reclasificadas = 0;
  for (const m of menciones) {
    const r = await clasificar(m.titulo || '', m.textoCompleto || m.texto || '', ejes, lentes);
    if (!r.ejeId) continue;

    try {
      await db.mencion.update({ where: { id: m.id }, data: { ejeEstructuralId: r.ejeId } });
      for (const lslug of r.lenteSlugs) {
        const lente = lentes.find(l => l.slug === lslug);
        if (lente) {
          try { await db.mencionLente.create({ data: { mencionId: m.id, lenteId: lente.id } }); } catch {}
        }
      }
      reclasificadas++;
    } catch (err: any) {
      // Skip errors
    }
  }
  console.log(`Reclasificadas: ${reclasificadas}/${menciones.length}`);

  await db.$disconnect();
  console.log('\n DONE');
}

main().catch(e => { console.error(e); process.exit(1); });
