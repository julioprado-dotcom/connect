// Runner: mantenimiento - Tareas de mantenimiento periodico
// DECODEX Bolivia
// Se ejecuta diariamente a las 04:00 AM via scheduler
//
// REGLA CRÍTICA: NUNCA eliminar datos sin backup previo.
// Antes de cualquier purge, se crea snapshot + archive.

import db from '@/lib/db'
import { purgeCompleted, purgeFailed } from '../queue'
import { batchDegradar } from '../frequency/adapter'
import { batchRecalcularHorarios } from '../histogram/tracker'
import type { JobPayload, RunnerResult, MantenimientoResult, TareaMantenimiento } from '../types'
import { QUEUE_LIMITS } from '../constants'
import { createSnapshot, archiveBeforePurge } from '@/lib/backup'

export async function run(payload: JobPayload): Promise<RunnerResult> {
  const tareas = (payload.tareas as TareaMantenimiento[]) || [
    'recalcular_horarios',
    'degradar_fuentes',
    'limpiar_jobs',
  ]

  const startTime = Date.now()
  const resultados: MantenimientoResult[] = []

  // ── PRE-FLIGHT: Si hay tareas destructivas, crear snapshot + archive ──
  const tareasDestructivas = ['limpiar_jobs', 'purge_menciones', 'limpiar_logs']
  const hayDestruccion = tareas.some(t => tareasDestructivas.includes(t))

  if (hayDestruccion) {
    try {
      console.log('[Mantenimiento] Creando snapshot de seguridad antes de purge...')
      const snap = await createSnapshot('pre-mantenimiento-purge')

      if (snap.success) {
        resultados.push({
          tarea: 'backup_snapshot',
          completada: true,
          detalle: `Snapshot creado: ${snap.archivo} (${snap.tamanio})`,
        })
      } else {
        resultados.push({
          tarea: 'backup_snapshot',
          completada: false,
          detalle: `Error creando snapshot: ${snap.error}`,
        })
        // NO continuar con purge si el backup falló
        console.error('[Mantenimiento] ABORTADO: No se pudo crear snapshot. Purge cancelado.')
        return {
          success: false,
          data: {
            tareasEjecutadas: resultados.length,
            tareasCompletadas: 0,
            resultados,
            responseTime: Date.now() - startTime,
          },
        }
      }

      // Archive JSON de las tablas que van a ser purgadas
      const archive = await archiveBeforePurge(['Job', 'CapturaLog', 'Mencion', 'IndicadorValor'])
      if (archive.success) {
        const totalRegistros = Object.values(archive.registros).reduce((a, b) => a + b, 0)
        resultados.push({
          tarea: 'backup_archive',
          completada: true,
          detalle: `Archive creado: ${totalRegistros} registros en ${Object.keys(archive.registros).length} tablas`,
        })
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error)
      resultados.push({
        tarea: 'backup_snapshot',
        completada: false,
        detalle: `Error crítico en backup: ${msg}. Purge cancelado.`,
      })
      console.error(`[Mantenimiento] ABORTADO: ${msg}`)
      return {
        success: false,
        data: {
          tareasEjecutadas: resultados.length,
          tareasCompletadas: 0,
          resultados,
          responseTime: Date.now() - startTime,
        },
      }
    }
  }

  // ── EJECUTAR TAREAS ──
  for (const tarea of tareas) {
    try {
      const resultado = await ejecutarTarea(tarea)
      resultados.push(resultado)
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error)
      resultados.push({ tarea, completada: false, detalle: `Error: ${msg}` })
    }
  }

  const responseTime = Date.now() - startTime

  return {
    success: true,
    data: {
      tareasEjecutadas: resultados.length,
      tareasCompletadas: resultados.filter(r => r.completada).length,
      resultados,
      responseTime,
    },
  }
}

// Ejecutar una tarea individual de mantenimiento
async function ejecutarTarea(tarea: TareaMantenimiento): Promise<MantenimientoResult> {
  switch (tarea) {
    case 'recalcular_horarios': {
      const count = await batchRecalcularHorarios()
      return {
        tarea,
        completada: true,
        detalle: `Horarios recalculados para ${count} fuentes`,
      }
    }

    case 'degradar_fuentes': {
      const count = await batchDegradar()
      return {
        tarea,
        completada: true,
        detalle: `${count} fuentes degradadas por inactividad`,
      }
    }

    case 'limpiar_logs': {
      // Archivar los logs que van a ser eliminados
      const cutoffLog = new Date()
      cutoffLog.setDate(cutoffLog.getDate() - QUEUE_LIMITS.capturaLogRetentionDays)

      // Contar cuántos se van a eliminar para el reporte
      const countToDelete = await db.capturaLog.count({
        where: { fecha: { lt: cutoffLog } },
      })

      const result = await db.capturaLog.deleteMany({
        where: { fecha: { lt: cutoffLog } },
      })
      return {
        tarea,
        completada: true,
        detalle: `${result.count} logs de captura eliminados (> ${QUEUE_LIMITS.capturaLogRetentionDays} dias) [archivados en backup previo]`,
      }
    }

    case 'purge_menciones': {
      // Limpiar texto de menciones antiguas (6 meses)
      const cutoffMencion = new Date()
      cutoffMencion.setMonth(cutoffMencion.getMonth() - QUEUE_LIMITS.mencionTextRetentionMonths)
      const menciones = await db.mencion.findMany({
        where: { fechaCaptura: { lt: cutoffMencion } },
        select: { id: true },
        take: 500, // batch
      })
      for (const m of menciones) {
        await db.mencion.update({
          where: { id: m.id },
          data: { textoCompleto: '', comentariosResumen: '' },
        })
      }
      return {
        tarea,
        completada: true,
        detalle: `Texto limpiado en ${menciones.length} menciones (> ${QUEUE_LIMITS.mencionTextRetentionMonths} meses) [archivados en backup previo]`,
      }
    }

    case 'limpiar_jobs': {
      // purgeCompleted y purgeFailed ahora reciben retención de constants
      const completados = await purgeCompleted(QUEUE_LIMITS.jobRetentionDays)
      const fallidos = await purgeFailed(7)
      return {
        tarea,
        completada: true,
        detalle: `${completados} completados y ${fallidos} fallidos purgados [archivados en backup previo]`,
      }
    }

    case 'recalcular_scheduler': {
      // Reprogramar todas las fuentes sin reiniciar el worker
      const { rescheduleAll } = await import('../scheduler')
      await rescheduleAll()
      return {
        tarea,
        completada: true,
        detalle: 'Scheduler reprogramado con horarios actualizados',
      }
    }

    default: {
      return { tarea, completada: false, detalle: `Tarea desconocida: ${tarea}` }
    }
  }
}

const handler = run

export default { handler }
