import { PrismaClient } from "@prisma/client";
process.env.DATABASE_URL = "file:" + process.cwd() + "/prisma/db/custom.db";
const db = new PrismaClient();

async function main() {
  // Get IDs of ALL records, test each one
  const allIds = await db.$queryRawUnsafe<{id: string}[]>(
    `SELECT id FROM Mencion ORDER BY rowid`
  );
  console.log("Testing all", allIds.length, "records...");
  
  let badRecords: string[] = [];
  for (const {id} of allIds) {
    try {
      await db.mencion.findFirst({ where: { id } });
    } catch(e: any) {
      badRecords.push(id);
    }
  }
  
  console.log("\nBad records:", badRecords.length);
  for (const id of badRecords) {
    console.log("  ❌", id);
  }

  await db.$disconnect();
}
main().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
