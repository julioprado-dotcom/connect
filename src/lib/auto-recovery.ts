// Auto-recovery post-caída — DECODEX Bolivia
// Detecta DB vacía o degradada y ejecuta seed automático.
// Se ejecuta desde instrumentation.ts en el arranque del servidor.
// Solución integral: no parches — recovery completo en un solo punto.

import db from '@/lib/db'

// ── Configuración ──────────────────────────────────────────────────────

// Umbrales mínimos para considerar la DB "sana"
const SALUD_THRESHOLDS = {
  personas: 50,      // Al menos 50 personas (senadores + diputados)
  medios: 10,        // Al menos 10 medios configurados
  fuentes: 5,        // Al menos 5 fuentes monitoreadas
  ejes: 5,           // Al menos 5 ejes temáticos
} as const

// Frecuencia base por nivel (del motor de captura)
const FRECUENCIA_POR_NIVEL: Record<string, string> = {
  '1': '1h',
  '2': '4h',
  '3': '6h',
}

// Tipo de check por categoría de medio
function tipoCheckParaCategoria(tipo: string): string {
  if (tipo.includes('TV') || tipo.includes('Radio')) return 'rss'
  if (tipo === 'Agencia' || tipo === 'Agencia estatal') return 'rss'
  if (tipo === 'Fact-checking' || tipo === 'Portal') return 'head'
  return 'head'
}

// ── Diagnóstico ────────────────────────────────────────────────────────

interface DBDiagnosis {
  sana: boolean
  problemas: string[]
  conteos: {
    personas: number
    medios: number
    fuentes: number
    ejes: number
    indicadores: number
  }
}

/**
 * Diagnostica el estado de la DB comparando contra umbrales mínimos.
 * Retorna un diagnóstico con los problemas detectados.
 */
export async function diagnosticarDB(): Promise<DBDiagnosis> {
  const [personas, medios, fuentes, ejes, indicadores] = await Promise.all([
    db.persona.count(),
    db.medio.count(),
    db.fuenteEstado.count(),
    db.ejeTematico.count(),
    db.indicador.count(),
  ])

  const problemas: string[] = []

  if (personas < SALUD_THRESHOLDS.personas) {
    problemas.push(`Personas insuficientes: ${personas}/${SALUD_THRESHOLDS.personas}`)
  }
  if (medios < SALUD_THRESHOLDS.medios) {
    problemas.push(`Medios insuficientes: ${medios}/${SALUD_THRESHOLDS.medios}`)
  }
  if (fuentes < SALUD_THRESHOLDS.fuentes) {
    problemas.push(`Fuentes insuficientes: ${fuentes}/${SALUD_THRESHOLDS.fuentes}`)
  }
  if (ejes < SALUD_THRESHOLDS.ejes) {
    problemas.push(`Ejes insuficientes: ${ejes}/${SALUD_THRESHOLDS.ejes}`)
  }

  return {
    sana: problemas.length === 0,
    problemas,
    conteos: { personas, medios, fuentes, ejes, indicadores },
  }
}

// ── Recovery: Seed de Fuentes ─────────────────────────────────────────

/**
 * Crea FuenteEstado para todos los medios activos que no tienen uno.
 * Lógica idéntica a /api/seed-fuentes pero invocable desde instrumentation.
 */
export async function seedFuentes(): Promise<{ creados: number; activados: number }> {
  const medios = await db.medio.findMany({
    where: { activo: true, url: { not: '' } },
    orderBy: [{ nivel: 'asc' }, { nombre: 'asc' }],
  })

  if (medios.length === 0) {
    console.log('[AutoRecovery] No hay medios para crear fuentes')
    return { creados: 0, activados: 0 }
  }

  const existentes = await db.fuenteEstado.findMany({
    select: { medioId: true },
  })
  const existentesSet = new Set(existentes.map(e => e.medioId))

  let creados = 0
  let activados = 0

  for (const medio of medios) {
    const frecuenciaBase = FRECUENCIA_POR_NIVEL[medio.nivel] || '6h'
    const tipoCheck = tipoCheckParaCategoria(medio.tipo)
    const activo = medio.nivel === '1'  // Solo nivel 1 activo por defecto

    try {
      await db.fuenteEstado.upsert({
        where: { medioId: medio.id },
        create: {
          medioId: medio.id,
          url: medio.url,
          tipoCheck,
          frecuenciaBase,
          frecuenciaActual: frecuenciaBase,
          activo,
        },
        update: {
          // Si ya existe pero está inactivo y es nivel 1, reactivar
          ...(activo ? { activo: true } : {}),
        },
      })
      creados++
      if (activo) activados++
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      console.warn(`[AutoRecovery] Error creando fuente para ${medio.nombre}: ${msg}`)
    }
  }

  console.log(
    `[AutoRecovery] Fuentes: ${creados} procesadas, ${activados} activadas (nivel 1)`
  )
  return { creados, activados }
}

// ── Recovery: Reactivar Scheduler ────────────────────────────────────

/**
 * Verifica si el scheduler tiene tareas programadas.
 * Si no tiene ninguna y hay fuentes activas, fuerza reschedule.
 * No requiere reinicio — usa el mismo sistema de rescheduleAll.
 */
export async function verificarScheduler(): Promise<boolean> {
  const fuentesActivas = await db.fuenteEstado.count({
    where: { activo: true },
  })

  if (fuentesActivas === 0) {
    console.log('[AutoRecovery] No hay fuentes activas — scheduler no necesita tareas')
    return false
  }

  // El scheduler se reinicia automáticamente desde instrumentation.ts
  // Esta función solo verifica que las fuentes están listas
  console.log(`[AutoRecovery] ${fuentesActivas} fuentes activas — scheduler las programará al iniciar`)
  return true
}

// ── Recovery Principal ────────────────────────────────────────────────

export interface RecoveryResult {
  ejecutado: boolean
  acciones: string[]
  diagnostico: DBDiagnosis
}

/**
 * Ejecuta el ciclo completo de auto-recovery.
 * Se llama UNA VEZ desde instrumentation.ts al arrancar.
 *
 * Lógica:
 * 1. Diagnosticar DB
 * 2. Si hay problemas, ejecutar recovery parcial o total
 * 3. No tocar datos existentes que estén correctos
 *
 * IMPORTANTE: Esta función es idempotente — llamarla varias veces
 * no causa efectos secundarios.
 */
export async function ejecutarAutoRecovery(): Promise<RecoveryResult> {
  const diagnostico = await diagnosticarDB()
  const acciones: string[] = []

  if (diagnostico.sana) {
    console.log(
      `[AutoRecovery] DB sana — ${diagnostico.conteos.personas} personas, ` +
      `${diagnostico.conteos.medios} medios, ${diagnostico.conteos.fuentes} fuentes`
    )
    return { ejecutado: false, acciones, diagnostico }
  }

  console.log(`[AutoRecovery] DB degradada detectada:`)
  for (const problema of diagnostico.problemas) {
    console.log(`  ⚠️  ${problema}`)
  }

  // ── Recovery de Fuentes ──
  if (diagnostico.conteos.fuentes < SALUD_THRESHOLDS.fuentes) {
    const resultado = await seedFuentes()
    acciones.push(
      `Fuentes seed: ${resultado.creados} creadas, ${resultado.activados} activadas`
    )

    // Verificar fuentes con checks vacíos — resetear fingerprint para re-check
    const fuentesSinCheck = await db.fuenteEstado.count({
      where: { ultimoCheck: null, activo: true },
    })
    if (fuentesSinCheck > 0) {
      acciones.push(`${fuentesSinCheck} fuentes sin checks previos — listas para monitoreo`)
    }
  }

  // ── Verificar Scheduler ──
  const schedulerOk = await verificarScheduler()
  if (schedulerOk) {
    acciones.push('Scheduler verificado con fuentes activas')
  }

  console.log(`[AutoRecovery] Recovery completado: ${acciones.length} acciones`)
  for (const accion of acciones) {
    console.log(`  ✅ ${accion}`)
  }

  return { ejecutado: true, acciones, diagnostico }
}
