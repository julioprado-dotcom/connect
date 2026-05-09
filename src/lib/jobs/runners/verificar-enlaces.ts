// Runner: verificar_enlaces - Verificacion batch de enlaces en menciones
// DECODEX Bolivia
// Comprueba que los enlaces de menciones sigan activos

import db from '@/lib/db'
import { CHECK_FIRST_CONFIG } from '../constants'
import type { JobPayload, RunnerResult } from '../types'

export async function run(payload: JobPayload): Promise<RunnerResult> {
  const dias = payload.dias as number || 30
  const limite = payload.limite as number || 50

  const startTime = Date.now()

  try {
    // 1. Obtener menciones con enlaces a verificar
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - dias)

    const menciones = await db.mencion.findMany({
      where: {
        fechaCaptura: { gte: cutoff },
        url: { not: '' },
        enlaceActivo: true,
      },
      select: { id: true, url: true },
      take: limite,
    })

    if (menciones.length === 0) {
      return {
        success: true,
        data: { verificados: 0, rotos: 0, detalle: 'Sin enlaces para verificar' },
      }
    }

    // 2. Verificar cada enlace (HEAD request)
    let activos = 0
    let rotos = 0
    const errores: { mencionId: string; url: string; status: number; error: string }[] = []

    for (const mencion of menciones) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), CHECK_FIRST_CONFIG.timeoutMs)

        const response = await fetch(mencion.url, {
          method: 'HEAD',
          headers: { 'User-Agent': CHECK_FIRST_CONFIG.userAgent },
          signal: controller.signal,
          redirect: 'follow',
        })
        clearTimeout(timeoutId)

        if (response.ok || response.status === 301 || response.status === 302) {
          activos++
        } else if (response.status === 404 || response.status === 410) {
          rotos++
          await db.mencion.update({
            where: { id: mencion.id },
            data: { enlaceActivo: false },
          })
          errores.push({ mencionId: mencion.id, url: mencion.url, status: response.status, error: 'HTTP ' + response.status })
        } else {
          activos++ // Otros codigos no necesariamente son rotos
        }
      } catch {
        // Timeout o error de red
        rotos++
        errores.push({ mencionId: mencion.id, url: mencion.url, status: 0, error: 'Timeout o error de red' })
      }
    }

    const responseTime = Date.now() - startTime

    return {
      success: true,
      data: {
        verificados: menciones.length,
        activos,
        rotos,
        tasaRotos: menciones.length > 0 ? Math.round((rotos / menciones.length) * 100) / 100 : 0,
        errores: errores.slice(0, 10), // Solo los primeros 10 errores
        responseTime,
      },
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    return { success: false, error: `verificar_enlaces fallo: ${msg}` }
  }
}

const handler = run

export default { handler }
