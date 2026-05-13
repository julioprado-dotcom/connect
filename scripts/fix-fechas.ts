/**
 * Fix: Convert 238 Mencion records with space-separated fechaCaptura
 * from "YYYY-MM-DD HH:MM:SS" to ISO 8601 "YYYY-MM-DDTHH:MM:SS.000Z"
 * This fixes Prisma DateTime ordering/conversion errors.
 */
import { Database } from "bun:sqlite";

const db = new Database("prisma/db/custom.db");

// 1. Count affected records
const count = db.query(`
  SELECT COUNT(*) as c FROM Mencion 
  WHERE fechaCaptura LIKE '____-__-__ __:__:__' 
    AND fechaCaptura NOT LIKE '%T%'
`).get();
console.log(`Records with space-format fechaCaptura: ${count.c}`);

// 2. Show sample before
const before = db.query(`
  SELECT id, fechaCaptura, substr(titulo,1,50) as tit 
  FROM Mencion 
  WHERE fechaCaptura LIKE '____-__-__ __:__:__' 
    AND fechaCaptura NOT LIKE '%T%'
  LIMIT 3
`).all();
console.log("\nBEFORE:");
for (const b of before) console.log(`  ${b.fechaCaptura} | ${b.tit}`);

// 3. Fix: replace space with T, add .000Z
const result = db.query(`
  UPDATE Mencion 
  SET fechaCaptura = replace(fechaCaptura, ' ', 'T') || '.000Z'
  WHERE fechaCaptura LIKE '____-__-__ __:__:__' 
    AND fechaCaptura NOT LIKE '%T%'
`).run();
console.log(`\nUpdated: ${result.changes} rows`);

// 4. Also fix fechaCreacion if needed (same issue)
const fcCount = db.query(`
  SELECT COUNT(*) as c FROM Mencion 
  WHERE fechaCreacion LIKE '____-__-__ __:__:__' 
    AND fechaCreacion NOT LIKE '%T%'
`).get();
if (fcCount.c > 0) {
  const fcResult = db.query(`
    UPDATE Mencion 
    SET fechaCreacion = replace(fechaCreacion, ' ', 'T') || '.000Z'
    WHERE fechaCreacion LIKE '____-__-__ __:__:__' 
      AND fechaCreacion NOT LIKE '%T%'
  `).run();
  console.log(`Also fixed fechaCreacion: ${fcResult.changes} rows`);
}

// 5. Verify after
const after = db.query(`
  SELECT id, fechaCaptura, substr(titulo,1,50) as tit 
  FROM Mencion 
  WHERE id = ?
`).get(before[0].id);
console.log("\nAFTER:");
console.log(`  ${after.fechaCaptura} | ${after.tit}`);

// 6. Verify no more space-format dates remain
const remaining = db.query(`
  SELECT COUNT(*) as c FROM Mencion 
  WHERE fechaCaptura LIKE '____-__-__ __:__:__' 
    AND fechaCaptura NOT LIKE '%T%'
`).get();
console.log(`\nRemaining space-format fechaCaptura: ${remaining.c}`);

// 7. Also fix fechaPublicacion if needed  
const fpCount = db.query(`
  SELECT COUNT(*) as c FROM Mencion 
  WHERE fechaPublicacion IS NOT NULL
    AND typeof(fechaPublicacion) = 'text'
    AND fechaPublicacion LIKE '____-__-__ __:__:__' 
    AND fechaPublicacion NOT LIKE '%T%'
`).get();
if (fpCount.c > 0) {
  const fpResult = db.query(`
    UPDATE Mencion 
    SET fechaPublicacion = replace(fechaPublicacion, ' ', 'T') || '.000Z'
    WHERE fechaPublicacion IS NOT NULL
      AND typeof(fechaPublicacion) = 'text'
      AND fechaPublicacion LIKE '____-__-__ __:__:__' 
      AND fechaPublicacion NOT LIKE '%T%'
  `).run();
  console.log(`Also fixed fechaPublicacion: ${fpResult.changes} rows`);
}

console.log("\n✅ Date format fix complete");
