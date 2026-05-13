import { Database } from "bun:sqlite";
const db = new Database("prisma/db/custom.db");

// Universal fix: convert ALL space-format dates to T-format in ALL tables
const allTables = db.query("SELECT name FROM sqlite_master WHERE type='table'").all();
let totalFixed = 0;

for (const t of allTables) {
  const tableName = (t as any).name;
  if (tableName.startsWith("sqlite_")) continue;
  
  const cols = db.query(`PRAGMA table_info("${tableName}")`).all();
  for (const c of cols) {
    const col = c as any;
    if (col.type === "DATETIME" || col.type === "datetime") {
      // Fix space-format: "2026-05-12 21:54:24.000Z" -> "2026-05-12T21:54:24.000Z"
      const r = db.query(`
        UPDATE "${tableName}"
        SET "${col.name}" = replace("${col.name}", ' ', 'T')
        WHERE "${col.name}" LIKE '____-__-__ %' 
          AND "${col.name}" NOT LIKE '%T%'
      `).run();
      if (r.changes > 0) {
        console.log(`${tableName}.${col.name}: fixed ${r.changes} space-format dates`);
        totalFixed += r.changes;
      }
      
      // Fix text-as-integer: "1778622864184" -> ISO
      const r2 = db.query(`
        UPDATE "${tableName}"
        SET "${col.name}" = datetime(CAST("${col.name}" AS INTEGER) / 1000, 'unixepoch') || '.000Z'
        WHERE "${col.name}" NOT LIKE '____-%'
          AND "${col.name}" GLOB '[0-9]*'
          AND length("${col.name}") >= 13
      `).run();
      if (r2.changes > 0) {
        console.log(`${tableName}.${col.name}: fixed ${r2.changes} text-as-int dates`);
        totalFixed += r2.changes;
      }
    }
  }
}
console.log(`\n✅ Total fixes: ${totalFixed}`);
