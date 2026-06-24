/**
 * Diagnostic: Verifica ejes tematicos en la DB vs lo que el seed define.
 * Ejecutar en la VPS: npx tsx scripts/diagnostic-ejes.ts
 *
 * Muestra:
 * 1. Todos los EjeTematico en la DB con su slug y conteo de MencionTema
 * 2. Menciones huérfanas (MencionTema apuntando a eje inexistente)
 * 3. Ejes del seed actual vs lo que hay en DB
 */

import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

// Ejes del seed actual (copiados de src/app/api/seed/route.ts)
const SEED_EJES = [
  { slug: 'hidrocarburos-energia', nombre: 'Hidrocarburos y Energía' },
  { slug: 'economia-modelo-desarrollo', nombre: 'Economía, Modelo de Desarrollo y Empleo' },
  { slug: 'salud-determinantes-sociales', nombre: 'Salud y Determinantes Sociales' },
  { slug: 'mineria-metales-estrategicos', nombre: 'Minería y Metales Estratégicos' },
  { slug: 'sistemas-vida-territorio', nombre: 'Sistemas de Vida, Tierra y Territorio' },
  { slug: 'participacion-accion-colectiva', nombre: 'Participación y Acción Colectiva' },
  { slug: 'gestion-publica-institucional', nombre: 'Gestión Pública e Institucional' },
  { slug: 'organizacion-politica-electoral', nombre: 'Organización Política y Procesos Electorales' },
  { slug: 'justicia-derechos-humanos-impunidad', nombre: 'Justicia, Derechos Humanos e Impunidad' },
  { slug: 'educacion-cultura-identidad', nombre: 'Educación, Cultura e Identidad' },
  { slug: 'geopolitica-relaciones-internacionales', nombre: 'Geopolítica, Relaciones Internacionales y Soberanía' },
  { slug: 'territorio-poblacion-derechos-colectivos', nombre: 'Territorio, Población y Derechos Colectivos' },
]

async function main() {
  console.log('=== DIAGNOSTICO DE EJES TEMATICOS ===\n')

  // 1. Todos los ejes en la DB con conteo
  const ejesDB = await db.ejeTematico.findMany({
    select: { id: true, nombre: true, slug: true, activo: true },
    orderBy: { orden: 'asc' },
  })

  console.log(`--- EJES EN DB (${ejesDB.length} registros) ---`)
  for (const eje of ejesDB) {
    const count = await db.mencionTema.count({ where: { ejeTematicoId: eje.id } })
    const marker = eje.activo ? '✓' : '✗ INACTIVO'
    console.log(`  ${marker} [${eje.slug}] ${eje.nombre} (${count} menciones)`)
  }

  // 2. Ejes del seed que NO estan en DB
  const dbSlugs = new Set(ejesDB.map(e => e.slug))
  const faltantes = SEED_EJES.filter(e => !dbSlugs.has(e.slug))
  if (faltantes.length > 0) {
    console.log(`\n--- EJES DEL SEED FALTANTES EN DB (${faltantes.length}) ---`)
    for (const f of faltantes) {
      console.log(`  ! [${f.slug}] ${f.nombre}`)
    }
  } else {
    console.log(`\n✓ Todos los ${SEED_EJES.length} ejes del seed estan en la DB`)
  }

  // 3. Ejes en DB que NO estan en el seed (obsoletos)
  const seedSlugs = new Set(SEED_EJES.map(e => e.slug))
  const obsoletos = ejesDB.filter(e => !seedSlugs.has(e.slug) && !e.parentId)
  if (obsoletos.length > 0) {
    console.log(`\n--- EJES OBSOLETOS EN DB (${obsoletos.length}) ---`)
    for (const o of obsoletos) {
      const count = await db.mencionTema.count({ where: { ejeTematicoId: o.id } })
      console.log(`  ! [${o.slug}] ${o.nombre} (${count} menciones vinculadas)`)
    }
  } else {
    console.log(`\n✓ No hay ejes obsoletos en la DB`)
  }

  // 4. Nombres de ejes que menciona el seed-marco-conceptual.ts (version vieja?)
  const MARCO_EJES = [
    'Hidrocarburos, Energía y Combustible',
    'Movimientos Sociales y Conflictividad',
    'Gobierno, Oposición e Instituciones',
    'Corrupción e Impunidad',
    'Economía y Política Económica',
    'Justicia y Derechos Humanos',
    'Procesos Electorales',
    'Educación, Universidades y Cultura',
    'Salud y Servicios Públicos',
    'Medio Ambiente, Territorio y Recursos',
    'Relaciones Internacionales',
    'Minería y Metales Estratégicos',
  ]
  const dbNombres = new Set(ejesDB.map(e => e.nombre))
  const marcoFaltantes = MARCO_EJES.filter(n => !dbNombres.has(n))
  if (marcoFaltantes.length > 0) {
    console.log(`\n--- NOMBRES DEL MARCO CONCEPTUAL (seed-marco) QUE NO EXISTEN EN DB ---`)
    for (const n of marcoFaltantes) {
      console.log(`  ! "${n}" — este nombre esta en seed-marco-conceptual.ts pero NO en la DB`)
      // Buscar similitud
      const similares = ejesDB.filter(e =>
        e.nombre.toLowerCase().includes(n.split(',')[0].toLowerCase().split(' ')[0])
      )
      if (similares.length > 0) {
        console.log(`    → Posible reemplazo en DB: "${similares[0].nombre}"`)
      }
    }
  }

  // 5. Menciones huérfanas
  const mencionesTema = await db.mencionTema.findMany({
    select: { ejeTematicoId: true },
    distinct: ['ejeTematicoId'],
  })
  const ejeIds = new Set(ejesDB.map(e => e.id))
  const huérfanos = mencionesTema.filter(m => !ejeIds.has(m.ejeTematicoId))
  if (huérfanos.length > 0) {
    console.log(`\n--- MENCIONES HUERFANAS (${huérfanos.length} ejeTematicoId sin eje) ---`)
    for (const h of huérfanos) {
      const count = await db.mencionTema.count({ where: { ejeTematicoId: h.ejeTematicoId } })
      console.log(`  ! ejeTematicoId=${h.ejeTematicoId} tiene ${count} MencionTema pero no existe en EjeTematico`)
    }
  } else {
    console.log(`\n✓ No hay menciones huérfanas`)
  }

  // 6. Resumen de distribución
  console.log(`\n--- DISTRIBUCION DE MENCIONES POR EJE ---`)
  const allEjes = await db.ejeTematico.findMany({
    select: { id: true, nombre: true, slug: true, parentId: true },
    where: { activo: true, parentId: null }, // Solo estructurales
    orderBy: { orden: 'asc' },
  })
  for (const eje of allEjes) {
    const count = await db.mencionTema.count({ where: { ejeTematicoId: eje.id } })
    const bar = '█'.repeat(Math.min(Math.round(count / 20), 40))
    console.log(`  ${eje.nombre.slice(0, 45).padEnd(45)} ${String(count).padStart(5)} ${bar}`)
  }

  console.log('\n=== FIN DIAGNOSTICO ===')
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect())