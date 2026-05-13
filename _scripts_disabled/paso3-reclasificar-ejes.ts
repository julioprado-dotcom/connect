/**
 * PASO 3: Re-clasificación de menciones existentes → Ejes Estructurales
 * ===================================================================
 * 51 menciones tienen MencionLente pero NO MencionTema.
 * Este script las scorea contra keywords de ejes y crea los links.
 * SIN IA/LLM — keyword matching puro.
 * SIN fetch — solo DB local.
 */

import { Database } from 'bun:sqlite';
const db = new Database('/home/z/my-project/prisma/db/custom.db');

// Load all eje keywords
const ejeKw: { termino: string; ejeId: string; ejeNombre: string }[] = [];
for (const r of db.query(`
  SELECT k.termino, k.ejeId, e.nombre as ejeNombre
  FROM Keyword k JOIN EjeTematico e ON e.id = k.ejeId
  WHERE k.activo = 1 AND k.ejeId IS NOT NULL AND e.tipo = 'estructural'
`).all() as any[]) ejeKw.push(r);

console.log(`Eje keywords cargados: ${ejeKw.length}`);

// Build keyword→ejeId map
const kwToEjes = new Map<string, Set<string>>();
for (const kw of ejeKw) {
  const n = kw.termino.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s-]/g, ' ').trim();
  if (n.length < 3) continue;
  if (!kwToEjes.has(n)) kwToEjes.set(n, new Set());
  kwToEjes.get(n)!.add(kw.ejeId);
}

// Get mentions WITHOUT MencionTema
const sinEje = db.query(`
  SELECT m.id, m.titulo, m.textoCompleto
  FROM Mencion m
  WHERE m.id NOT IN (SELECT DISTINCT mencionId FROM MencionTema)
  AND m.textoCompleto IS NOT NULL AND length(m.textoCompleto) > 100
`).all() as any[];

console.log(`Menciones sin MencionTema: ${sinEje.length}\n`);

// Also check mentions WITH MencionLente but could use more ejes
const conLenteSinEje = db.query(`
  SELECT m.id, m.titulo, m.textoCompleto
  FROM Mencion m
  JOIN MencionLente ml ON ml.mencionId = m.id
  WHERE m.id NOT IN (SELECT DISTINCT mencionId FROM MencionTema)
  AND m.textoCompleto IS NOT NULL AND length(m.textoCompleto) > 100
`).all() as any[];

console.log(`De esas, con MencionLente: ${conLenteSinEje.length}\n`);

const allToClassify = new Map<string, { titulo: string; texto: string }>();
for (const m of sinEje) {
  allToClassify.set(m.id, { titulo: m.titulo, texto: m.textoCompleto });
}

console.log(`Total a clasificar: ${allToClassify.size}`);

// Score each mention
let totalLinks = 0;
const ejeDist = new Map<string, number>();
let processed = 0;

for (const [mencionId, data] of allToClassify) {
  const fullText = (data.titulo + ' ' + data.texto).substring(0, 5000);
  const n = fullText.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s-]/g, ' ').trim();

  const matchedEjes = new Map<string, number>(); // ejeId → match count

  for (const [term, ejes] of kwToEjes) {
    if (n.includes(term)) {
      for (const eid of ejes) {
        matchedEjes.set(eid, (matchedEjes.get(eid) || 0) + 1);
      }
    }
  }

  if (matchedEjes.size === 0) continue;

  // Create MencionTema links (min 1 keyword match)
  for (const [ejeId, count] of matchedEjes) {
    const ejeName = ejeKw.find(k => k.ejeId === ejeId)?.ejeNombre || ejeId;
    try {
      db.query(`INSERT OR IGNORE INTO MencionTema (id, mencionId, ejeTematicoId) VALUES (?, ?, ?)`).run(
        `mt_p3_${mencionId.substring(0,8)}_${ejeId.substring(0,6)}`, mencionId, ejeId
      );
      totalLinks++;
      ejeDist.set(ejeName, (ejeDist.get(ejeName) || 0) + 1);
    } catch {}
  }

  processed++;
  const ejesStr = Array.from(matchedEjes.entries())
    .map(([eid, c]) => `${ejeKw.find(k => k.ejeId === eid)?.ejeNombre?.substring(0,20) || eid}(${c})`)
    .join(', ');
  process.stdout.write(`  [${processed}/${allToClassify.size}] ${data.titulo.substring(0,50)}... → ${ejesStr}\n`);
}

console.log(`\n═════════════════════════════════════════════`);
console.log(`  PASO 3 RESULTADO`);
console.log(`═════════════════════════════════════════════`);
console.log(`  Menciones clasificadas: ${processed}/${allToClassify.size}`);
console.log(`  Links MencionTema creados: ${totalLinks}`);
console.log('');

console.log('  Distribución por Eje (nuevos links):');
for (const [name, count] of [...ejeDist.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${count} → ${name}`);
}

// Final state
console.log('\n  Estado final ejes estructurales:');
const ejes = db.query(`
  SELECT e.nombre, COUNT(m.id) as c
  FROM EjeTematico e
  LEFT JOIN MencionTema mt ON mt.ejeTematicoId = e.id
  LEFT JOIN Mencion m ON mt.mencionId = m.id
  WHERE e.tipo = 'estructural'
  GROUP BY e.id ORDER BY c ASC
`).all();
for (const e of ejes as any[]) {
  const bar = e.c >= 20 ? '🟢' : e.c >= 10 ? '🟡' : '🔴';
  console.log(`  ${bar} ${e.c} | ${e.nombre}`);
}

db.close();
