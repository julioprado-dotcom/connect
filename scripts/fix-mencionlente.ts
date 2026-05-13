import { Database } from "bun:sqlite";
const db = new Database("prisma/db/custom.db");

// Check MencionLente createdAt
const ml = db.query("SELECT typeof(createdAt) as tipo, createdAt, COUNT(*) as c FROM MencionLente GROUP BY tipo").all();
console.log("MencionLente.createdAt types:", ml);

// Check MencionTema createdAt
const mt = db.query("SELECT typeof(createdAt) as tipo, createdAt, COUNT(*) as c FROM MencionTema GROUP BY tipo").all();
console.log("MencionTema.createdAt types:", mt);

// Fix MencionLente if needed
const mlInt = db.query("SELECT COUNT(*) as c FROM MencionLente WHERE typeof(createdAt) = 'integer'").get() as any;
if (mlInt.c > 0) {
  const r = db.query(`UPDATE MencionLente SET createdAt = datetime(createdAt / 1000, 'unixepoch') || '.000Z' WHERE typeof(createdAt) = 'integer'`).run();
  console.log("Fixed MencionLente.createdAt:", r.changes);
}

// Fix MencionTema if needed  
const mtInt = db.query("SELECT COUNT(*) as c FROM MencionTema WHERE typeof(createdAt) = 'integer'").get() as any;
if (mtInt.c > 0) {
  const r = db.query(`UPDATE MencionTema SET createdAt = datetime(createdAt / 1000, 'unixepoch') || '.000Z' WHERE typeof(createdAt) = 'integer'`).run();
  console.log("Fixed MencionTema.createdAt:", r.changes);
}

// Also fix Indicador and marco_conceptual
const indFix = db.query(`UPDATE Indicador SET fechaCreacion = datetime(fechaCreacion / 1000, 'unixepoch') || '.000Z' WHERE typeof(fechaCreacion) = 'integer'`).run();
console.log("Fixed Indicador.fechaCreacion:", indFix.changes);
const indFix2 = db.query(`UPDATE Indicador SET fechaActualizacion = datetime(fechaActualizacion / 1000, 'unixepoch') || '.000Z' WHERE typeof(fechaActualizacion) = 'integer'`).run();
console.log("Fixed Indicador.fechaActualizacion:", indFix2.changes);
const mcFix = db.query(`UPDATE marco_conceptual SET creadoEn = datetime(creadoEn / 1000, 'unixepoch') || '.000Z' WHERE typeof(creadoEn) = 'integer'`).run();
console.log("Fixed marco_conceptual.creadoEn:", mcFix.changes);
const mcFix2 = db.query(`UPDATE marco_conceptual SET editadoEn = datetime(editadoEn / 1000, 'unixepoch') || '.000Z' WHERE typeof(editadoEn) = 'integer'`).run();
console.log("Fixed marco_conceptual.editadoEn:", mcFix2.changes);

// Verify
const ml2 = db.query("SELECT typeof(createdAt) as tipo, createdAt, COUNT(*) as c FROM MencionLente GROUP BY tipo").all();
console.log("\nAfter fix MencionLente.createdAt:", ml2);

console.log("\n✅ All fixes done");
