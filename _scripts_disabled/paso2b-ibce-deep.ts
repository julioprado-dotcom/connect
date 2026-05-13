/**
 * PASO 2B-2: IBCE batch profundo (IDs 934→920)
 * ===============================================
 */
import { Database } from 'bun:sqlite';
const db = new Database('/home/z/my-project/prisma/db/custom.db');
const DELAY = 6000;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

const lensMap = new Map<string, Set<string>>();
const ejeMap = new Map<string, Set<string>>();
for (const r of db.query(`SELECT k.termino,k.lenteId FROM Keyword k WHERE k.activo=1 AND k.lenteId IS NOT NULL`).all() as any[]) { const n = r.termino.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim(); if (n.length < 3) { if (!lensMap.has(n)) lensMap.set(n, new Set()); lensMap.get(n)!.add(r.lenteId); } }
for (const r of db.query(`SELECT k.termino,k.ejeId FROM Keyword k WHERE k.activo=1 AND k.ejeId IS NOT NULL`).all() as any[]) { const n = r.termino.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim(); if (n.length < 3) { if (!ejeMap.has(n)) ejeMap.set(n, new Set()); ejeMap.get(n)!.add(r.ejeId); } }

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
function strip(h: string) { return h.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&mdash;/g, '—').replace(/&ndash;/g, '–').replace(/&oacute;/g, 'ó').replace(/&iacute;/g, 'í').replace(/&aacute;/g, 'á').replace(/&eacute;/g, 'é').replace(/&uacute;/g, 'ú').replace(/&ntilde;/g, 'ñ').replace(/&#(\d+);/g, '').replace(/\s+/g, ' ').trim(); }

async function fetchP(url: string) { try { const c = new AbortController(); const t = setTimeout(() => c.abort(), 15000); const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'es-BO,es' }, signal: c.signal, redirect: 'follow' }); clearTimeout(t); if (!r.ok) return ''; const tx = await r.text(); return tx.length > 200 ? tx : ''; } catch { return ''; } }

const ibceMedio = db.query("SELECT id, nombre FROM Medio WHERE nombre LIKE '%IBCE%'").get() as any;
const existingUrls = new Set<string>(db.query(`SELECT url FROM Mencion`).all().map((r: any) => r.url));
const before = (db.query('SELECT COUNT(*) as c FROM Mencion').get() as any).c;
console.log(`IBCE: ${ibceMedio?.nombre} | Existing: ${existingUrls.size} | Total: ${before}`);

let created = 0;
for (let id = 934; id >= 920; id--) {
  const url = `https://ibce.org.bo/noticias-detalle.php?idNot=${id}`;
  process.stdout.write(`#${id}... `);
  if (existingUrls.has(url)) { process.stdout.write('dup\n'); continue; }

  await sleep(DELAY);
  const html = await fetchP(url);
  if (!html) { process.stdout.write('empty\n'); continue; }

  const tm = html.match(/<title>([^<]+)<\/title>/i);
  if (!tm) { process.stdout.write('no title\n'); continue; }
  let title = strip(tm[1]).replace(/\s*[-–—]\s*IBCE\s*$/i, '').trim();
  if (!title || title.length < 10) { process.stdout.write('invalid\n'); continue; }

  const dm = html.match(/class="date">(\d{1,2})<\/span>[\s\S]*?class="month">([^<]+)/i);
  let dateStr = '';
  if (dm) { const day = dm[1].padStart(2,'0'); const raw = dm[2].replace(/<br\s*\/?>/gi,' ').replace(/<\/?strong>/gi,'').trim(); const yr = (raw.match(/(\d{4})/) || ['','2025'])[1]; const mp = raw.replace(/\d{4}/g,'').trim().toLowerCase(); const ms: Record<string,string> = {enero:'01',febrero:'02',marzo:'03',abril:'04',mayo:'05',junio:'06',julio:'07',agosto:'08',septiembre:'09',octubre:'10',noviembre:'11',diciembre:'12'}; dateStr = `${yr}-${ms[mp]||'01'}-${day}`; }

  const ps: string[] = [];
  const pr = /<p[^>]*>([\s\S]*?)<\/p>/gi; let pm;
  while ((pm = pr.exec(html)) !== null) { const t = strip(pm[1]).trim(); if (t.length > 25) ps.push(t); }
  const body = ps.join(' ');
  const fullText = (title + ' ' + body).substring(0, 5000);
  const n = fullText.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s-]/g, ' ').trim();

  const matchedLens = new Set<string>(), matchedEjes = new Set<string>();
  for (const [term, ids] of lensMap) { if (n.includes(term)) for (const id2 of ids) matchedLens.add(id2); }
  for (const [term, ids] of ejeMap) { if (n.includes(term)) for (const id2 of ids) matchedEjes.add(id2); }
  const score = matchedLens.size + matchedEjes.size;

  const lensNames: string[] = [];
  for (const lid of matchedLens) { const r = db.query('SELECT nombre FROM Lente WHERE id=?').get(lid) as any; if (r) lensNames.push(r.nombre); }

  if (score === 0 && body.length < 600) { process.stdout.write(`score 0 corto\n`); continue; }

  try {
    const id_m = `cmp_ibce_${id}_${Date.now()}`;
    db.query(`INSERT INTO Mencion (id,medioId,titulo,texto,textoCompleto,url,fechaCaptura,fechaPublicacion,tipoMencion,enlaceActivo,temas) VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(
      id_m, ibceMedio.id, title.substring(0,300), body.substring(0,1000), body.substring(0,8000), url, new Date().toISOString(), dateStr ? dateStr+'T12:00:00' : null, 'mencion_pasiva', 1, lensNames.join(',').substring(0,200)
    );
    for (const lid of matchedLens) db.query(`INSERT OR IGNORE INTO MencionLente (id,mencionId,lenteId,createdAt) VALUES (?,?,?,?)`).run(`ml_ibce_${id}_${lid.substring(0,6)}`, id_m, lid, new Date().toISOString());
    for (const eid of matchedEjes) db.query(`INSERT OR IGNORE INTO MencionTema (id,mencionId,ejeTematicoId) VALUES (?,?,?)`).run(`mt_ibce_${id}_${eid.substring(0,6)}`, id_m, eid);
    created++;
    process.stdout.write(`✅ [${lensNames.join(',')}] (${body.length}c)\n`);
  } catch(e: any) { process.stdout.write(`err\n`); }
}

const after = (db.query('SELECT COUNT(*) as c FROM Mencion').get() as any).c;
console.log(`\n═══ IBCE: ${created} nuevas | DB: ${before}→${after} (+${after-before})`);

const lens = db.query(`SELECT l.nombre,COUNT(ml.id) as c FROM Lente l LEFT JOIN MencionLente ml ON ml.lenteId=l.id GROUP BY l.id ORDER BY c DESC`).all();
console.log('\nDistribución lentes:');
for (const l of lens as any[]) console.log(`  ${l.nombre}: ${l.c}`);
db.close();
