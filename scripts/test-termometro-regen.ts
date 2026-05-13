/**
 * Script de prueba: Regenerar El Termometro con las nuevas restricciones anti-alucinacion.
 * Bypasses HTTP layer — ejecuta la logica directamente.
 */
import { PrismaClient } from '@prisma/client';
import { join } from 'path';

// Forzar la DB correcta
process.env.DATABASE_URL = `file:${join(process.cwd(), 'prisma', 'db', 'custom.db')}`;

const db = new PrismaClient();

async function main() {
  console.log('=== REGENERACION DE EL TERMOMETRO ===\n');

  // 1. Verificar DB
  const totalMenciones = await db.mencion.count();
  console.log(`DB: ${totalMenciones} menciones en prisma/db/custom.db`);

  if (totalMenciones === 0) {
    console.error('ERROR: DB vacia. Abortando.');
    process.exit(1);
  }

  // 2. Obtener menciones de los ultimos 7 dias
  const sieteDiasAtras = new Date();
  sieteDiasAtras.setDate(sieteDiasAtras.getDate() - 7);

  const menciones = await db.mencion.findMany({
    where: {
      fechaCaptura: { gte: sieteDiasAtras },
      esDuplicado: false,
    },
    include: {
      Persona: { select: { nombre: true, partidoSigla: true } },
      Medio: { select: { nombre: true, tipo: true } },
      MencionTema: {
        select: { EjeTematico: { select: { nombre: true, slug: true } } },
      },
    },
    orderBy: { fechaCaptura: 'desc' },
    take: 50,
  });

  console.log(`Menciones encontradas (ultimos 7 dias): ${menciones.length}`);

  // 3. Mostrar resumen de menciones
  console.log('\n--- RESUMEN DE MENCIONES ---');
  const medios = new Map<string, number>();
  const temas = new Map<string, number>();
  const personas = new Map<string, number>();

  for (const m of menciones) {
    const medioNombre = m.Medio?.nombre ?? 'Desconocido';
    medios.set(medioNombre, (medios.get(medioNombre) ?? 0) + 1);
    for (const et of m.MencionTema) {
      temas.set(et.EjeTematico.nombre, (temas.get(et.EjeTematico.nombre) ?? 0) + 1);
    }
    if (m.Persona?.nombre) {
      personas.set(m.Persona.nombre, (personas.get(m.Persona.nombre) ?? 0) + 1);
    }
  }

  console.log('\nMedios:');
  for (const [medio, count] of [...medios.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
    console.log(`  ${medio}: ${count}`);
  }

  console.log('\nTemas:');
  for (const [tema, count] of [...temas.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
    console.log(`  ${tema}: ${count}`);
  }

  console.log('\nPersonas mencionadas:');
  for (const [persona, count] of [...personas.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
    console.log(`  ${persona}: ${count}`);
  }

  // 4. Buscar menciones de eventos clave
  console.log('\n--- EVENTOS CLAVE BUSCADOS ---');
  const eventosClave = [
    'marcha indigena', 'ley 1720', 'COB', 'Ponchos Rojos',
    'magisterio', 'bloqueo', 'protesta', 'Arce', 'Morales',
    'Choquehuanca', 'Camacho', 'Santa Cruz',
  ];

  for (const evento of eventosClave) {
    const encontradas = menciones.filter(m =>
      (m.titulo + ' ' + m.texto).toLowerCase().includes(evento.toLowerCase())
    );
    if (encontradas.length > 0) {
      console.log(`  "${evento}": ${encontradas.length} menciones`);
      for (const m of encontradas.slice(0, 2)) {
        console.log(`    - "${m.titulo}" (${m.medio?.nombre})`);
      }
    }
  }

  // 5. Formatear menciones para el prompt
  const mencionesPrompt = menciones.map((m, i) => {
    const parts = [
      `${i + 1}. **${m.titulo}**`,
      `   - Medio: ${m.Medio?.nombre ?? 'No especificado'}`,
      `   - Fecha: ${m.fechaPublicacion ?? 'N/D'}`,
    ];
    if (m.Persona?.nombre) parts.push(`   - Persona: ${m.Persona.nombre} (${m.Persona.partidoSigla ?? ''})`);
    if (m.sentimiento) parts.push(`   - Sentimiento: ${m.sentimiento}`);
    const temasStr = m.MencionTema.map(et => et.EjeTematico.nombre).join(', ');
    if (temasStr) parts.push(`   - Ejes: ${temasStr}`);
    return parts.join('\n');
  }).join('\n\n');

  // 6. Importar REGLAS_ANTI_ALUCINACION desde products.ts
  const { PRODUCTOS } = await import('../src/constants/products');
  const systemPrompt = PRODUCTOS.EL_TERMOMETRO.systemPrompt;

  console.log('\n--- SYSTEM PROMPT (primeros 500 chars) ---');
  console.log(systemPrompt.substring(0, 500) + '...');

  // 7. Generar con IA
  console.log('\n--- GENERANDO CON IA (temperatura: 0.0) ---');

  const ZAI = (await import('z-ai-web-dev-sdk')).default;
  const zai = await ZAI.create();

  const fechaBolivia = new Date().toLocaleDateString('es-BO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/La_Paz',
  });

  const userPrompt = `## Datos de Menciones\n${mencionesPrompt}\n\nGenera el producto "EL_TERMOMETRO" siguiendo las instrucciones del sistema.\nFecha de referencia: ${fechaBolivia}.\nVentana de datos:ultimos 7 dias\nTotal menciones: ${menciones.length}`;

  const completion = await zai.chat.completions.create({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.0,
    signal: AbortSignal.timeout(90000),
  });

  const contenido = completion.choices[0]?.message?.content ?? '';

  if (!contenido) {
    console.error('ERROR: La IA no genero contenido');
    process.exit(1);
  }

  console.log('\n=== CONTENIDO GENERADO ===');
  console.log(contenido);
  console.log('\n=== FIN CONTENIDO ===');

  // 8. Verificar post-generacion
  const { verifyProduct } = await import('../src/lib/verification/verify-product');
  const textoVerificado = await verifyProduct(
    contenido,
    menciones.map(m => ({
      texto: m.texto ?? '',
      titulo: m.titulo ?? '',
      medio: m.Medio?.nombre ?? '',
      persona: m.Persona?.nombre ?? null,
    })),
    'EL_TERMOMETRO'
  );

  console.log('\n--- VERIFICACION POST-GENERACION ---');
  console.log(`Verificado: ${textoVerificado.verified ? 'SI' : 'NO - se elimino contenido'}`);
  console.log(`Oraciones originales: ${textoVerificado.estadisticas.oracionesOriginales}`);
  console.log(`Oraciones eliminadas: ${textoVerificado.estadisticas.oracionesEliminadas}`);
  console.log(`Personajes sensibles encontrados: ${textoVerificado.estadisticas.personajesSensiblesEncontrados}`);
  console.log(`Personajes sensibles verificados: ${textoVerificado.estadisticas.personajesSensiblesVerificados}`);
  console.log(`Personajes sensibles eliminados: ${textoVerificado.estadisticas.personajesSensiblesEliminados}`);

  if (textoVerificado.eliminados.length > 0) {
    console.log('\n--- CONTENIDO ELIMINADO ---');
    for (const item of textoVerificado.eliminados) {
      console.log(`  [${item.tipo}] ${item.razon}`);
      console.log(`  Texto: "${item.texto.substring(0, 100)}..."`);
    }
  }

  if (textoVerificado.alertas.length > 0) {
    console.log('\n--- ALERTAS ---');
    for (const alerta of textoVerificado.alertas) {
      console.log(`  ! ${alerta}`);
    }
  }

  // 9. Guardar resultado
  const outputPath = join(process.cwd(), 'download', 'EL_TERMOMETRO-regenerado.md');
  const fs = await import('fs');
  fs.mkdirSync(join(process.cwd(), 'download'), { recursive: true });
  fs.writeFileSync(outputPath, `# EL TERMOMETRO — Regenerado\n\n${textoVerificado.textoLimpio}\n\n---\nVerificacion: ${JSON.stringify(textoVerificado.estadisticas, null, 2)}`);
  console.log(`\nGuardado en: ${outputPath}`);

  await db.$disconnect();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
