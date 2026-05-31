// Runner: generar_boletin - Generacion de productos ONION200
// DECODEX Bolivia
// Genera el contenido de un boletin y lo registra en la DB

import db from '@/lib/db'
import { getMencionesForBulletin, getProductConfig, formatFechaBolivia } from '@/lib/bulletin/product-generator'
import { buildDeliveryPayload } from '@/lib/bulletin/delivery'
import { PRODUCTOS } from '@/constants/products'
import type { TipoBoletin } from '@/types/bulletin'
import type { JobPayload, RunnerResult } from '../types'
import { randomBytes } from 'crypto'

export async function run(payload: JobPayload): Promise<RunnerResult> {
  // Aceptar tanto tipoBoletin (scheduler) como tipoProducto (dashboard manual)
  const tipoBoletin = (payload.tipoBoletin || payload.tipoProducto) as TipoBoletin
  const personaId = payload.personaId as string | undefined
  const contratoId = payload.contratoId as string | undefined

  if (!tipoBoletin) {
    return { success: false, error: 'generar_boletin requiere tipoBoletin o tipoProducto en el payload' }
  }

  const startTime = Date.now()

  try {
    // 1. Verificar que el producto existe
    const config = getProductConfig(tipoBoletin)
    if (!config) {
      const productosValidos = Object.keys(PRODUCTOS).join(', ')
      console.error(`[generar_boletin] Producto no válido: "${tipoBoletin}". Productos configurados: ${productosValidos}`)
      return {
        success: false,
        error: `Producto "${tipoBoletin}" no configurado. Productos válidos: ${productosValidos}`,
      }
    }

    // 2. Obtener menciones para el boletin
    const { menciones, fechaInicio, fechaFin, totalMenciones } = await getMencionesForBulletin(
      tipoBoletin,
      { personaId },
    )

    // 3. Obtener indicadores
    let indicadoresData: Record<string, unknown> = {}
    try {
      const { getUltimoValor } = await import('@/lib/indicadores/capturer-tier1')
      const indicadoresSlugs = ['tc-oficial-bcb', 'rin-bcb', 'lme-estano', 'lme-plata']
      for (const slug of indicadoresSlugs) {
        const valor = await getUltimoValor(slug)
        if (valor) {
          indicadoresData[slug] = valor
        }
      }
    } catch {
      // No bloquear si indicadores fallan
    }

    // 4. Construir contenido del boletin
    const contenido = buildContenidoBoletin(
      tipoBoletin,
      menciones as unknown as Record<string, unknown>[],
      indicadoresData,
      { fechaInicio, fechaFin },
    )

    // 5. Guardar como Reporte
    const reporteId = 'rpt_' + randomBytes(12).toString('hex')
    const reporte = await db.reporte.create({
      data: {
        id: reporteId,
        tipo: tipoBoletin,
        personaId: personaId || null,
        fechaInicio,
        fechaFin,
        resumen: contenido.resumen,
        contenido: JSON.stringify(contenido),
        totalMenciones,
        sentimientoPromedio: 0,
        temasPrincipales: '',
      },
    })

    const responseTime = Date.now() - startTime

    // 6. Distribuir a contratos activos
    // Si vino contratoId explícito (desde dashboard manual), usar ese.
    // Si es programado (sin contratoId), buscar contratos activos automáticamente.
    const { enqueue } = await import('../queue')
    let entregasEnqueued = 0

    if (contratoId) {
      // Envío manual desde dashboard — solo ese contrato
      await enqueue({
        tipo: 'enviar_entrega',
        prioridad: 3,
        payload: {
          reporteId: reporte.id,
          tipoBoletin,
          contratoId,
          contenido: contenido.textoCompleto,
        },
      })
      entregasEnqueued = 1
    } else {
      // Envío programado — buscar contratos activos que coincidan
      try {
        const contratos = await db.contrato.findMany({
          where: {
            estado: 'activo',
            fechaInicio: { lte: new Date() },
            OR: [
              { fechaFin: null },
              { fechaFin: { gte: new Date() } },
            ],
          },
          include: {
            Cliente: { select: { nombre: true, whatsapp: true, email: true } },
          },
        })

        for (const contrato of contratos) {
          // Si el contrato especifica tipoProducto, solo enviar si coincide
          const tipoProducto = contrato.tipoProducto
          if (tipoProducto && tipoProducto !== tipoBoletin && tipoProducto !== 'todos') {
            continue
          }
          // Verificar que tenga al menos un canal de destino
          const tieneCanal = contrato.Cliente.whatsapp || contrato.Cliente.email
          if (!tieneCanal) continue

          await enqueue({
            tipo: 'enviar_entrega',
            prioridad: 3,
            payload: {
              reporteId: reporte.id,
              tipoBoletin,
              contratoId: contrato.id,
              contenido: contenido.textoCompleto,
              canal: (contrato.formatoEntrega as 'whatsapp' | 'email') || 'whatsapp',
            },
          })
          entregasEnqueued++
        }

        if (contratos.length > 0) {
          console.log(`[generar_boletin] ${tipoBoletin}: ${entregasEnqueued} entregas encoladas (${contratos.length} contratos activos)`)
        }
      } catch (err) {
        console.warn(`[generar_boletin] Error buscando contratos para distribución:`, err)
      }
    }

    return {
      success: true,
      data: {
        tipoBoletin,
        reporteId: reporte.id,
        totalMenciones,
        fechaInicio,
        fechaFin,
        responseTime,
        incluyeEnvio: entregasEnqueued > 0,
        entregasEnqueued,
      },
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    return { success: false, error: `generar_boletin fallo: ${msg}` }
  }
}

// Construir contenido estructurado del boletin
function buildContenidoBoletin(
  tipo: TipoBoletin,
  menciones: Record<string, unknown>[],
  indicadores: Record<string, unknown>,
  fechas: { fechaInicio: Date; fechaFin: Date },
): { resumen: string; textoCompleto: string; [key: string]: unknown } {
  const fecha = formatFechaBolivia(fechas.fechaFin)
  const totalMenciones = menciones.length

  let resumen: string

  if (totalMenciones === 0) {
    resumen = `[${tipo}] ${fecha} - Sin menciones capturadas. Verificar fuentes activas y jobs de scraping.`
  } else {
    resumen = `[${tipo}] ${fecha} - ${totalMenciones} menciones procesadas`
  }

  const secciones: string[] = []
  secciones.push(`*${tipo} - ${fecha}*`)
  secciones.push(`Total de menciones: ${totalMenciones}`)

  if (totalMenciones === 0) {
    secciones.push('')
    secciones.push('No se encontraron menciones en el periodo consultado.')
    secciones.push('Posibles causas: fuentes inactivas, sin checks recientes, o sin scraping ejecutado.')
    secciones.push('Revisar: dashboard Jobs > Fuentes > verificar estado de check-fuente.')
  }

  // Indicadores
  if (Object.keys(indicadores).length > 0) {
    secciones.push('')
    secciones.push('*Indicadores:*')
    for (const [slug, data] of Object.entries(indicadores)) {
      const val = (data as { valorTexto?: string })?.valorTexto || 'N/D'
      secciones.push(`- ${slug}: ${val}`)
    }
  }

  // Top menciones (primeras 10)
  if (menciones.length > 0) {
    secciones.push('')
    secciones.push('*Menciones principales:*')
    const top = menciones.slice(0, 10)
    for (const m of top) {
      const titulo = (m as { titulo?: string }).titulo || 'Sin titulo'
      const persona = (m as { persona?: { nombre?: string } }).persona
      const nombre = (persona as { nombre?: string })?.nombre || ''
      const medio = (m as { medio?: { nombre?: string } }).medio
      const medioNombre = (medio as { nombre?: string })?.nombre || ''
      secciones.push(`- ${nombre ? `[${nombre}] ` : ''}${titulo} (${medioNombre})`)
    }
  }

  const textoCompleto = secciones.join('\n')

  return {
    tipo,
    fecha,
    totalMenciones,
    resumen,
    textoCompleto,
    indicadores,
    fechas,
  }
}

const handler = run

export default { handler }
