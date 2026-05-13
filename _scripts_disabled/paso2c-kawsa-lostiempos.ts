/**
 * PASO 2C: Captura Kawsachun Coca + Los Tiempos
 * ================================================
 * - Kawsachun Coca: 23 artículos políticos (protestas, COB, Evo, indígenas)
 * - Los Tiempos: artículos de última hora
 * - SIN IA/LLM — keyword scoring con bun:sqlite
 * - Delays 6-8s conservadores
 */
import { Database } from 'bun:sqlite';
const db = new Database('/home/z/my-project/prisma/db/custom.db');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
const DELAY = 7000;

// Load keywords
const lensMap = new Map<string, Set<string>>();
const ejeMap = new Map<string, Set<string>>();
for (const r of db.query(`SELECT k.termino,k.lenteId FROM Keyword k WHERE k.activo=1 AND k.lenteId IS NOT NULL`).all() as any[]) {
  const n = r.termino.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s-]/g, ' ').trim();
  if (n.length < 3) continue;
  if (!lensMap.has(n)) lensMap.set(n, new Set());
  lensMap.get(n)!.add(r.lenteId);
}
for (const r of db.query(`SELECT k.termino,k.ejeId FROM Keyword k WHERE k.activo=1 AND k.ejeId IS NOT NULL`).all() as any[]) {
  const n = r.termino.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s-]/g, ' ').trim();
  if (n.length < 3) continue;
  if (!ejeMap.has(n)) ejeMap.set(n, new Set());
  ejeMap.get(n)!.add(r.ejeId);
}
console.log(`Keywords: ${lensMap.size} lentes, ${ejeMap.size} ejes`);

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms + Math.random() * 2000));
function norm(t: string) { return t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim(); }
function strip(h: string) { return h.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&mdash;/g, '—').replace(/&ndash;/g, '–').replace(/&oacute;/g, 'ó').replace(/&iacute;/g, 'í').replace(/&aacute;/g, 'á').replace(/&eacute;/g, 'é').replace(/&uacute;/g, 'ú').replace(/&ntilde;/g, 'ñ').replace(/&#(\d+);/g, '').replace(/\s+/g, ' ').trim(); }

async function fetchP(url: string) {
  try {
    const c = new AbortController(); const t = setTimeout(() => c.abort(), 18000);
    const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'es-BO,es;q=0.9', 'Accept': 'text/html' }, signal: c.signal, redirect: 'follow' });
    clearTimeout(t); if (!r.ok) return ''; const tx = await r.text(); return tx.length > 200 ? tx : '';
  } catch { return ''; }
}

function scoreText(text: string) {
  const n = norm(text);
  const matchedLens = new Set<string>();
  const matchedEjes = new Set<string>();
  for (const [term, ids] of lensMap) { if (n.includes(term)) for (const id of ids) matchedLens.add(id); }
  for (const [term, ids] of ejeMap) { if (n.includes(term)) for (const id of ids) matchedEjes.add(id); }
  return { matchedLens, matchedEjes };
}

// Get medios
const kawsaMedio = db.query("SELECT id, nombre FROM Medio WHERE nombre LIKE '%Kawsachun%' OR nombre LIKE '%kawsachun%'").get() as any;
const ltMedio = db.query("SELECT id, nombre FROM Medio WHERE nombre LIKE '%Los Tiempos%'").get() as any;
console.log(`Kawsachun: ${kawsaMedio?.nombre || 'NOT FOUND'}`);
console.log(`Los Tiempos: ${ltMedio?.nombre || 'NOT FOUND'}`);

const existingUrls = new Set<string>(db.query(`SELECT url FROM Mencion`).all().map((r: any) => r.url));
const before = (db.query('SELECT COUNT(*) as c FROM Mencion').get() as any).c;
console.log(`Existing URLs: ${existingUrls.size}, Total: ${before}\n`);

let totalCreated = 0;

// ═══════════════════════════════════════════════════════════════
// PARTE 1: Kawsachun Coca
// ═══════════════════════════════════════════════════════════════
console.log('═══════════════════════════════════════════════');
console.log('  PARTE 1: Kawsachun Coca');
console.log('═══════════════════════════════════════════════\n');

if (kawsaMedio) {
  // Also check pages 2 and 3
  const pages = ['https://kawsachuncoca.com/', 'https://kawsachuncoca.com/page/2/', 'https://kawsachuncoca.com/page/3/'];
  const allArticles: { url: string; title: string }[] = [];
  const seen = new Set<string>();

  for (const pageUrl of pages) {
    console.log(`Fetching ${pageUrl}...`);
    const html = await fetchP(pageUrl);
    if (!html) { console.log('  → failed'); continue; }

    const regex = /href=["'](https?:\/\/kawsachuncoca\.com\/noticias\/ver\/[^"']+)["']/gi;
    let m;
    while ((m = regex.exec(html)) !== null) {
      if (seen.has(m[1])) continue;
      seen.add(m[1]);
      const context = html.substring(Math.max(0, m.index - 200), m.index + 500);
      const hMatch = context.match(/<h[2-6][^>]*>([^<]{15,150})<\/h/i);
      const pMatch = context.match(/<p[^>]*>([^<]{15,200})<\/p/i);
      const title = (hMatch?.[1] || pMatch?.[1] || '').replace(/<[^>]+>/g, '').trim();
      allArticles.push({ url: m[1], title });
    }
    await sleep(DELAY);
  }

  // Also add category pages for more coverage
  const catPages = [
    'https://kawsachuncoca.com/category/nacional/',
    'https://kawsachuncoca.com/category/politica/',
    'https://kawsachuncoca.com/category/social/',
  ];
  for (const catUrl of catPages) {
    console.log(`Fetching ${catUrl}...`);
    const html = await fetchP(catUrl);
    if (!html) continue;
    const regex = /href=["'](https?:\/\/kawsachuncoca\.com\/noticias\/ver\/[^"']+)["']/gi;
    let m;
    while ((m = regex.exec(html)) !== null) {
      if (seen.has(m[1])) continue;
      seen.add(m[1]);
      const context = html.substring(Math.max(0, m.index - 200), m.index + 500);
      const hMatch = context.match(/<h[2-6][^>]*>([^<]{15,150})<\/h/i);
      const title = (hMatch?.[1] || '').replace(/<[^>]+>/g, '').trim();
      allArticles.push({ url: m[1], title });
    }
    await sleep(DELAY);
  }

  console.log(`\nTotal unique articles: ${allArticles.length}`);

  // Process articles (max 15 to avoid timeout)
  const toProcess = allArticles.slice(0, 15);
  let kawsaCreated = 0;

  for (let i = 0; i < toProcess.length; i++) {
    const art = toProcess[i];
    const shortTitle = art.title.substring(0, 60);
    process.stdout.write(`[${i + 1}/${toProcess.length}] ${shortTitle}... `);

    if (existingUrls.has(art.url)) { process.stdout.write('dup\n'); continue; }

    await sleep(DELAY);
    const html = await fetchP(art.url);
    if (!html) { process.stdout.write('no HTML\n'); continue; }

    const body = strip(html);
    if (body.length < 400) { process.stdout.write(`corto (${body.length})\n`); continue; }

    // Extract title from page
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    const pageTitle = titleMatch ? strip(titleMatch[1]).replace(/\s*\|.*$/, '').trim() : strip(art.title);
    if (pageTitle.length < 15) { process.stdout.write('no title\n'); continue; }

    // Extract date
    const dateMatch = html.match(/(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})/i) || html.match(/datetime=["']([^"']+)["']/i);
    let dateStr = '';
    if (dateMatch) {
      if (dateMatch[1].length === 4) {
        dateStr = dateMatch[1].substring(0, 10);
      } else {
        const ms: Record<string, string> = { enero: '01', febrero: '02', marzo: '03', abril: '04', mayo: '05', junio: '06', julio: '07', agosto: '08', septiembre: '09', octubre: '10', noviembre: '11', diciembre: '12' };
        dateStr = `${dateMatch[3]}-${ms[dateMatch[2].toLowerCase()] || '01'}-${dateMatch[1].padStart(2, '0')}`;
      }
    }

    // Score
    const { matchedLens, matchedEjes } = scoreText(pageTitle + ' ' + body.substring(0, 4000));
    const score = matchedLens.size + matchedEjes.size;

    const lensNames: string[] = [];
    for (const lid of matchedLens) { const r = db.query('SELECT nombre FROM Lente WHERE id=?').get(lid) as any; if (r) lensNames.push(r.nombre); }

    // Accept: any score (Kawsachun is a political source - almost all relevant)
    if (score === 0 && body.length < 600) { process.stdout.write('score 0 corto\n'); continue; }

    const id_m = `cmp_kc_${Date.now()}_${i}`;
    try {
      db.query(`INSERT INTO Mencion (id,medioId,titulo,texto,textoCompleto,url,fechaCaptura,fechaPublicacion,tipoMencion,enlaceActivo,temas) VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(
        id_m, kawsaMedio.id, pageTitle.substring(0, 300), body.substring(0, 1000), body.substring(0, 8000),
        art.url, new Date().toISOString(), dateStr ? dateStr + 'T12:00:00' : null, 'mencion_pasiva', 1,
        lensNames.join(',').substring(0, 200)
      );
      for (const lid of matchedLens) db.query(`INSERT OR IGNORE INTO MencionLente (id,mencionId,lenteId,createdAt) VALUES (?,?,?,?)`).run(`ml_kc_${i}_${lid.substring(0, 6)}`, id_m, lid, new Date().toISOString());
      for (const eid of matchedEjes) db.query(`INSERT OR IGNORE INTO MencionTema (id,mencionId,ejeTematicoId) VALUES (?,?,?)`).run(`mt_kc_${i}_${eid.substring(0, 6)}`, id_m, eid);
      kawsaCreated++;
      totalCreated++;
      const tags = score > 0 ? `score:${score} [${lensNames.join(',')}]` : 'sin-kw (cuerpo largo)';
      process.stdout.write(`✅ ${tags}\n`);
    } catch (e: any) { process.stdout.write(`err: ${String(e).substring(0, 40)}\n`); }
  }
  console.log(`\nKawsachun Coca: ${kawsaCreated} creadas\n`);
} else {
  console.log('❌ Kawsachun Coca medio not found in DB\n');
}

// ═══════════════════════════════════════════════════════════════
// PARTE 2: Los Tiempos
// ═══════════════════════════════════════════════════════════════
console.log('═══════════════════════════════════════════════');
console.log('  PARTE 2: Los Tiempos');
console.log('═══════════════════════════════════════════════\n');

if (ltMedio) {
  const html = await fetchP('https://www.lostiempos.com/');
  if (html) {
    // Extract article links
    const linkRegex = /href=["'](https?:\/\/www\.lostiempos\.com\/[^"']*(?:noticia|actualidad|politica|economia|sociedad)[^"']*)["']/gi;
    const seen = new Set<string>();
    const articles: { url: string; title: string }[] = [];
    let m;
    while ((m = linkRegex.exec(html)) !== null) {
      if (seen.has(m[1]) || m[1].includes('javascript:') || m[1].includes('#')) continue;
      seen.add(m[1]);
      const context = html.substring(Math.max(0, m.index - 200), m.index + 400);
      const hMatch = context.match(/<h[2-6][^>]*>([^<]{15,150})</i);
      const title = hMatch ? strip(hMatch[1]).trim() : '';
      articles.push({ url: m[1], title });
    }

    console.log(`Found ${articles.length} article links`);

    // Process top 5
    const toProcess = articles.slice(0, 5);
    let ltCreated = 0;

    for (let i = 0; i < toProcess.length; i++) {
      const art = toProcess[i];
      process.stdout.write(`[${i + 1}/${toProcess.length}] ${art.title.substring(0, 55)}... `);
      if (existingUrls.has(art.url)) { process.stdout.write('dup\n'); continue; }

      await sleep(DELAY);
      const artHtml = await fetchP(art.url);
      if (!artHtml) { process.stdout.write('no HTML\n'); continue; }
      const body = strip(artHtml);
      if (body.length < 400) { process.stdout.write(`corto (${body.length})\n`); continue; }

      const titleMatch = artHtml.match(/<title>([^<]+)<\/title>/i);
      const pageTitle = titleMatch ? strip(titleMatch[1]).replace(/\s*\|.*$/, '').trim() : strip(art.title);
      const dm = art.url.match(/\/(\d{4})\/(\d{2})\/(\d{2})\//);
      const dateStr = dm ? `${dm[1]}-${dm[2]}-${dm[3]}` : '';

      const { matchedLens, matchedEjes } = scoreText(pageTitle + ' ' + body.substring(0, 4000));
      const score = matchedLens.size + matchedEjes.size;
      const lensNames: string[] = [];
      for (const lid of matchedLens) { const r = db.query('SELECT nombre FROM Lente WHERE id=?').get(lid) as any; if (r) lensNames.push(r.nombre); }

      if (score === 0 && body.length < 800) { process.stdout.write('score 0 corto\n'); continue; }

      const id_m = `cmp_lt_${Date.now()}_${i}`;
      try {
        db.query(`INSERT INTO Mencion (id,medioId,titulo,texto,textoCompleto,url,fechaCaptura,fechaPublicacion,tipoMencion,enlaceActivo,temas) VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(
          id_m, ltMedio.id, pageTitle.substring(0, 300), body.substring(0, 1000), body.substring(0, 8000),
          art.url, new Date().toISOString(), dateStr ? dateStr + 'T12:00:00' : null, 'mencion_pasiva', 1,
          lensNames.join(',').substring(0, 200)
        );
        for (const lid of matchedLens) db.query(`INSERT OR IGNORE INTO MencionLente (id,mencionId,lenteId,createdAt) VALUES (?,?,?,?)`).run(`ml_lt_${i}_${lid.substring(0, 6)}`, id_m, lid, new Date().toISOString());
        for (const eid of matchedEjes) db.query(`INSERT OR IGNORE INTO MencionTema (id,mencionId,ejeTematicoId) VALUES (?,?,?)`).run(`mt_lt_${i}_${eid.substring(0, 6)}`, id_m, eid);
        ltCreated++;
        totalCreated++;
        process.stdout.write(`✅ score:${score} [${lensNames.join(',')}] (${body.length}c)\n`);
      } catch (e: any) { process.stdout.write(`err\n`); }
    }
    console.log(`\nLos Tiempos: ${ltCreated} creadas\n`);
  } else {
    console.log('❌ Los Tiempos no responde\n');
  }
}

// ═══════════════════════════════════════════════════════════════
// FINAL
// ═══════════════════════════════════════════════════════════════
const after = (db.query('SELECT COUNT(*) as c FROM Mencion').get() as any).c;
console.log('═'.repeat(50));
console.log(`  PASO 2C RESULTADO: ${totalCreated} creadas | DB: ${before}→${after} (+${after - before})`);
console.log('═'.repeat(50));

const lens = db.query(`SELECT l.nombre,COUNT(ml.id) as c FROM Lente l LEFT JOIN MencionLente ml ON ml.lenteId=l.id GROUP BY l.id ORDER BY c DESC`).all();
console.log('\nLentes:');
for (const l of lens as any[]) console.log(`  ${l.nombre}: ${l.c}`);

const ejes = db.query(`SELECT e.nombre,COUNT(mt.id) as c FROM EjeTematico e LEFT JOIN MencionTema mt ON mt.ejeTematicoId=e.id LEFT JOIN Mencion m ON mt.mencionId=m.id WHERE e.tipo='estructural' GROUP BY e.id ORDER BY c DESC`).all();
console.log('\nEjes:');
for (const e of ejes as any[]) {
  const bar = e.c >= 30 ? '🟢' : e.c >= 15 ? '🟡' : e.c >= 5 ? '🟠' : '🔴';
  console.log(`  ${bar} ${e.c} | ${e.nombre}`);
}

db.close();
