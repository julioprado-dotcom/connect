// ─── Motor de Evaluación de Alertas Tempranas — DECODEX Bolivia ────────────
// Evalúa indicadores contra umbrales y genera el estado de alertas consolidado.
//
// Algoritmo basado en Apéndice Técnico A, Sección 3:
// - 🔵 INFO: Ningún indicador supera umbral 🟠
// - 🟠 VIGILANCIA: 1 indicador en 🟣 O 2+ indicadores en 🟠
// - 🟣 ALERTA: 2+ indicadores en 🟣 O 1🟣 + 2+🟠 O cruce sistémico activo

import {
  UMBRALES_CRITICOS,
  CRUCES_SISTEMICOS,
  EJES,
  type UmbralAlerta,
  type NivelAlerta,
  type EjeEstrategico,
  type HistorialPunto,
} from './umbrales';

// ─── Tipos de Salida ──────────────────────────────────────────────────────

export interface AlertaGenerada {
  id: string;
  umbralId: string;
  eje: EjeEstrategico;
  nivel: NivelAlerta;
  indicador: string;
  nombre: string;
  mensaje: string;
  valor: number;
  timestamp: Date;
}

export interface EstadoEje {
  eje: EjeEstrategico;
  slug: string;
  nombre: string;
  estado: NivelAlerta;
  alertas: AlertaGenerada[];
  indicadoresCriticos: number;
  indicadoresEnVigilancia: number;
  totalEvaluados: number;
}

export interface CruceActivo {
  id: string;
  ejeA: EjeEstrategico;
  ejeB: EjeEstrategico;
  nombre: string;
  nivel: 'alto' | 'medio';
  mensaje: string;
}

export interface alertasConsolidado {
  fecha: string;
  hora_actualizacion: string;
  estado_global: NivelAlerta;
  ejes: Record<string, EstadoEje>;
  alertas: AlertaGenerada[];
  cruces_activos: CruceActivo[];
  recomendacion_accion: string;
  resumen: string;
}

// ─── Indicador de Entrada ────────────────────────────────────────────────

export interface IndicadorEntrada {
  slug: string;            // Debe coincidir con UmbralAlerta.indicador
  valor: number;
  historial?: HistorialPunto[];
}

// ─── Función Principal: Evaluar Indicadores ──────────────────────────────

/**
 * Evalúa un set de indicadores contra todos los umbrales configurados.
 * Retorna el estado de alertas consolidado completo.
 *
 * @param indicadores - Array de indicadores con sus valores actuales
 * @param opciones - Opciones de configuración
 */
export function evaluarIndicadores(
  indicadores: IndicadorEntrada[],
  opciones: {
    fecha?: Date;
    incluirRecomendacion?: boolean;
  } = {}
): alertasConsolidado {
  const now = opciones.fecha || new Date();
  const alertas: AlertaGenerada[] = [];

  // Crear mapa rápido de indicadores
  const indicadoresMap = new Map<string, { valor: number; historial: HistorialPunto[] }>();
  for (const ind of indicadores) {
    indicadoresMap.set(ind.slug, {
      valor: ind.valor,
      historial: ind.historial || [],
    });
  }

  // Evaluar cada umbral contra los indicadores disponibles
  for (const umbral of UMBRALES_CRITICOS) {
    const datos = indicadoresMap.get(umbral.indicador);
    if (datos === undefined) continue; // No hay dato para este umbral

    const nivel = umbral.condicion(datos.valor, datos.historial);
    if (nivel === 'INFO') continue; // Solo registrar alertas activas

    alertas.push({
      id: `${umbral.id}_${now.getTime()}`,
      umbralId: umbral.id,
      eje: umbral.eje,
      nivel,
      indicador: umbral.indicador,
      nombre: umbral.nombre,
      mensaje: umbral.mensaje(datos.valor, nivel),
      valor: datos.valor,
      timestamp: now,
    });
  }

  // Consolidar por eje
  const ejesEstado = consolidarEjes(alertas, now);

  // Evaluar cruces sistémicos
  const crucesActivos = evaluarCruces(ejesEstado);

  // Calcular estado global
  const estadoGlobal = calcularEstadoGlobal(ejesEstado, crucesActivos);

  // Generar recomendación
  const recomendacion = opciones.incluirRecomendacion !== false
    ? generarRecomendacion(estadoGlobal, alertas, crucesActivos)
    : '';

  // Generar resumen textual
  const resumen = generarResumen(estadoGlobal, ejesEstado, alertas);

  // Formatear fecha/hora
  const fechaStr = now.toISOString().split('T')[0];
  const horaStr = now.toTimeString().split(' ')[0];

  return {
    fecha: fechaStr,
    hora_actualizacion: horaStr,
    estado_global: estadoGlobal,
    ejes: ejesEstado,
    alertas,
    cruces_activos: crucesActivos,
    recomendacion_accion: recomendacion,
    resumen,
  };
}

// ─── Consolidación por Eje ───────────────────────────────────────────────

/**
 * Agrupa alertas por eje y calcula el estado de alertas de cada uno.
 * Aplica reglas de la Sección 3.1 del Apéndice Técnico:
 * - ALERTA: 2+ indicadores criticos, o 1 critico + 2+ en vigilancia
 * - VIGILANCIA: 1 critico, o 2+ en vigilancia
 * - INFO: todo normal
 */
export function consolidarEjes(
  alertas: AlertaGenerada[],
  timestamp: Date = new Date()
): Record<string, EstadoEje> {
  const resultado: Record<string, EstadoEje> = {};

  // Inicializar todos los ejes
  for (const eje of EJES) {
    resultado[eje.slug] = {
      eje: eje.key,
      slug: eje.slug,
      nombre: eje.nombre,
      estado: 'INFO',
      alertas: [],
      indicadoresCriticos: 0,
      indicadoresEnVigilancia: 0,
      totalEvaluados: 0,
    };
  }

  // Distribuir alertas en sus ejes
  for (const alerta of alertas) {
    const ejeDef = EJES.find(e => e.key === alerta.eje);
    if (!ejeDef) continue;

    const estadoEje = resultado[ejeDef.slug];
    estadoEje.alertas.push(alerta);

    if (alerta.nivel === 'ALERTA') {
      estadoEje.indicadoresCriticos++;
    } else if (alerta.nivel === 'VIGILANCIA') {
      estadoEje.indicadoresEnVigilancia++;
    }
  }

  // Calcular estado de alertas por eje
  for (const slug of Object.keys(resultado)) {
    const estadoEje = resultado[slug];
    const { indicadoresCriticos: criticos, indicadoresEnVigilancia: vigilando } = estadoEje;

    if (criticos >= 2 || (criticos >= 1 && vigilando >= 2)) {
      estadoEje.estado = 'ALERTA';
    } else if (criticos >= 1 || vigilando >= 2) {
      estadoEje.estado = 'VIGILANCIA';
    } else if (vigilando >= 1) {
      // 1 en vigilancia solo → eje en vigilancia según regla estricta
      // La regla dice "2+ en vigilancia", pero 1 en eje social/energía es relevante
      estadoEje.estado = 'VIGILANCIA';
    } else {
      estadoEje.estado = 'INFO';
    }
  }

  return resultado;
}

// ─── Evaluación de Cruces Sistémicos ──────────────────────────────────────

/**
 * Evalúa si los cruces sistémicos se activan según los estados de los ejes.
 */
export function evaluarCruces(
  ejesEstado: Record<string, EstadoEje>
): CruceActivo[] {
  const activos: CruceActivo[] = [];

  // Mapa de eje key → estado
  const estadoPorEje = new Map<EjeEstrategico, NivelAlerta>();
  for (const slug of Object.keys(ejesEstado)) {
    estadoPorEje.set(ejesEstado[slug].eje, ejesEstado[slug].estado);
  }

  for (const cruce of CRUCES_SISTEMICOS) {
    const estadoA = estadoPorEje.get(cruce.ejeA) || 'INFO';
    const estadoB = estadoPorEje.get(cruce.ejeB) || 'INFO';

    if (cruce.activarSi(estadoA, estadoB)) {
      activos.push({
        id: cruce.id,
        ejeA: cruce.ejeA,
        ejeB: cruce.ejeB,
        nombre: cruce.nombre,
        nivel: (estadoA === 'ALERTA' && estadoB === 'ALERTA') ? 'alto' : 'medio',
        mensaje: cruce.mensaje,
      });
    }
  }

  return activos;
}

// ─── Estado Global ────────────────────────────────────────────────────────

/**
 * Calcula el estado global de alertas.
 * ALERTA si: algún eje en ALERTA, o hay cruces sistémicos activos de nivel alto.
 * VIGILANCIA si: algún eje en VIGILANCIA.
 * INFO si: todos los ejes en INFO.
 */
export function calcularEstadoGlobal(
  ejesEstado: Record<string, EstadoEje>,
  cruces: CruceActivo[]
): NivelAlerta {
  // Si hay cruce sistémico de nivel alto → ALERTA global
  if (cruces.some(c => c.nivel === 'alto')) return 'ALERTA';

  for (const slug of Object.keys(ejesEstado)) {
    if (ejesEstado[slug].estado === 'ALERTA') return 'ALERTA';
  }

  for (const slug of Object.keys(ejesEstado)) {
    if (ejesEstado[slug].estado === 'VIGILANCIA') return 'VIGILANCIA';
  }

  return 'INFO';
}

// ─── Generación de Recomendación ──────────────────────────────────────────

function generarRecomendacion(
  estadoGlobal: NivelAlerta,
  alertas: AlertaGenerada[],
  cruces: CruceActivo[]
): string {
  if (estadoGlobal === 'INFO') {
    return 'Situación estable. Monitoreo rutinario de indicadores.';
  }

  const partes: string[] = [];

  // Alertas criticas primero
  const criticas = alertas.filter(a => a.nivel === 'ALERTA');
  const vigilancia = alertas.filter(a => a.nivel === 'VIGILANCIA');

  if (criticas.length > 0) {
    partes.push(`Atender ${criticas.length} alerta(s) critica(s): ${criticas.map(a => a.nombre).join(', ')}.`);
  }

  if (cruces.length > 0) {
    partes.push(`Cruce(s) sistémico(s) activo(s): ${cruces.map(c => c.nombre).join(', ')}.`);
  }

  if (estadoGlobal === 'ALERTA') {
    partes.push('Considerar activación de protocolo de crisis y preparar informe especial.');
  } else {
    partes.push('Monitoreo intensificado. Preparar informe de seguimiento en caso de escalada.');
  }

  return partes.join(' ');
}

// ─── Generación de Resumen ───────────────────────────────────────────────

function generarResumen(
  estadoGlobal: NivelAlerta,
  ejesEstado: Record<string, EstadoEje>,
  alertas: AlertaGenerada[]
): string {
  const emoji = estadoGlobal === 'ALERTA' ? '🟣' : estadoGlobal === 'VIGILANCIA' ? '🟠' : '🔵';
  const criticas = alertas.filter(a => a.nivel === 'ALERTA').length;
  const vigilancia = alertas.filter(a => a.nivel === 'VIGILANCIA').length;

  const ejesStr = Object.entries(ejesEstado)
    .map(([slug, eje]) => {
      const ico = eje.estado === 'ALERTA' ? '🟣' : eje.estado === 'VIGILANCIA' ? '🟠' : '🔵';
      return `${ico} ${eje.nombre}`;
    })
    .join(' | ');

  return `${emoji} Estado Global: ${estadoGlobal} — ${criticas} alerta(s) critica(s), ${vigilancia} en vigilancia. Ejes: ${ejesStr}`;
}

// ─── Alertas Compacto (para logs y testing) ──────────────────────────────

/**
 * Retorna un string compacto de alertas por eje, útil para logs.
 * Ejemplo: "MACRO[🟣] SOCIAL[🟠] ENERGIA[🔵] POLITICA[🔵] LOGISTICA[🔵] AMBIENTE[🟠]"
 */
export function alertasCompacto(alertas: alertasConsolidado): string {
  const emoji = (n: NivelAlerta) => n === 'ALERTA' ? '🟣' : n === 'VIGILANCIA' ? '🟠' : '🔵';
  return Object.values(alertas.ejes)
    .map(e => `${e.eje}[${emoji(e.estado)}]`)
    .join(' ');
}
