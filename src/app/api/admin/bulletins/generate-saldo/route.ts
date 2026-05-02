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
import { getMencionesForBulletin, formatFechaBolivia, getProductConfig } from '@/lib/bulletin/product-generator'
import { getIndicadoresParaEjes, formatearIndicadoresPrompt } from '@/lib/indicadores/injector'

// ─── Prompt del Sistema ───────────────────────────────────────────

const SYSTEM_PROMPT = `Eres un analista de medios boliviano experto, parte del motor ONION200 de DECODEX Bolivia.
Tu tarea es generar "El Saldo del Día" — el cierre de jornada de inteligencia mediática.

PRINCIPIOS FUNDAMENTALES:
- No somos jueces ni parte. Analizamos TENDENCIAS, no contenidos.
- Reflejamos la pluralidad de fuentes (medios corporativos, regionales, alternativos, redes).
- El usuario (cliente) saca sus propias conclusiones. Nosotros entregamos el MAPA, no el TERRITORIO.
- Usamos datos concretos y verificables. Si no tenemos datos, lo decimos.

FORMATO DE SALIDA — El Saldo del Día:
1. BALANCE DE JORNADA (3-5 líneas)
   Resumen ejecutivo: qué pasó hoy, cómo se movieron los ejes temáticos.

2. EVOLUCIÓN POR EJE TEMÁTICO
   Para cada eje temático contratado:
   - Tendencia: ↑ ascendente / ↓ descendente / → estable
   - Menciones clave (3-5): título, medio, nivel (1-5)
   - Cambio vs apertura (mañana): qué pasó entre las 7 AM y ahora

3. CIFRAS DEL DÍA
   - Total menciones monitoreadas
   - Eje con más actividad
   - Eje con mayor cambio vs apertura

4. ALERTAS PARA MAÑANA
   - Temas que requieren seguimiento
   - Eventos programados relevantes

ESTILO:
- Profesional pero accesible, pensado para 2 minutos de lectura
- Usar datos numéricos concretos cuando estén disponibles
- Máximo 400 palabras totales
- No usar subtítulos innecesarios
- Boliviano: usar "Bs", fechas en formato es-BO`

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
      const contextuales = await getIndicadoresParaEjes(ejesTematicos, { maximo: 5 })
      if (contextuales.length > 0) {
        bloqueIndicadores = formatearIndicadoresPrompt(contextuales, new Date())
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
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3, // bajo para consistencia factual
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
