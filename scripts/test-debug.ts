import { PrismaClient } from "@prisma/client";
process.env.DATABASE_URL = "file:" + process.cwd() + "/prisma/db/custom.db";
const db = new PrismaClient();

async function main() {
  try {
    // Try with just 1 record to get more specific error
    const r = await db.mencion.findFirst({
      orderBy: { fechaCaptura: "desc" },
    });
    console.log("OK:", r?.id);
  } catch(e: any) {
    console.log("FULL ERROR:");
    console.log(e.message);
    console.log("\nCODE:", e.code);
    console.log("\nMETA:", JSON.stringify(e.meta, null, 2));
  }

  await db.$disconnect();
}
main().catch(e => { console.error("FATAL:", e); process.exit(1); });
