/**
 * reporte-sectorial.queries.ts — DECODEX Bolivia
 * Consultas a base de datos y funciones de agregación
 * para la generación del Reporte Sectorial Minero.
 */

import db from '@/lib/db';
import { EJES_MINEROS, FACTORES_EXTERNOS_KEYWORDS, formatTratamiento } from './reporte-sectorial.helpers';

// ─── Tipos internos ───────────────────────────────────────────────────────────

export interface EjeAgregado {
  ejeTematico: string;
  ejeClienteId: number;
  mencionCount: number;
  tratamientoTop: string;
  medioTop: string;
  tratamientoDist: Record<string, number>;
}

export interface ActorAgregado {
  nombre: string;
  menciones: number;
  tratamientoTop: string;
  tratamientoDist: Record<string, number>;
}

export interface FactorExterno {
  titulo: string;
  medio: string;
  fecha: string;
  keyword: string;
}

export interface MencionWithRelations {
  id: string;
  titulo: string;
  texto: string;
  url: string;
  fechaPublicacion: Date | null;
  tratamientoPeriodistico: string | null;
  personaId: string | null;
  medioId: string;
  esDuplicado: boolean;
  Medio: { id: string; nombre: string; tipo: string; nivel: string };
  Persona: { id: string; nombre: string; partidoSigla: string; camara: string; departamento: string } | null;
  mencion_cliente_eje: { id: number; ejeClienteId: number; mencionId: string; eje_tematico_cliente: { id: number; nombre: string; keywords: string } }[];
}

// ─── Query: Ejes temáticos del cliente (IDs dinámicos) ────────────────────────

/**
 * Busca los EjeTematicoCliente activos cuyas keywords contengan
 * alguna keyword de ejes mineros. Retorna un mapa keyword → ejeClienteId.
 */
export async function findEjesMinerosIds(): Promise<Map<string, number>> {
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

export async function fetchMencionesMineras(
  periodoInicio: Date,
  periodoFin: Date,
  ejesMinerosIds: Set<number>,
): Promise<MencionWithRelations[]> {
  if (ejesMinerosIds.size === 0) return [];

  return db.mencion.findMany({
    where: {
      fechaPublicacion: { gte: periodoInicio, lte: periodoFin },
      esDuplicado: false,
      mencion_cliente_eje: {
        some: {
          ejeClienteId: { in: Array.from(ejesMinerosIds) },
        },
      },
    },
    include: {
      Medio: { select: { id: true, nombre: true, tipo: true, nivel: true } },
      Persona: { select: { id: true, nombre: true, partidoSigla: true, camara: true, departamento: true } },
      mencion_cliente_eje: {
        include: { eje_tematico_cliente: { select: { id: true, nombre: true, keywords: true } } },
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
export function aggregateByEje(
  menciones: MencionWithRelations[],
  ejesMinerosMap: Map<string, number>,
): EjeAgregado[] {
  const mapa = new Map<number, EjeAgregado>();

  for (const m of menciones) {
    // Tomar el primer ejeCliente que sea minero
    const ejesMinerosEntries = Array.from(ejesMinerosMap.entries());
    const primerEje = m.mencion_cliente_eje.find((e) => {
      return ejesMinerosEntries.some(([, id]) => id === e.ejeClienteId);
    });

    if (!primerEje) continue;

    const ejeId = primerEje.ejeClienteId;
    const ejeNombre = primerEje.eje_tematico_cliente.nombre;

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
    agg.medioTop = m.Medio.nombre; // se sobrescribirá con el top al final
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
export function getTopMedioForEje(
  menciones: MencionWithRelations[],
  ejeClienteId: number,
): string {
  const counts = new Map<string, number>();
  for (const m of menciones) {
    const isThisEje = m.mencion_cliente_eje.some((e) => e.ejeClienteId === ejeClienteId);
    if (isThisEje) {
      const name = m.Medio.nombre;
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
export function aggregateActores(
  menciones: MencionWithRelations[],
  limit: number = 10,
): ActorAgregado[] {
  const mapa = new Map<string, ActorAgregado>();

  for (const m of menciones) {
    if (!m.Persona) continue;

    const key = m.Persona.id;
    if (!mapa.has(key)) {
      mapa.set(key, {
        nombre: m.Persona.nombre,
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
export async function fetchFactoresExternos(
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
      Medio: { select: { nombre: true } },
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
          medio: m.Medio.nombre,
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
