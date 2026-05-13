import { PrismaClient } from "@prisma/client";
process.env.DATABASE_URL = "file:" + process.cwd() + "/prisma/db/custom.db";
const prisma = new PrismaClient();

async function main() {
  const lentes = await prisma.lente.findMany({ where: { activo: true }, orderBy: { id: "asc" } });
  console.log("LENTES:", JSON.stringify(lentes, null, 2));
  const cafeLente = lentes.find((l) => l.slug.includes("cafe"));
  if (cafeLente) {
    const mencionesCafe = await prisma.mencionLente.count({ where: { lenteId: cafeLente.id } });
    console.log("MENCIONES CAFE:", mencionesCafe);
  } else {
    console.log("NO SE ENCUENTRA LENTE CAFE");
    // Try broader search
    const allLentes = await prisma.lente.findMany();
    console.log("ALL LENTES:", allLentes.map(l => ({ id: l.id, nombre: l.nombre, slug: l.slug })));
  }
  const totalMenciones = await prisma.mencion.count();
  console.log("TOTAL MENCIONES:", totalMenciones);
  await prisma.$disconnect();
}
main().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
