// API: Estadísticas de calidad del sistema
// GET — métricas de calidad: clasificación, texto original, duplicados, confianza

import { NextResponse } from 'next/server'
import db from '@/lib/db'

export async function GET() {
  try {
    const total = await db.mencion.count()

    // Clasificación
    const clasificadas = await db.mencion.count({
      where: { sentimiento: { not: 'no_clasificado' } },
    })
    const conEje = await db.mencion.count({
      where: { ejeEstructuralId: { not: null } },
    })
    const conTratamiento = await db.mencion.count({
      where: { tratamientoPeriodistico: { not: null } },
    })
    const conConfianza = await db.mencion.count({
      where: { confianzaClasificacion: { not: null } },
    })
    const conPersona = await db.mencion.count({
      where: { personaId: { not: null } },
    })
    const conTextoOriginal = await db.mencion.count({
      where: { textoCompleto: { not: '', gt: '' } },
    })
    const conTextoLargo = await db.mencion.count({
      where: { textoCompleto: { not: '', gt: '' } },
    })

    // Duplicados
    const marcadosDuplicado = await db.mencion.count({ where: { esDuplicado: true } })

    // Distribución de sentimiento
    const sentDist = await db.mencion.groupBy({
      by: ['sentimiento'],
      _count: true,
    })

    // Distribución de confianza
    const confDist = await db.mencion.groupBy({
      by: ['confianzaClasificacion'],
      where: { confianzaClasificacion: { not: null } },
      _count: true,
    })

    // Tratamiento periodístico
    const tratDist = await db.mencion.groupBy({
      by: ['tratamientoPeriodistico'],
      where: { tratamientoPeriodistico: { not: null } },
      _count: true,
    })

    // NotaRaw pendientes
    const notasPendientes = await db.notaRaw.count({
      where: { procesada: false, descartada: false },
    })
    const notasDescartadas = await db.notaRaw.count({
      where: { descartada: true },
    })

    return NextResponse.json({
      success: true,
      calidad: {
        total,
        clasificadas,
        sinClasificar: total - clasificadas,
        conEje,
        conTratamiento,
        conConfianza,
        conPersona,
        conTextoOriginal,
        marcadosDuplicado,
        // Porcentajes
        pctClasificadas: total > 0 ? Math.round((clasificadas / total) * 100) : 0,
        pctConEje: total > 0 ? Math.round((conEje / total) * 100) : 0,
        pctConTratamiento: total > 0 ? Math.round((conTratamiento / total) * 100) : 0,
        pctConTextoOriginal: total > 0 ? Math.round((conTextoOriginal / total) * 100) : 0,
        pctDuplicados: total > 0 ? Math.round((marcadosDuplicado / total) * 100) : 0,
      },
      distribucion: {
        sentimiento: sentDist.map(s => ({ valor: s.sentimiento, total: s._count })),
        confianza: confDist.map(c => ({ valor: c.confianzaClasificacion, total: c._count })),
        tratamiento: tratDist.map(t => ({ valor: t.tratamientoPeriodistico, total: t._count })),
      },
      pipeline: {
        notasPendientes,
        notasDescartadas,
      },
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[QUALITY-STATS]', msg)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
