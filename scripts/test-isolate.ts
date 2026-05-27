import { PrismaClient } from "@prisma/client";
process.env.DATABASE_URL = "file:" + process.cwd() + "/prisma/db/custom.db";
const db = new PrismaClient();

async function main() {
  // Test orderBy without include
  try {
    const r = await db.mencion.findMany({
      take: 15,
      orderBy: { fechaCaptura: "desc" },
    });
    console.log("1. orderBy only OK:", r.length);
  } catch(e: any) { console.log("1. FAILED:", e.message?.substring(0,300)); }

  // Test include without orderBy
  try {
    const r = await db.mencion.findMany({
      take: 15,
      include: {
        persona: { select: { id: true, nombre: true, partidoSigla: true, camara: true } },
        medio: { select: { id: true, nombre: true, tipo: true } },
      },
    });
    console.log("2. include only OK:", r.length);
  } catch(e: any) { console.log("2. FAILED:", e.message?.substring(0,300)); }

  // Test orderBy by rowid with include (raw)
  try {
    const r = await db.$queryRawUnsafe<any[]>(`
      SELECT m.id, m.titulo, m.fechaCaptura,
        p.nombre as personaNombre, p.partidoSigla, p.camara,
        md.nombre as medioNombre, md.tipo as medioTipo
      FROM Mencion m
      LEFT JOIN Persona p ON p.id = m.personaId
      LEFT JOIN Medio md ON md.id = m.medioId
      ORDER BY m.fechaCaptura DESC
      LIMIT 15
    `);
    console.log("3. raw SQL + ORDER BY OK:", r.length);
  } catch(e: any) { console.log("3. FAILED:", e.message?.substring(0,300)); }

  // Test orderBy by id 
  try {
    const r = await db.mencion.findMany({
      take: 15,
      orderBy: { id: "desc" },
      include: {
        persona: { select: { id: true, nombre: true, partidoSigla: true, camara: true } },
        medio: { select: { id: true, nombre: true, tipo: true } },
      },
    });
    console.log("4. orderBy id + include OK:", r.length);
  } catch(e: any) { console.log("4. FAILED:", e.message?.substring(0,300)); }

  await db.$disconnect();
}
main().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
