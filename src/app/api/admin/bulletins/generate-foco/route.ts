/**
 * DECODEX v0.8.0 — Generador: El Foco
 * Motor ONION200 — Equipo B — TAREA 1b
 *
 * Analisis profundo diario por eje tematico,
 * ~800 palabras, temperatura 0.5 (profundo).
 * Requiere ejeSlug como parametro obligatorio.
 *
 * POST /api/admin/bulletins/generate-foco
 */

import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';
import { PRODUCTOS } from '@/constants/products';
import { db } from '@/lib/db';
import { getProductConfig, getMencionesForBulletin, getDateRange } from '@/lib/bulletin/product-generator';
import { getIndicadoresParaEje, formatearIndicadoresPrompt } from '@/lib/indicadores/injector';
import { formatearMencionesPrompt, construirPrompt, registrarReporte, generarTituloProducto, getDedicatedResumen, formatFechaBolivia } from '@/lib/reportes-utils';
import { guardedParse, RATE } from '@/lib/rate-guard';
import { generateFocoSchema } from '@/lib/validations';

// ============================================
// POST Handler
// ============================================

export async function POST(request: NextRequest) {
  try {
    const parsed = await guardedParse(request, generateFocoSchema, RATE.AI);
    if (parsed instanceof NextResponse) return parsed;
    const { ejeSlug, temperatura: temperaturaOverride } = parsed.body;

    // 2. Obtener configuracion del producto
    const config = getProductConfig('EL_FOCO');
    if (!config) {
      return NextResponse.json(
        { exito: false, error: 'Producto EL_FOCO no encontrado en catalogo' },
        { status: 404 }
      );
    }

    // 3. Verificar que el eje tematico existe
    const eje = await db.ejeTematico.findUnique({
      where: { slug: ejeSlug },
    });

    if (!eje) {
      return NextResponse.json(
        { exito: false, error: `Eje tematico "${ejeSlug}" no encontrado` },
        { status: 404 }
      );
    }

    // 4. Calcular rango de datos (24 horas)
    const range = getDateRange('EL_FOCO');

    // 5. Obtener menciones del eje tematico
    const resultado = await getMencionesForBulletin('EL_FOCO', {
      ejesTematicos: [ejeSlug],
    });

    if (resultado.totalMenciones === 0) {
      return NextResponse.json({
        exito: false,
        error: `No se encontraron menciones para el eje "${ejeSlug}" en el periodo`,
        ejeSlug,
        ejeNombre: eje.nombre,
      });
    }

    // 6. Obtener indicadores del eje
    const indicadores = await getIndicadoresParaEje(ejeSlug);
    const indicadoresPrompt = formatearIndicadoresPrompt(indicadores, eje.nombre);

    // 7. Formatear menciones
    const mencionesPrompt = formatearMencionesPrompt(resultado.menciones);

    // 8. Construir prompt completo
    const ventanaLabel = `${formatFechaBolivia(range.fechaInicio)} — ${formatFechaBolivia(range.fechaFin)}`;
    const userPrompt = construirPrompt(
      'EL_FOCO',
      mencionesPrompt,
      indicadoresPrompt,
      `Eje tematico: ${eje.nombre} (${eje.slug})\nDescripcion del eje: ${eje.descripcion ?? 'Sin descripcion'}\nTotal menciones: ${resultado.totalMenciones}\nPeriodo: ${ventanaLabel}`
    );

    // 9. Generar contenido con IA (GLM) — temperatura 0.5 para profundidad
    const zai = await ZAI.create();
    const temperatura = temperaturaOverride ?? PRODUCTOS.EL_FOCO.temperatura;

    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: PRODUCTOS.EL_FOCO.systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: temperatura,
    });

    const contenido = completion.choices[0]?.message?.content ?? '';
    const tokensUsados = completion.usage?.total_tokens;
    const modelo = completion.model;

    if (!contenido) {
      return NextResponse.json(
        { exito: false, error: 'La IA no genero contenido' },
        { status: 500 }
      );
    }

    // 10. Registrar en base de datos
    const titulo = generarTituloProducto('EL_FOCO', undefined, eje.nombre);
    const resumen = await getDedicatedResumen('EL_FOCO', {
      ejeSlug,
      menciones: resultado.menciones,
      indicadores: indicadoresPrompt,
    });

    const reporteId = await registrarReporte({
      tipoProducto: 'EL_FOCO',
      titulo,
      contenido,
      resumen,
      fechaInicio: range.fechaInicio,
      fechaFin: range.fechaFin,
      temperatura,
      tokensUsados,
      modeloIA: modelo,
      metadata: JSON.stringify({
        ejeSlug,
        ejeNombre: eje.nombre,
        totalMenciones: resultado.totalMenciones,
        totalIndicadores: indicadores.length,
      }),
    });

    // 11. Retornar resultado
    return NextResponse.json({
      exito: true,
      reporteId,
      titulo,
      contenido,
      resumen,
      metadata: {
        tipo: 'EL_FOCO',
        ejeSlug,
        ejeNombre: eje.nombre,
        temperatura,
        tokensUsados,
        modelo,
        totalMenciones: resultado.totalMenciones,
        totalIndicadores: indicadores.length,
      },
    });
  } catch (error) {
    console.error('[generate-foco] Error:', error);
    const mensaje = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json(
      { exito: false, error: `Error al generar El Foco: ${mensaje}` },
      { status: 500 }
    );
  }
}
