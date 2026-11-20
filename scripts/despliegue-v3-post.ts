/**
 * Despliegue V3 — script post-seed.
 * Ejecutar DESPUÉS de scripts/seed-ejes-v3.ts:
 *   cd /root/decodex-app && npx tsx scripts/despliegue-v3-post.ts
 *
 * 1) Degrada los 9 ejes estructurales v2 viejos a tipo 'legacy' (activo=false),
 *    sin tocar los 12 v3 ni sus sub-ejes (identificados por parentId != null).
 * 2) Libera las menciones cuyo eje apunta a un eje legacy o inactivo
 *    (ejeEstructuralId → null) para que el clasificador v3 las recoja.
 * 3) Re-clasifica todas las menciones pendientes con la taxonomía v3
 *    (eje principal + multi-eje con pesos en NotaEje + lentes en MencionLente).
 * 4) Imprime resumen de estado final.
 */
import { PrismaClient } from '@prisma/client';
import { reclasificarMencion } from '../src/lib/clasificador-v2';

const prisma = new PrismaClient();

// Los 12 slugs de nivel superior definidos en seed-ejes-v3.ts (ONION200 FINAL)
const SLUGS_V3 = [
  'hidrocarburos-energia',
  'mineria-metales',
  'litio-energias-alternativas',
  'gobierno-poder-instituciones',
  'vida-tierra-territorio',
  'justicia-derechos-impunidad',
  'organizaciones-sociales-gremiales',
  'organizaciones-empresariales',
  'salud-educacion-servicios',
  'relaciones-internacionales',
  'procesos-electorales',
  'seguridad-ciudadana',
];

async function main() {
  console.log('════ Despliegue V3 — post-seed ════\n');

  // ── 1. Degradar ejes v2 viejos ─────────────────────────────────
  const degradados = await prisma.ejeTematico.updateMany({
    where: { tipo: 'estructural', parentId: null, slug: { notIn: SLUGS_V3 } },
    data: { tipo: 'legacy', activo: false },
  });
  console.log(`1) Ejes v2 viejos degradados a legacy: ${degradados.count}`);

  // ── 2. Liberar menciones ancladas a ejes legacy/inactivos ─────
  const liberadas = await prisma.mencion.updateMany({
    where: {
      ejeEstructuralId: { not: null },
      EjeTematico: { OR: [{ tipo: 'legacy' }, { activo: false }] },
    },
    data: { ejeEstructuralId: null },
  });
  console.log(`2) Menciones liberadas para re-clasificar: ${liberadas.count}`);

  // ── 3. Re-clasificar con la taxonomía v3 ──────────────────────
  const pendientes = await prisma.mencion.findMany({
    where: { ejeEstructuralId: null },
    select: { id: true },
  });
  console.log(`3) Re-clasificando ${pendientes.length} menciones con la taxonomía v3...`);
  let ok = 0;
  let sinCoincidencia = 0;
  for (let i = 0; i < pendientes.length; i++) {
    const exito = await reclasificarMencion(pendientes[i].id);
    if (exito) ok++;
    else sinCoincidencia++;
    if ((i + 1) % 200 === 0) {
      console.log(`   ... ${i + 1}/${pendientes.length} procesadas (asignadas: ${ok})`);
    }
  }
  console.log(`   ✅ Asignadas: ${ok} · sin coincidencia de keywords: ${sinCoincidencia}`);

  // ── 4. Resumen final ──────────────────────────────────────────
  const porTipo = await prisma.ejeTematico.groupBy({ by: ['tipo'], _count: true });
  console.log('\n4) EjeTematico por tipo: ' + porTipo.map((r) => `${r.tipo}: ${r._count}`).join(' · '));
  const keywords = await prisma.keyword.count({ where: { activo: true } });
  const lentes = await prisma.lente.count({ where: { activo: true } });
  console.log(`   Keywords activas: ${keywords} · Lentes activos: ${lentes}`);

  const top = await prisma.mencion.groupBy({
    by: ['ejeEstructuralId'],
    _count: true,
    where: { ejeEstructuralId: { not: null } },
    orderBy: { _count: { ejeEstructuralId: 'desc' } },
    take: 12,
  });
  const nombres = await prisma.ejeTematico.findMany({
    where: { slug: { in: SLUGS_V3 } },
    select: { id: true, nombre: true },
  });
  const mapa = new Map(nombres.map((n) => [n.id, n.nombre]));
  console.log('\n   Menciones por eje v3 (top):');
  for (const t of top) {
    console.log(`   - ${mapa.get(t.ejeEstructuralId ?? '') ?? t.ejeEstructuralId}: ${t._count}`);
  }
  console.log('\n🎉 Despliegue V3 completado. Reinicia la app y verifica el dashboard.');
}

main()
  .catch((e) => {
    console.error('❌ Error fatal:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
