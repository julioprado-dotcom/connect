/**
 * Diagnostic: Compara ejes tematicos en la DB vs el seed V3 actual.
 * Ejecutar en la VPS: cd /root/decodex-app && npx tsx scripts/diagnostic-ejes.ts
 *
 * Muestra:
 * 1. Todos los EjeTematico en la DB (estructurales vs legacy) con conteo de MencionTema
 * 2. Ejes del seed V3 faltantes en DB
 * 3. Ejes legacy/obsoletos en DB con menciones vinculadas
 * 4. Menciones huérfanas
 * 5. Distribucion de menciones por eje estructural
 */

import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

// Ejes raiz del seed V3 (LOS CORRECTOS - de scripts/seed-ejes-v3.ts)
const V3_ROOT_EJES = [
  { slug: 'hidrocarburos-energia', nombre: 'Hidrocarburos, Energía y Combustibles' },
  { slug: 'mineria-metales', nombre: 'Minería y Metales Estratégicos' },
  { slug: 'litio-energias-alternativas', nombre: 'Litio, Tierras Raras y Energías Alternativas' },
  { slug: 'gobierno-poder-instituciones', nombre: 'Gobierno, Poder e Instituciones' },
  { slug: 'vida-tierra-territorio', nombre: 'Sistemas de Vida, Tierra y Territorio' },
  { slug: 'justicia-derechos-impunidad', nombre: 'Justicia, Derechos Humanos e Impunidad' },
  { slug: 'organizaciones-sociales-gremiales', nombre: 'Organizaciones Sociales y Gremiales' },
  { slug: 'organizaciones-empresariales', nombre: 'Organizaciones Empresariales y Productivas' },
  { slug: 'salud-educacion-servicios', nombre: 'Salud, Educación y Servicios Sociales' },
  { slug: 'relaciones-internacionales', nombre: 'Relaciones Internacionales, Geopolítica y Soberanía' },
  { slug: 'procesos-electorales', nombre: 'Procesos Electorales y Democracia' },
  { slug: 'seguridad-ciudadana', nombre: 'Seguridad Ciudadana' },
]

// Nombres de ejes viejos (seed-marco-conceptual.ts V1) que ya NO deberian existir
const V1_EJE_NAMES = [
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

async function main() {
  console.log('=== DIAGNOSTICO DE EJES TEMATICOS (V3 vs DB) ===\n')

  // 1. Todos los ejes en la DB
  const ejesDB = await db.ejeTematico.findMany({
    select: { id: true, nombre: true, slug: true, activo: true, tipo: true, parentId: true },
    orderBy: { orden: 'asc' },
  })

  const estructurales = ejesDB.filter(e => e.tipo === 'estructural')
  const legacy = ejesDB.filter(e => e.tipo === 'legacy' || e.tipo === 'lente' || e.tipo !== 'estructural')
  const legacyRoot = legacy.filter(e => !e.parentId)

  console.log(`--- RESUMEN ---`)
  console.log(`  Total ejes en DB: ${ejesDB.length}`)
  console.log(`  Estructurales (V3): ${estructurales.length} (${estructurales.filter(e => !e.parentId).length} raiz + ${estructurales.filter(e => e.parentId).length} sub-ejes)`)
  console.log(`  Legacy/Otros: ${legacy.length} (${legacyRoot.length} raiz)`)

  // 2. Ejes V3 que faltan
  const dbSlugs = new Set(ejesDB.map(e => e.slug))
  const faltantes = V3_ROOT_EJES.filter(e => !dbSlugs.has(e.slug))
  if (faltantes.length > 0) {
    console.log(`\n--- EJES V3 FALTANTES EN DB (${faltantes.length}) ---`)
    for (const f of faltantes) console.log(`  ! [${f.slug}] ${f.nombre}`)
  } else {
    console.log(`\n  Todos los ${V3_ROOT_EJES.length} ejes V3 raiz estan en la DB`)
  }

  // 3. Ejes legacy con menciones vinculadas (EL PROBLEMA)
  console.log(`\n--- EJES LEGACY/OBSOLETOS EN DB ---`)
  let totalMencionesLegacy = 0
  for (const eje of legacyRoot) {
    const count = await db.mencionTema.count({ where: { ejeTematicoId: eje.id } })
    const notaEjeCount = await db.notaEje.count({ where: { ejeId: eje.id } })
    if (count > 0 || notaEjeCount > 0) {
      console.log(`  ! [${eje.tipo}] [${eje.slug}] "${eje.nombre}"`)
      console.log(`    MencionTema: ${count} | NotaEje: ${notaEjeCount}`)
      totalMencionesLegacy += count
    }
  }
  console.log(`\n  Total menciones en ejes legacy: ${totalMencionesLegacy}`)

  // 4. Verificar si hay menciones en ejes V3
  console.log(`\n--- MENCIONES EN EJES V3 (estructurales) ---`)
  let totalMencionesV3 = 0
  for (const ejeV3 of V3_ROOT_EJES) {
    const ejeDB = ejesDB.find(e => e.slug === ejeV3.slug)
    if (ejeDB) {
      // Incluir sub-ejes
      const allIds = [ejeDB.id, ...ejesDB.filter(e => e.parentId === ejeDB.id).map(e => e.id)]
      const count = await db.mencionTema.count({
        where: { ejeTematicoId: { in: allIds } }
      })
      totalMencionesV3 += count
      const bar = '█'.repeat(Math.min(Math.round(count / 20), 40))
      console.log(`  ${ejeV3.nombre.slice(0, 48).padEnd(48)} ${String(count).padStart(5)} ${bar}`)
    }
  }
  console.log(`\n  Total menciones en ejes V3: ${totalMencionesV3}`)

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
    console.log(`\n  No hay menciones huérfanas`)
  }

  // 6. Nombres V1 que todavia existen en DB
  console.log(`\n--- NOMBRES V1 QUE TODAVIA EXISTEN EN DB ---`)
  const dbNombres = new Set(ejesDB.map(e => e.nombre))
  for (const n of V1_EJE_NAMES) {
    if (dbNombres.has(n)) {
      const eje = ejesDB.find(e => e.nombre === n)
      if (eje) {
        const count = await db.mencionTema.count({ where: { ejeTematicoId: eje.id } })
        console.log(`  ! "${n}" [${eje.tipo}] [${eje.slug}] — ${count} menciones vinculadas`)
      }
    }
  }

  // 7. getEjesCached simulation — que es lo que ve el extractor ahora
  console.log(`\n--- SIMULACION getEjesCached() ---`)
  const ejesActuales = await db.ejeTematico.findMany({
    where: { activo: true },
    select: { id: true, nombre: true, slug: true, tipo: true },
  })
  const ejesEstructurales = await db.ejeTematico.findMany({
    where: { activo: true, tipo: 'estructural' },
    select: { id: true, nombre: true, slug: true, tipo: true },
  })
  console.log(`  Sin filtro tipo: ${ejesActuales.length} ejes (incluye legacy)`)
  console.log(`  Con filtro tipo=estructural: ${ejesEstructurales.length} ejes (solo V3)`)

  console.log('\n=== FIN DIAGNOSTICO ===')
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect())