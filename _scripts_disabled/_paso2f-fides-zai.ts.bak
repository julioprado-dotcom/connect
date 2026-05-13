/**
 * PASO 2F-3: Noticias Fides + Senado via Z.ai page_reader
 */
import { Database } from 'bun:sqlite';
import { default as ZAI } from 'z-ai-web-dev-sdk';

const db = new Database('/home/z/my-project/prisma/db/custom.db');
const zai = await ZAI.create();

function strip(h: string) { return h.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&mdash;/g, '—').replace(/&ndash;/g, '–').replace(/&oacute;/g, 'ó').replace(/&iacute;/g, 'í').replace(/&aacute;/g, 'á').replace(/&eacute;/g, 'é').replace(/&uacute;/g, 'ú').replace(/&ntilde;/g, 'ñ').replace(/&#(\d+);/g, '').replace(/\s+/g, ' ').trim(); }
function norm(t: string) { return t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim(); }

const lensMap = new Map<string, Set<string>>();
const ejeMap = new Map<string, Set<string>>();
for (const r of db.query(`SELECT k.termino,k.lenteId FROM Keyword k WHERE k.activo=1 AND k.lenteId IS NOT NULL`).all() as any[]) { const n = r.termino.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s-]/g, ' ').trim(); if (n.length < 3) { if (!lensMap.has(n)) lensMap.set(n, new Set()); lensMap.get(n)!.add(r.lenteId); } }
for (const r of db.query(`SELECT k.termino,k.ejeId FROM Keyword k WHERE k.activo=1 AND k.ejeId IS NOT NULL`).all() as any[]) { const n = r.termino.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s-]/g, ' ').trim(); if (n.length < 3) { if (!ejeMap.has(n)) ejeMap.set(n, new Set()); ejeMap.get(n)!.add(r.ejeId); } }

const existingUrls = new Set<string>(db.query(`SELECT url FROM Mencion`).all().map((r: any) => r.url));
const before = (db.query('SELECT COUNT(*) as c FROM Mencion').get() as any).c;

async function zaiFetch(url: string): Promise<{ html: string; title: string } | null> {
  try {
    const result = await zai.functions.invoke('page_reader', { url });
    if (!result?.data?.html) return null;
    return { html: result.data.html, title: result.data.title || '' };
  } catch (e: any) {
    console.log(`  Z.ai error: ${e.message.substring(0, 80)}`);
    return null;
  }
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// ─── Noticias Fides ───
console.log('═══ NOTICIAS FIDES (Z.ai) ═══');
const fidesMedio = db.query(`SELECT id, nombre FROM Medio WHERE nombre LIKE '%Fides%' OR url LIKE '%noticiasfides%'`).get() as any;
if (!fidesMedio) {
  const id = `med_fid_${Date.now()}`;
  db.query(`INSERT INTO Medio (id, nombre, url, tipo, categoria, activo) VALUES (?, ?, ?, ?, ?, 1)`).run(id, 'Noticias Fides', 'https://www.noticiasfides.com', 'digital', 'oficial');
  console.log('Created medio: Noticias Fides');
}

const fidesPage = await zaiFetch('https://www.noticiasfides.com/');
if (fidesPage) {
  console.log(`Z.ai: ${(fidesPage.html.length / 1024).toFixed(0)}KB, title: "${fidesPage.title.substring(0, 50)}"`);
  // Find article links
  const links = fidesPage.html.match(/href=["'](https?:\/\/www\.noticiasfides\.com\/[^"']+)["']/gi) || [];
  const articles = [...new Set(links)].filter(l => {
    const u = l.replace(/href=["']/, '').replace(/["']$/, '');
    return !u.match(/\.(css|js|png|jpg|svg|ico|woff)/i) && u.length > 50 && u !== 'https://www.noticiasfides.com/';
  });
  console.log(`Articles found: ${articles.length}`);
  for (const a of articles.slice(0, 10)) console.log(`  ${a.replace(/href=["']/, '').replace(/["']$/, '').substring(0, 90)}`);
} else {
  console.log('Z.ai failed for Noticias Fides');
}

// ─── Senado ───
console.log('\n═══ SENADO (Z.ai) ═══');
const senadoPage = await zaiFetch('https://www.senado.gob.bo/prensa/noticias');
if (senadoPage) {
  console.log(`Z.ai: ${(senadoPage.html.length / 1024).toFixed(0)}KB, title: "${senadoPage.title.substring(0, 50)}"`);
  const links = senadoPage.html.match(/href=["'](https?:\/\/[^"']+)["']/gi) || [];
  console.log(`Links: ${links.length}`);
  for (const l of [...new Set(links)].slice(0, 15)) console.log(`  ${l.replace(/href=["']/, '').replace(/["']$/, '').substring(0, 90)}`);
} else {
  console.log('Z.ai failed for Senado');
}

// ─── Diputados ───
console.log('\n═══ DIPUTADOS (Z.ai) ═══');
const dipPage = await zaiFetch('https://diputados.gob.bo/prensa-noticias/');
if (dipPage) {
  console.log(`Z.ai: ${(dipPage.html.length / 1024).toFixed(0)}KB, title: "${dipPage.title.substring(0, 50)}"`);
  const links = dipPage.html.match(/href=["'](https?:\/\/[^"']+)["']/gi) || [];
  console.log(`Links: ${links.length}`);
  for (const l of [...new Set(links)].slice(0, 15)) console.log(`  ${l.replace(/href=["']/, '').replace(/["']$/, '').substring(0, 90)}`);
} else {
  console.log('Z.ai failed for Diputados');
}

const after = (db.query('SELECT COUNT(*) as c FROM Mencion').get() as any).c;
console.log(`\nDB: ${before}→${after}`);
db.close();
