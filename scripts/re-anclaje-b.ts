/**
 * Re-anclaje Opción B — las menciones se anclan SOLO a los 12 ejes raíz.
 * Requiere que src/lib/clasificador-v2.ts ya tenga el fix de loadEjes
 * (parentId: null + consolidación de keywords de sub-ejes en la raíz).
 * Ejecutar:  cd /root/decodex-app && npx tsx scripts/re-anclaje-b.ts
 *
 * Hace:
 * 1) Libera las menciones ancladas a sub-ejes (parentId != null) → ejeEstructuralId: null.
 * 2) Re-clasifica todas las menciones pendientes con la taxonomía v3 (solo raíces).
 * 3) Resumen final por los 12 dominios y chequeo de residuos.
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
  console.log('════ Re-anclaje Opción B — solo 12 ejes raíz ════\n');

  // ── 0. Chequeo previo: 12 raíces activas ──────────────────────
  const raices = await prisma.ejeTematico.count({
    where: { tipo: 'estructural', activo: true, parentId: null },
  });
  console.log(`0) Raíces estructurales activas: ${raices} (esperado: 12)`);

  // ── 1. Liberar menciones ancladas a sub-ejes ──────────────────
  const liberadas = await prisma.mencion.updateMany({
    where: { ejeEstructuralId: { not: null }, EjeTematico: { parentId: { not: null } } },
    data: { ejeEstructuralId: null },
  });
  console.log(`1) Menciones liberadas desde sub-ejes: ${liberadas.count}`);

  // ── 2. Re-clasificar todas las pendientes (solo raíces) ───────
  const pendientes = await prisma.mencion.findMany({
    where: { ejeEstructuralId: null },
    select: { id: true },
  });
  console.log(`2) Re-clasificando ${pendientes.length} menciones con la taxonomía v3...`);
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
  if (liberadas.count > 0 && sinCoincidencia > liberadas.count * 0.15) {
    console.log('   ⚠️  Más del 15% de las liberadas no encontró raíz: revisar keywords de las raíces.');
  }

  // ── 3. Resumen final por los 12 dominios ──────────────────────
  const sinEje = await prisma.mencion.count({ where: { ejeEstructuralId: null } });
  const conSub = await prisma.mencion.count({ where: { EjeTematico: { parentId: { not: null } } } });
  console.log(`\n3) Quedan sin eje: ${sinEje} · ancladas a sub-ejes: ${conSub} (esperado: 0)`);

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
  console.log('\n   Menciones por eje raíz (12 dominios):');
  for (const t of top) {
    console.log(`   - ${mapa.get(t.ejeEstructuralId ?? '') ?? t.ejeEstructuralId}: ${t._count}`);
  }
  console.log('\n🎉 Re-anclaje B completado. Reinicia la app (build + restart) y verifica el dashboard.');
}

main()
  .catch((e) => {
    console.error('❌ Error fatal:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
