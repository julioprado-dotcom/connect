/**
 * ═══════════════════════════════════════════════════════════
 * SCRIPT DE DIAGNÓSTICO — Dashboard Desincronizado
 * ═══════════════════════════════════════════════════════════
 *
 * Ejecutar: npx tsx scripts/debug-dashboard.ts
 *
 * Diagnostica por qué el dashboard muestra "hace 3d" cuando
 * el backend está activo.
 */
import { PrismaClient } from '@prisma/client';
import { join } from 'path';

const PROJECT_ROOT = process.cwd();
const CANONICAL_DB_PATH = join(PROJECT_ROOT, 'prisma', 'db', 'custom.db');
process.env.DATABASE_URL = `file:${CANONICAL_DB_PATH}`;

const db = new PrismaClient();

const SEPARATOR = '═'.repeat(60);
const THIN_SEP = '─'.repeat(60);

async function main() {
  console.log(SEPARATOR);
  console.log('  🔍 DECODEX — DIAGNÓSTICO DE DASHBOARD');
  console.log(SEPARATOR);
  console.log(`  📂 DB Path: ${CANONICAL_DB_PATH}`);
  console.log(`  🕐 Server Time: ${new Date().toISOString()}`);
  console.log(`  🕐 Date.now(): ${Date.now()}`);
  console.log();

  // ─── 1. Verificar DB existe y tiene tablas ───
  console.log(SEPARATOR);
  console.log('  1. ESTADO DE LA BASE DE DATOS');
  console.log(SEPARATOR);

  try {
    // Contar registros en cada tabla importante
    const [menciones, medios, fuentes, capturaLogs, jobs, reportes, entregas, personas] =
      await Promise.all([
        db.mencion.count(),
        db.medio.count(),
        db.fuenteEstado.count(),
        db.capturaLog.count(),
        db.job.count(),
        db.reporte.count(),
        db.entrega.count(),
        db.persona.count(),
      ]);

    console.log(`  Mencion:          ${menciones} registros`);
    console.log(`  Medio:            ${medios} registros`);
    console.log(`  FuenteEstado:     ${fuentes} registros`);
    console.log(`  CapturaLog:       ${capturaLogs} registros`);
    console.log(`  Job:              ${jobs} registros`);
    console.log(`  Reporte:          ${reportes} registros`);
    console.log(`  Entrega:          ${entregas} registros`);
    console.log(`  Persona:          ${personas} registros`);
  } catch (err) {
    console.error('  ❌ ERROR accediendo a tablas:', err);
  }

  // ─── 2. Últimas 10 menciones con TODOS sus campos de fecha ───
  console.log();
  console.log(SEPARATOR);
  console.log('  2. ÚLTIMAS 10 MENCIONES — CAMPOS DE FECHA');
  console.log(SEPARATOR);

  try {
    const ultimas = await db.mencion.findMany({
      orderBy: { fechaCaptura: 'desc' },
      take: 10,
      select: {
        id: true,
        titulo: true,
        fechaCaptura: true,
        fechaCreacion: true,
        createdAt: true,
        updatedAt: true,
        medioId: true,
        personaId: true,
        tipoMencion: true,
        sentimiento: true,
      },
    });

    if (ultimas.length === 0) {
      console.log('  ⚠️  NO hay menciones en la DB');
    } else {
      const now = Date.now();
      console.log(`  {"fechaCaptura":Date,"fechaCreacion":Date,"createdAt":Date,"updatedAt":Date}`);
      for (const m of ultimas) {
        const fc = m.fechaCaptura ? new Date(m.fechaCaptura).toISOString() : 'NULL';
        const fcr = m.fechaCreacion ? new Date(m.fechaCreacion).toISOString() : 'NULL';
        const ca = m.createdAt ? new Date(m.createdAt).toISOString() : 'NULL';
        const ua = m.updatedAt ? new Date(m.updatedAt).toISOString() : 'NULL';

        const fcMs = m.fechaCaptura ? new Date(m.fechaCaptura).getTime() : 0;
        const diffMs = now - fcMs;
        const diffHoras = Math.floor(diffMs / 3600000);
        const diffDias = Math.floor(diffHoras / 24);

        console.log(THIN_SEP);
        console.log(`  ID: ${m.id}`);
        console.log(`  Título: ${m.titulo?.substring(0, 60)}`);
        console.log(`  fechaCaptura:  ${fc}  (hace ${diffHoras}h / ${diffDias}d)`);
        console.log(`  fechaCreacion: ${fcr}`);
        console.log(`  createdAt:     ${ca}`);
        console.log(`  updatedAt:     ${ua}`);
        console.log(`  medioId: ${m.medioId} | personaId: ${m.personaId || 'null'}`);
        console.log(`  tipoMencion: ${m.tipoMencion} | sentimiento: ${m.sentimiento}`);
      }
    }
  } catch (err) {
    console.error('  ❌ ERROR leyendo menciones:', err);
  }

  // ─── 3. Menciones de HOY (según fechaCaptura con lógica de Bolivia) ───
  console.log();
  console.log(SEPARATOR);
  console.log('  3. MENCIONES "HOY" — PRUEBA DE FILTRO BOLIVIA');
  console.log(SEPARATOR);

  try {
    // Reproducir exactamente la lógica de boStartOfDay() del endpoint
    const now = new Date();
    const boNow = new Date(now.getTime() + now.getTimezoneOffset() * 60000 - 4 * 3600000);
    const hoyBo = new Date(boNow);
    hoyBo.setHours(0, 0, 0, 0);

    console.log(`  Server now (UTC):  ${now.toISOString()}`);
    console.log(`  Bolivia now:       ${boNow.toISOString()}`);
    console.log(`  Bolivia startOfDay: ${hoyBo.toISOString()}`);

    const mencionesHoy = await db.mencion.count({
      where: { fechaCaptura: { gte: hoyBo } },
    });

    const mencionesHoyTotal = await db.mencion.count();

    console.log(`  Menciones con fechaCaptura >= hoy (Bolivia): ${mencionesHoy}`);
    console.log(`  Menciones totales: ${mencionesHoyTotal}`);

    // También probar con UTC
    const utcToday = new Date();
    utcToday.setHours(0, 0, 0, 0);
    const mencionesHoyUTC = await db.mencion.count({
      where: { fechaCaptura: { gte: utcToday } },
    });
    console.log(`  Menciones con fechaCaptura >= hoy (UTC):    ${mencionesHoyUTC}`);

    // Últimas 24h absolutas
    const hace24h = new Date(Date.now() - 24 * 3600000);
    const menciones24h = await db.mencion.count({
      where: { fechaCaptura: { gte: hace24h } },
    });
    console.log(`  Menciones con fechaCaptura >= 24h atrás:    ${menciones24h}`);

    // Últimas 72h
    const hace72h = new Date(Date.now() - 72 * 3600000);
    const menciones72h = await db.mencion.count({
      where: { fechaCaptura: { gte: hace72h } },
    });
    console.log(`  Menciones con fechaCaptura >= 72h atrás:    ${menciones72h}`);
  } catch (err) {
    console.error('  ❌ ERROR en filtro de hoy:', err);
  }

  // ─── 4. Últimos CapturaLogs ───
  console.log();
  console.log(SEPARATOR);
  console.log('  4. ÚLTIMOS 5 CAPTURA LOGS');
  console.log(SEPARATOR);

  try {
    const logs = await db.capturaLog.findMany({
      orderBy: { fecha: 'desc' },
      take: 5,
    });
    if (logs.length === 0) {
      console.log('  ⚠️  NO hay CapturaLogs');
    } else {
      for (const log of logs) {
        const diffH = Math.floor((Date.now() - new Date(log.fecha).getTime()) / 3600000);
        console.log(`  📝 ID:${log.id} | fecha: ${log.fecha.toISOString()} | hace ${diffH}h`);
        if (log.fuenteId) console.log(`     fuenteId: ${log.fuenteId}`);
        if (log.medioId) console.log(`     medioId: ${log.medioId}`);
        if (log.menciones !== undefined) console.log(`     menciones: ${log.menciones}`);
      }
    }
  } catch (err) {
    console.error('  ❌ ERROR leyendo CapturaLog:', err);
  }

  // ─── 5. Jobs — buscar zombies ───
  console.log();
  console.log(SEPARATOR);
  console.log('  5. JOBS — ZOMBIES Y ESTADO');
  console.log(SEPARATOR);

  try {
    const enProgreso = await db.job.findMany({
      where: { estado: 'en_progreso' },
      orderBy: { fechaInicio: 'desc' },
      take: 10,
    });
    console.log(`  Jobs "en_progreso": ${enProgreso.length}`);
    for (const j of enProgreso) {
      const diffH = j.fechaInicio
        ? Math.floor((Date.now() - new Date(j.fechaInicio).getTime()) / 3600000)
        : '?';
      console.log(`    🧟 ID:${j.id} | tipo: ${j.tipo} | hace ${diffH}h | inicio: ${j.fechaInicio?.toISOString() || 'N/A'}`);
    }

    const pendientes = await db.job.findMany({
      where: { estado: 'pendiente' },
      orderBy: { fechaCreacion: 'desc' },
      take: 5,
    });
    console.log(`  Jobs "pendiente": ${pendientes.length}`);

    const completados = await db.job.findMany({
      where: { estado: 'completado' },
      orderBy: { fechaFin: 'desc' },
      take: 5,
    });
    console.log(`  Últimos jobs "completado": ${completados.length}`);
    for (const j of completados) {
      const diffH = j.fechaFin
        ? Math.floor((Date.now() - new Date(j.fechaFin).getTime()) / 3600000)
        : '?';
      console.log(`    ✅ tipo: ${j.tipo} | hace ${diffH}h | fin: ${j.fechaFin?.toISOString() || 'N/A'}`);
    }
  } catch (err) {
    console.error('  ❌ ERROR leyendo jobs:', err);
  }

  // ─── 6. FuenteEstado — fuentes activas y último check ───
  console.log();
  console.log(SEPARATOR);
  console.log('  6. FUENTES — ESTADO Y ÚLTIMO CHECK');
  console.log(SEPARATOR);

  try {
    const fuentes = await db.fuenteEstado.findMany({
      include: { Medio: { select: { nombre: true } } },
      orderBy: { ultimoCheck: 'desc' },
      take: 15,
    });
    for (const f of fuentes) {
      const diffH = f.ultimoCheck
        ? Math.floor((Date.now() - new Date(f.ultimoCheck).getTime()) / 3600000)
        : '?';
      const estado = f.activo
        ? f.fallosConsecutivos > 3 ? '🔴 ERROR' : f.fallosConsecutivos > 0 ? '🟡 WARN' : '🟢 OK'
        : '⚫ OFF';
      console.log(
        `  ${estado} ${f.Medio?.nombre || f.medioId} | últ. check: ${f.ultimoCheck?.toISOString() || 'NUNCA'} | hace ${diffH}h | menciones: ${f.totalMenciones}`
      );
    }
  } catch (err) {
    console.error('  ❌ ERROR leyendo fuentes:', err);
  }

  // ─── 7. Simular lógica del endpoint indicadores-summary ───
  console.log();
  console.log(SEPARATOR);
  console.log('  7. SIMULACIÓN DEL ENDPOINT indicadores-summary');
  console.log(SEPARATOR);

  try {
    const ultMencion = await db.mencion.findFirst({
      orderBy: { fechaCaptura: 'desc' },
      select: { fechaCaptura: true },
    });

    if (ultMencion?.fechaCaptura) {
      const ms = Date.now() - new Date(ultMencion.fechaCaptura).getTime();
      const mins = Math.floor(ms / 60000);
      let haceTexto: string;
      if (mins < 1) haceTexto = 'ahora mismo';
      else if (mins < 60) haceTexto = `hace ${mins}m`;
      else {
        const horas = Math.floor(mins / 60);
        if (horas < 24) haceTexto = `hace ${horas}h`;
        else haceTexto = `hace ${Math.floor(horas / 24)}d`;
      }

      console.log(`  últimaCaptura:      ${ultMencion.fechaCaptura.toISOString()}`);
      console.log(`  últimaCapturaHace:   "${haceTexto}"`);
      console.log(`  diff from now:       ${mins} minutos`);
    } else {
      console.log('  ⚠️  No se encontró fechaCaptura en ninguna mención');
    }
  } catch (err) {
    console.error('  ❌ ERROR simulando endpoint:', err);
  }

  // ─── 8. Verificar si hay menciones con fechaCaptura NULL ───
  console.log();
  console.log(SEPARATOR);
  console.log('  8. MENCIONES CON fechaCaptura NULL');
  console.log(SEPARATOR);

  try {
    // SQLite doesn't have IS NULL in Prisma easily, use raw
    const nullCount = await db.$queryRawUnsafe(
      "SELECT COUNT(*) as c FROM Mencion WHERE fechaCaptura IS NULL"
    ) as Array<{ c: number }>;
    console.log(`  Menciones con fechaCaptura = NULL: ${nullCount[0]?.c ?? '?'}`);

    const notNullCount = await db.$queryRawUnsafe(
      "SELECT COUNT(*) as c FROM Mencion WHERE fechaCaptura IS NOT NULL"
    ) as Array<{ c: number }>;
    console.log(`  Menciones con fechaCaptura != NULL: ${notNullCount[0]?.c ?? '?'}`);
  } catch (err) {
    console.error('  ❌ ERROR:', err);
  }

  // ─── 9. Distribución de fechas (últimos 7 días) ───
  console.log();
  console.log(SEPARATOR);
  console.log('  9. DISTRIBUCIÓN DE MENCIONES POR DÍA (últimos 7d)');
  console.log(SEPARATOR);

  try {
    const rows = await db.$queryRawUnsafe(`
      SELECT DATE(fechaCaptura) as fecha, COUNT(*) as total
      FROM Mencion
      WHERE fechaCaptura IS NOT NULL
      GROUP BY DATE(fechaCaptura)
      ORDER BY fecha DESC
      LIMIT 10
    `) as Array<{ fecha: string; total: number }>;

    for (const r of rows) {
      const diffD = Math.floor((Date.now() - new Date(r.fecha + 'T12:00:00Z').getTime()) / 86400000);
      console.log(`  ${r.fecha}  →  ${r.total} menciones  (hace ${diffD}d)`);
    }
  } catch (err) {
    console.error('  ❌ ERROR:', err);
  }

  console.log();
  console.log(SEPARATOR);
  console.log('  ✅ DIAGNÓSTICO COMPLETADO');
  console.log(SEPARATOR);
}

main()
  .catch(err => {
    console.error('FATAL:', err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
