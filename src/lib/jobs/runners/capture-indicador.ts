// Runner: capture_indicador - Captura de indicadores macroeconomicos
// DECODEX Bolivia
// Se ejecuta despues de que check_indicador confirma que el endpoint es accesible

import db from '@/lib/db'
import { capturarTier1 } from '@/lib/indicadores/capturer-tier1'
import type { JobPayload, RunnerResult } from '../types'

export async function run(payload: JobPayload): Promise<RunnerResult> {
  const indicadorId = payload.indicadorId as string
  const capturarTodos = payload.capturarTodos as boolean | undefined

  const startTime = Date.now()

  try {
    // Modo 1: Capturar todos los indicadores Tier 1
    if (capturarTodos || !indicadorId) {
      const resultado = await capturarTier1()
      const responseTime = Date.now() - startTime

      return {
        success: true,
        data: {
          modo: 'batch_tier1',
          exitosos: resultado.exitosos.map(r => ({
            slug: r.slug,
            valor: r.valorTexto,
            confiable: r.confiable,
          })),
          fallidos: resultado.fallidos.map(r => ({
            slug: r.slug,
            error: r.metadata,
          })),
          total: resultado.total,
          responseTime,
        },
      }
    }

    // Modo 2: Capturar un indicador especifico
    const indicador = await db.indicador.findUnique({
      where: { id: indicadorId },
    })

    if (!indicador) {
      return { success: false, error: `Indicador ${indicadorId} no encontrado` }
    }

    if (!indicador.activo) {
      return {
        success: true,
        data: { modo: 'individual', indicadorId, indicadorNombre: indicador.nombre, cambiado: false, detalle: 'Inactivo' },
      }
    }

    // Capturar todos y filtrar el que necesitamos
    const resultado = await capturarTier1()
    const capturaOk = resultado.exitosos.find(r => r.slug === indicador.slug)
    const capturaFail = resultado.fallidos.find(r => r.slug === indicador.slug)

    const responseTime = Date.now() - startTime

    if (!capturaOk && !capturaFail) {
      return {
        success: true,
        data: {
          modo: 'individual',
          indicadorId,
          indicadorNombre: indicador.nombre,
          cambiado: false,
          detalle: 'No se encontro captura para este indicador',
          responseTime,
        },
      }
    }

    // Si fallo la captura, reportar error parcial
    if (!capturaOk) {
      return {
        success: true,
        data: {
          modo: 'individual',
          indicadorId,
          indicadorNombre: indicador.nombre,
          cambiado: false,
          detalle: `Captura fallo: ${capturaFail!.error}`,
          responseTime,
        },
      }
    }

    // Registrar en FuenteEstado si existe
    if (indicador.url) {
      const fuenteEstado = await db.fuenteEstado.findUnique({
        where: { medioId: indicadorId },
      })
      if (fuenteEstado) {
        await db.fuenteEstado.update({
          where: { id: fuenteEstado.id },
          data: {
            ultimoCheck: new Date(),
            ultimoCambio: new Date(),
            totalChecks: { increment: 1 },
            totalCambios: { increment: 1 },
            responseTime,
          },
        })
      }
    }

    return {
      success: true,
      data: {
        modo: 'individual',
        indicadorId,
        indicadorNombre: indicador.nombre,
        slug: indicador.slug,
        valor: capturaOk.valorTexto,
        confiable: capturaOk.confiable,
        cambiado: true,
        responseTime,
      },
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    return { success: false, error: `capture_indicador fallo: ${msg}` }
  }
}

const handler = run

export default { handler }
