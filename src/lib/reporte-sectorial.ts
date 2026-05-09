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
import ZAI from 'z-ai-web-dev-sdk';
import { obtenerPreciosMetales, type PrecioMetal } from '@/lib/yahoo-finance';
import {
  generarHtmlReporteMinero,
  type ContenidoReporteMinero,
} from '@/templates/reporte-minero-email';
import { generarTelegramReporteMinero } from '@/templates/reporte-minero-telegram';

// ─── Constantes ───────────────────────────────────────────────────────────────

/** Los 8 ejes temáticos mineros del cliente */
const EJES_MINEROS = [
  'produccion_operacion',
  'comercializacion_mercados',
  'regulacion_politica_minera',
  'medio_ambiente_comunidades',
  'geopolitica_actores_internacionales',
  'economia_fiscalidad',
  'factores_externos',
  'minería_ilegal_informal',
] as const;

/** Keywords de factores externos (no mineros) que afectan al sector */
const FACTORES_EXTERNOS_KEYWORDS = [
  'bloqueo',
  'carretera',
  'dólar',
  'dólares',
  'divisa',
  'combustible',
  'gasolina',
  'diesel',
  'desabastecimiento',
  'huelga',
  'transporte',
  'frontera',
  'exportación',
  'importación',
  'cambio',
  'devaluación',
] as const;

/** Offset de Bolivia en horas (UTC-4) */
const BOLIVIA_OFFSET_HOURS = -4;

// ─── Tipos internos ───────────────────────────────────────────────────────────

interface EjeAgregado {
  ejeTematico: string;
  ejeClienteId: number;
  mencionCount: number;
  tratamientoTop: string;
  medioTop: string;
  tratamientoDist: Record<string, number>;
}

interface ActorAgregado {
  nombre: string;
  menciones: number;
  tratamientoTop: string;
  tratamientoDist: Record<string, number>;
}

interface FactorExterno {
  titulo: string;
  medio: string;
  fecha: string;
  keyword: string;
}

interface AlertaSectorial {
  nivel: string;
  mensaje: string;
  eje?: string;
}

// ─── Helpers de fecha ─────────────────────────────────────────────────────────

/**
 * Obtiene la fecha/hora actual en zona horaria de Bolivia (UTC-4).
 * No usa Intl para evitar dependencias de runtime, usa aritmética simple.
 */
function getNowBolivia(): Date {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60_000;
  return new Date(utc + BOLIVIA_OFFSET_HOURS * 60 * 60_000);
}

/**
 * Obtiene el lunes anterior (00:00 America/La_Paz).
 * Si hoy es lunes, retorna el lunes de la semana pasada.
 */
function getPreviousMonday(now: Date): Date {
  const d = new Date(now);
  const day = d.getDay(); // 0=dom, 1=lun, ...
  const diff = day === 0 ? 6 : day - 1; // días hasta el lunes más cercano
  d.setDate(d.getDate() - diff - 7); // lunes de la semana pasada
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Obtiene el lunes actual (09:30 America/La_Paz).
 * Si hoy es lunes, retorna hoy a las 09:30.
 */
function getCurrentMonday(now: Date): Date {
  const d = new Date(now);
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  d.setHours(9, 30, 0, 0);
  return d;
}

/** Formatea una fecha para label legible en español (dd de mes de yyyy) */
function formatDateLabel(date: Date): string {
  const meses = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  ];
  return `${date.getDate()} de ${meses[date.getMonth()]} de ${date.getFullYear()}`;
}

/** Obtiene la semana ISO 8601 del año */
function getSemanaAnho(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}

/** Formatea tratamiento para lectura: tratamiento_informativo → "Informativo" */
function formatTratamiento(trat: string): string {
  if (!trat || trat === 'sin_tratamiento') return 'Sin clasificar';
  return trat
    .replace('tratamiento_', '')
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// ─── Query: Ejes temáticos del cliente (IDs dinámicos) ────────────────────────

/**
 * Busca los EjeTematicoCliente activos cuyas keywords contengan
 * alguna keyword de ejes mineros. Retorna un mapa keyword → ejeClienteId.
 */
async function findEjesMinerosIds(): Promise<Map<string, number>> {
  const ejes = await db.ejeTematicoCliente.findMany({
    where: { activo: true },
    select: { id: true, keywords: true, nombre: true },
  });

  const result = new Map<string, number>();

  for (const eje of ejes) {
    let parsed: string[] = [];
    try {
      parsed = JSON.parse(eje.keywords);
    } catch {
      // Fallback: tratar como string separado por comas
      parsed = eje.keywords.split(',').map((s) => s.trim().toLowerCase());
    }

    for (const keyword of parsed) {
      const kw = keyword.toLowerCase();
      // Verificar si esta keyword coincide con algún eje minero
      for (const ejeMinero of EJES_MINEROS) {
        if (kw.includes(ejeMinero) || ejeMinero.includes(kw)) {
          result.set(ejeMinero, eje.id);
        }
      }
    }
  }

  // Si no se encontró coincidencia por keyword, intentar matchear por nombre
  if (result.size === 0) {
    for (const eje of ejes) {
      const nombre = eje.nombre.toLowerCase();
      for (const ejeMinero of EJES_MINEROS) {
        if (nombre.includes(ejeMinero.replace(/_/g, ' '))) {
          result.set(ejeMinero, eje.id);
        }
      }
    }
  }

  return result;
}

// ─── Query: Menciones mineras del periodo ─────────────────────────────────────

interface MencionWithRelations {
  id: string;
  titulo: string;
  texto: string;
  url: string;
  fechaPublicacion: Date | null;
  tratamientoPeriodistico: string | null;
  personaId: string | null;
  medioId: string;
  esDuplicado: boolean;
  medio: { id: string; nombre: string; tipo: string; nivel: string };
  persona: { id: string; nombre: string; partidoSigla: string; camara: string; departamento: string } | null;
  ejesCliente: { id: number; ejeClienteId: number; mencionId: string; ejeCliente: { id: number; nombre: string; keywords: string } }[];
}

async function fetchMencionesMineras(
  periodoInicio: Date,
  periodoFin: Date,
  ejesMinerosIds: Set<number>,
): Promise<MencionWithRelations[]> {
  if (ejesMinerosIds.size === 0) return [];

  return db.mencion.findMany({
    where: {
      fechaPublicacion: { gte: periodoInicio, lte: periodoFin },
      esDuplicado: false,
      ejesCliente: {
        some: {
          ejeClienteId: { in: Array.from(ejesMinerosIds) },
        },
      },
    },
    include: {
      medio: { select: { id: true, nombre: true, tipo: true, nivel: true } },
      persona: { select: { id: true, nombre: true, partidoSigla: true, camara: true, departamento: true } },
      ejesCliente: {
        include: { ejeCliente: { select: { id: true, nombre: true, keywords: true } } },
      },
    },
    orderBy: { fechaPublicacion: 'desc' },
  }) as Promise<MencionWithRelations[]>;
}

// ─── Agregaciones ─────────────────────────────────────────────────────────────

/**
 * Agrega menciones por eje temático del cliente.
 * Usa el primer ejeCliente vinculado para clasificar.
 */
function aggregateByEje(
  menciones: MencionWithRelations[],
  ejesMinerosMap: Map<string, number>,
): EjeAgregado[] {
  const mapa = new Map<number, EjeAgregado>();

  for (const m of menciones) {
    // Tomar el primer ejeCliente que sea minero
    const ejesMinerosEntries = Array.from(ejesMinerosMap.entries());
    const primerEje = m.ejesCliente.find((e) => {
      return ejesMinerosEntries.some(([, id]) => id === e.ejeClienteId);
    });

    if (!primerEje) continue;

    const ejeId = primerEje.ejeClienteId;
    const ejeNombre = primerEje.ejeCliente.nombre;

    if (!mapa.has(ejeId)) {
      mapa.set(ejeId, {
        ejeTematico: ejeNombre,
        ejeClienteId: ejeId,
        mencionCount: 0,
        tratamientoTop: '',
        medioTop: '',
        tratamientoDist: {},
      });
    }

    const agg = mapa.get(ejeId)!;
    agg.mencionCount++;

    // Tratamiento
    const trat = m.tratamientoPeriodistico || 'sin_tratamiento';
    agg.tratamientoDist[trat] = (agg.tratamientoDist[trat] || 0) + 1;

    // Medio top (el más frecuente se resolverá al final)
    agg.medioTop = m.medio.nombre; // se sobrescribirá con el top al final
  }

  // Calcular tratamientoTop por frecuencia para cada eje
  const resultado: EjeAgregado[] = [];
  for (const agg of Array.from(mapa.values())) {
    const sortedTratamientos = Object.entries(agg.tratamientoDist).sort(
      (a, b) => b[1] - a[1],
    );
    agg.tratamientoTop = formatTratamiento(sortedTratamientos[0]?.[0] || '');

    resultado.push(agg);
  }

  return resultado.sort((a, b) => b.mencionCount - a.mencionCount);
}

/**
 * Identifica el medio más mencionado para un eje dado.
 */
function getTopMedioForEje(
  menciones: MencionWithRelations[],
  ejeClienteId: number,
): string {
  const counts = new Map<string, number>();
  for (const m of menciones) {
    const isThisEje = m.ejesCliente.some((e) => e.ejeClienteId === ejeClienteId);
    if (isThisEje) {
      const name = m.medio.nombre;
      counts.set(name, (counts.get(name) || 0) + 1);
    }
  }

  let top = '—';
  let max = 0;
  for (const [name, count] of Array.from(counts.entries())) {
    if (count > max) {
      max = count;
      top = name;
    }
  }
  return top;
}

/**
 * Identifica los actores más mencionados en el periodo.
 */
function aggregateActores(
  menciones: MencionWithRelations[],
  limit: number = 10,
): ActorAgregado[] {
  const mapa = new Map<string, ActorAgregado>();

  for (const m of menciones) {
    if (!m.persona) continue;

    const key = m.persona.id;
    if (!mapa.has(key)) {
      mapa.set(key, {
        nombre: m.persona.nombre,
        menciones: 0,
        tratamientoTop: '',
        tratamientoDist: {},
      });
    }

    const agg = mapa.get(key)!;
    agg.menciones++;

    const trat = m.tratamientoPeriodistico || 'sin_tratamiento';
    agg.tratamientoDist[trat] = (agg.tratamientoDist[trat] || 0) + 1;
  }

  // Calcular tratamientoTop y ordenar
  const resultado: ActorAgregado[] = [];
  for (const agg of Array.from(mapa.values())) {
    const sorted = Object.entries(agg.tratamientoDist).sort((a, b) => b[1] - a[1]);
    agg.tratamientoTop = formatTratamiento(sorted[0]?.[0] || '');
    resultado.push(agg);
  }

  return resultado.sort((a, b) => b.menciones - a.menciones).slice(0, limit);
}

// ─── Factores externos ────────────────────────────────────────────────────────

/**
 * Busca menciones de la semana que contengan factores externos
 * (no mineros) que puedan afectar al sector.
 */
async function fetchFactoresExternos(
  periodoInicio: Date,
  periodoFin: Date,
  mineroMencionIds: Set<string>,
): Promise<FactorExterno[]> {
  // Obtener todas las menciones del periodo (no duplicadas)
  const todasMenciones = await db.mencion.findMany({
    where: {
      fechaPublicacion: { gte: periodoInicio, lte: periodoFin },
      esDuplicado: false,
    },
    select: {
      id: true,
      titulo: true,
      fechaPublicacion: true,
      medio: { select: { nombre: true } },
    },
    orderBy: { fechaPublicacion: 'desc' },
  });

  const factores: FactorExterno[] = [];

  for (const m of todasMenciones) {
    // Excluir menciones que ya están en ejes mineros
    if (mineroMencionIds.has(m.id)) continue;

    const tituloLower = m.titulo.toLowerCase();

    for (const keyword of FACTORES_EXTERNOS_KEYWORDS) {
      if (tituloLower.includes(keyword)) {
        factores.push({
          titulo: m.titulo,
          medio: m.medio.nombre,
          fecha: m.fechaPublicacion
            ? m.fechaPublicacion.toLocaleDateString('es-BO')
            : 'N/D',
          keyword,
        });
        break; // una mención puede aparecer solo una vez
      }
    }
  }

  return factores.slice(0, 20); // limitar a 20 factores
}

// ─── Alertas sectoriales ──────────────────────────────────────────────────────

function generateAlertas(
  ejes: EjeAgregado[],
  ejesPrevios: Map<number, number>,
  totalMenciones: number,
  totalMencionesPrevias: number,
  actores: ActorAgregado[],
  actoresPrevios: Set<string>,
): AlertaSectorial[] {
  const alertas: AlertaSectorial[] = [];

  // ── Por eje: crecimiento >50% ──
  for (const eje of ejes) {
    const previo = ejesPrevios.get(eje.ejeClienteId) || 0;
    if (previo > 0 && eje.mencionCount > 0) {
      const variacion = ((eje.mencionCount - previo) / previo) * 100;
      if (variacion > 50) {
        alertas.push({
          nivel: 'Alto',
          mensaje: `"${eje.ejeTematico}" creció ${Math.round(variacion)}% respecto a la semana anterior (${previo} → ${eje.mencionCount} menciones).`,
          eje: eje.ejeTematico,
        });
      }
    }

    // ── Tratamiento agresivo >30% en algún eje ──
    const agresivos =
      eje.tratamientoDist['tratamiento_agresivo'] || 0;
    if (agresivos / eje.mencionCount > 0.3) {
      alertas.push({
        nivel: 'Alto',
        mensaje: `El ${Math.round((agresivos / eje.mencionCount) * 100)}% de las menciones de "${eje.ejeTematico}" tienen tratamiento agresivo.`,
        eje: eje.ejeTematico,
      });
    }
  }

  // ── Cobertura total >30% ──
  if (totalMencionesPrevias > 0 && totalMenciones > 0) {
    const variacionTotal =
      ((totalMenciones - totalMencionesPrevias) / totalMencionesPrevias) * 100;
    if (variacionTotal > 30) {
      alertas.push({
        nivel: 'Medio',
        mensaje: `La cobertura total del sector minero aumentó ${Math.round(variacionTotal)}% respecto a la semana anterior.`,
      });
    }
  }

  // ── Nuevo actor con >5 menciones ──
  for (const actor of actores) {
    if (!actoresPrevios.has(actor.nombre) && actor.menciones > 5) {
      alertas.push({
        nivel: 'Medio',
        mensaje: `Nuevo actor relevante: ${actor.nombre} aparece con ${actor.menciones} menciones en esta semana.`,
      });
    }
  }

  // ── Tratamiento informativo predominante >60% ──
  // Calcular tratamiento global
  const tratGlobal: Record<string, number> = {};
  for (const eje of ejes) {
    for (const [trat, count] of Object.entries(eje.tratamientoDist)) {
      tratGlobal[trat] = (tratGlobal[trat] || 0) + count;
    }
  }
  const total = Object.values(tratGlobal).reduce((a, b) => a + b, 0);
  if (total > 0) {
    const informativos = tratGlobal['tratamiento_informativo'] || 0;
    if (informativos / total > 0.6) {
      alertas.push({
        nivel: 'Positivo',
        mensaje: `El ${Math.round((informativos / total) * 100)}% de la cobertura es de tratamiento informativo, lo cual indica una cobertura equilibrada y factual.`,
      });
    }
  }

  // ── Eje bajó significativamente ──
  for (const eje of ejes) {
    const previo = ejesPrevios.get(eje.ejeClienteId) || 0;
    if (previo > 0 && eje.mencionCount > 0) {
      const variacion = ((eje.mencionCount - previo) / previo) * 100;
      if (variacion < -30) {
        alertas.push({
          nivel: 'Positivo',
          mensaje: `La cobertura de "${eje.ejeTematico}" disminuyó ${Math.round(Math.abs(variacion))}% esta semana (de ${previo} a ${eje.mencionCount} menciones).`,
          eje: eje.ejeTematico,
        });
      }
    }
  }

  return alertas;
}

// ─── Carga del Marco Conceptual ───────────────────────────────────────────────

interface MarcoPrinciples {
  principios: unknown;
  contextoInstitucional: unknown;
  lineasEditoriales: unknown;
  terminologiaPermitida: unknown;
  terminologiaProhibida: unknown;
}

async function loadMarcoConceptual(): Promise<MarcoPrinciples | null> {
  try {
    const marco = await db.marcoConceptual.findFirst({ where: { activa: true } });
    if (!marco) return null;

    return {
      principios: marco.principios,
      contextoInstitucional: marco.contextoInstitucional,
      lineasEditoriales: marco.lineasEditoriales,
      terminologiaPermitida: marco.terminologiaPermitida,
      terminologiaProhibida: marco.terminologiaProhibida,
    };
  } catch (err) {
    console.warn(
      '[reporte-sectorial] Error cargando Marco Conceptual:',
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/** Extrae los principios como texto plano para el prompt del LLM */
function formatMarcoForPrompt(marco: MarcoPrinciples): string {
  const parts: string[] = [];

  // Principios (Capa 1 — Inmutable)
  if (marco.principios) {
    parts.push('### Principios Fundantes (Capa 1 — Inmutable)');
    if (Array.isArray(marco.principios)) {
      marco.principios.forEach((p, i) => {
        if (typeof p === 'string') parts.push(`${i + 1}. ${p}`);
        else if (typeof p === 'object' && p !== null) {
          const obj = p as Record<string, unknown>;
          const title = obj.nombre || obj.titulo || `Principio ${i + 1}`;
          const desc = obj.descripcion || obj.definicion || '';
          parts.push(`${i + 1}. ${String(title)}${desc ? `: ${String(desc)}` : ''}`);
        }
      });
    } else if (typeof marco.principios === 'object') {
      parts.push(JSON.stringify(marco.principios, null, 2));
    }
  }

  // Contexto institucional
  if (marco.contextoInstitucional) {
    parts.push('\n### Contexto Institucional');
    parts.push(String(marco.contextoInstitucional));
  }

  // Líneas editoriales
  if (marco.lineasEditoriales) {
    parts.push('\n### Líneas Editoriales');
    parts.push(String(marco.lineasEditoriales));
  }

  // Terminología permitida
  if (marco.terminologiaPermitida) {
    parts.push('\n### Terminología Permitida');
    if (Array.isArray(marco.terminologiaPermitida)) {
      parts.push(marco.terminologiaPermitida.join(', '));
    } else {
      parts.push(String(marco.terminologiaPermitida));
    }
  }

  // Terminología prohibida
  if (marco.terminologiaProhibida) {
    parts.push('\n### Terminología Prohibida (NO usar en la narrativa)');
    if (Array.isArray(marco.terminologiaProhibida)) {
      parts.push(marco.terminologiaProhibida.join(', '));
    } else if (typeof marco.terminologiaProhibida === 'object') {
      const obj = marco.terminologiaProhibida as Record<string, unknown>;
      const terms = Array.isArray(obj.terminos) ? obj.terminos : [];
      parts.push(terms.map(String).join(', '));
    } else {
      parts.push(String(marco.terminologiaProhibida));
    }
  }

  return parts.join('\n');
}

// ─── Generación de narrativa LLM ──────────────────────────────────────────────

interface LLMNarrative {
  resumenEjecutivo: string;
  hitos: Array<{ titulo: string; detalle: string; tipo: string }>;
  factoresExternosNarrativa: string;
  tendenciaResumen: string;
}

async function generateLLMNarrative(
  datosEstructurados: {
    ejes: EjeAgregado[];
    actores: ActorAgregado[];
    factoresExternos: FactorExterno[];
    precios: PrecioMetal[];
    alertas: AlertaSectorial[];
    totalMenciones: number;
    totalMedios: number;
    periodoLabel: string;
    variacionTotal: number;
  },
  marco: MarcoPrinciples | null,
): Promise<LLMNarrative> {
  const defaultNarrative: LLMNarrative = {
    resumenEjecutivo:
      'No se pudo generar el resumen ejecutivo mediante inteligencia artificial.',
    hitos: [],
    factoresExternosNarrativa:
      datosEstructurados.factoresExternos.length > 0
        ? `Se detectaron ${datosEstructurados.factoresExternos.length} factores externos que podrían afectar al sector minero.`
        : 'No se detectaron factores externos significativos en este periodo.',
    tendenciaResumen: `La cobertura total del sector fue de ${datosEstructurados.totalMenciones} menciones en ${datosEstructurados.totalMedios} medios.`,
  };

  try {
    // ── Construir datos para el prompt ──
    const ejesText = datosEstructurados.ejes
      .map(
        (e) =>
          `- ${e.ejeTematico}: ${e.mencionCount} menciones, tratamiento predominante: ${e.tratamientoTop}, medio más activo: ${e.medioTop}`,
      )
      .join('\n');

    const actoresText = datosEstructurados.actores
      .map((a) => `- ${a.nombre}: ${a.menciones} menciones, tratamiento: ${a.tratamientoTop}`)
      .join('\n');

    const factoresText = datosEstructurados.factoresExternos
      .map((f) => `- "${f.titulo}" (${f.medio}, ${f.fecha}) — keyword: ${f.keyword}`)
      .join('\n');

    const preciosText =
      datosEstructurados.precios.length > 0
        ? datosEstructurados.precios
            .map(
              (p) =>
                `- ${p.metal}: ${p.precioActual.toFixed(2)} ${p.moneda} (var. semanal: ${p.variacionSemanal > 0 ? '+' : ''}${p.variacionSemanal.toFixed(2)}%)`,
            )
            .join('\n')
        : 'Datos no disponibles para este periodo.';

    const alertasText = datosEstructurados.alertas
      .map((a) => `- [${a.nivel}] ${a.mensaje}${a.eje ? ` (Eje: ${a.eje})` : ''}`)
      .join('\n');

    const marcoSection = marco
      ? `\n\n## MARCO CONCEPTUAL DEL SISTEMA (respetar estos principios en la narrativa):\n${formatMarcoForPrompt(marco)}\n`
      : '';

    const userPrompt = `## DATOS DEL REPORTE SECTORIAL MINERO
Periodo: ${datosEstructurados.periodoLabel}
Total menciones: ${datosEstructurados.totalMenciones}
Total medios: ${datosEstructurados.totalMedios}
Variación vs semana anterior: ${datosEstructurados.variacionTotal > 0 ? '+' : ''}${datosEstructurados.variacionTotal}%

### Cobertura por Eje Temático
${ejesText || 'Sin datos'}

### Actores Más Mencionados
${actoresText || 'Sin datos'}

### Precios Internacionales de Metales
${preciosText}

### Factores Externos Detectados
${factoresText || 'Ninguno detectado en este periodo.'}

### Alertas Sectoriales
${alertasText || 'Sin alertas para este periodo.'}

---
INSTRUCCIONES:
1. Escribe un RESUMEN EJECUTIVO de máximo 3 párrafos que capture la situación general del sector minero.
2. Identifica hasta 5 HITOS RELEVANTES de la semana (eventos, declaraciones, decisiones regulatorias, etc.).
3. Narra los FACTORES EXTERNOS en un párrafo breve.
4. Escribe un RESUMEN DE TENDENCIA comparando con la semana anterior.
5. NO INVENTES DATOS. Usa únicamente la información proporcionada arriba.
6. Usa un tono periodístico profesional, objetivo y analítico.
7. Responde ÚNICAMENTE con un JSON válido (sin markdown, sin backticks) con esta estructura exacta:
{
  "resumenEjecutivo": "...",
  "hitos": [{"titulo": "...", "detalle": "...", "tipo": "operativo|regulatorio|conflicto|negocio|otro"}],
  "factoresExternosNarrativa": "...",
  "tendenciaResumen": "..."
}`;

    const systemPrompt = `Eres un analista de información con formación periodística, especializado en el sector minero boliviano. Tu función es generar narrativas de reportes sectoriales basadas EXCLUSIVAMENTE en los datos proporcionados.

REGLAS ESTRICTAS:
- NUNCA inventes datos, cifras, nombres de personas ni eventos que no estén explícitamente mencionados en los datos.
- Mantén un tono profesional, objetivo y analítico.
- Usa terminología precisa del sector minero boliviano.
- Si un dato no está disponible, indícalo claramente.
- Estructura la información de forma clara y concisa.
- Los hitos deben ser eventos concretos, no generalidades.${marcoSection}`;

    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      signal: AbortSignal.timeout(60_000),
    });

    const raw = (completion?.choices?.[0]?.message?.content || '').trim();
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('[reporte-sectorial] LLM no retornó JSON válido. Usando narrativa por defecto.');
      return defaultNarrative;
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validar estructura
    return {
      resumenEjecutivo: typeof parsed.resumenEjecutivo === 'string'
        ? parsed.resumenEjecutivo
        : defaultNarrative.resumenEjecutivo,
      hitos: Array.isArray(parsed.hitos)
        ? parsed.hitos
            .filter(
              (h: Record<string, unknown>) =>
                typeof h.titulo === 'string' &&
                typeof h.detalle === 'string',
            )
            .map((h: Record<string, unknown>) => ({
              titulo: String(h.titulo),
              detalle: String(h.detalle),
              tipo: typeof h.tipo === 'string' ? String(h.tipo) : 'otro',
            }))
            .slice(0, 5)
        : [],
      factoresExternosNarrativa: typeof parsed.factoresExternosNarrativa === 'string'
        ? parsed.factoresExternosNarrativa
        : defaultNarrative.factoresExternosNarrativa,
      tendenciaResumen: typeof parsed.tendenciaResumen === 'string'
        ? parsed.tendenciaResumen
        : defaultNarrative.tendenciaResumen,
    };
  } catch (err) {
    console.error(
      '[reporte-sectorial] Error generando narrativa LLM:',
      err instanceof Error ? err.message : err,
    );
    return defaultNarrative;
  }
}

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
      const primerEje = m.ejesCliente.find((e) => {
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
      if (m.persona) actoresPrevios.add(m.persona.nombre);
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
