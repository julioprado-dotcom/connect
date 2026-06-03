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
const DELAY_ENTRE_BATCHES = 3000   // 3s entre batches de distintas fuentes
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
    const notasPendientes = await db.notaRaw.findMany({
      where: {
        procesada: false,
        descartada: false,
      },
      orderBy: { puntajeTriaje: 'desc' },  // Priorizar notas con mejor triaje
    })

    if (notasPendientes.length === 0) {
      console.log(`[batch-llm] Sin notas pendientes. Fin.`)
      return { success: true, data: { procesadas: 0, menciones: 0, fuentes: 0 } }
    }

    console.log(`[batch-llm] ${notasPendientes.length} notas pendientes de ${new Set(notasPendientes.map(n => n.medioId)).size} fuentes`)

    // 2. Agrupar por medioId (tomar hasta MAX_NOTAS_POR_MEDIO por medio)
    const porMedio = new Map<string, typeof notasPendientes>()
    let notasDropped = 0
    for (const nota of notasPendientes) {
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
            // Enviar al LLM individualmente (reutiliza extractor existente)
            const resultado = await extraerMencionesDeTexto(nota.texto, medioId)
            menciones = await crearMencionesExtraidas(
              resultado, medioId, nota.url, nota.titulo,
              { fechaCaptura: nota.fechaCaptura, fechaClasificacion: new Date() },
              nota.texto, // texto original completo de NotaRaw
            )

            // Éxito: marcar como procesada
            await db.notaRaw.update({
              where: { id: nota.id },
              data: {
                procesada: true,
                fechaProcesada: new Date(),
                mencionesCreadas: menciones,
                ...(menciones === 0 ? { descartada: true } : {}),
              },
            })

            procesada = true
            break // Salir del loop de reintentos
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err)
            const isRateLimit = msg.includes('429') || msg.includes('rate') || msg.includes('quota')
            const isTimeout = msg.includes('timeout') || msg.includes('Timeout') || msg.includes('Abort')
            const isTransient = isRateLimit || isTimeout

            console.error(`[batch-llm] Error (intento ${intento}/${MAX_REINTENTOS}) nota ${nota.id.substring(0, 8)}: ${msg.substring(0, 150)}`)

            if (intento < MAX_REINTENTOS && isTransient) {
              // Error transitorio: esperar y reintentar
              console.log(`[batch-llm] Reintentando en ${RETRY_DELAY/1000}s (error transitorio: ${isRateLimit ? 'rate_limit' : 'timeout'})...`)
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
    const notasRestantes = notasPendientes.length - totalProcesadas - notasDropped
    await db.systemLog.create({
      data: {
        modulo: 'batch_llm',
        accion: 'procesar_notas',
        detalle: `${totalProcesadas} notas procesadas, ${totalMenciones} menciones, ${fuentesProcesadas} fuentes, ${totalDescartadas} descartadas`,
        automatica: true,
        datos: JSON.stringify({
          procesadas: totalProcesadas,
          menciones: totalMenciones,
          descartadas: totalDescartadas,
          fuentes: fuentesProcesadas,
          restantes: Math.max(0, notasRestantes),
          droppedPorLimite: notasDropped,
          duracionMs: Date.now() - startTime,
        }),
      },
    }).catch(() => {})

    console.log(`[batch-llm] Completado: ${totalProcesadas}/${notasPendientes.length} notas, ${totalMenciones} menciones, ${fuentesProcesadas} fuentes [${Date.now() - startTime}ms]`)

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
