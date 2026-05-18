/**
 * CORRECCIÓN DE URLs VERIFICADAS — DECODEX Bolivia
 *
 * Actualiza las URLs de medios basándose en verificación manual.
 * También actualiza las tablas FuenteEstado correspondientes.
 *
 * READ-WRITE: Modifica la DB.
 */

import { PrismaClient } from '@prisma/client';
import { join } from 'path';

const PROJECT_ROOT = process.cwd();
const CANONICAL_DB_PATH = join(PROJECT_ROOT, 'prisma', 'db', 'custom.db');
process.env.DATABASE_URL = `file:${CANONICAL_DB_PATH}`;

interface Correccion {
  busqueda: string;
  url: string;
}

const correcciones: Correccion[] = [
  { busqueda: "La Patria", url: "https://lapatria.bo/" },
  { busqueda: "La Estrella", url: "https://www.leo.bo/" },
  { busqueda: "El Potosí", url: "https://elpotosi.net" },
  { busqueda: "ABI", url: "https://abi.bo/" },
  { busqueda: "ANF", url: "https://www.noticiasfides.com/" },
  { busqueda: "ATB", url: "https://www.atb.com.bo/" },
  { busqueda: "Bolivia TV", url: "https://www.boliviatv.bo/" },
  { busqueda: "RTP", url: "https://rtpbolivia.com.bo/" },
  { busqueda: "Unitel", url: "https://unitel.bo/" },
  { busqueda: "Red Uno", url: "https://www.reduno.com.bo/" },
  { busqueda: "El Deber", url: "https://eldeber.com.bo/" },
  { busqueda: "Los Tiempos", url: "https://www.lostiempos.com/" },
  { busqueda: "El Diario", url: "https://www.eldiario.net" },
];

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('  CORRECCIÓN DE URLs VERIFICADAS — DECODEX Bolivia');
  console.log('='.repeat(60));
  console.log(`  DB: ${CANONICAL_DB_PATH}\n`);

  const db = new PrismaClient();
  let actualizados = 0;
  let noEncontrados = 0;
  let errores = 0;
  const detalles: string[] = [];

  for (const item of correcciones) {
    try {
      // Buscar medio por nombre parcial (SQLite no soporta mode:insensitive)
      const medio = await db.medio.findFirst({
        where: { nombre: { contains: item.busqueda } },
        include: { FuenteEstado: true },
      });

      if (!medio) {
        console.log(`  ⚠️  No encontrado: "${item.busqueda}"`);
        noEncontrados++;
        continue;
      }

      const urlAnterior = medio.url;
      const urlNueva = item.url;

      // Actualizar Medio
      await db.medio.update({
        where: { id: medio.id },
        data: {
          url: urlNueva,
          activo: true,
          ultimaRevisionHumana: new Date(),
        },
      });

      // Actualizar FuenteEstado si existe
      if (medio.FuenteEstado) {
        await db.fuenteEstado.update({
          where: { medioId: medio.id },
          data: {
            url: urlNueva,
            error: '',
            fallosConsecutivos: 0,
          },
        });
      } else {
        // Crear FuenteEstado si no existe
        await db.fuenteEstado.create({
          data: {
            id: `fe-${medio.id}`,
            medioId: medio.id,
            url: urlNueva,
            estado: 'activa',
            activo: true,
          },
        });
      }

      const cambio = urlAnterior !== urlNueva ? '↔️  CAMBIÓ' : '==  Igual';
      console.log(`  ✅  ${medio.nombre.padEnd(28)} ${cambio}`);
      console.log(`      Antes: ${urlAnterior || '(vacía)'}`);
      console.log(`      Ahora: ${urlNueva}`);
      if (medio.FuenteEstado) {
        console.log(`      FuenteEstado: actualizada`);
      } else {
        console.log(`      FuenteEstado: CREADA`);
      }

      actualizados++;
      detalles.push(`UPDATE OK: ${medio.nombre} (${urlAnterior} -> ${urlNueva})`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.log(`  ❌  ERROR ${item.busqueda}: ${msg}`);
      errores++;
    }
  }

  console.log('\n' + '-'.repeat(60));
  console.log(`  ✅  Actualizados: ${actualizados}`);
  console.log(`  ⚠️  No encontrados: ${noEncontrados}`);
  console.log(`  ❌  Errores: ${errores}`);
  console.log('-'.repeat(60));

  // Verificación final
  console.log('\n  VERIFICACIÓN POST-CORRECCIÓN:\n');
  const mediosCorregidos = await db.medio.findMany({
    where: {
      OR: correcciones.map(c => ({ nombre: { contains: c.busqueda } })),
    },
    select: { nombre: true, url: true, activo: true },
    orderBy: { nombre: 'asc' },
  });

  for (const m of mediosCorregidos) {
    const status = m.activo ? '✅' : '❌';
    console.log(`  ${status}  ${m.nombre.padEnd(28)} | ${m.url || '(vacía)'}`);
  }

  console.log('');
  await db.$disconnect();
}

main().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});
