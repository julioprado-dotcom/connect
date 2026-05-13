import { PrismaClient } from "@prisma/client";
process.env.DATABASE_URL = "file:" + process.cwd() + "/prisma/db/custom.db";
const db = new PrismaClient();

async function main() {
  // Test 1: findMany sin include ni orderBy
  try {
    const r = await db.mencion.findMany({ take: 5 });
    console.log("1. findMany basic OK:", r.length);
  } catch(e: any) { console.log("1. FAILED:", e.message?.substring(0,200)); }

  // Test 2: findMany con orderBy
  try {
    const r = await db.mencion.findMany({ take: 5, orderBy: { fechaCaptura: "desc" } });
    console.log("2. findMany orderBy OK:", r.length);
  } catch(e: any) { console.log("2. FAILED:", e.message?.substring(0,200)); }

  // Test 3: findMany con include persona
  try {
    const r = await db.mencion.findMany({
      take: 5,
      orderBy: { fechaCaptura: "desc" },
      include: { persona: { select: { id: true, nombre: true } } },
    });
    console.log("3. findMany + persona OK:", r.length);
  } catch(e: any) { console.log("3. FAILED:", e.message?.substring(0,200)); }

  // Test 4: findMany con include medio
  try {
    const r = await db.mencion.findMany({
      take: 5,
      orderBy: { fechaCaptura: "desc" },
      include: { medio: { select: { id: true, nombre: true } } },
    });
    console.log("4. findMany + medio OK:", r.length);
  } catch(e: any) { console.log("4. FAILED:", e.message?.substring(0,200)); }

  // Test 5: findMany con include completo
  try {
    const r = await db.mencion.findMany({
      take: 5,
      orderBy: { fechaCaptura: "desc" },
      include: {
        persona: { select: { id: true, nombre: true, partidoSigla: true, camara: true } },
        medio: { select: { id: true, nombre: true, tipo: true } },
      },
    });
    console.log("5. findMany + full include OK:", r.length);
  } catch(e: any) { console.log("5. FAILED:", e.message?.substring(0,200)); }

  // Test 6: same but limit 15
  try {
    const r = await db.mencion.findMany({
      take: 15,
      orderBy: { fechaCaptura: "desc" },
      include: {
        persona: { select: { id: true, nombre: true, partidoSigla: true, camara: true } },
        medio: { select: { id: true, nombre: true, tipo: true } },
      },
    });
    console.log("6. findMany 15 + full include OK:", r.length);
  } catch(e: any) { console.log("6. FAILED:", e.message?.substring(0,200)); }

  await db.$disconnect();
}
main().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
