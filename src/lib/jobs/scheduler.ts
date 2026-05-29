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
import { determinarCapa, descripcionCapa, evaluarDegradacionMasiva } from './source-lifecycle'

// ─── Timezone: todos los cron jobs usan hora de Bolivia ──────────────
const CRON_OPTS = { scheduled: true, timezone: 'America/La_Paz' }

// ─── Estado compartido via globalThis ──────────────────────────────
// IMPORTANTE: En Next.js con Turbopack, instrumentation.ts y los API routes
// corren en contextos de modulo diferentes. Por eso usamos globalThis
// (igual que worker.ts) para compartir estado entre contextos.

interface SchedulerGlobalState {
  running: boolean
  tasks: ScheduledTask[]
}

const _gs = globalThis as unknown as { __decodex_scheduler__: SchedulerGlobalState | undefined }

function getState(): SchedulerGlobalState {
  if (!_gs.__decodex_scheduler__) {
    _gs.__decodex_scheduler__ = { running: false, tasks: [] }
  }
  return _gs.__decodex_scheduler__
}

// Iniciar el scheduler (llamar una sola vez)
export async function startScheduler(): Promise<void> {
  const state = getState()
  if (state.running) {
    console.log('[Scheduler] Ya esta corriendo')
    return
  }
  state.running = true

  console.log('[Scheduler] Iniciando programacion de jobs...')

  // 1. Programar checks de fuentes
  await scheduleCheckJobs()

  // 2. Programar captura de indicadores Tier 1
  await scheduleIndicatorJobs()

  // 3. Programar generacion de boletines
  scheduleBoletinJobs()

  // 4. Programar mantenimiento nocturno
  scheduleMaintenanceJob()

  console.log(`[Scheduler] ${getState().tasks.length} tareas programadas`)
}

// Detener el scheduler
export function stopScheduler(): void {
  const state = getState()
  for (const task of state.tasks) {
    task.stop()
  }
  state.tasks.length = 0
  state.running = false
  console.log('[Scheduler] Detenido')
}

// Programar checks para todas las fuentes activas (lifecycle: estado='activa')
async function scheduleCheckJobs(): Promise<void> {
  const fuentes = await db.fuenteEstado.findMany({
    where: { estado: 'activa' },
    include: { Medio: true },
  })

  if (fuentes.length === 0) {
    console.log('[Scheduler] No hay fuentes activas para programar')
    return
  }

  let scheduledCount = 0
  let omitidasPorCapa = 0

  for (const fuente of fuentes) {
    try {
      // Lifecycle check: verificar capa mínima de capacidad
      const capa = determinarCapa({
        ultimoCheckOk: fuente.ultimoCheckOk,
        ultimoHeadline: fuente.ultimoHeadline,
        ultimoTexto: fuente.ultimoTexto,
        ultimoMencion: fuente.ultimoMencion,
        estado: fuente.estado || 'creada',
        activo: fuente.activo,
        fallosConsecutivos: fuente.fallosConsecutivos || 0,
      })

      if (capa < 1) {
        // FIX: Capa 0 = fuente sin check OK reciente.
        // ANTES: Se omitía completamente (problema huevo/gallina — nunca se chequeaba).
        // AHORA: Se programa un check inicial a hora aleatoria para romper el ciclo.
        // Si el check tiene éxito, la fuente sube a Capa 1 y será programada normalmente.
        omitidasPorCapa++
        const horaInicial = Math.floor(Math.random() * 12) + 6 // 6:00 - 17:59
        console.log(
          `[Scheduler] ${fuente.Medio.nombre}: capa ${capa} (sin check OK reciente) — ` +
          `programando check inicial a las ${horaInicial}:00 para romper ciclo huevo/gallina`
        )
        scheduleSingleCheck(fuente, 1, horaInicial) // prioridad 1
      }

      const count = scheduleFuente(fuente)
      scheduledCount += count
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      console.warn(`[Scheduler] Error programando ${fuente.Medio.nombre}: ${msg}`)
    }
  }

  if (omitidasPorCapa > 0) {
    console.warn(`[Scheduler] ${omitidasPorCapa} fuentes omitidas por capa 0 (sin respuesta reciente)`)
  }
  console.log(`[Scheduler] Programados checks para ${fuentes.length} fuentes (${scheduledCount} tareas, ${omitidasPorCapa} omitidas por capa 0)`)
}

// Programar checks para una fuente individual
function scheduleFuente(
  fuente: {
    id: string
    medioId: string
    Medio: {
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
    fuente.Medio.frecuenciaOverride || null,
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
    const defaults = getHorariosDefault(fuente.Medio.nombre, '')
    horarios = defaults || distribuirFallback(numChecks)
  }

  // 4. Guardar horarios calculados en DB (async, no bloquear)
  db.fuenteEstado.update({
    where: { id: fuente.id },
    data: { horariosOptimos: JSON.stringify(horarios) },
  }).catch(() => {})

  // 5. Programar tareas con node-cron
  // Los Tiempos = P0 (prioridad absoluta), resto nivel 1 = P1, otros = P3
  const domain = (fuente.Medio.nombre || '').toLowerCase().includes('tiempos') ? 'lostiempos.com' : ''
  const prioridad = domain === 'lostiempos.com' ? 0 : (fuente.Medio.nivel === '1' ? 1 : 3)

  for (const hora of horarios) {
    scheduleSingleCheck(fuente, prioridad, hora)
  }

  return horarios.length
}

// Programar un check individual con proteccion contra duplicados
function scheduleSingleCheck(
  fuente: { id: string; medioId: string; Medio: { nombre: string } },
  prioridad: number,
  hora: number,
): void {
  const expresion = `0 ${hora} * * *`

  if (!cron.validate(expresion)) {
    console.warn(`[Scheduler] Expresion cron invalida: ${expresion} para ${fuente.Medio.nombre}`)
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

      console.log(`[Scheduler] Check encolado para ${fuente.Medio.nombre} (${formatCronHuman(expresion)})`)
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      console.error(`[Scheduler] Error en tarea ${fuente.Medio.nombre}: ${msg}`)
    }
  }, CRON_OPTS)

  getState().tasks.push(task)
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

        const productType = entry.tipoBoletin || entry.tipo
        await enqueue({
          tipo: 'generar_boletin',
          prioridad: entry.prioridad as 0 | 1 | 3 | 5 | 7 | 9,
          payload: {
            tipoBoletin: productType,
            programado: true,
          },
        })

        console.log(`[Scheduler] Boletin ${productType} encolado (${formatCronHuman(entry.expresion)})`)
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        console.error(`[Scheduler] Error en boletin ${entry.tipo}: ${msg}`)
      }
    }, CRON_OPTS)

    getState().tasks.push(task)
  }

  console.log(`[Scheduler] Programados ${entries.length} boletines ONION200`)
}

// Programar captura de indicadores Tier 1 (08:00 AM todos los dias)
async function scheduleIndicatorJobs(): Promise<void> {
  // Verificar que haya indicadores Tier 1 en la DB
  const indicadoresTier1 = await db.indicador.count({
    where: { activo: true, tier: 1 },
  })

  if (indicadoresTier1 === 0) {
    console.log('[Scheduler] No hay indicadores Tier 1 para programar')
    return
  }

  // Captura batch Tier 1: una vez al día (08:00 AM Bolivia)
  const expresion = '0 8 * * *'

  if (!cron.validate(expresion)) return

  const task = cron.schedule(expresion, async () => {
    try {
      // Proteccion: no encolar si ya hay un capture pendiente
      const pendingCapture = await db.job.findFirst({
        where: {
          tipo: 'capture_indicador',
          estado: 'pendiente',
        },
      })

      if (pendingCapture) {
        console.log('[Scheduler] capture_indicador ya pendiente, saltando')
        return
      }

      // Proteccion: verificar que no se haya capturado en las ultimas 23 horas
      const reciente = new Date()
      reciente.setHours(reciente.getHours() - 23)

      const recentCapture = await db.job.findFirst({
        where: {
          tipo: 'capture_indicador',
          estado: 'completado',
          fechaFin: { gte: reciente },
        },
      })

      if (recentCapture) {
        console.log(`[Scheduler] capture_indicador ejecutado recientemente (${recentCapture.fechaFin?.toISOString()}), saltando`)
        return
      }

      await enqueue({
        tipo: 'capture_indicador',
        prioridad: 3,
        payload: { capturarTodos: true },
      })

      console.log(`[Scheduler] capture_indicador (Tier 1 batch) encolado (${formatCronHuman(expresion)})`)
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      console.error(`[Scheduler] Error en captura indicadores: ${msg}`)
    }
  }, CRON_OPTS)

  getState().tasks.push(task)
  console.log(`[Scheduler] Captura indicadores Tier 1 programada diaria 08:00 Bolivia (${formatCronHuman(expresion)}) — ${indicadoresTier1} indicadores activos`)
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
            'degradar_fuentes',
            'recalcular_horarios',
            'recalcular_scheduler',
            'limpiar_jobs',
          ],
        },
      })

      console.log('[Scheduler] Mantenimiento nocturno encolado')
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      console.error(`[Scheduler] Error en mantenimiento: ${msg}`)
    }
  }, CRON_OPTS)

  getState().tasks.push(task)
  console.log('[Scheduler] Mantenimiento nocturno programado (04:00 AM Bolivia)')
}

// Obtener resumen de tareas programadas (para dashboard)
export function getSchedulerStatus(): {
  running: boolean
  totalTasks: number
  tasks: { expresion: string; humana: string }[]
} {
  const state = getState()
  return {
    running: state.running,
    totalTasks: state.tasks.length,
    tasks: state.tasks.map(task => {
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
  getState().running = true // mantener flag

  // Re-programar
  await scheduleCheckJobs()
  await scheduleIndicatorJobs()
  scheduleBoletinJobs()
  scheduleMaintenanceJob()

  console.log(`[Scheduler] Reprogramacion completa: ${getState().tasks.length} tareas`)
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
