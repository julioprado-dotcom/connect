import { Database } from "bun:sqlite";
const db = new Database("prisma/db/custom.db");

// Check every scalar field for problematic data
// The model has: id, personaId, medioId, titulo, texto, url, fechaPublicacion, fechaCaptura,
// tipoMencion, temas, reach, verificado, fechaCreacion, enlaceActivo, fechaVerificacion,
// textoCompleto, comentariosCount, comentariosResumen, sentimiento, tratamientoPeriodistico,
// confianzaClasificacion, preguntasFundamentales, esDuplicado

console.log("=== Checking preguntasFundamentales (Json?) ===");
const badJson = db.query(`
  SELECT id, typeof(preguntasFundamentales) as tipo, substr(preguntasFundamentales,1,80) as pf, substr(titulo,1,40) as tit
  FROM Mencion
  WHERE preguntasFundamentales IS NOT NULL 
    AND typeof(preguntasFundamentales) != 'text'
  LIMIT 10
`).all();
console.log("Non-text preguntasFundamentales:", badJson.length);
for (const b of badJson) console.log("  tipo:", b.tipo, "|", b.pf, "|", b.tit);

// Check for invalid JSON strings
const invalidJson = db.query(`
  SELECT id, preguntasFundamentales, substr(titulo,1,40) as tit
  FROM Mencion
  WHERE preguntasFundamentales IS NOT NULL 
    AND preguntasFundamentales != ''
    AND preguntasFundamentales NOT LIKE '{%'
    AND preguntasFundamentales NOT LIKE '[%'
  LIMIT 10
`).all();
console.log("\nNon-JSON preguntasFundamentales:", invalidJson.length);
for (const i of invalidJson) console.log("  val:", String(i.preguntasFundamentales).substring(0,60), "|", i.tit);

// Check confianzaClasificacion for weird values
console.log("\n=== Checking confianzaClasificacion ===");
const conf = db.query(`
  SELECT DISTINCT confianzaClasificacion, COUNT(*) as c
  FROM Mencion
  WHERE confianzaClasificacion IS NOT NULL
  GROUP BY confianzaClasificacion
`).all();
for (const c of conf) console.log("  ", c.confianzaClasificacion, ":", c.c);

// Check tratamientoPeriodistico 
console.log("\n=== Checking tratamientoPeriodistico ===");
const tp = db.query(`
  SELECT DISTINCT tratamientoPeriodistico, COUNT(*) as c
  FROM Mencion
  WHERE tratamientoPeriodistico IS NOT NULL
  GROUP BY tratamientoPeriodistico
  ORDER BY c DESC
`).all();
for (const t of tp) console.log("  ", t.tratamientoPeriodistico, ":", t.c);

// Check tipoMencion
console.log("\n=== Checking tipoMencion ===");
const tm = db.query(`
  SELECT DISTINCT tipoMencion, COUNT(*) as c
  FROM Mencion
  GROUP BY tipoMencion
  ORDER BY c DESC
`).all();
for (const t of tm) console.log("  ", t.tipoMencion, ":", t.c);

// Check reach (Int field)
console.log("\n=== Checking reach ===");
const badReach = db.query(`
  SELECT id, typeof(reach) as tipo, reach, substr(titulo,1,40) as tit
  FROM Mencion
  WHERE typeof(reach) != 'integer' AND typeof(reach) != 'real'
  LIMIT 10
`).all();
console.log("Non-numeric reach:", badReach.length);
for (const b of badReach) console.log("  tipo:", b.tipo, "| val:", b.reach, "|", b.tit);

// Check textoCompleto for non-text
console.log("\n=== Checking textoCompleto ===");
const badText = db.query(`
  SELECT id, typeof(textoCompleto) as tipo, substr(textoCompleto,1,60) as tc, substr(titulo,1,40) as tit
  FROM Mencion
  WHERE typeof(textoCompleto) != 'text' AND textoCompleto IS NOT NULL
  LIMIT 10
`).all();
console.log("Non-text textoCompleto:", badText.length);

// Check for NULL in required fields
console.log("\n=== Checking NULLs in required fields ===");
const nulls = db.query(`
  SELECT COUNT(*) as c FROM Mencion WHERE medioId IS NULL
`).get();
console.log("NULL medioId:", nulls.c);
const nulls2 = db.query(`
  SELECT COUNT(*) as c FROM Mencion WHERE titulo IS NULL
`).get();
console.log("NULL titulo:", nulls2.c);
const nulls3 = db.query(`
  SELECT COUNT(*) as c FROM Mencion WHERE fechaCaptura IS NULL
`).get();
console.log("NULL fechaCaptura:", nulls3.c);

// Check for medioId pointing to non-existent medio
console.log("\n=== Checking FK integrity ===");
const badFK = db.query(`
  SELECT COUNT(*) as c FROM Mencion m
  WHERE NOT EXISTS (SELECT 1 FROM Medio md WHERE md.id = m.medioId)
`).get();
console.log("Broken medioId FK:", badFK.c);

const badFK2 = db.query(`
  SELECT COUNT(*) as c FROM Mencion m
  WHERE m.personaId IS NOT NULL 
    AND NOT EXISTS (SELECT 1 FROM Persona p WHERE p.id = m.personaId)
`).get();
console.log("Broken personaId FK:", badFK2.c);

// Check all field types for ANY row
console.log("\n=== Complete type check (all fields) ===");
const typesRow = db.query(`
  SELECT 
    typeof(id) as id_t, typeof(personaId) as pid_t, typeof(medioId) as mid_t,
    typeof(titulo) as tit_t, typeof(texto) as txt_t, typeof(url) as url_t,
    typeof(fechaPublicacion) as fp_t, typeof(fechaCaptura) as fc_t,
    typeof(tipoMencion) as tm_t, typeof(temas) as temas_t,
    typeof(reach) as reach_t, typeof(verificado) as ver_t,
    typeof(fechaCreacion) as fcr_t, typeof(enlaceActivo) as ea_t,
    typeof(textoCompleto) as tc_t, typeof(comentariosCount) as cc_t,
    typeof(comentariosResumen) as cr_t, typeof(sentimiento) as sent_t,
    typeof(tratamientoPeriodistico) as tp_t,
    typeof(confianzaClasificacion) as conf_t,
    typeof(esDuplicado) as dup_t
  FROM Mencion LIMIT 1
`).get();
console.log(typesRow);
