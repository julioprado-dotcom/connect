/**
 * reporte-sectorial.ts — DECODEX Bolivia
 * Servicio principal de generación del Reporte Sectorial Minero.
 *
 * Flujo:
 * 1. Calcular ventana semanal (Lunes 00:00 → Lunes 09:30 America/La_Paz)
 * 2. Obtener menciones mineras vinculadas a ejes temáticos del cliente
 * 3. Agregar por eje, actor, medio
 * 4. Obtener precios de metales (Yahoo Finance)
 * 5. Calcular índice de exposición
 * 6. Comparar con semana anterior para tendencias
 * 7. Generar alertas sectoriales
 * 8. Detectar factores externos
 * 9. Cargar Marco Conceptual
 * 10. Generar narrativa LLM (resumen ejecutivo, hitos, factores externos)
 * 11. Generar HTML email
 * 12. Guardar en BD
 * 13. Retornar reporte
 */

import db from '@/lib/db';
import { obtenerPreciosMetales, type PrecioMetal } from '@/lib/yahoo-finance';
import {
  generarHtmlReporteMinero,
  type ContenidoReporteMinero,
} from '@/templates/reporte-minero-email';
import { generarTelegramReporteMinero } from '@/templates/reporte-minero-telegram';

// ─── Sub-módulos ─────────────────────────────────────────────────────────────

import {
  getNowBolivia,
  getPreviousMonday,
  getCurrentMonday,
  formatDateLabel,
  getSemanaAnho,
} from './reporte-sectorial.helpers';

import {
  findEjesMinerosIds,
  fetchMencionesMineras,
  aggregateByEje,
  getTopMedioForEje,
  aggregateActores,
  fetchFactoresExternos,
} from './reporte-sectorial.queries';

import { generateAlertas, loadMarcoConceptual } from './reporte-sectorial.alerts';

import { generateLLMNarrative } from './reporte-sectorial.narrative';

// ─── Re-exports for backward compatibility ─────────────────────────────────────

// Re-export all helpers
export {
  getNowBolivia,
  getPreviousMonday,
  getCurrentMonday,
  formatDateLabel,
  getSemanaAnho,
  EJES_MINEROS,
  FACTORES_EXTERNOS_KEYWORDS,
  BOLIVIA_OFFSET_HOURS,
  formatTratamiento,
} from './reporte-sectorial.helpers';

// Re-export all types and query functions
export {
  findEjesMinerosIds,
  fetchMencionesMineras,
  aggregateByEje,
  getTopMedioForEje,
  aggregateActores,
  fetchFactoresExternos,
} from './reporte-sectorial.queries';
export type {
  EjeAgregado,
  ActorAgregado,
  FactorExterno,
  MencionWithRelations,
} from './reporte-sectorial.queries';

// Re-export alerts and marco conceptual
export {
  generateAlertas,
  loadMarcoConceptual,
  formatMarcoForPrompt,
} from './reporte-sectorial.alerts';
export type { AlertaSectorial, MarcoPrinciples } from './reporte-sectorial.alerts';

// Re-export narrative
export { generateLLMNarrative } from './reporte-sectorial.narrative';
export type { LLMNarrative } from './reporte-sectorial.narrative';

// ─── Función principal de generación ─────────────────────────────────────────

/**
 * generarReporteMinero
 *
 * Genera un reporte sectorial minero completo para el periodo dado.
 * Si no se proporcionan fechas, calcula la semana actual (lunes anterior → lunes actual).
 *
 * @param periodoInicio - Inicio del periodo (opcional, default: lunes anterior 00:00 Bolivia)
 * @param periodoFin - Fin del periodo (opcional, default: lunes actual 09:30 Bolivia)
 * @returns El reporte creado en la base de datos
 */
export async function generarReporteMinero(
  periodoInicio?: Date,
  periodoFin?: Date,
): Promise<Record<string, unknown>> {
  // ── 1. Calcular periodo ──────────────────────────────────────────────────
  const nowBolivia = getNowBolivia();
  const inicio = periodoInicio || getPreviousMonday(nowBolivia);
  const fin = periodoFin || getCurrentMonday(nowBolivia);

  const semana = getSemanaAnho(inicio);
  const periodoLabel = `Semana ${semana}: ${formatDateLabel(inicio)} al ${formatDateLabel(fin)}`;
  const titulo = `Reporte Sectorial Minero — Semana ${semana}`;

  console.log(
    `[reporte-sectorial] Generando reporte: ${titulo} (${inicio.toISOString()} → ${fin.toISOString()})`,
  );

  // ── Envolvente try/catch — marcar como fallido si algo falla ─────────────
  try {
    // ── 2. Obtener IDs de ejes temáticos mineros del cliente ──────────────
    const ejesMinerosMap = await findEjesMinerosIds();
    const ejesMinerosIds = new Set(ejesMinerosMap.values());

    console.log(
      `[reporte-sectorial] ${ejesMinerosIds.size} ejes mineros encontrados:`,
      Array.from(ejesMinerosMap.entries()).map(([k, v]) => `${k}→${v}`),
    );

    // ── 3. Obtener menciones mineras del periodo ──────────────────────────
    const menciones = await fetchMencionesMineras(inicio, fin, ejesMinerosIds);
    console.log(`[reporte-sectorial] ${menciones.length} menciones mineras encontradas.`);

    const mineroMencionIds = new Set(menciones.map((m) => m.id));

    // ── 4. Agregar por eje temático ───────────────────────────────────────
    const ejesAgregados = aggregateByEje(menciones, ejesMinerosMap);

    // Calcular medioTop para cada eje
    for (const eje of ejesAgregados) {
      eje.medioTop = getTopMedioForEje(menciones, eje.ejeClienteId);
    }

    // ── 5. Identificar actores principales ────────────────────────────────
    const actores = aggregateActores(menciones, 10);

    // ── 6. Contar medios distintos ────────────────────────────────────────
    const mediosDistintos = new Set(menciones.map((m) => m.medioId));

    // ── 7. Obtener precios de metales (nunca bloquea) ────────────────────
    let precios: PrecioMetal[] = [];
    try {
      precios = await obtenerPreciosMetales();
      console.log(
        `[reporte-sectorial] ${precios.length} precios de metales obtenidos.`,
      );
    } catch (err) {
      console.warn(
        '[reporte-sectorial] Yahoo Finance falló. Continuando sin precios.',
        err instanceof Error ? err.message : err,
      );
    }

    // ── 8. Calcular índice de exposición ─────────────────────────────────
    const indiceExposicion = Math.min(
      100,
      menciones.length * (1 + mediosDistintos.size * 0.1),
    );

    // ── 9. Obtener menciones de la semana anterior para comparación ──────
    const prevInicio = new Date(inicio);
    prevInicio.setDate(prevInicio.getDate() - 7);
    const prevFin = new Date(fin);
    prevFin.setDate(prevFin.getDate() - 7);

    const mencionesPrevias = await fetchMencionesMineras(
      prevInicio,
      prevFin,
      ejesMinerosIds,
    );
    console.log(
      `[reporte-sectorial] ${mencionesPrevias.length} menciones en semana anterior.`,
    );

    // Construir mapa de ejes previos
    const ejesPrevios = new Map<number, number>();
    for (const m of mencionesPrevias) {
      const previosEntries = Array.from(ejesMinerosMap.entries());
      const primerEje = m.mencion_cliente_eje.find((e) => {
        return previosEntries.some(([, id]) => id === e.ejeClienteId);
      });
      if (primerEje) {
        ejesPrevios.set(
          primerEje.ejeClienteId,
          (ejesPrevios.get(primerEje.ejeClienteId) || 0) + 1,
        );
      }
    }

    // Nombres de actores previos
    const actoresPrevios = new Set<string>();
    for (const m of mencionesPrevias) {
      if (m.Persona) actoresPrevios.add(m.Persona.nombre);
    }

    // Variación total
    const totalPrevio = mencionesPrevias.length;
    const variacionTotal =
      totalPrevio > 0
        ? Math.round(
            ((menciones.length - totalPrevio) / totalPrevio) * 100,
          )
        : menciones.length > 0
          ? 100
          : 0;

    // ── 10. Calcular tendencias por eje ──────────────────────────────────
    const ejesConTendencia = ejesAgregados.map((eje) => {
      const previo = ejesPrevios.get(eje.ejeClienteId) || 0;
      let tendencia: string;
      let variacion: number | null;

      if (previo === 0 && eje.mencionCount > 0) {
        tendencia = 'sube';
        variacion = 100; // nuevo eje = 100%
      } else if (eje.mencionCount === 0 && previo > 0) {
        tendencia = 'baja';
        variacion = -100;
      } else if (previo === 0 && eje.mencionCount === 0) {
        tendencia = 'estable';
        variacion = null;
      } else {
        const varNum = Math.round(
          ((eje.mencionCount - previo) / previo) * 100,
        );
        if (varNum > 10) {
          tendencia = 'sube';
        } else if (varNum < -10) {
          tendencia = 'baja';
        } else {
          tendencia = 'estable';
        }
        variacion = varNum;
      }

      return {
        ...eje,
        tendencia,
        variacion,
      };
    });

    // ── 11. Generar alertas sectoriales ──────────────────────────────────
    const alertas = generateAlertas(
      ejesAgregados,
      ejesPrevios,
      menciones.length,
      totalPrevio,
      actores,
      actoresPrevios,
    );

    // ── 12. Factores externos ────────────────────────────────────────────
    const factoresExternos = await fetchFactoresExternos(
      inicio,
      fin,
      mineroMencionIds,
    );
    console.log(
      `[reporte-sectorial] ${factoresExternos.length} factores externos detectados.`,
    );

    // ── 13. Cargar Marco Conceptual ──────────────────────────────────────
    const marco = await loadMarcoConceptual();
    if (marco) {
      console.log('[reporte-sectorial] Marco Conceptual cargado exitosamente.');
    }

    // ── 14. Generar narrativa LLM ────────────────────────────────────────
    console.log('[reporte-sectorial] Generando narrativa LLM...');
    const narrativa = await generateLLMNarrative(
      {
        ejes: ejesAgregados,
        actores,
        factoresExternos,
        precios,
        alertas,
        totalMenciones: menciones.length,
        totalMedios: mediosDistintos.size,
        periodoLabel,
        variacionTotal,
      },
      marco,
    );

    // ── 15. Construir datos estructurados (ContenidoReporteMinero) ───────
    const contenido: ContenidoReporteMinero = {
      resumenEjecutivo: narrativa.resumenEjecutivo,
      hitos: narrativa.hitos,
      coberturaPorEje: ejesConTendencia.map((e) => ({
        eje: e.ejeTematico,
        menciones: e.mencionCount,
        tratamientoTop: e.tratamientoTop,
        medioTop: e.medioTop,
        tendencia: e.tendencia,
        variacion: e.variacion,
      })),
      actores: actores.map((a) => ({
        nombre: a.nombre,
        menciones: a.menciones,
        tratamientoTop: a.tratamientoTop,
      })),
      factoresExternos: narrativa.factoresExternosNarrativa,
      precios,
      alertas,
      tendencia: {
        totalMenciones: menciones.length,
        variacionTotal,
        resumen: narrativa.tendenciaResumen,
      },
    };

    // ── 16. Generar HTML email y Telegram ──────────────────────────────────
    const contenidoHtml = generarHtmlReporteMinero(contenido, periodoLabel, {
      mencionCount: menciones.length,
      medioCount: mediosDistintos.size,
    });

    const telegramMensajes = generarTelegramReporteMinero(contenido, periodoLabel);

    // ── 17. Guardar en BD ────────────────────────────────────────────────
    console.log('[reporte-sectorial] Guardando reporte en base de datos...');

    const reporte = await db.reporteSectorial.create({
      data: {
        sector: 'minero',
        titulo,
        periodoInicio: inicio,
        periodoFin: fin,
        includeManana: true,
        resumenEjecutivo: narrativa.resumenEjecutivo,
        contenido: JSON.stringify({ ...contenido, telegramMensajes }),
        contenidoHtml,
        estado: 'generado',
        mencionCount: menciones.length,
        medioCount: mediosDistintos.size,
        indiceExposicion,
        generadoEn: new Date(),
        ejes: {
          create: ejesConTendencia.map((e) => ({
            ejeTematico: e.ejeTematico,
            mencionCount: e.mencionCount,
            tratamientoTop: e.tratamientoTop,
            medioTop: e.medioTop,
            tendencia: e.tendencia,
            variacion: e.variacion,
          })),
        },
      },
    });

    console.log(
      `[reporte-sectorial] ✅ Reporte generado exitosamente: ${reporte.id} (${menciones.length} menciones)`,
    );

    return reporte as unknown as Record<string, unknown>;
  } catch (err) {
    // ── MARCAR COMO FALLIDO ───────────────────────────────────────────────
    console.error(
      '[reporte-sectorial] ❌ Error generando reporte:',
      err instanceof Error ? err.message : err,
    );

    let reporteFallido: Record<string, unknown>;
    try {
      reporteFallido = (await db.reporteSectorial.create({
        data: {
          sector: 'minero',
          titulo,
          periodoInicio: inicio,
          periodoFin: fin,
          resumenEjecutivo: `Error al generar el reporte: ${err instanceof Error ? err.message : 'Error desconocido'}`,
          contenido: JSON.stringify({ error: true, mensaje: err instanceof Error ? err.message : 'Error desconocido' }),
          estado: 'fallido',
          generadoEn: new Date(),
        },
      })) as unknown as Record<string, unknown>;

      console.warn(
        `[reporte-sectorial] Reporte marcado como fallido: ${reporteFallido.id}`,
      );
    } catch (dbErr) {
      console.error(
        '[reporte-sectorial] Error crítico: no se pudo guardar el reporte fallido en BD.',
        dbErr instanceof Error ? dbErr.message : dbErr,
      );
      reporteFallido = {
        id: 'error',
        error: 'No se pudo guardar ni siquiera el reporte fallido.',
      };
    }

    return reporteFallido;
  }
}
