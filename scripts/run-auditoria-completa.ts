/**
 * RUNNER COMPLETO DE AUDITORÍA
 * Ejecuta todos los batches secuencialmente y consolida.
 *
 * Ejecutar:
 *   npx tsx scripts/run-auditoria-completa.ts
 */

import { execSync } from 'child_process';
import { join } from 'path';

const PROJECT_ROOT = process.cwd();
const BATCH_SIZE = 9;
const DELAY = 5000;
const TOTAL_MEDIOS = 54;

console.log('\n' + '='.repeat(70));
console.log('  AUDITORÍA COMPLETA DE FUENTES — DECODEX Bolivia');
console.log(`  ${TOTAL_MEDIOS} medios en batches de ${BATCH_SIZE}, delay ${DELAY}ms`);
console.log('='.repeat(70) + '\n');

const batches = Math.ceil(TOTAL_MEDIOS / BATCH_SIZE);
console.log(`  Ejecutando ${batches} batches...\n`);

for (let i = 0; i < batches; i++) {
  const offset = i * BATCH_SIZE;
  const limit = Math.min(BATCH_SIZE, TOTAL_MEDIOS - offset);
  const batchNum = i + 1;

  console.log(`\n  ══ BATCH ${batchNum}/${batches} (offset=${offset}, limit=${limit}) ══\n`);

  try {
    execSync(
      `npx tsx scripts/audit-fuentes-zai.ts --delay ${DELAY} --offset ${offset} --limit ${limit} --batch ${batchNum}`,
      {
        cwd: PROJECT_ROOT,
        stdio: 'inherit',
        timeout: 600000,
      }
    );
  } catch (err) {
    console.error(`  ERROR en batch ${batchNum}:`, err);
  }
}

console.log('\n\n  ══ CONSOLIDANDO RESULTADOS ══\n');

try {
  execSync(`npx tsx scripts/consolidar-auditoria.ts`, {
    cwd: PROJECT_ROOT,
    stdio: 'inherit',
    timeout: 30000,
  });
} catch (err) {
  console.error('  ERROR consolidando:', err);
}

console.log('\n  Auditoría completa finalizada.\n');
