import { Database } from "bun:sqlite";
const db = new Database("prisma/db/custom.db");

// Check all tables with DateTime fields for integer timestamps
const tables = [
  { table: "MencionLente", fields: ["createdAt", "updatedAt"] },
  { table: "MencionTema", fields: ["createdAt", "updatedAt"] },
  { table: "Lente", fields: ["createdAt", "updatedAt"] },
  { table: "EjeTematico", fields: ["createdAt", "updatedAt"] },
  { table: "Medio", fields: ["createdAt"] },
  { table: "Persona", fields: ["createdAt", "updatedAt"] },
  { table: "Keyword", fields: ["createdAt", "updatedAt"] },
];

for (const t of tables) {
  for (const f of t.fields) {
    // Check if field exists
    const colInfo = db.query(`PRAGMA table_info("${t.table}")`).all();
    const col = colInfo.find((c: any) => c.name === f);
    if (!col) continue;
    
    // Check for integer timestamps
    const intRows = db.query(`
      SELECT COUNT(*) as c FROM "${t.table}"
      WHERE typeof("${f}") = 'integer'
    `).get() as any;
    
    if (intRows.c > 0) {
      console.log(`${t.table}.${f}: ${intRows.c} integer timestamps`);
      
      // Fix: convert integer timestamps to ISO 8601
      const result = db.query(`
        UPDATE "${t.table}"
        SET "${f}" = datetime("${f}" / 1000, 'unixepoch') || '.000Z'
        WHERE typeof("${f}") = 'integer'
      `).run();
      console.log(`  Fixed: ${result.changes} rows`);
    }
    
    // Also check for space-format dates
    const spaceRows = db.query(`
      SELECT COUNT(*) as c FROM "${t.table}"
      WHERE "${f}" LIKE '____-__-__ __:__:__' AND "${f}" NOT LIKE '%T%'
    `).get() as any;
    
    if (spaceRows.c > 0) {
      console.log(`${t.table}.${f}: ${spaceRows.c} space-format dates`);
      const result = db.query(`
        UPDATE "${t.table}"
        SET "${f}" = replace("${f}", ' ', 'T') || '.000Z'
        WHERE "${f}" LIKE '____-__-__ __:__:__' AND "${f}" NOT LIKE '%T%'
      `).run();
      console.log(`  Fixed: ${result.changes} rows`);
    }
  }
}

// Also check Reporte and other operational tables
const opTables = ["Reporte", "CapturaLog", "Job", "Comentario"];
for (const t of opTables) {
  const colInfo = db.query(`PRAGMA table_info("${t.table}")`).all();
  for (const col of colInfo) {
    const c = col as any;
    if (c.type === "DATETIME" || c.type === "datetime") {
      const intRows = db.query(`
        SELECT COUNT(*) as c FROM "${t.table}" WHERE typeof("${c.name}") = 'integer'
      `).get() as any;
      if (intRows.c > 0) {
        console.log(`${t.table}.${c.name}: ${intRows.c} integer timestamps`);
        const result = db.query(`
          UPDATE "${t.table}"
          SET "${c.name}" = datetime("${c.name}" / 1000, 'unixepoch') || '.000Z'
          WHERE typeof("${c.name}") = 'integer'
        `).run();
        console.log(`  Fixed: ${result.changes} rows`);
      }
      
      const spaceRows = db.query(`
        SELECT COUNT(*) as c FROM "${t.table}"
        WHERE "${c.name}" LIKE '____-__-__ __:__:__' AND "${c.name}" NOT LIKE '%T%'
      `).get() as any;
      if (spaceRows.c > 0) {
        console.log(`${t.table}.${c.name}: ${spaceRows.c} space-format`);
        const result = db.query(`
          UPDATE "${t.table}"
          SET "${c.name}" = replace("${c.name}", ' ', 'T') || '.000Z'
          WHERE "${c.name}" LIKE '____-__-__ __:__:__' AND "${c.name}" NOT LIKE '%T%'
        `).run();
        console.log(`  Fixed: ${result.changes} rows`);
      }
    }
  }
}

console.log("\n✅ All date fixes complete");
