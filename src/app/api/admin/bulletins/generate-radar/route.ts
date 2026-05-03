/**
 * DECODEX v0.8.0 — Generador: El Radar
 * Motor ONION200 — Equipo B — TAREA 1c
 *
 * Radar semanal de los 11 ejes tematicos,
 * ~500 palabras, temperatura 0.3.
 *
 * POST /api/admin/bulletins/generate-radar
 */

import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';
import { PRODUCTOS } from '@/constants/products';
import { db } from '@/lib/db';
import { getProductConfig, getDateRange, formatFechaBolivia } from '@/lib/bulletin/product-generator';
import { getIndicadoresParaEjes, formatearIndicadoresMultiplesPrompt } from '@/lib/indicadores/injector';
import { formatearMencionesPorEje, construirPrompt, registrarReporte, generarTituloProducto, getDedicatedResumen, getSemanaAnho } from '@/lib/reportes-utils';

// ============================================
// Los 11 Ejes Tematicos de DECODEX
// ============================================

const EJES_TEOMATICOS = [
  'politica-nacional',
  'economia',
  'seguridad',
  'medio-ambiente',
  'social',
  'internacional',
  'legislativo',
  'justicia',
  'salud',
  'educacion',
  'tecnologia',
];

// ============================================
// POST Handler
// ============================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const temperaturaOverride = body.temperatura as number | undefined;

    // 1. Obtener configuracion del producto
    const config = getProductConfig('EL_RADAR');
    if (!config) {
      return NextResponse.json(
        { exito: false, error: 'Producto EL_RADAR no encontrado en catalogo' },
        { status: 404 }
      );
    }

    // 2. Calcular rango semanal
    const range = getDateRange('EL_RADAR');
    const semana = getSemanaAnho();

    // 3. Obtener menciones por cada eje tematico
    const mencionesPorEje: Record<string, Array<Record<string, unknown>>> = {};
    const totalMencionesPorEje: Record<string, number> = {};

    for (const slug of EJES_TEOMATICOS) {
      const menciones = await db.mencion.findMany({
        where: {
          fechaCaptura: {
            gte: range.fechaInicio,
            lte: range.fechaFin,
          },
          ejesTematicos: {
            some: {
              ejeTematico: { slug },
            },
          },
        },
        include: {
          medio: { select: { nombre: true } },
          persona: { select: { nombre: true } },
        },
        orderBy: { fechaPublicacion: 'desc' },
        take: 10,
      });

      mencionesPorEje[slug] = menciones.map((m) => ({
        titulo: m.titulo,
        medio: m.medio?.nombre ?? null,
        persona: m.persona?.nombre ?? null,
        sentimiento: m.sentimiento,
      }));

      totalMencionesPorEje[slug] = menciones.length;
    }

    const totalMenciones = Object.values(totalMencionesPorEje).reduce((a, b) => a + b, 0);

    if (totalMenciones === 0) {
      return NextResponse.json({
        exito: false,
        error: 'No se encontraron menciones en la ventana semanal',
        semana,
        fechaInicio: range.fechaInicio.toISOString(),
        fechaFin: range.fechaFin.toISOString(),
      });
    }

    // 4. Obtener indicadores de todos los ejes
    const indicadoresPorEje = await getIndicadoresParaEjes(EJES_TEOMATICOS);
    const indicadoresPrompt = formatearIndicadoresMultiplesPrompt(indicadoresPorEje);

    // 5. Formatear menciones por eje
    const mencionesPrompt = formatearMencionesPorEje(mencionesPorEje);

    // 6. Construir prompt
    const ventanaLabel = `${formatFechaBolivia(range.fechaInicio)} al ${formatFechaBolivia(range.fechaFin)}`;
    const resumenEjes = EJES_TEOMATICOS
      .map((slug) => `- ${slug}: ${totalMencionesPorEje[slug]} menciones`)
      .join('\n');

    const userPrompt = construirPrompt(
      'EL_RADAR',
      mencionesPrompt,
      indicadoresPrompt,
      `Semana ${semana} | Periodo: ${ventanaLabel}\nTotal menciones: ${totalMenciones}\n\nDistribucion por eje:\n${resumenEjes}`
    );

    // 7. Generar con IA
    const zai = await ZAI.create();
    const temperatura = temperaturaOverride ?? PRODUCTOS.EL_RADAR.temperatura;

    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: PRODUCTOS.EL_RADAR.systemPrompt },
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

    // 8. Registrar en BD
    const titulo = generarTituloProducto('EL_RADAR');
    const resumen = await getDedicatedResumen('EL_RADAR', {
      ejes: totalMencionesPorEje,
      fecha: ventanaLabel,
    });

    const reporteId = await registrarReporte({
      tipoProducto: 'EL_RADAR',
      titulo,
      contenido,
      resumen,
      fechaInicio: range.fechaInicio,
      fechaFin: range.fechaFin,
      temperatura,
      tokensUsados,
      modeloIA: modelo,
      metadata: JSON.stringify({
        semana,
        totalMenciones,
        totalMencionesPorEje,
        ejesCubiertos: EJES_TEOMATICOS.length,
      }),
    });

    // 9. Retornar resultado
    return NextResponse.json({
      exito: true,
      reporteId,
      titulo,
      contenido,
      resumen,
      metadata: {
        tipo: 'EL_RADAR',
        semana,
        temperatura,
        tokensUsados,
        modelo,
        totalMenciones,
        ejesCubiertos: EJES_TEOMATICOS.length,
        distribucionPorEje: totalMencionesPorEje,
      },
    });
  } catch (error) {
    console.error('[generate-radar] Error:', error);
    const mensaje = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json(
      { exito: false, error: `Error al generar El Radar: ${mensaje}` },
      { status: 500 }
    );
  }
}
