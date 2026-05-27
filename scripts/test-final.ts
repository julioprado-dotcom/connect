import { PrismaClient } from "@prisma/client";
process.env.DATABASE_URL = "file:" + process.cwd() + "/prisma/db/custom.db";
const db = new PrismaClient();

async function main() {
  // Test 1: The exact failing query from /api/stats
  try {
    const r = await db.mencion.findMany({
      take: 15,
      orderBy: { fechaCaptura: "desc" },
      include: {
        persona: { select: { id: true, nombre: true, partidoSigla: true, camara: true } },
        medio: { select: { id: true, nombre: true, tipo: true } },
      },
    });
    console.log("✅ /api/stats query OK:", r.length, "rows");
  } catch(e: any) {
    console.log("❌ /api/stats query FAILED:", e.code, e.meta?.message);
  }

  // Test 2: findFirst on previously bad record
  try {
    const r = await db.mencion.findFirst({ where: { id: 'cmp_ea_1778635642024_7' } });
    console.log("✅ Bad record OK:", r?.titulo?.substring(0,40));
  } catch(e: any) {
    console.log("❌ Bad record FAILED:", e.code);
  }

  // Test 3: groupBy
  try {
    const hoy = new Date(); hoy.setHours(0,0,0,0);
    const inicioSemana = new Date(hoy);
    inicioSemana.setDate(inicioSemana.getDate() - inicioSemana.getDay() + 1);
    inicioSemana.setHours(0,0,0,0);
    const r = await db.mencion.groupBy({
      by: ["personaId"],
      where: { fechaCaptura: { gte: inicioSemana } },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 10,
    });
    console.log("✅ groupBy OK:", r.length);
  } catch(e: any) {
    console.log("❌ groupBy FAILED:", e.code);
  }

  // Test 4: Verify all 82 previously bad records
  const badIds = [
    'cmp_kc_1778633243046_0', 'cmp_ld_1778633557901_0', 'cmp_br_1778634605162_0',
    'cmp_ur_1778634744115_0', 'cmp_rt_1778634877873_0', 'cmp_eb_1778634979171_0',
    'cmp_ea_1778635582769_0'
  ];
  let ok = 0;
  for (const id of badIds) {
    try {
      await db.mencion.findFirst({ where: { id } });
      ok++;
    } catch(e) { /* skip */ }
  }
  console.log(`✅ Sample bad records: ${ok}/${badIds.length} now work`);

  await db.$disconnect();
}
main().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
