/**
 * PASO 2F-2: El Alteño — /{section}/{YYYYMMDD}/{slug}
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
async function fetchP(url: string) { try { const c = new AbortController(); const t = setTimeout(() => c.abort(), 18000); const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'es-BO,es;q=0.9' }, signal: c.signal, redirect: 'follow' }); clearTimeout(t); if (!r.ok) return ''; const tx = await r.text(); return tx.length > 200 ? tx : ''; } catch { return ''; } }

const eaMedio = db.query(`SELECT id, nombre FROM Medio WHERE url LIKE '%elalteno%'`).get() as any;
console.log(`Medio: ${eaMedio?.nombre || 'NOT FOUND'}`);
if (!eaMedio) process.exit(1);

const existingUrls = new Set<string>(db.query(`SELECT url FROM Mencion`).all().map((r: any) => r.url));
const before = (db.query('SELECT COUNT(*) as c FROM Mencion').get() as any).c;

const relRegex = /href=["'](\/(?:bolivia|ciudad|sociedad|mundo|seguridad|accion)\/(20\d{6})\/([^"']+))["']/gi;
const BASE = 'https://www.elalteno.com.bo';
const dateUrls = new Map<string, string>();

const pages = ['https://www.elalteno.com.bo/', 'https://www.elalteno.com.bo/bolivia', 'https://www.elalteno.com.bo/sociedad'];
for (const pg of pages) {
  process.stdout.write(`Scanning ${pg.split('/').pop() || 'home'}... `);
  const html = await fetchP(pg);
  if (!html) { process.stdout.write('fail\n'); continue; }
  let m; let newCount = 0;
  while ((m = relRegex.exec(html)) !== null) {
    const fullUrl = BASE + m[1];
    if (!existingUrls.has(fullUrl) && !dateUrls.has(fullUrl)) {
      const rawDate = m[2];
      dateUrls.set(fullUrl, `${rawDate.substring(0, 4)}-${rawDate.substring(4, 6)}-${rawDate.substring(6, 8)}`);
      newCount++;
    }
  }
  process.stdout.write(`${newCount} new\n`);
  await sleep(3000);
}

const urlList = [...dateUrls.entries()];
console.log(`\nTotal new articles: ${urlList.length}`);
let created = 0;

for (let i = 0; i < Math.min(urlList.length, 8); i++) {
  const [url, dateStr] = urlList[i];
  process.stdout.write(`[${i + 1}/${Math.min(urlList.length, 8)}] ${url.split('/').pop()?.substring(0, 50)}... `);
  await sleep(7000 + Math.floor(Math.random() * 2000));
  const html = await fetchP(url);
  if (!html) { process.stdout.write('noHTML\n'); continue; }
  const body = strip(html);
  if (body.length < 400) { process.stdout.write(`corto(${body.length})\n`); continue; }
  const tm = html.match(/<title>([^<]+)<\/title>/i);
  let pageTitle = tm ? strip(tm[1]).replace(/\s*[|\-–—].*$/, '').trim() : '';
  if (pageTitle.length < 15) { const h1 = html.match(/<h1[^>]*>([^<]{15,200})<\/h1>/i); if (h1) pageTitle = strip(h1[1]); }
  if (pageTitle.length < 15) { process.stdout.write('noTitle\n'); continue; }
  const n = norm(pageTitle + ' ' + body.substring(0, 4000));
  const matchedLens = new Set<string>(), matchedEjes = new Set<string>();
  for (const [term, ids] of lensMap) { if (n.includes(term)) for (const id of ids) matchedLens.add(id); }
  for (const [term, ids] of ejeMap) { if (n.includes(term)) for (const id of ids) matchedEjes.add(id); }
  const score = matchedLens.size + matchedEjes.size;
  const lensNames: string[] = [];
  for (const lid of matchedLens) { const r = db.query('SELECT nombre FROM Lente WHERE id=?').get(lid) as any; if (r) lensNames.push(r.nombre); }
  if (score === 0 && body.length < 800) { process.stdout.write('s0corto\n'); continue; }
  try {
    const id_m = `cmp_ea_${Date.now()}_${i}`;
    db.query(`INSERT INTO Mencion (id,medioId,titulo,texto,textoCompleto,url,fechaCaptura,fechaPublicacion,tipoMencion,enlaceActivo,temas) VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(
      id_m, eaMedio.id, pageTitle.substring(0, 300), body.substring(0, 1000), body.substring(0, 8000), url, new Date().toISOString(), dateStr + 'T12:00:00', 'mencion_pasiva', 1, lensNames.join(',').substring(0, 200)
    );
    for (const lid of matchedLens) db.query(`INSERT OR IGNORE INTO MencionLente (id,mencionId,lenteId,createdAt) VALUES (?,?,?,?)`).run(`ml_ea_${i}_${lid.substring(0, 6)}`, id_m, lid, new Date().toISOString());
    for (const eid of matchedEjes) db.query(`INSERT OR IGNORE INTO MencionTema (id,mencionId,ejeTematicoId) VALUES (?,?,?)`).run(`mt_ea_${i}_${eid.substring(0, 6)}`, id_m, eid);
    created++;
    process.stdout.write(`✅ s:${score} [${lensNames.slice(0, 3).join(',')}] ${dateStr}\n`);
  } catch (e) { process.stdout.write('err\n'); }
}

const after = (db.query('SELECT COUNT(*) as c FROM Mencion').get() as any).c;
console.log(`\nEl Alteño: ${created} | DB: ${before}→${after} (+${after - before})`);
db.close();
