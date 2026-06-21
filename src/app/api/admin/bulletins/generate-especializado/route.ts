/**
 * DECODEX ONION200 — Endpoint Dedicado: EL ESPECIALIZADO
 * 
 * Características:
 * - Endpoint dedicado (tipo: 'dedicado') con lógica específica sectorial
 * - Rotación freemium: un sector diario rota automáticamente (gratuito)
 * - Clientes pagantes pueden solicitar sector específico
 * - Usa NotaEje (multi-eje con pesos) para clasificación más precisa
 * - Profundidad: 1500-2000 palabras con análisis sectorial verificado
 *
 * POST /api/admin/bulletins/generate-especializado
 * Body: { sector?, fechaInicio?, fechaFin?, temperatura?, clienteId?, freemium? }
 */

import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import ZAI from 'z-ai-web-dev-sdk';
import { PRODUCTOS, INDICADOR_PROTOCOL } from '@/constants/products';
import { getIndicadoresConStats, formatearIndicadoresConStatsPrompt } from '@/lib/indicadores/injector';
import { formatearMencionesPrompt, construirPrompt, registrarReporte, generarTituloProducto, getDedicatedResumen, formatFechaBolivia } from '@/lib/reportes-utils';
import { regenerateWithRetry } from '@/lib/quality/regeneration';
import { validateContent } from '@/lib/quality/validator';
import { guardedParse, RATE } from '@/lib/rate-guard';
import { safeError } from '@/lib/safe-error';
import { verifyProduct } from '@/lib/verification/verify-product';

// ─── Sectores disponibles para rotación freemium ────────────────────
// Estos sectores rotan diariamente. Cada día de la semana corresponde a uno.
// Sábado y Domingo: repite el sector más demandado de la semana.
const SECTORES_FREEMIUM = [
  { nombre: 'Hidrocarburos y Energía', slug: 'hidrocarburos-energia', pesoEjeMinimo: 0.6 },
  { nombre: 'Minería y Metales Estratégicos', slug: 'mineria', pesoEjeMinimo: 0.6 },
  { nombre: 'Economía y Política Económica', slug: 'economia', pesoEjeMinimo: 0.6 },
  { nombre: 'Gobierno e Instituciones', slug: 'gobierno-oposicion', pesoEjeMinimo: 0.6 },
  { nombre: 'Corrupción e Impunidad', slug: 'corrupcion-impunidad', pesoEjeMinimo: 0.6 },
  { nombre: 'Justicia y Derechos Humanos', slug: 'justicia-derechos', pesoEjeMinimo: 0.6 },
  { nombre: 'Medio Ambiente y Territorio', slug: 'medio-ambiente', pesoEjeMinimo: 0.6 },
];

/**
 * Obtener el sector freemium del día basado en rotación semanal.
 * Usa el día de la semana (0=Domingo, 1=Lunes, ...) para seleccionar.
 */
function getSectorFreemiumHoy(): { nombre: string; slug: string; pesoEjeMinimo: number } {
  const diaSemana = new Date().getDay(); // 0=Domingo
  // Mapear: Lunes=0, Martes=1, ..., Viernes=4, Sábado=5, Domingo=6
  const diaIndex = diaSemana === 0 ? 6 : diaSemana - 1;
  const index = diaIndex % SECTORES_FREEMIUM.length;
  return SECTORES_FREEMIUM[index];
}

/**
 * Obtener menciones para El Especializado usando NotaEje (multi-eje con pesos).
 * Filtra por sector/eje con peso mínimo configurable.
 */
async function getMencionesEspecializado(
  ejeSlug: string,
  pesoMinimo: number = 0.5,
  fechaInicio: Date,
  fechaFin: Date,
) {
  // Primero obtener el eje ID a partir del slug
  const eje = await db.ejeTematico.findFirst({
    where: { slug: ejeSlug, activo: true },
    select: { id: true, nombre: true },
  });

  if (!eje) {
    return { menciones: [], totalMenciones: 0, ejeNombre: ejeSlug };
  }

  // Usar NotaEje para obtener menciones con peso >= pesoMinimo
  // Consulta en 2 pasos para evitar problemas con include en Prisma SQLite
  const notaEjes = await db.notaEje.findMany({
    where: {
      ejeId: eje.id,
      peso: { gte: pesoMinimo },
    },
    orderBy: { peso: 'desc' },
  });

  // Extraer mencionIds unicos y ordenados por peso
  const mencionIds = [...new Set(notaEjes.map(ne => ne.mencionId))];
  const pesoMap = new Map(notaEjes.map(ne => [ne.mencionId, ne.peso]));

  if (mencionIds.length === 0) {
    return { menciones: [], totalMenciones: 0, ejeNombre: eje.nombre };
  }

  // Consultar menciones con sus relaciones
  const mencionesRaw = await db.mencion.findMany({
    where: {
      id: { in: mencionIds },
      fechaCaptura: { gte: fechaInicio, lte: fechaFin },
      esDuplicado: false,
      enlaceActivo: true,
    },
    include: {
      Persona: { select: { nombre: true, partidoSigla: true, camara: true, departamento: true } },
      Medio: { select: { nombre: true, categoria: true, credibilidad: true } },
    },
  });

  // Formatear menciones para el prompt, incluyendo peso del eje
  const menciones = mencionesRaw.map(m => ({
    id: m.id,
    titulo: m.titulo,
    texto: m.texto,
    textoCompleto: m.textoCompleto,
    tratamientoPeriodistico: m.tratamientoPeriodistico,
    intencionMedio: m.intencionMedio,
    sentimiento: m.tratamientoPeriodistico,
    fechaPublicacion: m.fechaPublicacion,
    fechaCaptura: m.fechaCaptura,
    url: m.url,
    persona: (m as any).Persona?.nombre ?? null,
    partido: (m as any).Persona?.partidoSigla ?? null,
    medio: (m as any).Medio?.nombre ?? null,
    pesoEje: pesoMap.get(m.id) ?? 0.5,
  }));

  // Deduplicar por URL (una nota puede tener múltiples NotaEje)
  const seen = new Set<string>();
  const deduped = menciones.filter(m => {
    if (!m.url || seen.has(m.url)) return false;
    seen.add(m.url);
    return true;
  });

  return {
    menciones: deduped,
    totalMenciones: deduped.length,
    ejeNombre: eje.nombre,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const {
      sector,
      fechaInicio: fechaInicioStr,
      fechaFin: fechaFinStr,
      temperatura: temperaturaOverride,
      clienteId,
      freemium: isFreemium = false,
    } = body;

    const config = PRODUCTOS.EL_ESPECIALIZADO;
    if (!config || !config.activo) {
      return NextResponse.json(
        { exito: false, error: 'EL_ESPECIALIZADO no está activo' },
        { status: 400 },
      );
    }

    // 1. Determinar sector: explícito, freemium (rotación), o error
    let sectorInfo: { nombre: string; slug: string; pesoEjeMinimo: number };
    
    if (isFreemium || !sector) {
      // Modo freemium: rotación diaria automática
      sectorInfo = getSectorFreemiumHoy();
      console.log(`[ESPECIALIZADO] Modo freemium — sector rotativo: ${sectorInfo.nombre} (${sectorInfo.slug})`);
    } else {
      // Modo pagado: sector solicitado específicamente
      const sectorFreemium = SECTORES_FREEMIUM.find(s => s.slug === sector || s.nombre.toLowerCase().includes(String(sector).toLowerCase()));
      sectorInfo = sectorFreemium || {
        nombre: String(sector),
        slug: String(sector),
        pesoEjeMinimo: 0.5,
      };
    }

    // 2. Calcular rango de fechas (por defecto: últimos 2 días para análisis sectorial)
    const now = new Date();
    const fechaInicio = fechaInicioStr ? new Date(fechaInicioStr) : new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    const fechaFin = fechaFinStr ? new Date(fechaFinStr) : now;

    // 3. Obtener menciones del sector usando NotaEje (multi-eje)
    const resultado = await getMencionesEspecializado(
      sectorInfo.slug,
      sectorInfo.pesoEjeMinimo,
      fechaInicio,
      fechaFin,
    );

    const SIN_MENCIONES = resultado.totalMenciones === 0;

    if (SIN_MENCIONES) {
      const titulo = `EL ESPECIALIZADO — ${sectorInfo.nombre} — ${formatFechaBolivia(now)}`;
      const reporteId = await registrarReporte({
        tipoProducto: 'EL_ESPECIALIZADO',
        titulo,
        contenido: `[SIN_DATOS] EL_ESPECIALIZADO — Sector: ${sectorInfo.nombre} — No se encontraron menciones con peso >= ${sectorInfo.pesoEjeMinimo} en el periodo ${formatFechaBolivia(fechaInicio)} — ${formatFechaBolivia(fechaFin)}.`,
        resumen: `Sin menciones para ${sectorInfo.nombre}. Verificar fuentes activas y batch_llm.`,
        fechaInicio,
        fechaFin,
        temperatura: 0,
        tokensUsados: 0,
        modeloIA: 'ninguno',
        metadata: JSON.stringify({
          dedicado: true,
          sector: sectorInfo.slug,
          sectorNombre: sectorInfo.nombre,
          freemium: isFreemium,
          pesoMinimo: sectorInfo.pesoEjeMinimo,
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
        resumen: `No se encontraron menciones para "${sectorInfo.nombre}" en el periodo consultado`,
        sinDatos: true,
        metadata: {
          tipo: 'EL_ESPECIALIZADO',
          sector: sectorInfo,
          freemium: isFreemium,
          totalMenciones: 0,
        },
      });
    }

    // 4. Obtener indicadores con estadísticas según protocolo del especializado
    const protocol = INDICADOR_PROTOCOL.EL_ESPECIALIZADO;
    const indicadoresStats = await getIndicadoresConStats(protocol);
    const indicadoresPrompt = formatearIndicadoresConStatsPrompt(indicadoresStats, `Indicadores ONION200 — ${sectorInfo.nombre}`, { formato: protocol.formato });

    // 5. Construir prompt sectorial
    const mencionesPrompt = formatearMencionesPrompt(resultado.menciones as any[]);
    const ventanaLabel = `${formatFechaBolivia(fechaInicio)} — ${formatFechaBolivia(fechaFin)}`;

    const datosExtra = [
      `Tipo de producto: El Especializado (Análisis Sectorial)`,
      `Sector: ${sectorInfo.nombre}`,
      `Periodo: ${ventanaLabel}`,
      `Total menciones: ${resultado.totalMenciones}`,
      `Umbral de peso eje: >= ${sectorInfo.pesoEjeMinimo}`,
      isFreemium ? `Modo: FREEMIUM (rotación diaria automática)` : `Modo: PAGADO (sector solicitado)`,
    ].join('\n');

    const userPrompt = construirPrompt(
      'EL_ESPECIALIZADO',
      mencionesPrompt,
      indicadoresPrompt,
      datosExtra,
    );

    // 6. Generar con IA
    const temperatura = temperaturaOverride ?? config.temperatura;
    const genResult = await regenerateWithRetry({
      systemPrompt: config.systemPrompt,
      userPrompt,
      tipo: 'EL_ESPECIALIZADO',
      initialTemperatura: temperatura,
      onRetry: (intento, error) => {
        console.warn(`[ESPECIALIZADO] Reintento ${intento} para ${sectorInfo.nombre}: ${error}`);
      },
    });

    if (!genResult.exito || !genResult.contenido) {
      return NextResponse.json(
        { exito: false, error: genResult.error ?? 'La IA no generó contenido válido' },
        { status: 500 },
      );
    }

    // 7. Verificación anti-alucinación
    const textoVerificado = await verifyProduct(
      genResult.contenido,
      resultado.menciones.map(m => ({
        texto: (m.texto as string) ?? '',
        titulo: (m.titulo as string) ?? '',
        medio: (m.medio as string) ?? '',
        persona: (m.persona as string) ?? null,
      })),
      'EL_ESPECIALIZADO',
    );

    // 8. Validación de calidad
    const validation = validateContent(textoVerificado.textoLimpio, { tipo: 'EL_ESPECIALIZADO' });

    // 9. Registrar reporte
    const titulo = generarTituloProducto('EL_ESPECIALIZADO', undefined, sectorInfo.slug);
    const resumen = await getDedicatedResumen('EL_ESPECIALIZADO', {
      menciones: resultado.menciones as any[],
      fecha: ventanaLabel,
      ejeSlug: sectorInfo.slug,
    });

    const reporteId = await registrarReporte({
      tipoProducto: 'EL_ESPECIALIZADO',
      titulo,
      contenido: textoVerificado.textoLimpio,
      resumen,
      fechaInicio,
      fechaFin,
      temperatura,
      tokensUsados: genResult.tokensUsados,
      modeloIA: genResult.modelo,
      metadata: JSON.stringify({
        dedicado: true,
        sector: sectorInfo.slug,
        sectorNombre: sectorInfo.nombre,
        freemium: isFreemium,
        pesoMinimo: sectorInfo.pesoEjeMinimo,
        totalMenciones: resultado.totalMenciones,
        calidad: {
          puntuacion: validation.puntuacion,
          valido: validation.valido,
          palabras: validation.estadisticas.palabras,
        },
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
        tipo: 'EL_ESPECIALIZADO',
        sector: sectorInfo,
        freemium: isFreemium,
        temperatura,
        tokensUsados: genResult.tokensUsados,
        modelo: genResult.modelo,
        totalMenciones: resultado.totalMenciones,
        calidad: {
          puntuacion: validation.puntuacion,
          valido: validation.valido,
          advertencias: validation.advertencias,
          palabras: validation.estadisticas.palabras,
        },
      },
    });
  } catch (error) {
    console.error('[ESPECIALIZADO] Error:', error);
    const { error: msg, code, details } = safeError(error);
    return NextResponse.json(
      { exito: false, error: msg, code, ...(details && { details }) },
      { status: 500 },
    );
  }
}
