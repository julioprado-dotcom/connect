/**
 * CONSOLIDADOR DE AUDITORÍA EXTERNA DE FUENTES
 * Ejecuta todos los batches y genera un reporte unificado.
 *
 * Ejecutar:
 *   npx tsx scripts/consolidar-auditoria.ts
 */

import { join } from 'path';
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';

const PROJECT_ROOT = process.cwd();
const LOGS_DIR = join(PROJECT_ROOT, 'logs');
const FECHA = new Date().toISOString().slice(0, 10).replace(/-/g, '');

interface AuditResult {
  medioId: string;
  nombre: string;
  urlOriginal: string;
  urlFinal: string | null;
  httpStatus: number | null;
  httpOk: boolean;
  responseTimeMs: number | null;
  pageTitle: string | null;
  rssFound: string | null;
  protection: string;
  strategy: string;
  strategyDetail: string;
  urlSugerida: string | null;
  dbEstado: string;
  dbStrategyScrape: string;
  dbFallos: number;
  dbUltimoError: string;
  dbActivo: boolean;
  dbUltimoCheck: string | null;
  diagnostico: string;
  accionRecomendada: string;
  auditTimestamp: string;
  auditError: string | null;
}

interface AuditReport {
  fecha: string;
  timestamp: string;
  configuracion: Record<string, unknown>;
  resumen: {
    totalMedios: number;
    auditados: number;
    ok: number;
    error: number;
    sinUrl: number;
    conRSS: number;
    conProteccion: number;
    estrategiaCambiada: number;
    urlsActualizadas: number;
  };
  resultados: AuditResult[];
  correccionesSQL: string[];
}

function consolidate(): void {
  console.log('\n' + '='.repeat(70));
  console.log('  CONSOLIDADOR DE AUDITORÍA — DECODEX Bolivia');
  console.log('='.repeat(70) + '\n');

  if (!existsSync(LOGS_DIR)) {
    console.log('  ERROR: No existe el directorio logs/');
    return;
  }

  // Buscar todos los archivos de auditoría del día
  const files = readdirSync(LOGS_DIR)
    .filter(f => f.startsWith(`auditoria-fuentes-${FECHA}`) && f.endsWith('.json'))
    .sort();

  if (files.length === 0) {
    console.log('  ERROR: No se encontraron archivos de auditoría para hoy.');
    console.log(`  Buscados: logs/auditoria-fuentes-${FECHA}*.json`);
    return;
  }

  console.log(`  Encontrados ${files.length} archivos de auditoría:`);
  for (const f of files) {
    console.log(`    - ${f}`);
  }
  console.log('');

  // Leer y merge
  const allResults: AuditResult[] = [];
  const allSQL: string[] = [];
  const seenIds = new Set<string>();
  let totalMedios = 0;

  for (const file of files) {
    const filePath = join(LOGS_DIR, file);
    try {
      const data = JSON.parse(readFileSync(filePath, 'utf-8')) as AuditReport;
      totalMedios = data.resumen.totalMedios || data.resultados.length;
      for (const r of data.resultados) {
        if (!seenIds.has(r.medioId)) {
          seenIds.add(r.medioId);
          allResults.push(r);
        }
      }
      if (data.correccionesSQL) {
        allSQL.push(...data.correccionesSQL);
      }
    } catch (err) {
      console.log(`  WARN: No se pudo leer ${file}: ${err}`);
    }
  }

  // Ordenar por nombre
  allResults.sort((a, b) => a.nombre.localeCompare(b.nombre));

  // Calcular resumen consolidado
  const resumen = {
    totalMedios,
    auditados: allResults.length,
    ok: allResults.filter(r => r.httpOk).length,
    error: allResults.filter(r => !r.httpOk && r.diagnostico !== 'SIN_URL').length,
    sinUrl: allResults.filter(r => r.diagnostico === 'SIN_URL').length,
    conRSS: allResults.filter(r => r.rssFound).length,
    conProteccion: allResults.filter(r => r.protection !== 'NONE').length,
    estrategiaCambiada: 0,
    urlsActualizadas: 0,
  };

  // Construir reporte consolidado
  const consolidated: AuditReport = {
    fecha: new Date().toISOString().slice(0, 10),
    timestamp: new Date().toISOString(),
    configuracion: {
      modo: 'CONSOLIDADO',
      batches: files.length,
      fuentes: files.join(', '),
    },
    resumen,
    resultados: allResults,
    correccionesSQL: allSQL,
  };

  // Guardar
  const outputPath = join(LOGS_DIR, `auditoria-fuentes-${FECHA}-consolidado.json`);
  writeFileSync(outputPath, JSON.stringify(consolidated, null, 2), 'utf-8');

  // Imprimir resumen
  console.log('  REPORTE CONSOLIDADO');
  console.log('  ' + '-'.repeat(66));
  console.log(`  Total medios:      ${resumen.totalMedios}`);
  console.log(`  Auditados:         ${resumen.auditados}`);
  console.log(`  OK (responden):    ${resumen.ok}`);
  console.log(`  Error/Fallo:       ${resumen.error}`);
  console.log(`  Sin URL:           ${resumen.sinUrl}`);
  console.log(`  Con RSS:           ${resumen.conRSS}`);
  console.log(`  Con proteccion:    ${resumen.conProteccion}`);
  console.log('');

  // Clasificar por estrategia
  const byStrategy: Record<string, AuditResult[]> = {};
  for (const r of allResults) {
    const s = r.strategy || 'UNKNOWN';
    if (!byStrategy[s]) byStrategy[s] = [];
    byStrategy[s].push(r);
  }

  console.log('  DISTRIBUCIÓN POR ESTRATEGIA:');
  console.log('  ' + '-'.repeat(66));
  for (const [strategy, items] of Object.entries(byStrategy)) {
    console.log(`  ${strategy.padEnd(18)} ${items.length} medios`);
    for (const item of items) {
      const status = item.httpOk ? 'OK' : 'FAIL';
      const rss = item.rssFound ? ' [RSS]' : '';
      const prot = item.protection !== 'NONE' ? ' [PROT]' : '';
      console.log(`    ${status.padEnd(6)} ${item.nombre.substring(0, 35).padEnd(35)}${rss}${prot}`);
    }
    console.log('');
  }

  // RSS encontrados
  const rssItems = allResults.filter(r => r.rssFound);
  if (rssItems.length > 0) {
    console.log('  RSS FEEDS ENCONTRADOS:');
    console.log('  ' + '-'.repeat(66));
    for (const r of rssItems) {
      console.log(`  ${r.nombre.substring(0, 30).padEnd(30)} -> ${r.rssFound}`);
    }
    console.log('');
  }

  // Correcciones SQL únicas
  if (allSQL.length > 0) {
    const uniqueSQL = [...new Set(allSQL)];
    console.log(`  CORRECCIONES SQL (${uniqueSQL.length} sentencias):`);
    console.log('  ' + '-'.repeat(66));
    for (const sql of uniqueSQL) {
      console.log(`  ${sql}`);
    }
    console.log('');
  }

  console.log(`  Reporte consolidado: logs/auditoria-fuentes-${FECHA}-consolidado.json`);
  console.log('');
}

consolidate();
