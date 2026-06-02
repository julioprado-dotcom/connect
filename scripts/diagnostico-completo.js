#!/usr/bin/env node
/**
 * diagnostico-completo.js — Diagnóstico completo del pipeline DECODEX
 * Ejecutar en VPS: node scripts/diagnostico-completo.js
 */
// ── Ruta absoluta a la DB (igual que src/lib/db.ts) ──
process.env.DATABASE_URL = `file:${process.cwd()}/prisma/db/custom.db`;
const { PrismaClient } = require('./node_modules/.prisma/client');
const p = new PrismaClient();

async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  DECODEX — DIAGNÓSTICO COMPLETO DEL PIPELINE');
  console.log('  ' + new Date().toISOString());
  console.log('═══════════════════════════════════════════════════\n');

  // ── 1. MEDIOS (tabla base) ──
  const totalMedios = await p.medio.count();
  const mediosActivos = await p.medio.count({ where: { activo: true } });
  const mediosPorCategoria = await p.medio.groupBy({ by: ['categoria'], _count: true });
  const mediosPorNivel = await p.medio.groupBy({ by: ['nivel'], _count: true });

  console.log('══ 1. MEDIOS ══');
  console.log(`  Total: ${totalMedios} | Activos: ${mediosActivos}`);
  console.log('  Por categoría:');
  for (const c of mediosPorCategoria) console.log(`    ${c.categoria}: ${c._count.id}`);
  console.log('  Por nivel:');
  for (const n of mediosPorNivel) console.log(`    Nivel ${n.nivel}: ${n._count.id}`);

  // ── 2. FUENTEESTADO (tabla de estado de fuentes) ──
  const totalFE = await p.fuenteEstado.count();
  const feConEstado = await p.fuenteEstado.count({ where: { estado: { not: null } } });
  const feSinEstado = await p.fuenteEstado.count({ where: { estado: null } });

  console.log('\n══ 2. FUENTEESTADO ══');
  console.log(`  Total registros: ${totalFE}`);
  console.log(`  Con estado (not null): ${feConEstado}`);
  console.log(`  Con estado null: ${feSinEstado}`);

  if (totalFE > 0) {
    // Verificar todos los estados posibles
    const estadosRaw = await p.$queryRaw`SELECT estado, COUNT(*) as cnt FROM FuenteEstado GROUP BY estado`;
    console.log('  Estados encontrados:');
    for (const e of estadosRaw) {
      console.log(`    "${e.estado || '(NULL)'}": ${Number(e.cnt)}`);
    }

    // Verificar activo
    const feActivas = await p.fuenteEstado.count({ where: { activo: true } });
    const feInactivas = await p.fuenteEstado.count({ where: { activo: false } });
    const feActivoNull = await p.fuenteEstado.count({ where: { activo: null } });
    console.log(`  activo=true: ${feActivas} | false: ${feInactivas} | null: ${feActivoNull}`);

    // Medios con FuenteEstado vs sin
    const feConMedio = await p.fuenteEstado.findMany({
      select: { medioId: true, estado: true, activo: true, ultimoCheck: true, fallosConsecutivos: true }
    });
    const mediosConFE = new Set(feConMedio.map(f => f.medioId));
    console.log(`  Medios CON FuenteEstado: ${mediosConFE.size}`);
    console.log(`  Medios SIN FuenteEstado: ${totalMedios - mediosConFE.size}`);

    // Fuentes con ultimoCheck reciente
    const ahora = new Date();
    const hace24h = new Date(ahora.getTime() - 24 * 60 * 60 * 1000);
    const hace72h = new Date(ahora.getTime() - 72 * 60 * 60 * 1000);
    const checkRecent = feConMedio.filter(f => f.ultimoCheck && new Date(f.ultimoCheck) > hace24h).length;
    const check72h = feConMedio.filter(f => f.ultimoCheck && new Date(f.ultimoCheck) > hace72h).length;
    console.log(`  Con check en 24h: ${checkRecent} | en 72h: ${check72h}`);

    // Top 5 con más fallos
    const topFallos = feConMedio
      .filter(f => (f.fallosConsecutivos || 0) > 0)
      .sort((a, b) => (b.fallosConsecutivos || 0) - (a.fallosConsecutivos || 0))
      .slice(0, 5);
    if (topFallos.length > 0) {
      console.log('  Top fallos consecutivos:');
      for (const f of topFallos) console.log(`    ${f.medioId}: ${f.fallosConsecutivos} fallos`);
    }
  } else {
    console.log('  ⚠️  TABLA VACÍA — No hay registros de FuenteEstado');
    console.log('  El scheduler no puede programar nada sin FuenteEstado con estado="activa"');
  }

  // ── 3. JOBS (cola de trabajo) ──
  const totalJobs = await p.job.count();
  const jobsPorEstado = await p.$queryRaw`SELECT estado, CAST(COUNT(*) AS INTEGER) as cnt FROM Job GROUP BY estado`;
  const jobsPendientes = await p.job.count({ where: { estado: 'pendiente' } });
  const jobs24h = await p.job.count({
    where: { fechaCreacion: { gt: hace24h } }
  });

  console.log('\n══ 3. JOBS ══');
  console.log(`  Total: ${totalJobs} | Pendientes: ${jobsPendientes} | Creados en 24h: ${jobs24h}`);
  for (const j of jobsPorEstado) console.log(`    ${j.estado}: ${j.cnt}`);

  if (jobsPendientes > 0) {
    const pendientes = await p.job.findMany({
      where: { estado: 'pendiente' },
      select: { id: true, tipo: true, prioridad: true, fechaCreacion: true, proximaEjecucion: true },
      orderBy: { fechaCreacion: 'desc' },
      take: 10
    });
    console.log('  Jobs pendientes (últimos 10):');
    for (const j of pendientes) {
      console.log(`    ${j.id} | ${j.tipo} | P${j.prioridad} | ${j.fechaCreacion?.toISOString()}`);
    }
  }

  // ── 4. NOTAS RAW (intermedio scrape→LLM) ──
  const totalNR = await p.notaRaw.count();
  const nrPendientes = await p.notaRaw.count({ where: { procesada: false, descartada: false } });
  const nrProcesadas = await p.notaRaw.count({ where: { procesada: true } });
  const nrDescartadas = await p.notaRaw.count({ where: { descartada: true } });
  const nrPorMedio = await p.$queryRaw`SELECT medioId, COUNT(*) as cnt FROM NotaRaw WHERE procesada = 0 AND descartada = 0 GROUP BY medioId ORDER BY cnt DESC LIMIT 10`;

  console.log('\n══ 4. NOTAS RAW ══');
  console.log(`  Total: ${totalNR} | Pendientes: ${nrPendientes} | Procesadas: ${nrProcesadas} | Descartadas: ${nrDescartadas}`);
  if (nrPorMedio.length > 0) {
    console.log('  Pendientes por medio (top 10):');
    for (const m of nrPorMedio) console.log(`    ${m.medioId}: ${Number(m.cnt)}`);
  }

  // ── 5. MENCIONES (resultado del LLM) ──
  const totalMenciones = await p.mencion.count();
  const menciones24h = await p.mencion.count({ where: { fechaCaptura: { gt: hace24h } } });
  const mencionesClasificadas = await p.mencion.count({ where: { fechaClasificacion: { not: null } } });

  console.log('\n══ 5. MENCIONES ══');
  console.log(`  Total: ${totalMenciones} | En 24h: ${menciones24h} | Clasificadas: ${mencionesClasificadas}`);

  if (totalMenciones > 0) {
    const mencionesPorMedio = await p.$queryRaw`SELECT medioId, COUNT(*) as cnt FROM Mencion GROUP BY medioId ORDER BY cnt DESC LIMIT 10`;
    console.log('  Por medio (top 10):');
    for (const m of mencionesPorMedio) console.log(`    ${m.medioId}: ${Number(m.cnt)}`);
  }

  // ── 6. RECHAZOS (artículos filtrados por LLM) ──
  const totalRechazos = await p.rechazoCaptura.count();
  const rechazos24h = await p.rechazoCaptura.count({ where: { createdAt: { gt: hace24h } } });

  console.log('\n══ 6. RECHAZOS CAPTURA ══');
  console.log(`  Total: ${totalRechazos} | En 24h: ${rechazos24h}`);

  if (totalRechazos > 0) {
    const rechazosPorMotivo = await p.$queryRaw`SELECT motivo, COUNT(*) as cnt FROM RechazoCaptura GROUP BY motivo ORDER BY cnt DESC LIMIT 10`;
    console.log('  Por motivo (top 10):');
    for (const r of rechazosPorMotivo) console.log(`    ${r.motivo}: ${Number(r.cnt)}`);
  }

  // ── 7. REPORTES / PRODUCTOS ──
  const totalReportes = await p.reporte.count();
  const totalReportesSectorial = await p.reporteSectorial.count();

  console.log('\n══ 7. REPORTES (PRODUCTOS) ══');
  console.log(`  Reportes: ${totalReportes} | Reportes Sectoriales: ${totalReportesSectorial}`);

  // ── 8. USO IA (tokens) ──
  const usoIA = await p.usoIA.count();
  const usoIA24h = await p.usoIA.count({ where: { createdAt: { gt: hace24h } } });

  console.log('\n══ 8. USO IA ══');
  console.log(`  Total llamadas: ${usoIA} | En 24h: ${usoIA24h}`);

  if (usoIA > 0) {
    const usoPorFuente = await p.$queryRaw`SELECT fuente, COUNT(*) as cnt FROM UsoIA GROUP BY fuente ORDER BY cnt DESC LIMIT 10`;
    console.log('  Por fuente (top 10):');
    for (const u of usoPorFuente) console.log(`    ${u.fuente}: ${Number(u.cnt)}`);
  }

  // ── 9. SYSTEM LOG (acciones automáticas) ──
  const logsRecientes = await p.systemLog.findMany({
    orderBy: { fecha: 'desc' },
    take: 15,
    select: { modulo: true, accion: true, detalle: true, fecha: true, automatica: true }
  });

  console.log('\n══ 9. SYSTEM LOG (últimos 15) ══');
  for (const l of logsRecientes) {
    const auto = l.automatica ? 'AUTO' : 'MANUAL';
    console.log(`  [${l.fecha?.toISOString().slice(5, 16)}] ${l.modulo}/${l.accion} (${auto})`);
    if (l.detalle) console.log(`    → ${l.detalle.slice(0, 120)}`);
  }

  // ── 10. CAPTURA LOG (scrapes) ──
  const capturas24h = await p.capturaLog.count({ where: { fecha: { gt: hace24h } } });
  const capturasExitosas24h = await p.capturaLog.count({ where: { fecha: { gt: hace24h }, exitosa: true } });

  console.log('\n══ 10. CAPTURA LOG ══');
  console.log(`  En 24h: ${capturas24h} | Exitosas: ${capturasExitosas24h}`);

  // ── 11. DIAGNÓSTICO FINAL ──
  console.log('\n═══════════════════════════════════════════════════');
  console.log('  DIAGNÓSTICO FINAL');
  console.log('═══════════════════════════════════════════════════');

  const problemas = [];

  if (totalFE === 0) {
    problemas.push('CRÍTICO: Tabla FuenteEstado VACÍA. El scheduler no puede programar fuentes.');
  } else if (feConEstado === 0 && totalFE > 0) {
    problemas.push('CRÍTICO: Todos los FuenteEstado tienen estado=NULL. Scheduler filtra por estado="activa" y no encuentra ninguna.');
  } else {
    const feActivas = await p.fuenteEstado.count({ where: { estado: 'activa' } });
    if (feActivas === 0) {
      problemas.push('CRÍTICO: Ningún FuenteEstado tiene estado="activa". Scheduler no programa nada.');
    }
  }

  if (totalJobs === 0 && totalMedios > 0) {
    problemas.push('ALERTA: Tabla Job vacía. No hay tareas en cola ni ejecutadas.');
  }

  if (totalMenciones === 0 && totalNR === 0) {
    problemas.push('ALERTA: No hay Menciones ni NotasRaw. Pipeline de scrape/clasificación no produjo datos.');
  }

  if (totalNR > 0 && nrPendientes > 0 && totalMenciones === 0) {
    problemas.push('ALERTA: Hay NotasRaw pendientes pero 0 Menciones. batch_llm no se ejecutó o falló.');
  }

  if (problemas.length === 0) {
    console.log('  ✓ Pipeline parece operativo. Revisar detalles arriba.');
  } else {
    console.log(`  ${problemas.length} PROBLEMA(S) DETECTADO(S):`);
    for (let i = 0; i < problemas.length; i++) {
      console.log(`  ${i + 1}. ${problemas[i]}`);
    }
    console.log('\n  SOLUCIÓN: Ejecutar node scripts/fix-pipeline.js');
  }

  await p.disconnect();
}

main().catch(err => {
  console.error('Error fatal:', err.message);
  process.exit(1);
});
