/**
 * Tipos de boletines ONION200 — DECODEX Bolivia
 * Define la taxonomía completa de productos del ecosistema DECODEX.
 */

// ─── Tipos de Boletín ──────────────────────────────────────────────

export type TipoBoletin =
  | 'EL_TERMOMETRO'       // Boletín matutino 7:00 AM — abre el día
  | 'SALDO_DEL_DIA'       // Cierre de jornada 7:00 PM — cierra el día
  | 'EL_FOCO'             // Análisis profundo por eje temático — 9:00 AM
  | 'EL_ESPECIALIZADO'    // Análisis experto sectorial — premium mid
  | 'EL_RADAR'            // Boletín semanal gratuito — awareness
  | 'EL_INFORME_CERRADO'  // Análisis profundo semanal + prospectiva — premium
  | 'VOZ_Y_VOTO'          // Resumen legislativo semanal — gratuito
  | 'EL_HILO'             // Recuento narrativo semanal — gratuito
  | 'FICHA_LEGISLADOR'    // Ficha individual — a solicitud
  | 'FOCO_DE_LA_SEMANA'   // Radar temático semanal gratuito — awareness
  | 'ALERTA_TEMPRANA'     // Alertas en tiempo real por WhatsApp — premium alta

// ─── Categorías de Boletín ─────────────────────────────────────────

export type CategoriaBoletin = 'gratuito' | 'premium' | 'premium_mid' | 'premium_alta'

// ─── Frecuencias ──────────────────────────────────────────────────

export type FrecuenciaBoletin = 'diario_am' | 'diario_pm' | 'diario' | 'semanal' | 'mensual' | 'bajo_demanda' | 'tiempo_real'

// ─── Canal de Entrega ─────────────────────────────────────────────

export type CanalEntrega = 'whatsapp' | 'email' | 'web' | 'pdf'

// ─── Configuración de Producto ────────────────────────────────────

export type VentanaTipo =
  | 'nocturna'       // El Termómetro: ayer 19:00 → hoy 07:00
  | 'diurna'         // Saldo del Día: 07:00 → 19:00
  | 'dia_completo'   // El Foco: 00:00 → 23:59
  | 'semanal'        // El Radar: lunes 00:00 → domingo 23:59
  | 'quincenal'      // Informe Quincenal: 15 días
  | 'mensual'        // Informe Mensual: 30 días
  | 'estandar'       // Genérico: usa periodoDefault

export type FiltroTipo = 'fecha' | 'ejes' | 'actores' | 'medios'

export type PanelVariante =
  | 'termometro_saldo'   // Ventana + ejes checkboxes + indicador + menciones
  | 'foco'               // Fases: selección de eje → análisis profundo
  | 'radar'              // Radar semanal + KPIs + evolución diaria + ejes
  | 'informe_cerrado'    // [Futuro] Informe semanal con prospectiva
  | 'especializado'      // [Futuro] Análisis sectorial
  | 'ficha_legislador'   // [Futuro] Ficha individual por persona
  | 'alerta_temprana'    // [Futuro] Alertas en tiempo real
  | null                 // Genérico: sin preview, genera directamente

export interface GeneradorConfig {
  tipo: 'dedicado' | 'generico'
  ventana: VentanaTipo
  filtros: FiltroTipo[]
  requierePreview: boolean
  panelId: PanelVariante
  tieneFases?: boolean           // El Foco: fase 'seleccion' → 'analisis'
  descripcionVentana?: string    // Label legible para la ventana de tiempo
}

export interface ProductoConfig {
  tipo: TipoBoletin
  nombre: string
  nombreCorto: string
  descripcion: string
  categoria: CategoriaBoletin
  frecuencia: FrecuenciaBoletin
  horarioEnvio: string           // "07:00 AM", "07:00 PM", "09:00 AM", "08:00 AM lunes"
  longitudPaginas: number        // páginas estimadas
  longitudMinLectura: number     // minutos de lectura
  canales: CanalEntrega[]
  periodoDefault: number         // días por defecto para la generación
  palabrasObjetivo: number       // palabras objetivo para la IA
  temperatura: number            // 0.3 factual, 0.5 profundo, 0.6 narrativa
  activo: boolean
  generador: GeneradorConfig
  systemPrompt: string           // prompt de sistema para generación con IA
}

// ─── Indicador ────────────────────────────────────────────────────

export interface IndicadorConfig {
  id?: string
  nombre: string
  slug: string
  categoria: 'monetario' | 'minero' | 'climatico' | 'economico' | 'hidrocarburos' | 'social'
  fuente: string
  url: string
  periodicidad: 'diaria' | 'semanal' | 'mensual'
  unidad: string
  formatoNumero: number
  activo: boolean
  orden: number
  ejesTematicos: string[]        // slugs de ejes donde aplica
  tier: 1 | 2 | 3
  notas: string
}

// ─── Indicador Valor (para inyección en prompts) ──────────────────

export interface IndicadorContextual {
  nombre: string
  slug: string
  valor: string                  // formateado para el prompt
  valorRaw: number
  variacion?: string             // "+2.3% vs ayer"
  fechaDato: string              // "30 abril 2026"
  fresco: boolean                // true si el dato está vigente
}

// ─── Eje Temático (para filtrado) ────────────────────────────────

export interface EjeTematicoResumen {
  slug: string
  nombre: string
  totalMenciones: number
  mencionesClave: MencionResumen[]
  tendencia: 'ascendente' | 'descendente' | 'estable'
  indicadoresRelevantes: IndicadorContextual[]
}

// ─── Mención resumida (para boletines) ────────────────────────────

export interface MencionResumen {
  titulo: string
  medio: string
  nivelMedio: number
  url: string
  sentimiento: string
  temas: string[]
  fechaPublicacion?: string
}

// ─── Resultado de generación de boletín ───────────────────────────

export interface ResultadoGeneracion {
  tipo: TipoBoletin
  contenido: string
  resumen: string
  fechaInicio: string
  fechaFin: string
  totalMenciones: number
  indicadoresUsados: string[]
  generadoEn: number             // ms
  exito: boolean
  error?: string
}

// ─── Alias (usado por código del Equipo B) ─────────────────────────

export type TipoProducto = TipoBoletin

// ─── Mención Enriquecida (para generación de boletines) ───────────

export interface MencionEnriquecida {
  id: string
  titulo: string
  resumen: string | null
  medio: string | null
  persona: string | null
  fechaPublicacion: string
  sentimiento: string | null
  relevancia: number
  temas: string[]
  url?: string
}

// ─── Indicador Formateado (para inyección en prompts) ─────────────

export interface IndicadorFormateado {
  nombre: string
  valor: string
  tendencia: 'ascendente' | 'descendente' | 'estable'
  unidad?: string
}

// ─── Resultado de validación de calidad ───────────────────────────

export interface ValidationResult {
  valido: boolean
  puntuacion: number
  errores: string[]
  advertencias: string[]
  estadisticas: {
    palabras: number
    caracteres: number
    oraciones: number
  }
}

// ─── Resultado de generación con reintentos ───────────────────────

export interface GenerationResult {
  exito: boolean
  contenido?: string
  tokensUsados?: number
  modelo?: string
  temperatura?: number
  error?: string
  metadata?: Record<string, unknown>
}

// ─── Configuración de schedule para scheduler ─────────────────────

export interface ScheduleConfig {
  activo: boolean
  cron: string
  horarioBolivia: string
  diaSemana?: number[]
  descripcionVentana?: string
}
