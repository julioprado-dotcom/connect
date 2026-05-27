import { Database } from "bun:sqlite";
const db = new Database("prisma/db/custom.db");

// Check all fechaPublicacion patterns
const patterns = db.query(`
  SELECT substr(fechaPublicacion, 1, 25) as fp, COUNT(*) as c
  FROM Mencion
  WHERE fechaPublicacion IS NOT NULL
  GROUP BY fp
  ORDER BY c DESC
`).all();
console.log("fechaPublicacion patterns:");
for (const p of patterns) console.log("  ", p.fp, "| count:", p.c);

// Check what format Prisma expects
const goodFP = db.query(`
  SELECT fechaPublicacion FROM Mencion 
  WHERE fechaPublicacion IS NOT NULL 
    AND fechaPublicacion LIKE '%.%'
  LIMIT 3
`).all();
console.log("\nGood format (with ms):");
for (const g of goodFP) console.log("  ", g.fechaPublicacion);

// Fix: add .000Z to dates missing them
const fix1 = db.query(`
  UPDATE Mencion
  SET fechaPublicacion = fechaPublicacion || '.000Z'
  WHERE fechaPublicacion IS NOT NULL
    AND fechaPublicacion LIKE '%T%'
    AND fechaPublicacion NOT LIKE '%.%'
`).run();
console.log(`\nFixed (T without ms): ${fix1.changes} rows`);

// Check for any remaining bad dates
const remaining = db.query(`
  SELECT COUNT(*) as c FROM Mencion
  WHERE fechaPublicacion IS NOT NULL
    AND fechaPublicacion NOT LIKE '%.%.%Z'
`).get();
console.log("Remaining non-ISO fechaPublicacion:", remaining.c);

// Verify the fix
const after = db.query(`
  SELECT substr(fechaPublicacion, 1, 25) as fp, COUNT(*) as c
  FROM Mencion
  WHERE fechaPublicacion IS NOT NULL
  GROUP BY fp
  ORDER BY c DESC
`).all();
console.log("\nAfter fix patterns:");
for (const p of after) console.log("  ", p.fp, "| count:", p.c);

console.log("\n✅ fechaPublicacion fix complete");
