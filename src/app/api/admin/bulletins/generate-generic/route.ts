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
import { PRODUCTOS, INDICADOR_PROTOCOL } from '@/constants/products';
import { getProductConfig, getMencionesForBulletin, getDateRange } from '@/lib/bulletin/product-generator';
import { getIndicadoresConStats, formatearIndicadoresConStatsPrompt } from '@/lib/indicadores/injector';
import { formatearMencionesPrompt, formatearMencionesPorEje, construirPrompt, registrarReporte, generarTituloProducto, getDedicatedResumen, formatFechaBolivia, getSemanaAnho } from '@/lib/reportes-utils';
import { regenerateWithRetry } from '@/lib/quality/regeneration';
import { validateContent } from '@/lib/quality/validator';
import { type TipoBoletin } from '@/types/bulletin';
import { guardedParse, RATE } from '@/lib/rate-guard';
import { generateGenericSchema } from '@/lib/validations';
import { safeError } from '@/lib/safe-error';
import { verifyProduct } from '@/lib/verification/verify-product';
import { loadMarcoConceptual, formatMarcoForPrompt } from '@/lib/reporte-sectorial.alerts';
import db from '@/lib/db';

// ============================================
// Mapa de ejes tematicos sugeridos por tipo de producto.
// ============================================

const DEFAULT_EJES_BY_TYPE: Partial<Record<TipoBoletin, string[]>> = {
  EL_TERMOMETRO: ['politica-nacional', 'economia', 'seguridad', 'social', 'medio-ambiente'],
  SALDO_DEL_DIA: ['politica-nacional', 'economia', 'seguridad', 'social'],
  EL_RADAR: [
    'politica-nacional', 'economia', 'seguridad', 'medio-ambiente',
    'social', 'internacional', 'legislativo', 'justicia',
    'salud', 'educacion', 'tecnologia',
  ],
  VOZ_Y_VOTO: ['legislativo', 'politica-nacional', 'justicia'],
  EL_HILO: ['politica-nacional', 'economia', 'seguridad', 'social'],
  EL_INFORME_CERRADO: [
    'politica-nacional', 'economia', 'seguridad', 'medio-ambiente',
    'social', 'internacional', 'legislativo',
  ],
};

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
    // Para EL_RADAR: usar formato ligero por eje (10 menciones/eje, sin texto)
    // para evitar prompts de 80K+ chars que GLM rechaza con error 1210.
    const USE_LIGHTWEIGHT_MENCIONES = tipo === 'EL_RADAR';

    let resultado: { menciones: Record<string, unknown>[]; totalMenciones: number };
    let mencionesAllFlat: Record<string, unknown>[] = [];
    let totalMencionesPorEje: Record<string, number> = {};

    if (USE_LIGHTWEIGHT_MENCIONES && !ejeSlug && !personaId) {
      const ejes = DEFAULT_EJES_BY_TYPE.EL_RADAR!;
      const mencionesPorEjeData: Record<string, Array<Record<string, unknown>>> = {};

      const ejeResults = await Promise.all(
        ejes.map(async (slug) => {
          const menciones = await db.mencion.findMany({
            where: {
              fechaCaptura: { gte: range.fechaInicio, lte: range.fechaFin },
              MencionTema: { some: { EjeTematico: { slug } } },
            },
            include: {
              Medio: { select: { nombre: true } },
              Persona: { select: { nombre: true } },
            },
            orderBy: { fechaPublicacion: 'desc' },
            take: 10,
          });
          return { slug, menciones };
        })
      );

      for (const { slug, menciones } of ejeResults) {
        mencionesPorEjeData[slug] = menciones.map((m) => ({
          titulo: m.titulo,
          medio: m.Medio?.nombre ?? null,
          persona: m.Persona?.nombre ?? null,
          sentimiento: m.tratamientoPeriodistico,
        }));
        totalMencionesPorEje[slug] = menciones.length;
        mencionesAllFlat.push(...mencionesPorEjeData[slug]);
      }

      const totalMenciones = Object.values(totalMencionesPorEje).reduce((a, b) => a + b, 0);
      resultado = { menciones: mencionesAllFlat, totalMenciones };
    } else {
      const options: { ejesTematicos?: string[]; personaId?: string; customDays?: number } = {};
      if (ejeSlug) options.ejesTematicos = [ejeSlug];
      if (personaId) options.personaId = personaId;
      resultado = await getMencionesForBulletin(tipo, options);
      mencionesAllFlat = resultado.menciones;
    }

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

    if (USE_LIGHTWEIGHT_MENCIONES && !ejeSlug && !personaId) {
      // Formato ligero por eje para EL_RADAR (sin texto de articulo)
      // Reconstruir mencionesPorEje desde los datos obtenidos arriba
      const ejeSlugs = DEFAULT_EJES_BY_TYPE.EL_RADAR!;
      const mencionesPorEjeMap: Record<string, Array<Record<string, unknown>>> = {};
      let idx = 0;
      for (const slug of ejeSlugs) {
        const count = totalMencionesPorEje[slug] ?? 0;
        mencionesPorEjeMap[slug] = mencionesAllFlat.slice(idx, idx + count);
        idx += count;
      }
      mencionesPrompt = formatearMencionesPorEje(mencionesPorEjeMap);

      // Agregar distribucion por eje
      const resumenEjes = ejeSlugs
        .map((slug) => `- ${slug}: ${totalMencionesPorEje[slug] ?? 0} menciones`)
        .join('\n');
      const semana = getSemanaAnho();
      datosExtra = `Semana ${semana} | Periodo: ${ventanaLabel}\nTotal menciones: ${resultado.totalMenciones}\n\nDistribucion por eje:\n${resumenEjes}`;
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
    // Skip para EL_RADAR: el prompt debe ser compacto
    const marco = USE_LIGHTWEIGHT_MENCIONES ? null : await loadMarcoConceptual();
    const marcoSection = marco
      ? `\n\n## MARCO CONCEPTUAL DECODEX (principios epistemológicos — obligatorio respetar):\n${formatMarcoForPrompt(marco)}\n`
      : '';
    const systemPrompt = (config.systemPrompt + marcoSection).trim();
    console.log(`[generate-generic] ${tipo}: systemPrompt=${systemPrompt.length}chars (base=${config.systemPrompt.length}, marco=${marcoSection.length})`);
    if (marco) {
      console.log(`[generate-generic] Marco Conceptual inyectado para ${tipo}.`);
    } else if (!USE_LIGHTWEIGHT_MENCIONES) {
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
