// API: Fusionar duplicados inteligentemente
// POST — fusionar grupo de duplicados manteniendo el mejor clasificado
//   Transfiere datos del eliminado al mantenido (ejes, temas, lentes faltantes)

import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { grupoIds, mantenerId } = body

    if (!grupoIds || !Array.isArray(grupoIds) || grupoIds.length < 2) {
      return NextResponse.json({ success: false, error: 'Se requiere al menos 2 IDs para fusionar' }, { status: 400 })
    }

    // Determinar cuál mantener: el mejor clasificado o el explícito
    const menciones = await db.mencion.findMany({
      where: { id: { in: grupoIds } },
      select: {
        id: true, ejeEstructuralId: true, sentimiento: true,
        tratamientoPeriodistico: true, confianzaClasificacion: true,
        textoCompleto: true, personaId: true, tipoMencion: true,
        preguntasFundamentales: true, fechaClasificacion: true,
        MencionTema: { select: { ejeTematicoId: true } },
        MencionLente: { select: { lenteId: true } },
      },
    })

    if (menciones.length < 2) {
      return NextResponse.json({ success: false, error: 'No se encontraron suficientes menciones' }, { status: 400 })
    }

    // Score para elegir la mejor
    const mejor = mantenerId
      ? menciones.find(m => m.id === mantenerId) || menciones[0]
      : menciones.sort((a, b) => scoreMencion(b) - scoreMencion(a))[0]

    const descartar = menciones.filter(m => m.id !== mejor.id)

    // Enriquecer la mejor con datos faltantes de las otras
    const actualizaciones: Record<string, unknown> = {}

    // Si la mejor no tiene eje pero alguna descartada sí
    if (!mejor.ejeEstructuralId) {
      const ejeDeDescarte = descartar.find(m => m.ejeEstructuralId)
      if (ejeDeDescarte) {
        actualizaciones.ejeEstructuralId = ejeDeDescarte.ejeEstructuralId
      }
    }

    // Si la mejor no tiene sentimiento pero alguna descartada sí
    if (!mejor.sentimiento || mejor.sentimiento === 'no_clasificado') {
      const sentDeDescarte = descartar.find(m => m.sentimiento && m.sentimiento !== 'no_clasificado')
      if (sentDeDescarte) {
        actualizaciones.sentimiento = sentDeDescarte.sentimiento
      }
    }

    // Si la mejor no tiene texto original largo pero alguna descartada sí
    if ((!mejor.textoCompleto || mejor.textoCompleto.length < 500)) {
      const textoMejor = descartar.find(m => m.textoCompleto && m.textoCompleto.length > 500)
      if (textoMejor) {
        actualizaciones.textoCompleto = textoMejor.textoCompleto
      }
    }

    // Si la mejor no tiene tratamiento pero alguna descartada sí
    if (!mejor.tratamientoPeriodistico) {
      const tratDeDescarte = descartar.find(m => m.tratamientoPeriodistico)
      if (tratDeDescarte) {
        actualizaciones.tratamientoPeriodistico = tratDeDescarte.tratamientoPeriodistico
      }
    }

    // Si la mejor no tiene 5W pero alguna descartada sí
    if (!mejor.preguntasFundamentales) {
      const pfDeDescarte = descartar.find(m => m.preguntasFundamentales)
      if (pfDeDescarte) {
        actualizaciones.preguntasFundamentales = pfDeDescarte.preguntasFundamentales
      }
    }

    // Actualizar la mejor si hay datos nuevos
    if (Object.keys(actualizaciones).length > 0) {
      await db.mencion.update({
        where: { id: mejor.id },
        data: actualizaciones,
      })
    }

    // Transferir ejes faltantes (MencionTema)
    const existentesEjes = new Set(mejor.MencionTema.map(mt => mt.ejeTematicoId))
    for (const desc of descartar) {
      for (const mt of desc.MencionTema) {
        if (!existentesEjes.has(mt.ejeTematicoId)) {
          try {
            await db.mencionTema.create({
              data: { id: crypto.randomUUID(), mencionId: mejor.id, ejeTematicoId: mt.ejeTematicoId },
            })
            existentesEjes.add(mt.ejeTematicoId)
          } catch {
            // Ya existe, ignorar
          }
        }
      }
    }

    // Transferir lentes faltantes (MencionLente)
    const existentesLentes = new Set(mejor.MencionLente.map(ml => ml.lenteId))
    for (const desc of descartar) {
      for (const ml of desc.MencionLente) {
        if (!existentesLentes.has(ml.lenteId)) {
          try {
            await db.mencionLente.create({
              data: { id: crypto.randomUUID(), mencionId: mejor.id, lenteId: ml.lenteId },
            })
            existentesLentes.add(ml.lenteId)
          } catch {
            // Ya existe, ignorar
          }
        }
      }
    }

    // Marcar duplicados como eliminados (soft: esDuplicado=true)
    const idsDescartar = descartar.map(m => m.id)
    await db.mencion.updateMany({
      where: { id: { in: idsDescartar } },
      data: {
        esDuplicado: true,
        mencionOriginalId: mejor.id,
        deduplicacionLog: JSON.stringify({
          decision: 'fusion_manual',
          timestamp: new Date().toISOString(),
          originalId: mejor.id,
          datosTransferidos: Object.keys(actualizaciones),
        }),
      },
    })

    // Eliminar relaciones de los descartados
    try {
      await db.mencionTema.deleteMany({ where: { mencionId: { in: idsDescartar } } })
      await db.mencionLente.deleteMany({ where: { mencionId: { in: idsDescartar } } })
    } catch { /* ignore */ }

    // Eliminar registros duplicados de la BD
    await db.mencion.deleteMany({ where: { id: { in: idsDescartar } } })

    return NextResponse.json({
      success: true,
      mantenido: mejor.id,
      eliminados: idsDescartar,
      datosTransferidos: Object.keys(actualizaciones),
      ejesTransferidos: existentesEjes.size - mejor.MencionTema.length,
      lentesTransferidos: existentesLentes.size - mejor.MencionLente.length,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[QUALITY-MERGE]', msg)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}

function scoreMencion(m: Record<string, unknown>): number {
  let score = 0
  if (m.ejeEstructuralId) score += 5
  if (m.sentimiento && m.sentimiento !== 'no_clasificado') score += 3
  if (m.tratamientoPeriodistico) score += 3
  if (m.confianzaClasificacion) score += 2
  if (m.personaId) score += 4
  if (m.fechaClasificacion) score += 2
  if (m.textoCompleto && typeof m.textoCompleto === 'string' && m.textoCompleto.length > 500) score += 3
  if (m.preguntasFundamentales) score += 3
  return score
}
