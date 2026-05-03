/**
 * API: Generación del Saldo del Día — ONION200
 * POST /api/admin/bulletins/generate-saldo
 *
 * Genera el boletín "El Saldo del Día" — cierre de jornada a 7:00 PM.
 * Es CLIENTE-CÉNTRICO: analiza los ejes temáticos contratados por el cliente.
 * Compara la situación de apertura (Termómetro 7AM) con el cierre (7PM).
 */

import { NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'
import { PRODUCTOS } from '@/constants/products'
import { getMencionesForBulletin, formatFechaBolivia, getProductConfig } from '@/lib/bulletin/product-generator'
import { getIndicadoresParaEjes, formatearIndicadoresPrompt } from '@/lib/indicadores/injector'

// ─── Endpoint POST ────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      ejesTematicos = [],
      personaId,
      nombreCliente = 'Cliente',
      indicadores = true,
    } = body as {
      ejesTematicos?: string[]
      personaId?: string
      nombreCliente?: string
      indicadores?: boolean
    }

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

    // 2. Obtener indicadores relevantes
    let bloqueIndicadores = ''
    if (indicadores && ejesTematicos.length > 0) {
      const indicadoresPorEje = await getIndicadoresParaEjes(ejesTematicos)
      const todasLasIndicadores = Object.values(indicadoresPorEje).flat()
      if (todasLasIndicadores.length > 0) {
        bloqueIndicadores = formatearIndicadoresPrompt(todasLasIndicadores)
      }
    }

    // 3. Formatear menciones para el prompt
    const mencionesFormateadas = menciones.slice(0, 30).map(m => {
      const temas = m.ejesTematicos
        .map(et => et.ejeTematico.nombre)
        .join(', ')
      return `- [${m.medio.nivel || '?'}] "${m.titulo}" (${m.medio.nombre}) — Sentimiento: ${m.sentimiento} — Temas: ${temas}`
    }).join('\n')

    // 4. Construir prompt de usuario
    const userPrompt = `Genera El Saldo del Día para el cliente "${nombreCliente}".
Fecha: ${formatFechaBolivia(new Date())}

EJES TEMÁTICOS MONITOREADOS: ${ejesTematicos.length > 0 ? ejesTematicos.join(', ') : 'Todos'}

${bloqueIndicadores ? bloqueIndicadores + '\n' : ''}MENCIONES DE LA JORNADA (${totalMenciones} total, mostrando las 30 más relevantes):
${mencionesFormateadas}

DISTRIBUCIÓN POR NIVEL DE MEDIO:
${[1,2,3,4,5].map(nivel => {
  const count = menciones.filter(m => m.medio.nivel === String(nivel)).length
  const labels: Record<number, string> = { 1: 'Corporativos', 2: 'Regionales', 3: 'Alternativos', 4: 'Redes', 5: 'Repositorio' }
  return `- Nivel ${nivel} (${labels[nivel]}): ${count} menciones`
}).join('\n')}

REGLA: Compara la evolución del día. Si hay datos del Termómetro (apertura), contrasta. Si hay indicadores ONION200, úsalos para enriquecer. Máximo 400 palabras.`

    // 5. Generar con GLM
    const zai = await ZAI.create()
    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: PRODUCTOS.SALDO_DEL_DIA.systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: PRODUCTOS.SALDO_DEL_DIA.temperatura,
    })

    const contenido = completion.choices[0]?.message?.content ?? 'Error: no se generó contenido'
    const duracion = Date.now() - inicio

    return NextResponse.json({
      exito: true,
      tipo: 'SALDO_DEL_DIA',
      contenido,
      resumen: contenido.slice(0, 200) + '...',
      fechaInicio: fechaInicio.toISOString(),
      fechaFin: fechaFin.toISOString(),
      totalMenciones,
      nombreCliente,
      generadoEn: duracion,
    })
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'Error desconocido'
    console.error('Error generando Saldo del Día:', error)
    return NextResponse.json(
      { exito: false, error: mensaje },
      { status: 500 }
    )
  }
}
