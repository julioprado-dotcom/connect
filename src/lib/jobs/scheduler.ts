// Scheduler - programacion de jobs con node-cron - DECODEX Bolivia
// Conecta las 4 capas: horarios optimos -> node-cron -> enqueue jobs

import cron from 'node-cron'
import type { ScheduledTask } from 'node-cron'
import db from '@/lib/db'
import { enqueue } from './queue'
import { getFrecuenciaEfectiva, frecuenciaToChecksDia } from './frequency/calculator'
import { calcularHorariosOptimos, getHorariosDefault } from './histogram/calculator'
import { buildCronEntries, getBoletinCronEntries, getMantenimientoCronEntry, formatCronHuman } from './histogram/cron-builder'
import { CHECK_FIRST_CONFIG, QUEUE_LIMITS } from './constants'

// Tareas programadas activas
const scheduledTasks: ScheduledTask[] = []

// Estado del scheduler
let schedulerRunning = false

// Iniciar el scheduler (llamar una sola vez)
export async function startScheduler(): Promise<void> {
  if (schedulerRunning) {
    console.log('[Scheduler] Ya esta corriendo')
    return
  }
  schedulerRunning = true

  console.log('[Scheduler] Iniciando programacion de jobs...')

  // 1. Programar checks de fuentes
  await scheduleCheckJobs()

  // 2. Programar generacion de boletines
  scheduleBoletinJobs()

  // 3. Programar mantenimiento nocturno
  scheduleMaintenanceJob()

  console.log(`[Scheduler] ${scheduledTasks.length} tareas programadas`)
}

// Detener el scheduler
export function stopScheduler(): void {
  for (const task of scheduledTasks) {
    task.stop()
  }
  scheduledTasks.length = 0
  schedulerRunning = false
  console.log('[Scheduler] Detenido')
}

// Programar checks para todas las fuentes activas
async function scheduleCheckJobs(): Promise<void> {
  const fuentes = await db.fuenteEstado.findMany({
    where: { activo: true },
    include: { medio: true },
  })

  if (fuentes.length === 0) {
    console.log('[Scheduler] No hay fuentes activas para programar')
    return
  }

  let scheduledCount = 0

  for (const fuente of fuentes) {
    try {
      const count = scheduleFuente(fuente)
      scheduledCount += count
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      console.warn(`[Scheduler] Error programando ${fuente.medio.nombre}: ${msg}`)
    }
  }

  console.log(`[Scheduler] Programados checks para ${fuentes.length} fuentes (${scheduledCount} tareas)`)
}

// Programar checks para una fuente individual
function scheduleFuente(
  fuente: {
    id: string
    medioId: string
    medio: {
      nombre: string
      categoria: string
      nivel: string
      frecuenciaOverride: string
    }
    frecuenciaActual: string
    frecuenciaBase: string
    horasPublicacion: string
    horariosOptimos: string
  },
): number {
  // 1. Calcular frecuencia efectiva
  const { efectiva } = getFrecuenciaEfectiva(
    fuente.frecuenciaBase,
    fuente.frecuenciaActual,
    fuente.medio.frecuenciaOverride || null,
  )

  // 2. Numero de chequeos por dia segun frecuencia
  const numChecks = frecuenciaToChecksDia(efectiva)
  if (numChecks <= 0) {
    // Frecuencia semanal: no programar check diario (manejo especial)
    // Programar un check diario como fallback hasta que se implemente dia-semana
    scheduleSingleCheck(fuente, 0, 9) // 09:00 AM como fallback semanal
    return 1
  }

  // 3. Calcular horarios optimos
  let horarios: number[]
  try {
    const histograma = JSON.parse(fuente.horasPublicacion || '{}')
    horarios = calcularHorariosOptimos(histograma, numChecks)
  } catch {
    // Histograma corrupto, usar horarios por defecto
    const defaults = getHorariosDefault(fuente.medio.nombre, '')
    horarios = defaults || distribuirFallback(numChecks)
  }

  // 4. Guardar horarios calculados en DB (async, no bloquear)
  db.fuenteEstado.update({
    where: { id: fuente.id },
    data: { horariosOptimos: JSON.stringify(horarios) },
  }).catch(() => {})

  // 5. Programar tareas con node-cron
  const prioridad = fuente.medio.nivel === '1' ? 1 : 3

  for (const hora of horarios) {
    scheduleSingleCheck(fuente, prioridad, hora)
  }

  return horarios.length
}

// Programar un check individual con proteccion contra duplicados
function scheduleSingleCheck(
  fuente: { id: string; medioId: string; medio: { nombre: string } },
  prioridad: number,
  hora: number,
): void {
  const expresion = `0 ${hora} * * *`

  if (!cron.validate(expresion)) {
    console.warn(`[Scheduler] Expresion cron invalida: ${expresion} para ${fuente.medio.nombre}`)
    return
  }

  const task = cron.schedule(expresion, async () => {
    try {
      // Proteccion 1: verificar que no haya un check reciente
      const ultimoCheck = await db.fuenteEstado.findUnique({
        where: { id: fuente.id },
        select: { ultimoCheck: true },
      })

      if (ultimoCheck?.ultimoCheck) {
        const minutosDesdeUltimo = (Date.now() - ultimoCheck.ultimoCheck.getTime()) / 60000
        if (minutosDesdeUltimo < CHECK_FIRST_CONFIG.minTimeBetweenChecks) {
          return // Ya se checkeo hace menos de 30 min
        }
      }

      // Proteccion 2: verificar que no haya un job pendiente para esta fuente
      const pendingJob = await db.job.findFirst({
        where: {
          tipo: 'check_fuente',
          estado: 'pendiente',
          payload: { contains: fuente.id },
        },
      })

      if (pendingJob) {
        return // Ya hay un check pendiente
      }

      // Proteccion 3: verificar limite de cola
      const pendingCount = await db.job.count({ where: { estado: 'pendiente' } })
      if (pendingCount >= QUEUE_LIMITS.maxPendingJobs) {
        return // Cola saturada
      }

      // Encolar check
      await enqueue({
        tipo: 'check_fuente',
        prioridad: prioridad as 0 | 1 | 3 | 5 | 7 | 9,
        payload: {
          fuenteId: fuente.id,
          medioId: fuente.medioId,
        },
      })

      console.log(`[Scheduler] Check encolado para ${fuente.medio.nombre} (${formatCronHuman(expresion)})`)
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      console.error(`[Scheduler] Error en tarea ${fuente.medio.nombre}: ${msg}`)
    }
  })

  scheduledTasks.push(task)
}

// Programar generacion de boletines ONION200
function scheduleBoletinJobs(): void {
  const entries = getBoletinCronEntries()

  for (const entry of entries) {
    if (!cron.validate(entry.expresion)) continue

    const task = cron.schedule(entry.expresion, async () => {
      try {
        const pendingCount = await db.job.count({ where: { estado: 'pendiente' } })
        if (pendingCount >= QUEUE_LIMITS.maxPendingJobs) return

        await enqueue({
          tipo: 'generar_boletin',
          prioridad: entry.prioridad as 0 | 1 | 3 | 5 | 7 | 9,
          payload: {
            tipoBoletin: entry.tipo,
            programado: true,
          },
        })

        console.log(`[Scheduler] Boletin ${entry.tipo} encolado (${formatCronHuman(entry.expresion)})`)
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        console.error(`[Scheduler] Error en boletin ${entry.tipo}: ${msg}`)
      }
    })

    scheduledTasks.push(task)
  }

  console.log(`[Scheduler] Programados ${entries.length} boletines ONION200`)
}

// Programar mantenimiento nocturno (04:00 AM todos los dias)
function scheduleMaintenanceJob(): void {
  const entry = getMantenimientoCronEntry()

  const task = cron.schedule(entry.expresion, async () => {
    try {
      await enqueue({
        tipo: 'mantenimiento',
        prioridad: 9,
        payload: {
          tareas: [
            'recalcular_horarios',
            'degradar_fuentes',
            'limpiar_jobs',
          ],
        },
      })

      console.log('[Scheduler] Mantenimiento nocturno encolado')
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      console.error(`[Scheduler] Error en mantenimiento: ${msg}`)
    }
  })

  scheduledTasks.push(task)
  console.log('[Scheduler] Mantenimiento nocturno programado (04:00 AM)')
}

// Obtener resumen de tareas programadas (para dashboard)
export function getSchedulerStatus(): {
  running: boolean
  totalTasks: number
  tasks: { expresion: string; humana: string }[]
} {
  return {
    running: schedulerRunning,
    totalTasks: scheduledTasks.length,
    tasks: scheduledTasks.map(task => {
      // node-cron no expone la expresion directamente, pero podemos inferirla
      // del getHumanReadable si esta disponible
      const options = (task as unknown as { getOptions?: () => { expression: string } }).getOptions?.()
      const expression = options?.expression || 'unknown'
      return {
        expresion: expression,
        humana: formatCronHuman(expression),
      }
    }),
  }
}

// Reprogramar todas las fuentes (para cuando se cambia configuracion)
export async function rescheduleAll(): Promise<void> {
  console.log('[Scheduler] Reprogramando todas las fuentes...')

  // Detener tareas existentes
  stopScheduler()
  schedulerRunning = true // mantener flag

  // Re-programar
  await scheduleCheckJobs()
  scheduleBoletinJobs()
  scheduleMaintenanceJob()

  console.log(`[Scheduler] Reprogramacion completa: ${scheduledTasks.length} tareas`)
}

// Helper: distribucion fallback
function distribuirFallback(numChecks: number): number[] {
  const ventana = { inicio: 6, fin: 22 }
  const rango = ventana.fin - ventana.inicio
  const paso = rango / (numChecks + 1)
  return Array.from({ length: numChecks }, (_, i) =>
    Math.round(ventana.inicio + paso * (i + 1)),
  )
}
