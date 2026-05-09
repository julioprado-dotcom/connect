/**
 * GET /api/admin/status
 * Returns counts for all tables grouped by category, plus version info.
 */

import { NextResponse } from 'next/server'
import db from '@/lib/db'
import { safeError } from '@/lib/rate-guard'

async function countsByCategory() {
  const [persona, medio, ejeTematico, indicador] = await Promise.all([
    db.persona.count(),
    db.medio.count(),
    db.ejeTematico.count(),
    db.indicador.count(),
  ])

  const [mencion, mencionTema, comentario, reporte, capturaLog] = await Promise.all([
    db.mencion.count(),
    db.mencionTema.count(),
    db.comentario.count(),
    db.reporte.count(),
    db.capturaLog.count(),
  ])

  const [indicadorValor, indicadorEvaluacion] = await Promise.all([
    db.indicadorValor.count(),
    db.indicadorEvaluacion.count(),
  ])

  const [cliente, contrato, suscriptorGratuito, entrega] = await Promise.all([
    db.cliente.count(),
    db.contrato.count(),
    db.suscriptorGratuito.count(),
    db.entrega.count(),
  ])

  const [job, fuenteEstado] = await Promise.all([
    db.job.count(),
    db.fuenteEstado.count(),
  ])

  return {
    referencia: { persona, medio, ejeTematico, indicador },
    monitoreo: { mencion, mencionTema, comentario, reporte, capturaLog },
    indicadoresDatos: { indicadorValor, indicadorEvaluacion },
    clientes: { cliente, contrato, suscriptorGratuito, entrega },
    sistema: { job, fuenteEstado },
  }
}

export async function GET() {
  try {
    const counts = await countsByCategory()

    return NextResponse.json({
      version: '0.9.0',
      timestamp: new Date().toISOString(),
      ...counts,
    })
  } catch (error) {
    return NextResponse.json(
      { exito: false, error: safeError(error, 'admin/status') },
      { status: 500 }
    )
  }
}
