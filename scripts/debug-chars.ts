import { Database } from "bun:sqlite";
const db = new Database("prisma/db/custom.db");

// Check for null bytes or non-UTF8 in bad record fields
const badId = 'cmp_ea_1778635642024_7';
const fields = ['id', 'titulo', 'texto', 'url', 'tipoMencion', 'temas', 'textoCompleto', 'comentariosResumen', 'sentimiento', 'tratamientoPeriodistico', 'confianzaClasificacion', 'preguntasFundamentales'];

console.log("Checking for invalid characters in bad record:", badId);
for (const f of fields) {
  const row = db.query(`SELECT ${f} FROM Mencion WHERE id = ?`, [badId]).get() as any;
  const val = String(row[f] ?? '');
  
  // Check for null bytes
  if (val.includes('\x00')) console.log(`  ❌ ${f}: contains null byte`);
  
  // Check for control characters (except \n, \r, \t)
  const hasControl = /[^\x20-\x7E\xA0-\uFFFF\n\r\t]/.test(val);
  if (hasControl) console.log(`  ❌ ${f}: contains control chars, len=${val.length}`);
  
  // Check length
  if (val.length > 0 && val.length < 100) {
    const hex = Buffer.from(val.substring(0,20)).toString('hex');
    console.log(`  ✅ ${f}: len=${val.length} hex=${hex.substring(0,40)}...`);
  }
}

// Compare: check same fields for good record
const goodId = 'cmp220g9a0017kq0aoxrbdcdw';
console.log("\nChecking for invalid characters in good record:", goodId);
for (const f of fields) {
  const row = db.query(`SELECT ${f} FROM Mencion WHERE id = ?`, [goodId]).get() as any;
  const val = String(row[f] ?? '');
  
  const hasControl = /[^\x20-\x7E\xA0-\uFFFF\n\r\t]/.test(val);
  if (hasControl) console.log(`  ❌ ${f}: contains control chars, len=${val.length}`);
  
  if (val.length > 0 && val.length < 100) {
    const hex = Buffer.from(val.substring(0,20)).toString('hex');
    console.log(`  ✅ ${f}: len=${val.length} hex=${hex.substring(0,40)}...`);
  }
}

// Try to reproduce Prisma error with a minimal query
console.log("\n=== Trying Prisma with raw column selection ===");
const { PrismaClient } = require("@prisma/client");
process.env.DATABASE_URL = "file:" + process.cwd() + "/prisma/db/custom.db";
const prisma = new PrismaClient();

// Test: select only specific fields (not all)
try {
  const r = await prisma.mencion.findFirst({
    where: { id: badId },
    select: { id: true, titulo: true }
  });
  console.log("select {id, titulo} OK:", r?.id);
} catch(e: any) {
  console.log("select {id, titulo} FAILED:", e.code);
}

// Test: add fechaCaptura
try {
  const r = await prisma.mencion.findFirst({
    where: { id: badId },
    select: { id: true, titulo: true, fechaCaptura: true }
  });
  console.log("select {id, titulo, fechaCaptura} OK:", r?.id);
} catch(e: any) {
  console.log("select {id, titulo, fechaCaptura} FAILED:", e.code);
}

// Test: add preguntasFundamentales
try {
  const r = await prisma.mencion.findFirst({
    where: { id: badId },
    select: { id: true, titulo: true, preguntasFundamentales: true }
  });
  console.log("select {id, titulo, preguntasFundamentales} OK:", r?.id);
} catch(e: any) {
  console.log("select {id, titulo, preguntasFundamentales} FAILED:", e.code);
}

await prisma.$disconnect();
