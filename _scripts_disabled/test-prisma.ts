import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

async function test() {
  // Test 1: findMany with NO include
  console.log('Test 1: no include');
  const t1 = await db.mencion.findMany({ take: 3, orderBy: { fechaCaptura: 'desc' } });
  console.log('OK:', t1.length);

  // Test 2: findMany with ONLY medio include
  console.log('Test 2: medio include only');
  try {
    const t2 = await db.mencion.findMany({
      include: { medio: { select: { nombre: true } } },
      take: 3, orderBy: { fechaCaptura: 'desc' },
    });
    console.log('OK:', t2.length);
  } catch(e: any) {
    console.log('FAIL:', e.message.substring(0, 200));
  }

  // Test 3: findMany with ONLY persona include
  console.log('Test 3: persona include only');
  try {
    const t3 = await db.mencion.findMany({
      include: { persona: { select: { nombre: true } } },
      take: 3, orderBy: { fechaCaptura: 'desc' },
    });
    console.log('OK:', t3.length);
  } catch(e: any) {
    console.log('FAIL:', e.message.substring(0, 200));
  }

  // Test 4: count with where
  console.log('Test 4: count with date where');
  try {
    const hoy = new Date(); hoy.setHours(0,0,0,0);
    const manana = new Date(hoy); manana.setDate(manana.getDate() + 1);
    const t4 = await db.mencion.count({ where: { fechaCaptura: { gte: hoy, lt: manana } } });
    console.log('OK:', t4);
  } catch(e: any) {
    console.log('FAIL:', e.message.substring(0, 200));
  }
  
  await db.$disconnect();
}
test();
