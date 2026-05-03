/**
 * DECODEX v0.8.0 — Generador: Ficha Persona (Legislador)
 * Motor ONION200 — Equipo B — TAREA 6k
 *
 * Reporte individual de persona monitoreada,
 * ~1000 palabras, temperatura 0.3 (factual).
 *
 * POST /api/admin/bulletins/generate-ficha
 */

import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';
import { PRODUCTOS } from '@/constants/products';
import { db } from '@/lib/db';
import { getProductConfig, getDateRange, formatFechaBolivia } from '@/lib/bulletin/product-generator';
import { getIndicadoresParaEjes, formatearIndicadoresPrompt } from '@/lib/indicadores/injector';
import { formatearMencionesPrompt, construirPrompt, registrarReporte, generarTituloProducto, getDedicatedResumen } from '@/lib/reportes-utils';
import { type MencionEnriquecida } from '@/types/bulletin';

// ============================================
// POST Handler
// ============================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { personaId, temperatura: temperaturaOverride } = body as {
      personaId?: string;
      temperatura?: number;
    };

    // 1. Validar parametro obligatorio personaId
    if (!personaId || typeof personaId !== 'string') {
      return NextResponse.json(
        { exito: false, error: 'Parametro "personaId" es obligatorio para FICHA_LEGISLADOR' },
        { status: 400 }
      );
    }

    // 2. Obtener datos de la persona
    const persona = await db.persona.findUnique({
      where: { id: personaId },
    });

    if (!persona) {
      return NextResponse.json(
        { exito: false, error: `Persona con ID "${personaId}" no encontrada` },
        { status: 404 }
      );
    }

    // 3. Calcular rango semanal
    const range = getDateRange('FICHA_LEGISLADOR');

    // 4. Obtener menciones de la persona
    const mencionesDB = await db.mencion.findMany({
      where: {
        personaId,
        fechaPublicacion: {
          gte: range.fechaInicio,
          lte: range.fechaFin,
        },
      },
      include: {
        medio: { select: { nombre: true, tipo: true } },
        ejesTematicos: {
          include: {
            ejeTematico: { select: { slug: true, nombre: true } },
          },
        },
      },
      orderBy: { fechaPublicacion: 'desc' },
      take: 40,
    });

    // 5. Enriquecer menciones
    const menciones: MencionEnriquecida[] = mencionesDB.map((m) => ({
      id: m.id,
      titulo: m.titulo,
      resumen: m.texto ? m.texto.slice(0, 200) : null,
      medio: m.medio?.nombre ?? null,
      persona: persona.nombre,
      fechaPublicacion: formatFechaBolivia(m.fechaPublicacion ?? m.fechaCaptura),
      sentimiento: m.sentimiento,
      relevancia: 5,
      temas: m.ejesTematicos.map((mt) => mt.ejeTematico.slug),
      url: m.url,
    }));

    // 6. Obtener ejes tematicos de las menciones
    const ejesUnicos = [...new Set(menciones.flatMap((m) => m.temas))];
    const indicadoresPorEje = await getIndicadoresParaEjes(ejesUnicos);

    // 7. Construir datos biograficos
    const datosBio = [
      `Nombre: ${persona.nombre}`,
      persona.cargoDirectiva ? `Cargo: ${persona.cargoDirectiva}` : null,
      `Departamento: ${persona.departamento}`,
      `Partido: ${persona.partido} (${persona.partidoSigla})`,
      persona.email ? `Email: ${persona.email}` : null,
    ].filter(Boolean).join('\n');

    // 8. Formatear indicadores
    const indicadoresText = ejesUnicos.length > 0
      ? formatearIndicadoresPrompt(
          ejesUnicos.flatMap((e) => indicadoresPorEje[e] ?? []),
          'Ejes tematicos del legislador'
        )
      : 'Sin indicadores disponibles';

    // 9. Formatear menciones
    const mencionesPrompt = formatearMencionesPrompt(menciones);

    // 10. Construir prompt completo
    const ventanaLabel = `${formatFechaBolivia(range.fechaInicio)} — ${formatFechaBolivia(range.fechaFin)}`;
    const userPrompt = construirPrompt(
      'FICHA_LEGISLADOR',
      mencionesPrompt,
      indicadoresText,
      `${datosBio}\n\nPeriodo analizado: ${ventanaLabel}\nTotal menciones: ${menciones.length}\nEjes tematicos: ${ejesUnicos.join(', ') || 'Sin ejes'}\nMedios que mencionan: ${[...new Set(menciones.map(m => m.medio))].filter(Boolean).join(', ') || 'Sin medios'}`
    );

    // 11. Generar con IA
    const zai = await ZAI.create();
    const temperatura = temperaturaOverride ?? PRODUCTOS.FICHA_LEGISLADOR.temperatura;

    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: PRODUCTOS.FICHA_LEGISLADOR.systemPrompt },
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

    // 12. Registrar en BD
    const titulo = generarTituloProducto('FICHA_LEGISLADOR', undefined, persona.nombre);
    const resumen = await getDedicatedResumen('FICHA_LEGISLADOR', {
      nombre: persona.nombre,
      menciones,
    });

    const reporteId = await registrarReporte({
      tipoProducto: 'FICHA_LEGISLADOR',
      titulo,
      contenido,
      resumen,
      fechaInicio: range.fechaInicio,
      fechaFin: range.fechaFin,
      temperatura,
      tokensUsados,
      modeloIA: modelo,
      metadata: JSON.stringify({
        personaId: persona.id,
        personaNombre: persona.nombre,
        totalMenciones: menciones.length,
        ejesTematicos: ejesUnicos,
        mediosUnicos: [...new Set(menciones.map(m => m.medio).filter(Boolean))],
      }),
    });

    // 13. Retornar resultado
    return NextResponse.json({
      exito: true,
      reporteId,
      titulo,
      contenido,
      resumen,
      metadata: {
        tipo: 'FICHA_LEGISLADOR',
        personaId: persona.id,
        personaNombre: persona.nombre,
        temperatura,
        tokensUsados,
        modelo,
        totalMenciones: menciones.length,
        ejesTematicos: ejesUnicos,
      },
    });
  } catch (error) {
    console.error('[generate-ficha] Error:', error);
    const mensaje = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json(
      { exito: false, error: `Error al generar Ficha Persona: ${mensaje}` },
      { status: 500 }
    );
  }
}
