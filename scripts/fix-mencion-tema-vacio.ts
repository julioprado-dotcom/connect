/**
 * REPARACION: Menciones que quedaron sin MencionTema despues de la migracion.
 * 
 * La migracion original borro MencionTema legacy pero fallo al crear los nuevos
 * (falta de campo `id` obligatorio). Este script encuentra menciones sin
 * MencionTema y las reclasifica contra ejes V3.
 *
 * Ejecutar: cd /root/decodex-app && npx tsx scripts/fix-mencion-tema-vacio.ts
 * DRY_RUN=1 para simular
 */

import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()
const DRY_RUN = process.env.DRY_RUN === '1'
const BATCH_SIZE = parseInt(process.env.BATCH || '500', 10)

async function reclasificarMencion(mencionId: string) {
  const mencion = await db.mencion.findUnique({
    where: { id: mencionId },
    select: { titulo: true, texto: true, textoCompleto: true, ejeEstructuralId: true },
  })
  if (!mencion) return { reclasificado: false, razon: 'no encontrada' }

  const textoCompleto = [mencion.titulo, mencion.texto, mencion.textoCompleto]
    .filter(Boolean).join(' ')

  const ejes = await db.ejeTematico.findMany({
    where: { tipo: 'estructural', activo: true },
    select: { id: true, nombre: true, slug: true, keywords: true, parentId: true, orden: true },
    orderBy: { orden: 'asc' },
  })

  const textoNorm = textoCompleto.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')

  const resultados: { ejeId: string; peso: number; keywordsMatched: number }[] = []

  for (const eje of ejes) {
    if (!eje.keywords) continue
    const kwList = eje.keywords.split(',').map(k => k.trim().toLowerCase())
    let matched = 0
    for (const kw of kwList) {
      const kwNorm = kw.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, ' ')
      if (kwNorm.length < 3) continue
      if (textoNorm.includes(kwNorm)) matched++
    }
    if (matched > 0) {
      const peso = Math.min(0.5 + (matched * 0.1), 1.0)
      if (peso >= 0.5) {
        resultados.push({ ejeId: eje.id, peso, keywordsMatched: matched })
      }
    }
  }

  resultados.sort((a, b) => b.peso - a.peso)
  const top6 = resultados.slice(0, 6)

  if (top6.length === 0) return { reclasificado: false, razon: 'sin match', textoLen: textoCompleto.length }

  const principal = top6.find(r => {
    const eje = ejes.find(e => e.id === r.ejeId)
    return eje && !eje.parentId
  }) || top6[0]

  return { reclasificado: true, ejes: top6, principalId: principal.ejeId, principalPeso: principal.peso }
}

async function main() {
  console.log(`=== REPARACION: Menciones sin MencionTema ===`)
  console.log(`DRY_RUN: ${DRY_RUN ? 'SI' : 'NO'}\n`)

  // 1. Encontrar menciones que NO tienen MencionTema apuntando a ejes estructurales
  const ejesEstructurales = await db.ejeTematico.findMany({
    where: { tipo: 'estructural', activo: true },
    select: { id: true },
  })
  const estructuralIds = new Set(ejesEstructurales.map(e => e.id))

  // Todas las menciones que tienen al menos un MencionTema en estructurales
  const mencionesConEstructural = await db.mencionTema.findMany({
    where: { ejeTematicoId: { in: [...estructuralIds] } },
    select: { mencionId: true },
    distinct: ['mencionId'],
  })
  const mencionesOK = new Set(mencionesConEstructural.map(m => m.mencionId))

  // Todas las menciones en la DB
  const todasMenciones = await db.mencion.findMany({
    select: { id: true },
  })

  // Las que necesitan reparacion
  const mencionesSinEje = todasMenciones.filter(m => !mencionesOK.has(m.id))
  console.log(`Total menciones en DB: ${todasMenciones.length}`)
  console.log(`Menciones con eje estructural: ${mencionesOK.size}`)
  console.log(`Menciones SIN eje estructural (a reparar): ${mencionesSinEje.length}\n`)

  if (mencionesSinEje.length === 0) {
    console.log('No hay menciones que reparar.')
    return
  }

  // 2. Procesar en batches
  const batches: string[][] = []
  const ids = mencionesSinEje.map(m => m.id)
  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    batches.push(ids.slice(i, i + BATCH_SIZE))
  }

  let stats = { procesadas: 0, reclasificadas: 0, sinMatch: 0, errores: 0, mtCreados: 0, neCreados: 0 }

  for (let b = 0; b < batches.length; b++) {
    console.log(`--- Batch ${b + 1}/${batches.length} (${batches[b].length} menciones) ---`)

    for (const mencionId of batches[b]) {
      stats.procesadas++
      try {
        const resultado = await reclasificarMencion(mencionId)

        if (resultado.reclasificado && resultado.ejes) {
          stats.reclasificadas++
          if (!DRY_RUN) {
            for (const eje of resultado.ejes) {
              try {
                await db.mencionTema.create({
                  data: {
                    id: crypto.randomUUID(),
                    mencionId,
                    ejeTematicoId: eje.ejeId,
                  },
                })
                stats.mtCreados++
              } catch { /* duplicate */ }
            }
            for (const eje of resultado.ejes) {
              try {
                await db.notaEje.create({
                  data: {
                    id: crypto.randomUUID(),
                    mencionId,
                    ejeId: eje.ejeId,
                    peso: eje.peso,
                  },
                })
                stats.neCreados++
              } catch { /* duplicate */ }
            }
            // Actualizar ejeEstructuralId si es null o legacy
            const mencionActual = await db.mencion.findUnique({
              where: { id: mencionId },
              select: { ejeEstructuralId: true },
            })
            if (!mencionActual?.ejeEstructuralId || !estructuralIds.has(mencionActual.ejeEstructuralId)) {
              await db.mencion.update({
                where: { id: mencionId },
                data: { ejeEstructuralId: resultado.principalId },
              })
            }
          }
        } else {
          stats.sinMatch++
        }

        if (stats.procesadas % 100 === 0) {
          console.log(`  Progreso: ${stats.procesadas}/${ids.length} | OK: ${stats.reclasificadas} | Sin match: ${stats.sinMatch}`)
        }
      } catch (err) {
        stats.errores++
        console.error(`  Error en ${mencionId}:`, err instanceof Error ? err.message : String(err))
      }
    }
  }

  console.log(`\n=== RESUMEN ===`)
  console.log(`  Procesadas: ${stats.procesadas}`)
  console.log(`  Reclasificadas: ${stats.reclasificadas}`)
  console.log(`  Sin match: ${stats.sinMatch}`)
  console.log(`  Errores: ${stats.errores}`)
  console.log(`  MencionTema creados: ${stats.mtCreados}`)
  console.log(`  NotaEje creados: ${stats.neCreados}`)
  if (DRY_RUN) {
    console.log(`\n  *** DRY RUN — sin cambios reales ***`)
    console.log(`  Para ejecutar: npx tsx scripts/fix-mencion-tema-vacio.ts`)
  }
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect())