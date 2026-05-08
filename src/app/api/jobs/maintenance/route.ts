// POST /api/jobs/maintenance — Acciones correctivas del administrador
// Purge completados, purge fallidos, reclaim huerfanos

import { NextRequest, NextResponse } from 'next/server'
import { purgeCompleted, purgeFailed, reclaimOrphanJobs, countByEstado } from '@/lib/jobs/queue'
import { safeError } from '@/lib/rate-guard'

type MaintenanceAction = 'purge_completados' | 'purge_fallidos' | 'reclaim_huerfanos' | 'estado_cola'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { accion, dias, timeoutMin } = body as {
      accion?: string
      dias?: number
      timeoutMin?: number
    }

    if (!accion) {
      return NextResponse.json(
        { error: 'El campo "accion" es obligatorio' },
        { status: 400 },
      )
    }

    switch (accion as MaintenanceAction) {
      case 'purge_completados': {
        const days = Math.max(dias ?? 3, 1)
        const count = await purgeCompleted(days)
        return NextResponse.json({
          exito: true,
          mensaje: `${count} jobs completados eliminados (>${days} dias)`,
          eliminados: count,
        })
      }

      case 'purge_fallidos': {
        const days = Math.max(dias ?? 7, 1)
        const count = await purgeFailed(days)
        return NextResponse.json({
          exito: true,
          mensaje: `${count} jobs fallidos eliminados (>${days} dias)`,
          eliminados: count,
        })
      }

      case 'reclaim_huerfanos': {
        const timeoutMs = (timeoutMin ?? 10) * 60 * 1000
        const count = await reclaimOrphanJobs(timeoutMs)
        return NextResponse.json({
          exito: true,
          mensaje: count > 0
            ? `${count} jobs huerfanos recuperados y re-encolados`
            : 'No hay jobs huerfanos',
          recuperados: count,
        })
      }

      case 'estado_cola': {
        const porEstado = await countByEstado()
        return NextResponse.json({ exito: true, porEstado })
      }

      default:
        return NextResponse.json(
          {
            error: `Accion desconocida: "${accion}". Valores: purge_completados, purge_fallidos, reclaim_huerfanos, estado_cola`,
          },
          { status: 400 },
        )
    }
  } catch (error: unknown) {
    console.error('[API /jobs/maintenance POST]', error)
    return NextResponse.json({ error: safeError(error, 'jobs/maintenance') }, { status: 500 })
  }
}
