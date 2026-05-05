/**
 * @file ejemplo-indicadores.ts
 * @description Ejemplo de uso del Módulo A3 - Indicadores Reales de Bolivia.
 *
 * Demuestra las principales funcionalidades:
 * 1. Fetch individual de indicadores
 * 2. Fetch por categoría
 * 3. Fetch de todos los indicadores
 * 4. Manejo de fallback y errores
 * 5. Uso en contexto de boletín
 *
 * Para ejecutar: npx ts-node src/lib/services/ejemplo-indicadores.ts
 */

import {
  fetchIndicadores,
  getAvailableSlugs,
  getIndicador,
  getAllIndicadores,
  getServiceStatus,
  fetchIndicadoresPorCategoria,
  getCategorias,
  clearCache,
  configureService,
  getCacheStats,
} from './indicadores';

import type { IndicadorReal, SlugIndicador } from './indicadores.types';

// ─── Utilidades de display ─────────────────────────────────────────────────

/** Imprime un separador visual */
function separator(title: string): void {
  console.log('\n' + '═'.repeat(60));
  console.log(`  ${title}`);
  console.log('═'.repeat(60));
}

/** Formatea un indicador para display */
function formatIndicador(ind: IndicadorReal): string {
  const confianza = ind.confiable ? '✅' : '⚠️';
  const variacion = ind.variacion !== undefined
    ? `${ind.variacion >= 0 ? '+' : ''}${ind.variacion}%`
    : 'N/D';
  return [
    `${confianza} ${ind.nombre}`,
    `   Valor: ${ind.valor} ${ind.unidad}`,
    `   Fecha: ${ind.fecha}`,
    `   Fuente: ${ind.fuente}`,
    `   Variación: ${variacion}`,
    `   Categoría: ${ind.categoria}`,
  ].join('\n');
}

// ─── Ejemplo 1: Estado del servicio ────────────────────────────────────────

async function ejemploEstadoServicio(): Promise<void> {
  separator('1. Estado del Servicio');

  const status = getServiceStatus();
  console.log(`Configurado: ${status.configured ? 'Sí' : 'No'}`);
  console.log(`Total fuentes: ${status.sources.length}`);
  console.log(`Fuentes activas: ${status.sources.filter((s) => s.activa).length}`);

  console.log('\nFuentes activas:');
  for (const source of status.sources) {
    if (source.activa) {
      console.log(`  • ${source.nombre}`);
    }
  }
}

// ─── Ejemplo 2: Slugs disponibles ──────────────────────────────────────────

function ejemploSlugs(): void {
  separator('2. Indicadores Disponibles');

  const slugs = getAvailableSlugs();
  console.log(`Total indicadores: ${slugs.length}\n`);

  const categorias = getCategorias();
  for (const cat of categorias) {
    console.log(`📁 ${cat.nombre}: ${cat.descripcion}`);
    console.log(`   Indicadores: ${cat.indicadores.join(', ')}\n`);
  }
}

// ─── Ejemplo 3: Fetch individual ───────────────────────────────────────────

async function ejemploFetchIndividual(): Promise<void> {
  separator('3. Fetch Individual');

  const indicadores: SlugIndicador[] = ['lme-cobre', 'tc-oficial-bcb'];

  for (const slug of indicadores) {
    console.log(`\nObteniendo: ${slug}...`);
    const indicador = await getIndicador(slug);

    if (indicador) {
      console.log(formatIndicador(indicador));
    } else {
      console.log('  ❌ No se pudo obtener el indicador');
    }
  }
}

// ─── Ejemplo 4: Fetch por categoría ────────────────────────────────────────

async function ejemploFetchCategoria(): Promise<void> {
  separator('4. Fetch por Categoría: Minerales');

  const result = await fetchIndicadoresPorCategoria('minerales');

  console.log(`\nIndicadores obtenidos: ${result.indicadores.length}`);
  console.log(`Errores: ${result.errores.length}`);
  console.log(`Fuentes usadas: ${result.fuentesUsadas.join(', ')}`);

  for (const ind of result.indicadores) {
    console.log(`\n${formatIndicador(ind)}`);
  }

  if (result.errores.length > 0) {
    console.log('\n⚠️ Errores:');
    for (const err of result.errores) {
      console.log(`  • [${err.slug}] ${err.fuente}: ${err.mensaje}`);
    }
  }
}

// ─── Ejemplo 5: Fetch todos los indicadores ────────────────────────────────

async function ejemploFetchTodos(): Promise<void> {
  separator('5. Fetch Todos los Indicadores');

  const result = await getAllIndicadores();

  console.log(`\nTimestamp: ${result.timestamp}`);
  console.log(`Total: ${result.indicadores.length} indicadores`);

  const confiables = result.indicadores.filter((i) => i.confiable);
  const noConfiables = result.indicadores.filter((i) => !i.confiable);

  console.log(`✅ Confiables: ${confiables.length}`);
  console.log(`⚠️  No confiables: ${noConfiables.length}`);

  if (noConfiables.length > 0) {
    console.log('\n  Indicadores no confiables (usando fallback):');
    for (const ind of noConfiables) {
      console.log(`    • ${ind.nombre}: ${ind.valor} ${ind.unidad} (${ind.fuente})`);
    }
  }
}

// ─── Ejemplo 6: Manejo de fallback ─────────────────────────────────────────

async function ejemploFallback(): Promise<void> {
  separator('6. Sistema de Fallback');

  // Limpiar cache para forzar fetch
  clearCache();

  // Configurar timeout muy corto para demostrar fallback
  configureService({ defaultTimeout: 100 }); // 100ms

  console.log('\nTimeout configurado a 100ms para demostrar fallback...\n');

  const result = await fetchIndicadores(['lme-cobre', 'tc-oficial-bcb', 'ipc']);

  console.log('Resultados:');
  for (const ind of result.indicadores) {
    const icono = ind.confiable ? '✅' : '⚠️';
    console.log(
      `  ${icono} ${ind.nombre}: ${ind.valor} ${ind.unidad} [${ind.fuente}]`,
    );
  }

  if (result.errores.length > 0) {
    console.log(`\nErrores capturados: ${result.errores.length}`);
    for (const err of result.errores) {
      console.log(`  • [${err.fuente}] ${err.mensaje} (recuperable: ${err.recuperable})`);
    }
  }

  // Restaurar configuración
  configureService({ defaultTimeout: 10_000 });
}

// ─── Ejemplo 7: Uso en boletín ─────────────────────────────────────────────

async function ejemploBoletin(): Promise<void> {
  separator('7. Integración con Boletín DECODEX');

  const result = await fetchIndicadores([
    'lme-cobre',
    'lme-zinc',
    'lme-estano',
    'tc-oficial-bcb',
    'reservas-internacionales',
  ]);

  console.log('\n📋 SECCIÓN: INDICADORES ECONÓMICOS\n');

  for (const ind of result.indicadores) {
    const confianza = ind.confiable ? '' : ' *';
    const variacion = ind.variacion !== undefined
      ? ` (var: ${ind.variacion >= 0 ? '+' : ''}${ind.variacion}%)`
      : '';
    console.log(
      `  • ${ind.nombre}: ${ind.valor.toLocaleString()} ${ind.unidad}${variacion}${confianza}`,
    );
  }

  if (result.errores.length > 0) {
    console.log(
      '\n* Algunos indicadores usan valores estimados. Verificar fuentes.',
    );
  }

  console.log(`\n  Fuentes: ${result.fuentesUsadas.join(', ')}`);
  console.log(`  Fecha de referencia: ${result.timestamp}`);
}

// ─── Ejemplo 8: Estadísticas de cache ──────────────────────────────────────

async function ejemploCache(): Promise<void> {
  separator('8. Estadísticas de Cache');

  clearCache();
  await getAllIndicadores();

  const stats = getCacheStats();
  console.log(`\nEntradas en cache: ${stats.size}`);
  console.log(`TTL: 1 hora (3,600,000 ms)`);

  for (const entry of stats.entries) {
    const edadSeg = Math.round(entry.age / 1000);
    const estado = entry.expired ? '❌ EXPIRADA' : '✅ VIGENTE';
    console.log(`  • ${entry.slug}: ${edadSeg}s antigüedad - ${estado}`);
  }
}

// ─── Ejecución principal ───────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║     MÓDULO A3 - INDICADORES REALES - DECODEX Bolivia   ║');
  console.log('║     Ejemplo de uso del servicio                        ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  try {
    await ejemploEstadoServicio();
    ejemploSlugs();
    await ejemploFetchIndividual();
    await ejemploFetchCategoria();
    await ejemploFetchTodos();
    await ejemploFallback();
    await ejemploBoletin();
    await ejemploCache();

    separator('EJECUCIÓN COMPLETADA');
    console.log('\n✅ Todos los ejemplos ejecutados exitosamente.\n');
  } catch (error) {
    console.error('\n❌ Error durante la ejecución:', error);
    process.exit(1);
  }
}

main();
