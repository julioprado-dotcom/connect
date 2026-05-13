// PASO 4: Reclasificar todas las menciones existentes
// PASO 5: Verificar con 5 casos de prueba
import { clasificarV2, reclasificarLote, type ClasificacionV2 } from '../src/lib/clasificador-v2';

// ═══ PASO 4: Batch reclassification ═══
async function paso4() {
  console.log('=== PASO 4: Reclasificación de menciones ===');
  
  let offset = 0;
  const BATCH = 100;
  let totalProcesadas = 0;
  let totalReclasificadas = 0;

  while (true) {
    const result = await reclasificarLote(offset, BATCH);
    totalProcesadas += result.procesadas;
    totalReclasificadas += result.reclasificadas;
    
    if (result.procesadas === 0) break;
    
    console.log(`  Lote ${Math.floor(offset / BATCH) + 1}: ${result.procesadas} procesadas, ${result.reclasificadas} reclasificadas`);
    
    offset += BATCH;
    
    if (result.procesadas < BATCH) break;
    
    // Pause 10s between batches
    console.log('  ...pausa 10s...');
    await new Promise(r => setTimeout(r, 10000));
  }

  console.log(`\n  TOTAL: ${totalProcesadas} procesadas, ${totalReclasificadas} reclasificadas`);
  return { totalProcesadas, totalReclasificadas };
}

// ═══ PASO 5: Test cases ═══
async function paso5() {
  console.log('\n=== PASO 5: Casos de prueba ===');

  const tests: Array<{ input: string; esperadoEje: string; esperadoLentes: string[]; noEsperadoEje?: string }> = [
    {
      input: 'Transportistas realizan bloqueo de carreteras por gasolina basura',
      esperadoEje: 'recursos-naturales',
      esperadoLentes: ['movilizacion-social', 'hidrocarburos'],
      noEsperadoEje: 'movilizacion-social',
    },
    {
      input: 'Organizaciones sociales rechazan la Ley 1720 y bloquean rutas en el Chapare',
      esperadoEje: 'gobierno-instituciones', // Ley = tema institucional
      esperadoLentes: ['movilizacion-social'],
    },
    {
      input: 'CAO paraliza actividades económicas en Santa Cruz por politica cambiaria',
      esperadoEje: 'v2-economia',
      esperadoLentes: ['movilizacion-social'],
      noEsperadoEje: 'movilizacion-social',
    },
    {
      input: 'Incendios forestales devoran 100,000 hectáreas en Santa Cruz cerca de áreas protegidas',
      esperadoEje: 'recursos-naturales',
      esperadoLentes: ['medio-ambiente'],
    },
    {
      input: 'Gobierno anuncia tipificación penal de bloqueos de carreteras y protestas',
      esperadoEje: 'movilizacion-social',
      esperadoLentes: [],
    },
  ];

  let passed = 0;
  let failed = 0;

  for (const t of tests) {
    const result: ClasificacionV2 = await clasificarV2(t.input, '');
    const ejeOk = result.ejePrincipalSlug === t.esperadoEje;
    const noEjeOk = !t.noEsperadoEje || result.ejePrincipalSlug !== t.noEsperadoEje;
    const lentesOk = t.esperadoLentes.every(l => result.lenteSlugs.includes(l));
    
    const status = (ejeOk && noEjeOk && lentesOk) ? 'PASS' : 'FAIL';
    if (status === 'PASS') passed++; else failed++;

    console.log(`\n  ${status}: "${t.input.substring(0, 60)}..."`);
    console.log(`    Eje: ${result.ejePrincipalSlug} (esperado: ${t.esperadoEje}) ${ejeOk ? '✓' : '✗'}`);
    if (t.noEsperadoEje) {
      console.log(`    No-eje: ${result.ejePrincipalSlug} !== ${t.noEsperadoEje} ${noEjeOk ? '✓' : '✗'}`);
    }
    console.log(`    Lentes: [${result.lenteSlugs.join(', ')}] (esperado: [${t.esperadoLentes.join(', ')}]) ${lentesOk ? '✓' : '✗'}`);
    if (result.motivoMovilizacion) {
      console.log(`    Motivo movilización: ${result.motivoMovilizacion}`);
    }
  }

  console.log(`\n  RESULTADO: ${passed}/${tests.length} pasaron, ${failed} fallaron`);
  return { passed, failed, total: tests.length };
}

// ═══ Main ═══
async function main() {
  try {
    const p4 = await paso4();
    const p5 = await paso5();
    
    // Summary
    console.log('\n=== RESUMEN ===');
    console.log(`  Menciones reclasificadas: ${p4.totalReclasificadas}/${p4.totalProcesadas}`);
    console.log(`  Tests pasados: ${p5.passed}/${p5.total}`);
    
    process.exit(0);
  } catch (err) {
    console.error('ERROR:', err);
    process.exit(1);
  }
}

main();
