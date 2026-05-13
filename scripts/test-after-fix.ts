import { PrismaClient } from "@prisma/client";
process.env.DATABASE_URL = "file:" + process.cwd() + "/prisma/db/custom.db";
const db = new PrismaClient();

async function main() {
  // The exact query from /api/stats that was failing
  try {
    const r = await db.mencion.findMany({
      take: 15,
      orderBy: { fechaCaptura: "desc" },
      include: {
        persona: { select: { id: true, nombre: true, partidoSigla: true, camara: true } },
        medio: { select: { id: true, nombre: true, tipo: true } },
      },
    });
    console.log("✅ findMany+orderBy+include OK:", r.length, "rows");
    console.log("  First:", r[0]?.titulo?.substring(0, 50));
    console.log("  Last:", r[r.length-1]?.titulo?.substring(0, 50));
  } catch(e: any) {
    console.log("❌ FAILED:", e.message?.substring(0, 300));
  }

  // Also test menciones-summary query
  try {
    const hoy = new Date(); hoy.setHours(0,0,0,0);
    const manana = new Date(hoy); manana.setDate(manana.getDate() + 1);
    const ayer = new Date(hoy); ayer.setDate(ayer.getDate() - 1);
    const inicioSemana = new Date(hoy);
    inicioSemana.setDate(inicioSemana.getDate() - inicioSemana.getDay() + 1);
    
    const [hoyCount, ayerCount, semanaCount, total] = await Promise.all([
      db.mencion.count({ where: { fechaCaptura: { gte: hoy, lt: manana } } }),
      db.mencion.count({ where: { fechaCaptura: { gte: ayer, lt: hoy } } }),
      db.mencion.count({ where: { fechaCaptura: { gte: inicioSemana } } }),
      db.mencion.count(),
    ]);
    console.log("✅ menciones-summary counts OK:", { hoyCount, ayerCount, semanaCount, total });
  } catch(e: any) {
    console.log("❌ counts FAILED:", e.message?.substring(0, 300));
  }

  await db.$disconnect();
}
main().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
