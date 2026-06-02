#!/usr/bin/env node
/**
 * restore-medios.js — Restaurar tabla Medio desde seed data
 * Ejecutar en VPS: node scripts/restore-medios.js [--force]
 *
 * Lee data/medios.json y crea registros Medio si no existen.
 * Con --force, borra medios existentes y recrea todos.
 */
const { PrismaClient } = require('./node_modules/.prisma/client');
const fs = require('fs');
const path = require('path');
const { randomBytes } = require('crypto');
const p = new PrismaClient();

const FORCE = process.argv.includes('--force');
const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  DECODEX — RESTAURAR MEDIOS');
  console.log(`  ${DRY_RUN ? 'DRY-RUN' : 'EJECUCIÓN'} | ${FORCE ? 'FORCE MODE' : 'SAFE MODE'}`);
  console.log('═══════════════════════════════════════════════════\n');

  // Verificar estado actual
  const totalMedios = await p.medio.count();
  const totalFE = await p.fuenteEstado.count();
  console.log(`Medios actuales: ${totalMedios}`);
  console.log(`FuenteEstado actuales: ${totalFE}`);

  // Leer seed data
  const mediosPath = path.join(__dirname, '..', 'data', 'medios.json');
  if (!fs.existsSync(mediosPath)) {
    console.error(`ERROR: No se encuentra ${mediosPath}`);
    process.exit(1);
  }
  const mediosSeed = JSON.parse(fs.readFileSync(mediosPath, 'utf-8'));
  console.log(`Seed data: ${mediosSeed.length} medios en data/medios.json\n`);

  // Si hay medios y no es FORCE, crear solo los faltantes
  let creados = 0;
  let saltados = 0;

  if (totalMedios > 0 && !FORCE) {
    console.log('Modo SAFE: Solo creando medios que no existen...');
    const existentes = await p.medio.findMany({ select: { nombre: true, url: true } });
    const existentesSet = new Set(existentes.map(m => m.nombre.toLowerCase()));

    for (const medio of mediosSeed) {
      if (existentesSet.has(medio.nombre.toLowerCase())) {
        saltados++;
        continue;
      }

      if (!DRY_RUN) {
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
      creados++;
      console.log(`  + ${medio.nombre} (${medio.nivel || '1'}) — ${medio.url || 'sin URL'}`);
    }
  } else {
    // FORCE o tabla vacía: crear todos
    if (FORCE && totalMedios > 0 && !DRY_RUN) {
      // Borrar FuenteEstado primero (FK constraint)
      console.log(`Borrando ${totalFE} FuenteEstado...`);
      await p.fuenteEstado.deleteMany();
      console.log(`Borrando ${totalMedios} Medios...`);
      await p.medio.deleteMany();
    }

    console.log(`Creando ${mediosSeed.length} medios...`);
    for (const medio of mediosSeed) {
      if (!DRY_RUN) {
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
      creados++;
      console.log(`  + ${medio.nombre} (Nivel ${medio.nivel || '1'}) — ${medio.url || 'sin URL'}`);
    }
  }

  // Verificar resultado
  const totalFinal = await p.medio.count();
  console.log(`\n══ RESULTADO ══`);
  console.log(`  Medios: ${totalMedios} → ${totalFinal}`);
  console.log(`  Creados: ${creados} | Saltados: ${saltados}`);

  if (totalFinal > 0) {
    console.log(`\n  ✓ Medios disponibles. Ahora ejecutar:`);
    console.log(`    node scripts/fix-pipeline.js`);
    console.log(`    pm2 restart decodex-scheduler decodex-worker`);
  }

  await p.disconnect();
}

main().catch(err => {
  console.error('Error fatal:', err.message);
  process.exit(1);
});
