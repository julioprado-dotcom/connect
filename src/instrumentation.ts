// Instrumentacion del servidor — DECODEX Bolivia
// Se ejecuta UNA VEZ al arrancar Next.js
// Inicia: Job System (worker, scheduler, health) + GeneratorScheduler + reclaim huérfanos
// + Verificación de integridad de DB

let setupDone = false

export async function register() {
  if (setupDone) return

  try {
    // 0. Auto-recovery: diagnosticar DB y recovery si está degradada
    const { ejecutarAutoRecovery } = await import('@/lib/auto-recovery')
    const recovery = await ejecutarAutoRecovery()
    if (recovery.ejecutado) {
      console.log(
        `[Instrumentation] Auto-recovery ejecutado: ${recovery.acciones.join(', ')}`
      )
    }
    const { db } = await import('@/lib/db')
    const dbPath = (process.env.DATABASE_URL || '').replace(/^file:/, '')
    console.log(
      `[Instrumentation] DB: "${dbPath}" — ` +
      `${recovery.diagnostico.conteos.personas} personas, ` +
      `${recovery.diagnostico.conteos.medios} medios, ` +
      `${recovery.diagnostico.conteos.fuentes} fuentes, ` +
      `${recovery.diagnostico.conteos.ejes} ejes`
    )

    // 1. Iniciar Job System (worker, scheduler, health monitor)
    const { initJobSystem } = await import('@/lib/jobs')
    await initJobSystem()

    // 2. Reclaim jobs huerfanos (en_progreso > 10 min sin respuesta)
    const { reclaimOrphanJobs } = await import('@/lib/jobs/queue')
    const reclaimed = await reclaimOrphanJobs()
    if (reclaimed > 0) {
      console.log(`[Instrumentation] Reclaim: ${reclaimed} jobs huerfanos recuperados`)
    }

    // 3. Iniciar GeneratorScheduler (productos programados: Termometro, Saldo, Foco, Radar, Especializado)
    const { getScheduler } = await import('@/lib/scheduler/generator-scheduler')
    const scheduler = getScheduler()
    scheduler.start()

    setupDone = true
    console.log('[Instrumentation] Job System + GeneratorScheduler iniciados')
  } catch (error) {
    console.error('[Instrumentation] Error en inicio:', error)
  }
}
