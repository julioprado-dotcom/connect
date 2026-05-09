// GET /api/jobs/stats - Full statistics dashboard data

import { NextResponse } from 'next/server'
import { getFullStats } from '@/lib/jobs/health'
import { getSchedulerStatus } from '@/lib/jobs/scheduler'
import { ensureWorkerRunning } from '@/lib/jobs'
import { safeError } from '@/lib/rate-guard'

export async function GET() {
  try {
    // Asegurar que el worker esté corriendo (Next.js Turbopack aislación de módulos)
    ensureWorkerRunning()
    const [fullStats, scheduler] = await Promise.all([
      getFullStats(),
      Promise.resolve(getSchedulerStatus()),
    ])

    return NextResponse.json({
      cola: fullStats.cola,
      worker: fullStats.worker,
      checkFirst: fullStats.checkFirst,
      fuentes: fullStats.fuentes,
      scheduler,
    })
  } catch (error: unknown) {
    console.error('[API /jobs/stats GET]', error)
    return NextResponse.json({ error: safeError(error, 'jobs/stats') }, { status: 500 })
  }
}
