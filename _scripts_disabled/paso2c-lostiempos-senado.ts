/**
 * PASO 2C-2: Los Tiempos + Senado
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
// PARTE 1: Los Tiempos
// ═══════════════════════════════════════════════════════════════
console.log('═══ PARTE 1: Los Tiempos ═══');

const ltMedio = db.query("SELECT id, nombre FROM Medio WHERE nombre LIKE '%Los Tiempos%'").get() as any;
if (ltMedio) {
  const cats = [
    'https://www.lostiempos.com/actualidad',
    'https://www.lostiempos.com/politica',
    'https://www.lostiempos.com/economia',
  ];
  const ltArticles: { url: string; title: string }[] = [];
  const seen = new Set<string>();

  for (const catUrl of cats) {
    process.stdout.write(`  Fetching ${catUrl.split('/').pop()}... `);
    const html = await fetchP(catUrl);
    if (!html) { process.stdout.write('fail\n'); continue; }
    // Extract all article links
    const regex = /href=["'](https?:\/\/www\.lostiempos\.com\/(?:actualidad|politica|economia|sociedad)\/[^"']+)["']/gi;
    let m;
    while ((m = regex.exec(html)) !== null) {
      let url = m[1];
      if (seen.has(url)) continue;
      seen.add(url);
      const ctx = html.substring(Math.max(0, m.index - 200), m.index + 400);
      const hMatch = ctx.match(/<h[2-6][^>]*>([^<]{15,150})</i);
      const title = hMatch ? strip(hMatch[1]).trim() : '';
      ltArticles.push({ url, title });
    }
    process.stdout.write(`${ltArticles.length} total\n`);
    await sleep(5000);
  }

  // Deduplicate by slug
  const unique = new Map<string, { url: string; title: string }>();
  for (const a of ltArticles) { const slug = a.url.split('/').filter(Boolean).slice(-1)[0] || a.url; if (!unique.has(slug)) unique.set(slug, a); }
  const toProcess = Array.from(unique.values()).slice(0, 8);
  console.log(`  Processing: ${toProcess.length} articles\n`);

  for (let i = 0; i < toProcess.length; i++) {
    const art = toProcess[i];
    process.stdout.write(`  [${i+1}/${toProcess.length}] ${art.title.substring(0,55)}... `);
    if (existingUrls.has(art.url)) { process.stdout.write('dup\n'); continue; }

    await sleep(8000);
    const artHtml = await fetchP(art.url);
    if (!artHtml) { process.stdout.write('no HTML\n'); continue; }
    const body = strip(artHtml);
    if (body.length < 400) { process.stdout.write(`corto (${body.length})\n`); continue; }

    const tm = artHtml.match(/<title>([^<]+)<\/title>/i);
    const pageTitle = tm ? strip(tm[1]).replace(/\s*\|.*$/, '').trim() : art.title;
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
      const id_m = `cmp_lt_${Date.now()}_${i}`;
      db.query(`INSERT INTO Mencion (id,medioId,titulo,texto,textoCompleto,url,fechaCaptura,fechaPublicacion,tipoMencion,enlaceActivo,temas) VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(
        id_m, ltMedio.id, pageTitle.substring(0,300), body.substring(0,1000), body.substring(0,8000), art.url, new Date().toISOString(), dateStr ? dateStr+'T12:00:00' : null, 'mencion_pasiva', 1, lensNames.join(',').substring(0,200)
      );
      for (const lid of matchedLens) db.query(`INSERT OR IGNORE INTO MencionLente (id,mencionId,lenteId,createdAt) VALUES (?,?,?,?)`).run(`ml_lt_${i}_${lid.substring(0,6)}`, id_m, lid, new Date().toISOString());
      for (const eid of matchedEjes) db.query(`INSERT OR IGNORE INTO MencionTema (id,mencionId,ejeTematicoId) VALUES (?,?,?)`).run(`mt_lt_${i}_${eid.substring(0,6)}`, id_m, eid);
      totalCreated++;
      process.stdout.write(`✅ score:${score} [${lensNames.join(',')}] ${dateStr}\n`);
    } catch(e: any) { process.stdout.write(`err\n`); }
  }
}

// ═══════════════════════════════════════════════════════════════
// PARTE 2: Senado
// ═══════════════════════════════════════════════════════════════
console.log('\n═══ PARTE 2: Senado ═══');

// Check if Senado medio exists, create if not
let senadoMedio = db.query("SELECT id FROM Medio WHERE nombre LIKE '%Senado%' OR url LIKE '%senado.gob.bo%'").get() as any;
if (!senadoMedio) {
  const id_m = `med_senado_${Date.now()}`;
  db.query(`INSERT INTO Medio (id, nombre, url, tipo, categoria, activo) VALUES (?, ?, ?, ?, ?, 1)`).run(id_m, 'Senado de Bolivia', 'https://www.senado.gob.bo', 'institucional', 'oficial');
  senadoMedio = db.query("SELECT id FROM Medio WHERE id = ?", id_m).get() as any;
  console.log('  Created Senado medio');
}

const senadoHtml = await fetchP('https://www.senado.gob.bo/prensa/noticias');
if (senadoHtml && senadoHtml.length > 500) {
  console.log(`  Senado page: ${(senadoHtml.length/1024).toFixed(0)}KB`);
  // Extract article links
  const regex = /href=["'](https?:\/\/www\.senado\.gob\.bo\/[^"']*(?:noticia|prensa|articulo)[^"']*)["']/gi;
  const links: string[] = [];
  let m;
  while ((m = regex.exec(senadoHtml)) !== null) {
    if (!existingUrls.has(m[1])) links.push(m[1]);
  }
  console.log(`  Found ${links.length} new article links`);

  // Also check general links
  const allLinks = senadoHtml.match(/href=["'](https?:\/\/www\.senado\.gob\.bo\/[^"']+)["']/gi) || [];
  console.log(`  Total links on page: ${allLinks.length}`);
  for (const l of allLinks.slice(0, 10)) console.log('    ' + l.replace(/href=["']/, '').replace(/["']$/, ''));
} else {
  console.log(`  Senado: ${(senadoHtml?.length||0)} bytes (probably empty/JS-rendered)`);
}

// ═══════════════════════════════════════════════════════════════
// FINAL
// ═══════════════════════════════════════════════════════════════
const after = (db.query('SELECT COUNT(*) as c FROM Mencion').get() as any).c;
console.log(`\n═══ RESULTADO: ${totalCreated} | DB: ${before}→${after} (+${after-before})`);
db.close();
