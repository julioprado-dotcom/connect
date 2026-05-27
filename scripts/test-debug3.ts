import { PrismaClient } from "@prisma/client";
process.env.DATABASE_URL = "file:" + process.cwd() + "/prisma/db/custom.db";
const db = new PrismaClient();

async function main() {
  // Get all IDs using parameterized query
  const ids = await db.$queryRawUnsafe<{id: string}[]>(
    `SELECT id FROM Mencion ORDER BY rowid LIMIT 10`
  );
  console.log("Testing first 10 records individually...");
  
  for (const {id} of ids) {
    try {
      const r = await db.mencion.findFirst({ where: { id } });
      console.log("✅", id, "|", r?.titulo?.substring(0,40));
    } catch(e: any) {
      console.log("❌", id, "|", e.code, "|", e.meta?.message?.substring(0,100));
    }
  }

  await db.$disconnect();
}
main().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
