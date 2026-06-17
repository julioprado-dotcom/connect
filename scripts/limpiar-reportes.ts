/**
 * Script: Limpiar reportes corruptos pre-fix
 * 
 * Borra todos los reportes existentes que fueron generados con la ventana
 * incorrecta de 7 días (bug en getDateRange corregido en session actual).
 * 
 * Criterio de borrado:
 * - Reportes con totalMenciones = 0 (vacíos)
 * - Reportes con totalMenciones sospechosamente alto para su tipo
 * - Todos los reportes anteriores a hoy (generados con el bug)
 * 
 * Ejecutar con: npx tsx scripts/limpiar-reportes.ts
 */

import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

async function main() {
  console.log('=== LIMPIEZA DE REPORTES CORRUPTOS ===\n')

  // 1. Contar todos los reportes
  const total = await db.reporte.count()
  console.log(`Total reportes en DB: ${total}`)

  // 2. Reportes con 0 menciones (vacíos/borrados)
  const vacios = await db.reporte.count({ where: { totalMenciones: 0 } })
  console.log(`Reportes con 0 menciones (vacíos): ${vacios}`)

  // 3. Reportes con menciones sospechosas (>200 para productos diarios)
  const tiposDiarios = ['EL_TERMOMETRO', 'SALDO_DEL_DIA', 'EL_FOCO', 'ALERTA_TEMPRANA']
  const sospechosos = await db.reporte.count({
    where: {
      tipo: { in: tiposDiarios },
      totalMenciones: { gt: 200 },
    },
  })
  console.log(`Reportes diarios con >200 menciones (sospechosos de ventana incorrecta): ${sospechosos}`)

  // 4. Todos los reportes con datos
  const conDatos = await db.reporte.count({ where: { totalMenciones: { gt: 0 } } })
  console.log(`Reportes con datos (>0 menciones): ${conDatos}`)

  // 5. Mostrar reportes que se borrarían
  const aBorrar = await db.reporte.findMany({
    where: {
      OR: [
        { totalMenciones: 0 },
        { tipo: { in: tiposDiarios }, totalMenciones: { gt: 200 } },
      ],
    },
    select: {
      id: true,
      tipo: true,
      totalMenciones: true,
      fechaCreacion: true,
      resumen: true,
    },
    orderBy: { fechaCreacion: 'desc' },
  })

  console.log(`\n--- Reportes a borrar: ${aBorrar.length} ---`)
  for (const r of aBorrar) {
    const fecha = r.fechaCreacion?.toLocaleDateString('es-BO', { timeZone: 'America/La_Paz' }) ?? '?'
    console.log(`  [${r.tipo}] ${r.totalMenciones} menciones | ${fecha} | ${r.id}`)
  }

  // 6. Ejecutar borrado
  const idsBorrar = aBorrar.map(r => r.id)
  if (idsBorrar.length === 0) {
    console.log('\nNo hay reportes que borrar.')
    return
  }

  console.log(`\nBorrando ${idsBorrar.length} reportes...`)
  const resultado = await db.reporte.deleteMany({
    where: { id: { in: idsBorrar } },
  })
  console.log(`Eliminados: ${resultado.count} reportes`)

  // 7. Verificar estado final
  const restantes = await db.reporte.count()
  console.log(`\nReportes restantes en DB: ${restantes}`)

  const restantesDetalle = await db.reporte.findMany({
    select: { id: true, tipo: true, totalMenciones: true, fechaCreacion: true },
    orderBy: { fechaCreacion: 'desc' },
  })
  if (restantesDetalle.length > 0) {
    console.log('\nReportes que quedaron:')
    for (const r of restantesDetalle) {
      const fecha = r.fechaCreacion?.toLocaleDateString('es-BO', { timeZone: 'America/La_Paz' }) ?? '?'
      console.log(`  [${r.tipo}] ${r.totalMenciones} menciones | ${fecha} | ${r.id}`)
    }
  }
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect())