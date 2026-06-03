// API: Re-clasificar mención (sentimiento, tratamiento, ejes)
// POST — forzar re-clasificación de una mención por ID

import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { reclasificarMencion } from '@/lib/clasificador-v2'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { mencionId, sentimiento, tratamiento, ejeId, accion } = body

    if (!mencionId) {
      return NextResponse.json({ success: false, error: 'Se requiere mencionId' }, { status: 400 })
    }

    // Verificar que existe
    const mencion = await db.mencion.findUnique({ where: { id: mencionId } })
    if (!mencion) {
      return NextResponse.json({ success: false, error: 'Mencion no encontrada' }, { status: 404 })
    }

    const cambios: Record<string, unknown> = {}

    if (accion === 'reclasificar_auto') {
      // Usar el clasificador v2 para re-clasificar
      await reclasificarMencion(mencionId)
      const actualizada = await db.mencion.findUnique({ where: { id: mencionId } })
      return NextResponse.json({
        success: true,
        accion: 'reclasificacion_auto',
        mencion: {
          id: actualizada?.id,
          sentimiento: actualizada?.sentimiento,
          ejeEstructuralId: actualizada?.ejeEstructuralId,
          tratamiento: actualizada?.tratamientoPeriodistico,
        },
      })
    }

    if (accion === 'actualizar_manual') {
      // Actualizar campos manualmente
      if (sentimiento) cambios.sentimiento = sentimiento
      if (tratamiento) cambios.tratamientoPeriodistico = tratamiento
      if (ejeId) cambios.ejeEstructuralId = ejeId

      if (Object.keys(cambios).length > 0) {
        await db.mencion.update({
          where: { id: mencionId },
          data: cambios,
        })
      }

      return NextResponse.json({
        success: true,
        accion: 'actualizacion_manual',
        cambios,
      })
    }

    return NextResponse.json({ success: false, error: `Accion desconocida: ${accion}` }, { status: 400 })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[QUALITY-RECLASSIFY]', msg)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
