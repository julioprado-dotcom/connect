/**
 * PASO 2F Batch 1: Brújula Digital + Urgente Bolivia + RTP Bolivia
 * 3 fuentes con fetch directo, ~148 artículos potenciales
 * Delays: 7-9s entre artículos, 4-5s entre páginas de listado
 */
import { Database } from 'bun:sqlite';
const db = new Database('/home/z/my-project/prisma/db/custom.db');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

// ─── Keyword maps ───
const lensMap = new Map<string, Set<string>>();
const ejeMap = new Map<string, Set<string>>();
for (const r of db.query(`SELECT k.termino,k.lenteId FROM Keyword k WHERE k.activo=1 AND k.lenteId IS NOT NULL`).all() as any[]) {
  const n = r.termino.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s-]/g, ' ').trim();
  if (n.length < 3) { if (!lensMap.has(n)) lensMap.set(n, new Set()); lensMap.get(n)!.add(r.lenteId); }
}
for (const r of db.query(`SELECT k.termino,k.ejeId FROM Keyword k WHERE k.activo=1 AND k.ejeId IS NOT NULL`).all() as any[]) {
  const n = r.termino.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s-]/g, ' ').trim();
  if (n.length < 3) { if (!ejeMap.has(n)) ejeMap.set(n, new Set()); ejeMap.get(n)!.add(r.ejeId); }
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const randDelay = () => 7000 + Math.floor(Math.random() * 2000); // 7-9s

function strip(h: string) {
  return h.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–').replace(/&oacute;/g, 'ó').replace(/&iacute;/g, 'í').replace(/&aacute;/g, 'á')
    .replace(/&eacute;/g, 'é').replace(/&uacute;/g, 'ú').replace(/&ntilde;/g, 'ñ').replace(/&#(\d+);/g, '')
    .replace(/\s+/g, ' ').trim();
}
function norm(t: string) { return t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim(); }

async function fetchP(url: string) {
  try {
    const c = new AbortController(); const t = setTimeout(() => c.abort(), 18000);
    const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'es-BO,es;q=0.9,en;q=0.8' }, signal: c.signal, redirect: 'follow' });
    clearTimeout(t); if (!r.ok) return ''; const tx = await r.text(); return tx.length > 200 ? tx : '';
  } catch { return ''; }
}

const existingUrls = new Set<string>(db.query(`SELECT url FROM Mencion`).all().map((r: any) => r.url));
const before = (db.query('SELECT COUNT(*) as c FROM Mencion').get() as any).c;
let totalCreated = 0;

function ensureMedio(nombre: string, url: string, tipo: string = 'digital', cat: string = 'oficial') {
  const domain = url.replace(/https?:\/\/(www\.)?/, '').split('/')[0];
  let m = db.query(`SELECT id, nombre FROM Medio WHERE url LIKE '%' || ? || '%' OR nombre LIKE '%' || ? || '%'`).get(domain, nombre) as any;
  if (!m) {
    const id = `med_${Date.now()}_${nombre.substring(0, 4).toLowerCase().replace(/[^a-z]/g, '')}`;
    db.query(`INSERT INTO Medio (id, nombre, url, tipo, categoria, activo) VALUES (?, ?, ?, ?, ?, 1)`).run(id, nombre, url, tipo, cat);
    m = { id, nombre };
    console.log(`  ✅ Created medio: ${nombre} (${id})`);
  } else {
    console.log(`  Medio existente: ${m.nombre} (${m.id})`);
  }
  return m;
}

async function processArticle(url: string, medioId: string, prefix: string, idx: number, dateFromUrl?: string) {
  if (existingUrls.has(url)) return false;
  await sleep(randDelay());
  
  const html = await fetchP(url);
  if (!html) { process.stdout.write('noHTML '); return false; }
  const body = strip(html);
  if (body.length < 400) { process.stdout.write(`corto(${body.length}) `); return false; }

  const tm = html.match(/<title>([^<]+)<\/title>/i);
  let pageTitle = tm ? strip(tm[1]).replace(/\s*[|\-–—].*$/, '').trim() : '';
  if (pageTitle.length < 15) {
    const h1 = html.match(/<h1[^>]*>([^<]{15,200})<\/h1>/i);
    if (h1) pageTitle = strip(h1[1]);
  }
  if (pageTitle.length < 15) { process.stdout.write('noTitle '); return false; }

  let dateStr = dateFromUrl || '';
  if (!dateStr) {
    const dm = body.match(/(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})/i);
    if (dm) {
      const ms: Record<string, string> = { enero: '01', febrero: '02', marzo: '03', abril: '04', mayo: '05', junio: '06', julio: '07', agosto: '08', septiembre: '09', octubre: '10', noviembre: '11', diciembre: '12' };
      dateStr = `${dm[3]}-${ms[dm[2].toLowerCase()] || '01'}-${dm[1].padStart(2, '0')}`;
    }
    // Try ISO date
    if (!dateStr) { const iso = body.match(/(\d{4})-(\d{2})-(\d{2})/); if (iso) dateStr = `${iso[1]}-${iso[2]}-${iso[3]}`; }
  }

  const n = norm(pageTitle + ' ' + body.substring(0, 4000));
  const matchedLens = new Set<string>(), matchedEjes = new Set<string>();
  for (const [term, ids] of lensMap) { if (n.includes(term)) for (const id of ids) matchedLens.add(id); }
  for (const [term, ids] of ejeMap) { if (n.includes(term)) for (const id of ids) matchedEjes.add(id); }
  const score = matchedLens.size + matchedEjes.size;

  if (score === 0 && body.length < 800) { process.stdout.write('s0corto '); return false; }

  const lensNames: string[] = [];
  for (const lid of matchedLens) { const r = db.query('SELECT nombre FROM Lente WHERE id=?').get(lid) as any; if (r) lensNames.push(r.nombre); }

  try {
    const id_m = `${prefix}_${Date.now()}_${idx}`;
    db.query(`INSERT INTO Mencion (id,medioId,titulo,texto,textoCompleto,url,fechaCaptura,fechaPublicacion,tipoMencion,enlaceActivo,temas) VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(
      id_m, medioId, pageTitle.substring(0, 300), body.substring(0, 1000), body.substring(0, 8000), url, new Date().toISOString(), dateStr ? dateStr + 'T12:00:00' : null, 'mencion_pasiva', 1, lensNames.join(',').substring(0, 200)
    );
    for (const lid of matchedLens) db.query(`INSERT OR IGNORE INTO MencionLente (id,mencionId,lenteId,createdAt) VALUES (?,?,?,?)`).run(`${prefix}_l${idx}_${lid.substring(0, 6)}`, id_m, lid, new Date().toISOString());
    for (const eid of matchedEjes) db.query(`INSERT OR IGNORE INTO MencionTema (id,mencionId,ejeTematicoId) VALUES (?,?,?)`).run(`${prefix}_e${idx}_${eid.substring(0, 6)}`, id_m, eid);
    existingUrls.add(url);
    process.stdout.write(`✅s${score}[${lensNames.slice(0, 3).join(',')}]\n`);
    return true;
  } catch (e: any) { process.stdout.write('err\n'); return false; }
}

// ═══════════════════════════════════════════════════════════════
// PARTE 1: BRÚJULA DIGITAL — /{category}/{YYYY}/{MM}/{DD}/{slug}
// ═══════════════════════════════════════════════════════════════
console.log('═══ BRÚJULA DIGITAL ═══');
const bruMedio = ensureMedio('Brújula Digital', 'https://brujuladigital.net');
const bruHtml = await fetchP('https://brujuladigital.net/');
if (bruHtml) {
  const regex = /href=["'](https?:\/\/brujuladigital\.net\/(?:politica|economia|sociedad|seguridad|opinion|mundo)\/\d{4}\/\d{2}\/\d{2}\/[^"']+)["']/gi;
  const seen = new Set<string>();
  const articles: { url: string; date: string }[] = [];
  let m;
  while ((m = regex.exec(bruHtml)) !== null) {
    if (seen.has(m[1])) continue;
    seen.add(m[1]);
    const dm = m[1].match(/\/(\d{4})\/(\d{2})\/(\d{2})\//);
    articles.push({ url: m[1], date: dm ? `${dm[1]}-${dm[2]}-${dm[3]}` : '' });
  }
  console.log(`  Found ${articles.length} article URLs`);

  let bruOk = 0;
  for (let i = 0; i < Math.min(articles.length, 15); i++) {
    const art = articles[i];
    process.stdout.write(`  [${i + 1}/${Math.min(articles.length, 15)}] ${art.url.split('/').pop()?.substring(0, 50)}... `);
    if (await processArticle(art.url, bruMedio.id, 'cmp_br', i, art.date)) bruOk++;
  }
  console.log(`  Brújula: ${bruOk} new`);
  totalCreated += bruOk;
  await sleep(5000);
} else {
  console.log('  ❌ Failed to fetch homepage');
}

// ═══════════════════════════════════════════════════════════════
// PARTE 2: URGENTE BOLIVIA — /noticia/{slug}
// ═══════════════════════════════════════════════════════════════
console.log('\n═══ URGENTE BOLIVIA ═══');
const urgMedio = ensureMedio('Urgente Bolivia', 'https://www.urgente.bo');
const urgHtml = await fetchP('https://www.urgente.bo/');
if (urgHtml) {
  const regex = /href=["'](https?:\/\/www\.urgente\.bo\/noticia\/[^"']+)["']/gi;
  const seen = new Set<string>();
  const articles: string[] = [];
  let m;
  while ((m = regex.exec(urgHtml)) !== null) {
    if (seen.has(m[1])) continue;
    seen.add(m[1]);
    articles.push(m[1]);
  }
  console.log(`  Found ${articles.length} article URLs`);

  let urgOk = 0;
  for (let i = 0; i < Math.min(articles.length, 15); i++) {
    process.stdout.write(`  [${i + 1}/${Math.min(articles.length, 15)}] ${articles[i].split('/').pop()?.substring(0, 50)}... `);
    if (await processArticle(articles[i], urgMedio.id, 'cmp_ur', i)) urgOk++;
  }
  console.log(`  Urgente: ${urgOk} new`);
  totalCreated += urgOk;
  await sleep(5000);
} else {
  console.log('  ❌ Failed to fetch homepage');
}

// ═══════════════════════════════════════════════════════════════
// PARTE 3: RTP BOLIVIA — /{category}/{slug} (WordPress)
// ═══════════════════════════════════════════════════════════════
console.log('\n═══ RTP BOLIVIA ═══');
const rtpMedio = ensureMedio('RTP Bolivia', 'https://rtpbolivia.com.bo');
const rtpHtml = await fetchP('https://rtpbolivia.com.bo/');
if (rtpHtml) {
  const regex = /href=["'](https?:\/\/rtpbolivia\.com\.bo\/(?:noticias|politica|economia|sociedad|internacional|nacional)\/[^"']+)["']/gi;
  const seen = new Set<string>();
  const articles: string[] = [];
  let m;
  while ((m = regex.exec(rtpHtml)) !== null) {
    if (seen.has(m[1])) continue;
    seen.add(m[1]);
    articles.push(m[1]);
  }
  console.log(`  Found ${articles.length} article URLs`);

  let rtpOk = 0;
  for (let i = 0; i < Math.min(articles.length, 10); i++) {
    process.stdout.write(`  [${i + 1}/${Math.min(articles.length, 10)}] ${articles[i].split('/').pop()?.substring(0, 50)}... `);
    if (await processArticle(articles[i], rtpMedio.id, 'cmp_rt', i)) rtpOk++;
  }
  console.log(`  RTP: ${rtpOk} new`);
  totalCreated += rtpOk;
}

// ═══════════════════════════════════════════════════════════════
// RESUMEN
// ═══════════════════════════════════════════════════════════════
const after = (db.query('SELECT COUNT(*) as c FROM Mencion').get() as any).c;
console.log(`\n═══ BATCH 1 RESULTADO: ${totalCreated} nuevas | DB: ${before}→${after} (+${after - before})`);

const lens = db.query(`SELECT l.nombre, COUNT(ml.id) as c FROM Lente l LEFT JOIN MencionLente ml ON ml.lenteId=l.id GROUP BY l.id ORDER BY c DESC`).all();
console.log('\nLentes:');
for (const l of lens as any[]) console.log(`  ${l.nombre}: ${l.c}`);

const ejes = db.query(`SELECT e.nombre, COUNT(mt.id) as c FROM EjeTematico e LEFT JOIN MencionTema mt ON mt.ejeTematicoId=e.id LEFT JOIN Mencion m ON mt.mencionId=m.id WHERE e.tipo='estructural' GROUP BY e.id ORDER BY c DESC`).all();
console.log('\nEjes:');
for (const e of ejes as any[]) {
  const bar = e.c >= 30 ? '🟢' : e.c >= 15 ? '🟡' : e.c >= 5 ? '🟠' : '🔴';
  console.log(`  ${bar} ${e.c} | ${e.nombre}`);
}

db.close();
