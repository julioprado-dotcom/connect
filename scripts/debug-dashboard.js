const { PrismaClient } = require('@prisma/client');
const path = require('path');

const CANONICAL_DB_PATH = path.join(process.cwd(), 'prisma', 'db', 'custom.db');
process.env.DATABASE_URL = `file:${CANONICAL_DB_PATH}`;

const db = new PrismaClient();

async function main() {
  console.log('=== DIAGNÓSTICO DECODEX DASHBOARD ===');
  console.log('DB:', CANONICAL_DB_PATH);
  console.log('Now:', new Date().toISOString());
  console.log('');

  // 1. Counts
  console.log('--- 1. COUNTS ---');
  try {
    const counts = await db.$queryRawUnsafe(`
      SELECT 
        (SELECT COUNT(*) FROM Mencion) as menciones,
        (SELECT COUNT(*) FROM Medio) as medios,
        (SELECT COUNT(*) FROM FuenteEstado) as fuentes,
        (SELECT COUNT(*) FROM CapturaLog) as capturaLogs,
        (SELECT COUNT(*) FROM Job WHERE estado='en_progreso') as jobs_en_progreso,
        (SELECT COUNT(*) FROM Job WHERE estado='completado') as jobs_completados,
        (SELECT COUNT(*) FROM Reporte) as reportes,
        (SELECT COUNT(*) FROM Entrega) as entregas
    `);
    console.log(JSON.stringify(counts, null, 2));
  } catch(e) { console.error('ERR counts:', e.message); }

  // 2. Last 5 mentions with date fields
  console.log('\n--- 2. LAST 5 MENCIONES (fechaCaptura DESC) ---');
  try {
    const rows = await db.$queryRawUnsafe(`
      SELECT id, substr(titulo,1,50) as titulo, fechaCaptura, fechaCreacion, createdAt, updatedAt
      FROM Mencion
      ORDER BY fechaCaptura DESC
      LIMIT 5
    `);
    const now = Date.now();
    for (const r of rows) {
      const fc = r.fechaCaptura ? new Date(r.fechaCaptura).toISOString() : 'NULL';
      const fcr = r.fechaCreacion ? new Date(r.fechaCreacion).toISOString() : 'NULL';
      const ca = r.createdAt ? new Date(r.createdAt).toISOString() : 'NULL';
      const diffH = r.fechaCaptura ? Math.floor((now - new Date(r.fechaCaptura).getTime()) / 3600000) : '?';
      console.log(`ID:${r.id} | hace ${diffH}h | fechaCaptura:${fc} | fechaCreacion:${fcr} | createdAt:${ca}`);
      console.log(`  titulo: "${r.titulo}"`);
    }
  } catch(e) { console.error('ERR:', e.message); }

  // 3. Menciones hoy (Bolivia time)
  console.log('\n--- 3. MENCIONES HOY (Bolivia UTC-4) ---');
  try {
    const now = new Date();
    const boNow = new Date(now.getTime() + now.getTimezoneOffset() * 60000 - 4 * 3600000);
    const hoyBo = new Date(boNow);
    hoyBo.setHours(0, 0, 0, 0);
    console.log('boStartOfDay:', hoyBo.toISOString());

    const hoyCount = await db.$queryRawUnsafe(`
      SELECT COUNT(*) as c FROM Mencion WHERE fechaCaptura >= ?
    `, hoyBo.toISOString());
    console.log('Menciones hoy (Bolivia):', hoyCount[0]?.c);

    const total = await db.$queryRawUnsafe(`SELECT COUNT(*) as c FROM Mencion`);
    console.log('Menciones total:', total[0]?.c);
  } catch(e) { console.error('ERR:', e.message); }

  // 4. Last 5 CapturaLogs
  console.log('\n--- 4. LAST 5 CAPTURA LOGS ---');
  try {
    const logs = await db.$queryRawUnsafe(`
      SELECT id, fecha, fuenteId, medioId
      FROM CapturaLog
      ORDER BY fecha DESC
      LIMIT 5
    `);
    if (logs.length === 0) console.log('No hay CapturaLogs');
    for (const l of logs) {
      const diffH = Math.floor((Date.now() - new Date(l.fecha).getTime()) / 3600000);
      console.log(`ID:${l.id} | hace ${diffH}h | fecha:${l.fecha} | fuenteId:${l.fuenteId} | medioId:${l.medioId}`);
    }
  } catch(e) { console.error('ERR:', e.message); }

  // 5. Zombie jobs
  console.log('\n--- 5. ZOMBIE JOBS (en_progreso) ---');
  try {
    const zombies = await db.$queryRawUnsafe(`
      SELECT id, tipo, estado, fechaCreacion, fechaInicio, fechaFin
      FROM Job
      WHERE estado = 'en_progreso'
      ORDER BY fechaInicio DESC
      LIMIT 10
    `);
    console.log(`Jobs en_progreso: ${zombies.length}`);
    for (const j of zombies) {
      const diffH = j.fechaInicio ? Math.floor((Date.now() - new Date(j.fechaInicio).getTime()) / 3600000) : '?';
      console.log(`ZOMBIE ID:${j.id} | tipo:${j.tipo} | hace ${diffH}h | inicio:${j.fechaInicio} | fin:${j.fechaFin}`);
    }
  } catch(e) { console.error('ERR:', e.message); }

  // 6. Distribution by day
  console.log('\n--- 6. MENCIONES POR DÍA (last 10 days) ---');
  try {
    const rows = await db.$queryRawUnsafe(`
      SELECT DATE(fechaCaptura) as fecha, COUNT(*) as total
      FROM Mencion
      WHERE fechaCaptura IS NOT NULL
      GROUP BY DATE(fechaCaptura)
      ORDER BY fecha DESC
      LIMIT 10
    `);
    for (const r of rows) {
      console.log(`${r.fecha} -> ${r.total} menciones`);
    }
  } catch(e) { console.error('ERR:', e.message); }

  // 7. NULL fechaCaptura count
  console.log('\n--- 7. fechaCaptura NULL CHECK ---');
  try {
    const nullCount = await db.$queryRawUnsafe(`SELECT COUNT(*) as c FROM Mencion WHERE fechaCaptura IS NULL`);
    const notNullCount = await db.$queryRawUnsafe(`SELECT COUNT(*) as c FROM Mencion WHERE fechaCaptura IS NOT NULL`);
    console.log('fechaCaptura NULL:', nullCount[0]?.c);
    console.log('fechaCaptura NOT NULL:', notNullCount[0]?.c);
  } catch(e) { console.error('ERR:', e.message); }

  // 8. Simulate haceTexto
  console.log('\n--- 8. SIMULACIÓN ultimaCapturaHace ---');
  try {
    const ult = await db.$queryRawUnsafe(`
      SELECT fechaCaptura FROM Mencion ORDER BY fechaCaptura DESC LIMIT 1
    `);
    if (ult.length > 0 && ult[0].fechaCaptura) {
      const ms = Date.now() - new Date(ult[0].fechaCaptura).getTime();
      const mins = Math.floor(ms / 60000);
      let txt;
      if (mins < 1) txt = 'ahora mismo';
      else if (mins < 60) txt = `hace ${mins}m`;
      else {
        const h = Math.floor(mins / 60);
        if (h < 24) txt = `hace ${h}h`;
        else txt = `hace ${Math.floor(h/24)}d`;
      }
      console.log(`ultimaCaptura: ${ult[0].fechaCaptura}`);
      console.log(`ultimaCapturaHace: "${txt}"`);
      console.log(`diff: ${mins} minutos (${Math.floor(mins/60)}h)`);
    } else {
      console.log('NO hay menciones con fechaCaptura');
    }
  } catch(e) { console.error('ERR:', e.message); }

  // 9. FuenteEstado
  console.log('\n--- 9. FUENTES (top 10 by ultimoCheck) ---');
  try {
    const fuentes = await db.$queryRawUnsafe(`
      SELECT fe.id, fe.medioId, m.nombre, fe.activo, fe.ultimoCheck, fe.totalMenciones, fe.fallosConsecutivos
      FROM FuenteEstado fe
      LEFT JOIN Medio m ON m.id = fe.medioId
      ORDER BY fe.ultimoCheck DESC
      LIMIT 10
    `);
    for (const f of fuentes) {
      const diffH = f.ultimoCheck ? Math.floor((Date.now() - new Date(f.ultimoCheck).getTime()) / 3600000) : '?';
      console.log(`${f.activo ? '🟢' : '⚫'} ${f.nombre || f.medioId} | últ check: hace ${diffH}h | menciones:${f.totalMenciones} | fallos:${f.fallosConsecutivos}`);
    }
  } catch(e) { console.error('ERR:', e.message); }

  console.log('\n=== FIN DIAGNÓSTICO ===');
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); }).finally(() => db.$disconnect());
