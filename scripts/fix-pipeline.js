#!/usr/bin/env node
/**
 * fix-pipeline.js — Reparar pipeline DECODEX y lanzar ciclo completo
 * Ejecutar en VPS: node scripts/fix-pipeline.js
 *
 * Qué hace:
 * 1. Diagnostica el estado actual
 * 2. Crea FuenteEstado faltantes para medios sin uno
 * 3. Activa todas las fuentes (estado='activa', activo=true)
 * 4. Limpia jobs atascados
 * 5. Encola check_fuente para TODAS las fuentes
 * 6. Opcionalmente encola batch_llm si hay NotasRaw pendientes
 * 7. Opcionalmente encola generar_boletin si hay menciones
 */
const { PrismaClient } = require('./node_modules/.prisma/client');
const { randomBytes } = require('crypto');
const fs = require('fs');
const path = require('path');
const p = new PrismaClient();

const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  DECODEX — FIX PIPELINE + CICLO COMPLETO');
  console.log(`  ${DRY_RUN ? 'MODO DRY-RUN (sin cambios)' : 'MODO EJECUCIÓN'}`);
  console.log('  ' + new Date().toISOString());
  console.log('═══════════════════════════════════════════════════\n');

  // ── Paso 1: Diagnóstico rápido ──
  const totalMedios = await p.medio.count();
  const mediosActivos = await p.medio.count({ where: { activo: true } });
  const totalFE = await p.fuenteEstado.count();
  const feActivas = await p.fuenteEstado.count({ where: { estado: 'activa' } });
  const totalJobs = await p.job.count();
  const totalNR = await p.notaRaw.count();
  const nrPendientes = await p.notaRaw.count({ where: { procesada: false, descartada: false } });
  const totalMenciones = await p.mencion.count();
  const totalReportes = await p.reporte.count();

  console.log('Estado actual:');
  console.log(`  Medios: ${totalMedios} (activos: ${mediosActivos})`);
  console.log(`  FuenteEstado: ${totalFE} (activas: ${feActivas})`);
  console.log(`  Jobs en cola: ${totalJobs}`);
  console.log(`  NotasRaw: ${totalNR} (pendientes: ${nrPendientes})`);
  console.log(`  Menciones: ${totalMenciones}`);
  console.log(`  Reportes: ${totalReportes}`);
  console.log('');

  // ── Paso 1.5: Si no hay medios, restaurar desde seed ──
  if (totalMedios === 0) {
    console.log('\n⚠️  TABLA MEDIO VACÍA — Restaurando desde data/medios.json...');
    const mediosPath = path.join(__dirname, '..', 'data', 'medios.json');
    if (!fs.existsSync(mediosPath)) {
      console.error('ERROR CRÍTICO: No se encuentra data/medios.json');
      console.error('Ejecutar primero: node scripts/restore-medios.js');
      await p.disconnect();
      process.exit(1);
    }
    const mediosSeed = JSON.parse(fs.readFileSync(mediosPath, 'utf-8'));
    console.log(`  Seed: ${mediosSeed.length} medios`);
    if (!DRY_RUN) {
      for (const medio of mediosSeed) {
        await p.medio.create({
          data: {
            nombre: medio.nombre,
            url: medio.url || '',
            tipo: medio.tipo || 'web',
            nivel: String(medio.nivel || '1'),
            departamento: medio.departamento || null,
            plataformas: medio.plataformas || '',
            notas: medio.notas || '',
          },
        });
      }
      console.log(`  ✓ ${mediosSeed.length} medios creados`);
    } else {
      console.log(`  [DRY-RUN] Se crearían ${mediosSeed.length} medios`);
    }
  }

  // Recontar tras posible seed
  const totalMediosFinal = await p.medio.count({ where: { activo: true } });

  // ── Paso 2: Crear FuenteEstado faltantes ──
  console.log('\n─ Paso 2: Crear FuenteEstado faltantes ─');
  const medios = await p.medio.findMany({
    where: { activo: true },
    select: { id: true, nombre: true, url: true, tipo: true, categoria: true, nivel: true }
  });

  const fuentesExistentes = await p.fuenteEstado.findMany({
    select: { medioId: true, estado: true, activo: true }
  });
  const mediosConFE = new Set(fuentesExistentes.map(f => f.medioId));

  let creados = 0;
  for (const medio of medios) {
    if (!mediosConFE.has(medio.id)) {
      if (!DRY_RUN) {
        await p.fuenteEstado.create({
          data: {
            id: 'fe_' + randomBytes(12).toString('hex'),
            medioId: medio.id,
            url: medio.url || '',
            tipoCheck: 'head',
            estado: 'activa',
            activo: true,
            frecuenciaBase: '6h',
            frecuenciaActual: '6h',
          }
        });
      }
      creados++;
      if (creados <= 10) console.log(`  + Creado: ${medio.nombre} (${medio.id})`);
    }
  }
  if (creados > 10) console.log(`  ... y ${creados - 10} más`);
  console.log(`  Total creados: ${creados}`);

  // ── Paso 3: Activar todas las fuentes ──
  console.log('\n─ Paso 3: Activar todas las fuentes ─');
  const fuentesInactivas = await p.fuenteEstado.findMany({
    where: {
      OR: [
        { estado: { not: 'activa' } },
        { activo: false },
        { activo: null },
        { estado: null },
      ]
    },
    select: { id: true, medioId: true, estado: true, activo: true }
  });

  let activadas = 0;
  for (const fe of fuentesInactivas) {
    if (!DRY_RUN) {
      await p.fuenteEstado.update({
        where: { id: fe.id },
        data: {
          estado: 'activa',
          activo: true,
          fallosConsecutivos: 0,
        }
      });
    }
    activadas++;
    if (activadas <= 10) {
      console.log(`  ✓ Activada: ${fe.id} (${fe.estado}→activa, activo=${fe.activo}→true)`);
    }
  }
  if (activadas > 10) console.log(`  ... y ${activadas - 10} más`);
  console.log(`  Total activadas: ${activadas}`);

  // ── Paso 4: Limpiar jobs atascados ──
  console.log('\n─ Paso 4: Limpiar jobs atascados ─');
  const hace1h = new Date(Date.now() - 60 * 60 * 1000);
  const jobsAtascados = await p.job.count({
    where: { estado: 'en_progreso', fechaInicio: { lt: hace1h } }
  });
  if (jobsAtascados > 0 && !DRY_RUN) {
    await p.job.updateMany({
      where: { estado: 'en_progreso', fechaInicio: { lt: hace1h } },
      data: { estado: 'pendiente', fechaInicio: null, proximaEjecucion: new Date() }
    });
    console.log(`  ✓ ${jobsAtascados} jobs en_progreso atascados → pendiente`);
  } else {
    console.log(`  Sin jobs atascados`);
  }

  // Limpiar jobs fallidos recientes que podrían bloquear
  const jobsFallidosRecientes = await p.job.count({
    where: { estado: 'fallido', fechaFin: { gt: hace1h } }
  });
  if (jobsFallidosRecientes > 0 && !DRY_RUN) {
    await p.job.updateMany({
      where: { estado: 'fallido', fechaFin: { gt: hace1h } },
      data: { estado: 'pendiente', proximaEjecucion: new Date(), intentos: 0, error: '' }
    });
    console.log(`  ✓ ${jobsFallidosRecientes} jobs fallidos recientes → pendiente (reintentar)`);
  }

  // ── Paso 5: Encolar check_fuente para TODAS las fuentes activas ──
  console.log('\n─ Paso 5: Encolar check_fuente para todas las fuentes ─');
  const fuentesActivas = await p.fuenteEstado.findMany({
    where: { estado: 'activa', activo: true },
    include: { Medio: { select: { nombre: true, categoria: true } } },
    orderBy: { id: 'asc' }
  });

  // Verificar cuántos check_fuente pendientes ya existen
  const checkPendientes = await p.job.count({ where: { tipo: 'check_fuente', estado: 'pendiente' } });
  console.log(`  Fuentes activas: ${fuentesActivas.length}`);
  console.log(`  Check_fuente ya pendientes: ${checkPendientes}`);

  let encolados = 0;
  // Procesar en lotes de 20 para no saturar la cola
  const LOTE = 20;
  for (let i = 0; i < fuentesActivas.length; i += LOTE) {
    const lote = fuentesActivas.slice(i, i + LOTE);
    for (const fuente of lote) {
      // Verificar si ya hay un check pendiente para esta fuente
      const yaExiste = await p.job.count({
        where: {
          tipo: 'check_fuente',
          estado: { in: ['pendiente', 'en_progreso'] },
          payload: { contains: fuente.id }
        }
      });
      if (yaExiste > 0) continue;

      // Determinar prioridad
      const prioridad = fuente.Medio.categoria === 'corporativo' && fuente.Medio.nivel === '1' ? 1 : 3;

      if (!DRY_RUN) {
        await p.job.create({
          data: {
            id: 'job_' + randomBytes(12).toString('hex'),
            tipo: 'check_fuente',
            prioridad: prioridad,
            payload: JSON.stringify({ fuenteId: fuente.id, medioId: fuente.medioId }),
            estado: 'pendiente',
            maxIntentos: 3,
            proximaEjecucion: new Date(),
            programa: 'fix-pipeline',
          }
        });
      }
      encolados++;
    }
    console.log(`  Lote ${Math.floor(i / LOTE) + 1}: ${Math.min(LOTE, fuentesActivas.length - i)} procesados`);
  }
  console.log(`  Total check_fuente encolados: ${encolados}`);

  // ── Paso 6: Encolar batch_llm si hay NotasRaw pendientes ──
  console.log('\n─ Paso 6: Encolar batch_llm ─');
  if (nrPendientes > 0) {
    const batchExistente = await p.job.count({
      where: { tipo: 'batch_llm', estado: { in: ['pendiente', 'en_progreso'] } }
    });
    if (batchExistente === 0) {
      if (!DRY_RUN) {
        await p.job.create({
          data: {
            id: 'job_' + randomBytes(12).toString('hex'),
            tipo: 'batch_llm',
            prioridad: 3,
            payload: JSON.stringify({}),
            estado: 'pendiente',
            maxIntentos: 3,
            proximaEjecucion: new Date(),
            programa: 'fix-pipeline',
          }
        });
      }
      console.log(`  ✓ batch_llm encolado (${nrPendientes} notas pendientes)`);
    } else {
      console.log(`  batch_llm ya en cola (${batchExistente} existentes)`);
    }
  } else {
    console.log(`  Sin NotasRaw pendientes — no se necesita batch_llm`);
  }

  // ── Paso 7: Verificar resultado final ──
  console.log('\n─ Resultado Final ─');
  const feActivasFinal = await p.fuenteEstado.count({ where: { estado: 'activa' } });
  const jobsPendientesFinal = await p.job.count({ where: { estado: 'pendiente' } });

  console.log(`  FuenteEstado activas: ${totalFE} → ${feActivasFinal}`);
  console.log(`  Jobs pendientes: ${totalJobs} → ${jobsPendientesFinal}`);

  console.log('\n═══════════════════════════════════════════════════');
  if (!DRY_RUN) {
    console.log('  PIPELINE REPARADO');
    console.log('  El worker debería empezar a procesar los check_fuente encolados.');
    console.log('  Monitorear con: pm2 logs decodex-worker');
    console.log('  Y scheduler con: pm2 logs decodex-scheduler');
    console.log('');
    console.log('  Para reiniciar el scheduler (que relea fuentes activas):');
    console.log('  pm2 restart decodex-scheduler');
  } else {
    console.log('  DRY-RUN completado. Ejecutar sin --dry-run para aplicar cambios.');
  }
  console.log('═══════════════════════════════════════════════════');

  await p.disconnect();
}

main().catch(err => {
  console.error('Error fatal:', err.message);
  process.exit(1);
});
