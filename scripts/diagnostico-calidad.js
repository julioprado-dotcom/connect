const Database = require('better-sqlite3');
const { validateContent } = require('./src/lib/quality/validator.ts') || {};
const db = new Database('./prisma/db/custom.db', { readonly: true });

// Replicate validator inline since we can't import TS directly
function validateInline(contenido, tipo) {
  const rules = {
    EL_TERMOMETRO: { min: 250, max: 450, reqSecc: false, prohibido: ['lo siento','no puedo','como ia','i am','as an ai','N/A','en conclusion','se recomienda'], requerido: ['##'] },
    SALDO_DEL_DIA: { min: 300, max: 600, reqSecc: false, prohibido: ['lo siento','no puedo','como ia','i am','as an ai','N/A','Hits','Miss','en conclusion'], requerido: ['##'] },
    EL_FOCO: { min: 600, max: 1000, reqSecc: true, prohibido: ['lo siento','no puedo','como ia','i am','as an ai','N/A','en conclusion','se recomienda'], requerido: ['##'] },
    EL_ESPECIALIZADO: { min: 1200, max: 2500, reqSecc: true, prohibido: ['lo siento','no puedo','como ia','i am','as an ai','se recomienda','es necesario','se debe','en conclusion'], requerido: ['##','hallazgo'] },
    EL_HILO: { min: 500, max: 900, reqSecc: false, prohibido: ['lo siento','no puedo','como ia','i am','as an ai','N/A','en conclusion'], requerido: [] },
    EL_RADAR: { min: 400, max: 800, reqSecc: false, prohibido: ['lo siento','no puedo','como ia','i am','as an ai','N/A','en conclusion'], requerido: ['##'] },
    BOLETIN_DEL_GRANO: { min: 600, max: 1200, reqSecc: true, prohibido: ['lo siento','no puedo','como ia','i am','as an ai','N/A','en conclusion','se recomienda'], requerido: ['##','café','cafe'] },
  };
  const r = rules[tipo] || rules.EL_TERMOMETRO;
  const palabras = contenido.trim().split(/\s+/).filter(w => w.length > 0).length;
  const cl = contenido.toLowerCase();
  const errores = [];
  const advertencias = [];

  if (palabras < r.min) errores.push(`Corto: ${palabras}/${r.min}`);
  if (palabras > r.max) advertencias.push(`Largo: ${palabras}/${r.max}`);
  for (const p of r.prohibido) { if (cl.includes(p.toLowerCase())) errores.push(`Prohibido: "${p}"`); }
  for (const q of r.requerido) { if (!cl.includes(q.toLowerCase())) advertencias.push(`Falta: "${q}"`); }

  const secciones = (contenido.match(/^##\s+.+$/gm) || []).length;
  if (r.reqSecc && secciones < 3) advertencias.push(`Pocas secciones: ${secciones}`);

  let score = 100;
  score -= errores.length * 30;
  score -= advertencias.length * 10;

  const citas = (contenido.match(/\(Fuente:\s*[^)]+\)/gi) || []).length;
  if (citas >= 5) score += 5; else if (citas >= 3) score += 3; else if (citas === 0) score -= 15;

  const notasPie = (contenido.match(/\[\d+\]/g) || []).length;
  if (notasPie >= 5 && citas === 0) score += 5; else if (notasPie >= 3 && citas === 0) score += 3;

  if (/N\/A/gi.test(contenido)) { score -= 15; errores.push('N/A placeholders'); }

  const edKw = ['critico','grave','dramatico','preocupante','alarmante','sin precedentes','punto de inflexion','escalada significativa'];
  const edHits = edKw.filter(k => cl.includes(k));
  if (edHits.length >= 3) { score -= 10; errores.push('Editorial: ' + edHits.slice(0,3).join(', ')); }
  else if (edHits.length > 0) { score -= 3; advertencias.push('Posible editorial: ' + edHits.join(', ')); }

  const ghostPats = [/\bSe aprobo\b/gi,/\bSe rechazo\b/gi,/\bSe informo\b/gi,/\bSe declaro\b/gi,/\bSe presento\b/gi,/\bSe discutio\b/gi,/\bSe sanciono\b/gi,/\bSe promulgo\b/gi];
  let ghostCount = 0;
  for (const pat of ghostPats) { const m = contenido.match(pat); if (m) ghostCount += m.length; }
  if (ghostCount >= 3) { score -= 10; advertencias.push(`Ghost: ${ghostCount}`); }
  else if (ghostCount > 0) { score -= 3; advertencias.push(`Ghost: ${ghostCount}`); }

  if (/\bHits?\b/gi.test(contenido) || /\bMiss\b/g.test(contenido)) { score -= 5; errores.push('Anglicismos Hits/Miss'); }

  if (/DECODEX/i.test(contenido)) score += 3;
  if (/\d+\s*menciones?\s*de\s*\d+\s*medios/i.test(contenido)) score += 3;

  score = Math.max(0, Math.min(100, score));
  return { score, palabras, citas, secciones, errores, advertencias };
}

const productos = ['EL_TERMOMETRO','SALDO_DEL_DIA','EL_FOCO','EL_ESPECIALIZADO','EL_HILO','EL_RADAR','BOLETIN_DEL_GRANO'];

console.log('═══════════════════════════════════════════════════════════════');
console.log('  DIAGNOSTICO DETALLADO DE CALIDAD');
console.log('═══════════════════════════════════════════════════════════════\n');

for (const p of productos) {
  const r = db.prepare('SELECT clasificadores, contenido, totalMenciones, fechaCreacion FROM Reporte WHERE tipo=? ORDER BY fechaCreacion DESC LIMIT 1').get(p);
  if (!r) { console.log(p + ': SIN GENERAR\n'); continue; }

  let scoreDB = '?';
  try { scoreDB = JSON.parse(r.clasificadores||'{}').puntuacionCalidad || '?'; } catch(e){}

  const v = validateInline(r.contenido, p);
  const status = v.score >= 85 ? '✅' : '❌';
  const d = new Date(r.fechaCreacion).toISOString().slice(11,19);

  console.log(`${status} ${p} | DB=${scoreDB} Inline=${v.score} | ${v.palabras} pal | ${v.citas} citas | ${v.secciones} secc | ${r.totalMenciones} menc | ${d}`);
  if (v.errores.length) console.log('   ERRORES: ' + v.errores.join(' | '));
  if (v.advertencias.length) console.log('   WARN: ' + v.advertencias.join(' | '));
  console.log('');
}

db.close();