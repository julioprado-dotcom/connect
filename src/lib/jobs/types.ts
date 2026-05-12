// Tipos del sistema de Job Queue - DECODEX Bolivia

// Job

export type JobEstado = 'pendiente' | 'en_progreso' | 'completado' | 'fallido' | 'cancelado'

export type JobTipo =
  | 'check_fuente'
  | 'check_indicador'
  | 'scrape_fuente'
  | 'capture_indicador'
  | 'generar_boletin'
  | 'enviar_entrega'
  | 'verificar_enlaces'
  | 'mantenimiento'
  | 'connectivity_test'

export type JobPrioridad = 0 | 1 | 3 | 5 | 7 | 9

export type JobPrioridadLabel = {
  nivel: string
  prioridad: JobPrioridad
  color: string
  descripcion: string
}

export interface JobPayload {
  [key: string]: unknown
}

export interface JobCreate {
  tipo: JobTipo
  prioridad?: JobPrioridad
  payload?: JobPayload
  maxIntentos?: number
  proximaEjecucion?: Date
  programa?: string
}

// Check-First

export type TipoCheck = 'rss' | 'head' | 'fingerprint' | 'api' | 'zai'

export interface CheckResult {
  cambiado: boolean
  tecnica: TipoCheck | string
  detalle: string
  datosNuevos?: Record<string, unknown> | unknown[]
  responseTime?: number
  error?: string
}

// Frecuencia

export type FrecuenciaKey = '15m' | '30m' | '1h' | '2h' | '4h' | '6h' | '12h' | '1d' | '1w'

export interface FrecuenciaConfig {
  key: FrecuenciaKey
  label: string
  minutos: number
  checksDia: number
}

export interface FrecuenciaOverride {
  activo: boolean
  frecuencia: FrecuenciaKey | string
  motivo: string
  contratoId?: string
  fechaInicio: string
  fechaFin: string
}

// Histograma

export type Histograma = Record<string, number>

export interface HorariosConfig {
  numChequeos: number
  separacionMinima: number
  ventanaInicio: number
  ventanaFin: number
}

// Fuente

export interface FuenteConEstado {
  medioId: string
  nombre: string
  url: string
  categoria: string
  nivel: string
  tipoCheck: TipoCheck
  frecuenciaBase: FrecuenciaKey | string
  frecuenciaActual: FrecuenciaKey | string
  horariosOptimos: number[]
  ultimoCheck: Date | null
  ultimoCambio: Date | null
  totalChecks: number
  totalCambios: number
  checksSinCambio: number
  responseTime: number
  activo: boolean
  error: string
  tieneOverride: boolean
}

// Stats

export interface QueueStats {
  pendientes: number
  enProgreso: number
  fallidos24h: number
  completados24h: number
  tiempoPromedioMs: number
}

export interface WorkerStats {
  uptime: string
  ultimoJob: Date | null
  jobsPorHora: number
  running: boolean
}

export interface CheckFirstStats {
  sinCambios24h: number
  conCambios24h: number
  tasaAhorro: number
}

export interface FuentesStats {
  activas: number
  conCambiosHoy: number
  degradadas: number
  conError: number
  topProductoras: { medio: string; cambios: number }[]
}

// Boletines (scheduler)

export interface BoletinSchedule {
  hora: number
  minuto: number
  tipo: string
  prioridad: JobPrioridad
}

// Worker

export interface RunnerResult {
  success: boolean
  data?: Record<string, unknown>
  error?: string
}

export type RunnerFn = (payload: JobPayload) => Promise<RunnerResult>

export interface RunnerEntry {
  tipo: JobTipo
  execute: RunnerFn
  label: string
}

// Mantenimiento

export type TareaMantenimiento =
  | 'recalcular_horarios'
  | 'degradar_fuentes'
  | 'limpiar_logs'
  | 'purge_menciones'
  | 'limpiar_jobs'
  | 'limpiar_homepage_html'
  | 'recalcular_scheduler'
  | 'backup_snapshot'
  | 'backup_archive'

export interface MantenimientoResult {
  tarea: TareaMantenimiento | string
  completada: boolean
  detalle: string
}
