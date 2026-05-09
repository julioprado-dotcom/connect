// /api/scraping/phase — Control de fases de scraping
// GET  → estado actual de la fase + fuentes incluidas + progreso
// POST → acciones: iniciar_fase, ejecutar, pausar, reanudar, detener,
//            avanzar_fase, retroceder_fase, reiniciar, ejecutar_uno,
//            seleccionar_fuentes, forzar_check

import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { enqueue } from '@/lib/jobs/queue'
import { ensureWorkerRunning } from '@/lib/jobs'
import { rescheduleAll } from '@/lib/jobs/scheduler'
import { scrapingState } from '@/lib/scraping-state'

// ── Configuración de fases ─────────────────────────────────────────

interface FaseConfig {
  id: number
  nombre: string
  descripcion: string
  maxFuentes: number // 0 = todas
  filtros: { nivel?: string[]; activo?: boolean }
  fuentesEspecificas?: string[] // nombres de medios exactos (anula filtros si está presente)
  criterioExito: string
}

const FASES: FaseConfig[] = [
  {
    id: 1,
    nombre: 'Prueba Mínima',
    descripcion: '4 fuentes principales — verificación de scraping',
    maxFuentes: 4,
    filtros: { nivel: ['1'] },
    fuentesEspecificas: ['ABI', 'ATB', 'La Razón', 'El Deber'],
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

// ── Estado en memoria (local — no necesita compartirse con stats) ──

let scrapeActualIndex: number = 0
let scrapeTotalFuentes: number = 0
let scrapeResultados: Array<{
  fuenteId: string
  nombre: string
  estado: 'pendiente' | 'scrapeando' | 'completado' | 'error' | 'pausado'
  menciones: number
  error?: string
  detalle?: string
  duracionMs?: number
}> = []
let ultimoScrapeInicio: string | null = null

// ── GET: Estado actual ─────────────────────────────────────────────

export async function GET() {
  try {
    // Contar fuentes activas en DB solo si hay fase activa
    const fuentesActivas = scrapingState.faseActual > 0
      ? await db.fuenteEstado.count({ where: { activo: true } })
      : 0

    const fuentesTotales = await db.fuenteEstado.count()

    const resultadosActuales = scrapeResultados.length > 0
      ? scrapeResultados
      : []

    // Monitoreo activo = fuentes en la fase actual (0 si no hay fase)
    const monitoreoActivas = scrapingState.faseActual > 0
      ? scrapingState.scrapeFuentes.length
      : 0

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

    if (scrapingState.faseActual > 0) {
      const faseConfig = FASES[scrapingState.faseActual - 1]

      let fuentesRaw
      if (faseConfig.fuentesEspecificas && faseConfig.fuentesEspecificas.length > 0) {
        fuentesRaw = await db.fuenteEstado.findMany({
          where: {
            medio: { nombre: { in: faseConfig.fuentesEspecificas } }
          },
          orderBy: { medio: { nombre: 'asc' } },
          select: {
            id: true,
            activo: true,
            medio: { select: { nombre: true, nivel: true } },
            tipoCheck: true,
            ultimoCheck: true,
            totalCambios: true,
          },
        })
      } else {
        const whereClause: Record<string, unknown> = {}
        if (faseConfig.filtros.nivel?.length) {
          whereClause.medio = { nivel: { in: faseConfig.filtros.nivel } }
        }
        fuentesRaw = await db.fuenteEstado.findMany({
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
      }

      fuentesIncluidas = fuentesRaw.map(f => ({
        id: f.id,
        nombre: f.medio.nombre,
        nivel: f.medio.nivel,
        tipoCheck: f.tipoCheck,
        ultimoCheck: f.ultimoCheck ? String(f.ultimoCheck) : null,
        totalCambios: f.totalCambios,
        activo: f.activo,
        seleccionado: scrapingState.fuentesSeleccionadasIds.has(f.id),
      }))
    }

    return NextResponse.json({
      faseActual: scrapingState.faseActual,
      estadoFase: scrapingState.estadoFase,
      faseConfig: scrapingState.faseActual > 0 ? FASES[scrapingState.faseActual - 1] : null,
      fasesDisponibles: FASES,
      fuentesActivas,
      fuentesTotales,
      monitoreoActivas,
      scrapeEnProgreso: scrapingState.scrapeEnProgreso,
      scrapePausado: scrapingState.scrapePausado,
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
        if (scrapingState.scrapeEnProgreso || scrapingState.scrapePausado) {
          scrapingState.scrapeEnProgreso = false
          scrapingState.scrapePausado = false
          console.log('[ScrapingPhase] Deteniendo proceso anterior al cambiar de fase')
        }

        const faseConfig = FASES[targetFase - 1]

        // Desactivar todas las fuentes primero (limpieza)
        await db.fuenteEstado.updateMany({
          data: { activo: false },
        })

        // Activar solo las fuentes de esta fase
        let fuentes
        if (faseConfig.fuentesEspecificas && faseConfig.fuentesEspecificas.length > 0) {
          // Modo explícito: seleccionar medios por nombre exacto
          fuentes = await db.fuenteEstado.findMany({
            where: {
              medio: { nombre: { in: faseConfig.fuentesEspecificas } }
            },
            include: { medio: { select: { nombre: true, nivel: true } } },
            orderBy: { medio: { nombre: 'asc' } },
          })
        } else {
          // Modo filtro: seleccionar por nivel y tomar maxFuentes
          const whereClause: Record<string, unknown> = {}
          if (faseConfig.filtros.nivel?.length) {
            whereClause.medio = { nivel: { in: faseConfig.filtros.nivel } }
          }
          fuentes = await db.fuenteEstado.findMany({
            where: whereClause,
            include: { medio: { select: { nombre: true, nivel: true } } },
            orderBy: { medio: { nombre: 'asc' } },
            take: faseConfig.maxFuentes || 999,
          })
        }

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

        // Actualizar estado compartido
        scrapingState.faseActual = targetFase
        scrapingState.estadoFase = 'listo'
        scrapingState.scrapeFuentes = fuentes.map(f => ({
          id: f.id,
          medioId: f.medioId,
          nombre: f.medio.nombre,
        }))
        scrapingState.fuentesSeleccionadasIds = new Set(fuentes.map(f => f.id))
        scrapingState.scrapeEnProgreso = false
        scrapingState.scrapePausado = false

        // Reset estado local
        scrapeResultados = []
        scrapeActualIndex = 0
        scrapeTotalFuentes = 0
        ultimoScrapeInicio = null

        console.log(
          `[ScrapingPhase] Fase ${targetFase} iniciada: ${fuentes.length} fuentes activadas`,
        )
        console.log(
          `[ScrapingPhase] Fuentes: ${fuentes.map(f => f.medio.nombre).join(', ')}`,
        )

        // Actualizar scheduler con las nuevas fuentes activas
        ensureWorkerRunning()
        await rescheduleAll()

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

        if (scrapingState.scrapeEnProgreso && !scrapingState.scrapePausado) {
          return NextResponse.json(
            { error: 'Ya hay un scrape en ejecución. Pausa o detén primero.' },
            { status: 409 },
          )
        }

        if (scrapingState.faseActual === 0) {
          return NextResponse.json(
            { error: 'No hay fase activa. Inicia una fase primero.' },
            { status: 400 },
          )
        }

        if (scrapingState.scrapeFuentes.length === 0) {
          return NextResponse.json(
            { error: 'No hay fuentes en la fase actual' },
            { status: 400 },
          )
        }

        // Si estaba pausado, reanudar desde donde quedó
        const reanudando = scrapingState.scrapePausado
        if (!reanudando) {
          scrapeActualIndex = 0
          scrapeTotalFuentes = scrapingState.scrapeFuentes.length
          ultimoScrapeInicio = new Date().toISOString()
          scrapeResultados = scrapingState.scrapeFuentes.map(f => ({
            fuenteId: f.id,
            nombre: f.nombre,
            estado: 'pendiente',
            menciones: 0,
          }))
        }

        scrapingState.scrapeEnProgreso = true
        scrapingState.scrapePausado = false
        scrapingState.estadoFase = 'ejecutando'

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
        if (!scrapingState.scrapeEnProgreso) {
          return NextResponse.json(
            { error: 'No hay scrape en progreso para pausar' },
            { status: 400 },
          )
        }

        scrapingState.scrapePausado = true
        scrapingState.estadoFase = 'pausado'
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
        if (!scrapingState.scrapePausado) {
          return NextResponse.json(
            { error: 'No hay scrape pausado para reanudar' },
            { status: 400 },
          )
        }
        return POST(new NextRequest('http://internal', {
          method: 'POST',
          body: JSON.stringify({ accion: 'ejecutar' }),
        }))
      }

      // ── Detener scrape completamente ──────────────
      case 'detener': {
        if (!scrapingState.scrapeEnProgreso && !scrapingState.scrapePausado) {
          return NextResponse.json(
            { error: 'No hay scrape activo para detener' },
            { status: 400 },
          )
        }

        scrapingState.scrapeEnProgreso = false
        scrapingState.scrapePausado = false
        scrapingState.estadoFase = 'detenido'

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
        if (scrapingState.faseActual <= 1) {
          return NextResponse.json(
            { error: 'Ya estás en la Fase 1 — no hay fase anterior' },
            { status: 400 },
          )
        }

        scrapingState.scrapeEnProgreso = false
        scrapingState.scrapePausado = false

        const faseAnterior = scrapingState.faseActual - 1
        return POST(new NextRequest('http://internal', {
          method: 'POST',
          body: JSON.stringify({ accion: 'iniciar_fase', faseId: faseAnterior }),
        }))
      }

      // ── Avanzar a la siguiente fase ───────────────
      case 'avanzar_fase': {
        if (scrapingState.faseActual >= FASES.length) {
          return NextResponse.json(
            { error: 'Ya estás en la última fase' },
            { status: 400 },
          )
        }

        scrapingState.scrapeEnProgreso = false
        scrapingState.scrapePausado = false

        const siguienteFase = scrapingState.faseActual + 1
        return POST(new NextRequest('http://internal', {
          method: 'POST',
          body: JSON.stringify({ accion: 'iniciar_fase', faseId: siguienteFase }),
        }))
      }

      // ── Seleccionar fuentes manualmente ───────────
      case 'seleccionar_fuentes': {
        if (scrapingState.faseActual === 0) {
          return NextResponse.json(
            { error: 'Activa una fase primero' },
            { status: 400 },
          )
        }

        if (scrapingState.scrapeEnProgreso && !scrapingState.scrapePausado) {
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

        await db.fuenteEstado.updateMany({ data: { activo: false } })
        await db.fuenteEstado.updateMany({
          where: { id: { in: fuenteIds } },
          data: { activo: true },
        })

        scrapingState.scrapeFuentes = fuentesValidas.map(f => ({
          id: f.id,
          medioId: f.medioId,
          nombre: f.medio.nombre,
        }))
        scrapingState.fuentesSeleccionadasIds = new Set(fuenteIds)
        scrapingState.estadoFase = 'listo'
        scrapeResultados = []
        scrapeActualIndex = 0
        scrapeTotalFuentes = 0

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
        scrapingState.scrapeEnProgreso = false
        scrapingState.scrapePausado = false

        await db.fuenteEstado.updateMany({ data: { activo: false } })

        scrapingState.faseActual = 0
        scrapingState.estadoFase = 'inactivo'
        scrapingState.scrapeFuentes = []
        scrapingState.fuentesSeleccionadasIds = new Set()

        scrapeActualIndex = 0
        scrapeTotalFuentes = 0
        scrapeResultados = []
        ultimoScrapeInicio = null

        console.log('[ScrapingPhase] Sistema reiniciado — todas las fuentes desactivadas')

        return NextResponse.json({
          exito: true,
          mensaje: 'Sistema reiniciado — todas las fuentes desactivadas',
        })
      }

      // ── Forzar check de TODAS las fuentes activas ───
      case 'ejecutar_uno_all': {
        const fuentesActivas = await db.fuenteEstado.findMany({
          where: { activo: true },
          include: { medio: true },
        })

        if (fuentesActivas.length === 0) {
          return NextResponse.json({ error: 'No hay fuentes activas' }, { status: 400 })
        }

        ensureWorkerRunning()

        let encolados = 0
        for (const fuente of fuentesActivas) {
          await enqueue({
            tipo: 'check_fuente',
            prioridad: 0,
            payload: { fuenteId: fuente.id, medioId: fuente.medioId },
          }).catch(err => {
            console.warn(`[ScrapingPhase] Error encolando check para ${fuente.medio.nombre}:`, err)
          })
          encolados++
        }

        console.log(`[ScrapingPhase] Forzado check para ${encolados} fuentes`)

        return NextResponse.json({
          exito: true,
          mensaje: `${encolados} checks encolados (P0) para fuentes activas`,
          fuentes: fuentesActivas.map(f => f.medio.nombre),
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
              'ejecutar_uno_all',
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
  const DELAY_ENTRE_FUENTES = 30_000
  const startIndex = reanudando ? scrapeActualIndex : 0

  console.log(
    `[ScrapingPhase] ${reanudando ? 'Reanudando' : 'Iniciando'} scrape secuencial: ${scrapingState.scrapeFuentes.length - startIndex} fuentes restantes`,
  )

  for (let i = startIndex; i < scrapingState.scrapeFuentes.length; i++) {
    if (!scrapingState.scrapeEnProgreso || scrapingState.scrapePausado) {
      console.log(`[ScrapingPhase] ${scrapingState.scrapePausado ? 'Pausado' : 'Detenido'} en fuente ${i + 1}/${scrapingState.scrapeFuentes.length}`)
      for (let j = i; j < scrapeResultados.length; j++) {
        if (scrapeResultados[j].estado === 'pendiente') {
          scrapeResultados[j].estado = 'pausado'
        }
      }
      return
    }

    const fuente = scrapingState.scrapeFuentes[i]
    scrapeActualIndex = i + 1

    const resultIdx = scrapeResultados.findIndex(r => r.fuenteId === fuente.id)
    if (resultIdx >= 0) {
      scrapeResultados[resultIdx].estado = 'scrapeando'
    }

    const startTime = Date.now()

    try {
      console.log(
        `[ScrapingPhase] (${i + 1}/${scrapingState.scrapeFuentes.length}) Encolando check para "${fuente.nombre}"...`,
      )

      await enqueue({
        tipo: 'check_fuente',
        prioridad: 0 as const,
        payload: { fuenteId: fuente.id, medioId: fuente.medioId },
      })

      const procesado = await esperarProcesamiento(fuente.id, 120_000)

      if (resultIdx >= 0) {
        scrapeResultados[resultIdx].duracionMs = Date.now() - startTime

        if (!procesado) {
          scrapeResultados[resultIdx].estado = 'error'
          scrapeResultados[resultIdx].error = 'Timeout esperando procesamiento'
        } else {
          // Job was processed — fetch actual result from DB
          try {
            const lastJob = await db.job.findFirst({
              where: {
                tipo: 'check_fuente',
                payload: { contains: fuente.id },
                estado: { in: ['completado', 'fallido'] },
                fechaInicio: { gte: new Date(startTime) },
              },
              orderBy: { fechaFin: 'desc' },
            })

            if (!lastJob) {
              scrapeResultados[resultIdx].estado = 'error'
              scrapeResultados[resultIdx].error = 'Job procesado pero no encontrado en DB'
            } else if (lastJob.estado === 'fallido') {
              // BUG FIX: antes marcaba como 'completado', ahora correctamente 'error'
              scrapeResultados[resultIdx].estado = 'error'
              scrapeResultados[resultIdx].error = lastJob.error || 'Job fallido'
            } else {
              // Job completado — parse resultado to check cambiado
              let resultadoData: Record<string, unknown> = {}
              try {
                resultadoData = lastJob.resultado ? JSON.parse(lastJob.resultado) : {}
              } catch { /* ignore parse errors */ }

              const cambiado = resultadoData.cambiado === true
              const detalle = resultadoData.detalle as string | undefined
              const resultadoError = resultadoData.error as string | undefined
              const estrategiasProbadas = resultadoData.estrategiasProbadas as
                | Array<{ estrategia: string; exito: boolean; detalle: string }>
                | undefined

              // Patrones de error en detalle como respaldo
              const ERROR_PATTERNS_DETALLE = /HTTP \d{3}|fetch failed|timeout|forbidden|vac[ií]o|no parseable|Error:|ECONNREFUSED|ENOTFOUND|socket hang up/i
              const detalleTieneError = detalle ? ERROR_PATTERNS_DETALLE.test(detalle) : false

              // Si el resultado indica error interno (estrategias fallaron), marcar como error
              if (resultadoError || detalleTieneError) {
                scrapeResultados[resultIdx].estado = 'error'
                const errorMsg = resultadoError || (detalleTieneError ? detalle : '')
                const rotacionInfo = estrategiasProbadas
                  ? estrategiasProbadas.map(e => `${e.estrategia}:${e.exito ? 'OK' : 'FAIL'}`).join(' → ')
                  : ''
                scrapeResultados[resultIdx].error = rotacionInfo
                  ? `[${rotacionInfo}] ${errorMsg}`
                  : errorMsg
                scrapeResultados[resultIdx].detalle = detalle
              } else if (cambiado) {
                // Cambio detectado — éxito real
                scrapeResultados[resultIdx].estado = 'completado'
                scrapeResultados[resultIdx].detalle = detalle
              } else {
                // Sin cambios pero sin error — éxito parcial (sitio accesible)
                scrapeResultados[resultIdx].estado = 'completado'
                scrapeResultados[resultIdx].detalle = detalle || 'Sin cambios detectados'
              }
            }
          } catch (dbErr) {
            const dbMsg = dbErr instanceof Error ? dbErr.message : String(dbErr)
            console.error(`[ScrapingPhase] Error leyendo resultado de "${fuente.nombre}": ${dbMsg}`)
            scrapeResultados[resultIdx].estado = 'error'
            scrapeResultados[resultIdx].error = `Error leyendo resultado: ${dbMsg}`
          }
        }
      }

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

    if (i < scrapingState.scrapeFuentes.length - 1 && scrapingState.scrapeEnProgreso && !scrapingState.scrapePausado) {
      console.log(
        `[ScrapingPhase] Esperando ${DELAY_ENTRE_FUENTES / 1000}s antes de la siguiente fuente...`,
      )
      const steps = 10
      const stepDelay = DELAY_ENTRE_FUENTES / steps
      for (let s = 0; s < steps; s++) {
        if (!scrapingState.scrapeEnProgreso || scrapingState.scrapePausado) break
        await sleep(stepDelay)
      }
    }
  }

  scrapingState.scrapeEnProgreso = false
  scrapingState.scrapePausado = false
  scrapingState.estadoFase = 'listo'
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
