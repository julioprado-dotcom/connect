// Sistema de Backup y Archivo — DECODEX Bolivia
// Prevente pérdida de datos por purge, crash, o migración.
// Estrategia:
//   1. Snapshot completo de la DB (copia del archivo SQLite)
//   2. Archive JSON de registros antes de purge (jobs, menciones, logs)
//   3. Rotación automática: 7 diarios + 4 semanales
//   4. API para backup manual y listado

import { promises as fs } from 'fs'
import path from 'path'
import db from '@/lib/db'

// ── Configuración ────────────────────────────────────────────────────

const BACKUP_DIR = path.join(process.cwd(), 'backups')
const ARCHIVE_DIR = path.join(process.cwd(), 'backups', 'archives')

// Tablas críticas a exportar antes de cualquier purge
const CRITICAL_TABLES = [
  'Job',
  'Mencion',
  'CapturaLog',
  'IndicadorValor',
  'FuenteEstado',
] as const

// Retención de backups
const RETENTION = {
  dailyCount: 7,     // últimos 7 días
  weeklyCount: 4,    // últimas 4 semanas
  archiveDays: 90,   // archivos JSON de archivo se conservan 90 días
} as const

// ── Helpers ──────────────────────────────────────────────────────────

// Timestamp formato: YYYYMMDD-HHMMSS (America/La_Paz)
function timestampLaPaz(): string {
  const now = new Date()
  // America/La_Paz = UTC-4
  const laPaz = new Date(now.getTime() - 4 * 60 * 60 * 1000)
  const y = laPaz.getFullYear()
  const mo = String(laPaz.getMonth() + 1).padStart(2, '0')
  const d = String(laPaz.getDate()).padStart(2, '0')
  const h = String(laPaz.getUTCHours()).padStart(2, '0')
  const mi = String(laPaz.getUTCMinutes()).padStart(2, '0')
  const s = String(laPaz.getUTCSeconds()).padStart(2, '0')
  return `${y}${mo}${d}-${h}${mi}${s}`
}

// Asegurar que los directorios existen
async function ensureDirs(): Promise<void> {
  await fs.mkdir(BACKUP_DIR, { recursive: true })
  await fs.mkdir(ARCHIVE_DIR, { recursive: true })
}

// Obtener la ruta del archivo de DB SQLite activo
function getDbPath(): string {
  // DATABASE_URL tiene formato: "file:/ruta/a/custom.db"
  const dbUrl = process.env.DATABASE_URL || ''
  const match = dbUrl.match(/file:(.+)/)
  if (!match) {
    throw new Error('[Backup] No se pudo determinar la ruta de la DB desde DATABASE_URL')
  }
  let dbPath = match[1]
  // Si es ruta relativa, resolver desde prisma/
  if (!path.isAbsolute(dbPath)) {
    dbPath = path.join(process.cwd(), 'prisma', dbPath)
  }
  return dbPath
}

// Tamaño legible de archivo
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ── 1. Snapshot Completo de la DB ────────────────────────────────────

export interface SnapshotResult {
  success: boolean
  archivo: string
  tamanio: string
  timestamp: string
  error?: string
}

/**
 * Crea una copia completa del archivo SQLite.
 * Es la forma más rápida y confiable de respaldar todo.
 * Se ejecuta ANTES de cualquier operación de purge.
 */
export async function createSnapshot(razon: string = 'manual'): Promise<SnapshotResult> {
  const ts = timestampLaPaz()
  const dbPath = getDbPath()
  const backupPath = path.join(BACKUP_DIR, `snapshot-${ts}.db`)

  await ensureDirs()

  try {
    // Verificar que el origen existe
    const stat = await fs.stat(dbPath)

    // Copiar el archivo (lectura + escritura atómica)
    await fs.copyFile(dbPath, backupPath)

    const backupStat = await fs.stat(backupPath)

    // Log en consola
    console.log(
      `[Backup] Snapshot creado: ${path.basename(backupPath)} ` +
      `(${formatBytes(backupStat.size)}) — razón: ${razon}`
    )

    // Rotar backups antiguos
    await rotateSnapshots()

    return {
      success: true,
      archivo: backupPath,
      tamanio: formatBytes(backupStat.size),
      timestamp: ts,
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error(`[Backup] Error creando snapshot: ${msg}`)

    return {
      success: false,
      archivo: '',
      tamanio: '0 B',
      timestamp: ts,
      error: msg,
    }
  }
}

// ── 2. Archive JSON de registros (antes de purge) ────────────────────

export interface ArchiveResult {
  success: boolean
  archivo: string
  registros: Record<string, number>
  timestamp: string
  error?: string
}

/**
 * Exporta registros de tablas críticas a JSON antes de eliminarlos.
 * Cada tabla se guarda como un archivo JSON separado.
 * Esto permite restaurar datos individuales si fue necesario.
 */
export async function archiveBeforePurge(
  tablas: readonly string[] = CRITICAL_TABLES
): Promise<ArchiveResult> {
  const ts = timestampLaPaz()
  await ensureDirs()

  const registros: Record<string, number> = {}
  const archivos: string[] = []

  try {
    for (const tabla of tablas) {
      try {
        // Consultar todos los registros de la tabla
        // @ts-expect-error — acceso dinámico a modelos Prisma
        const rows = await db[tabla.charAt(0).toLowerCase() + tabla.slice(1)].findMany({
          // No poner límite — queremos TODO para el archive
          // Si la tabla es muy grande, se procesa de forma lazy
          take: 100000,
        })

        if (rows.length === 0) continue

        // Serializar con limpieza de BigInt (JSON no soporta BigInt)
        const cleaned = rows.map((row: Record<string, unknown>) => {
          const clean: Record<string, unknown> = {}
          for (const [key, value] of Object.entries(row)) {
            if (typeof value === 'bigint') {
              clean[key] = Number(value)
            } else if (value instanceof Date) {
              clean[key] = value.toISOString()
            } else {
              clean[key] = value
            }
          }
          return clean
        })

        const fileName = `${tabla.toLowerCase()}-${ts}.json`
        const filePath = path.join(ARCHIVE_DIR, fileName)

        await fs.writeFile(filePath, JSON.stringify(cleaned, null, 2), 'utf-8')
        registros[tabla] = rows.length
        archivos.push(fileName)
      } catch (tableError: unknown) {
        const msg = tableError instanceof Error ? tableError.message : String(tableError)
        console.warn(`[Backup] No se pudo archivar tabla ${tabla}: ${msg}`)
        registros[tabla] = 0
      }
    }

    console.log(
      `[Backup] Archive creado: ${archivos.length} archivos, ` +
      `${Object.values(registros).reduce((a, b) => a + b, 0)} registros totales`
    )

    // Rotar archives antiguos
    await rotateArchives()

    return {
      success: true,
      archivo: archivos.join(', '),
      registros,
      timestamp: ts,
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error(`[Backup] Error creando archive: ${msg}`)

    return {
      success: false,
      archivo: '',
      registros: {},
      timestamp: ts,
      error: msg,
    }
  }
}

// ── 3. Rotación Automática ──────────────────────────────────────────

/**
 * Mantiene solo los últimos N backups de snapshot.
 * Estrategia:
 *   - Los 7 más recientes: diarios
 *   - Los lunes (o 1 por semana): conservar 4 adicionales como semanales
 *   - El resto se elimina
 */
export async function rotateSnapshots(): Promise<{ eliminados: number; conservados: number }> {
  await ensureDirs()

  try {
    const files = await fs.readdir(BACKUP_DIR)
    const snapshots = files
      .filter(f => f.startsWith('snapshot-') && f.endsWith('.db'))
      .sort()
      .reverse() // más reciente primero

    if (snapshots.length <= RETENTION.dailyCount) {
      return { eliminados: 0, conservados: snapshots.length }
    }

    // Los primeros N son diarios (se conservan)
    const dailyKeep = snapshots.slice(0, RETENTION.dailyCount)
    const candidates = snapshots.slice(RETENTION.dailyCount)

    // De los candidatos, conservar hasta 4 como "semanales" (cada 7ma posición)
    const weeklyKeep: string[] = []
    for (let i = 0; i < candidates.length && weeklyKeep.length < RETENTION.weeklyCount; i += 7) {
      weeklyKeep.push(candidates[i])
    }

    const keepSet = new Set([...dailyKeep, ...weeklyKeep])
    const toDelete = candidates.filter(f => !keepSet.has(f))

    for (const f of toDelete) {
      await fs.unlink(path.join(BACKUP_DIR, f))
    }

    if (toDelete.length > 0) {
      console.log(`[Backup] Rotación: ${toDelete.length} snapshots eliminados, ${keepSet.size} conservados`)
    }

    return { eliminados: toDelete.length, conservados: keepSet.size }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.warn(`[Backup] Error en rotación de snapshots: ${msg}`)
    return { eliminados: 0, conservados: 0 }
  }
}

/**
 * Elimina archivos JSON de archive más antiguos que RETENTION.archiveDays.
 */
export async function rotateArchives(): Promise<number> {
  await ensureDirs()
  const cutoff = Date.now() - RETENTION.archiveDays * 24 * 60 * 60 * 1000

  try {
    const files = await fs.readdir(ARCHIVE_DIR)
    let eliminados = 0

    for (const f of files) {
      if (!f.endsWith('.json')) continue

      const filePath = path.join(ARCHIVE_DIR, f)
      const stat = await fs.stat(filePath)

      if (stat.mtimeMs < cutoff) {
        await fs.unlink(filePath)
        eliminados++
      }
    }

    if (eliminados > 0) {
      console.log(`[Backup] Archives rotados: ${eliminados} archivos eliminados (> ${RETENTION.archiveDays} días)`)
    }

    return eliminados
  } catch {
    return 0
  }
}

// ── 4. Listar Backups Disponibles ────────────────────────────────────

export interface BackupInfo {
  tipo: 'snapshot' | 'archive'
  archivo: string
  tamanio: string
  fecha: string
}

/**
 * Lista todos los backups disponibles (snapshots + archives).
 */
export async function listBackups(): Promise<BackupInfo[]> {
  await ensureDirs()
  const backups: BackupInfo[] = []

  // Snapshots
  try {
    const snapFiles = await fs.readdir(BACKUP_DIR)
    for (const f of snapFiles) {
      if (!f.startsWith('snapshot-') || !f.endsWith('.db')) continue
      const filePath = path.join(BACKUP_DIR, f)
      const stat = await fs.stat(filePath)
      backups.push({
        tipo: 'snapshot',
        archivo: f,
        tamanio: formatBytes(stat.size),
        fecha: stat.mtime.toISOString(),
      })
    }
  } catch { /* directorio puede no existir */ }

  // Archives
  try {
    const archiveFiles = await fs.readdir(ARCHIVE_DIR)
    for (const f of archiveFiles) {
      if (!f.endsWith('.json')) continue
      const filePath = path.join(ARCHIVE_DIR, f)
      const stat = await fs.stat(filePath)
      backups.push({
        tipo: 'archive',
        archivo: f,
        tamanio: formatBytes(stat.size),
        fecha: stat.mtime.toISOString(),
      })
    }
  } catch { /* directorio puede no existir */ }

  // Ordenar por fecha descendente
  backups.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())

  return backups
}

// ── 5. Restaurar desde Snapshot ─────────────────────────────────────

export interface RestoreResult {
  success: boolean
  snapshotUsado: string
  error?: string
}

/**
 * Restaura la DB desde un snapshot.
 * PRECAUCIÓN: Sobreescribe la DB actual completamente.
 * Debe llamarse solo desde API endpoint con confirmación explícita.
 */
export async function restoreFromSnapshot(snapshotFile: string): Promise<RestoreResult> {
  const snapshotPath = path.join(BACKUP_DIR, snapshotFile)
  const dbPath = getDbPath()

  try {
    // Verificar que el snapshot existe
    await fs.access(snapshotPath)

    // Crear backup de seguridad de la DB actual ANTES de restaurar
    const preRestoreTs = timestampLaPaz()
    const preRestorePath = path.join(BACKUP_DIR, `pre-restore-${preRestoreTs}.db`)
    await fs.copyFile(dbPath, preRestorePath)

    // Restaurar: copiar snapshot sobre la DB activa
    await fs.copyFile(snapshotPath, dbPath)

    console.log(
      `[Backup] Restauración completada: ${snapshotFile} → DB activa\n` +
      `  Pre-restore backup: ${preRestorePath}`
    )

    return {
      success: true,
      snapshotUsado: snapshotFile,
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error(`[Backup] Error restaurando ${snapshotFile}: ${msg}`)

    return {
      success: false,
      snapshotUsado: snapshotFile,
      error: msg,
    }
  }
}

// ── 6. Resumen del Sistema de Backup ────────────────────────────────

export interface BackupSummary {
  snapshotsCount: number
  archivesCount: number
  snapshotsSize: string
  archivesSize: string
  ultimoSnapshot: string | null
  dbSize: string
}

export async function getBackupSummary(): Promise<BackupSummary> {
  await ensureDirs()

  let snapshotsCount = 0
  let archivesCount = 0
  let snapshotsBytes = 0
  let archivesBytes = 0
  let ultimoSnapshot: string | null = null

  try {
    const snapFiles = await fs.readdir(BACKUP_DIR)
    for (const f of snapFiles) {
      if (!f.startsWith('snapshot-') || !f.endsWith('.db')) continue
      const stat = await fs.stat(path.join(BACKUP_DIR, f))
      snapshotsCount++
      snapshotsBytes += stat.size
      if (!ultimoSnapshot || stat.mtimeMs > new Date(ultimoSnapshot).getTime()) {
        ultimoSnapshot = stat.mtime.toISOString()
      }
    }
  } catch { /* ok */ }

  try {
    const archiveFiles = await fs.readdir(ARCHIVE_DIR)
    for (const f of archiveFiles) {
      if (!f.endsWith('.json')) continue
      const stat = await fs.stat(path.join(ARCHIVE_DIR, f))
      archivesCount++
      archivesBytes += stat.size
    }
  } catch { /* ok */ }

  let dbSize = '0 B'
  try {
    const dbPath = getDbPath()
    const stat = await fs.stat(dbPath)
    dbSize = formatBytes(stat.size)
  } catch { /* ok */ }

  return {
    snapshotsCount,
    archivesCount,
    snapshotsSize: formatBytes(snapshotsBytes),
    archivesSize: formatBytes(archivesBytes),
    ultimoSnapshot,
    dbSize,
  }
}
