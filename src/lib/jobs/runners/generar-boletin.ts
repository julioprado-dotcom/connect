// Runner: generar_boletin - Generacion de productos ONION200
// DECODEX Bolivia
//
// REGLA FIRME: NUNCA crear productos vacíos (0 menciones = no se genera).
// Si no hay material → alerta de máxima prioridad para que el operador intervenga.
//
// Flujo:
//   menciones > 0 → genera Reporte → push GitHub → distribuir
//   menciones = 0 → NO crea Reporte → registra alerta máxima → notifica

import db from '@/lib/db'
import { getMencionesForBulletin, getProductConfig, formatFechaBolivia } from '@/lib/bulletin/product-generator'
import { PRODUCTOS } from '@/constants/products'
import type { TipoBoletin } from '@/types/bulletin'
import type { JobPayload, RunnerResult } from '../types'
import { randomBytes } from 'crypto'

export async function run(payload: JobPayload): Promise<RunnerResult> {
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
      console.error(`[generar_boletin] Producto no valido: "${tipoBoletin}". Productos configurados: ${productosValidos}`)
      return {
        success: false,
        error: `Producto "${tipoBoletin}" no configurado. Productos validos: ${productosValidos}`,
      }
    }

    // 2. Obtener menciones para el boletin
    const { menciones, fechaInicio, fechaFin, totalMenciones } = await getMencionesForBulletin(
      tipoBoletin,
      { personaId },
    )

    // ═══════════════════════════════════════════════════════════════
    // REGLA FIRME: NUNCA crear productos con 0 menciones
    // ═══════════════════════════════════════════════════════════════
    if (totalMenciones === 0) {
      console.warn(`[generar_boletin] SIN MATERIAL para ${tipoBoletin} — abortando generacion, registrando alerta`)

      // Registrar alerta de maxima prioridad en SystemLog
      await db.systemLog.create({
        data: {
          modulo: 'alerta_maxima',
          accion: 'producto_sin_material',
          detalle: `ALERTA: ${tipoBoletin} no tiene menciones en el periodo consultado (${formatFechaBolivia(fechaFin)}). No se genero producto. Verificar pipeline: check_fuente → scrape → batch_llm.`,
          automatica: true,
          datos: JSON.stringify({
            tipoBoletin,
            fechaInicio: fechaInicio.toISOString(),
            fechaFin: fechaFin.toISOString(),
            severity: 'critica',
            origen: payload.programa || 'manual',
          }),
        },
      }).catch(() => {})

      // Contar estado del pipeline para el diagnostico
      let diagnostico = ''
      try {
        const [nrPend, mencionesTotal, fuentesActivas] = await Promise.all([
          db.notaRaw.count({ where: { procesada: false } }).catch(() => 0),
          db.mencion.count().catch(() => 0),
          db.fuenteEstado.count({ where: { activo: true } }).catch(() => 0),
        ])
        diagnostico = `NotaRaw pendientes: ${nrPend} | Menciones totales: ${mencionesTotal} | Fuentes activas: ${fuentesActivas}`
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

    // ═══════════════════════════════════════════════════════════════
    // HAY MATERIAL → generar producto normalmente
    // ═══════════════════════════════════════════════════════════════

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

    // 5. Guardar como Reporte (solo si hay menciones)
    const responseTime = Date.now() - startTime
    const reporteId = 'rpt_' + randomBytes(12).toString('hex')
    const reporte = await db.reporte.create({
      data: {
        id: reporteId,
        tipo: tipoBoletin,
        personaId: personaId || null,
        fechaInicio,
        fechaFin,
        resumen: contenido.resumen,
        contenido: JSON.stringify({
          ...contenido,
          _metadata: {
            origen: 'scheduler',
            totalMenciones,
            responseTimeMs: responseTime,
            generadoEn: new Date().toISOString(),
          },
        }),
        totalMenciones,
        sentimientoPromedio: 0,
        temasPrincipales: '',
      },
    })

    // 6. Push a GitHub
    try {
      const { pushProductosToGithub } = await import('@/lib/git-utils')
      const githubResult = await pushProductosToGithub(`Producto ${tipoBoletin}: ${totalMenciones} menciones`)
      if (githubResult.ok && githubResult.commit !== 'no-changes') {
        console.log(`[generar_boletin] GitHub push OK: ${githubResult.commit}`)
      } else if (githubResult.ok) {
        console.log(`[generar_boletin] GitHub: sin cambios nuevos`)
      } else {
        console.warn(`[generar_boletin] GitHub push fallido: ${githubResult.error}`)
      }
    } catch (err) {
      console.warn(`[generar_boletin] GitHub push error (no bloqueante):`, err)
    }

    // 7. Distribuir a contratos activos
    const { enqueue } = await import('../queue')
    let entregasEnqueued = 0

    if (contratoId) {
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
          const tipoProducto = contrato.tipoProducto
          if (tipoProducto && tipoProducto !== tipoBoletin && tipoProducto !== 'todos') {
            continue
          }
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
        console.warn(`[generar_boletin] Error buscando contratos para distribucion:`, err)
      }
    }

    // Registrar en SystemLog (auditoria exitosa)
    await db.systemLog.create({
      data: {
        modulo: 'generar_boletin',
        accion: 'producto_generado',
        detalle: `${tipoBoletin}: ${totalMenciones} menciones, ${entregasEnqueued} entregas`,
        automatica: true,
        datos: JSON.stringify({
          tipoBoletin,
          totalMenciones,
          entregasEnqueued,
          reporteId: reporte.id,
          responseTimeMs: responseTime,
        }),
      },
    }).catch(() => {})

    console.log(`[generar_boletin] OK: ${tipoBoletin} → ${totalMenciones} menciones, ${entregasEnqueued} entregas [${Date.now() - startTime}ms]`)

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

  const resumen = `[${tipo}] ${fecha} - ${totalMenciones} menciones procesadas`

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
