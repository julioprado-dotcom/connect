import { Database } from "bun:sqlite";
const db = new Database("prisma/db/custom.db");

// MencionLente.createdAt: text containing integer timestamps
const r1 = db.query(`
  UPDATE MencionLente
  SET createdAt = datetime(CAST(createdAt AS INTEGER) / 1000, 'unixepoch') || '.000Z'
  WHERE createdAt NOT LIKE '____-%' 
    AND createdAt GLOB '[0-9]*'
    AND length(createdAt) >= 10
`).run();
console.log("Fixed MencionLente.createdAt (text-as-int):", r1.changes);

// Check MencionTema
const mtCols = db.query("PRAGMA table_info(MencionTema)").all().map((c: any) => c.name);
console.log("MencionTema columns:", mtCols);

if (mtCols.includes("createdAt")) {
  const r2 = db.query(`
    UPDATE MencionTema
    SET createdAt = datetime(CAST(createdAt AS INTEGER) / 1000, 'unixepoch') || '.000Z'
    WHERE createdAt NOT LIKE '____-%' 
      AND createdAt GLOB '[0-9]*'
      AND length(createdAt) >= 10
  `).run();
  console.log("Fixed MencionTema.createdAt:", r2.changes);
}

// Fix Indicador text-as-int
const r3 = db.query(`
  UPDATE Indicador
  SET fechaCreacion = datetime(CAST(fechaCreacion AS INTEGER) / 1000, 'unixepoch') || '.000Z'
  WHERE typeof(fechaCreacion) = 'integer'
`).run();
console.log("Fixed Indicador.fechaCreacion:", r3.changes);

const r4 = db.query(`
  UPDATE Indicador
  SET fechaActualizacion = datetime(CAST(fechaActualizacion AS INTEGER) / 1000, 'unixepoch') || '.000Z'
  WHERE typeof(fechaActualizacion) = 'integer'
`).run();
console.log("Fixed Indicador.fechaActualizacion:", r4.changes);

// Fix marco_conceptual
const r5 = db.query(`
  UPDATE marco_conceptual
  SET creadoEn = datetime(CAST(creadoEn AS INTEGER) / 1000, 'unixepoch') || '.000Z'
  WHERE typeof(creadoEn) = 'integer'
`).run();
console.log("Fixed marco_conceptual.creadoEn:", r5.changes);

const r6 = db.query(`
  UPDATE marco_conceptual
  SET editadoEn = datetime(CAST(editadoEn AS INTEGER) / 1000, 'unixepoch') || '.000Z'
  WHERE typeof(editadoEn) = 'integer'
`).run();
console.log("Fixed marco_conceptual.editadoEn:", r6.changes);

// Verify MencionLente
const verify = db.query("SELECT typeof(createdAt) as tipo, substr(createdAt,1,25) as val, COUNT(*) as c FROM MencionLente GROUP BY tipo, val").all();
console.log("\nMencionLente.createdAt after fix:");
for (const v of verify) console.log("  ", v.tipo, "|", v.val, "| count:", v.c);

console.log("\n✅ Done");
