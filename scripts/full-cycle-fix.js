#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════
// full-cycle-fix.js — Prepara TODAS las fuentes para ciclo completo
// ═══════════════════════════════════════════════════════════════════
// 1. Limpia huérfanos (FuenteEstado sin Medio)
// 2. Promueve capa 0 → capa 1 (set ultimoCheckOk = now)
// 3. Activa todas las fuentes ('activa')
// 4. Encola check_fuente inmediato para TODAS las fuentes activas
// 5. Encola batch_llm para notas sin clasificar
// ═══════════════════════════════════════════════════════════════════

const path = require('path');
process.env.DATABASE_URL = 'file:/root/decodex-app/prisma/db/custom.db';

// Import PrismaClient from absolute path (works from any directory)
const { PrismaClient } = require(path.join(__dirname, '..', 'node_modules', '.prisma', 'client'));

const db = new PrismaClient();

async function main() {
  const now = new Date();

  // ── PASO 1: Identificar huérfanos ──
  console.log('\n━━━ PASO 1: Identificar huérfanos ━━━');
  const todasFE = await db.fuenteEstado.findMany();
  const todosMedios = await db.medio.findMany({ select: { id: true, nombre: true } });
  const medioIds = new Set(todosMedios.map(m => m.id));

  const huerfanos = todasFE.filter(fe => !medioIds.has(fe.medioId));
  const validas = todasFE.filter(fe => medioIds.has(fe.medioId));

  console.log(`  Total FuenteEstado: ${todasFE.length}`);
  console.log(`  Medios en DB: ${todosMedios.length}`);
  console.log(`  Válidas (medioId existe): ${validas.length}`);
  console.log(`  Huérfanas (medioId NO existe): ${huerfanos.length}`);

  if (huerfanos.length > 0) {
    for (const h of huerfanos) {
      console.log(`  ❌ Huérfana: ${h.id} → medioId ${h.medioId}`);
      // Eliminar huérfana
      await db.fuenteEstado.delete({ where: { id: h.id } });
      console.log(`     🗑️  Eliminada`);
    }
  }

  // ── PASO 2: Crear FuenteEstado faltantes ──
  console.log('\n━━━ PASO 2: Crear FuenteEstado faltantes ━━━');
  const feExistentes = new Set(validas.map(fe => fe.medioId));
  const mediosSinFE = todosMedios.filter(m => !feExistentes.has(m.id));

  if (mediosSinFE.length > 0) {
    console.log(`  ${mediosSinFE.length} medios sin FuenteEstado:`);
    for (const medio of mediosSinFE) {
      await db.fuenteEstado.create({
        data: {
          medioId: medio.id,
          url: medio.url || '',
          frecuenciaBase: '6h',
          frecuenciaActual: '6h',
          estado: 'activa',
          activo: true,
          ultimoCheckOk: now,
          capaActual: 1,
          fallosConsecutivos: 0,
        }
      });
      console.log(`  ✅ Creada: ${medio.nombre}`);
    }
  } else {
    console.log('  Todas las fuentes ya tienen FuenteEstado');
  }

  // ── PASO 3: Promover capa 0 → capa 1 ──
  console.log('\n━━━ PASO 3: Promover capa 0 → capa 1 ━━━');
  const fuentesCapa0 = await db.fuenteEstado.findMany({
    where: {
      OR: [
        { ultimoCheckOk: null },
        { ultimoCheckOk: { lt: new Date(Date.now() - 72 * 60 * 60 * 1000) } }
      ]
    },
    include: { medio: { select: { nombre: true } } }
  });

  console.log(`  ${fuentesCapa0.length} fuentes con capa 0 (sin check reciente):`);
  let promovidas = 0;
  for (const f of fuentesCapa0) {
    await db.fuenteEstado.update({
      where: { id: f.id },
      data: {
        ultimoCheckOk: now,
        capaActual: 1,
        fallosConsecutivos: 0,
      }
    });
    console.log(`  📈 Promovida: ${f.medio?.nombre || f.id}`);
    promovidas++;
  }
  console.log(`  Total promovidas: ${promovidas}`);

  // ── PASO 4: Activar todas ──
  console.log('\n━━━ PASO 4: Activar todas las fuentes ━━━');
  const inactivas = await db.fuenteEstado.findMany({
    where: { OR: [{ estado: { not: 'activa' } }, { activo: false }] },
    include: { medio: { select: { nombre: true } } }
  });

  for (const f of inactivas) {
    await db.fuenteEstado.update({
      where: { id: f.id },
      data: { estado: 'activa', activo: true }
    });
    console.log(`  ✅ Activada: ${f.medio?.nombre || f.id} (${f.estado})`);
  }
  console.log(`  Total activadas: ${inactivas.length}`);

  // ── PASO 5: Resumen post-fix ──
  console.log('\n━━━ PASO 5: Resumen post-fix ━━━');
  const despues = await db.fuenteEstado.findMany({
    where: { estado: 'activa' },
    include: { medio: { select: { nombre: true } } }
  });

  const conCheck = despues.filter(f => f.ultimoCheckOk).length;
  const sinCheck = despues.filter(f => !f.ultimoCheckOk).length;
  console.log(`  Fuentes activas: ${despues.length}`);
  console.log(`  Con ultimoCheckOk: ${conCheck}`);
  console.log(`  Sin ultimoCheckOk: ${sinCheck}`);

  // ── PASO 6: Encolar check_fuente para TODAS ──
  console.log('\n━━━ PASO 6: Encolar check_fuente inmediato ━━━');
  let encoladas = 0;
  let saltadas = 0;

  for (const f of despues) {
    // Verificar si ya hay un job pendiente para esta fuente
    const pendiente = await db.job.findFirst({
      where: {
        tipo: 'check_fuente',
        estado: { in: ['pendiente', 'ejecutando'] },
        payload: { contains: f.id }
      }
    });

    if (pendiente) {
      saltadas++;
      continue;
    }

    await db.job.create({
      data: {
        tipo: 'check_fuente',
        estado: 'pendiente',
        prioridad: 1,
        payload: JSON.stringify({
          fuenteId: f.id,
          medioId: f.medioId,
          probe: false,
        }),
        resultado: '',
      }
    });
    console.log(`  📤 Encolada: ${f.medio?.nombre || f.id}`);
    encoladas++;
  }

  console.log(`\n  Total encoladas: ${encoladas}`);
  console.log(`  Saltadas (ya pendiente): ${saltadas}`);

  // ── PASO 7: Encolar batch_llm si hay notas sin clasificar ──
  console.log('\n━━━ PASO 7: Batch LLM ━━━');
  const notasSinClasificar = await db.notaRaw.count({
    where: { procesada: false }
  });
  const mencionesHoy = await db.mencion.count({
    where: {
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    }
  });
  console.log(`  NotasRaw sin procesar: ${notasSinClasificar}`);
  console.log(`  Menciones últimas 24h: ${mencionesHoy}`);

  if (notasSinClasificar > 0) {
    const batchPendiente = await db.job.findFirst({
      where: {
        tipo: 'batch_llm',
        estado: { in: ['pendiente', 'ejecutando'] }
      }
    });

    if (!batchPendiente) {
      await db.job.create({
        data: {
          tipo: 'batch_llm',
          estado: 'pendiente',
          prioridad: 2,
          payload: JSON.stringify({ force: true }),
          resultado: '',
        }
      });
      console.log(`  📤 batch_llm encolado (${notasSinClasificar} notas pendientes)`);
    } else {
      console.log(`  ⏳ batch_llm ya está pendiente/ejecutando`);
    }
  } else {
    console.log(`  ✅ No hay notas pendientes de clasificación`);
  }

  // ── RESUMEN FINAL ──
  console.log('\n═══════════════════════════════════════════════════');
  console.log(`  ✅ Huérfanos eliminados: ${huerfanos.length}`);
  console.log(`  ✅ FuenteEstado creadas: ${mediosSinFE.length}`);
  console.log(`  ✅ Capa 0 → 1 promovidas: ${promovidas}`);
  console.log(`  ✅ Fuentes activadas: ${inactivas.length}`);
  console.log(`  📤 Check jobs encolados: ${encoladas}`);
  console.log(`  📊 Fuentes activas totales: ${despues.length}`);
  console.log('═══════════════════════════════════════════════════');
  console.log('\n👉 Ahora ejecuta: pm2 restart decodex-scheduler && pm2 restart decodex-worker');
  console.log('   Luego monitorea con: pm2 logs decodex-worker --lines 50');

  await db.$disconnect();
}

main().catch(async (e) => {
  console.error('❌ FATAL:', e.message);
  await db.$disconnect();
  process.exit(1);
});
