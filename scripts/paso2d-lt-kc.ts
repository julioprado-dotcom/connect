/**
 * PASO 2D: Los Tiempos (Drupal pattern) + Senado
 * Usa patrones exactos de retroactive-extract.ts
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
// PARTE 1: Los Tiempos — Drupal pattern: /actualidad/.../YYYYMMDD/...
// ═══════════════════════════════════════════════════════════════
console.log('═══ Los Tiempos (Drupal) ═══');

const ltMedio = db.query("SELECT id, nombre FROM Medio WHERE nombre LIKE '%Los Tiempos%'").get() as any;
if (ltMedio) {
  const homepage = await fetchP('https://www.lostiempos.com/');
  if (homepage) {
    // Pattern from retroactive-extract.ts: /actualidad/{...}/{YYYYMMDD}/{slug}
    const ltPattern = /href="(\/actualidad\/[^"]+\/20[0-9]{5}\/[^"]+)"/gi;
    const articles: string[] = [];
    let m;
    while ((m = ltPattern.exec(homepage)) !== null) {
      const url = 'https://www.lostiempos.com' + m[1];
      if (!existingUrls.has(url)) articles.push(url);
    }
    // Also try generic article pattern
    const ltPattern2 = /href="(https?:\/\/www\.lostiempos\.com\/(?:actualidad|politica|economia|sociedad)\/[^"]+)"/gi;
    while ((m = ltPattern2.exec(homepage)) !== null) {
      const url = m[1];
      if (!existingUrls.has(url) && !articles.includes(url) && !url.includes('ultimas-noticias') && !url.includes('/author/')) articles.push(url);
    }
    // Deduplicate
    const unique = [...new Set(articles)];
    console.log(`  Found ${unique.length} new article URLs`);
    for (const u of unique.slice(0, 5)) console.log('    ' + u.substring(0, 80));

    // Process top 6
    const toProcess = unique.slice(0, 6);
    for (let i = 0; i < toProcess.length; i++) {
      const url = toProcess[i];
      process.stdout.write(`  [${i+1}/${toProcess.length}] ${url.split('/').pop()?.substring(0,50)}... `);
      await sleep(8000);

      const html = await fetchP(url);
      if (!html) { process.stdout.write('no HTML\n'); continue; }
      const body = strip(html);
      if (body.length < 400) { process.stdout.write(`corto (${body.length})\n`); continue; }

      const tm = html.match(/<title>([^<]+)<\/title>/i);
      const pageTitle = tm ? strip(tm[1]).replace(/\s*\|.*$/, '').trim() : '';
      if (pageTitle.length < 15) { process.stdout.write('no title\n'); continue; }

      const dm = url.match(/\/(20\d{5})\//);
      let dateStr = '';
      if (dm) dateStr = `${dm[1].substring(0,4)}-${dm[1].substring(4,6)}-${dm[1].substring(6,8)}`;

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
          id_m, ltMedio.id, pageTitle.substring(0,300), body.substring(0,1000), body.substring(0,8000), url, new Date().toISOString(), dateStr ? dateStr+'T12:00:00' : null, 'mencion_pasiva', 1, lensNames.join(',').substring(0,200)
        );
        for (const lid of matchedLens) db.query(`INSERT OR IGNORE INTO MencionLente (id,mencionId,lenteId,createdAt) VALUES (?,?,?,?)`).run(`ml_lt2_${i}_${lid.substring(0,6)}`, id_m, lid, new Date().toISOString());
        for (const eid of matchedEjes) db.query(`INSERT OR IGNORE INTO MencionTema (id,mencionId,ejeTematicoId) VALUES (?,?,?)`).run(`mt_lt2_${i}_${eid.substring(0,6)}`, id_m, eid);
        totalCreated++;
        process.stdout.write(`✅ score:${score} [${lensNames.join(',')}] ${dateStr}\n`);
      } catch(e: any) { process.stdout.write(`err\n`); }
    }
  } else {
    console.log('  ❌ No response');
  }
}

// ═══════════════════════════════════════════════════════════════
// PARTE 2: Kawsachun Coca pages 2-3 (new articles)
// ═══════════════════════════════════════════════════════════════
console.log('\n═══ Kawsachun Coca (pages 2-3 + category) ═══');
const kcMedio = db.query("SELECT id, nombre FROM Medio WHERE nombre LIKE '%Kawsachun%'").get() as any;
if (kcMedio) {
  const pages = [
    'https://kawsachuncoca.com/page/2/',
    'https://kawsachuncoca.com/page/3/',
    'https://kawsachuncoca.com/category/nacional/',
    'https://kawsachuncoca.com/category/politica/',
  ];
  const allArticles: { url: string; title: string }[] = [];
  const seen = new Set<string>();

  for (const pg of pages) {
    process.stdout.write(`  ${pg.split('/').filter(Boolean).slice(-2).join('/')}... `);
    const html = await fetchP(pg);
    if (!html) { process.stdout.write('fail\n'); continue; }
    const regex = /href=["'](https?:\/\/kawsachuncoca\.com\/noticias\/ver\/[^"']+)["']/gi;
    let m;
    let newCount = 0;
    while ((m = regex.exec(html)) !== null) {
      if (seen.has(m[1]) || existingUrls.has(m[1])) continue;
      seen.add(m[1]);
      const ctx = html.substring(Math.max(0, m.index - 200), m.index + 500);
      const hMatch = ctx.match(/<h[2-6][^>]*>([^<]{10,150})<\/h/i);
      allArticles.push({ url: m[1], title: hMatch ? strip(hMatch[1]).trim() : '' });
      newCount++;
    }
    process.stdout.write(`${newCount} new\n`);
    await sleep(5000);
  }

  console.log(`  Total new: ${allArticles.length}`);
  const toProcess = allArticles.slice(0, 8);

  for (let i = 0; i < toProcess.length; i++) {
    const art = toProcess[i];
    process.stdout.write(`  [${i+1}/${toProcess.length}] ${art.title.substring(0,55)}... `);
    await sleep(8000);
    const html = await fetchP(art.url);
    if (!html) { process.stdout.write('no HTML\n'); continue; }
    const body = strip(html);
    if (body.length < 400) { process.stdout.write(`corto\n`); continue; }
    const tm = html.match(/<title>([^<]+)<\/title>/i);
    const pageTitle = tm ? strip(tm[1]).replace(/\s*\|.*$/, '').trim() : art.title;
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

    if (score === 0 && body.length < 500) { process.stdout.write('score 0 corto\n'); continue; }
    try {
      const id_m = `cmp_kc2_${Date.now()}_${i}`;
      db.query(`INSERT INTO Mencion (id,medioId,titulo,texto,textoCompleto,url,fechaCaptura,fechaPublicacion,tipoMencion,enlaceActivo,temas) VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(
        id_m, kcMedio.id, pageTitle.substring(0,300), body.substring(0,1000), body.substring(0,8000), art.url, new Date().toISOString(), dateStr ? dateStr+'T12:00:00' : null, 'mencion_pasiva', 1, lensNames.join(',').substring(0,200)
      );
      for (const lid of matchedLens) db.query(`INSERT OR IGNORE INTO MencionLente (id,mencionId,lenteId,createdAt) VALUES (?,?,?,?)`).run(`ml_kc2_${i}_${lid.substring(0,6)}`, id_m, lid, new Date().toISOString());
      for (const eid of matchedEjes) db.query(`INSERT OR IGNORE INTO MencionTema (id,mencionId,ejeTematicoId) VALUES (?,?,?)`).run(`mt_kc2_${i}_${eid.substring(0,6)}`, id_m, eid);
      totalCreated++;
      process.stdout.write(`✅ score:${score} [${lensNames.join(',')}] ${dateStr}\n`);
    } catch(e) { process.stdout.write('err\n'); }
  }
}

// ═══════════════════════════════════════════════════════════════
// FINAL
// ═══════════════════════════════════════════════════════════════
const after = (db.query('SELECT COUNT(*) as c FROM Mencion').get() as any).c;
console.log(`\n═══ RESULTADO: ${totalCreated} | DB: ${before}→${after} (+${after-before})`);

const lens = db.query(`SELECT l.nombre,COUNT(ml.id) as c FROM Lente l LEFT JOIN MencionLente ml ON ml.lenteId=l.id GROUP BY l.id ORDER BY c DESC`).all();
for (const l of lens as any[]) console.log(`  ${l.nombre}: ${l.c}`);
db.close();
