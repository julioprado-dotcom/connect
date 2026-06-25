// Runner: generar_boletin - Generacion de productos ONION200 (LLM)
// DECODEX Bolivia
//
// Ejecuta la generación LLM via generateProductoInterno() que contiene
// toda la lógica específica por producto.
//
// REGLA FIRME: NUNCA crear productos vacíos (0 menciones = no se genera).
//
// Productos LLM que pasan por aquí:
//   EL_RADAR, EL_TERMOMETRO, SALDO_DEL_DIA, EL_FOCO, FICHA_LEGISLADOR,
//   BOLETIN_DEL_GRANO
//
// Productos con flujo propio (NO pasan por aquí):
//   REPORTE_SECTORIAL_MINERO → tiene su propio runner con pipeline especializado
//
// Flujo:
//   menciones > 0 → generateProductoInterno() → push GitHub → distribuir
//   menciones = 0 → NO crea Reporte → registra alerta máxima → notifica

import db from '@/lib/db'
import { generateProductoInterno } from '@/lib/generation/generate-internal'
import { getProductConfig, formatFechaBolivia } from '@/lib/bulletin/product-generator'
import { PRODUCTOS } from '@/constants/products'
import type { TipoBoletin } from '@/types/bulletin'
import type { JobPayload, RunnerResult } from '../types'

export async function run(payload: JobPayload): Promise<RunnerResult> {
  const tipoBoletin = (payload.tipoBoletin || payload.tipoProducto) as TipoBoletin
  const contratoId = payload.contratoId as string | undefined

  if (!tipoBoletin) {
    return { success: false, error: 'generar_boletin requiere tipoBoletin o tipoProducto en el payload' }
  }

  const startTime = Date.now()

  // Rechazar productos con flujo propio (no pasan por aquí)
  if (tipoBoletin === 'REPORTE_SECTORIAL_MINERO') {
    console.error(`[generar_boletin] ERROR: REPORTE_SECTORIAL_MINERO tiene su propio runner (generar_reporte_sectorial)`)
    return { success: false, error: 'REPORTE_SECTORIAL_MINERO debe usar job type "generar_reporte_sectorial", no "generar_boletin"' }
  }

  // 1. Verificar config
  const config = getProductConfig(tipoBoletin)
  if (!config) {
    const productosValidos = Object.keys(PRODUCTOS).join(', ')
    return { success: false, error: `Producto "${tipoBoletin}" no configurado. Validos: ${productosValidos}` }
  }

  // 2. Generar con la función unificada interna
  const result = await generateProductoInterno({
    tipoBoletin,
    personaId: payload.personaId as string | undefined,
    ejeSlug: payload.ejeSlug as string | undefined,
    ejesTematicos: payload.ejesTematicos as string[] | undefined,
  })

  // 3. Manejar SIN_MATERIAL
  if (!result.exito && result.error?.startsWith('SIN_MATERIAL')) {
    const { getDateRange } = await import('@/lib/bulletin/product-generator')
    const range = getDateRange(tipoBoletin)

    // Registrar alerta de máxima prioridad
    await db.systemLog.create({
      data: {
        modulo: 'alerta_maxima',
        accion: 'producto_sin_material',
        detalle: `ALERTA: ${tipoBoletin} no tiene menciones (${formatFechaBolivia(range.fechaFin)}). Verificar pipeline.`,
        automatica: true,
        datos: JSON.stringify({
          tipoBoletin,
          severity: 'critica',
          origen: payload.programa || 'manual',
        }),
      },
    }).catch(() => {})

    // Diagnóstico del pipeline
    let diagnostico = ''
    try {
      const [nrPend, mencionesTotal, fuentesActivas] = await Promise.all([
        db.notaRaw.count({ where: { procesada: false } }).catch(() => 0),
        db.mencion.count().catch(() => 0),
        db.fuenteEstado.count({ where: { activo: true } }).catch(() => 0),
      ])
      diagnostico = `NotaRaw pend: ${nrPend} | Menciones: ${mencionesTotal} | Fuentes: ${fuentesActivas}`
    } catch { /* no bloquear */ }

    return {
      success: true,
      data: {
        tipoBoletin,
        alerta: true,
        severity: 'critica',
        mensaje: `Producto ${tipoBoletin} SIN MATERIAL — no se genero. ${diagnostico}`,
        totalMenciones: 0,
        responseTime: Date.now() - startTime,
      },
    }
  }

  // 4. Manejar error de generación
  if (!result.exito) {
    return {
      success: false,
      error: `Generacion fallo para ${tipoBoletin}: ${result.error}`,
    }
  }

  // 5. Push a GitHub
  try {
    const { pushProductosToGithub } = await import('@/lib/git-utils')
    await pushProductosToGithub(`Producto ${tipoBoletin}: ${result.totalMenciones} menciones`)
  } catch (err) {
    console.warn(`[generar_boletin] GitHub push error (no bloqueante):`, err)
  }

  // 6. Distribuir a contratos activos
  const { enqueue } = await import('../queue')
  let entregasEnqueued = 0

  if (contratoId) {
    await enqueue({
      tipo: 'enviar_entrega',
      prioridad: 3,
      payload: {
        reporteId: result.reporteId,
        tipoBoletin,
        contratoId,
        contenido: result.textoFinal,
      },
    })
    entregasEnqueued = 1
  } else {
    try {
      const contratos = await db.contrato.findMany({
        where: {
          estado: 'activo',
          fechaInicio: { lte: new Date() },
          OR: [{ fechaFin: null }, { fechaFin: { gte: new Date() } }],
        },
        include: { Cliente: { select: { nombre: true, whatsapp: true, email: true } } },
      })

      for (const contrato of contratos) {
        const tipoProducto = contrato.tipoProducto
        if (tipoProducto && tipoProducto !== tipoBoletin && tipoProducto !== 'todos') continue
        if (!contrato.Cliente.whatsapp && !contrato.Cliente.email) continue

        await enqueue({
          tipo: 'enviar_entrega',
          prioridad: 3,
          payload: {
            reporteId: result.reporteId,
            tipoBoletin,
            contratoId: contrato.id,
            contenido: result.textoFinal,
            canal: (contrato.formatoEntrega as 'whatsapp' | 'email') || 'whatsapp',
          },
        })
        entregasEnqueued++
      }

      if (contratos.length > 0) {
        console.log(`[generar_boletin] ${tipoBoletin}: ${entregasEnqueued} entregas encoladas`)
      }
    } catch (err) {
      console.warn(`[generar_boletin] Error distribucion:`, err)
    }
  }

  // 7. Auditoría
  await db.systemLog.create({
    data: {
      modulo: 'generar_boletin',
      accion: 'producto_generado',
      detalle: `${tipoBoletin}: ${result.totalMenciones} menciones, ${entregasEnqueued} entregas`,
      automatica: true,
      datos: JSON.stringify({
        tipoBoletin,
        totalMenciones: result.totalMenciones,
        entregasEnqueued,
        reporteId: result.reporteId,
        responseTimeMs: result.responseTimeMs,
        tokensUsados: result.tokensUsados,
        modelo: result.modelo,
        puntuacionCalidad: result.puntuacionCalidad,
        path: 'internal',
      }),
    },
  }).catch(() => {})

  console.log(`[generar_boletin] OK: ${tipoBoletin} → ${result.totalMenciones} menciones [${Date.now() - startTime}ms]`)

  return {
    success: true,
    data: {
      tipoBoletin,
      reporteId: result.reporteId,
      totalMenciones: result.totalMenciones,
      responseTime: Date.now() - startTime,
      incluyeEnvio: entregasEnqueued > 0,
      entregasEnqueued,
      path: 'internal',
      modelo: result.modelo,
      tokensUsados: result.tokensUsados,
    },
  }
}

const handler = run

export default { handler }