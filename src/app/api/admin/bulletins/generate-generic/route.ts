/**
 * DECODEX v0.8.0 — Generador Generico de Productos
 * Motor ONION200 — Equipo B — TAREA 2d
 *
 * Endpoint generico con registry de system prompts por tipo.
 * Permite generar cualquier producto del catalogo sin
 * necesidad de un endpoint dedicado.
 *
 * POST /api/admin/bulletins/generate-generic
 */

import { NextRequest, NextResponse } from 'next/server';
import { INDICADOR_PROTOCOL } from '@/constants/products';
import { getProductConfig, getMencionesForBulletin, getDateRange } from '@/lib/bulletin/product-generator';
import { getIndicadoresConStats, formatearIndicadoresConStatsPrompt } from '@/lib/indicadores/injector';
import { formatearMencionesPrompt, construirPrompt, registrarReporte, generarTituloProducto, getDedicatedResumen, formatFechaBolivia, getSemanaAnho } from '@/lib/reportes-utils';
import { regenerateWithRetry } from '@/lib/quality/regeneration';
import { validateContent } from '@/lib/quality/validator';
import { type TipoBoletin } from '@/types/bulletin';
import { guardedParse, RATE } from '@/lib/rate-guard';
import { generateGenericSchema } from '@/lib/validations';
import { safeError } from '@/lib/safe-error';
import { verifyProduct } from '@/lib/verification/verify-product';
import { loadMarcoConceptual, formatMarcoForPrompt } from '@/lib/reporte-sectorial.alerts';

// ============================================
// POST Handler
// ============================================

export async function POST(request: NextRequest) {
  try {
    const parsed = await guardedParse(request, generateGenericSchema, RATE.AI);
    if (parsed instanceof NextResponse) return parsed;
    const {
      tipo: tipoRaw,
      ejeSlug,
      personaId,
      temperatura: temperaturaOverride,
      fechaInicio: fechaInicioStr,
      fechaFin: fechaFinStr,
      clienteId,
    } = parsed.body;
    const tipo = tipoRaw as TipoBoletin;

    // 2. Obtener configuracion
    const config = getProductConfig(tipo);
    if (!config || !config.activo) {
      return NextResponse.json(
        { exito: false, error: `Producto "${tipo}" no esta activo` },
        { status: 400 }
      );
    }

    // 3. Calcular rango de fechas
    const range = getDateRange(tipo);
    const inicio = fechaInicioStr ? new Date(fechaInicioStr) : range.fechaInicio;
    const fin = fechaFinStr ? new Date(fechaFinStr) : range.fechaFin;

    // 4. Obtener menciones
    // Para EL_RADAR: obtener todas con scoring epistemologico y seleccionar
    // las 50 mas relevantes con snippet de texto (150 chars) para dar contexto
    // sin reventar el limite de GLM.
    const EL_RADAR_CONFIG = { maxMenciones: 50, maxTextoLength: 150 };
    const isElRadar = tipo === 'EL_RADAR' && !ejeSlug && !personaId;

    let resultado: { menciones: Record<string, unknown>[]; totalMenciones: number };
    let mencionesAllFlat: Record<string, unknown>[] = [];

    const options: { ejesTematicos?: string[]; personaId?: string; customDays?: number } = {};
    if (ejeSlug) options.ejesTematicos = [ejeSlug];
    if (personaId) options.personaId = personaId;
    resultado = await getMencionesForBulletin(tipo, options);
    mencionesAllFlat = resultado.menciones;

    // IMPORTANTE: El producto SIEMPRE se crea, incluso con 0 menciones.
    // El administrador necesita visibilidad de cada generación para auditoría.
    // Si no hay menciones, se registra con estado "sin_datos" en vez de bloquear.
    const SIN_MENCIONES = resultado.totalMenciones === 0;

    if (SIN_MENCIONES) {
      // Registrar Reporte vacío para auditoría — no bloquear
      const titulo = generarTituloProducto(tipo, undefined, ejeSlug);
      const reporteId = await registrarReporte({
        tipoProducto: tipo,
        titulo,
        contenido: `[SIN_DATOS] ${tipo} — No se encontraron menciones en el periodo ${formatFechaBolivia(inicio)} — ${formatFechaBolivia(fin)}. Verificar: fuentes activas, jobs de scraping, batch_llm.`,
        resumen: `Sin menciones para ${tipo}. Periodo: ${formatFechaBolivia(inicio)} — ${formatFechaBolivia(fin)}. Pipeline: verificar fuentes activas y batch_llm.`,
        fechaInicio: inicio,
        fechaFin: fin,
        temperatura: 0,
        tokensUsados: 0,
        modeloIA: 'ninguno',
        metadata: JSON.stringify({
          generico: true,
          ejeSlug,
          personaId,
          totalMenciones: 0,
          estado: 'sin_datos',
        }),
        clienteId,
      });

      return NextResponse.json({
        exito: true,
        reporteId,
        titulo,
        contenido: null,
        resumen: `No se encontraron menciones para "${tipo}" en el periodo consultado`,
        sinDatos: true,
        metadata: {
          tipo,
          totalMenciones: 0,
          fechaInicio: inicio.toISOString(),
          fechaFin: fin.toISOString(),
        },
      });
    }

    // 5. Obtener indicadores según protocolo del producto
    const protocol = INDICADOR_PROTOCOL[tipo];
    const indicadoresStats = await getIndicadoresConStats(protocol);
    const indicadoresPrompt = formatearIndicadoresConStatsPrompt(indicadoresStats, `Indicadores ONION200 — ${config.nombre}`, { formato: protocol.formato });

    // 6. Construir prompt
    let mencionesPrompt: string;
    let datosExtra: string;
    const ventanaLabel = `${formatFechaBolivia(range.fechaInicio)} — ${formatFechaBolivia(range.fechaFin)}`;

    if (isElRadar) {
      // EL_RADAR: top 50 por scoring epistemologico, 150 chars de texto
      // Esto da contexto suficiente sin explotar el limite de GLM.
      mencionesPrompt = formatearMencionesPrompt(resultado.menciones, tipo, {
        maxMenciones: EL_RADAR_CONFIG.maxMenciones,
        maxTextoLength: EL_RADAR_CONFIG.maxTextoLength,
      });
      const semana = getSemanaAnho();
      datosExtra = [
        `Tipo de producto: ${config.nombre}`,
        `Periodo: ${ventanaLabel}`,
        `Semana ${semana}`,
        `Total menciones encontradas: ${resultado.totalMenciones}`,
        `Menciones seleccionadas (top scoring epistemologico): ${EL_RADAR_CONFIG.maxMenciones}`,
      ].join('\n');
    } else {
      mencionesPrompt = formatearMencionesPrompt(resultado.menciones, tipo);
      datosExtra = [
        `Tipo de producto: ${config.nombre}`,
        `Periodo: ${ventanaLabel}`,
        `Total menciones: ${resultado.totalMenciones}`,
      ].join('\n');
      if (ejeSlug) datosExtra += `\nEje tematico: ${ejeSlug}`;
      if (personaId) datosExtra += `\nPersona ID: ${personaId}`;
    }

    const userPrompt = construirPrompt(tipo, mencionesPrompt, indicadoresPrompt, datosExtra);
    console.log(`[generate-generic] ${tipo}: ${resultado.totalMenciones} menciones, mencionesPrompt=${mencionesPrompt.length}chars, indicadoresPrompt=${indicadoresPrompt.length}chars, userPrompt=${userPrompt.length}chars`);

    // 7. Cargar Marco Conceptual e inyectar en system prompt
    // Para EL_RADAR: incluir Marco Conceptual si el prompt total cabe en presupuesto seguro.
    // Budget: systemPrompt (~1500) + userPrompt + marco (~4000) < 35000 chars (marginen seguro)
    let marco = null;
    if (!isElRadar) {
      marco = await loadMarcoConceptual();
    } else {
      // EL_RADAR: calcular si hay espacio para Marco Conceptual
      const estimatedTotal = config.systemPrompt.length + userPrompt.length;
      const MARCO_BUDGET = 35000;
      if (estimatedTotal < MARCO_BUDGET - 5000) {
        marco = await loadMarcoConceptual();
        console.log(`[generate-generic] EL_RADAR: espacio disponible (${MARCO_BUDGET - estimatedTotal}chars), incluyendo Marco Conceptual`);
      } else {
        console.log(`[generate-generic] EL_RADAR: sin espacio para Marco Conceptual (prompt=${estimatedTotal}chars, budget=${MARCO_BUDGET})`);
      }
    }
    const marcoSection = marco
      ? `\n\n## MARCO CONCEPTUAL DECODEX (principios epistemologicos — obligatorio respetar):\n${formatMarcoForPrompt(marco)}\n`
      : '';
    const systemPrompt = (config.systemPrompt + marcoSection).trim();
    console.log(`[generate-generic] ${tipo}: systemPrompt=${systemPrompt.length}chars (base=${config.systemPrompt.length}, marco=${marcoSection.length})`);
    if (marco) {
      console.log(`[generate-generic] Marco Conceptual inyectado para ${tipo}.`);
    } else if (!isElRadar) {
      console.warn(`[generate-generic] Marco Conceptual no encontrado en DB para ${tipo}.`);
    }

    // 8. Generar con IA usando regenerateWithRetry (validacion + reintentos)
    const temperatura = temperaturaOverride ?? config.temperatura;

    const genResult = await regenerateWithRetry({
      systemPrompt,
      userPrompt,
      tipo,
      initialTemperatura: temperatura,
      onRetry: (intento, error) => {
        console.warn(`[generate-generic] Reintento ${intento} para ${tipo}: ${error}`);
      },
    });

    if (!genResult.exito || !genResult.contenido) {
      return NextResponse.json(
        { exito: false, error: genResult.error ?? 'La IA no genero contenido valido' },
        { status: 500 }
      );
    }

    const contenido = genResult.contenido;
    const tokensUsados = genResult.tokensUsados;
    const modelo = genResult.modelo;

    // 8. Verificacion post-generacion anti-alucinacion
    const textoVerificado = await verifyProduct(
      contenido,
      resultado.menciones.map(m => ({
        texto: (m.texto as string) ?? '',
        titulo: (m.titulo as string) ?? '',
        medio: (m.medio as string) ?? '',
        persona: (m.persona as string) ?? null,
      })),
      tipo
    );
    if (!textoVerificado.verified) {
      console.log('[generate-generic] ALERTA: Se elimino contenido no verificado:', textoVerificado.eliminados.length, 'items');
    }

    // 9. Validacion final de calidad
    const validation = validateContent(textoVerificado.textoLimpio, { tipo });

    // 9. Registrar en BD
    const titulo = generarTituloProducto(tipo, undefined, ejeSlug);
    const resumen = await getDedicatedResumen(tipo, {
      menciones: resultado.menciones,
      fecha: ventanaLabel,
      ejeSlug,
    });

    const reporteId = await registrarReporte({
      tipoProducto: tipo,
      titulo,
      contenido: textoVerificado.textoLimpio,
      resumen,
      fechaInicio: inicio,
      fechaFin: fin,
      temperatura,
      tokensUsados,
      modeloIA: modelo,
      metadata: JSON.stringify({
        generico: true,
        ejeSlug,
        personaId,
        totalMenciones: resultado.totalMenciones,
      }),
      clienteId,
    });

    // 10. Retornar resultado
    return NextResponse.json({
      exito: true,
      reporteId,
      titulo,
      contenido: textoVerificado.textoLimpio,
      resumen,
      metadata: {
        tipo,
        temperatura,
        tokensUsados,
        modelo,
        totalMenciones: resultado.totalMenciones,
        calidad: {
          puntuacion: validation.puntuacion,
          valido: validation.valido,
          advertencias: validation.advertencias,
          palabras: validation.estadisticas.palabras,
        },
        regeneracion: genResult.metadata,
      },
    });
  } catch (error) {
    console.error('[generate-generic] Error:', error);
    const { error: msg, code, details } = safeError(error);
    return NextResponse.json(
      { exito: false, error: msg, code, ...(details && { details }) },
      { status: 500 }
    );
  }
}
