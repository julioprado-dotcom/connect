import { Database } from "bun:sqlite";
const db = new Database("prisma/db/custom.db");

// Get ALL distinct fechaCaptura values to find the bad ones
const rows = db.query(`
  SELECT DISTINCT fechaCaptura, COUNT(*) as c
  FROM Mencion
  GROUP BY fechaCaptura
  ORDER BY fechaCaptura
`).all();

console.log("Distinct fechaCaptura values:", rows.length);
for (const r of rows) {
  const val = String(r.fechaCaptura);
  // Try to parse as Date
  const d = new Date(val);
  const valid = !isNaN(d.getTime());
  if (!valid) {
    console.log("❌ INVALID:", val, "| count:", r.c);
  }
}

// Check for non-standard ISO formats (missing T, missing Z, integer timestamps, etc)
const suspicious = db.query(`
  SELECT DISTINCT fechaCaptura, COUNT(*) as c, substr(titulo,1,50) as tit
  FROM Mencion
  WHERE fechaCaptura NOT LIKE '%T%' 
     OR fechaCaptura NOT LIKE '%:%'
     OR length(fechaCaptura) < 15
     OR length(fechaCaptura) > 30
  LIMIT 20
`).all();
console.log("\nSuspicious fechaCaptura:", suspicious.length);
for (const s of suspicious) {
  console.log("  val:", s.fechaCaptura, "| count:", s.c, "|", s.tit);
}

// Also check for any row where fechaCaptura contains non-ASCII
const nonascii = db.query(`
  SELECT id, fechaCaptura, substr(titulo,1,50) as tit
  FROM Mencion
  WHERE fechaCaptura GLOB '*[^!-~]*'
  LIMIT 10
`).all();
console.log("\nNon-ASCII fechaCaptura:", nonascii.length);
for (const n of nonascii) {
  console.log("  hex:", Buffer.from(String(n.fechaCaptura)).toString('hex').substring(0,60), "|", n.tit);
}
