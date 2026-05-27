import { Database } from "bun:sqlite";
const db = new Database("prisma/db/custom.db");

// Get full raw data of a bad record
const bad = db.query(`
  SELECT * FROM Mencion WHERE id = 'cmp_ea_1778635642024_7'
`).get();

// Get a good record for comparison
const good = db.query(`
  SELECT * FROM Mencion WHERE id = 'cmp220g9a0017kq0aoxrbdcdw'
`).get();

console.log("=== BAD RECORD (cmp_ea_*) ===");
for (const [k, v] of Object.entries(bad)) {
  const val = String(v ?? "NULL");
  const goodVal = String((good as any)[k] ?? "NULL");
  if (val !== goodVal && k !== 'id' && k !== 'titulo' && k !== 'texto' && k !== 'url' && k !== 'textoCompleto') {
    console.log(`  ${k}: "${val.substring(0,80)}" vs GOOD: "${goodVal.substring(0,80)}"`);
  } else if (k === 'titulo') {
    console.log(`  titulo: "${val.substring(0,60)}"`);
  }
}

// Check all DateTime fields specifically
console.log("\n=== DateTime fields comparison ===");
const dtFields = ['fechaPublicacion', 'fechaCaptura', 'fechaCreacion', 'fechaVerificacion'];
for (const f of dtFields) {
  const badVal = (bad as any)[f];
  const goodVal = (good as any)[f];
  console.log(`  ${f}: BAD="${badVal}" | GOOD="${goodVal}"`);
}

// Check preguntasFundamentales for bad records
console.log("\n=== preguntasFundamentales in bad records ===");
const pfBad = db.query(`
  SELECT id, typeof(preguntasFundamentales) as tipo, preguntasFundamentales
  FROM Mencion 
  WHERE id IN ('cmp_ea_1778635642024_7', 'cmp_kc_1778633243046_0', 'cmp_br_1778634605162_0')
`).all();
for (const r of pfBad) {
  console.log(`  ${r.id}: tipo=${r.tipo} val=${String(r.preguntasFundamentales).substring(0,100)}`);
}

// Check the schema of Mencion table 
console.log("\n=== Table schema ===");
const schema = db.query(`PRAGMA table_info(Mencion)`).all();
for (const s of schema) {
  console.log(`  ${s.name}: ${s.type} ${s.notnull ? 'NOT NULL' : 'NULLABLE'} ${s.dflt_value ? 'DEFAULT '+s.dflt_value : ''}`);
}
