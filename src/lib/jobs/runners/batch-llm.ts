// Runner: batch_llm — FASE 2 del sistema desacoplado
// DECODEX Bolivia v0.16.0
//
// Lee NotaRaw pendientes → agrupa por medioId → 1 llamada LLM por batch → crea menciones.
// Se ejecuta vía cron cada 45 minutos. No se dispara desde scraping.
//
// CADENA DE FECHAS (3 timestamps separados):
//   NotaRaw.fechaCaptura     → cuándo se scrapeó el artículo
//   Mencion.fechaCaptura     → copia de NotaRaw.fechaCaptura (fecha real de captura)
//   Mencion.fechaClasificacion → cuándo el LLM clasificó la nota (fecha de procesamiento)
//   Mencion.fechaPublicacion  → fecha de publicación del medio (cuándo está disponible)
//
// ANTES: Mencion.fechaCaptura = now() al crear → datos de "hoy" engañosos
// AHORA: Mencion.fechaCaptura = fecha real del scrape (de NotaRaw)

import db from '@/lib/db'
import type { JobPayload, RunnerResult } from '../types'
import { extraerMencionesDeTexto, crearMencionesExtraidas } from '@/lib/ai/extractor-menciones'
import { registrarRechazo } from '@/lib/registrar-rechazo'

// ─── Configuración ───────────────────────────────────────────

const MAX_NOTAS_POR_MEDIO = 20    // Max notas por medio en una sola ejecución
const MAX_BACHES_POR_EJECUCION = 30 // Procesar TODAS las fuentes (antes era 8)
const DELAY_ENTRE_BATCHES = 5000   // 5s entre batches de distintas fuentes (reducir 429 rate limit)
const MAX_REINTENTOS = 3           // Max reintentos antes de descartar una nota
const RETRY_DELAY = 10000         // 10s entre reintentos de la misma nota

// ─── Runner principal ────────────────────────────────────────

export async function run(payload: JobPayload): Promise<RunnerResult> {
  const startTime = Date.now()
  let totalProcesadas = 0
  let totalMenciones = 0
  let totalDescartadas = 0
  let fuentesProcesadas = 0

  try {
    // 1. Leer notas pendientes, agrupadas por medioId
    // FIX MEMORIA: Limitar a 150 notas por batch para evitar OOM en 2GB VPS
    const notasPendientes = await db.notaRaw.findMany({
      where: {
        procesada: false,
        descartada: false,
      },
      orderBy: { puntajeTriaje: 'desc' },  // Priorizar notas con mejor triaje
      take: 150,  // FIX: paginar — no cargar todas las pendientes en memoria
    })

    // 1b. DEDUP: Eliminar notas duplicadas (misma URL ya procesada o pendiente duplicada)
    //    Esto evita enviar al LLM notas que generarían menciones duplicadas
    const urlsVistas = new Set<string>()
    const urlsYaProcesadas = new Set<string>()
    
    // Obtener URLs ya existentes en Mencion (para no reprocesar)
    if (notasPendientes.length > 0) {
      const urlsNotas = notasPendientes.map(n => n.url)
      const existentes = await db.mencion.findMany({
        where: { url: { in: urlsNotas } },
        select: { url: true },
      })
      for (const e of existentes) urlsYaProcesadas.add(e.url)
    }

    const notasFiltradas = notasPendientes.filter(nota => {
      // Ya existe mencion para esta URL → descartar nota
      if (urlsYaProcesadas.has(nota.url)) return false
      // URL duplicada entre pendientes → mantener solo la primera (mayor puntaje)
      if (urlsVistas.has(nota.url)) return false
      urlsVistas.add(nota.url)
      return true
    })

    const notasDedupDescartadas = notasPendientes.length - notasFiltradas.length
    if (notasDedupDescartadas > 0) {
      // Marcar duplicados de NotaRaw como descartadas
      const urlsDuplicadas = notasPendientes
        .filter(n => !notasFiltradas.some(f => f.id === n.id))
        .map(n => n.id)
      
      // En batches de 50 para no saturar
      for (let i = 0; i < urlsDuplicadas.length; i += 50) {
        await db.notaRaw.updateMany({
          where: { id: { in: urlsDuplicadas.slice(i, i + 50) } },
          data: { procesada: true, descartada: true, fechaProcesada: new Date() },
        })
      }
      
      console.log(`[batch-llm] ${notasDedupDescartadas} notas descartadas por dedup (URL ya procesada o duplicada)`)
    }

    if (notasFiltradas.length === 0) {
      console.log(`[batch-llm] Sin notas pendientes (o todas duplicadas). Fin.`)
      return { success: true, data: { procesadas: 0, menciones: 0, fuentes: 0 } }
    }

    console.log(`[batch-llm] ${notasFiltradas.length} notas pendientes de ${new Set(notasFiltradas.map(n => n.medioId)).size} fuentes`)

    // 2. Agrupar por medioId (tomar hasta MAX_NOTAS_POR_MEDIO por medio)
    const porMedio = new Map<string, typeof notasFiltradas>()
    let notasDropped = 0
    for (const nota of notasFiltradas) {
      const existing = porMedio.get(nota.medioId)
      if (existing) {
        if (existing.length < MAX_NOTAS_POR_MEDIO) {
          existing.push(nota)
        } else {
          notasDropped++
        }
      } else {
        porMedio.set(nota.medioId, [nota])
      }
    }

    if (notasDropped > 0) {
      console.log(`[batch-llm] ${notasDropped} notas exceden limite por medio, se procesaran en proximo ciclo`)
    }

    // 3. Procesar cada fuente (con límite por ejecución)
    const medios = Array.from(porMedio.entries())
    const limit = Math.min(medios.length, MAX_BACHES_POR_EJECUCION)

    for (let i = 0; i < limit; i++) {
      const [medioId, notas] = medios[i]

      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, DELAY_ENTRE_BATCHES))
      }

      console.log(`[batch-llm] Procesando ${notas.length} notas de fuente ${i + 1}/${limit} (${medioId.substring(0, 8)}...)`)

      let mencionesFuente = 0
      let erroredNotas = 0

      for (const nota of notas) {
        let procesada = false
        let menciones = 0

        for (let intento = 1; intento <= MAX_REINTENTOS; intento++) {
          try {
            // FIX: Marcar como procesada ANTES de la extracción para evitar
            // que DEDUP CAPA 0 encuentre esta misma nota como "pendiente"
            // y la bloquee (auto-dedup bug al resetear notas descartadas)
            await db.notaRaw.update({
              where: { id: nota.id },
              data: { procesada: true, fechaProcesada: new Date() },
            })

            // Enviar al LLM individualmente (reutiliza extractor existente)
            const resultado = await extraerMencionesDeTexto(nota.texto, medioId)
            menciones = await crearMencionesExtraidas(
              resultado, medioId, nota.url, nota.titulo,
              { fechaCaptura: nota.fechaCaptura, fechaClasificacion: new Date() },
              nota.texto, // texto original completo de NotaRaw
              nota.id,   // FIX: pasar notaRawId para excluir del DEDUP CAPA 0
            )

            // Actualizar mencionesCreadas y descartada
            await db.notaRaw.update({
              where: { id: nota.id },
              data: {
                mencionesCreadas: menciones,
                ...(menciones === 0 ? { descartada: true } : {}),
              },
            })

            // FIX: Log LLM response for debugging descartadas (batch-llm no registraba antes)
            // FIX: Determinar motivo correcto — si LLM dijo relevante pero menciones=0, es dedup
            if (menciones === 0) {
              const motivo = resultado.es_relevante ? 'duplicado' : 'es_relevante_false'
              registrarRechazo({
                medioId,
                url: nota.url,
                titulo: nota.titulo,
                texto: nota.texto.substring(0, 500),
                motivo,
                respuestaLLM: JSON.stringify(resultado).substring(0, 500),
                resultado: {
                  es_relevante: resultado.es_relevante,
                  tratamientoPeriodistico: resultado.tratamientoPeriodistico,
                  sentimiento_general: resultado.sentimiento_general,
                  confianzaClasificacion: resultado.confianzaClasificacion,
                },
              }).catch(() => {}) // Non-critical — no bloquear el batch
            }

            procesada = true
            break // Salir del loop de reintentos
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err)
            const isRateLimit = msg.includes('429') || msg.includes('rate') || msg.includes('quota')
            const isTimeout = msg.includes('timeout') || msg.includes('Timeout') || msg.includes('Abort')
            const isServerError = msg.includes('500') || msg.includes('status 500')
            const isCircuitBreaker = msg.includes('CIRCUIT_BREAKER_OPEN')
            const isTransient = isRateLimit || isTimeout || isServerError || isCircuitBreaker

            console.error(`[batch-llm] Error (intento ${intento}/${MAX_REINTENTOS}) nota ${nota.id.substring(0, 8)}: ${msg.substring(0, 150)}`)

            if (isCircuitBreaker) {
              // Circuit breaker abierto → NO reintentar, dejar para próximo ciclo
              console.warn(`[batch-llm] Nota ${nota.id.substring(0, 8)} skipeada: circuit breaker abierto. Se reintentará en proximo ciclo.`)
              erroredNotas++
              break
            }

            if (intento < MAX_REINTENTOS && isTransient) {
              // Error transitorio: esperar y reintentar
              const tipoError = isRateLimit ? 'rate_limit' : isServerError ? 'server_500' : 'timeout'
              console.log(`[batch-llm] Reintentando en ${RETRY_DELAY/1000}s (error transitorio: ${tipoError})...`)
              await new Promise(resolve => setTimeout(resolve, RETRY_DELAY))
              continue
            }

            // Último intento o error no transitorio: marcar como descartada SOLO si no es parseable
            if (intento === MAX_REINTENTOS) {
              if (isTransient) {
                // Error transitorio persistente → NO descartar, dejar para próximo ciclo
                console.warn(`[batch-llm] Nota ${nota.id.substring(0, 8)} con error transitorio persistente, se reintentará en proximo ciclo`)
                erroredNotas++
              } else {
                // Error permanente (parse, DB, etc.) → descartar
                console.warn(`[batch-llm] Nota ${nota.id.substring(0, 8)} descartada: error permanente (${msg.substring(0, 80)})`)
                await db.notaRaw.update({
                  where: { id: nota.id },
                  data: {
                    procesada: true,
                    fechaProcesada: new Date(),
                    descartada: true,
                  },
                })
                totalDescartadas++
                totalProcesadas++
              }
            }
          }
        }

        if (procesada) {
          mencionesFuente += menciones
          totalMenciones += menciones
          totalProcesadas++
        }
      }

      console.log(`[batch-llm] ✓ Fuente ${medioId.substring(0, 8)}: ${mencionesFuente} menciones, ${erroredNotas} errores transitorios`)

      fuentesProcesadas++
    }

    // 4. Registrar en SystemLog (auditoría)
    const notasRestantes = notasFiltradas.length - totalProcesadas - notasDropped
    await db.systemLog.create({
      data: {
        modulo: 'batch_llm',
        accion: 'procesar_notas',
        detalle: `${totalProcesadas} notas procesadas, ${totalMenciones} menciones, ${fuentesProcesadas} fuentes, ${totalDescartadas} descartadas, ${notasDedupDescartadas} dedup`,
        automatica: true,
        datos: JSON.stringify({
          procesadas: totalProcesadas,
          menciones: totalMenciones,
          descartadas: totalDescartadas,
          fuentes: fuentesProcesadas,
          restantes: Math.max(0, notasRestantes),
          droppedPorLimite: notasDropped,
          dedupDescartadas: notasDedupDescartadas,
          duracionMs: Date.now() - startTime,
        }),
      },
    }).catch(() => {})

    console.log(`[batch-llm] Completado: ${totalProcesadas}/${notasFiltradas.length} notas, ${totalMenciones} menciones, ${fuentesProcesadas} fuentes [${Date.now() - startTime}ms]`)

    return {
      success: true,
      data: {
        procesadas: totalProcesadas,
        menciones: totalMenciones,
        descartadas: totalDescartadas,
        fuentes: fuentesProcesadas,
        restantes: notasRestantes,
        responseTime: Date.now() - startTime,
      },
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error(`[batch-llm] Error fatal: ${msg}`)

    await db.systemLog.create({
      data: {
        modulo: 'batch_llm',
        accion: 'error',
        detalle: msg.substring(0, 500),
        automatica: true,
      },
    }).catch(() => {})

    return { success: false, error: msg }
  }
}
