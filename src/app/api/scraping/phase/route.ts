// /api/scraping/phase — Control de fases de scraping
// GET  → estado actual de la fase + fuentes incluidas + progreso
// POST → acciones: iniciar_fase, ejecutar, pausar, reanudar, detener,
//            avanzar_fase, retroceder_fase, reiniciar, ejecutar_uno,
//            seleccionar_fuentes, forzar_check

import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { enqueue } from '@/lib/jobs/queue'
import { ensureWorkerRunning } from '@/lib/jobs'

// ── Configuración de fases ─────────────────────────────────────────

interface FaseConfig {
  id: number
  nombre: string
  descripcion: string
  maxFuentes: number // 0 = todas
  filtros: { nivel?: string[]; activo?: boolean }
  criterioExito: string
}

const FASES: FaseConfig[] = [
  {
    id: 1,
    nombre: 'Prueba Mínima',
    descripcion: '4 fuentes principales — verificación de scraping',
    maxFuentes: 4,
    filtros: { nivel: ['1'] },
    criterioExito: 'Scrape responde + IA extrae menciones con sentido',
  },
  {
    id: 2,
    nombre: 'Ciclo Completo',
    descripcion: '10 fuentes — scrape → IA → mención → producto preview',
    maxFuentes: 10,
    filtros: { nivel: ['1'] },
    criterioExito: 'Producto preview generado correctamente con datos reales',
  },
  {
    id: 3,
    nombre: 'Producción Total',
    descripcion: 'Todas las fuentes, ejes, temas e indicadores',
    maxFuentes: 0,
    filtros: {},
    criterioExito: 'Sistema operativo en producción completa',
  },
]

// ── Estado en memoria ───────────────────────────────────────────────

type EstadoFase = 'inactivo' | 'listo' | 'ejecutando' | 'pausado' | 'detenido'

let faseActual: number = 0
let estadoFase: EstadoFase = 'inactivo'
let scrapeEnProgreso: boolean = false
let scrapePausado: boolean = false
let scrapeActualIndex: number = 0
let scrapeTotalFuentes: number = 0
let scrapeFuentes: Array<{ id: string; medioId: string; nombre: string }> = []
let fuentesSeleccionadasIds: Set<string> = new Set()
let scrapeResultados: Array<{
  fuenteId: string
  nombre: string
  estado: 'pendiente' | 'scrapeando' | 'completado' | 'error' | 'pausado'
  menciones: number
  error?: string
  duracionMs?: number
}> = []
let ultimoScrapeInicio: string | null = null

// ── GET: Estado actual ─────────────────────────────────────────────

export async function GET() {
  try {
    const fuentesActivas = await db.fuenteEstado.count({
      where: { activo: true },
    })

    const fuentesTotales = await db.fuenteEstado.count()

    const resultadosActuales = scrapeResultados.length > 0
      ? scrapeResultados
      : []

    // Si hay fase activa, mostrar fuentes incluidas
    let fuentesIncluidas: Array<{
      id: string
      nombre: string
      nivel: string
      tipoCheck: string
      ultimoCheck: string | null
      totalCambios: number
      activo: boolean
      seleccionado: boolean
    }> = []

    if (faseActual > 0) {
      const faseConfig = FASES[faseActual - 1]
      const whereClause: Record<string, unknown> = {}
      if (faseConfig.filtros.nivel?.length) {
        whereClause.medio = { nivel: { in: faseConfig.filtros.nivel } }
      }

      const fuentesRaw = await db.fuenteEstado.findMany({
        where: whereClause,
        orderBy: { medio: { nombre: 'asc' } },
        take: faseConfig.maxFuentes || 999,
        select: {
          id: true,
          activo: true,
          medio: { select: { nombre: true, nivel: true } },
          tipoCheck: true,
          ultimoCheck: true,
          totalCambios: true,
        },
      })

      fuentesIncluidas = fuentesRaw.map(f => ({
        id: f.id,
        nombre: f.medio.nombre,
        nivel: f.medio.nivel,
        tipoCheck: f.tipoCheck,
        ultimoCheck: f.ultimoCheck ? String(f.ultimoCheck) : null,
        totalCambios: f.totalCambios,
        activo: f.activo,
        seleccionado: fuentesSeleccionadasIds.has(f.id),
      }))
    }

    return NextResponse.json({
      faseActual,
      estadoFase,
      faseConfig: faseActual > 0 ? FASES[faseActual - 1] : null,
      fasesDisponibles: FASES,
      fuentesActivas,
      fuentesTotales,
      scrapeEnProgreso,
      scrapePausado,
      scrapeProgreso: scrapeTotalFuentes > 0
        ? { actual: scrapeActualIndex, total: scrapeTotalFuentes }
        : null,
      scrapeResultados: resultadosActuales,
      ultimoScrapeInicio,
      fuentesIncluidas,
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[API /scraping/phase GET]', msg)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

// ── POST: Acciones de fase ─────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { accion, faseId, fuenteIds } = body as { accion: string; faseId?: number; fuenteIds?: string[] }

    switch (accion) {
      // ── Iniciar una fase ──────────────────────────
      case 'iniciar_fase': {
        const targetFase = faseId || 1
        if (targetFase < 1 || targetFase > FASES.length) {
          return NextResponse.json(
            { error: `Fase inválida. Debe ser 1-${FASES.length}` },
            { status: 400 },
          )
        }

        // Permitir cambio de fase incluso si hay algo en progreso — detener primero
        if (scrapeEnProgreso || scrapePausado) {
          scrapeEnProgreso = false
          scrapePausado = false
          console.log('[ScrapingPhase] Deteniendo proceso anterior al cambiar de fase')
        }

        const faseConfig = FASES[targetFase - 1]

        // Desactivar todas las fuentes primero (limpieza)
        await db.fuenteEstado.updateMany({
          data: { activo: false },
        })

        // Activar solo las fuentes de esta fase
        const whereClause: Record<string, unknown> = {}
        if (faseConfig.filtros.nivel?.length) {
          whereClause.medio = { nivel: { in: faseConfig.filtros.nivel } }
        }

        const fuentes = await db.fuenteEstado.findMany({
          where: whereClause,
          include: { medio: { select: { nombre: true, nivel: true } } },
          orderBy: { medio: { nombre: 'asc' } },
          take: faseConfig.maxFuentes || 999,
        })

        if (fuentes.length === 0) {
          return NextResponse.json(
            { error: 'No hay fuentes disponibles para esta fase. Ejecuta /api/seed-fuentes primero.' },
            { status: 400 },
          )
        }

        // Activar las fuentes seleccionadas
        for (const fuente of fuentes) {
          await db.fuenteEstado.update({
            where: { id: fuente.id },
            data: { activo: true },
          })
        }

        faseActual = targetFase
        estadoFase = 'listo'
        scrapeFuentes = fuentes.map(f => ({
          id: f.id,
          medioId: f.medioId,
          nombre: f.medio.nombre,
        }))
        fuentesSeleccionadasIds = new Set(fuentes.map(f => f.id))
        scrapeResultados = []
        scrapeActualIndex = 0
        scrapeTotalFuentes = 0
        scrapeEnProgreso = false
        scrapePausado = false
        ultimoScrapeInicio = null

        console.log(
          `[ScrapingPhase] Fase ${targetFase} iniciada: ${fuentes.length} fuentes activadas`,
        )
        console.log(
          `[ScrapingPhase] Fuentes: ${fuentes.map(f => f.medio.nombre).join(', ')}`,
        )

        return NextResponse.json({
          exito: true,
          mensaje: `Fase ${targetFase} "${faseConfig.nombre}" activada — ${fuentes.length} fuentes`,
          fuentesActivadas: fuentes.length,
          fuentes: fuentes.map(f => f.medio.nombre),
        })
      }

      // ── Ejecutar scrape secuencial ────────────────
      case 'ejecutar': {
        ensureWorkerRunning()

        if (scrapeEnProgreso && !scrapePausado) {
          return NextResponse.json(
            { error: 'Ya hay un scrape en ejecución. Pausa o detén primero.' },
            { status: 409 },
          )
        }

        if (faseActual === 0) {
          return NextResponse.json(
            { error: 'No hay fase activa. Inicia una fase primero.' },
            { status: 400 },
          )
        }

        if (scrapeFuentes.length === 0) {
          return NextResponse.json(
            { error: 'No hay fuentes en la fase actual' },
            { status: 400 },
          )
        }

        // Si estaba pausado, reanudar desde donde quedó
        const reanudando = scrapePausado
        if (!reanudando) {
          // Iniciar desde cero
          scrapeActualIndex = 0
          scrapeTotalFuentes = scrapeFuentes.length
          ultimoScrapeInicio = new Date().toISOString()
          scrapeResultados = scrapeFuentes.map(f => ({
            fuenteId: f.id,
            nombre: f.nombre,
            estado: 'pendiente',
            menciones: 0,
          }))
        }

        scrapeEnProgreso = true
        scrapePausado = false
        estadoFase = 'ejecutando'

        // Ejecutar en background
        ejecutarScrapeSecuencial(reanudando)

        return NextResponse.json({
          exito: true,
          mensaje: reanudando
            ? `Scrape reanudado desde fuente ${scrapeActualIndex}/${scrapeTotalFuentes}`
            : `Scrape iniciado para ${scrapeTotalFuentes} fuentes`,
          totalFuentes: scrapeTotalFuentes,
          reanudando,
        })
      }

      // ── Pausar scrape en progreso ─────────────────
      case 'pausar': {
        if (!scrapeEnProgreso) {
          return NextResponse.json(
            { error: 'No hay scrape en progreso para pausar' },
            { status: 400 },
          )
        }

        scrapePausado = true
        estadoFase = 'pausado'
        console.log(
          `[ScrapingPhase] Scrape pausado en fuente ${scrapeActualIndex}/${scrapeTotalFuentes}`,
        )

        return NextResponse.json({
          exito: true,
          mensaje: `Scrape pausado — fuente ${scrapeActualIndex}/${scrapeTotalFuentes}`,
          progreso: { actual: scrapeActualIndex, total: scrapeTotalFuentes },
        })
      }

      // ── Reanudar (alias de ejecutar cuando está pausado) ──
      case 'reanudar': {
        if (!scrapePausado) {
          return NextResponse.json(
            { error: 'No hay scrape pausado para reanudar' },
            { status: 400 },
          )
        }
        // Reutilizar la lógica de ejecutar
        return POST(new NextRequest('http://internal', {
          method: 'POST',
          body: JSON.stringify({ accion: 'ejecutar' }),
        }))
      }

      // ── Detener scrape completamente ──────────────
      case 'detener': {
        if (!scrapeEnProgreso && !scrapePausado) {
          return NextResponse.json(
            { error: 'No hay scrape activo para detener' },
            { status: 400 },
          )
        }

        scrapeEnProgreso = false
        scrapePausado = false
        estadoFase = 'detenido'

        // Marcar fuentes pendientes como pausadas/detenidas
        for (const r of scrapeResultados) {
          if (r.estado === 'pendiente') {
            r.estado = 'pausado'
          }
        }

        console.log('[ScrapingPhase] Scrape detenido por el administrador')

        return NextResponse.json({
          exito: true,
          mensaje: 'Scrape detenido',
          progreso: { actual: scrapeActualIndex, total: scrapeTotalFuentes },
        })
      }

      // ── Retroceder a la fase anterior ────────────
      case 'retroceder_fase': {
        if (faseActual <= 1) {
          return NextResponse.json(
            { error: 'Ya estás en la Fase 1 — no hay fase anterior' },
            { status: 400 },
          )
        }

        // Detener scrape si está activo
        scrapeEnProgreso = false
        scrapePausado = false

        const faseAnterior = faseActual - 1
        return POST(new NextRequest('http://internal', {
          method: 'POST',
          body: JSON.stringify({ accion: 'iniciar_fase', faseId: faseAnterior }),
        }))
      }

      // ── Avanzar a la siguiente fase ───────────────
      case 'avanzar_fase': {
        if (faseActual >= FASES.length) {
          return NextResponse.json(
            { error: 'Ya estás en la última fase' },
            { status: 400 },
          )
        }

        // Detener scrape si está activo
        scrapeEnProgreso = false
        scrapePausado = false

        const siguienteFase = faseActual + 1
        return POST(new NextRequest('http://internal', {
          method: 'POST',
          body: JSON.stringify({ accion: 'iniciar_fase', faseId: siguienteFase }),
        }))
      }

      // ── Seleccionar fuentes manualmente ───────────
      case 'seleccionar_fuentes': {
        if (faseActual === 0) {
          return NextResponse.json(
            { error: 'Activa una fase primero' },
            { status: 400 },
          )
        }

        if (scrapeEnProgreso && !scrapePausado) {
          return NextResponse.json(
            { error: 'Detén o pausa el scrape antes de cambiar fuentes' },
            { status: 409 },
          )
        }

        if (!fuenteIds || !Array.isArray(fuenteIds) || fuenteIds.length === 0) {
          return NextResponse.json(
            { error: 'fuenteIds requerido (array de IDs)' },
            { status: 400 },
          )
        }

        // Validar que todos los IDs existen
        const fuentesValidas = await db.fuenteEstado.findMany({
          where: { id: { in: fuenteIds } },
          include: { medio: { select: { nombre: true } } },
        })

        if (fuentesValidas.length === 0) {
          return NextResponse.json(
            { error: 'Ninguna de las fuentes seleccionadas existe' },
            { status: 400 },
          )
        }

        // Actualizar fuentes activas en DB
        await db.fuenteEstado.updateMany({ data: { activo: false } })
        await db.fuenteEstado.updateMany({
          where: { id: { in: fuenteIds } },
          data: { activo: true },
        })

        // Actualizar estado en memoria
        scrapeFuentes = fuentesValidas.map(f => ({
          id: f.id,
          medioId: f.medioId,
          nombre: f.medio.nombre,
        }))
        fuentesSeleccionadasIds = new Set(fuenteIds)
        scrapeResultados = []
        scrapeActualIndex = 0
        scrapeTotalFuentes = 0
        estadoFase = 'listo'

        console.log(
          `[ScrapingPhase] Fuentes seleccionadas manualmente: ${fuentesValidas.map(f => f.medio.nombre).join(', ')}`,
        )

        return NextResponse.json({
          exito: true,
          mensaje: `${fuentesValidas.length} fuentes seleccionadas`,
          fuentes: fuentesValidas.map(f => ({ id: f.id, nombre: f.medio.nombre })),
        })
      }

      // ── Ejecutar UN solo medio ────────────────────
      case 'ejecutar_uno': {
        const { fuenteId } = body as { fuenteId?: string }
        if (!fuenteId) {
          return NextResponse.json(
            { error: 'fuenteId requerido' },
            { status: 400 },
          )
        }

        const fuente = await db.fuenteEstado.findUnique({
          where: { id: fuenteId },
          include: { medio: true },
        })

        if (!fuente) {
          return NextResponse.json(
            { error: 'Fuente no encontrada' },
            { status: 404 },
          )
        }

        ensureWorkerRunning()

        await enqueue({
          tipo: 'check_fuente',
          prioridad: 0,
          payload: { fuenteId: fuente.id, medioId: fuente.medioId },
        })

        return NextResponse.json({
          exito: true,
          mensaje: `Check encolado para "${fuente.medio.nombre}" (P0)`,
          fuente: { id: fuente.id, nombre: fuente.medio.nombre },
        })
      }

      // ── Reiniciar (volver a fase 0) ───────────────
      case 'reiniciar': {
        scrapeEnProgreso = false
        scrapePausado = false

        await db.fuenteEstado.updateMany({ data: { activo: false } })

        faseActual = 0
        estadoFase = 'inactivo'
        scrapeActualIndex = 0
        scrapeTotalFuentes = 0
        scrapeFuentes = []
        fuentesSeleccionadasIds = new Set()
        scrapeResultados = []
        ultimoScrapeInicio = null

        console.log('[ScrapingPhase] Sistema reiniciado — todas las fuentes desactivadas')

        return NextResponse.json({
          exito: true,
          mensaje: 'Sistema reiniciado — todas las fuentes desactivadas',
        })
      }

      // ── Forzar check de una fuente ────────────────
      case 'forzar_check': {
        const { fuenteId } = body as { fuenteId?: string }
        if (!fuenteId) {
          return NextResponse.json({ error: 'fuenteId requerido' }, { status: 400 })
        }

        const fuente = await db.fuenteEstado.findUnique({
          where: { id: fuenteId },
          include: { medio: true },
        })

        if (!fuente) {
          return NextResponse.json({ error: 'Fuente no encontrada' }, { status: 404 })
        }

        ensureWorkerRunning()

        await enqueue({
          tipo: 'check_fuente',
          prioridad: 0,
          payload: { fuenteId: fuente.id, medioId: fuente.medioId },
        })

        return NextResponse.json({
          exito: true,
          mensaje: `Forzado check para "${fuente.medio.nombre}"`,
        })
      }

      default:
        return NextResponse.json(
          {
            error: `Acción no reconocida: ${accion}`,
            accionesValidas: [
              'iniciar_fase',
              'ejecutar',
              'pausar',
              'reanudar',
              'detener',
              'avanzar_fase',
              'retroceder_fase',
              'seleccionar_fuentes',
              'ejecutar_uno',
              'reiniciar',
              'forzar_check',
            ],
          },
          { status: 400 },
        )
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[API /scraping/phase POST]', msg)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

// ── Scrape secuencial en background ────────────────────────────────

async function ejecutarScrapeSecuencial(reanudando: boolean = false): Promise<void> {
  const DELAY_ENTRE_FUENTES = 30_000 // 30 segundos entre fuentes
  const startIndex = reanudando ? scrapeActualIndex : 0

  console.log(
    `[ScrapingPhase] ${reanudando ? 'Reanudando' : 'Iniciando'} scrape secuencial: ${scrapeFuentes.length - startIndex} fuentes restantes`,
  )

  for (let i = startIndex; i < scrapeFuentes.length; i++) {
    // Verificar si fue pausado o detenido
    if (!scrapeEnProgreso || scrapePausado) {
      console.log(`[ScrapingPhase] ${scrapePausado ? 'Pausado' : 'Detenido'} en fuente ${i + 1}/${scrapeFuentes.length}`)
      // Marcar pendientes como pausados
      for (let j = i; j < scrapeResultados.length; j++) {
        if (scrapeResultados[j].estado === 'pendiente') {
          scrapeResultados[j].estado = 'pausado'
        }
      }
      return
    }

    const fuente = scrapeFuentes[i]
    scrapeActualIndex = i + 1

    // Marcar como scrapeando
    const resultIdx = scrapeResultados.findIndex(r => r.fuenteId === fuente.id)
    if (resultIdx >= 0) {
      scrapeResultados[resultIdx].estado = 'scrapeando'
    }

    const startTime = Date.now()

    try {
      console.log(
        `[ScrapingPhase] (${i + 1}/${scrapeFuentes.length}) Encolando check para "${fuente.nombre}"...`,
      )

      await enqueue({
        tipo: 'check_fuente',
        prioridad: 0 as const,
        payload: { fuenteId: fuente.id, medioId: fuente.medioId },
      })

      const procesado = await esperarProcesamiento(fuente.id, 120_000)

      if (resultIdx >= 0) {
        scrapeResultados[resultIdx].estado = procesado ? 'completado' : 'error'
        scrapeResultados[resultIdx].duracionMs = Date.now() - startTime
        if (!procesado) {
          scrapeResultados[resultIdx].error = 'Timeout esperando procesamiento'
        }
      }

      // Contar menciones
      try {
        const medioId = fuente.medioId
        const mencionesRecientes = await db.mencion.count({
          where: {
            medioId,
            fechaCreacion: { gte: new Date(startTime) },
          },
        })
        if (resultIdx >= 0) {
          scrapeResultados[resultIdx].menciones = mencionesRecientes
        }
      } catch {
        // No crashear
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      console.error(`[ScrapingPhase] Error en "${fuente.nombre}": ${msg}`)
      if (resultIdx >= 0) {
        scrapeResultados[resultIdx].estado = 'error'
        scrapeResultados[resultIdx].error = msg
        scrapeResultados[resultIdx].duracionMs = Date.now() - startTime
      }
    }

    // Delay entre fuentes
    if (i < scrapeFuentes.length - 1 && scrapeEnProgreso && !scrapePausado) {
      console.log(
        `[ScrapingPhase] Esperando ${DELAY_ENTRE_FUENTES / 1000}s antes de la siguiente fuente...`,
      )
      // Delay particionado para poder detectar pausa/detener
      const steps = 10
      const stepDelay = DELAY_ENTRE_FUENTES / steps
      for (let s = 0; s < steps; s++) {
        if (!scrapeEnProgreso || scrapePausado) break
        await sleep(stepDelay)
      }
    }
  }

  scrapeEnProgreso = false
  scrapePausado = false
  estadoFase = 'listo'
  console.log(
    `[ScrapingPhase] Scrape secuencial finalizado. ${scrapeResultados.filter(r => r.estado === 'completado').length}/${scrapeTotalFuentes} exitosos`,
  )
}

// ── Helpers ─────────────────────────────────────────────────────────

function esperarProcesamiento(
  fuenteId: string,
  timeoutMs: number,
): Promise<boolean> {
  return new Promise((resolve) => {
    const start = Date.now()
    const interval = setInterval(async () => {
      if (Date.now() - start > timeoutMs) {
        clearInterval(interval)
        resolve(false)
        return
      }

      try {
        const pendingJob = await db.job.findFirst({
          where: {
            tipo: 'check_fuente',
            estado: { in: ['pendiente', 'en_progreso'] },
            payload: { contains: fuenteId },
          },
        })

        if (!pendingJob) {
          clearInterval(interval)
          resolve(true)
        }
      } catch {
        // Ignorar
      }
    }, 3000)

    setTimeout(() => {
      clearInterval(interval)
      resolve(false)
    }, timeoutMs + 5000)
  })
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
