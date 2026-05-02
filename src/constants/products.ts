/**
 * Definiciones de productos ONION200 — News Connect Bolivia
 * Catálogo completo de boletines con configuración estándar.
 */

import { type ProductoConfig, type TipoBoletin } from '@/types/bulletin'

// ─── Catálogo de Productos ────────────────────────────────────────

export const PRODUCTOS: Record<TipoBoletin, ProductoConfig> = {
  // ── Duo Diario Premium ──
  EL_TERMOMETRO: {
    tipo: 'EL_TERMOMETRO',
    nombre: 'El Termómetro',
    nombreCorto: 'Termómetro',
    descripcion: 'Boletín matutino que abre la jornada con indicador de clima mediático, alertas tempranas y lo que hay que observar.',
    categoria: 'premium',
    frecuencia: 'diario_am',
    horarioEnvio: '07:00 AM',
    longitudPaginas: 1,
    longitudMinLectura: 2,
    canales: ['whatsapp', 'email'],
    periodoDefault: 1,
    activo: true,
  },

  SALDO_DEL_DIA: {
    tipo: 'SALDO_DEL_DIA',
    nombre: 'El Saldo del Día',
    nombreCorto: 'Saldo',
    descripcion: 'Cierre de jornada: resumen de evolución en la jornada y balance de los ejes temáticos contratados al finalizar la jornada (7:00 PM).',
    categoria: 'premium',
    frecuencia: 'diario_pm',
    horarioEnvio: '07:00 PM',
    longitudPaginas: 1,
    longitudMinLectura: 2,
    canales: ['whatsapp', 'email'],
    periodoDefault: 1,
    activo: true,
  },

  // ── Productos Premium Especializados ──
  EL_FOCO: {
    tipo: 'EL_FOCO',
    nombre: 'El Foco',
    nombreCorto: 'Foco',
    descripcion: 'Análisis profundo diario de un eje temático específico. El cliente elige qué ejes monitorear (1, 3, 5 o los 11).',
    categoria: 'premium',
    frecuencia: 'diario_am',
    horarioEnvio: '09:00 AM',
    longitudPaginas: 2,
    longitudMinLectura: 5,
    canales: ['whatsapp', 'email', 'pdf'],
    periodoDefault: 1,
    activo: true,
  },

  EL_ESPECIALIZADO: {
    tipo: 'EL_ESPECIALIZADO',
    nombre: 'El Especializado',
    nombreCorto: 'Especializado',
    descripcion: 'Análisis experto sectorial con datos duros, contexto histórico y prospectiva. Para clientes institucionales que necesitan profundidad.',
    categoria: 'premium_mid',
    frecuencia: 'diario',
    horarioEnvio: '10:00 AM',
    longitudPaginas: 4,
    longitudMinLectura: 10,
    canales: ['email', 'pdf'],
    periodoDefault: 1,
    activo: false, // pendiente de implementación
  },

  EL_INFORME_CERRADO: {
    tipo: 'EL_INFORME_CERRADO',
    nombre: 'El Informe Cerrado',
    nombreCorto: 'Informe',
    descripcion: 'Análisis profundo semanal con prospectiva. Incluye tendencias, ranking de actores, y proyección a corto plazo.',
    categoria: 'premium',
    frecuencia: 'semanal',
    horarioEnvio: 'Lunes 10:00 AM',
    longitudPaginas: 6,
    longitudMinLectura: 15,
    canales: ['email', 'pdf'],
    periodoDefault: 7,
    activo: true,
  },

  // ── Productos Gratuitos (Awareness) ──
  EL_RADAR: {
    tipo: 'EL_RADAR',
    nombre: 'El Radar',
    nombreCorto: 'Radar',
    descripcion: 'Boletín semanal gratuito con radar de los 11 ejes temáticos. Para masa extensa: legisladores, periodistas, ONGs, academia.',
    categoria: 'gratuito',
    frecuencia: 'semanal',
    horarioEnvio: 'Lunes 08:00 AM',
    longitudPaginas: 1.5,
    longitudMinLectura: 3,
    canales: ['email', 'web'],
    periodoDefault: 7,
    activo: true,
  },

  VOZ_Y_VOTO: {
    tipo: 'VOZ_Y_VOTO',
    nombre: 'Voz y Voto',
    nombreCorto: 'Voz y Voto',
    descripcion: 'Resumen legislativo semanal gratuito. Actividad parlamentaria, votaciones clave, presencia mediática de legisladores.',
    categoria: 'gratuito',
    frecuencia: 'semanal',
    horarioEnvio: 'Lunes 08:00 AM',
    longitudPaginas: 1,
    longitudMinLectura: 2,
    canales: ['email', 'web'],
    periodoDefault: 7,
    activo: true,
  },

  EL_HILO: {
    tipo: 'EL_HILO',
    nombre: 'El Hilo',
    nombreCorto: 'El Hilo',
    descripcion: 'Recuento narrativo semanal gratuito. La historia de la semana contada como hilo conductor.',
    categoria: 'gratuito',
    frecuencia: 'semanal',
    horarioEnvio: 'Lunes 08:00 AM',
    longitudPaginas: 1,
    longitudMinLectura: 2,
    canales: ['email', 'web'],
    periodoDefault: 7,
    activo: true,
  },

  // ── Gratuitos (Awareness Temático) ──
  FOCO_DE_LA_SEMANA: {
    tipo: 'FOCO_DE_LA_SEMANA',
    nombre: 'Foco de la Semana',
    nombreCorto: 'Foco Semanal',
    descripcion: 'Radar temático semanal gratuito. Cada semana un eje diferente: qué pasó, quién dijo qué, qué sigue. Puerta de entrada a los productos temáticos premium.',
    categoria: 'gratuito',
    frecuencia: 'semanal',
    horarioEnvio: 'Lunes 08:00 AM',
    longitudPaginas: 0.5,
    longitudMinLectura: 2,
    canales: ['email', 'web'],
    periodoDefault: 7,
    activo: true,
  },

  // ── Alertas en tiempo real ──
  ALERTA_TEMPRANA: {
    tipo: 'ALERTA_TEMPRANA',
    nombre: 'Alerta Temprana',
    nombreCorto: 'Alerta',
    descripcion: 'Alertas en tiempo real por WhatsApp. Detección temprana de crisis, picos de sentimiento negativo y eventos relevantes. Solo para clientes premium.',
    categoria: 'premium_alta',
    frecuencia: 'tiempo_real',
    horarioEnvio: 'Inmediata',
    longitudPaginas: 0,
    longitudMinLectura: 1,
    canales: ['whatsapp'],
    periodoDefault: 30,
    activo: true,
  },

  // ── A solicitud ──
  FICHA_LEGISLADOR: {
    tipo: 'FICHA_LEGISLADOR',
    nombre: 'Ficha del Legislador',
    nombreCorto: 'Ficha',
    descripcion: 'Informe individual de presencia mediática de un legislador. A solicitud del propio legislador o su equipo.',
    categoria: 'premium',
    frecuencia: 'bajo_demanda',
    horarioEnvio: 'Bajo demanda',
    longitudPaginas: 1,
    longitudMinLectura: 2,
    canales: ['email', 'pdf'],
    periodoDefault: 30,
    activo: true,
  },
}

// ─── Combos de Productos ──────────────────────────────────────────

export interface ProductoCombo {
  id: string
  nombre: string
  productos: TipoBoletin[]
  precioMensual: number         // en Bs
  descripcion: string
}

export const COMBOS: ProductoCombo[] = [
  {
    id: 'duo_diario',
    nombre: 'Duo Diario Premium',
    productos: ['EL_TERMOMETRO', 'SALDO_DEL_DIA'],
    precioMensual: 700,
    descripcion: 'Termómetro (7 AM) + Saldo del Día (7 PM). El ciclo completo de información diaria.',
  },
  {
    id: 'trio_premium',
    nombre: 'Trío Premium',
    productos: ['EL_TERMOMETRO', 'SALDO_DEL_DIA', 'EL_INFORME_CERRADO'],
    precioMensual: 1200,
    descripcion: 'Duo diario + Informe Cerrado semanal. Para equipos que necesitan seguimiento completo.',
  },
  {
    id: 'foco_starter',
    nombre: 'El Foco Starter (1 eje)',
    productos: ['EL_FOCO'],
    precioMensual: 500,
    descripcion: 'Un eje temático a profundidad diaria. Ideal para empezar.',
  },
  {
    id: 'foco_expanded',
    nombre: 'El Foco Expandido (3 ejes)',
    productos: ['EL_FOCO'],
    precioMensual: 1200,
    descripcion: 'Tres ejes temáticos con análisis diario. Para organizaciones con múltiples áreas de interés.',
  },
  {
    id: 'foco_total',
    nombre: 'El Foco Total (11 ejes)',
    productos: ['EL_FOCO'],
    precioMensual: 3000,
    descripcion: 'Todos los ejes temáticos con análisis diario. Cobertura completa del panorama nacional.',
  },
  {
    id: 'institucional',
    nombre: 'Plan Institucional',
    productos: ['EL_TERMOMETRO', 'SALDO_DEL_DIA', 'EL_FOCO', 'EL_INFORME_CERRADO', 'EL_ESPECIALIZADO'],
    precioMensual: 5000,
    descripcion: 'Todos los productos. Para embajadas, organismos internacionales y grandes corporaciones.',
  },
]

// ─── Etiquetas de Entrega ─────────────────────────────────────────

export const ETIQUETAS_ENTREGA: Record<TipoBoletin, { whatsapp: string; email: string }> = {
  EL_TERMOMETRO: {
    whatsapp: '🌡️ EL TERMÓMETRO — {fecha}',
    email: 'El Termómetro — {fecha} | News Connect',
  },
  SALDO_DEL_DIA: {
    whatsapp: '📊 EL SALDO DEL DÍA — {fecha}',
    email: 'El Saldo del Día — {fecha} | News Connect',
  },
  EL_FOCO: {
    whatsapp: '🔍 EL FOCO — {eje} — {fecha}',
    email: 'El Foco: {eje} — {fecha} | News Connect',
  },
  EL_ESPECIALIZADO: {
    whatsapp: '📋 EL ESPECIALIZADO — {sector} — {fecha}',
    email: 'El Especializado: {sector} — {fecha} | News Connect',
  },
  EL_RADAR: {
    whatsapp: '📡 EL RADAR — Semana {semana}',
    email: 'El Radar — Semana del {inicio} al {fin} | News Connect',
  },
  EL_INFORME_CERRADO: {
    whatsapp: '📄 EL INFORME CERRADO — Semana {semana}',
    email: 'El Informe Cerrado — Semana {semana} | News Connect',
  },
  VOZ_Y_VOTO: {
    whatsapp: '🗳️ VOZ Y VOTO — Semana {semana}',
    email: 'Voz y Voto — Semana {semana} | News Connect',
  },
  EL_HILO: {
    whatsapp: '🧵 EL HILO — Semana {semana}',
    email: 'El Hilo — Semana {semana} | News Connect',
  },
  FICHA_LEGISLADOR: {
    whatsapp: '📋 FICHA — {legislador} | News Connect',
    email: 'Ficha del Legislador: {legislador} | News Connect',
  },
  FOCO_DE_LA_SEMANA: {
    whatsapp: '🔍 FOCO DE LA SEMANA — {eje} — Semana {semana}',
    email: 'Foco de la Semana: {eje} — Semana {semana} | News Connect',
  },
  ALERTA_TEMPRANA: {
    whatsapp: '🚨 ALERTA TEMPRANA — {evento}',
    email: 'Alerta Temprana: {evento} | News Connect',
  },
}

// ─── Labels para UI ───────────────────────────────────────────────

export const PRODUCTOS_ACTIVOS = Object.values(PRODUCTOS).filter(p => p.activo)
export const PRODUCTOS_PREMIUM = Object.values(PRODUCTOS).filter(p => p.categoria !== 'gratuito')
export const PRODUCTOS_GRATUITOS = Object.values(PRODUCTOS).filter(p => p.categoria === 'gratuito')
