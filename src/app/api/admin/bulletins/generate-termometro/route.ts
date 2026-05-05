/**
 * DECODEX v0.8.0 — Generador: El Termometro
 * Motor ONION200 — Equipo B — TAREA 1a
 *
 * Boletin matutino 7:00 AM, ventana nocturna (12h),
 * clima mediatico, ~350 palabras, temperatura 0.3.
 *
 * POST /api/admin/bulletins/generate-termometro
 */

import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';
import { getProductConfig, getMencionesForBulletin, getDateRange, formatFechaBolivia } from '@/lib/bulletin/product-generator';
import { getIndicadoresParaEjes, formatearIndicadoresMultiplesPrompt } from '@/lib/indicadores/injector';
import { formatearMencionesPrompt, construirPrompt, registrarReporte, generarTituloProducto, getDedicatedResumen } from '@/lib/reportes-utils';
import { PRODUCTOS } from '@/constants/products';
import { guardedParse, RATE } from '@/lib/rate-guard';
import { generateTermometroSchema } from '@/lib/validations';

// ============================================
// Ejes para indicadores generales del clima
// ============================================

const EJES_CLIMA = [
  'politica-nacional',
  'economia',
  'seguridad',
  'medio-ambiente',
  'social',
  'internacional',
];

// ============================================
// POST Handler
// ============================================

export async function POST(request: NextRequest) {
  try {
    const parsed = await guardedParse(request, generateTermometroSchema, RATE.AI);
    if (parsed instanceof NextResponse) return parsed;
    const { temperatura: temperaturaOverride } = parsed.body;

    // 1. Obtener configuracion del producto
    const config = getProductConfig('EL_TERMOMETRO');
    if (!config) {
      return NextResponse.json(
        { exito: false, error: 'Producto EL_TERMOMETRO no encontrado en catalogo' },
        { status: 404 }
      );
    }

    // 2. Calcular rango de ventana nocturna
    const range = getDateRange('EL_TERMOMETRO');

    // 3. Obtener menciones de la ventana nocturna
    const resultado = await getMencionesForBulletin('EL_TERMOMETRO');

    if (resultado.totalMenciones === 0) {
      return NextResponse.json({
        exito: false,
        error: 'No se encontraron menciones en la ventana nocturna',
        fechaInicio: range.fechaInicio.toISOString(),
        fechaFin: range.fechaFin.toISOString(),
      });
    }

    // 4. Obtener indicadores para el clima general
    const indicadoresPorEje = await getIndicadoresParaEjes(EJES_CLIMA);
    const indicadoresPrompt = formatearIndicadoresMultiplesPrompt(indicadoresPorEje);

    // 5. Formatear menciones para el prompt
    const mencionesPrompt = formatearMencionesPrompt(resultado.menciones);

    // 6. Construir prompt completo
    const ventanaLabel = `${formatFechaBolivia(range.fechaInicio)} — ${formatFechaBolivia(range.fechaFin)}`;
    const userPrompt = construirPrompt(
      'EL_TERMOMETRO',
      mencionesPrompt,
      indicadoresPrompt,
      `Ventana de datos: ${ventanaLabel}\nTotal menciones: ${resultado.totalMenciones}`
    );

    // 7. Generar contenido con IA (GLM) usando system prompt del catálogo
    const zai = await ZAI.create();
    const temperatura = temperaturaOverride ?? PRODUCTOS.EL_TERMOMETRO.temperatura;

    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: PRODUCTOS.EL_TERMOMETRO.systemPrompt },
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

    // 8. Registrar en base de datos
    const titulo = generarTituloProducto('EL_TERMOMETRO');
    const resumen = await getDedicatedResumen('EL_TERMOMETRO', {
      menciones: resultado.menciones,
      fecha: ventanaLabel,
    });

    const reporteId = await registrarReporte({
      tipoProducto: 'EL_TERMOMETRO',
      titulo,
      contenido,
      resumen,
      fechaInicio: range.fechaInicio,
      fechaFin: range.fechaFin,
      temperatura,
      tokensUsados,
      modeloIA: modelo,
      metadata: JSON.stringify({ totalMenciones: resultado.totalMenciones }),
    });

    // 9. Retornar resultado
    return NextResponse.json({
      exito: true,
      reporteId,
      titulo,
      contenido,
      resumen,
      metadata: {
        tipo: 'EL_TERMOMETRO',
        temperatura,
        tokensUsados,
        modelo,
        totalMenciones: resultado.totalMenciones,
        ventana: ventanaLabel,
      },
    });
  } catch (error) {
    console.error('[generate-termometro] Error:', error);
    const mensaje = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json(
      { exito: false, error: `Error al generar El Termometro: ${mensaje}` },
      { status: 500 }
    );
  }
}
