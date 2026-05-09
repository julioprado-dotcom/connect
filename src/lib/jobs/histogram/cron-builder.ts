// Constructor de expresiones cron - DECODEX Bolivia
// Traduce horarios calculados a expresiones node-cron

import type { Histograma, HorariosConfig } from '../types'
import { HORARIOS_CONFIG_DEFAULT, BOLETINES_SCHEDULE } from '../constants'

// Horario con informacion adicional para programacion
export interface CronEntry {
  horario: number       // hora del dia (0-23)
  diaSemana?: number    // 0=domingo, 1=lunes, ... 6=sabado (null = todos los dias)
  expresion: string     // expresion cron
  tipo: string          // 'check_fuente', 'generar_boletin', etc.
  prioridad: number     // prioridad del job a encolar
}

// Convertir horarios a expresiones cron (todos los dias)
export function horariosToCron(horas: number[]): string[] {
  return horas
    .filter(h => h >= 0 && h <= 23)
    .map(h => `0 ${h} * * *`) // minuto 0, hora H, todos los dias
}

// Convertir horarios a entradas de programacion con metadatos
export function buildCronEntries(
  horas: number[],
  tipo: string,
  prioridad: number = 5,
  diaSemana?: number,
): CronEntry[] {
  return horas
    .filter(h => h >= 0 && h <= 23)
    .map(h => ({
      horario: h,
      diaSemana,
      expresion: diaSemana !== undefined
        ? `0 ${h} * * ${diaSemana}`
        : `0 ${h} * * *`,
      tipo,
      prioridad,
    }))
}

// Generar expresiones cron para los boletines ONION200
export function getBoletinCronEntries(): CronEntry[] {
  return BOLETINES_SCHEDULE.map(b => ({
    horario: b.hora,
    expresion: `${b.minuto} ${b.hora} * * 1-5`, // lunes a viernes
    tipo: 'generar_boletin',
    prioridad: b.prioridad,
  }))
}

// Generar expresion cron para el job de mantenimiento (diario a las 4 AM)
export function getMantenimientoCronEntry(): CronEntry {
  return {
    horario: 4,
    expresion: '0 4 * * *',
    tipo: 'mantenimiento',
    prioridad: 9,
  }
}

// Determinar el dia de la semana con mas actividad en el histograma
export function getDiaMasActivo(histograma: Histograma): number | null {
  // Nota: el histograma actual solo registra horas, no dias
  // Esta funcion es un placeholder para cuando se amplie el histograma
  // a registrar hora+dia de la semana
  return null
}

// Formatear una expresion cron para lectura humana
export function formatCronHuman(expression: string): string {
  // "0 7 * * *" -> "Todos los dias a las 07:00"
  // "0 10 * * 1" -> "Cada lunes a las 10:00"
  // "0 4 * * 1-5" -> "Lun-Vie a las 04:00"

  const parts = expression.split(' ')
  if (parts.length !== 5) return expression

  const [minuto, hora, diaMes, mes, diaSemana] = parts
  const diasSemana = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab']
  const horaFormateada = `${hora.padStart(2, '0')}:${minuto.padStart(2, '0')}`

  // Dia de la semana
  let diaStr = 'Todos los dias'
  if (diaSemana !== '*') {
    if (diaSemana.includes('-')) {
      const [start, end] = diaSemana.split('-').map(Number)
      diaStr = `${diasSemana[start]}-${diasSemana[end]}`
    } else {
      const diaNum = parseInt(diaSemana)
      if (!isNaN(diaNum) && diaNum >= 0 && diaNum <= 6) {
        diaStr = diasSemana[diaNum]
      }
    }
  }

  return `${diaStr} a las ${horaFormateada}`
}

// Agrupar entradas cron por hora (para visualizacion)
export function agruparPorHora(entries: CronEntry[]): Map<number, CronEntry[]> {
  const groups = new Map<number, CronEntry[]>()
  for (const entry of entries) {
    const existing = groups.get(entry.horario) || []
    existing.push(entry)
    groups.set(entry.horario, existing)
  }
  // Ordenar por hora
  return new Map([...groups.entries()].sort((a, b) => a[0] - b[0]))
}

// Calcular la proxima ejecucion de una expresion cron
export function getNextRun(expression: string): Date | null {
  // Implementacion basada en la proxima coincidencia
  // Para una precision completa se usaria la libreria cron, pero esto es suficiente
  // para mostrar estimaciones en el dashboard
  const parts = expression.split(' ')
  if (parts.length !== 5) return null

  const [minuto, hora, , , diaSemana] = parts
  const now = new Date()
  const next = new Date(now)

  // Saltar al proximo minuto objetivo
  const targetMin = parseInt(minuto) || 0
  const targetHour = parseInt(hora) || 0

  // Si ya paso la hora de hoy, ir a manana
  if (next.getHours() > targetHour || (next.getHours() === targetHour && next.getMinutes() >= targetMin)) {
    next.setDate(next.getDate() + 1)
  }

  next.setHours(targetHour, targetMin, 0, 0)

  // Verificar dia de la semana
  if (diaSemana !== '*') {
    if (diaSemana.includes('-')) {
      const [start, end] = diaSemana.split('-').map(Number)
      const currentDay = next.getDay()
      while (currentDay < start || currentDay > end) {
        next.setDate(next.getDate() + 1)
      }
    } else {
      const targetDay = parseInt(diaSemana)
      const currentDay = next.getDay()
      if (currentDay !== targetDay) {
        const diff = (targetDay - currentDay + 7) % 7
        next.setDate(next.getDate() + (diff || 7))
      }
    }
  }

  return next
}
