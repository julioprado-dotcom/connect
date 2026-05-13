/**
 * PASO 2B-1: Captura eju.tv (solo)
 * ==================================
 */
import { Database } from 'bun:sqlite';
const db = new Database('/home/z/my-project/prisma/db/custom.db');
const DELAY = 6000;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

// Keywords
const lensMap = new Map<string, Set<string>>();
const ejeMap = new Map<string, Set<string>>();
for (const r of db.query(`SELECT k.termino,k.lenteId FROM Keyword k WHERE k.activo=1 AND k.lenteId IS NOT NULL`).all() as any[]) {
  const n = r.termino.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  if (n.length < 3) continue;
  if (!lensMap.has(n)) lensMap.set(n, new Set());
  lensMap.get(n)!.add(r.lenteId);
}
for (const r of db.query(`SELECT k.termino,k.ejeId FROM Keyword k WHERE k.activo=1 AND k.ejeId IS NOT NULL`).all() as any[]) {
  const n = r.termino.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  if (n.length < 3) continue;
  if (!ejeMap.has(n)) ejeMap.set(n, new Set());
  ejeMap.get(n)!.add(r.ejeId);
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
function norm(t: string) { return t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim(); }
function strip(h: string) { return h.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&mdash;/g, '—').replace(/&ndash;/g, '–').replace(/&#(\d+);/g, '').replace(/\s+/g, ' ').trim(); }

async function fetchP(url: string) {
  try {
    const c = new AbortController(); const t = setTimeout(() => c.abort(), 15000);
    const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'es-BO,es' }, signal: c.signal, redirect: 'follow' });
    clearTimeout(t); if (!r.ok) return ''; const tx = await r.text(); return tx.length > 200 ? tx : '';
  } catch { return ''; }
}

const ejuMedio = db.query("SELECT id, nombre FROM Medio WHERE nombre LIKE '%eju%'").get() as any;
if (!ejuMedio) { console.log('❌ eju.tv not found'); process.exit(1); }
console.log(`Medio: ${ejuMedio.nombre}`);

const existingUrls = new Set<string>(db.query(`SELECT url FROM Mencion`).all().map((r: any) => r.url));
const before = (db.query('SELECT COUNT(*) as c FROM Mencion').get() as any).c;

// Fetch categories that are likely to have relevant content
const catUrls = [
  'https://eju.tv/category/nacional/',
  'https://eju.tv/category/economia/',
  'https://eju.tv/category/politica/',
];

const allArticles: { url: string; title: string }[] = [];
const seen = new Set<string>();

for (const catUrl of catUrls) {
  console.log(`Fetching ${catUrl}...`);
  const html = await fetchP(catUrl);
  if (!html) { console.log('  → failed'); continue; }
  
  // Extract article links
  const regex = /href=["'](https?:\/\/eju\.tv\/\d{4}\/\d{2}\/[^"']+)["']/gi;
  let m;
  while ((m = regex.exec(html)) !== null) {
    const url = m[1];
    if (seen.has(url)) continue;
    seen.add(url);
    // Get title from nearby text
    const afterHtml = html.substring(m.index, m.index + 500);
    const titleMatch = afterHtml.match(/title=["']([^"']+)["']/);
    const title = titleMatch ? strip(titleMatch[1]) : url.split('/').pop()?.replace(/-/g, ' ') || '';
    allArticles.push({ url, title });
  }
  console.log(`  → ${regex.lastIndex > 0 ? 'found articles' : 'no articles'}`);
  await sleep(DELAY);
}

console.log(`\nTotal article URLs found: ${allArticles.length}`);

// Process top 6
const toProcess = allArticles.slice(0, 6);
let created = 0;

for (let i = 0; i < toProcess.length; i++) {
  const art = toProcess[i];
  process.stdout.write(`[${i+1}/${toProcess.length}] ${art.title.substring(0,55)}... `);
  if (existingUrls.has(art.url)) { process.stdout.write('dup\n'); continue; }

  await sleep(DELAY);
  const html = await fetchP(art.url);
  if (!html) { process.stdout.write('no HTML\n'); continue; }
  const body = strip(html);
  if (body.length < 400) { process.stdout.write(`corto (${body.length})\n`); continue; }

  const dm = art.url.match(/\/(\d{4})\/(\d{2})\/(\d{2})\//);
  const dateStr = dm ? `${dm[1]}-${dm[2]}-${dm[3]}` : '';

  const n = norm(art.title + ' ' + body.substring(0, 4000));
  const matchedLens = new Set<string>();
  const matchedEjes = new Set<string>();
  for (const [term, ids] of lensMap) { if (n.includes(term)) for (const id of ids) matchedLens.add(id); }
  for (const [term, ids] of ejeMap) { if (n.includes(term)) for (const id of ids) matchedEjes.add(id); }
  const score = matchedLens.size + matchedEjes.size;

  const lensNames: string[] = [];
  for (const lid of matchedLens) { const r = db.query('SELECT nombre FROM Lente WHERE id=?').get(lid) as any; if (r) lensNames.push(r.nombre); }

  if (score === 0 && body.length < 800) { process.stdout.write('score 0, corto\n'); continue; }

  try {
    const id_m = `cmp_eju_${Date.now()}_${i}`;
    db.query(`INSERT INTO Mencion (id,medioId,titulo,texto,textoCompleto,url,fechaCaptura,fechaPublicacion,tipoMencion,enlaceActivo,temas) VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(
      id_m, ejuMedio.id, strip(art.title).substring(0,300), body.substring(0,1000), body.substring(0,8000), art.url, new Date().toISOString(), dateStr ? dateStr+'T12:00:00' : null, 'mencion_pasiva', 1, lensNames.join(',').substring(0,200)
    );
    for (const lid of matchedLens) db.query(`INSERT OR IGNORE INTO MencionLente (id,mencionId,lenteId,createdAt) VALUES (?,?,?,?)`).run(`ml_eju_${i}_${lid.substring(0,6)}`, id_m, lid, new Date().toISOString());
    for (const eid of matchedEjes) db.query(`INSERT OR IGNORE INTO MencionTema (id,mencionId,ejeTematicoId) VALUES (?,?,?)`).run(`mt_eju_${i}_${eid.substring(0,6)}`, id_m, eid);
    created++;
    process.stdout.write(`✅ score:${score} [${lensNames.join(',')}] (${body.length} chars)\n`);
  } catch(e: any) { process.stdout.write(`err: ${String(e).substring(0,40)}\n`); }
}

const after = (db.query('SELECT COUNT(*) as c FROM Mencion').get() as any).c;
console.log(`\n═══ eju.tv: ${created} creadas | DB: ${before}→${after} (+${after-before})`);
db.close();
