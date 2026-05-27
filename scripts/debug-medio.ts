import { Database } from "bun:sqlite";
const db = new Database("prisma/db/custom.db");

// Check the Medio records for bad IDs
const badMedios = db.query(`
  SELECT m.id as mid, m.nombre, m.tipo, m.nivel, m.activo,
    typeof(m.fechaCreacion) as fcTipo, m.fechaCreacion
  FROM Mencion mn
  JOIN Medio m ON m.id = mn.medioId
  WHERE mn.id = 'cmp_ea_1778635642024_7'
`).all();
console.log("Medio for bad record:");
for (const m of badMedios) console.log("  ", m);

const goodMedios = db.query(`
  SELECT m.id as mid, m.nombre, m.tipo, m.nivel, m.activo,
    typeof(m.fechaCreacion) as fcTipo, m.fechaCreacion
  FROM Mencion mn
  JOIN Medio m ON m.id = mn.medioId
  WHERE mn.id = 'cmp220g9a0017kq0aoxrbdcdw'
`).all();
console.log("\nMedio for good record:");
for (const m of goodMedios) console.log("  ", m);

// Check Medio table schema
console.log("\n=== Medio table schema ===");
const schema = db.query("PRAGMA table_info(Medio)").all();
for (const s of schema) console.log("  ", s.name, s.type);

// Check for bad medio dates
console.log("\n=== Medio date check ===");
const badMedioDates = db.query(`
  SELECT id, nombre, typeof(fechaCreacion) as fcTipo, fechaCreacion, typeof(fechaActualizacion) as faTipo, fechaActualizacion
  FROM Medio
  WHERE typeof(fechaCreacion) != 'text' 
     OR (fechaCreacion IS NOT NULL AND fechaCreacion NOT LIKE '____-__-%%')
  LIMIT 10
`).all();
console.log("Bad medio dates:", badMedioDates.length);
for (const m of badMedioDates) console.log("  ", m.id, m.nombre, "fcTipo:", m.fcTipo, "fc:", m.fechaCreacion);

// Check ALL medio date patterns
const medioDatePatterns = db.query(`
  SELECT substr(fechaCreacion, 1, 20) as fc, substr(fechaActualizacion, 1, 20) as fa, COUNT(*) as c
  FROM Medio
  GROUP BY fc, fa
  ORDER BY c DESC
`).all();
console.log("\nMedio date patterns:");
for (const p of medioDatePatterns) console.log("  fc:", p.fc, "| fa:", p.fa, "| count:", p.c);
