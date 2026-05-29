// backup-scheduler.ts — Backup automático de DB a GitHub (4 veces al día)
// DECODEX Bolivia / ONION200 Connect App
//
// Regla FIRME: Los backups NUNCA se borran.
// Cada snapshot se commita en prisma/db/backups/ y git preserva todo.
//
// Horarios Bolivia:
//   06:00 AM (mañana)   → UTC 10:00
//   12:00 PM (mediodía) → UTC 16:00
//   18:00 PM (tarde)    → UTC 22:00
//   23:00 PM (noche)    → UTC 03:00
//
// CRÍTICO: No hay imports estáticos de Node.js (fs, path, child_process, node-cron).
// Todo se importa dinámicamente dentro de funciones para evitar que Turbopack
// trace estos módulos al compilar instrumentation.ts para Edge Runtime.

interface BackupSchedulerState {
  running: boolean
  tasks: { stop: () => void }[]  // cron.ScheduledTask solo usa .stop()
  lastBackup: string | null
  backupCount: number
}

const _bs = globalThis as unknown as { __decodex_backup_scheduler__: BackupSchedulerState | undefined }

function getBackupState(): BackupSchedulerState {
  if (!_bs.__decodex_backup_scheduler__) {
    _bs.__decodex_backup_scheduler__ = {
      running: false,
      tasks: [],
      lastBackup: null,
      backupCount: 0,
    }
  }
  return _bs.__decodex_backup_scheduler__
}

// Horarios de backup (horas UTC = Bolivia -4) — 4 veces al día
const BACKUP_SCHEDULES: { utcHour: number; periodo: string }[] = [
  { utcHour: 9,  periodo: '05-mañana' },   // Bolivia 05:00 AM
  { utcHour: 14, periodo: '10-mediodía' },  // Bolivia 10:00 AM
  { utcHour: 20, periodo: '16-tarde' },    // Bolivia 16:00 (4 PM)
  { utcHour: 3,  periodo: '23-noche' },    // Bolivia 23:00
]

// Lock para evitar backups simultáneos
let backupInProgress = false

export async function startBackupScheduler(): Promise<void> {
  const state = getBackupState()
  if (state.running) {
    console.log('[BackupScheduler] Ya está corriendo')
    return
  }

  // Dynamic imports — solo se resuelven en Node.js runtime
  const cron = await import(/* webpackIgnore: true */ 'node-cron')
  const path = await import(/* webpackIgnore: true */ 'path')
  const fs = await import(/* webpackIgnore: true */ 'fs')

  const PROJECT_ROOT = process.cwd()
  const SCRIPT_PATH = path.join(PROJECT_ROOT, 'scripts', 'backup-db-github.sh')
  const DB_PATH = path.join(PROJECT_ROOT, 'prisma', 'db', 'custom.db')

  state.running = true

  console.log('[BackupScheduler] Iniciando backup automático 4x/día a GitHub...')
  console.log('[BackupScheduler] REGLA: Los backups NUNCA se borran.')

  for (const schedule of BACKUP_SCHEDULES) {
    const expression = `0 ${schedule.utcHour} * * *`

    if (!cron.validate(expression)) {
      console.warn(`[BackupScheduler] Expresión cron inválida: ${expression}`)
      continue
    }

    const task = cron.schedule(expression, async () => {
      if (backupInProgress) {
        console.log('[BackupScheduler] Backup en progreso, saltando...')
        return
      }

      // Verificar que la DB exista
      try {
        if (!fs.existsSync(DB_PATH) || fs.statSync(DB_PATH).size === 0) {
          console.warn(`[BackupScheduler] DB no encontrada o vacía: ${DB_PATH}`)
          return
        }
      } catch {
        console.warn(`[BackupScheduler] No se pudo verificar DB: ${DB_PATH}`)
        return
      }

      try {
        backupInProgress = true
        const startMs = Date.now()

        console.log(`[BackupScheduler] Ejecutando backup ${schedule.periodo}...`)

        // Dynamic import de child_process
        const { execSync } = await import('child_process')

        // Ejecutar script de backup
        execSync(`bash "${SCRIPT_PATH}" --force`, {
          cwd: PROJECT_ROOT,
          timeout: 120_000, // 2 min max
          stdio: 'pipe',
          env: {
            ...process.env,
            FORCE_BACKUP: 'true',
          },
        })

        const elapsed = ((Date.now() - startMs) / 1000).toFixed(1)
        state.lastBackup = new Date().toISOString()
        state.backupCount++

        console.log(
          `[BackupScheduler] Backup ${schedule.periodo} completado en ${elapsed}s ` +
          `(total: ${state.backupCount})`
        )
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        console.error(`[BackupScheduler] Error en backup ${schedule.periodo}: ${msg}`)
      } finally {
        backupInProgress = false
      }
    })

    state.tasks.push(task)
    console.log(`[BackupScheduler] Programado: ${schedule.periodo} (UTC ${String(schedule.utcHour).padStart(2, '0')}:00)`)
  }

  console.log(`[BackupScheduler] ${state.tasks.length} tareas programadas. Backups NUNCA se borran.`)
}

export function stopBackupScheduler(): void {
  const state = getBackupState()
  for (const task of state.tasks) {
    task.stop()
  }
  state.tasks.length = 0
  state.running = false
  console.log('[BackupScheduler] Detenido')
}

export function getBackupSchedulerStatus(): {
  running: boolean
  lastBackup: string | null
  backupCount: number
  schedules: { utcHour: number; periodo: string }[]
} {
  const state = getBackupState()
  return {
    running: state.running,
    lastBackup: state.lastBackup,
    backupCount: state.backupCount,
    schedules: BACKUP_SCHEDULES,
  }
}
