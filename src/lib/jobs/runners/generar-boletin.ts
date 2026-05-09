// Runner: generar_boletin - Generacion de productos ONION200
// DECODEX Bolivia
// Genera el contenido de un boletin y lo registra en la DB

import db from '@/lib/db'
import { getMencionesForBulletin, getProductConfig, formatFechaBolivia } from '@/lib/bulletin/product-generator'
import { buildDeliveryPayload } from '@/lib/bulletin/delivery'
import type { TipoBoletin } from '@/types/bulletin'
import type { JobPayload, RunnerResult } from '../types'

export async function run(payload: JobPayload): Promise<RunnerResult> {
  const tipoBoletin = payload.tipoBoletin as TipoBoletin
  const personaId = payload.personaId as string | undefined
  const contratoId = payload.contratoId as string | undefined

  if (!tipoBoletin) {
    return { success: false, error: 'generar_boletin requiere tipoBoletin en el payload' }
  }

  const startTime = Date.now()

  try {
    // 1. Verificar que el producto existe
    const config = getProductConfig(tipoBoletin)
    if (!config) {
      const productosValidos = [
        'EL_TERMOMETRO', 'SALDO_DEL_DIA', 'EL_FOCO', 'EL_RADAR',
        'EL_ESPECIALIZADO', 'FICHA_LEGISLADOR', 'BOLETIN_SECTORIAL',
      ].join(', ')
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
    const reporte = await db.reporte.create({
      data: {
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

    // 6. Si hay contrato, encolar envio automaticamente
    if (contratoId) {
      const { enqueue } = await import('../queue')
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
        incluyeEnvio: !!contratoId,
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

  let resumen = `[${tipo}] ${fecha} - ${totalMenciones} menciones procesadas`

  const secciones: string[] = []
  secciones.push(`*${tipo} - ${fecha}*`)
  secciones.push(`Total de menciones: ${totalMenciones}`)

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
