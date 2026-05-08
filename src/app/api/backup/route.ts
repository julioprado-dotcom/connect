// API: /api/backup — Backup manual, listado, restauración
// DECODEX Bolivia — Sistema de Backup y Archivo

import { NextResponse } from 'next/server'
import {
  createSnapshot,
  listBackups,
  restoreFromSnapshot,
  getBackupSummary,
  archiveBeforePurge,
} from '@/lib/backup'

// GET /api/backup — Listar backups + resumen del sistema
export async function GET() {
  try {
    const [backups, summary] = await Promise.all([
      listBackups(),
      getBackupSummary(),
    ])

    return NextResponse.json({
      success: true,
      summary,
      backups: backups.slice(0, 50), // últimos 50
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error(`[API /backup] GET error: ${msg}`)
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    )
  }
}

// POST /api/backup — Crear backup manual
// Body: { accion: 'snapshot' | 'archive' | 'full', razon?: string }
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const accion = body.accion || 'full'
    const razon = body.razon || 'manual-api'

    if (accion === 'snapshot' || accion === 'full') {
      const snap = await createSnapshot(razon)
      if (!snap.success) {
        return NextResponse.json(
          { success: false, error: snap.error },
          { status: 500 }
        )
      }

      if (accion === 'full') {
        const archive = await archiveBeforePurge()
        return NextResponse.json({
          success: true,
          snapshot: snap,
          archive: {
            registros: archive.registros,
            timestamp: archive.timestamp,
          },
        })
      }

      return NextResponse.json({
        success: true,
        snapshot: snap,
      })
    }

    if (accion === 'archive') {
      const archive = await archiveBeforePurge()
      if (!archive.success) {
        return NextResponse.json(
          { success: false, error: archive.error },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        archive: {
          registros: archive.registros,
          timestamp: archive.timestamp,
        },
      })
    }

    return NextResponse.json(
      { success: false, error: `Acción desconocida: ${accion}` },
      { status: 400 }
    )
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error(`[API /backup] POST error: ${msg}`)
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    )
  }
}

// PATCH /api/backup — Restaurar desde snapshot
// Body: { archivo: 'snapshot-YYYYMMDD-HHMMSS.db' }
export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const archivo = body.archivo

    if (!archivo || typeof archivo !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Campo "archivo" requerido' },
        { status: 400 }
      )
    }

    // Validar que el archivo existe en backups/
    const backups = await listBackups()
    const existe = backups.some(b => b.tipo === 'snapshot' && b.archivo === archivo)

    if (!existe) {
      return NextResponse.json(
        { success: false, error: `Snapshot "${archivo}" no encontrado` },
        { status: 404 }
      )
    }

    const result = await restoreFromSnapshot(archivo)

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      mensaje: `DB restaurada desde ${archivo}. Se creó backup pre-restore automáticamente.`,
      snapshotUsado: result.snapshotUsado,
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error(`[API /backup] PATCH error: ${msg}`)
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    )
  }
}
