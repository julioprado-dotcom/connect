import { Database } from "bun:sqlite";
const db = new Database("prisma/db/custom.db");

const rows = db.query("SELECT id, nombre, typeof(createdAt) as tipo, createdAt FROM Lente LIMIT 3").all();
console.log("Lente createdAt samples:");
for (const r of rows) console.log("  ", r.tipo, "|", r.createdAt, "|", r.nombre);

// Check ALL tables for integer timestamps
const allTables = db.query("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log("\nScanning all tables for integer DateTime fields...");
for (const t of allTables) {
  const cols = db.query(`PRAGMA table_info("${(t as any).name}")`).all();
  for (const c of cols) {
    const col = c as any;
    if (col.type === "DATETIME" || col.type === "datetime") {
      const intCount = db.query(`SELECT COUNT(*) as c FROM "${(t as any).name}" WHERE typeof("${col.name}") = 'integer'`).get() as any;
      if (intCount.c > 0) {
        console.log(`  ❌ ${(t as any).name}.${col.name}: ${intCount.c} INTEGER timestamps`);
        // Show sample
        const sample = db.query(`SELECT "${col.name}" FROM "${(t as any).name}" WHERE typeof("${col.name}") = 'integer' LIMIT 1`).get() as any;
        console.log(`     Sample: ${sample[col.name]}`);
      }
    }
  }
}
