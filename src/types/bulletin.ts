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
  activo: boolean
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
