// Utilidades de fecha/hora para zona horaria de Bolivia (America/La_Paz, UTC-4)
// Toda consulta que dependa de "hoy", "ayer", "esta semana" DEBE usar estas funciones.
// El VPS corre en UTC, así que new Date() + setHours(0,0,0,0) sería medianoche UTC = 20:00 Bolivia.

const BOLIVIA_OFFSET_MS = -4 * 60 * 60 * 1000; // UTC-4

/**
 * Obtiene la fecha/hora actual en Bolivia como Date object (en UTC).
 * Útil para comparaciones con campos DATETIME en la DB.
 */
export function boliviaNow(): Date {
  const now = new Date();
  // Convertir a timestamp de Bolivia, luego devolver como Date UTC
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utcMs + BOLIVIA_OFFSET_MS);
}

/**
 * Inicio del día en Bolivia (00:00 Bolivia) como Date UTC.
 * Ejemplo: si en Bolivia son las 14:30 del 30-May, devuelve 00:00 del 30-May en UTC.
 */
export function boliviaStartOfDay(): Date {
  const boNow = boliviaNow();
  return new Date(boNow.getFullYear(), boNow.getMonth(), boNow.getDate());
}

/**
 * Fin del día en Bolivia (23:59:59 Bolivia) como Date UTC.
 */
export function boliviaEndOfDay(): Date {
  const start = boliviaStartOfDay();
  return new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
}

/**
 * Inicio de "ayer" en Bolivia como Date UTC.
 */
export function boliviaStartOfYesterday(): Date {
  const start = boliviaStartOfDay();
  return new Date(start.getTime() - 24 * 60 * 60 * 1000);
}

/**
 * Inicio de hace N días en Bolivia como Date UTC.
 */
export function boliviaDaysAgo(days: number): Date {
  const start = boliviaStartOfDay();
  return new Date(start.getTime() - days * 24 * 60 * 60 * 1000);
}

/**
 * Inicio de la semana en Bolivia (lunes 00:00) como Date UTC.
 */
export function boliviaStartOfWeek(): Date {
  const boNow = boliviaNow();
  const day = boNow.getDay(); // 0=dom, 1=lun, ...
  const diffToMonday = day === 0 ? 6 : day - 1;
  const monday = new Date(boNow.getFullYear(), boNow.getMonth(), boNow.getDate() - diffToMonday);
  return new Date(monday.getFullYear(), monday.getMonth(), monday.getDate());
}

/**
 * Inicio del mes en Bolivia (1ro 00:00) como Date UTC.
 */
export function boliviaStartOfMonth(): Date {
  const boNow = boliviaNow();
  return new Date(boNow.getFullYear(), boNow.getMonth(), 1);
}

/**
 * Hora en Bolivia (0-23).
 */
export function boliviaHour(): number {
  return boliviaNow().getHours();
}

/**
 * Formato YYYY-MM-DD de la fecha actual en Bolivia.
 */
export function boliviaDateStr(): string {
  const bo = boliviaNow();
  return `${bo.getFullYear()}-${String(bo.getMonth() + 1).padStart(2, '0')}-${String(bo.getDate()).padStart(2, '0')}`;
}

/**
 * Convertir hora de Bolivia a hora UTC para cron expressions.
 * Si queremos que un job corra a las 7:00 Bolivia, en UTC es a las 11:00.
 */
export function boliviaHourToUTC(boHour: number): number {
  return (boHour + 4) % 24;
}

/**
 * Para SQL: devuelve la fecha YYYY-MM-DD de "hoy" en Bolivia.
 * Útil para consultas directas con sqlite3 o Prisma raw queries.
 */
export function boliviaSQLDate(): string {
  return boliviaDateStr();
}

/**
 * Formatear fecha en zona horaria de Bolivia (America/La_Paz, UTC-4)
 */
export function formatFechaBolivia(date: Date): string {
  const opciones: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/La_Paz',
  }
  return date.toLocaleDateString('es-BO', opciones)
}
