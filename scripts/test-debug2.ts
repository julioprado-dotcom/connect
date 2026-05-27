import { PrismaClient } from "@prisma/client";
process.env.DATABASE_URL = "file:" + process.cwd() + "/prisma/db/custom.db";
const db = new PrismaClient();

async function main() {
  // Try binary search: test first half vs second half
  // Use raw SQL to get IDs, then try Prisma with individual IDs
  const allIds = db.$queryRawUnsafe<{id: string}[]>(`
    SELECT id FROM Mencion ORDER BY fechaCaptura DESC
  `).then(r => r.map(x => x.id));
  
  const ids = await allIds;
  console.log("Total IDs:", ids.length);
  
  // Test individual records to find which ones fail
  let badCount = 0;
  for (let i = 0; i < Math.min(ids.length, 399); i++) {
    try {
      await db.mencion.findFirst({ where: { id: ids[i] } });
    } catch(e: any) {
      badCount++;
      if (badCount <= 5) {
        console.log("BAD ID:", ids[i], "| error:", e.message?.substring(0, 100));
        // Get the raw data for this record
        const raw = await db.$queryRawUnsafe<any[]>(
          `SELECT * FROM Mencion WHERE id = '${ids[i]}'`
        );
        console.log("  Raw data:", JSON.stringify(raw[0]).substring(0, 500));
      }
    }
  }
  console.log("\nTotal bad records:", badCount, "/", ids.length);
  
  await db.$disconnect();
}
main().catch(e => { console.error("FATAL:", e); process.exit(1); });
