/**
 * POST /api/admin/purge
 * Purges test/QA data while preserving historical analytical data.
 * Requires { "confirm": true } in the body to execute.
 */

import { NextResponse } from 'next/server'
import db from '@/lib/db'
import { safeError } from '@/lib/rate-guard'

// Tables to DELETE (test data)
const TABLES_TO_DELETE = [
  'entrega',
  'contrato',
  'suscriptorGratuito',
  'cliente',
  'indicadorEvaluacion',
] as const

// Tables to PRESERVE (historical analytical data)
const TABLES_TO_PRESERVE = [
  'mencion',
  'mencionTema',
  'comentario',
  'reporte',
  'capturaLog',
  'indicadorValor',
  'indicador',
  'persona',
  'medio',
  'ejeTematico',
  'job',
  'fuenteEstado',
] as const

async function countTable(table: string): Promise<number> {
  return (db as unknown as Record<string, { count: () => Promise<number> }>)[table].count()
}

async function deleteTable(table: string): Promise<number> {
  const { count } = await (db as unknown as Record<string, { deleteMany: () => Promise<{ count: number }> }>)[table].deleteMany()
  return count
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const confirmed = body?.confirm === true

    // Count records in tables to be deleted
    const deleteCounts: Record<string, number> = {}
    for (const table of TABLES_TO_DELETE) {
      deleteCounts[table] = await countTable(table)
    }

    // Count records in preserved tables
    const preserveCounts: Record<string, number> = {}
    for (const table of TABLES_TO_PRESERVE) {
      preserveCounts[table] = await countTable(table)
    }

    // If not confirmed, return a preview
    if (!confirmed) {
      return NextResponse.json({
        confirmado: false,
        mensaje: 'Purge no ejecutado. Enviar { "confirm": true } para ejecutar.',
        seEliminarian: deleteCounts,
        sePreservarian: preserveCounts,
        totalAEliminar: Object.values(deleteCounts).reduce((a, b) => a + b, 0),
        timestamp: new Date().toISOString(),
      })
    }

    // Execute purge respecting foreign key order:
    // entrega -> contrato -> suscriptorGratuito -> cliente -> indicadorEvaluacion
    const deleted: Record<string, number> = {}

    deleted.entrega = await deleteTable('entrega')
    deleted.contrato = await deleteTable('contrato')
    deleted.suscriptorGratuito = await deleteTable('suscriptorGratuito')
    deleted.cliente = await deleteTable('cliente')
    deleted.indicadorEvaluacion = await deleteTable('indicadorEvaluacion')

    const totalDeleted = Object.values(deleted).reduce((a, b) => a + b, 0)

    return NextResponse.json({
      confirmado: true,
      mensaje: `Purge ejecutado: ${totalDeleted} registros eliminados`,
      eliminados: deleted,
      totalEliminados: totalDeleted,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json(
      { exito: false, error: safeError(error, 'admin/purge') },
      { status: 500 }
    )
  }
}
