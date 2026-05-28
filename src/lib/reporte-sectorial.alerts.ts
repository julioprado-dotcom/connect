/**
 * reporte-sectorial.alerts.ts — DECODEX Bolivia
 * Generación de alertas sectoriales y carga del Marco Conceptual
 * para la generación del Reporte Sectorial Minero.
 */

import db from '@/lib/db';
import type { EjeAgregado, ActorAgregado } from './reporte-sectorial.queries';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface AlertaSectorial {
  nivel: string;
  mensaje: string;
  eje?: string;
}

export interface MarcoPrinciples {
  principios: unknown;
  contextoInstitucional: unknown;
  lineasEditoriales: unknown;
  terminologiaPermitida: unknown;
  terminologiaProhibida: unknown;
}

// ─── Alertas sectoriales ──────────────────────────────────────────────────────

export function generateAlertas(
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

export async function loadMarcoConceptual(): Promise<MarcoPrinciples | null> {
  try {
    const marco = await db.marco_conceptual.findFirst({ where: { activa: true } });
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
export function formatMarcoForPrompt(marco: MarcoPrinciples): string {
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
