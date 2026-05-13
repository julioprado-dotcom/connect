/**
 * PASO 3 FIX: Re-clasificar menciones con condición CORRECTA (n.length >= 3)
 */
import { Database } from 'bun:sqlite';
const db = new Database('/home/z/my-project/prisma/db/custom.db');

// CORRECT: keep keywords with length >= 3
const lensMap = new Map<string, Set<string>>();
const ejeMap = new Map<string, Set<string>>();
for (const r of db.query(`SELECT k.termino,k.lenteId FROM Keyword k WHERE k.activo=1 AND k.lenteId IS NOT NULL`).all() as any[]) {
  const n = r.termino.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s-]/g, ' ').trim();
  if (n.length < 3) continue; // SKIP short, KEEP long
  if (!lensMap.has(n)) lensMap.set(n, new Set());
  lensMap.get(n)!.add(r.lenteId);
}
for (const r of db.query(`SELECT k.termino,k.ejeId FROM Keyword k WHERE k.activo=1 AND k.ejeId IS NOT NULL`).all() as any[]) {
  const n = r.termino.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s-]/g, ' ').trim();
  if (n.length < 3) continue;
  if (!ejeMap.has(n)) ejeMap.set(n, new Set());
  ejeMap.get(n)!.add(r.ejeId);
}

console.log(`Keywords loaded: ${lensMap.size} lentes, ${ejeMap.size} ejes`);

function norm(t: string) { return t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim(); }

// ─── Re-classify LENTES ───
const sinLentes = db.query(`
  SELECT m.id, m.titulo, m.texto, m.textoCompleto
  FROM Mencion m WHERE m.id NOT IN (SELECT mencionId FROM MencionLente)
`).all() as any[];
console.log(`\nMenciones sin lentes: ${sinLentes.length}`);
let lensAdded = 0;

for (const m of sinLentes) {
  const text = (m.titulo || '') + ' ' + (m.texto || '') + ' ' + (m.textoCompleto || '');
  const n = norm(text.substring(0, 8000));
  const matched = new Set<string>();
  for (const [term, ids] of lensMap) { if (n.includes(term)) for (const id of ids) matched.add(id); }
  if (matched.size > 0) {
    for (const lid of matched) {
      try { db.query(`INSERT OR IGNORE INTO MencionLente (id,mencionId,lenteId,createdAt) VALUES (?,?,?,?)`).run(`ml_rf_${Date.now()}_${lid.substring(0,6)}_${lensAdded}`, m.id, lid, new Date().toISOString()); } catch {}
    }
    const names = [];
    for (const lid of matched) { const r = db.query('SELECT nombre FROM Lente WHERE id=?').get(lid) as any; if (r) names.push(r.nombre); }
    if (lensAdded < 20) process.stdout.write(`  ✅ ${m.titulo?.substring(0,45)} → [${names.join(',')}] (${matched.size})\n`);
    lensAdded++;
  }
}
console.log(`Lentes añadidos: ${lensAdded}/${sinLentes.length}`);

// ─── Re-classify EJES ───
const sinEjes = db.query(`
  SELECT m.id, m.titulo, m.texto, m.textoCompleto
  FROM Mencion m WHERE m.id NOT IN (SELECT mencionId FROM MencionTema)
`).all() as any[];
console.log(`\nMenciones sin ejes: ${sinEjes.length}`);
let ejesAdded = 0;

for (const m of sinEjes) {
  const text = (m.titulo || '') + ' ' + (m.texto || '') + ' ' + (m.textoCompleto || '');
  const n = norm(text.substring(0, 8000));
  const matched = new Set<string>();
  for (const [term, ids] of ejeMap) { if (n.includes(term)) for (const id of ids) matched.add(id); }
  if (matched.size > 0) {
    for (const eid of matched) {
      try { db.query(`INSERT OR IGNORE INTO MencionTema (id,mencionId,ejeTematicoId) VALUES (?,?,?)`).run(`mt_rf_${Date.now()}_${eid.substring(0,6)}_${ejesAdded}`, m.id, eid); } catch {}
    }
    const names = [];
    for (const eid of matched) { const r = db.query('SELECT nombre FROM EjeTematico WHERE id=?').get(eid) as any; if (r) names.push(r.nombre); }
    if (ejesAdded < 20) process.stdout.write(`  ✅ ${m.titulo?.substring(0,45)} → [${names.join(',')}] (${matched.size})\n`);
    ejesAdded++;
  }
}
console.log(`Ejes añadidos: ${ejesAdded}/${sinEjes.length}`);

// ─── FINAL STATE ───
console.log('\n═══ RESULTADO ═══');
const newSinLentes = (db.query(`SELECT COUNT(*) as c FROM Mencion m WHERE m.id NOT IN (SELECT mencionId FROM MencionLente)`).get() as any).c;
const newSinEjes = (db.query(`SELECT COUNT(*) as c FROM Mencion m WHERE m.id NOT IN (SELECT mencionId FROM MencionTema)`).get() as any).c;
console.log(`Sin lentes: ${sinLentes.length} → ${newSinLentes} (-${sinLentes.length - newSinLentes})`);
console.log(`Sin ejes: ${sinEjes.length} → ${newSinEjes} (-${sinEjes.length - newSinEjes})`);

console.log('\n── Lentes ───');
for (const l of db.query(`SELECT l.nombre, COUNT(ml.id) as c FROM Lente l LEFT JOIN MencionLente ml ON ml.lenteId=l.id GROUP BY l.id ORDER BY c DESC`).all() as any[]) {
  const bar = l.c >= 30 ? '🟢' : l.c >= 15 ? '🟡' : l.c >= 5 ? '🟠' : '🔴';
  console.log(`  ${bar} ${String(l.c).padStart(3)} | ${l.nombre}`);
}
console.log('\n── Ejes ───');
for (const e of db.query(`SELECT e.nombre, COUNT(mt.id) as c FROM EjeTematico e LEFT JOIN MencionTema mt ON mt.ejeTematicoId=e.id LEFT JOIN Mencion m ON mt.mencionId=m.id WHERE e.tipo='estructural' GROUP BY e.id ORDER BY c DESC`).all() as any[]) {
  const bar = e.c >= 30 ? '🟢' : e.c >= 15 ? '🟡' : e.c >= 5 ? '🟠' : '🔴';
  console.log(`  ${bar} ${String(e.c).padStart(3)} | ${e.nombre}`);
}
db.close();
