/**
 * Verificación post-despliegue V3 — identifica los ejes que aparecían como UUID
 * y da el panorama de anclaje de menciones (raíz v3 vs sub-ejes vs sin eje).
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const ids = ['b7df7474-07b6-4338-9ffb-493f646b4553', 'e6d4a2a2-d934-4097-8701-cc8d67d78683'];
  const ejes = await prisma.ejeTematico.findMany({
    where: { id: { in: ids } },
    select: { id: true, nombre: true, slug: true, parentId: true, tipo: true, activo: true },
  });
  const padreIds = ejes.map((e) => e.parentId).filter((p): p is string => !!p);
  const padres = await prisma.ejeTematico.findMany({
    where: { id: { in: padreIds } },
    select: { id: true, nombre: true, slug: true },
  });

  console.log('── Los 2 ejes que aparecían como UUID ──');
  for (const e of ejes) {
    const padre = padres.find((p) => p.id === e.parentId);
    const menciones = await prisma.mencion.count({ where: { ejeEstructuralId: e.id } });
    console.log(`- ${e.slug} (${e.nombre}) · hijo de: ${padre?.slug ?? '—'} · tipo: ${e.tipo} · activo: ${e.activo} · menciones: ${menciones}`);
  }

  console.log('\n── Panorama de anclaje ──');
  const total = await prisma.mencion.count();
  const sinEje = await prisma.mencion.count({ where: { ejeEstructuralId: null } });
  const conRaiz = await prisma.mencion.count({
    where: { EjeTematico: { parentId: null, tipo: 'estructural', activo: true } },
  });
  const conSub = await prisma.mencion.count({
    where: { EjeTematico: { parentId: { not: null } } },
  });
  console.log(`Total menciones: ${total} · sin eje: ${sinEje} · ancladas a raíz v3: ${conRaiz} · ancladas a sub-ejes: ${conSub}`);

  const subTop = await prisma.mencion.groupBy({
    by: ['ejeEstructuralId'],
    _count: true,
    where: { EjeTematico: { parentId: { not: null } } },
    orderBy: { _count: { ejeEstructuralId: 'desc' } },
    take: 8,
  });
  const subIds = subTop.map((s) => s.ejeEstructuralId).filter((v): v is string => !!v);
  const subs = await prisma.ejeTematico.findMany({
    where: { id: { in: subIds } },
    select: { id: true, nombre: true, slug: true },
  });
  console.log('\n── Top sub-ejes con menciones ancladas ──');
  for (const s of subTop) {
    const e = subs.find((x) => x.id === s.ejeEstructuralId);
    console.log(`- ${e?.slug ?? s.ejeEstructuralId} (${e?.nombre ?? '—'}): ${s._count}`);
  }

  await prisma.$disconnect();
}

main()
  .catch((e) => {
    console.error('❌', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
