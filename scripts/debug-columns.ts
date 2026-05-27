import { Database } from "bun:sqlite";
const db = new Database("prisma/db/custom.db");

// Check the extra columns for bad records
const extraCols = ['mencionOriginalId', 'mediosRelacionados', 'eventoId', 'coberturasAdicionales', 'deduplicacionLog', 'intencionMedio', 'ejeEstructuralId'];

console.log("=== Extra column data for bad records ===");
for (const col of extraCols) {
  const rows = db.query(`
    SELECT ${col}, typeof(${col}) as tipo, COUNT(*) as c
    FROM Mencion
    GROUP BY ${col}
    ORDER BY c DESC
    LIMIT 5
  `).all();
  console.log(`\n${col}:`);
  for (const r of rows) {
    console.log(`  tipo=${r.tipo} val="${String(r[col]).substring(0,50)}" count=${r.c}`);
  }
}

// Check if a good record has these columns populated
console.log("\n=== Extra columns for a GOOD record ===");
const goodExtra = db.query(`
  SELECT mencionOriginalId, mediosRelacionados, eventoId, coberturasAdicionales, 
         deduplicacionLog, intencionMedio, ejeEstructuralId
  FROM Mencion WHERE id = 'cmp220g9a0017kq0aoxrbdcdw'
`).get();
console.log(goodExtra);

console.log("\n=== Extra columns for a BAD record ===");
const badExtra = db.query(`
  SELECT mencionOriginalId, mediosRelacionados, eventoId, coberturasAdicionales, 
         deduplicacionLog, intencionMedio, ejeEstructuralId
  FROM Mencion WHERE id = 'cmp_ea_1778635642024_7'
`).get();
console.log(badExtra);
