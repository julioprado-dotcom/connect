/**
 * MIGRACION: Reclasificar menciones que estan vinculadas a ejes legacy/obsoletos.
 * 
 * Estrategia:
 * 1. Encontrar todos los MencionTema que apuntan a ejes NO estructurales (legacy/otros)
 * 2. Para cada mencion afectada, eliminar los MencionTema viejos y NotaEje viejos
 * 3. Ejecutar reclasificarMencion() que usa keyword matching contra ejes V3
 * 4. Actualizar ejeEstructuralId si es null o apunta a un eje viejo
 *
 * Ejecutar en la VPS: cd /root/decodex-app && npx tsx scripts/migrate-legacy-ejes.ts
 *
 * FLAGS (via env vars):
 *   DRY_RUN=1  — solo mostrar lo que haria, sin ejecutar cambios
 *   BATCH=500  — cuantas menciones procesar por batch (default 500)
 */

import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()
const DRY_RUN = process.env.DRY_RUN === '1'
const BATCH_SIZE = parseInt(process.env.BATCH || '500', 10)

// Importar reclasificar dinámicamente para que funcione desde scripts/
async function reclasificarMencion(mencionId: string) {
  // Usar la logica de clasificador-v2 directamente (no podemos importar @/lib/db desde script)
  // Asi que reimplementamos el ciclo: borrar viejos, crear nuevos via keyword match
  const mencion = await db.mencion.findUnique({
    where: { id: mencionId },
    select: { titulo: true, texto: true, textoCompleto: true, ejeEstructuralId: true },
  })
  if (!mencion) return { reclasificado: false, razon: 'no encontrada' }

  const textoCompleto = [mencion.titulo, mencion.texto, mencion.textoCompleto]
    .filter(Boolean).join(' ')
  
  // Cargar ejes estructurales V3
  const ejes = await db.ejeTematico.findMany({
    where: { tipo: 'estructural', activo: true },
    select: { id: true, nombre: true, slug: true, keywords: true, parentId: true, orden: true },
    orderBy: { orden: 'asc' },
  })

  // Keyword matching
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
      if (kwNorm.length < 3) continue // skip very short keywords
      if (textoNorm.includes(kwNorm)) matched++
    }
    if (matched > 0) {
      // Peso basado en keywords: mas matches = mas peso, max 1.0
      const peso = Math.min(0.5 + (matched * 0.1), 1.0)
      if (peso >= 0.5) {
        resultados.push({ ejeId: eje.id, peso, keywordsMatched: matched })
      }
    }
  }

  // Ordenar por peso descendente, max 6
  resultados.sort((a, b) => b.peso - a.peso)
  const top6 = resultados.slice(0, 6)

  if (top6.length === 0) return { reclasificado: false, razon: 'sin match', textoLen: textoCompleto.length }

  // El principal es el de mayor peso que sea raiz (sin parentId)
  const principal = top6.find(r => {
    const eje = ejes.find(e => e.id === r.ejeId)
    return eje && !eje.parentId
  }) || top6[0]

  return { reclasificado: true, ejes: top6, principalId: principal.ejeId, principalPeso: principal.peso }
}

async function main() {
  console.log(`=== MIGRACION DE EJES LEGACY → V3 ===`)
  console.log(`DRY_RUN: ${DRY_RUN ? 'SI (no se haran cambios)' : 'NO (se ejecutaran cambios)'}`)
  console.log(`BATCH_SIZE: ${BATCH_SIZE}\n`)

  // 1. Encontrar ejes legacy con menciones
  const ejesLegacy = await db.ejeTematico.findMany({
    where: {
      OR: [
        { tipo: 'legacy' },
        { tipo: { not: 'estructural' }, activo: true },
      ],
    },
    select: { id: true, nombre: true, slug: true, tipo: true },
  })

  if (ejesLegacy.length === 0) {
    console.log('No hay ejes legacy en la DB. Nada que migrar.')
    return
  }

  const legacyIds = new Set(ejesLegacy.map(e => e.id))
  console.log(`Ejes legacy encontrados: ${ejesLegacy.length}`)
  for (const e of ejesLegacy) {
    console.log(`  [${e.tipo}] [${e.slug}] "${e.nombre}"`)
  }

  // 2. Encontrar menciones vinculadas a ejes legacy
  const mencionesVinculadas = await db.mencionTema.findMany({
    where: { ejeTematicoId: { in: [...legacyIds] } },
    select: { mencionId: true, ejeTematicoId: true },
    distinct: ['mencionId'],
  })

  console.log(`\nMenciones unicas vinculadas a ejes legacy: ${mencionesVinculadas.length}`)

  if (mencionesVinculadas.length === 0) {
    console.log('No hay menciones que migrar.')
    return
  }

  // 3. Procesar en batches
  const mencionIds = mencionesVinculadas.map(m => m.mencionId)
  const batches: string[][] = []
  for (let i = 0; i < mencionIds.length; i += BATCH_SIZE) {
    batches.push(mencionIds.slice(i, i + BATCH_SIZE))
  }

  let stats = { procesadas: 0, reclasificadas: 0, sinMatch: 0, errores: 0, mencionesBorradas: 0, notasBorradas: 0 }

  for (let b = 0; b < batches.length; b++) {
    console.log(`\n--- Batch ${b + 1}/${batches.length} (${batches[b].length} menciones) ---`)

    for (const mencionId of batches[b]) {
      stats.procesadas++
      try {
        if (!DRY_RUN) {
          // Borrar MencionTema viejos
          const deletedMT = await db.mencionTema.deleteMany({
            where: { mencionId, ejeTematicoId: { in: [...legacyIds] } },
          })
          stats.mencionesBorradas += deletedMT.count

          // Borrar NotaEje viejos
          const deletedNE = await db.notaEje.deleteMany({
            where: { mencionId, ejeId: { in: [...legacyIds] } },
          })
          stats.notasBorradas += deletedNE.count
        }

        // Reclasificar
        const resultado = await reclasificarMencion(mencionId)

        if (resultado.reclasificado && resultado.ejes) {
          stats.reclasificadas++
          if (!DRY_RUN) {
            // Crear nuevos MencionTema
            for (const eje of resultado.ejes) {
              try {
                await db.mencionTema.create({
                  data: { mencionId, ejeTematicoId: eje.ejeId },
                })
              } catch { /* duplicate */ }
            }
            // Crear nuevos NotaEje
            for (const eje of resultado.ejes) {
              try {
                await db.notaEje.create({
                  data: { id: crypto.randomUUID(), mencionId, ejeId: eje.ejeId, peso: eje.peso },
                })
              } catch { /* duplicate */ }
            }
            // Actualizar ejeEstructuralId si apuntaba a legacy
            const mencionActual = await db.mencion.findUnique({
              where: { id: mencionId },
              select: { ejeEstructuralId: true },
            })
            if (mencionActual?.ejeEstructuralId && legacyIds.has(mencionActual.ejeEstructuralId)) {
              await db.mencion.update({
                where: { id: mencionId },
                data: { ejeEstructuralId: resultado.principalId },
              })
            }
          }
        } else {
          stats.sinMatch++
        }

        if (stats.procesadas % 50 === 0) {
          console.log(`  Progreso: ${stats.procesadas}/${mencionIds.length} | Reclasificadas: ${stats.reclasificadas} | Sin match: ${stats.sinMatch}`)
        }
      } catch (err) {
        stats.errores++
        console.error(`  Error en mencion ${mencionId}:`, err instanceof Error ? err.message : String(err))
      }
    }
  }

  // 4. Resumen
  console.log(`\n=== RESUMEN DE MIGRACION ===`)
  console.log(`  Menciones procesadas: ${stats.procesadas}`)
  console.log(`  Reclasificadas con nuevos ejes V3: ${stats.reclasificadas}`)
  console.log(`  Sin match (quedan sin eje): ${stats.sinMatch}`)
  console.log(`  Errores: ${stats.errores}`)
  console.log(`  MencionTema legacy borrados: ${stats.mencionesBorradas}`)
  console.log(`  NotaEje legacy borrados: ${stats.notasBorradas}`)
  if (DRY_RUN) {
    console.log(`\n  *** DRY RUN — no se ejecutaron cambios reales ***`)
    console.log(`  Para ejecutar: DRY_RUN=0 npx tsx scripts/migrate-legacy-ejes.ts`)
  }

  // 5. Desactivar ejes legacy (opcional, despues de verificar)
  if (!DRY_RUN && stats.reclasificadas > 0) {
    console.log(`\n=== DESACTIVANDO EJES LEGACY ===`)
    for (const eje of ejesLegacy) {
      await db.ejeTematico.update({
        where: { id: eje.id },
        data: { activo: false },
      })
      console.log(`  Desactivado: [${eje.slug}] "${eje.nombre}"`)
    }
  }
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect())