/**
 * API: Generación del Saldo del Día — ONION200
 * POST /api/admin/bulletins/generate-saldo
 *
 * Genera el boletín "El Saldo del Día" — cierre de jornada a 7:00 PM.
 * Es CLIENTE-CÉNTRICO: analiza los ejes temáticos contratados por el cliente.
 * Compara la situación de apertura (Termómetro 7AM) con el cierre (7PM).
 */

import { NextRequest, NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'
import { PRODUCTOS, INDICADOR_PROTOCOL } from '@/constants/products'
import { getMencionesForBulletin, formatFechaBolivia, getProductConfig } from '@/lib/bulletin/product-generator'
import { getIndicadoresConStats, formatearIndicadoresConStatsPrompt } from '@/lib/indicadores/injector'
import { guardedParse, RATE } from '@/lib/rate-guard'
import { generateSaldoSchema } from '@/lib/validations'
import { safeError } from '@/lib/safe-error'
import { verifyProduct } from '@/lib/verification/verify-product'
import { throttledLlmCall } from '@/lib/ai/llm-throttle'
import { formatearMencionesPrompt, construirPrompt } from '@/lib/reportes-utils'

// ─── Endpoint POST ────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const parsed = await guardedParse(request, generateSaldoSchema, RATE.AI);
    if (parsed instanceof NextResponse) return parsed;
    const {
      ejesTematicos = [],
      personaId,
      nombreCliente = 'Cliente',
      indicadores = true,
    } = parsed.body;

    const inicio = Date.now()
    const config = getProductConfig('SALDO_DEL_DIA')
    if (!config) {
      return NextResponse.json({ exito: false, error: 'Producto SALDO_DEL_DIA no configurado' }, { status: 404 })
    }

    // 1. Obtener menciones del día
    const { menciones, fechaInicio, fechaFin, totalMenciones } = await getMencionesForBulletin(
      'SALDO_DEL_DIA',
      { ejesTematicos, personaId }
    )

    if (menciones.length === 0) {
      return NextResponse.json({
        exito: true,
        advertencia: 'Sin menciones en la jornada',
        contenido: `📊 EL SALDO DEL DÍA — ${formatFechaBolivia(new Date())}\n\nSin menciones registradas en la jornada de hoy para los ejes monitoreados.\n\nEl sistema continuará monitoreando fuentes.`,
        totalMenciones: 0,
        generadoEn: Date.now() - inicio,
      })
    }

    // 2. Obtener indicadores relevantes según protocolo
    let bloqueIndicadores = ''
    if (indicadores) {
      const protocol = INDICADOR_PROTOCOL.SALDO_DEL_DIA
      const indicadoresStats = await getIndicadoresConStats(protocol)
      bloqueIndicadores = formatearIndicadoresConStatsPrompt(indicadoresStats, 'Indicadores ONION200', { formato: protocol.formato })
    }

    // 3. Menciones ya obtenidas — se formatean via construirPrompt()

    // 4. Construir prompt de usuario usando construirPrompt() — consistencia global
    const mencionesPrompt = formatearMencionesPrompt(menciones as unknown as Array<Record<string, unknown>>, 'SALDO_DEL_DIA')

    const ventanaLabel = `${formatFechaBolivia(fechaInicio)} — ${formatFechaBolivia(fechaFin)}`
    const datosExtra = [
      `Tipo de producto: Saldo del Dia`,
      `Periodo: ${ventanaLabel}`,
      `Total menciones: ${totalMenciones}`,
      `Ejes monitoreados: ${ejesTematicos.length > 0 ? ejesTematicos.join(', ') : 'Todos'}`,
    ].join('\n')

    const userPrompt = construirPrompt(
      'SALDO_DEL_DIA',
      mencionesPrompt,
      bloqueIndicadores || 'No hay indicadores disponibles para este periodo.',
      datosExtra
    )

    // 5. Generar con GLM
    const zai = await ZAI.create()
    const completion = await throttledLlmCall(() => zai.chat.completions.create({
      model: 'glm-4.5-flash',
      messages: [
        { role: 'system', content: PRODUCTOS.SALDO_DEL_DIA.systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: PRODUCTOS.SALDO_DEL_DIA.temperatura,
      signal: AbortSignal.timeout(60000),
    }))

    const contenido = completion.choices[0]?.message?.content ?? 'Error: no se generó contenido'
    const duracion = Date.now() - inicio

    // Verificacion post-generacion anti-alucinacion
    const textoVerificado = await verifyProduct(
      contenido,
      menciones.map(m => ({
        texto: (m.texto as string) ?? '',
        titulo: (m.titulo as string) ?? '',
        medio: (m.medio as Record<string, unknown>)?.nombre as string ?? '',
        persona: (m.persona as string) ?? null,
      })),
      'SALDO_DEL_DIA'
    )
    if (!textoVerificado.verified) {
      console.log('[generate-saldo] ALERTA: Se elimino contenido no verificado:', textoVerificado.eliminados.length, 'items')
    }

    return NextResponse.json({
      exito: true,
      tipo: 'SALDO_DEL_DIA',
      contenido: textoVerificado.textoLimpio,
      resumen: textoVerificado.textoLimpio.slice(0, 200) + '...',
      fechaInicio: fechaInicio.toISOString(),
      fechaFin: fechaFin.toISOString(),
      totalMenciones,
      nombreCliente,
      generadoEn: duracion,
      verificacion: {
        verified: textoVerificado.verified,
        eliminados: textoVerificado.eliminados.length,
        alertas: textoVerificado.alertas,
      },
    })
  } catch (error) {
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      console.error(`[TIMEOUT] LLM call exceeded 60s in generate-saldo`);
    }
    const { error: msg, code, details } = safeError(error)
    return NextResponse.json(
      { exito: false, error: msg, code, ...(details && { details }) },
      { status: 500 }
    )
  }
}
