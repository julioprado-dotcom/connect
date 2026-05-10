// Instrumentacion del servidor — DECODEX Bolivia
// Se ejecuta UNA VEZ al arrancar Next.js
// Flujo de arranque:
//   1. Process Handlers (safety net contra uncaughtException)
//   2. AutoRecovery (DB diagnostics + seed)
//   3. Job System en modo IDLE (worker polling sin ejecutar, health, guardian)
//   4. Reclaim jobs huérfanos
//   5. WARMUP (2 min de estabilización — scheduler y worker NO ejecutan)
//   6. Activar modo productivo (scheduler + worker ejecutando jobs)
//   7. GeneratorScheduler (productos programados)

import { registerProcessHandlers } from '@/lib/process-handlers'
import { WARMUP_CONFIG } from '@/lib/jobs/constants'

let setupDone = false

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function register() {
  if (setupDone) return

  try {
    // 0. Safety net: capturar errores que escapen de todas las capas de try/catch
    registerProcessHandlers()

    // 1. Auto-recovery: diagnosticar DB y recovery si está degradada
    const { ejecutarAutoRecovery } = await import('@/lib/auto-recovery')
    const recovery = await ejecutarAutoRecovery()
    if (recovery.ejecutado) {
      console.log(
        `[Instrumentation] Auto-recovery ejecutado: ${recovery.acciones.join(', ')}`
      )
    }
    // Verificar conteos reales POST-recovery
    const { db } = await import('@/lib/db')
    const [personas, medios, fuentes, ejes, indicadores] = await Promise.all([
      db.persona.count(), db.medio.count(), db.fuenteEstado.count(),
      db.ejeTematico.count(), db.indicador.count(),
    ])
    const dbPath = (process.env.DATABASE_URL || '').replace(/^file:/, '')
    console.log(
      `[Instrumentation] DB: "${dbPath}" — ` +
      `${personas} personas, ${medios} medios, ${fuentes} fuentes, ` +
      `${ejes} ejes, ${indicadores} indicadores` +
      (recovery.ejecutado ? ` [recovery: ${recovery.acciones.join('; ')}]` : '')
    )

    // 2. Iniciar Job System en modo IDLE (worker polling, health, guardian — SIN scheduler)
    const { initJobSystem } = await import('@/lib/jobs')
    await initJobSystem()

    // 3. Reclaim jobs huérfanos (en_progreso > 10 min sin respuesta)
    const { reclaimOrphanJobs } = await import('@/lib/jobs/queue')
    const reclaimed = await reclaimOrphanJobs()
    if (reclaimed > 0) {
      console.log(`[Instrumentation] Reclaim: ${reclaimed} jobs huerfanos recuperados`)
    }

    // 4. WARMUP — esperar estabilización del servidor
    console.log(
      `[Instrumentation] Warmup: esperando ${WARMUP_CONFIG.delayMs / 1000}s ` +
      `para estabilización del servidor...`
    )
    await sleep(WARMUP_CONFIG.delayMs)
    console.log('[Instrumentation] Warmup completado')

    // 5. Activar modo productivo (scheduler + worker ejecutando jobs)
    const { activateProductiveMode } = await import('@/lib/jobs')
    await activateProductiveMode()

    // 6. Iniciar GeneratorScheduler (productos programados: Termometro, Saldo, Foco, Radar, Especializado)
    const { getScheduler } = await import('@/lib/scheduler/generator-scheduler')
    const genScheduler = getScheduler()
    genScheduler.start()

    setupDone = true
    console.log('[Instrumentation] Sistema completo iniciado (productivo)')
  } catch (error) {
    console.error('[Instrumentation] Error en inicio:', error)
  }
}
