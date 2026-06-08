// Scheduler - programacion de jobs con node-cron - DECODEX Bolivia
// Conecta las 4 capas: horarios optimos -> node-cron -> enqueue jobs

import cron from 'node-cron'
import type { ScheduledTask } from 'node-cron'
import db from '@/lib/db'
import { enqueue } from './queue'
import { getFrecuenciaEfectiva, frecuenciaToChecksDia, frecuenciaToMs, getFrecuenciaBase } from './frequency/calculator'
import { calcularHorariosOptimos, getHorariosDefault } from './histogram/calculator'
import { buildCronEntries, getBoletinCronEntries, getMantenimientoCronEntry, formatCronHuman } from './histogram/cron-builder'
import { CHECK_FIRST_CONFIG, QUEUE_LIMITS, AUTODESCUBRIMIENTO_CONFIG } from './constants'
import { determinarCapa, descripcionCapa, evaluarDegradacionMasiva } from './source-lifecycle'
import { PRODUCTOS } from '@/constants/products'

// DEDICATED_ENDPOINTS: mapeo de productos a endpoints LLM dedicados
const DEDICATED_ENDPOINTS: Record<string, string> = {
  EL_TERMOMETRO: '/api/admin/bulletins/generate-termometro',
  SALDO_DEL_DIA: '/api/admin/bulletins/generate-saldo',
  EL_FOCO: '/api/admin/bulletins/generate-foco',
  EL_RADAR: '/api/admin/bulletins/generate-radar',
  BOLETIN_DEL_GRANO: '/api/admin/bulletins/generate-boletin-grano',
  FICHA_LEGISLADOR: '/api/admin/bulletins/generate-ficha',
}

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

  // 0. GAP DETECTOR: detectar downtime y recuperar fuentes/capturas perdidas
  await detectarYRecuperarGap()

  // 0b. AUTODESCUBRIMIENTO: ajustar frecuencias según patrón de publicación real
  await autodescubrirFrecuencias()

  // 1. Programar checks de fuentes
  await scheduleCheckJobs()

  // 2. Programar captura de indicadores Tier 1
  await scheduleIndicatorJobs()

  // 3. Programar generacion de boletines
  scheduleBoletinJobs()

  // 4. Programar batch LLM (procesa NotaRaw pendientes cada 45 min)
  scheduleBatchLLM()

  // 5. Programar mantenimiento nocturno
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

// ── GAP DETECTOR: Recuperación automática tras downtime ─────────────────
//
// Al iniciar el scheduler, verifica si hubo un período sin capturas (gap).
// Si el gap supera un umbral, reactiva fuentes inactivas por la caída,
// resetea fallos injustos, y dispara checks inmediatos para todas las fuentes.
// Esto resuelve el problema de 18h sin capturas que nadie detectó.

async function detectarYRecuperarGap(): Promise<void> {
  console.log('[Scheduler] Ejecutando Gap Detector...')

  try {
    // 1. Determinar el momento de la última captura exitosa en todo el sistema
    const ultimaFuenteCheck = await db.fuenteEstado.findFirst({
      where: { ultimoCheckOk: { not: null } },
      orderBy: { ultimoCheckOk: 'desc' },
      select: { ultimoCheckOk: true, Medio: { select: { nombre: true } } },
    })

    const ahora = Date.now()

    // Si nunca hubo un check, no hay gap — es un sistema nuevo
    if (!ultimaFuenteCheck?.ultimoCheckOk) {
      console.log('[Scheduler] Gap Detector: sin historial de checks, saltando')
      return
    }

    const gapMs = ahora - ultimaFuenteCheck.ultimoCheckOk.getTime()
    const gapHoras = gapMs / (1000 * 60 * 60)

    // Umbral: si el gap es menor a 2 horas, no hay recuperación necesaria
    const UMBRAL_GAP_HORAS = 2

    if (gapHoras < UMBRAL_GAP_HORAS) {
      console.log(`[Scheduler] Gap Detector: último check hace ${gapHoras.toFixed(1)}h — sin gap significativo`)
      return
    }

    // ── GAP DETECTADO: el sistema estuvo caído ──
    console.warn(`[Scheduler] ⚠️ GAP DETECTADO: ${gapHoras.toFixed(1)} horas sin capturas (último: ${ultimaFuenteCheck.ultimoCheckOk.toISOString()}, fuente: ${ultimaFuenteCheck.Medio.nombre})`)

    // 2. Reactivar fuentes que fueron desactivadas durante el gap
    //    (los fallos fueron causados por la caída del sistema, no de la fuente)
    const fuentesInactivas = await db.fuenteEstado.findMany({
      where: {
        estado: 'inactiva',
        ultimoCheckOk: { not: null }, // Tuvo checks OK antes
      },
      include: { Medio: { select: { nombre: true, categoria: true, url: true } } },
    })

    let reactivadas = 0
    for (const fuente of fuentesInactivas) {
      await db.fuenteEstado.update({
        where: { id: fuente.id },
        data: {
          estado: 'activa',
          activo: true,
          fallosConsecutivos: 0, // Resetear — los fallos son del sistema, no de la fuente
        },
      })
      reactivadas++
      console.log(`[Scheduler] Fuente reactivada tras gap: ${fuente.Medio.nombre} (estaba inactiva con ${fuente.fallosConsecutivos} fallos)`)
    }

    // 3. Resetear fallos consecutivos de fuentes activas que fallaron durante el gap
    const fuentesConFallos = await db.fuenteEstado.findMany({
      where: {
        estado: 'activa',
        fallosConsecutivos: { gt: 0 },
      },
      include: { Medio: { select: { nombre: true } } },
    })

    let fallosReseteados = 0
    for (const fuente of fuentesConFallos) {
      // Solo resetear si el último fallo probablemente ocurrió durante el gap
      await db.fuenteEstado.update({
        where: { id: fuente.id },
        data: { fallosConsecutivos: 0 },
      })
      fallosReseteados++
    }

    // 4. Disparar checks inmediatos para todas las fuentes activas
    //    (limitar a 5 checks concurrentes para no saturar)
    const fuentesActivas = await db.fuenteEstado.findMany({
      where: { estado: 'activa', activo: true },
      include: { Medio: { select: { nombre: true, nivel: string } } },
    })

    let checksDisparados = 0
    const MAX_CHECKS_INMEDIATOS = 5

    for (const fuente of fuentesActivas.slice(0, MAX_CHECKS_INMEDIATOS)) {
      // Verificar que no haya un check pendiente ya
      const pendingJob = await db.job.findFirst({
        where: {
          tipo: 'check_fuente',
          estado: 'pendiente',
          payload: { contains: fuente.id },
        },
      })
      if (pendingJob) continue

      // Verificar que no se haya checkeado en los últimos 10 minutos
      if (fuente.ultimoCheck) {
        const minutosDesdeUltimo = (ahora - fuente.ultimoCheck.getTime()) / 60000
        if (minutosDesdeUltimo < 10) continue
      }

      const prioridad = fuente.Medio.nivel === '1' ? 1 : 3
      await enqueue({
        tipo: 'check_fuente',
        prioridad: prioridad as 0 | 1 | 3 | 5 | 7 | 9,
        payload: { fuenteId: fuente.id, medioId: fuente.medioId },
      })
      checksDisparados++
    }

    // 5. Disparar batch LLM si hay notas pendientes
    const pendientesLLM = await db.notaRaw.count({
      where: { procesada: false, descartada: false },
    })

    if (pendientesLLM > 0) {
      const pendingBatch = await db.job.findFirst({
        where: { tipo: 'batch_llm', estado: 'pendiente' },
      })
      if (!pendingBatch) {
        await enqueue({ tipo: 'batch_llm', prioridad: 3, payload: {} })
        console.log(`[Scheduler] batch_llm encolado tras gap (${pendientesLLM} notas pendientes)`)
      }
    }

    // 6. Registrar en SystemLog
    await db.systemLog.create({
      data: {
        modulo: 'scheduler',
        accion: 'gap_recovery',
        detalle: `Gap de ${gapHoras.toFixed(1)}h detectado y recuperado: ${reactivadas} fuentes reactivadas, ${fallosReseteados} fallos reseteados, ${checksDisparados} checks inmediatos, ${pendientesLLM} notas pendientes LLM`,
        automatica: true,
        datos: JSON.stringify({
          gapHoras: Math.round(gapHoras * 10) / 10,
          reactivadas,
          fallosReseteados,
          checksDisparados,
          pendientesLLM,
        }),
      },
    }).catch(() => {})

    console.log(`[Scheduler] ✓ Gap Recovery completado: ${reactivadas} reactivadas, ${fallosReseteados} fallos reseteados, ${checksDisparados} checks inmediatos`)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error(`[Scheduler] Error en Gap Detector: ${msg}`)
  }
}

// ── AUTODESCUBRIMIENTO: Ajuste automático de frecuencias ──────────────
//
// Analiza el patrón de publicación real de cada fuente (usando NotaRaw)
// y ajusta la frecuenciaBase/frecuenciaActual para reflejar la realidad.
// Se ejecuta al iniciar el scheduler y durante el mantenimiento nocturno.
//
// Lógica:
//   - Si una fuente tiene ≥10 notas en los últimos 7 días, calcula intervalo promedio
//   - Aplica factor de seguridad (0.7) para chequear antes de que publique
//   - Redondea al nivel de frecuencia más cercano (2h, 4h, 6h)
//   - Respeta bounds: mínimo 2h, máximo 6h
//   - Solo cambia si la nueva frecuencia difiere >30% de la actual

async function autodescubrirFrecuencias(): Promise<void> {
  console.log('[Scheduler] Ejecutando autodescubrimiento de frecuencias...')

  try {
    const config = AUTODESCUBRIMIENTO_CONFIG
    const ventanaInicio = new Date(Date.now() - config.ventanaAnalisisHoras * 60 * 60 * 1000)

    // Obtener todas las fuentes con suficientes datos
    const fuentes = await db.fuenteEstado.findMany({
      where: { estado: { not: 'deprecada' } },
      include: { Medio: { select: { nombre: true, categoria: true, url: true } } },
    })

    let ajustadas = 0
    const FRECUENCIA_LEVELS = [
      { key: '2h', minutos: 120 },
      { key: '4h', minutos: 240 },
      { key: '6h', minutos: 360 },
    ]

    for (const fuente of fuentes) {
      try {
        // Contar notas capturadas en la ventana de análisis
        const notasRecientes = await db.notaRaw.count({
          where: {
            medioId: fuente.medioId,
            fechaCaptura: { gte: ventanaInicio },
          },
        })

        // Si no hay suficientes datos, mantener frecuencia de categoría
        if (notasRecientes < config.minNotasParaAutoajuste) {
          // Pero sí asegurarnos que tenga la frecuencia correcta de su categoría
          const freqBaseCorrecta = getFrecuenciaBase(
            fuente.Medio.nombre,
            fuente.Medio.categoria,
            fuente.Medio.url,
          )
          if (fuente.frecuenciaBase !== freqBaseCorrecta) {
            await db.fuenteEstado.update({
              where: { id: fuente.id },
              data: {
                frecuenciaBase: freqBaseCorrecta,
                frecuenciaActual: freqBaseCorrecta,
              },
            })
            ajustadas++
            console.log(`[Scheduler] Autodescubrimiento: ${fuente.Medio.nombre} frecuencia corregida a ${freqBaseCorrecta} (sin historial, usa categoría)`)
          }
          continue
        }

        // Calcular intervalo promedio entre publicaciones
        const notasConFecha = await db.notaRaw.findMany({
          where: {
            medioId: fuente.medioId,
            fechaCaptura: { gte: ventanaInicio },
          },
          orderBy: { fechaCaptura: 'asc' },
          select: { fechaCaptura: true },
        })

        if (notasConFecha.length < 2) continue

        // Calcular intervalos entre publicaciones consecutivas
        let totalIntervaloMin = 0
        let intervalos = 0
        for (let i = 1; i < notasConFecha.length; i++) {
          const diff = notasConFecha[i].fechaCaptura.getTime() - notasConFecha[i - 1].fechaCaptura.getTime()
          // Ignorar intervalos > 24h (probablemente gap del sistema, no patrón real)
          if (diff < 24 * 60 * 60 * 1000) {
            totalIntervaloMin += diff / (1000 * 60)
            intervalos++
          }
        }

        if (intervalos === 0) continue

        const intervaloPromedioMin = totalIntervaloMin / intervalos
        // Aplicar factor de seguridad: chequear antes de que publique
        const intervaloAjustadoMin = intervaloPromedioMin * config.factorSeguridad

        // Encontrar el nivel de frecuencia más cercano
        let nuevaFreq: string | null = null
        for (const level of FRECUENCIA_LEVELS) {
          if (intervaloAjustadoMin <= level.minutos) {
            nuevaFreq = level.key
            break
          }
        }
        // Si el intervalo es mayor que 6h, usar 6h como máximo
        if (!nuevaFreq) nuevaFreq = config.frecuenciaMaxima

        // Verificar si el cambio es significativo (>30%)
        const freqActualMs = frecuenciaToMs(fuente.frecuenciaActual)
        const nuevaFreqMs = frecuenciaToMs(nuevaFreq)
        const diffPct = Math.abs(nuevaFreqMs - freqActualMs) / freqActualMs * 100

        if (diffPct > config.umbralCambio) {
          await db.fuenteEstado.update({
            where: { id: fuente.id },
            data: {
              frecuenciaBase: nuevaFreq,
              frecuenciaActual: nuevaFreq,
            },
          })
          ajustadas++
          console.log(
            `[Scheduler] Autodescubrimiento: ${fuente.Medio.nombre} ${fuente.frecuenciaActual} → ${nuevaFreq} ` +
            `(intervalo promedio: ${Math.round(intervaloPromedioMin)}min, ${notasRecientes} notas en ${config.ventanaAnalisisHoras}h)`
          )
        }
      } catch (err) {
        // Error individual no debe detener el proceso completo
        console.warn(`[Scheduler] Error autodescubriendo ${fuente.Medio.nombre}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    if (ajustadas > 0) {
      console.log(`[Scheduler] ✓ Autodescubrimiento: ${ajustadas} fuentes ajustadas de ${fuentes.length} evaluadas`)
      await db.systemLog.create({
        data: {
          modulo: 'scheduler',
          accion: 'autodescubrimiento_frecuencias',
          detalle: `${ajustadas} fuentes con frecuencia ajustada por autodescubrimiento de ${fuentes.length} evaluadas`,
          automatica: true,
          datos: JSON.stringify({ ajustadas, total: fuentes.length }),
        },
      }).catch(() => {})
    } else {
      console.log(`[Scheduler] Autodescubrimiento: sin cambios necesarios (${fuentes.length} fuentes evaluadas)`)
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error(`[Scheduler] Error en autodescubrimiento: ${msg}`)
  }
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

        // ═══ FIX 1: Dedup — no encolar si ya existe un job para este producto ═══
        // Busca en ambos campos: scheduler envia 'tipoBoletin', dashboard envia 'tipoProducto'
        const existingJob = await db.job.findFirst({
          where: {
            tipo: 'generar_boletin',
            estado: { in: ['pendiente', 'en_progreso'] },
            OR: [
              { payload: { contains: productType } },
            ],
            fechaCreacion: { gte: new Date(Date.now() - 3600 * 1000) }, // Solo jobs recientes (1h)
          },
        })
        if (existingJob) {
          console.log(`[Scheduler] Boletin ${productType} ya existe (${existingJob.id}, estado=${existingJob.estado}), saltando`)
          return
        }

        await enqueue({
          tipo: 'generar_boletin',
          prioridad: entry.prioridad as 0 | 1 | 3 | 5 | 7 | 9,
          payload: {
            tipoBoletin: productType,
            tipoProducto: productType, // FIX 4: Normalizar — ambos campos para dedup consistente
            programado: true,
            triggeredBy: 'scheduler-auto',
            // FIX: Incluir endpoint para que el runner use Path A (endpoint dedicado LLM)
            // Si el producto tiene endpoint dedicado, lo usa; si no, cae en generate-generic.
            endpoint: DEDICATED_ENDPOINTS[productType] || '/api/admin/bulletins/generate-generic',
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

// Programar batch LLM — procesa NotaRaw pendientes cada 45 minutos
function scheduleBatchLLM(): void {
  // Horarios: cada 45 min desde las 06:15 hasta las 23:15 Bolivia
  // Alineado para procesar notas después de cada ronda de scraping
  const minutos = [15, 60, 105, 150, 195, 240, 285, 330, 375, 420, 465, 510, 555, 600, 645, 690, 735, 780, 825, 870, 915, 960, 1005, 1050, 1095, 1140, 1185, 1230, 1275, 1320, 1365, 1410]

  for (const minuto of minutos) {
    const hora = Math.floor(minuto / 60)
    const min = minuto % 60
    const expresion = `${min} ${hora} * * *`

    if (!cron.validate(expresion)) continue

    const task = cron.schedule(expresion, async () => {
      try {
        // Solo encolar si hay notas pendientes
        const pendientes = await db.notaRaw.count({
          where: { procesada: false, descartada: false },
        })

        if (pendientes === 0) return

        // Verificar que no haya batch_llm pendiente
        const pending = await db.job.findFirst({
          where: { tipo: 'batch_llm', estado: 'pendiente' },
        })
        if (pending) return

        await enqueue({
          tipo: 'batch_llm',
          prioridad: 3,
          payload: {},
        })

        console.log(`[Scheduler] batch_llm encolado (${pendientes} notas pendientes)`)
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        console.error(`[Scheduler] Error en batch_llm: ${msg}`)
      }
    }, CRON_OPTS)

    getState().tasks.push(task)
  }

  console.log('[Scheduler] Batch LLM programado cada 45 min (06:15-23:15 Bolivia)')
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
            'autodescubrir_frecuencias',
            'limpiar_jobs',
            'purge_notas_raw',  // limpiar NotaRaw > 48h sin procesar
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
  await autodescubrirFrecuencias()
  await scheduleCheckJobs()
  await scheduleIndicatorJobs()
  scheduleBoletinJobs()
  scheduleBatchLLM()  // NUEVO: batch LLM cada 45 min
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
