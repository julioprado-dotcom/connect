// Source Lifecycle Engine — DECODEX Bolivia v0.15.0
// Motor de ciclo de vida de fuentes por capas de capacidad demostrada.
//
// Modelo de capas:
//   Capa 0 — No responde (sin contacto)
//   Capa 1 — Check-First OK (cadencia/health funcional)
//   Capa 2 — Headlines/URLs extraídos (resonancia/amplificación)
//   Capa 3 — Extracción de texto completo
//   Capa 4 — Clasificación LLM + menciones creadas
//
// Ciclo de vida:
//   creada → validando → activa → inactiva → deprecada
//
// Principio: activo = capacidad demostrada, no configuración.

import db from '@/lib/db'

// ── Tipos ────────────────────────────────────────────────────────────

/** Capa de capacidad demostrada de una fuente */
export type CapaFuente = 0 | 1 | 2 | 3 | 4

/** Estado del ciclo de vida */
export type EstadoFuente = 'creada' | 'validando' | 'activa' | 'inactiva' | 'deprecada'

/** Resultado de la evaluación de degradación */
export interface DegradacionResult {
  degradada: boolean
  accion: string | null          // Descripción de la acción tomada
  estadoAnterior: EstadoFuente
  estadoNuevo: EstadoFuente | null
  capaAnterior: CapaFuente
  capaNueva: CapaFuente
}

/** Datos mínimos de una fuente para calcular capa (sin necesidad de query completa) */
export interface FuenteCapacidadData {
  ultimoCheckOk: Date | null
  ultimoHeadline: Date | null
  ultimoTexto: Date | null
  ultimoMencion: Date | null
  estado: string
  activo: boolean
  fallosConsecutivos: number
  checksSinCambio?: number
  totalChecks?: number  // FIX: Fuente con checks previos = capacidad demostrada
}

// ── Umbrales de tiempo ───────────────────────────────────────────────

const UMBRALES = {
  /** Si no hay check OK en este tiempo, la fuente baja a capa 0 */
  CHECK_OK_FRESHNESS_MS: 72 * 60 * 60 * 1000,     // 72 horas (3 días — tolerancia para entornos con paradas frecuentes)
  /** Advertencia si check OK fue hace más de esto (no degrada, solo warn) */
  CHECK_OK_WARNING_MS: 96 * 60 * 60 * 1000,       // 96 horas (4 días — warn antes de degradar a capa 0)
  /** Fallos consecutivos para desactivar automáticamente */
  FALLOS_PARA_INACTIVAR: 5,  // FIX: Aumentado de 3 a 5. En VPS con 2GB RAM,
  // los HTTP requests fallan frecuentemente por saturación del sistema
  // (event loop lag, memory pressure), no porque la fuente esté caída.
  // 5 fallos da más margen para distinguir fuente caída vs sistema saturado.
  /** Días inactiva antes de degradar a deprecada */
  DIAS_PARA_DEPRECADA: 30,
} as const

// ── Determinar capa de capacidad ─────────────────────────────────────

/**
 * Determina la capa de capacidad demostrada de una fuente basándose
 * en evidencia (timestamps), no en configuración.
 *
 * La capa se calcula de manera progresiva: cada timestamp exitoso
 * demuestra que la fuente es capaz de producir valor en ese nivel.
 *
 * Los timestamps se consideran "recientes" si están dentro del umbral
 * de frescura. Si un timestamp es antiguo (>24h), no demuestra capacidad actual.
 */
export function determinarCapa(fuente: FuenteCapacidadData): CapaFuente {
  const now = Date.now()

  // Capa 0: Sin check exitoso reciente Y sin historial
  // FIX: Si la fuente tiene totalChecks > 0, ya demostró capacidad antes.
  // No mandarla a capa 0 por un ultimoCheckOk viejo — eso crea un círculo vicioso
  // donde capa 0 → solo probe a las 0-4 AM → probe falla → nunca se recupera.
  // Fuentes con historial reciben capa mínima 1 para que el scheduler las programe normally.
  const tieneHistorial = (fuente.totalChecks || 0) > 0

  if (!fuente.ultimoCheckOk) {
    return tieneHistorial ? 1 : 0
  }
  const checkOkMs = now - new Date(fuente.ultimoCheckOk).getTime()
  if (checkOkMs > UMBRALES.CHECK_OK_FRESHNESS_MS) {
    return tieneHistorial ? 1 : 0
  }

  // Capa 1: Check-First OK reciente (ya validado arriba)
  if (!fuente.ultimoHeadline) {
    return 1
  }

  // Capa 2: Headlines extraídos recientemente
  const headlineMs = now - new Date(fuente.ultimoHeadline).getTime()
  if (headlineMs > UMBRALES.CHECK_OK_FRESHNESS_MS) {
    return 1 // Check OK pero sin headlines recientes
  }

  // Capa 3: Texto extraído recientemente
  if (!fuente.ultimoTexto) {
    return 2
  }
  const textoMs = now - new Date(fuente.ultimoTexto).getTime()
  if (textoMs > UMBRALES.CHECK_OK_FRESHNESS_MS) {
    return 2 // Headlines OK pero sin texto reciente
  }

  // Capa 4: Menciones creadas recientemente (valor máximo)
  if (!fuente.ultimoMencion) {
    return 3
  }
  const mencionMs = now - new Date(fuente.ultimoMencion).getTime()
  if (mencionMs > UMBRALES.CHECK_OK_FRESHNESS_MS) {
    return 3 // Texto OK pero sin menciones recientes
  }

  return 4
}

/**
 * Retorna un string descriptivo de la capa.
 */
export function descripcionCapa(capa: CapaFuente): string {
  const descripciones: Record<CapaFuente, string> = {
    0: 'Sin respuesta',
    1: 'Check-First OK (cadencia/health)',
    2: 'Headlines/URLs (resonancia)',
    3: 'Extracción de texto',
    4: 'Clasificación LLM + menciones',
  }
  return descripciones[capa]
}

// ── Evaluación de degradación ────────────────────────────────────────

/**
 * Evalúa si una fuente debe ser degradada según las reglas de transición.
 *
 * Reglas automáticas (de la HOJA_DE_RUTA secciones 3.5-3.6):
 *   - 3 checks fallidos seguidos → inactiva
 *   - ultimoCheckOk > 48h y estado = activa → advertencia (no desactiva — capa 1-2 sigue siendo útil)
 *   - Inactiva > 30 días → deprecada
 *   - Fuente validando que falla su primer check → queda en validando (no se promueve)
 *
 * IMPORTANTE: Solo la capa 0 (no responde de forma consistente) justifica
 * desactivación. Las capas 1 y 2 NO son estériles — aportan cadencia y headlines.
 */
export function evaluarDegradacion(fuente: FuenteCapacidadData): DegradacionResult {
  const capaAnterior = determinarCapa(fuente) as CapaFuente
  const estadoAnterior = (fuente.estado || 'creada') as EstadoFuente
  let accion: string | null = null
  let estadoNuevo: EstadoFuente | null = null
  let degradada = false

  // ── Regla 1: 3 fallos consecutivos → inactiva ──
  if (fuente.fallosConsecutivos >= UMBRALES.FALLOS_PARA_INACTIVAR) {
    if (estadoAnterior === 'activa' || estadoAnterior === 'validando') {
      estadoNuevo = 'inactiva'
      accion = `Desactivada automáticamente: ${fuente.fallosConsecutivos} fallos consecutivos`
      degradada = true
      console.warn(
        `[Lifecycle] Fuente degradada a "inactiva": ${fuente.fallosConsecutivos} fallos consecutivos`
      )
    }
  }

  // ── Regla 2: Inactiva > 30 días → deprecada ──
  // Solo aplica si la fuente ya está inactiva (no fue reactivada)
  if (!accion && estadoAnterior === 'inactiva' && fuente.ultimoCheckOk) {
    const diasInactiva = (Date.now() - new Date(fuente.ultimoCheckOk).getTime()) / (1000 * 60 * 60 * 24)
    if (diasInactiva > UMBRALES.DIAS_PARA_DEPRECADA) {
      estadoNuevo = 'deprecada'
      accion = `Deprecada automáticamente: ${Math.round(diasInactiva)} días sin respuesta exitosa`
      degradada = true
      console.warn(
        `[Lifecycle] Fuente degradada a "deprecada": ${Math.round(diasInactiva)} días sin check OK`
      )
    }
  }

  const capaNueva = estadoNuevo
    ? 0 // Fuente degradada siempre va a capa 0
    : capaAnterior

  return {
    degradada,
    accion,
    estadoAnterior,
    estadoNuevo,
    capaAnterior,
    capaNueva: capaNueva as CapaFuente,
  }
}

// ── Registro de resultados de check ──────────────────────────────────

/**
 * Registra el resultado de un check-first y ejecuta transiciones de lifecycle.
 *
 * Esta es la función principal que deben llamar los runners/checkers después
 * de cada intento de check. Se encarga de:
 *   1. Actualizar fallosConsecutivos (incrementar en fallo, resetear en éxito)
 *   2. Calcular la nueva capa de capacidad
 *   3. Evaluar degradación
 *   4. Aplicar cambios a la DB si hay degradación
 *   5. Promover validando → activa si el check fue exitoso
 *
 * @param fuenteId ID de la FuenteEstado
 * @param exito true si al menos una estrategia de check-first tuvo éxito
 * @returns Resultado de la evaluación de lifecycle
 */
export async function registrarResultadoCheck(
  fuenteId: string,
  exito: boolean,
): Promise<{
  capa: CapaFuente
  degradacion: DegradacionResult | null
  promovida: boolean
}> {
  const fuente = await db.fuenteEstado.findUnique({
    where: { id: fuenteId },
  })

  if (!fuente) {
    console.error(`[Lifecycle] FuenteEstado ${fuenteId} no encontrada para registrar resultado`)
    return { capa: 0, degradacion: null, promovida: false }
  }

  const estadoActual = (fuente.estado || 'creada') as EstadoFuente
  const fallosAntes = fuente.fallosConsecutivos || 0

  // 1. Actualizar fallos consecutivos
  const nuevosFallos = exito ? 0 : fallosAntes + 1

  // 2. Calcular capa con datos actualizados
  const fuenteData: FuenteCapacidadData = {
    ultimoCheckOk: exito ? new Date() : fuente.ultimoCheckOk,
    ultimoHeadline: fuente.ultimoHeadline,
    ultimoTexto: fuente.ultimoTexto,
    ultimoMencion: fuente.ultimoMencion,
    estado: estadoActual,
    activo: fuente.activo,
    fallosConsecutivos: nuevosFallos,
    totalChecks: (fuente.totalChecks || 0) + 1,  // Se incrementa con este check
  }
  const nuevaCapa = determinarCapa(fuenteData)

  // 3. Evaluar degradación
  const degradacion = evaluarDegradacion(fuenteData)

  // 4. Promoción: validando/creada → activa si check fue exitoso
  let promovida = false
  let nuevoEstado = estadoActual
  let nuevoActivo = fuente.activo

  if (exito) {
    if (estadoActual === 'validando' || estadoActual === 'creada') {
      nuevoEstado = 'activa'
      nuevoActivo = true
      promovida = true
      console.log(`[Lifecycle] Fuente promovida de "${estadoActual}" a "activa" (check OK)`)
    } else if (estadoActual === 'inactiva') {
      // Reactivación: si estaba inactiva y ahora responde, reactivar
      nuevoEstado = 'activa'
      nuevoActivo = true
      promovida = true
      console.log(`[Lifecycle] Fuente reactivada de "inactiva" a "activa" (check OK tras ${fallosAntes} fallos)`)
    }
  }

  // Si degradación sugiere un estado, ese tiene prioridad sobre la promoción
  if (degradacion.estadoNuevo) {
    nuevoEstado = degradacion.estadoNuevo
    nuevoActivo = false // Fuentes degradadas siempre inactivas
    if (promovida) {
      // No se puede promover y degradar al mismo tiempo — degradación gana
      promovida = false
      console.log(`[Lifecycle] Promoción cancelada por degradación: ${degradacion.accion}`)
    }
  }

  // 5. Aplicar cambios a la DB
  const updates: Record<string, unknown> = {
    fallosConsecutivos: nuevosFallos,
    capaActual: nuevaCapa,
  }

  // Solo actualizar estado/activo si cambiaron
  if (nuevoEstado !== estadoActual) {
    updates.estado = nuevoEstado
  }
  if (nuevoActivo !== fuente.activo) {
    updates.activo = nuevoActivo
  }

  // Solo hacer update si hay algo que cambiar
  if (Object.keys(updates).length > 0) {
    await db.fuenteEstado.update({
      where: { id: fuenteId },
      data: updates,
    })
  }

  return {
    capa: nuevaCapa,
    degradacion: degradacion.degradada ? degradacion : null,
    promovida,
  }
}

// ── Evaluación masiva de degradación ─────────────────────────────────

/**
 * Evalúa la degradación de TODAS las fuentes activas.
 * Diseñado para ser llamado periódicamente (ej: cada 6h desde el scheduler).
 *
 * Revisa todas las fuentes que no sean 'deprecada' y aplica:
 *   - Degradación por tiempo sin check OK
 *   - Transición inactiva → deprecada
 *   - Recálculo de capa
 *
 * @returns Resumen de fuentes evaluadas y degradadas
 */
export async function evaluarDegradacionMasiva(): Promise<{
  evaluadas: number
  degradadas: number
  reactivedas: number
  detalles: Array<{ fuenteId: string; nombre: string; accion: string }>
}> {
  const fuentes = await db.fuenteEstado.findMany({
    where: {
      estado: { not: 'deprecada' },
    },
    include: { Medio: { select: { nombre: true } } },
  })

  let degradadas = 0
  let reactivedas = 0
  const detalles: Array<{ fuenteId: string; nombre: string; accion: string }> = []

  for (const fuente of fuentes) {
    const fuenteData: FuenteCapacidadData = {
      ultimoCheckOk: fuente.ultimoCheckOk,
      ultimoHeadline: fuente.ultimoHeadline,
      ultimoTexto: fuente.ultimoTexto,
      ultimoMencion: fuente.ultimoMencion,
      estado: fuente.estado || 'creada',
      activo: fuente.activo,
      fallosConsecutivos: fuente.fallosConsecutivos || 0,
      checksSinCambio: fuente.checksSinCambio,
      totalChecks: fuente.totalChecks || 0,
    }

    const nuevaCapa = determinarCapa(fuenteData)
    const degradacion = evaluarDegradacion(fuenteData)

    const updates: Record<string, unknown> = { capaActual: nuevaCapa }

    if (degradacion.degradada && degradacion.estadoNuevo) {
      updates.estado = degradacion.estadoNuevo
      updates.activo = false
      degradadas++
      detalles.push({
        fuenteId: fuente.id,
        nombre: fuente.Medio.nombre,
        accion: degradacion.accion || 'Degradada',
      })
    }

    // ── Reactivación: fuentes inactivas con evidencia reciente de funcionamiento ──
    // Si una fuente fue marcada 'inactiva' pero tiene un check OK reciente
    // (dentro del umbral de frescura), reactivarla. Esto resuelve el ciclo
    // donde scheduler solo chequea 'activa' → fuentes nunca se recuperan.
    if (
      !degradacion.degradada &&
      fuente.estado === 'inactiva' &&
      fuente.ultimoCheckOk &&
      Date.now() - fuente.ultimoCheckOk.getTime() < UMBRALES.CHECK_OK_FRESHNESS_MS
    ) {
      updates.estado = 'activa'
      updates.activo = true
      updates.fallosConsecutivos = 0
      reactivedas++
      detalles.push({
        fuenteId: fuente.id,
        nombre: fuente.Medio.nombre,
        accion: 'Reactivada (check OK reciente)',
      })
    }

    // Actualizar capa en DB (siempre)
    if (nuevaCapa !== (fuente.capaActual as CapaFuente)) {
      updates.capaActual = nuevaCapa
    }

    const keysToUpdate = Object.keys(updates).filter(k => k !== 'capaActual' || updates.capaActual !== fuente.capaActual)
    if (keysToUpdate.length > 0) {
      await db.fuenteEstado.update({
        where: { id: fuente.id },
        data: updates,
      })
    }
  }

  if (degradadas > 0 || reactivedas > 0) {
    console.log(`[Lifecycle] Evaluación masiva: ${degradadas} degradadas, ${reactivedas} reactivadas de ${fuentes.length} fuentes`)
  }

  return { evaluadas: fuentes.length, degradadas, reactivedas, detalles }
}

// ── Utilidades de diagnóstico ────────────────────────────────────────

/**
 * Retorna un resumen del estado de todas las fuentes por capa.
 * Útil para el dashboard y debugging.
 */
export async function resumenFuentesPorCapa(): Promise<{
  total: number
  porCapa: Record<CapaFuente, number>
  porEstado: Record<string, number>
  degradables: number
}> {
  const fuentes = await db.fuenteEstado.findMany({
    select: {
      estado: true,
      activo: true,
      fallosConsecutivos: true,
      ultimoCheckOk: true,
      ultimoHeadline: true,
      ultimoTexto: true,
      ultimoMencion: true,
      capaActual: true,
    },
  })

  const porCapa: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 }
  const porEstado: Record<string, number> = {}
  let degradables = 0

  for (const f of fuentes) {
    const capa = determinarCapa(f as unknown as FuenteCapacidadData)
    porCapa[capa] = (porCapa[capa] || 0) + 1
    porEstado[f.estado || 'creada'] = (porEstado[f.estado || 'creada'] || 0) + 1

    if (
      (f.fallosConsecutivos || 0) >= 2 ||
      (f.ultimoCheckOk && Date.now() - new Date(f.ultimoCheckOk).getTime() > UMBRALES.CHECK_OK_WARNING_MS)
    ) {
      degradables++
    }
  }

  return {
    total: fuentes.length,
    porCapa: porCapa as Record<CapaFuente, number>,
    porEstado,
    degradables,
  }
}
