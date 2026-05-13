/**
 * PASO 2A: Captura IBCE Notas de Prensa (v3 - bun:sqlite directo)
 * ================================================================
 * SIN PrismaClient — usa bun:sqlite directo para velocidad
 * SIN IA/LLM — solo keyword matching
 * 10 artículos, delays 6-8s
 */

import { Database } from 'bun:sqlite';

const db = new Database('/home/z/my-project/prisma/db/custom.db');

// ─── Config ─────────────────────────────────────────────────────
const BASE = 'https://ibce.org.bo';
const DELAY = 7000;
const START = 954, END = 935;

// ─── Load keywords ──────────────────────────────────────────────
console.log('Cargando keywords...');
const lensKw: { termino: string; lenteId: string; lenteNombre: string }[] = [];
const ejeKw: { termino: string; ejeId: string; ejeNombre: string }[] = [];

const lkRows = db.query(`
  SELECT k.termino, k.lenteId, l.nombre as lenteNombre
  FROM Keyword k JOIN Lente l ON l.id = k.lenteId
  WHERE k.activo = 1 AND k.lenteId IS NOT NULL
`).all() as any[];
for (const r of lkRows) lensKw.push(r);

const ekRows = db.query(`
  SELECT k.termino, k.ejeId, e.nombre as ejeNombre
  FROM Keyword k JOIN EjeTematico e ON e.id = k.ejeId
  WHERE k.activo = 1 AND k.ejeId IS NOT NULL
`).all() as any[];
for (const r of ekRows) ejeKw.push(r);

console.log(`Keywords: ${lensKw.length} lentes, ${ejeKw.length} ejes`);

// ─── Get IBCE medio ─────────────────────────────────────────────
const medio = db.query(`SELECT id, nombre FROM Medio WHERE nombre LIKE '%IBCE%'`).get() as any;
if (!medio) { console.log('❌ IBCE medio no encontrado'); process.exit(1); }
console.log(`Medio: ${medio.nombre} (${medio.id})`);

// ─── Existing URLs ──────────────────────────────────────────────
const existingUrls = new Set<string>();
const exRows = db.query(`SELECT url FROM Mencion WHERE medioId = ?`).all(medio.id) as any[];
for (const r of exRows) existingUrls.add(r.url);
console.log(`Existen: ${existingUrls.size} menciones IBCE\n`);

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
    .replace(/&ldquo;/g, '"').replace(/&rdquo;/g, '"')
    .replace(/&#(\d+);/g, '').replace(/\s+/g, ' ').trim();
}

async function fetchP(url: string) {
  try {
    const c = new AbortController(); const t = setTimeout(() => c.abort(), 20000);
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept-Language': 'es-BO,es;q=0.9' },
      signal: c.signal
    });
    clearTimeout(t);
    if (!r.ok) return '';
    const tx = await r.text();
    return tx.length > 200 ? tx : '';
  } catch { return ''; }
}

// ─── Parse article ──────────────────────────────────────────────
function parseArt(html: string, id: number) {
  const tm = html.match(/<title>([^<]+)<\/title>/i);
  if (!tm) return null;
  let title = strip(tm[1]).replace(/\s*[-–—]\s*IBCE\s*$/i, '').trim();
  if (!title || title.length < 10) return null;

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

  // Body — extract <p> tags
  const ps: string[] = [];
  const pr = /<p[^>]*>([\s\S]*?)<\/p>/gi; let pm;
  while ((pm = pr.exec(html)) !== null) {
    const t = strip(pm[1]).trim();
    if (t.length > 25) ps.push(t);
  }
  const body = ps.join(' ');

  return { id, title, date: dateStr, body, url: `${BASE}/noticias-detalle.php?idNot=${id}` };
}

// ─── MAIN SCRAPE ────────────────────────────────────────────────
const created: any[] = [];
let skipped = 0, empty = 0;

console.log(`Scrape: IDs ${START}→${END}\n`);

for (let id = START; id >= END; id--) {
  const url = `${BASE}/noticias-detalle.php?idNot=${id}`;
  process.stdout.write(`  #${id}... `);

  if (existingUrls.has(url)) { process.stdout.write('dup\n'); skipped++; continue; }

  await sleep(DELAY);
  const html = await fetchP(url);
  if (!html) { process.stdout.write('empty\n'); empty++; continue; }

  const art = parseArt(html, id);
  if (!art) { process.stdout.write('invalid\n'); empty++; continue; }

  const fullText = (art.title + ' ' + art.body).substring(0, 5000);
  const normText = norm(fullText);

  // Score lenses
  const matchLens: string[] = [];
  const lensIds = new Set<string>();
  for (const kw of lensKw) {
    if (normText.includes(norm(kw.termino))) {
      if (!lensIds.has(kw.lenteId)) { matchLens.push(kw.lenteNombre); lensIds.add(kw.lenteId); }
    }
  }

  // Score ejes
  const matchEjes: string[] = [];
  const ejeIds = new Set<string>();
  for (const kw of ejeKw) {
    if (normText.includes(norm(kw.termino))) {
      if (!ejeIds.has(kw.ejeId)) { matchEjes.push(kw.ejeNombre); ejeIds.add(kw.ejeId); }
    }
  }

  const score = matchLens.length + matchEjes.length;

  // Accept: keyword match OR substantial body from trusted source
  if (score === 0 && art.body.length < 600) {
    process.stdout.write(`score 0, corto (${art.body.length})\n`);
    continue;
  }

  // Insert into DB
  const id_m = `cmp_p2a_${id}_${Date.now()}`;
  try {
    db.query(`INSERT INTO Mencion (id, medioId, titulo, texto, textoCompleto, url, fechaCaptura, fechaPublicacion, tipoMencion, enlaceActivo, temas)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      id_m, medio.id, art.title.substring(0,300), art.body.substring(0,1000),
      art.body.substring(0,8000), art.url, new Date().toISOString(),
      art.date ? art.date + 'T12:00:00' : null, 'mencion_pasiva', 1,
      matchLens.join(',').substring(0,200)
    );

    // Link lenses
    for (const lid of lensIds) {
      db.query(`INSERT OR IGNORE INTO MencionLente (id, mencionId, lenteId, createdAt) VALUES (?, ?, ?, ?)`).run(
        `ml_p2a_${id}_${lid.substring(0,6)}`, id_m, lid, new Date().toISOString()
      );
    }
    // Link ejes
    for (const eid of ejeIds) {
      db.query(`INSERT OR IGNORE INTO MencionTema (id, mencionId, ejeTematicoId) VALUES (?, ?, ?)`).run(
        `mt_p2a_${id}_${eid.substring(0,6)}`, id_m, eid
      );
    }

    created.push({ id, title: art.title, date: art.date, lens: matchLens, ejes: matchEjes, score, bodyLen: art.body.length });
    const tags = score > 0 ? `[${matchLens.join(',')}]` : '[sin-keywords]';
    process.stdout.write(`✅ ${tags}\n`);
  } catch (e: any) {
    process.stdout.write(`DB err: ${String(e).substring(0,50)}\n`);
  }
}

// ─── Summary ────────────────────────────────────────────────────
const total = db.query(`SELECT COUNT(*) as c FROM Mencion`).get() as any;
console.log('\n' + '═'.repeat(55));
console.log(`  PASO 2A RESULTADO`);
console.log('═'.repeat(55));
console.log(`  Procesados: ${START - END + 1} | Dup: ${skipped} | Empty: ${empty}`);
console.log(`  Creados: ${created.length}`);
console.log(`  Total DB: ${total.c} menciones`);
console.log('');

if (created.length > 0) {
  console.log('  📰 Artículos capturados:');
  for (const a of created) {
    console.log(`  #${a.id} (${a.date}) ${a.title.substring(0,60)}`);
    if (a.lens.length) console.log(`    Lentes: ${a.lens.join(', ')}`);
    if (a.ejes.length) console.log(`    Ejes: ${a.ejes.join(', ')}`);
  }
}

// Lens distribution
const ld = new Map<string, number>();
for (const a of created) for (const l of a.lens) ld.set(l, (ld.get(l)||0)+1);
if (ld.size) {
  console.log('\n  Lentes (nuevos):');
  for (const [n,c] of [...ld.entries()].sort((a,b)=>b[1]-a[1])) console.log(`  ${n}: ${c}`);
}

db.close();
