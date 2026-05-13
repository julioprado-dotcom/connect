/**
 * PASO 2C-1: Kawsachun Coca SOLO (10 artículos)
 */
import { Database } from 'bun:sqlite';
const db = new Database('/home/z/my-project/prisma/db/custom.db');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

const lensMap = new Map<string, Set<string>>();
const ejeMap = new Map<string, Set<string>>();
for (const r of db.query(`SELECT k.termino,k.lenteId FROM Keyword k WHERE k.activo=1 AND k.lenteId IS NOT NULL`).all() as any[]) { const n = r.termino.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s-]/g, ' ').trim(); if (n.length < 3) { if (!lensMap.has(n)) lensMap.set(n, new Set()); lensMap.get(n)!.add(r.lenteId); } }
for (const r of db.query(`SELECT k.termino,k.ejeId FROM Keyword k WHERE k.activo=1 AND k.ejeId IS NOT NULL`).all() as any[]) { const n = r.termino.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s-]/g, ' ').trim(); if (n.length < 3) { if (!ejeMap.has(n)) ejeMap.set(n, new Set()); ejeMap.get(n)!.add(r.ejeId); } }

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
function norm(t: string) { return t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim(); }
function strip(h: string) { return h.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&mdash;/g, '—').replace(/&ndash;/g, '–').replace(/&oacute;/g, 'ó').replace(/&iacute;/g, 'í').replace(/&aacute;/g, 'á').replace(/&eacute;/g, 'é').replace(/&uacute;/g, 'ú').replace(/&ntilde;/g, 'ñ').replace(/&#(\d+);/g, '').replace(/\s+/g, ' ').trim(); }

async function fetchP(url: string) { try { const c = new AbortController(); const t = setTimeout(() => c.abort(), 15000); const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'es-BO,es' }, signal: c.signal, redirect: 'follow' }); clearTimeout(t); if (!r.ok) return ''; const tx = await r.text(); return tx.length > 200 ? tx : ''; } catch { return ''; } }

const medio = db.query("SELECT id, nombre FROM Medio WHERE nombre LIKE '%Kawsachun%' OR nombre LIKE '%kawsachun%'").get() as any;
if (!medio) { console.log('❌ Kawsachun not found'); process.exit(1); }
console.log(`Medio: ${medio.nombre}`);
const existingUrls = new Set<string>(db.query(`SELECT url FROM Mencion`).all().map((r: any) => r.url));
const before = (db.query('SELECT COUNT(*) as c FROM Mencion').get() as any).c;

// Fetch homepage only
console.log('\nFetching homepage...');
const html = await fetchP('https://kawsachuncoca.com/');
if (!html) { console.log('❌ Failed'); process.exit(1); }
console.log(`OK: ${(html.length/1024).toFixed(0)}KB`);

const regex = /href=["'](https?:\/\/kawsachuncoca\.com\/noticias\/ver\/[^"']+)["']/gi;
const seen = new Set<string>();
const articles: { url: string; title: string }[] = [];
let m;
while ((m = regex.exec(html)) !== null) {
  if (seen.has(m[1])) continue;
  seen.add(m[1]);
  const ctx = html.substring(Math.max(0, m.index - 200), m.index + 500);
  const hMatch = ctx.match(/<h[2-6][^>]*>([^<]{10,150})<\/h/i);
  const title = hMatch ? strip(hMatch[1]).trim() : '';
  articles.push({ url: m[1], title });
}
console.log(`Articles found: ${articles.length}\n`);

let created = 0;
const toProcess = articles.slice(0, 10);

for (let i = 0; i < toProcess.length; i++) {
  const art = toProcess[i];
  process.stdout.write(`[${i+1}/${toProcess.length}] ${art.title.substring(0,55)}... `);
  if (existingUrls.has(art.url)) { process.stdout.write('dup\n'); continue; }

  await sleep(8000);
  const artHtml = await fetchP(art.url);
  if (!artHtml) { process.stdout.write('no HTML\n'); continue; }
  const body = strip(artHtml);
  if (body.length < 400) { process.stdout.write(`corto (${body.length})\n`); continue; }

  const tm = artHtml.match(/<title>([^<]+)<\/title>/i);
  const pageTitle = tm ? strip(tm[1]).replace(/\s*\|.*$/, '').trim() : art.title;
  if (pageTitle.length < 15) { process.stdout.write('no title\n'); continue; }

  const dm = body.match(/(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})/i);
  let dateStr = '';
  if (dm) { const ms: Record<string,string> = {enero:'01',febrero:'02',marzo:'03',abril:'04',mayo:'05',junio:'06',julio:'07',agosto:'08',septiembre:'09',octubre:'10',noviembre:'11',diciembre:'12'}; dateStr = `${dm[3]}-${ms[dm[2].toLowerCase()]||'01'}-${dm[1].padStart(2,'0')}`; }

  const n = norm(pageTitle + ' ' + body.substring(0, 4000));
  const matchedLens = new Set<string>(), matchedEjes = new Set<string>();
  for (const [term, ids] of lensMap) { if (n.includes(term)) for (const id of ids) matchedLens.add(id); }
  for (const [term, ids] of ejeMap) { if (n.includes(term)) for (const id of ids) matchedEjes.add(id); }
  const score = matchedLens.size + matchedEjes.size;

  const lensNames: string[] = [];
  for (const lid of matchedLens) { const r = db.query('SELECT nombre FROM Lente WHERE id=?').get(lid) as any; if (r) lensNames.push(r.nombre); }

  // Kawsachun is political — accept almost everything
  if (score === 0 && body.length < 500) { process.stdout.write('score 0 corto\n'); continue; }

  try {
    const id_m = `cmp_kc_${Date.now()}_${i}`;
    db.query(`INSERT INTO Mencion (id,medioId,titulo,texto,textoCompleto,url,fechaCaptura,fechaPublicacion,tipoMencion,enlaceActivo,temas) VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(
      id_m, medio.id, pageTitle.substring(0,300), body.substring(0,1000), body.substring(0,8000), art.url, new Date().toISOString(), dateStr ? dateStr+'T12:00:00' : null, 'mencion_pasiva', 1, lensNames.join(',').substring(0,200)
    );
    for (const lid of matchedLens) db.query(`INSERT OR IGNORE INTO MencionLente (id,mencionId,lenteId,createdAt) VALUES (?,?,?,?)`).run(`ml_kc_${i}_${lid.substring(0,6)}`, id_m, lid, new Date().toISOString());
    for (const eid of matchedEjes) db.query(`INSERT OR IGNORE INTO MencionTema (id,mencionId,ejeTematicoId) VALUES (?,?,?)`).run(`mt_kc_${i}_${eid.substring(0,6)}`, id_m, eid);
    created++;
    process.stdout.write(`✅ score:${score} [${lensNames.join(',')}] (${dateStr})\n`);
  } catch(e: any) { process.stdout.write(`err\n`); }
}

const after = (db.query('SELECT COUNT(*) as c FROM Mencion').get() as any).c;
console.log(`\n═══ Kawsachun: ${created} | DB: ${before}→${after} (+${after-before})`);
db.close();
