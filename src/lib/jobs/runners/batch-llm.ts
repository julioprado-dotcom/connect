// Runner: batch_llm — FASE 2 del sistema desacoplado
// DECODEX Bolivia v0.16.0
//
// Lee NotaRaw pendientes → agrupa por medioId → 1 llamada LLM por batch → crea menciones.
// Se ejecuta vía cron cada 45 minutos. No se dispara desde scraping.

import db from '@/lib/db'
import type { JobPayload, RunnerResult } from '../types'
import { extraerMencionesDeTexto, crearMencionesExtraidas } from '@/lib/ai/extractor-menciones'
import { registrarRechazo } from '@/lib/registrar-rechazo'

// ─── Configuración ───────────────────────────────────────────

const MAX_NOTAS_POR_BATCH = 10   // Max notas por fuente en un solo batch LLM
const MAX_BACHES_POR_EJECUCION = 8  // Limitar cuántas fuentes procesar por ejecución
const DELAY_ENTRE_BATCHES = 5000  // 5s entre batches de distintas fuentes

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

    // 2. Agrupar por medioId
    const porMedio = new Map<string, typeof notasPendientes>()
    for (const nota of notasPendientes) {
      const existing = porMedio.get(nota.medioId)
      if (existing) {
        if (existing.length < MAX_NOTAS_POR_BATCH) {
          existing.push(nota)
        }
      } else {
        porMedio.set(nota.medioId, [nota])
      }
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

      for (const nota of notas) {
        try {
          // Enviar al LLM individualmente (reutiliza extractor existente)
          // NOTA: En el futuro se puede optimizar a batch de varias notas en 1 prompt
          const resultado = await extraerMencionesDeTexto(nota.texto, medioId)
          const menciones = await crearMencionesExtraidas(resultado, medioId, nota.url, nota.titulo)

          mencionesFuente += menciones
          totalMenciones += menciones

          // Marcar como procesada
          await db.notaRaw.update({
            where: { id: nota.id },
            data: {
              procesada: true,
              fechaProcesada: new Date(),
              mencionesCreadas: menciones,
              ...(menciones === 0 ? { descartada: true } : {}),
            },
          })

          totalProcesadas++
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err)
          console.error(`[batch-llm] Error procesando nota ${nota.id.substring(0, 8)}: ${msg}`)

          // Marcar como procesada (con error) para no reintentar indefinidamente
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

      if (mencionesFuente > 0) {
        console.log(`[batch-llm] ✓ Fuente ${medioId.substring(0, 8)}: ${mencionesFuente} menciones`)
      }

      fuentesProcesadas++
    }

    // 4. Registrar en SystemLog (auditoría)
    const notasRestantes = notasPendientes.length - totalProcesadas
    await db.systemLog.create({
      data: {
        modulo: 'batch_llm',
        accion: 'procesar_notas',
        detalle: `${totalProcesadas} notas procesadas, ${totalMenciones} menciones, ${fuentesProcesadas} fuentes`,
        automatica: true,
        datos: JSON.stringify({
          procesadas: totalProcesadas,
          menciones: totalMenciones,
          descartadas: totalDescartadas,
          fuentes: fuentesProcesadas,
          restantes: notasRestantes,
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
