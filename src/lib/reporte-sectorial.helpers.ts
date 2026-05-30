/**
 * reporte-sectorial.helpers.ts — DECODEX Bolivia
 * Funciones auxiliares de fecha y constantes de configuración
 * para la generación del Reporte Sectorial Minero.
 */

// ─── Constantes ───────────────────────────────────────────────────────────────

/** Los 8 ejes temáticos mineros del cliente */
export const EJES_MINEROS = [
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
export const FACTORES_EXTERNOS_KEYWORDS = [
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

import { boliviaStartOfWeek, boliviaNow as _boliviaNow } from '@/lib/date-bolivia';

/** Offset de Bolivia en horas (UTC-4) */
export const BOLIVIA_OFFSET_HOURS = -4;

// ─── Helpers de fecha ─────────────────────────────────────────────────────────

/**
 * Obtiene la fecha/hora actual en zona horaria de Bolivia (UTC-4).
 * Delegated to the centralized date-bolivia utility.
 */
export function getNowBolivia(): Date {
  return _boliviaNow();
}

/**
 * Obtiene el lunes anterior (00:00 America/La_Paz).
 * Si hoy es lunes, retorna el lunes de la semana pasada.
 */
export function getPreviousMonday(_now?: Date): Date {
  const lunesActual = boliviaStartOfWeek();
  return new Date(lunesActual.getTime() - 7 * 24 * 60 * 60 * 1000);
}

/**
 * Obtiene el lunes actual (09:30 America/La_Paz).
 * Si hoy es lunes, retorna hoy a las 09:30.
 */
export function getCurrentMonday(_now?: Date): Date {
  const lunes = boliviaStartOfWeek();
  return new Date(lunes.getTime() + 9 * 60 * 60 * 1000 + 30 * 60 * 1000);
}

/** Formatea una fecha para label legible en español (dd de mes de yyyy) */
export function formatDateLabel(date: Date): string {
  const meses = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  ];
  return `${date.getDate()} de ${meses[date.getMonth()]} de ${date.getFullYear()}`;
}

/** Obtiene la semana ISO 8601 del año */
export function getSemanaAnho(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}

/** Formatea tratamiento para lectura: tratamiento_informativo → "Informativo" */
export function formatTratamiento(trat: string): string {
  if (!trat || trat === 'sin_tratamiento') return 'Sin clasificar';
  return trat
    .replace('tratamiento_', '')
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
