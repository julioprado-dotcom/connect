/**
 * PASO 2E: Lider.com.bo (ERBOL) + Kawsachun Coca deep pages
 */
import { Database } from 'bun:sqlite';
const db = new Database('/home/z/my-project/prisma/db/custom.db');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

const lensMap = new Map<string, Set<string>>();
const ejeMap = new Map<string, Set<string>>();
for (const r of db.query(`SELECT k.termino,k.lenteId FROM Keyword k WHERE k.activo=1 AND k.lenteId IS NOT NULL`).all() as any[]) { const n = r.termino.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s-]/g, ' ').trim(); if (n.length < 3) { if (!lensMap.has(n)) lensMap.set(n, new Set()); lensMap.get(n)!.add(r.lenteId); } }
for (const r of db.query(`SELECT k.termino,k.ejeId FROM Keyword k WHERE k.activo=1 AND k.ejeId IS NOT NULL`).all() as any[]) { const n = r.termino.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s-]/g, ' ').trim(); if (n.length < 3) { if (!ejeMap.has(n)) ejeMap.set(n, new Set()); ejeMap.get(n)!.add(r.ejeId); } }

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
function strip(h: string) { return h.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&mdash;/g, '—').replace(/&ndash;/g, '–').replace(/&oacute;/g, 'ó').replace(/&iacute;/g, 'í').replace(/&aacute;/g, 'á').replace(/&eacute;/g, 'é').replace(/&uacute;/g, 'ú').replace(/&ntilde;/g, 'ñ').replace(/&#(\d+);/g, '').replace(/\s+/g, ' ').trim(); }
function norm(t: string) { return t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim(); }

async function fetchP(url: string) { try { const c = new AbortController(); const t = setTimeout(() => c.abort(), 15000); const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'es-BO,es' }, signal: c.signal, redirect: 'follow' }); clearTimeout(t); if (!r.ok) return ''; const tx = await r.text(); return tx.length > 200 ? tx : ''; } catch { return ''; } }

const existingUrls = new Set<string>(db.query(`SELECT url FROM Mencion`).all().map((r: any) => r.url));
const before = (db.query('SELECT COUNT(*) as c FROM Mencion').get() as any).c;
let totalCreated = 0;

// ═══════════════════════════════════════════════════════════════
// PARTE 1: Lider.com.bo (ex-ERBOL)
// ═══════════════════════════════════════════════════════════════
console.log('═══ Lider.com.bo ═══');

// Check/create medio
let liderMedio = db.query("SELECT id, nombre FROM Medio WHERE nombre LIKE '%Lider%' OR nombre LIKE '%ERBOL%' OR url LIKE '%lider.com%'").get() as any;
if (!liderMedio) {
  const id_m = `med_lider_${Date.now()}`;
  db.query(`INSERT INTO Medio (id, nombre, url, tipo, categoria, activo) VALUES (?, ?, ?, ?, ?, 1)`).run(id_m, 'Lider (ERBOL)', 'https://lider.com.bo', 'digital', 'oficial');
  liderMedio = db.query("SELECT id FROM Medio WHERE id = ?", id_m).get() as any;
  console.log('  Created Lider medio');
}
console.log(`  Medio: ${liderMedio.nombre}`);

// Fetch homepage and category pages
const pages = [
  'https://lider.com.bo/',
  'https://lider.com.bo/category/noticias/',
  'https://lider.com.bo/category/nacional/',
  'https://lider.com.bo/category/politica/',
];
const allArticles: { url: string; title: string }[] = [];
const seen = new Set<string>();

for (const pg of pages) {
  process.stdout.write(`  ${pg.split('/').filter(Boolean).slice(-1)[0] || 'home'}... `);
  const html = await fetchP(pg);
  if (!html) { process.stdout.write('fail\n'); await sleep(5000); continue; }

  // Extract date-patterened URLs
  const regex = /href=["'](https?:\/\/lider\.com\.bo\/\d{4}\/\d{2}\/\d{2}\/[^"']+)["']/gi;
  let m;
  let newCount = 0;
  while ((m = regex.exec(html)) !== null) {
    if (seen.has(m[1]) || existingUrls.has(m[1])) continue;
    seen.add(m[1]);
    const ctx = html.substring(Math.max(0, m.index - 300), m.index + 500);
    const hMatch = ctx.match(/<h[2-6][^>]*>([^<]{15,150})</i);
    const title = hMatch ? strip(hMatch[1]).trim() : '';
    allArticles.push({ url: m[1], title });
    newCount++;
  }
  process.stdout.write(`${newCount} new\n`);
  await sleep(5000);
}

// Deduplicate
const unique = new Map<string, { url: string; title: string }>();
for (const a of allArticles) { const slug = a.url.split('/').filter(Boolean).slice(-1)[0] || a.url; if (!unique.has(slug)) unique.set(slug, a); }
const toProcess = Array.from(unique.values()).slice(0, 10);
console.log(`  Processing: ${toProcess.length} unique articles\n`);

for (let i = 0; i < toProcess.length; i++) {
  const art = toProcess[i];
  process.stdout.write(`  [${i+1}/${toProcess.length}] ${art.title.substring(0,55)}... `);
  await sleep(8000);

  const html = await fetchP(art.url);
  if (!html) { process.stdout.write('no HTML\n'); continue; }
  const body = strip(html);
  if (body.length < 400) { process.stdout.write(`corto (${body.length})\n`); continue; }

  const tm = html.match(/<title>([^<]+)<\/title>/i);
  const pageTitle = tm ? strip(tm[1]).replace(/\s*\|.*$/, '').trim() : art.title;
  if (pageTitle.length < 15) { process.stdout.write('no title\n'); continue; }

  const dm = art.url.match(/\/(\d{4})\/(\d{2})\/(\d{2})\//);
  const dateStr = dm ? `${dm[1]}-${dm[2]}-${dm[3]}` : '';

  const n = norm(pageTitle + ' ' + body.substring(0, 4000));
  const matchedLens = new Set<string>(), matchedEjes = new Set<string>();
  for (const [term, ids] of lensMap) { if (n.includes(term)) for (const id of ids) matchedLens.add(id); }
  for (const [term, ids] of ejeMap) { if (n.includes(term)) for (const id of ids) matchedEjes.add(id); }
  const score = matchedLens.size + matchedEjes.size;
  const lensNames: string[] = [];
  for (const lid of matchedLens) { const r = db.query('SELECT nombre FROM Lente WHERE id=?').get(lid) as any; if (r) lensNames.push(r.nombre); }

  if (score === 0 && body.length < 800) { process.stdout.write('score 0 corto\n'); continue; }

  try {
    const id_m = `cmp_ld_${Date.now()}_${i}`;
    db.query(`INSERT INTO Mencion (id,medioId,titulo,texto,textoCompleto,url,fechaCaptura,fechaPublicacion,tipoMencion,enlaceActivo,temas) VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(
      id_m, liderMedio.id, pageTitle.substring(0,300), body.substring(0,1000), body.substring(0,8000), art.url, new Date().toISOString(), dateStr ? dateStr+'T12:00:00' : null, 'mencion_pasiva', 1, lensNames.join(',').substring(0,200)
    );
    for (const lid of matchedLens) db.query(`INSERT OR IGNORE INTO MencionLente (id,mencionId,lenteId,createdAt) VALUES (?,?,?,?)`).run(`ml_ld_${i}_${lid.substring(0,6)}`, id_m, lid, new Date().toISOString());
    for (const eid of matchedEjes) db.query(`INSERT OR IGNORE INTO MencionTema (id,mencionId,ejeTematicoId) VALUES (?,?,?)`).run(`mt_ld_${i}_${eid.substring(0,6)}`, id_m, eid);
    totalCreated++;
    process.stdout.write(`✅ score:${score} [${lensNames.join(',')}] ${dateStr}\n`);
  } catch(e: any) { process.stdout.write(`err\n`); }
}

// ═══════════════════════════════════════════════════════════════
// FINAL
// ═══════════════════════════════════════════════════════════════
const after = (db.query('SELECT COUNT(*) as c FROM Mencion').get() as any).c;
console.log(`\n═══ RESULTADO: ${totalCreated} | DB: ${before}→${after} (+${after-before})`);

const lens = db.query(`SELECT l.nombre,COUNT(ml.id) as c FROM Lente l LEFT JOIN MencionLente ml ON ml.lenteId=l.id GROUP BY l.id ORDER BY c DESC`).all();
console.log('\nLentes:');
for (const l of lens as any[]) console.log(`  ${l.nombre}: ${l.c}`);

const ejes = db.query(`SELECT e.nombre,COUNT(mt.id) as c FROM EjeTematico e LEFT JOIN MencionTema mt ON mt.ejeTematicoId=e.id LEFT JOIN Mencion m ON mt.mencionId=m.id WHERE e.tipo='estructural' GROUP BY e.id ORDER BY c DESC`).all();
console.log('\nEjes:');
for (const e of ejes as any[]) { const bar = e.c >= 30 ? '🟢' : e.c >= 15 ? '🟡' : e.c >= 5 ? '🟠' : '🔴'; console.log(`  ${bar} ${e.c} | ${e.nombre}`); }

db.close();
