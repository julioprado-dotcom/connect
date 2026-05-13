/**
 * PASO 2B: Captura eju.tv + IBCE profundo (IDs 900-935)
 * ======================================================
 * - eju.tv: WordPress, 200 OK, 290KB, article links
 * - IBCE: batch profundo IDs 900-935
 * - SIN IA/LLM — keyword scoring con bun:sqlite
 */

import { Database } from 'bun:sqlite';

const db = new Database('/home/z/my-project/prisma/db/custom.db');

// ─── Config ─────────────────────────────────────────────────────
const DELAY = 7000;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

// ─── Load keywords ──────────────────────────────────────────────
const lensKw: { termino: string; lenteId: string; lenteNombre: string }[] = [];
const ejeKw: { termino: string; ejeId: string; ejeNombre: string }[] = [];
for (const r of db.query(`SELECT k.termino,k.lenteId,l.nombre as lenteNombre FROM Keyword k JOIN Lente l ON l.id=k.lenteId WHERE k.activo=1 AND k.lenteId IS NOT NULL`).all() as any[]) lensKw.push(r);
for (const r of db.query(`SELECT k.termino,k.ejeId,e.nombre as ejeNombre FROM Keyword k JOIN EjeTematico e ON e.id=k.ejeId WHERE k.activo=1 AND k.ejeId IS NOT NULL`).all() as any[]) ejeKw.push(r);
console.log(`Keywords: ${lensKw.length} lentes, ${ejeKw.length} ejes`);

// Build lookup maps
const lensMap = new Map<string, Set<string>>(); // normalized term -> lenteId
const ejeMap = new Map<string, Set<string>>();
for (const kw of lensKw) {
  const n = kw.termino.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g,' ').trim();
  if (n.length < 3) continue;
  if (!lensMap.has(n)) lensMap.set(n, new Set());
  lensMap.get(n)!.add(kw.lenteId);
}
for (const kw of ejeKw) {
  const n = kw.termino.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g,' ').trim();
  if (n.length < 3) continue;
  if (!ejeMap.has(n)) ejeMap.set(n, new Set());
  ejeMap.get(n)!.add(kw.ejeId);
}

// ─── Helpers ────────────────────────────────────────────────────
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms + Math.random() * 2000));

function norm(t: string) {
  return t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim();
}

function strip(h: string) {
  return h.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'").replace(/&mdash;/g, '—').replace(/&ndash;/g, '–')
    .replace(/&oacute;/g, 'ó').replace(/&iacute;/g, 'í').replace(/&aacute;/g, 'á')
    .replace(/&eacute;/g, 'é').replace(/&uacute;/g, 'ú').replace(/&ntilde;/g, 'ñ')
    .replace(/&#(\d+);/g, '').replace(/\s+/g, ' ').trim();
}

async function fetchP(url: string) {
  try {
    const c = new AbortController(); const t = setTimeout(() => c.abort(), 20000);
    const r = await fetch(url, {
      headers: { 'User-Agent': UA, 'Accept-Language': 'es-BO,es;q=0.9', 'Accept': 'text/html' },
      signal: c.signal, redirect: 'follow'
    });
    clearTimeout(t);
    if (!r.ok) return '';
    const tx = await r.text();
    return tx.length > 200 ? tx : '';
  } catch { return ''; }
}

function scoreText(text: string) {
  const n = norm(text);
  const matchedLens = new Set<string>();
  const matchedEjes = new Set<string>();
  for (const [term, ids] of lensMap) {
    if (n.includes(term)) for (const id of ids) matchedLens.add(id);
  }
  for (const [term, ids] of ejeMap) {
    if (n.includes(term)) for (const id of ids) matchedEjes.add(id);
  }
  return { matchedLens, matchedEjes };
}

// ─── Get medios ─────────────────────────────────────────────────
const ejuMedio = db.query("SELECT id, nombre FROM Medio WHERE nombre LIKE '%eju%'").get() as any;
const ibceMedio = db.query("SELECT id, nombre FROM Medio WHERE nombre LIKE '%IBCE%'").get() as any;
console.log(`eju.tv: ${ejuMedio?.nombre || 'NOT FOUND'}`);
console.log(`IBCE: ${ibceMedio?.nombre || 'NOT FOUND'}`);

// Existing URLs
const existingUrls = new Set<string>();
for (const r of db.query(`SELECT url FROM Mencion`).all() as any[]) existingUrls.add(r.url);
console.log(`Existing URLs: ${existingUrls.size}\n`);

const beforeCount = (db.query('SELECT COUNT(*) as c FROM Mencion').get() as any).c;

// ═══════════════════════════════════════════════════════════════════
// PARTE 1: eju.tv — WordPress site
// ═══════════════════════════════════════════════════════════════════
console.log('═══════════════════════════════════════════════');
console.log('  PARTE 1: eju.tv');
console.log('═══════════════════════════════════════════════\n');

if (ejuMedio) {
  const homepage = await fetchP('https://eju.tv');
  if (homepage) {
    // Extract article links from WordPress homepage
    const linkRegex = /href=["'](https?:\/\/eju\.tv\/\d{4}\/\d{2}\/[^"']+)["']/gi;
    const seen = new Set<string>();
    const articles: { url: string; title: string }[] = [];
    let m: RegExpExecArray | null;

    // Extract titles near links
    const blocks = homepage.split(/href=["']/i);
    for (const block of blocks) {
      const urlMatch = block.match(/^(https?:\/\/eju\.tv\/\d{4}\/\d{2}\/[^"']+)["']/i);
      if (urlMatch) {
        const url = urlMatch[1];
        if (seen.has(url)) continue;
        seen.add(url);

        // Try to find title in the surrounding HTML
        const titleMatch = block.match(/>([^<]{15,100})</);
        const title = titleMatch ? strip(titleMatch[1]).trim() : url.split('/').pop()?.replace(/-/g,' ') || '';
        articles.push({ url, title });
      }
    }

    console.log(`Found ${articles.length} article links on eju.tv`);

    // Process top 8
    const toProcess = articles.slice(0, 8);
    let ejuCreated = 0;

    for (let i = 0; i < toProcess.length; i++) {
      const art = toProcess[i];
      process.stdout.write(`  [${i+1}/${toProcess.length}] ${art.title.substring(0,55)}... `);

      if (existingUrls.has(art.url)) { process.stdout.write('dup\n'); continue; }

      await sleep(DELAY);
      const html = await fetchP(art.url);
      if (!html) { process.stdout.write('no HTML\n'); continue; }

      const body = strip(html);
      if (body.length < 400) { process.stdout.write(`corto (${body.length})\n`); continue; }

      // Extract date from URL
      const dm = art.url.match(/\/(\d{4})\/(\d{2})\/(\d{2})\//);
      let dateStr = '';
      if (dm) dateStr = `${dm[1]}-${dm[2]}-${dm[3]}`;

      // Score
      const { matchedLens, matchedEjes } = scoreText(art.title + ' ' + body.substring(0, 4000));
      const score = matchedLens.size + matchedEjes.size;

      // Get lens/eje names for temas field
      const lensNames: string[] = [];
      for (const lid of matchedLens) {
        const r = db.query('SELECT nombre FROM Lente WHERE id = ?').get(lid) as any;
        if (r) lensNames.push(r.nombre);
      }

      // Accept: keyword match OR substantial body
      if (score === 0 && body.length < 800) {
        process.stdout.write(`score 0, corto\n`);
        continue;
      }

      // Create mention
      const id_m = `cmp_p2b_eju_${Date.now()}_${i}`;
      try {
        db.query(`INSERT INTO Mencion (id, medioId, titulo, texto, textoCompleto, url, fechaCaptura, fechaPublicacion, tipoMencion, enlaceActivo, temas)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
          id_m, ejuMedio.id, strip(art.title).substring(0,300), body.substring(0,1000),
          body.substring(0,8000), art.url, new Date().toISOString(),
          dateStr ? dateStr + 'T12:00:00' : null, 'mencion_pasiva', 1,
          lensNames.join(',').substring(0,200)
        );
        for (const lid of matchedLens) {
          db.query(`INSERT OR IGNORE INTO MencionLente (id, mencionId, lenteId, createdAt) VALUES (?, ?, ?, ?)`).run(
            `ml_p2b_eju_${i}_${lid.substring(0,6)}`, id_m, lid, new Date().toISOString()
          );
        }
        for (const eid of matchedEjes) {
          db.query(`INSERT OR IGNORE INTO MencionTema (id, mencionId, ejeTematicoId) VALUES (?, ?, ?)`).run(
            `mt_p2b_eju_${i}_${eid.substring(0,6)}`, id_m, eid
          );
        }
        ejuCreated++;
        const tags = score > 0 ? `score:${score} [${lensNames.join(',')}]` : 'sin-keywords (cuerpo largo)';
        process.stdout.write(`✅ ${tags}\n`);
      } catch (e: any) {
        process.stdout.write(`DB err: ${String(e).substring(0,50)}\n`);
      }
    }
    console.log(`\neju.tv creadas: ${ejuCreated}\n`);
  } else {
    console.log('❌ eju.tv no responde\n');
  }
}

// ═══════════════════════════════════════════════════════════════════
// PARTE 2: IBCE batch profundo (IDs 934-920)
// ═══════════════════════════════════════════════════════════════════
console.log('═══════════════════════════════════════════════');
console.log('  PARTE 2: IBCE IDs 934→920');
console.log('═══════════════════════════════════════════════\n');

let ibceCreated = 0;
const IBCE_BASE = 'https://ibce.org.bo';

for (let id = 934; id >= 920; id--) {
  const url = `${IBCE_BASE}/noticias-detalle.php?idNot=${id}`;
  process.stdout.write(`  #${id}... `);

  if (existingUrls.has(url)) { process.stdout.write('dup\n'); continue; }

  await sleep(DELAY);
  const html = await fetchP(url);
  if (!html) { process.stdout.write('empty\n'); continue; }

  // Parse IBCE article
  const tm = html.match(/<title>([^<]+)<\/title>/i);
  if (!tm) { process.stdout.write('no title\n'); continue; }
  let title = strip(tm[1]).replace(/\s*[-–—]\s*IBCE\s*$/i, '').trim();
  if (!title || title.length < 10) { process.stdout.write('invalid\n'); continue; }

  // Date
  const dm = html.match(/class="date">(\d{1,2})<\/span>[\s\S]*?class="month">([^<]+)/i);
  let dateStr = '';
  if (dm) {
    const day = dm[1].padStart(2, '0');
    const raw = dm[2].replace(/<br\s*\/?>/gi, ' ').replace(/<\/?strong>/gi, '').trim();
    const yr = (raw.match(/(\d{4})/) || ['','2025'])[1];
    const mp = raw.replace(/\d{4}/g, '').trim().toLowerCase();
    const ms: Record<string,string> = {enero:'01',febrero:'02',marzo:'03',abril:'04',mayo:'05',junio:'06',julio:'07',agosto:'08',septiembre:'09',octubre:'10',noviembre:'11',diciembre:'12'};
    dateStr = `${yr}-${ms[mp]||'01'}-${day}`;
  }

  // Body
  const ps: string[] = [];
  const pr = /<p[^>]*>([\s\S]*?)<\/p>/gi; let pm;
  while ((pm = pr.exec(html)) !== null) {
    const t = strip(pm[1]).trim();
    if (t.length > 25) ps.push(t);
  }
  const body = ps.join(' ');

  const fullText = (title + ' ' + body).substring(0, 5000);
  const { matchedLens, matchedEjes } = scoreText(fullText);
  const score = matchedLens.size + matchedEjes.size;

  const lensNames: string[] = [];
  for (const lid of matchedLens) {
    const r = db.query('SELECT nombre FROM Lente WHERE id = ?').get(lid) as any;
    if (r) lensNames.push(r.nombre);
  }

  if (score === 0 && body.length < 600) {
    process.stdout.write(`score 0, corto (${body.length})\n`);
    continue;
  }

  const id_m = `cmp_p2b_ibce_${id}_${Date.now()}`;
  try {
    db.query(`INSERT INTO Mencion (id, medioId, titulo, texto, textoCompleto, url, fechaCaptura, fechaPublicacion, tipoMencion, enlaceActivo, temas)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      id_m, ibceMedio.id, title.substring(0,300), body.substring(0,1000),
      body.substring(0,8000), url, new Date().toISOString(),
      dateStr ? dateStr + 'T12:00:00' : null, 'mencion_pasiva', 1,
      lensNames.join(',').substring(0,200)
    );
    for (const lid of matchedLens) {
      db.query(`INSERT OR IGNORE INTO MencionLente (id, mencionId, lenteId, createdAt) VALUES (?, ?, ?, ?)`).run(
        `ml_p2b_ibce_${id}_${lid.substring(0,6)}`, id_m, lid, new Date().toISOString()
      );
    }
    for (const eid of matchedEjes) {
      db.query(`INSERT OR IGNORE INTO MencionTema (id, mencionId, ejeTematicoId) VALUES (?, ?, ?)`).run(
        `mt_p2b_ibce_${id}_${eid.substring(0,6)}`, id_m, eid
      );
    }
    ibceCreated++;
    const tags = score > 0 ? `[${lensNames.join(',')}]` : '[sin-keywords]';
    process.stdout.write(`✅ ${tags}\n`);
  } catch (e: any) {
    process.stdout.write(`DB err: ${String(e).substring(0,50)}\n`);
  }
}

console.log(`\nIBCE creadas: ${ibceCreated}`);

// ─── Final Summary ──────────────────────────────────────────────
const afterCount = (db.query('SELECT COUNT(*) as c FROM Mencion').get() as any).c;
console.log('\n' + '═'.repeat(55));
console.log('  PASO 2B RESULTADO');
console.log('═'.repeat(55));
console.log(`  Total DB: ${beforeCount} → ${afterCount} (+${afterCount - beforeCount})`);
console.log('');

// Distribution
const lens = db.query(`
  SELECT l.nombre, COUNT(ml.id) as c
  FROM Lente l LEFT JOIN MencionLente ml ON ml.lenteId = l.id
  GROUP BY l.id ORDER BY c DESC
`).all();
for (const l of lens as any[]) console.log(`  ${l.nombre}: ${l.c}`);

db.close();
