const Database = require('better-sqlite3');
const db = new Database('./prisma/db/custom.db', { readonly: true });
const productos = ['EL_TERMOMETRO','SALDO_DEL_DIA','EL_FOCO','EL_ESPECIALIZADO','EL_HILO','EL_RADAR','BOLETIN_DEL_GRANO'];
for (const p of productos) {
  const r = db.prepare('SELECT clasificadores, totalMenciones, fechaCreacion, length(contenido) as chars FROM Reporte WHERE tipo=? ORDER BY fechaCreacion DESC LIMIT 1').get(p);
  if (!r) { console.log(p + ': SIN GENERAR'); continue; }
  let score = '?';
  try { score = JSON.parse(r.clasificadores||'{}').puntuacionCalidad || '?'; } catch(e){}
  const d = new Date(r.fechaCreacion).toISOString().slice(11,19);
  console.log(d + ' | ' + p.padEnd(20) + ' | score=' + String(score).padStart(4) + ' | ' + r.totalMenciones + ' menc | ' + r.chars + ' chars');
}
db.close();