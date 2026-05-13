// seed-config.ts — Restaurar datos CONFIG desde un backup sin tocar datos OPERACIONALES
// Uso: npx tsx scripts/seed-config.ts [ruta-al-backup.db]
//
// Estrategia: Lee las tablas CONFIG del backup y hace upsert en la DB activa.
// Las tablas OPERACIONALES (Mencion, CapturaLog, Job, etc.) NO se tocan.
//
// Tablas CONFIG restauradas:
//   Persona, Medio, EjeTematico, FuenteEstado, Indicador,
//   MarcoConceptual (solo si no existe activo), Suscriptor, SuscriptorGratuito

import { PrismaClient } from '@prisma/client'
import * as path from 'path'
import * as fs from 'fs'

// ─── Configuración ──────────────────────────────────────────

const DEFAULT_BACKUP = path.join(process.cwd(), 'backups', 'snapshot-20260509-000013.db')

function getBackupPath(): string {
  const custom = process.argv[2]
  if (custom) return path.resolve(custom)
  return DEFAULT_BACKUP
}

function getActiveDbPath(): string {
  const dbUrl = process.env.DATABASE_URL || ''
  const match = dbUrl.match(/file:(.+)/)
  if (!match) throw new Error('No se pudo determinar DATABASE_URL')
  return match[1]
}

// ─── Tablas CONFIG (se restauran) vs OPERACIONALES (no se tocan) ──

const CONFIG_TABLES = [
  'Persona',
  'Medio',
  'EjeTematico',
  'FuenteEstado',
  'Indicador',
  'MarcoConceptual',
  'Suscriptor',
  'SuscriptorGratuito',
] as const

// Tablas que tienen foreign keys y se procesan en orden específico
// EjeTematico tiene parentId self-reference — se procesan con cuidado

// ─── Main ───────────────────────────────────────────────────

async function main() {
  const backupPath = getBackupPath()
  const activePath = getActiveDbPath()

  console.log('═══════════════════════════════════════════════════')
  console.log('  DECODEX Bolivia — Seed Config desde Backup')
  console.log('═══════════════════════════════════════════════════')
  console.log(`  Backup:  ${backupPath}`)
  console.log(`  Activa:  ${activePath}`)
  console.log('')

  // Verificar que el backup existe
  if (!fs.existsSync(backupPath)) {
    console.error(`❌ Backup no encontrado: ${backupPath}`)
    console.error('   Puedes especificar una ruta alternativa:')
    console.error('   npx tsx scripts/seed-config.ts /ruta/al/backup.db')
    process.exit(1)
  }

  // Conectar a DB activa
  const db = new PrismaClient()

  // Conectar a backup (solo lectura)
  const backupDb = new PrismaClient({
    datasources: {
      db: { url: `file:${backupPath}` },
    },
  })

  try {
    await db.$connect()
    await backupDb.$connect()

    // Contar antes
    console.log('── Estado ANTES de la fusión ──')
    const beforeCounts: Record<string, number> = {}
    for (const table of CONFIG_TABLES) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const count = await (db as any)[table.toLowerCase()].count()
      beforeCounts[table] = count
      console.log(`  ${table}: ${count}`)
    }
    console.log('')

    let totalInsertados = 0
    let totalActualizados = 0

    // ── 1. Persona (upsert por id) ───────────────────────
    console.log('── Restaurando Persona ──')
    const backupPersonas = await backupDb.persona.findMany({ orderBy: { nombre: 'asc' } })
    for (const p of backupPersonas) {
      const existing = await db.persona.findUnique({ where: { id: p.id } })
      if (existing) {
        // Actualizar solo campos básicos si el backup es más reciente
        await db.persona.update({
          where: { id: p.id },
          data: {
            nombre: p.nombre,
            camara: p.camara,
            departamento: p.departamento,
            partido: p.partido,
            partidoSigla: p.partidoSigla,
            tipo: p.tipo,
            cargoDirectiva: p.cargoDirectiva,
            email: p.email,
            activa: p.activa,
            periodo: p.periodo,
          },
        })
        totalActualizados++
      } else {
        await db.persona.create({ data: { ...p, id: p.id } })
        totalInsertados++
      }
    }
    console.log(`  ✅ ${totalInsertados} insertados, ${totalActualizados} actualizados`)

    let inserted = totalInsertados
    let updated = totalActualizados

    // ── 2. Medio (upsert por id) ─────────────────────────
    console.log('── Restaurando Medio ──')
    inserted = 0; updated = 0
    const backupMedios = await backupDb.medio.findMany({ orderBy: { nombre: 'asc' } })
    for (const m of backupMedios) {
      const existing = await db.medio.findUnique({ where: { id: m.id } })
      if (existing) {
        await db.medio.update({
          where: { id: m.id },
          data: {
            nombre: m.nombre,
            url: m.url,
            tipo: m.tipo,
            categoria: m.categoria,
            nivel: m.nivel,
            departamento: m.departamento,
            plataformas: m.plataformas,
            notas: m.notas,
            pais: m.pais,
            activo: m.activo,
          },
        })
        updated++
      } else {
        await db.medio.create({ data: { ...m, id: m.id } })
        inserted++
      }
    }
    totalInsertados += inserted
    totalActualizados += updated
    console.log(`  ✅ ${inserted} insertados, ${updated} actualizados`)

    // ── 3. EjeTematico (upsert por slug — cuidado con jerarquía) ─
    console.log('── Restaurando EjeTematico ──')
    inserted = 0; updated = 0
    const backupEjes = await backupDb.ejeTematico.findMany({ orderBy: { orden: 'asc' } })
    // Primero los raíz (sin parentId), luego los hijos
    const raices = backupEjes.filter(e => !e.parentId)
    const hijos = backupEjes.filter(e => e.parentId)

    // Slug → nuevo ID mapping (por si los IDs cambian)
    const slugToId: Record<string, string> = {}

    for (const eje of [...raices, ...hijos]) {
      const existing = await db.ejeTematico.findUnique({ where: { slug: eje.slug } })
      const parentIdMapped = eje.parentId ? slugToId[eje.parentId] : null

      if (existing) {
        await db.ejeTematico.update({
          where: { slug: eje.slug },
          data: {
            nombre: eje.nombre,
            icono: eje.icono,
            color: eje.color,
            descripcion: eje.descripcion,
            keywords: eje.keywords,
            dimension: eje.dimension,
            activo: eje.activo,
            orden: eje.orden,
            ...(parentIdMapped ? { parentId: parentIdMapped } : {}),
          },
        })
        slugToId[eje.slug] = existing.id
        updated++
      } else {
        const created = await db.ejeTematico.create({
          data: {
            ...eje,
            id: undefined, // let DB generate new ID
            slug: eje.slug,
            ...(parentIdMapped ? { parentId: parentIdMapped } : { parentId: null }),
          },
        })
        slugToId[eje.slug] = created.id
        inserted++
      }
    }
    totalInsertados += inserted
    totalActualizados += updated
    console.log(`  ✅ ${inserted} insertados, ${updated} actualizados`)

    // ── 4. FuenteEstado (upsert por medioId) ──────────────
    console.log('── Restaurando FuenteEstado ──')
    inserted = 0; updated = 0
    const backupEstados = await backupDb.fuenteEstado.findMany()
    for (const fe of backupEstados) {
      // Solo restaurar si el medio existe en la DB activa
      const medioExists = await db.medio.findUnique({ where: { id: fe.medioId } })
      if (!medioExists) continue

      const existing = await db.fuenteEstado.findUnique({ where: { medioId: fe.medioId } })
      if (existing) {
        // No sobreescribir métricas operacionales (totalChecks, últimoCheck, etc.)
        // Solo restaurar config: url, tipoCheck, frecuenciaBase, horariosOptimos
        await db.fuenteEstado.update({
          where: { medioId: fe.medioId },
          data: {
            url: fe.url,
            tipoCheck: fe.tipoCheck,
            frecuenciaBase: fe.frecuenciaBase,
            horariosOptimos: fe.horariosOptimos,
            horasPublicacion: fe.horasPublicacion,
          },
        })
        updated++
      } else {
        await db.fuenteEstado.create({
          data: {
            medioId: fe.medioId,
            url: fe.url,
            tipoCheck: fe.tipoCheck,
            frecuenciaBase: fe.frecuenciaBase,
            frecuenciaActual: fe.frecuenciaBase,
            horariosOptimos: fe.horariosOptimos,
            horasPublicacion: fe.horasPublicacion,
            ultimosIds: fe.ultimosIds || '[]',
          },
        })
        inserted++
      }
    }
    totalInsertados += inserted
    totalActualizados += updated
    console.log(`  ✅ ${inserted} insertados, ${updated} actualizados`)

    // ── 5. Indicador (upsert por slug) ───────────────────
    console.log('── Restaurando Indicador ──')
    inserted = 0; updated = 0
    const backupIndicadores = await backupDb.indicador.findMany()
    for (const ind of backupIndicadores) {
      const existing = await db.indicador.findUnique({ where: { slug: ind.slug } })
      if (existing) {
        await db.indicador.update({
          where: { slug: ind.slug },
          data: {
            nombre: ind.nombre,
            categoria: ind.categoria,
            tipo: ind.tipo,
            fuente: ind.fuente,
            url: ind.url,
            periodicidad: ind.periodicidad,
            unidad: ind.unidad,
            formatoNumero: ind.formatoNumero,
            activo: ind.activo,
            orden: ind.orden,
            ejesTematicos: ind.ejesTematicos,
            tier: ind.tier,
            notas: ind.notas,
            metodologia: ind.metodologia,
            variables: ind.variables,
            escalaMin: ind.escalaMin,
            escalaMax: ind.escalaMax,
          },
        })
        updated++
      } else {
        await db.indicador.create({
          data: {
            ...ind,
            id: undefined,
            slug: ind.slug,
          },
        })
        inserted++
      }
    }
    totalInsertados += inserted
    totalActualizados += updated
    console.log(`  ✅ ${inserted} insertados, ${updated} actualizados`)

    // ── 6. MarcoConceptual (solo si no existe activo) ────
    console.log('── Restaurando MarcoConceptual ──')
    const existingMarco = await db.marcoConceptual.findFirst({ where: { activa: true } })
    if (!existingMarco) {
      const backupMarco = await backupDb.marcoConceptual.findFirst({ where: { activa: true } })
      if (backupMarco) {
        await db.marcoConceptual.create({
          data: {
            version: backupMarco.version,
            activa: true,
            principios: backupMarco.principios as any, // eslint-disable-line @typescript-eslint/no-explicit-any
            contextoInstitucional: backupMarco.contextoInstitucional as any,
            lineasEditoriales: backupMarco.lineasEditoriales as any,
            ejesInstitucionales: backupMarco.ejesInstitucionales as any,
            escalaTratamiento: backupMarco.escalaTratamiento as any,
            reglasDesambiguacion: backupMarco.reglasDesambiguacion as any,
            criteriosRelevancia: backupMarco.criteriosRelevancia as any,
            exclusionesEtica: backupMarco.exclusionesEtica as any,
            terminologiaPermitida: backupMarco.terminologiaPermitida as any,
            terminologiaProhibida: backupMarco.terminologiaProhibida as any,
            preguntasFundamentales: backupMarco.preguntasFundamentales as any,
            parametros: backupMarco.parametros as any,
            creadoPor: 'seed-config-restore',
          },
        })
        console.log('  ✅ Marco conceptual restaurado')
      } else {
        console.log('  ⚠ No hay marco activo en el backup')
      }
    } else {
      console.log('  ⏭ Ya existe marco activo, se conserva')
    }

    // ── 7. Suscriptor + SuscriptorGratuito ───────────────
    console.log('── Restaurando Suscriptores ──')
    inserted = 0; updated = 0
    const backupSuscriptores = await backupDb.suscriptor.findMany()
    for (const s of backupSuscriptores) {
      const existing = await db.suscriptor.findFirst({ where: { email: s.email } })
      if (!existing) {
        await db.suscriptor.create({ data: { ...s, id: undefined } })
        inserted++
      }
    }
    const backupGratis = await backupDb.suscriptorGratuito.findMany()
    for (const s of backupGratis) {
      const existing = await db.suscriptorGratuito.findUnique({ where: { email: s.email } })
      if (!existing) {
        await db.suscriptorGratuito.create({ data: { ...s, id: undefined } })
        inserted++
      }
    }
    console.log(`  ✅ ${inserted} insertados, ${updated} actualizados`)

    // ── Resultado final ──────────────────────────────────
    console.log('')
    console.log('── Estado DESPUÉS de la fusión ──')
    for (const table of CONFIG_TABLES) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const count = await (db as any)[table.toLowerCase()].count()
      const diff = count - beforeCounts[table]
      const sign = diff > 0 ? '+' : ''
      console.log(`  ${table}: ${count} (${sign}${diff})`)
    }

    // Verificar datos operacionales NO tocados
    const mencionesCount = await db.mencion.count()
    const jobsCount = await db.job.count()
    console.log('')
    console.log('── Datos operacionales (NO tocados) ──')
    console.log(`  Menciones: ${mencionesCount}`)
    console.log(`  Jobs: ${jobsCount}`)
    console.log('')
    console.log(`═══ Fusión completada: ${totalInsertados} insertados, ${totalActualizados} actualizados ═══`)

  } catch (error) {
    console.error('❌ Error durante la fusión:', error)
    process.exit(1)
  } finally {
    await db.$disconnect()
    await backupDb.$disconnect()
  }
}

main()
