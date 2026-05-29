import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import ZAI from 'z-ai-web-dev-sdk';
import { registrarLlamadaLLM, USO_FUENTE } from '@/lib/registrar-uso-ia';

/* ─── Prompt del sistema para detectar tipo de instrucción ─── */
const SYSTEM_PROMPT = `Eres un asistente del sistema DECODEX Bolivia, una plataforma de inteligencia de medios que monitorea señales políticas en Bolivia.

Tu ÚNICA tarea es analizar instrucciones del administrador y devolver un JSON con la estructura EXACTA:

{
  "tipo": "regenerar_producto" | "corregir_clasificacion" | "anadir_keywords" | "desactivar_keywords" | "resumir_periodo" | "otro",
  "productoAfectado": "string|null",
  "accion": "descripción de lo que se debe hacer",
  "detalle": "detalles adicionales o contexto extraído"
}

REGLAS:
- REGENERAR PRODUCTO: cuando el admin pide regenerar un producto específico (Termómetro, Foco, Radar, Saldo, Boletín, etc.)
- CORREGIR CLASIFICACION: cuando el admin dice que una mención/artículo está mal clasificado
- ANADIR KEYWORDS: cuando el admin quiere añadir nuevos términos de búsqueda
- DESACTIVAR KEYWORDS: cuando el admin reporta falsos positivos o quiere desactivar/cambiar keywords
- RESUMIR PERIODO: cuando el admin pide un resumen de un período de tiempo
- OTRO: cualquier otra instrucción

CONTEXTO BOLIVIANO:
- Leyes: Ley 1720 (Servicio Nacional de Patrimonio del Estado), Ley 1008, etc.
- Movilizaciones: marchas indígenas, bloqueos de caminos, paros de hambre, huelgas
- Actores: MAS-IPSP, Comunidad Ciudadana, CREEMOS, diputados, senadores
- Productos DECODEX: Termómetro, Foco, Radar, Saldo, Boletín Grano, Boletín Express

Responde SOLO el JSON, sin texto adicional.`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { instruccion } = body;

    if (!instruccion || typeof instruccion !== 'string' || instruccion.trim().length < 3) {
      return NextResponse.json(
        { error: 'La instrucción es requerida y debe tener al menos 3 caracteres' },
        { status: 400 }
      );
    }

    // ─── 1. Save feedback BEFORE executing (for audit trail) ───
    const feedback = await db.adminFeedback.create({
      data: {
        tipo: 'otro', // Will update after LLM parsing
        instruccionOriginal: instruccion.trim(),
        resultado: 'parcial',
        accionEjecutada: 'Procesando...',
        detalle: 'Instrucción recibida, pendiente de análisis',
      },
    });

    // ─── 2. Parse instruction type with LLM ───
    let parsed: {
      tipo: string;
      productoAfectado: string | null;
      accion: string;
      detalle: string;
    };

    try {
      const zai = await ZAI.create();
      const completion = await zai.chat.completions.create({
        model: 'glm-4.7-flash',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: instruccion.trim() },
        ],
        temperature: 0.1,
        max_tokens: 300,
      });

      const raw = completion.choices?.[0]?.message?.content || '';

      // Registrar uso IA
      registrarLlamadaLLM({ completion, fuente: USO_FUENTE.INSTRUCCION, detalles: 'parse-tipo' }).catch(() => {});
      // Extract JSON from response
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No se pudo extraer JSON de la respuesta del LLM');

      parsed = JSON.parse(jsonMatch[0]);
    } catch (llmError) {
      console.error('[AI Instruccion] Error parsing instruction:', llmError);
      // Fallback: simple keyword-based detection
      parsed = fallbackParse(instruccion.trim());
    }

    const tipo = parsed.tipo || 'otro';
    const productoAfectado = parsed.productoAfectado || null;
    const accion = parsed.accion || instruccion.trim();

    // ─── 3. Execute appropriate action ───
    let resultado: 'exito' | 'error' | 'parcial' = 'parcial';
    let mensaje = '';
    let detalle = parsed.detalle || '';

    try {
      switch (tipo) {
        case 'regenerar_producto':
          ({ resultado, mensaje, detalle } = await handleRegenerar(productoAfectado, accion, detalle));
          break;
        case 'corregir_clasificacion':
          ({ resultado, mensaje, detalle } = await handleCorregirClasificacion(instruccion.trim(), detalle));
          break;
        case 'anadir_keywords':
          ({ resultado, mensaje, detalle } = await handleAnadirKeywords(instruccion.trim(), detalle));
          break;
        case 'desactivar_keywords':
          ({ resultado, mensaje, detalle } = await handleDesactivarKeywords(instruccion.trim(), detalle));
          break;
        case 'resumir_periodo':
          ({ resultado, mensaje, detalle } = await handleResumirPeriodo(instruccion.trim(), detalle));
          break;
        default:
          ({ resultado, mensaje, detalle } = await handleOtro(instruccion.trim(), detalle));
      }
    } catch (actionError) {
      resultado = 'error';
      mensaje = `Error ejecutando acción: ${actionError instanceof Error ? actionError.message : 'Desconocido'}`;
      detalle = String(actionError);
    }

    // ─── 4. Check for proactive suggestion (3+ same tipo in last 7 days) ───
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const sameTipoCount = await db.adminFeedback.count({
      where: {
        tipo,
        createdAt: { gte: sevenDaysAgo },
      },
    });

    let sugerencia: string | undefined;
    const sugerenciaGenerada = sameTipoCount >= 3;

    if (sugerenciaGenerada) {
      sugerencia = await generateSugerencia(tipo, sameTipoCount);
    }

    // ─── 5. Update feedback record ───
    await db.adminFeedback.update({
      where: { id: feedback.id },
      data: {
        tipo,
        productoAfectado,
        accionEjecutada: accion,
        resultado,
        detalle: detalle || mensaje,
        sugerenciaGenerada,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      tipo,
      accion,
      resultado,
      mensaje,
      sugerencia: sugerenciaGenerada ? sugerencia : undefined,
      feedbackId: feedback.id,
    });
  } catch (error) {
    console.error('[AI Instruccion] Error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor al procesar la instrucción' },
      { status: 500 }
    );
  }
}

/* ═══════════════════════════════════════════════════════════
   ACTION HANDLERS
   ═══════════════════════════════════════════════════════════ */

async function handleRegenerar(
  productoAfectado: string | null,
  accion: string,
  detalle: string
): Promise<{ resultado: 'exito' | 'error' | 'parcial'; mensaje: string; detalle: string }> {
  const producto = productoAfectado || 'producto';
  return {
    resultado: 'parcial',
    mensaje: `📋 Regeneración de "${producto}" registrada. El sistema preparará la regeneración con los parámetros actualizados.`,
    detalle: `Producto: ${producto}. Acción: ${accion}. ${detalle}`,
  };
}

async function handleCorregirClasificacion(
  instruccion: string,
  detalle: string
): Promise<{ resultado: 'exito' | 'error' | 'parcial'; mensaje: string; detalle: string }> {
  // Try to find menciones that might match the description
  const menciones = await db.mencion.findMany({
    take: 5,
    orderBy: { fechaCaptura: 'desc' },
    select: { id: true, titulo: true, temas: true, sentimiento: true },
  });

  return {
    resultado: 'parcial',
    mensaje: `📝 Corrección de clasificación registrada. Se encontraron ${menciones.length} menciones recientes para revisión. La reclasificación se aplicará en el próximo ciclo de análisis.`,
    detalle: `${detalle}. Menciones recientes disponibles: ${menciones.map(m => m.id).join(', ')}`,
  };
}

async function handleAnadirKeywords(
  instruccion: string,
  detalle: string
): Promise<{ resultado: 'exito' | 'error' | 'parcial'; mensaje: string; detalle: string }> {
  // Extract keywords from instruction using simple parsing
  const keywordPattern = /(?:keywords?:|términos?:|añade|agrega|agregar?)\s*[:\s]*(.+)/i;
  const match = instruccion.match(keywordPattern);
  const keywordsRaw = match ? match[1] : instruccion;

  // Parse comma-separated keywords
  const newKeywords = keywordsRaw
    .split(/[,;]+/)
    .map(k => k.trim().replace(/^['"]|['"]$/g, ''))
    .filter(k => k.length > 2);

  // Batch: createMany instead of N individual creates
  const created: string[] = [];
  if (newKeywords.length > 0) {
    // Check existing to avoid duplicates
    const existing = await db.keyword.findMany({
      where: { termino: { in: newKeywords } },
      select: { termino: true },
    });
    const existingSet = new Set(existing.map(k => k.termino));
    const toCreate = newKeywords.filter(k => !existingSet.has(k));

    if (toCreate.length > 0) {
      try {
        await db.keyword.createMany({
          data: toCreate.map(termino => ({
            id: `kw_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
            termino,
            updatedAt: new Date(),
          })),
          skipDuplicates: true,
        });
        created.push(...toCreate);
      } catch {
        // Keyword might already exist, skip
      }
    }
  }

  return {
    resultado: created.length > 0 ? 'exito' : 'parcial',
    mensaje: created.length > 0
      ? `🏷️ ${created.length} keyword(s) añadida(s): ${created.join(', ')}`
      : '⚠️ No se pudieron añadir keywords. Verifica que los términos sean válidos.',
    detalle: `Keywords procesadas: ${newKeywords.join(', ')}. Creadas: ${created.join(', ')}. ${detalle}`,
  };
}

async function handleDesactivarKeywords(
  instruccion: string,
  detalle: string
): Promise<{ resultado: 'exito' | 'error' | 'parcial'; mensaje: string; detalle: string }> {
  // Extract keyword to deactivate
  const keywordMatch = instruccion.match(/(?:keyword|término)\s+["']?([^"',.]+)["']?/i);
  const targetKeyword = keywordMatch ? keywordMatch[1].trim() : '';

  // Also check for replacement keyword
  const replaceMatch = instruccion.match(/(?:cámbialo|cambiar|reemplazar|por)\s+(?:a\s+)?["']?([^"',.]+)["']?/i);
  const replacementKeyword = replaceMatch ? replaceMatch[1].trim() : '';

  if (targetKeyword) {
    // Deactivate the keyword
    const deactivated = await db.keyword.updateMany({
      where: { termino: { contains: targetKeyword }, activo: true },
      data: { activo: false, updatedAt: new Date() },
    });

    let replacementMsg = '';
    if (replacementKeyword) {
      try {
        await db.keyword.create({
          data: {
            id: `kw_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
            termino: replacementKeyword,
            activo: true,
            updatedAt: new Date(),
          },
        });
        replacementMsg = ` Reemplazado por: "${replacementKeyword}".`;
      } catch {
        replacementMsg = ` No se pudo crear el reemplazo "${replacementKeyword}".`;
      }
    }

    return {
      resultado: deactivated.count > 0 ? 'exito' : 'parcial',
      mensaje: `🔓 ${deactivated.count} keyword(s) desactivada(s): "${targetKeyword}".${replacementMsg}`,
      detalle: `${detalle}. Keywords desactivadas: ${deactivated.count}.`,
    };
  }

  return {
    resultado: 'parcial',
    mensaje: '⚠️ No se pudo identificar el keyword a desactivar. Intenta ser más específico.',
    detalle: `Instrucción: ${instruccion}`,
  };
}

async function handleResumirPeriodo(
  instruccion: string,
  detalle: string
): Promise<{ resultado: 'exito' | 'error' | 'parcial'; mensaje: string; detalle: string }> {
  // Parse period from instruction
  let horas = 24;
  const hoursMatch = instruccion.match(/(\d+)\s*(?:horas|hs|h)/i);
  const daysMatch = instruccion.match(/(\d+)\s*(?:días|dias|d)/i);
  if (hoursMatch) horas = parseInt(hoursMatch[1]);
  else if (daysMatch) horas = parseInt(daysMatch[1]) * 24;

  const desde = new Date();
  desde.setHours(desde.getHours() - horas);

  const menciones = await db.mencion.findMany({
    where: { fechaCaptura: { gte: desde } },
    orderBy: { fechaCaptura: 'desc' },
    take: 50,
    select: {
      id: true,
      titulo: true,
      sentimiento: true,
      temas: true,
      fechaCaptura: true,
      Persona: { select: { nombre: true } },
      Medio: { select: { nombre: true } },
    },
  });

  // Generate summary with LLM
  let summary = '';
  if (menciones.length > 0) {
    try {
      const zai = await ZAI.create();
      const mencionesText = menciones.slice(0, 20).map((m, i) =>
        `${i + 1}. [${m.Medio?.nombre || 'N/A'}] ${m.titulo} — ${m.persona?.nombre || 'N/A'} (${m.sentimiento})`
      ).join('\n');

      const completion = await zai.chat.completions.create({
        model: 'glm-4.7-flash',
        messages: [
          {
            role: 'system',
            content: `Eres un analista de inteligencia de medios en Bolivia. Genera un RESUMEN BREVE (3-5 oraciones) de las menciones proporcionadas. Contexto político boliviano actual. Responde en español. Sé conciso y objetivo.`,
          },
          { role: 'user', content: `Resume las últimas ${horas} horas:\n\n${mencionesText}` },
        ],
        temperature: 0.3,
        max_tokens: 400,
      });

      summary = completion.choices?.[0]?.message?.content || '';

      // Registrar uso IA (segunda llamada)
      registrarLlamadaLLM({ completion, fuente: USO_FUENTE.INSTRUCCION, detalles: 'resumen-periodo' }).catch(() => {});
    } catch {
      summary = `${menciones.length} menciones encontradas en las últimas ${horas} horas.`;
    }
  } else {
    summary = `No se encontraron menciones en las últimas ${horas} horas.`;
  }

  return {
    resultado: 'exito',
    mensaje: `📊 Resumen de las últimas ${horas} horas: ${menciones.length} menciones procesadas.\n\n${summary}`,
    detalle: `Período: ${horas}h. Menciones: ${menciones.length}. ${detalle}`,
  };
}

async function handleOtro(
  instruccion: string,
  detalle: string
): Promise<{ resultado: 'exito' | 'error' | 'parcial'; mensaje: string; detalle: string }> {
  return {
    resultado: 'parcial',
    mensaje: `🤖 Instrucción recibida: "${instruccion.substring(0, 80)}${instruccion.length > 80 ? '...' : ''}". El sistema ha registrado tu solicitud. Esta funcionalidad estará disponible próximamente.`,
    detalle: `Tipo: otro. ${detalle}`,
  };
}

/* ═══════════════════════════════════════════════════════════
   FALLBACK PARSER (when LLM fails)
   ═══════════════════════════════════════════════════════════ */

function fallbackParse(instruccion: string) {
  const lower = instruccion.toLowerCase();

  if (lower.includes('regenera') || lower.includes('regenerar')) {
    const prodMatch = instruccion.match(/(?:regenera[r]?)\s+(?:el\s+)?(\w[\w\s]*?)(?:\s+porque|\s+ya|\s+no|\.$|$)/i);
    return {
      tipo: 'regenerar_producto',
      productoAfectado: prodMatch ? prodMatch[1].trim() : null,
      accion: `Regenerar producto: ${prodMatch?.[1]?.trim() || 'no especificado'}`,
      detalle: 'Detectado por fallback parser',
    };
  }

  if (lower.includes('mal clasificad') || lower.includes('clasificación incorrecta') || lower.includes('debería ser')) {
    return {
      tipo: 'corregir_clasificacion',
      productoAfectado: null,
      accion: 'Corregir clasificación de mención',
      detalle: 'Detectado por fallback parser',
    };
  }

  if (lower.includes('añade') || lower.includes('agrega') || lower.includes('keywords') || lower.includes('keyword')) {
    return {
      tipo: 'anadir_keywords',
      productoAfectado: null,
      accion: 'Añadir keywords al sistema',
      detalle: 'Detectado por fallback parser',
    };
  }

  if (lower.includes('desactiva') || lower.includes('falso positivo') || lower.includes('cámbialo') || lower.includes('cambiar')) {
    return {
      tipo: 'desactivar_keywords',
      productoAfectado: null,
      accion: 'Desactivar keyword falso positivo',
      detalle: 'Detectado por fallback parser',
    };
  }

  if (lower.includes('resum') || lower.includes('últimas')) {
    return {
      tipo: 'resumir_periodo',
      productoAfectado: null,
      accion: 'Generar resumen de período',
      detalle: 'Detectado por fallback parser',
    };
  }

  return {
    tipo: 'otro',
    productoAfectado: null,
    accion: instruccion,
    detalle: 'No se pudo determinar el tipo de instrucción',
  };
}

/* ═══════════════════════════════════════════════════════════
   PROACTIVE SUGGESTION GENERATOR
   ═══════════════════════════════════════════════════════════ */

async function generateSugerencia(
  tipo: string,
  count: number,
): Promise<string> {
  const sugerenciasPorTipo: Record<string, string> = {
    regenerar_producto: `⚠️ Has solicitado regenerar productos ${count} veces en los últimos 7 días. ¿Deseas revisar la configuración base del generador para evitar correcciones repetitivas?`,
    corregir_clasificacion: `⚠️ Se han reportado ${count} correcciones de clasificación en los últimos 7 días. Te sugiero revisar y actualizar los clasificadores en la sección de Configuración > Marco Conceptual.`,
    anadir_keywords: `💡 Has añadido keywords ${count} veces recientemente. Considera agruparlos bajo un eje temático específico para mejorar la precisión del monitoreo.`,
    desactivar_keywords: `🔍 ${count} keywords han sido marcadas como falsos positivos. Recomiendo revisar la configuración de matching para ajustar la sensibilidad del sistema.`,
    resumir_periodo: `📊 Has solicitado ${count} resúmenes en los últimos 7 días. Puedes configurar la entrega automática de resúmenes en Contratos > Entregas.`,
    otro: `🤖 Esta instrucción se ha repetido ${count} veces. El equipo de DECODEX puede ayudarte a automatizar esta acción.`,
  };

  return sugerenciasPorTipo[tipo] || `💡 Esta acción se ha repetido ${count} veces en los últimos 7 días.`;
}
