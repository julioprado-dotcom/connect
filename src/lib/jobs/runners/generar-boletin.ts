// Runner: generar_boletin - Generacion de productos ONION200
// DECODEX Bolivia
//
// REGLA FIRME: NUNCA crear productos vacíos (0 menciones = no se genera).
// Si no hay material → alerta de máxima prioridad para que el operador intervenga.
//
// Arquitectura de generacion (2 caminos):
//   Path A: Internal fetch a endpoint LLM dedicado (generate-generic, generate-termometro, etc.)
//   Path B: LLM inline — si Path A falla, genera directamente con IA usando
//           los mismos system prompts, prompts y validacion que los endpoints dedicados.
//   NUNCA genera productos de texto plano (listado de menciones).
//
// Flujo:
//   menciones > 0 → genera Reporte con IA → push GitHub → distribuir
//   menciones = 0 → NO crea Reporte → registra alerta máxima → notifica

import db from '@/lib/db'
import { getMencionesForBulletin, getProductConfig, formatFechaBolivia, getDateRange, getContextMenciones } from '@/lib/bulletin/product-generator'
import { PRODUCTOS } from '@/constants/products'
import type { TipoBoletin } from '@/types/bulletin'
import type { JobPayload, RunnerResult } from '../types'
import { randomBytes } from 'crypto'

export async function run(payload: JobPayload): Promise<RunnerResult> {
  const tipoBoletin = (payload.tipoBoletin || payload.tipoProducto) as TipoBoletin
  const personaId = payload.personaId as string | undefined
  const contratoId = payload.contratoId as string | undefined
  const endpoint = payload.endpoint as string | undefined
  const ejeSlug = payload.ejeSlug as string | undefined

  if (!tipoBoletin) {
    return { success: false, error: 'generar_boletin requiere tipoBoletin o tipoProducto en el payload' }
  }


  const startTime = Date.now()

  // ═══════════════════════════════════════════════════════════════
  // PATH A: Internal fetch a endpoint LLM dedicado
  // ═══════════════════════════════════════════════════════════════
  if (endpoint) {
    try {
      console.log(`[generar_boletin] Path A: Intentando endpoint dedicado: ${endpoint}`)
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.BASE_URL || 'http://localhost:3000'
      const body: Record<string, unknown> = { tipo: tipoBoletin }
      if (personaId) body.personaId = personaId
      if (ejeSlug) body.ejeSlug = ejeSlug
      if (contratoId) body.contratoId = contratoId

      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      // Internal auth bypass for server-to-server calls
      if (process.env.AUTH_SECRET) {
        headers['x-internal-secret'] = process.env.AUTH_SECRET
      }

      const res = await fetch(`${baseUrl}${endpoint}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(180000), // 3min timeout (LLM puede tardar)
      })

      if (res.ok) {
        const result = await res.json()
        if (result.ok || result.success || result.exito) {
          console.log(`[generar_boletin] Path A OK: ${endpoint} [${Date.now() - startTime}ms]`)
          return { success: true, data: result }
        }
        console.warn(`[generar_boletin] Path A endpoint retorno sin exito: ${JSON.stringify(result)?.substring(0, 200)}`)
      } else {
        const errText = await res.text().catch(() => '').then(t => t.substring(0, 200))
        console.warn(`[generar_boletin] Path A HTTP ${res.status}: ${errText}`)
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      console.warn(`[generar_boletin] Path A fallo (${errMsg?.substring(0, 150)}), pasando a Path B (LLM inline)`)
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // PATH B: LLM inline — genera directamente con IA
  // Usa los mismos system prompts, formateo de menciones, validacion
  // y reintentos que generate-generic.
  // ═══════════════════════════════════════════════════════════════
  try {
    console.log(`[generar_boletin] Path B: Generando con LLM inline para ${tipoBoletin}`)

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

      // Mantener success:true para evitar reintentos innecesarios del worker.
      // El campo alerta:true indica al UI (via polling) que no se generó producto.
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
    // HAY MATERIAL → generar con LLM inline
    // ═══════════════════════════════════════════════════════════════

    // 3. Obtener indicadores segun tipo
    let indicadoresPrompt = ''
    try {
      const { getIndicadoresParaEjes, formatearIndicadoresMultiplesPrompt } = await import('@/lib/indicadores/injector')
      const DEFAULT_EJES: string[] = [
        'politica-nacional', 'economia', 'seguridad', 'medio-ambiente',
        'social', 'internacional', 'legislativo', 'justicia',
      ]
      const ejesParaIndicadores = ejeSlug ? [ejeSlug] : DEFAULT_EJES
      const indicadoresPorEje = await getIndicadoresParaEjes(ejesParaIndicadores)
      indicadoresPrompt = formatearIndicadoresMultiplesPrompt(indicadoresPorEje)
    } catch {
      // No bloquear si indicadores fallan
    }

    // 4. Formatear menciones y construir prompt
    const { formatearMencionesPrompt, construirPrompt, generarTituloProducto, getDedicatedResumen, formatearContextoHistorico } = await import('@/lib/reportes-utils')
    const mencionesPrompt = formatearMencionesPrompt(menciones as unknown as Array<Record<string, unknown>>)

    // Contexto historico (7 dias, solo titulos) para tendencia
    let contextoHistoricoPrompt = ''
    try {
      const contextoMenciones = await getContextMenciones(7, fechaInicio)
      contextoHistoricoPrompt = formatearContextoHistorico(contextoMenciones)
    } catch (err) {
      console.warn(`[generar_boletin] Error contexto historico (no bloqueante):`, err)
    }

    const range = getDateRange(tipoBoletin)
    const ventanaLabel = `${formatFechaBolivia(range.fechaInicio)} — ${formatFechaBolivia(range.fechaFin)}`

    let datosExtra = [
      `Tipo de producto: ${config.nombre}`,
      `Periodo: ${ventanaLabel}`,
      `Total menciones: ${totalMenciones}`,
    ].join('\n')
    if (ejeSlug) datosExtra += `\nEje tematico: ${ejeSlug}`
    if (personaId) datosExtra += `\nPersona ID: ${personaId}`

    const userPrompt = construirPrompt(tipoBoletin, mencionesPrompt, indicadoresPrompt, datosExtra, contextoHistoricoPrompt)

    // 5. Generar con IA (regenerateWithRetry con validacion + reintentos)
    const { regenerateWithRetry } = await import('@/lib/quality/regeneration')
    const systemPrompt = config.systemPrompt

    console.log(`[generar_boletin] Path B: Llamando LLM para ${tipoBoletin} (${totalMenciones} menciones, temp=${config.temperatura})`)

    const genResult = await regenerateWithRetry({
      systemPrompt,
      userPrompt,
      tipo: tipoBoletin,
      initialTemperatura: config.temperatura,
      onRetry: (intento, error) => {
        console.warn(`[generar_boletin] Path B Reintento ${intento} para ${tipoBoletin}: ${error}`)
      },
    })

    if (!genResult.exito || !genResult.contenido) {
      const errorMsg = genResult.error ?? 'La IA no genero contenido valido'
      console.error(`[generar_boletin] Path B LLM fallo para ${tipoBoletin}: ${errorMsg}`)
      return { success: false, error: `LLM generacion fallo para ${tipoBoletin}: ${errorMsg}` }
    }

    const contenidoTexto = genResult.contenido
    const tokensUsados = genResult.tokensUsados
    const modelo = genResult.modelo

    // 6. Verificacion post-generacion anti-alucinacion + post-procesamiento
    let textoFinal = contenidoTexto
    try {
      const { verifyProduct } = await import('@/lib/verification/verify-product')
      const textoVerificado = await verifyProduct(
        contenidoTexto,
        (menciones as unknown as Array<Record<string, unknown>>).map(m => ({
          texto: (m.texto as string) ?? '',
          titulo: (m.titulo as string) ?? '',
          medio: (m.medio as string) ?? '',
          persona: (m.persona as string) ?? null,
        })),
        tipoBoletin,
      )
      if (!textoVerificado.verified) {
        console.log(`[generar-boletin] Path B: Se elimino contenido no verificado: ${textoVerificado.eliminados.length} items`)
      }
      textoFinal = textoVerificado.textoLimpio

      // Post-procesamiento: limpiar N/A, caracteres extranjeros, secciones con 1 fuente
      const { limpiarPlaceholders, filtrarSeccionesFuenteUnica } = await import('@/lib/verification/verify-postprocess')
      textoFinal = limpiarPlaceholders(textoFinal)
      if (tipoBoletin === 'EL_RADAR') {
        textoFinal = filtrarSeccionesFuenteUnica(textoFinal, 2)
      }
    } catch {
      // Si verificacion falla, usar texto original
    }

    // 6.5 Verificacion factual con segundo pase LLM (nombres, cargos, datos duros)
    try {
      const { verifyFactualWithLLM } = await import('@/lib/verification/verify-factual')
      const factualResult = await verifyFactualWithLLM(
        textoFinal,
        (menciones as unknown as Array<Record<string, unknown>>).map(m => ({
          titulo: (m.titulo as string) ?? '',
          texto: (m.texto as string) ?? '',
          persona: (m.persona as string) ?? null,
          medio: (m.medio as string) ?? '',
        })),
        tipoBoletin,
      )
      if (factualResult.corrected) {
        textoFinal = factualResult.textoCorregido
        console.log(`[generar-boletin] Path B: Verificacion factual corrigio ${factualResult.correcciones.length} items`)
      }
    } catch {
      // No bloquear pipeline si falla la verificacion factual
    }

    // 7. Validacion de calidad
    let puntuacionCalidad = 0
    try {
      const { validateContent } = await import('@/lib/quality/validator')
      const validation = validateContent(textoFinal, { tipo: tipoBoletin })
      puntuacionCalidad = validation.puntuacion
      if (!validation.valido) {
        console.warn(`[generar_boletin] Path B: Calidad baja para ${tipoBoletin}: puntuacion=${validation.puntuacion}, advertencias=${validation.advertencias.length}`)
      }
    } catch {
      // No bloquear
    }

    // 8. Generar titulo y resumen
    const titulo = generarTituloProducto(tipoBoletin, undefined, ejeSlug)
    let resumen = await getDedicatedResumen(tipoBoletin, {
      menciones: menciones as unknown as Array<Record<string, unknown>>,
      fecha: ventanaLabel,
      ejeSlug,
      totalMenciones,
    })
    // Safety net: si el resumen dice "0 menciones" pero hay datos, corregir
    if (totalMenciones > 0 && resumen.includes('0 menciones')) {
      console.warn(`[generar-boletin] Safety net: corrigiendo resumen "0 menciones" -> "${totalMenciones} menciones"`)
      resumen = resumen.replace(/0 menciones/g, `${totalMenciones} menciones`)
    }

    // 9. Guardar como Reporte
    const responseTime = Date.now() - startTime
    const reporteId = 'rpt_' + randomBytes(12).toString('hex')
    const reporte = await db.reporte.create({
      data: {
        id: reporteId,
        tipo: tipoBoletin,
        personaId: personaId || null,
        fechaInicio,
        fechaFin,
        resumen,
        contenido: JSON.stringify({
          tipo: tipoBoletin,
          titulo,
          textoCompleto: textoFinal,
          resumen,
          totalMenciones,
          fecha: ventanaLabel,
          _metadata: {
            origen: 'llm_inline',
            path: 'B',
            totalMenciones,
            tokensUsados,
            modelo,
            puntuacionCalidad,
            responseTimeMs: responseTime,
            generadoEn: new Date().toISOString(),
          },
        }),
        totalMenciones,
        sentimientoPromedio: 0,
        temasPrincipales: '',
      },
    })

    // 10. Push a GitHub
    try {
      const { pushProductosToGithub } = await import('@/lib/git-utils')
      const githubResult = await pushProductosToGithub(`Producto ${tipoBoletin}: ${totalMenciones} menciones (LLM inline)`)
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

    // 11. Distribuir a contratos activos
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
          contenido: textoFinal,
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
              contenido: textoFinal,
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
        detalle: `${tipoBoletin}: ${totalMenciones} menciones, ${entregasEnqueued} entregas, LLM inline (Path B)`,
        automatica: true,
        datos: JSON.stringify({
          tipoBoletin,
          totalMenciones,
          entregasEnqueued,
          reporteId: reporte.id,
          responseTimeMs: responseTime,
          tokensUsados,
          modelo,
          puntuacionCalidad,
          path: 'B',
        }),
      },
    }).catch(() => {})

    console.log(`[generar_boletin] Path B OK: ${tipoBoletin} → ${totalMenciones} menciones, ${textoFinal.length} chars, ${entregasEnqueued} entregas [${Date.now() - startTime}ms]`)

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
        path: 'B',
        modelo,
        tokensUsados,
      },
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    return { success: false, error: `generar_boletin fallo: ${msg}` }
  }
}

const handler = run

export default { handler }
