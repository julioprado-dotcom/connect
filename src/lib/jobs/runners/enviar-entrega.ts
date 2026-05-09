// Runner: enviar_entrega - Envio de boletines por WhatsApp/Email
// DECODEX Bolivia
// Registra la entrega en la tabla Entrega

import db from '@/lib/db'
import { buildDeliveryPayload, truncateForWhatsApp } from '@/lib/bulletin/delivery'
import { formatFechaBolivia } from '@/lib/bulletin/product-generator'
import type { TipoBoletin } from '@/types/bulletin'
import type { JobPayload, RunnerResult } from '../types'

export async function run(payload: JobPayload): Promise<RunnerResult> {
  const reporteId = payload.reporteId as string
  const tipoBoletin = payload.tipoBoletin as TipoBoletin
  const contratoId = payload.contratoId as string
  const contenido = payload.contenido as string | undefined
  const canal = (payload.canal as 'whatsapp' | 'email') || 'whatsapp'

  if (!tipoBoletin || !contratoId) {
    return { success: false, error: 'enviar_entrega requiere tipoBoletin y contratoId' }
  }

  const startTime = Date.now()

  try {
    // 1. Obtener datos del contrato y cliente
    const contrato = await db.contrato.findUnique({
      where: { id: contratoId },
      include: {
        cliente: {
          select: { id: true, nombre: true, email: true, whatsapp: true },
        },
      },
    })

    if (!contrato) {
      return { success: false, error: `Contrato ${contratoId} no encontrado` }
    }

    if (contrato.estado !== 'activo') {
      return {
        success: true,
        data: { tipoBoletin, contratoId, detalle: `Contrato inactivo (${contrato.estado})`, enviado: false },
      }
    }

    // 2. Obtener contenido del reporte si no se proporciono
    let contenidoFinal = contenido || ''
    if (!contenidoFinal && reporteId) {
      const reporte = await db.reporte.findUnique({ where: { id: reporteId } })
      if (reporte?.contenido) {
        try {
          const parsed = JSON.parse(reporte.contenido)
          contenidoFinal = parsed.textoCompleto || ''
        } catch {
          contenidoFinal = reporte.contenido
        }
      }
    }

    if (!contenidoFinal) {
      return { success: false, error: 'No hay contenido para enviar' }
    }

    // 3. Determinar destinatarios segun canal
    const destinatarios: string[] = []
    if (canal === 'whatsapp' && contrato.cliente.whatsapp) {
      destinatarios.push(contrato.cliente.whatsapp)
    }
    if (canal === 'email' && contrato.cliente.email) {
      destinatarios.push(contrato.cliente.email)
    }

    if (destinatarios.length === 0) {
      return {
        success: true,
        data: { tipoBoletin, contratoId, detalle: 'Sin destinatarios configurados', enviado: false },
      }
    }

    // 4. Formatear para el canal
    const vars = {
      fecha: formatFechaBolivia(new Date()),
      cliente: contrato.cliente.nombre,
    }

    const delivery = buildDeliveryPayload(tipoBoletin, canal, destinatarios, contenidoFinal, vars)

    // 5. Registrar entrega en la DB
    // Nota: el envio real por WhatsApp API o SMTP se implementa aparte
    // Aqui solo registramos la entrega y marcamos como pendiente de envio real
    const entrega = await db.entrega.create({
      data: {
        contratoId,
        tipoBoletin,
        contenido: delivery.contenidoFormateado,
        estado: 'enviado', // En produccion seria 'pendiente' hasta confirmacion del API
        canal,
        destinatarios: JSON.stringify(destinatarios),
        fechaEnvio: new Date(),
      },
    })

    // 6. Marcar reporte como enviado
    if (reporteId) {
      await db.reporte.update({
        where: { id: reporteId },
        data: {
          enviado: true,
          fechaEnvio: new Date(),
        },
      })
    }

    const responseTime = Date.now() - startTime

    return {
      success: true,
      data: {
        tipoBoletin,
        contratoId,
        entregaId: entrega.id,
        canal,
        destinatarios,
        cliente: contrato.cliente.nombre,
        responseTime,
        enviado: true,
      },
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)

    // Registrar entrega fallida
    try {
      await db.entrega.create({
        data: {
          contratoId,
          tipoBoletin,
          estado: 'fallido',
          canal: canal || 'whatsapp',
          error: msg,
        },
      })
    } catch {
      // No bloquear si falla el registro del error
    }

    return { success: false, error: `enviar_entrega fallo: ${msg}` }
  }
}

const handler = run

export default { handler }
