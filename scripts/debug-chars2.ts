import { Database } from "bun:sqlite";
const db = new Database("prisma/db/custom.db");

const badId = 'cmp_ea_1778635642024_7';
const goodId = 'cmp220g9a0017kq0aoxrbdcdw';

// Get all column names
const cols = db.query("PRAGMA table_info(Mencion)").all().map((c: any) => c.name);
console.log("Total columns:", cols.length);

// Check each column for both records
for (const f of cols) {
  const badRow = db.query(`SELECT "${f}" as val FROM Mencion WHERE id = ?`, [badId]).get() as any;
  const goodRow = db.query(`SELECT "${f}" as val FROM Mencion WHERE id = ?`, [goodId]).get() as any;
  
  const badVal = badRow ? String(badRow.val ?? '') : 'ROW_NOT_FOUND';
  const goodVal = goodRow ? String(goodRow.val ?? '') : 'ROW_NOT_FOUND';
  
  // Check for null bytes
  if (badVal.includes('\x00')) console.log(`❌ BAD ${f}: NULL BYTE`);
  if (goodVal.includes('\x00')) console.log(`❌ GOOD ${f}: NULL BYTE`);
  
  // Check type
  const badType = db.query(`SELECT typeof("${f}") as t FROM Mencion WHERE id = ?`, [badId]).get() as any;
  if (badType && badType.t === 'blob') console.log(`❌ BAD ${f}: BLOB type`);
  
  // Short summary
  if (badVal !== goodVal && f !== 'id' && f !== 'titulo' && f !== 'texto' && f !== 'url' && f !== 'textoCompleto') {
    console.log(`  ${f}: BAD="${badVal.substring(0,50)}" GOOD="${goodVal.substring(0,50)}"`);
  }
}

// Now test Prisma with selective fields
console.log("\n=== Prisma selective field tests ===");
const { PrismaClient } = require("@prisma/client");
process.env.DATABASE_URL = "file:" + process.cwd() + "/prisma/db/custom.db";
const prisma = new PrismaClient();

// Add fields one by one to find which one breaks
const fieldsToTest = [
  { name: 'id+titulo', select: { id: true, titulo: true } },
  { name: '+texto', select: { id: true, titulo: true, texto: true } },
  { name: '+url', select: { id: true, titulo: true, url: true } },
  { name: '+fechaPublicacion', select: { id: true, titulo: true, fechaPublicacion: true } },
  { name: '+fechaCaptura', select: { id: true, titulo: true, fechaCaptura: true } },
  { name: '+tipoMencion', select: { id: true, titulo: true, tipoMencion: true } },
  { name: '+temas', select: { id: true, titulo: true, temas: true } },
  { name: '+reach', select: { id: true, titulo: true, reach: true } },
  { name: '+verificado', select: { id: true, titulo: true, verificado: true } },
  { name: '+fechaCreacion', select: { id: true, titulo: true, fechaCreacion: true } },
  { name: '+enlaceActivo', select: { id: true, titulo: true, enlaceActivo: true } },
  { name: '+textoCompleto', select: { id: true, titulo: true, textoCompleto: true } },
  { name: '+comentariosCount', select: { id: true, titulo: true, comentariosCount: true } },
  { name: '+comentariosResumen', select: { id: true, titulo: true, comentariosResumen: true } },
  { name: '+sentimiento', select: { id: true, titulo: true, sentimiento: true } },
  { name: '+tratamientoPeriodistico', select: { id: true, titulo: true, tratamientoPeriodistico: true } },
  { name: '+confianzaClasificacion', select: { id: true, titulo: true, confianzaClasificacion: true } },
  { name: '+preguntasFundamentales', select: { id: true, titulo: true, preguntasFundamentales: true } },
  { name: '+esDuplicado', select: { id: true, titulo: true, esDuplicado: true } },
];

for (const test of fieldsToTest) {
  try {
    await prisma.mencion.findFirst({ where: { id: badId }, select: test.select as any });
    console.log(`✅ ${test.name}`);
  } catch(e: any) {
    console.log(`❌ ${test.name}: ${e.code}`);
    break; // Stop at first failure
  }
}

await prisma.$disconnect();
