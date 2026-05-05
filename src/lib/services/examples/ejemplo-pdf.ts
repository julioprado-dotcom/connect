/**
 * @module ejemplo-pdf
 * @description Ejemplo de uso del Módulo A4 - Generador de Informes PDF.
 * Demuestra la generación de los tres tipos de informe con datos de ejemplo
 * y opciones de personalización.
 *
 * Para ejecutar:
 * ```bash
 * npx ts-node --esm src/lib/services/ejemplo-pdf.ts
 * ```
 *
 * O compilar y ejecutar:
 * ```bash
 * npx tsc src/lib/services/ejemplo-pdf.ts --outDir dist --esModuleInterop
 * node dist/ejemplo-pdf.js
 * ```
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  generarInformeSemanal,
  generarFichaPersona,
  generarInformeAdHoc,
  generarHTMLInforme,
  generarInformePDF,
} from './pdf-generator.js';
import type {
  InformeSemanalData,
  FichaPersonaData,
  InformeAdHocData,
} from './pdf-generator.types.js';

// ─── Directorio de salida ─────────────────────────────────────────────

const OUTPUT_DIR = path.join(process.cwd(), 'output');
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// ─── Datos de ejemplo ─────────────────────────────────────────────────

const informeSemanalEjemplo: InformeSemanalData = {
  periodo: { desde: '2024-06-10', hasta: '2024-06-16' },
  resumenEjecutivo:
    'Durante la semana del 10 al 16 de junio de 2024 se registraron un total de 47 menciones ' +
    'en medios nacionales relacionados con las figuras monitoreadas. El sentimiento general fue ' +
    'predominantemente neutro (55%), seguido de positivo (30%) y negativo (15%). Los ejes temáticos ' +
    'más relevantes fueron economía (35%), política (25%) y relaciones internacionales (20%).',
  menciones: [
    {
      persona: 'Juan Pérez',
      medio: 'El Deber',
      fecha: '2024-06-10',
      titular: 'Ministro anuncia nuevo paquete de medidas económicas',
      sentimiento: 'positivo',
      ejeTematico: 'Economía',
      url: 'https://eldeber.com.bo/economia/1234',
      excerpt: 'El ministro de Economía anunció un conjunto de medidas orientadas a reactivar...',
    },
    {
      persona: 'María García',
      medio: 'Página Siete',
      fecha: '2024-06-11',
      titular: 'Senadora cuestiona gestión ambiental del gobierno',
      sentimiento: 'negativo',
      ejeTematico: 'Medio Ambiente',
      url: 'https://paginasiete.bo/politica/5678',
    },
    {
      persona: 'Carlos Méndez',
      medio: 'Los Tiempos',
      fecha: '2024-06-12',
      titular: 'Canciller sostiene reunión con homólogos del bloque regional',
      sentimiento: 'neutro',
      ejeTematico: 'Relaciones Internacionales',
    },
    {
      persona: 'Ana Rodríguez',
      medio: 'Opinión Bolivia',
      fecha: '2024-06-13',
      titular: 'La ministra de Salud presenta balance de gestión',
      sentimiento: 'positivo',
      ejeTematico: 'Salud',
      excerpt: 'En conferencia de prensa, la ministra destacó los avances en cobertura...',
    },
    {
      persona: 'Juan Pérez',
      medio: 'El Deber',
      fecha: '2024-06-14',
      titular: 'Sector empresarial respalda medidas tributarias',
      sentimiento: 'positivo',
      ejeTematico: 'Economía',
    },
  ],
  estadisticas: {
    totalMenciones: 47,
    porSentimiento: { positivo: 14, negativo: 7, neutro: 26 },
    porMedio: {
      'El Deber': 15,
      'Página Siete': 12,
      'Los Tiempos': 10,
      'Opinión Bolivia': 6,
      'La Razón': 4,
    },
    porEje: {
      Economía: 17,
      Política: 12,
      'Relaciones Internacionales': 9,
      'Medio Ambiente': 5,
      Salud: 4,
    },
  },
  rankingPersonas: [
    { nombre: 'Juan Pérez', menciones: 15, tendencia: 'sube' },
    { nombre: 'María García', menciones: 12, tendencia: 'baja' },
    { nombre: 'Carlos Méndez', menciones: 9, tendencia: 'estable' },
    { nombre: 'Ana Rodríguez', menciones: 7, tendencia: 'sube' },
    { nombre: 'Roberto Lima', menciones: 4, tendencia: 'baja' },
  ],
};

const fichaPersonaEjemplo: FichaPersonaData = {
  persona: {
    nombre: 'Juan Pérez',
    cargo: 'Ministro de Economía y Finanzas Públicas',
    institucion: 'Estado Plurinacional de Bolivia',
  },
  periodo: { desde: '2024-01-01', hasta: '2024-06-16' },
  menciones: [
    {
      persona: 'Juan Pérez',
      medio: 'El Deber',
      fecha: '2024-06-10',
      titular: 'Ministro anuncia nuevo paquete de medidas económicas',
      sentimiento: 'positivo',
      ejeTematico: 'Economía',
      url: 'https://eldeber.com.bo/economia/1234',
      excerpt: 'El ministro anunció un conjunto de medidas orientadas a...',
    },
    {
      persona: 'Juan Pérez',
      medio: 'Página Siete',
      fecha: '2024-06-08',
      titular: 'Criticas a la política cambiaria del gobierno',
      sentimiento: 'negativo',
      ejeTematico: 'Economía',
    },
    {
      persona: 'Juan Pérez',
      medio: 'Los Tiempos',
      fecha: '2024-06-05',
      titular: 'Entrevista exclusiva: visión económica 2024-2025',
      sentimiento: 'positivo',
      ejeTematico: 'Economía',
      url: 'https://lostiempos.com/entrevista/9999',
      excerpt: 'En entrevista con Los Tiempos, el ministro compartió...',
    },
  ],
  estadisticas: {
    totalMenciones: 142,
    porSentimiento: { positivo: 78, negativo: 32, neutro: 32 },
    porMedio: {
      'El Deber': 45,
      'Página Siete': 35,
      'Los Tiempos': 28,
      'Opinión Bolivia': 18,
      'La Razón': 16,
    },
    evolucionMensual: [
      { mes: '2024-01', cantidad: 18 },
      { mes: '2024-02', cantidad: 22 },
      { mes: '2024-03', cantidad: 25 },
      { mes: '2024-04', cantidad: 30 },
      { mes: '2024-05', cantidad: 27 },
      { mes: '2024-06', cantidad: 20 },
    ],
  },
  ranking: { posicion: 2, total: 50 },
  observaciones:
    'Juan Pérez se mantiene como la segunda figura más mencionada en medios nacionales. ' +
    'Su visibilidad se concentra fuertemente en el eje económico. La tendencia positiva ' +
    'en el primer semestre de 2024 se debe principalmente a las medidas de reactivación ' +
    'económica. Se recomienda monitorear la evolución de la percepción pública respecto ' +
    'a la política cambiaria.',
};

const informeAdHocEjemplo: InformeAdHocData = {
  filtros: {
    personas: ['Juan Pérez', 'María García'],
    medios: ['El Deber', 'Página Siete'],
    ejes: ['Economía', 'Política'],
    sentimientos: ['positivo', 'negativo'],
    fechaDesde: '2024-06-01',
    fechaHasta: '2024-06-16',
  },
  titulo: 'Análisis Comparativo de Presencia en Medios: Economía y Política',
  menciones: [
    {
      persona: 'Juan Pérez',
      medio: 'El Deber',
      fecha: '2024-06-10',
      titular: 'Ministro anuncia nuevo paquete de medidas económicas',
      sentimiento: 'positivo',
      ejeTematico: 'Economía',
    },
    {
      persona: 'María García',
      medio: 'Página Siete',
      fecha: '2024-06-11',
      titular: 'Senadora cuestiona gestión ambiental del gobierno',
      sentimiento: 'negativo',
      ejeTematico: 'Política',
    },
  ],
  estadisticas: {
    totalMenciones: 2,
    porSentimiento: { positivo: 1, negativo: 1, neutro: 0 },
    porMedio: { 'El Deber': 1, 'Página Siete': 1 },
  },
  resumen:
    'El análisis comparativo revela que Juan Pérez mantiene una presencia positiva en el ámbito ' +
    'económico mientras que María García genera cobertura negativa en el ámbito político. ' +
    'Ambas figuras tienen visibilidad equilibrada en los dos principales medios impresos del país.',
};

// ─── Funciones de demostración ─────────────────────────────────────────

/**
 * Demo 1: Generar informe semanal con opciones por defecto.
 */
async function demoInformeSemanal(): Promise<void> {
  console.log('\n📄 Demo 1: Informe Semanal (opciones por defecto)');
  console.log('─'.repeat(50));

  const resultado = await generarInformeSemanal(informeSemanalEjemplo);

  if (resultado.success) {
    console.log(`✅ Generado exitosamente`);
    console.log(`   Filename: ${resultado.filename}`);
    console.log(`   Pages: ${resultado.pages}`);
    console.log(`   Size: ${resultado.size} bytes`);
    console.log(`   Timestamp: ${resultado.timestamp}`);

    // Guardar HTML para inspección visual
    const htmlPath = path.join(OUTPUT_DIR, 'demo-semanal.html');
    const html = generarHTMLInforme(informeSemanalEjemplo, 'semanal');
    fs.writeFileSync(htmlPath, html, 'utf-8');
    console.log(`   HTML guardado: ${htmlPath}`);
  } else {
    console.log(`❌ Error: ${resultado.error}`);
  }
}

/**
 * Demo 2: Generar ficha de persona con logo y color personalizado.
 */
async function demoFichaPersona(): Promise<void> {
  console.log('\n👤 Demo 2: Ficha de Persona (personalizada)');
  console.log('─'.repeat(50));

  const resultado = await generarFichaPersona(fichaPersonaEjemplo, {
    colorPrimario: '#1a5276',
    marcaAgua: true,
    logoUrl: 'https://ejemplo.com/logo-decodex.png',
  });

  if (resultado.success) {
    console.log(`✅ Generado exitosamente`);
    console.log(`   Filename: ${resultado.filename}`);
    console.log(`   Pages: ${resultado.pages}`);

    const htmlPath = path.join(OUTPUT_DIR, 'demo-ficha-persona.html');
    const html = generarHTMLInforme(fichaPersonaEjemplo, 'ficha_persona', {
      colorPrimario: '#1a5276',
      logoUrl: 'https://ejemplo.com/logo-decodex.png',
    });
    fs.writeFileSync(htmlPath, html, 'utf-8');
    console.log(`   HTML guardado: ${htmlPath}`);
  } else {
    console.log(`❌ Error: ${resultado.error}`);
  }
}

/**
 * Demo 3: Generar informe ad-hoc con filtros y orientación landscape.
 */
async function demoInformeAdHoc(): Promise<void> {
  console.log('\n🔍 Demo 3: Informe Ad-Hoc (landscape, sin marca de agua)');
  console.log('─'.repeat(50));

  const resultado = await generarInformeAdHoc(informeAdHocEjemplo, {
    orientacion: 'landscape',
    marcaAgua: false,
  });

  if (resultado.success) {
    console.log(`✅ Generado exitosamente`);
    console.log(`   Filename: ${resultado.filename}`);
    console.log(`   Pages: ${resultado.pages}`);
    console.log(`   Orientación: landscape`);

    const htmlPath = path.join(OUTPUT_DIR, 'demo-adhoc.html');
    const html = generarHTMLInforme(informeAdHocEjemplo, 'ad_hoc', {
      orientacion: 'landscape',
      marcaAgua: false,
    });
    fs.writeFileSync(htmlPath, html, 'utf-8');
    console.log(`   HTML guardado: ${htmlPath}`);
  } else {
    console.log(`❌ Error: ${resultado.error}`);
  }
}

/**
 * Demo 4: Generar usando la función unificada.
 */
async function demoFuncionUnificada(): Promise<void> {
  console.log('\n🔄 Demo 4: Función unificada generarInformePDF()');
  console.log('─'.repeat(50));

  const tipos = ['semanal', 'ficha_persona', 'ad_hoc'] as const;
  const datos = [informeSemanalEjemplo, fichaPersonaEjemplo, informeAdHocEjemplo];

  for (let i = 0; i < tipos.length; i++) {
    const resultado = await generarInformePDF(datos[i], tipos[i]);
    const status = resultado.success ? '✅' : '❌';
    console.log(`   ${status} ${tipos[i]}: ${resultado.filename} (${resultado.pages} páginas)`);
  }
}

// ─── Ejecución Principal ──────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  DECODEX Bolivia - Módulo A4: Generador de Informes PDF');
  console.log('  Ejemplos de uso');
  console.log('═══════════════════════════════════════════════════════════');

  await demoInformeSemanal();
  await demoFichaPersona();
  await demoInformeAdHoc();
  await demoFuncionUnificada();

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  Todos los ejemplos ejecutados correctamente.');
  console.log(`  Archivos HTML generados en: ${OUTPUT_DIR}/`);
  console.log('  (Para PDF real, instale Puppeteer: npm i puppeteer)');
  console.log('═══════════════════════════════════════════════════════════');
}

main().catch((error) => {
  console.error('Error ejecutando ejemplos:', error);
  process.exit(1);
});
