import { z } from 'zod';

// ─── Cliente ──────────────────────────────────────────────────────
export const clienteCreateSchema = z.object({
  nombre: z.string().trim().min(1, 'Nombre es obligatorio').max(200),
  nombreContacto: z.string().trim().max(200).optional().default(''),
  email: z.string().email('Email inválido').max(300),
  telefono: z.string().max(50).optional().default(''),
  whatsapp: z.string().max(50).optional().default(''),
  organizacion: z.string().max(300).optional().default(''),
  segmento: z.enum(['partido_politico', 'movimiento_social', 'ong', 'embajada', 'legislador', 'medio', 'academico', 'otro']).optional().default('otro'),
  plan: z.enum(['basico', 'avanzado', 'institucional']).optional().default('basico'),
  estado: z.enum(['activo', 'suspendido', 'cancelado']).optional().default('activo'),
  parlamentarios: z.array(z.string()).optional().default([]),
  ejesContratados: z.array(z.string()).optional().default([]),
  notas: z.string().max(2000).optional().default(''),
});

// ─── Contrato ─────────────────────────────────────────────────────
export const contratoCreateSchema = z.object({
  clienteId: z.string().min(1, 'Cliente es obligatorio'),
  tipoProducto: z.string().min(1, 'Tipo de producto es obligatorio'),
  mediosAsignados: z.array(z.string()).optional().default([]),
  ejesTematicos: z.array(z.string()).optional().default([]),
  parlamentarios: z.array(z.string()).optional().default([]),
  frecuencia: z.enum(['diario', 'semanal', 'quincenal', 'mensual']).optional().default('diario'),
  formatoEntrega: z.enum(['whatsapp', 'email', 'ambos']).optional().default('whatsapp'),
  fechaInicio: z.string().min(1, 'Fecha inicio es obligatoria'),
  fechaFin: z.string().optional().default(''),
  montoMensual: z.number().min(0).optional().default(0),
  moneda: z.enum(['Bs', 'USD']).optional().default('Bs'),
  estado: z.enum(['activo', 'pausado', 'vencido', 'cancelado']).optional().default('activo'),
  notas: z.string().max(2000).optional().default(''),
});

// ─── Persona ──────────────────────────────────────────────────────
export const personaCreateSchema = z.object({
  nombre: z.string().trim().min(1, 'Nombre es obligatorio').max(200),
  camara: z.enum(['Diputados', 'Senadores']).optional().default('Diputados'),
  departamento: z.string().max(100).optional().default(''),
  partido: z.string().max(300).optional().default(''),
  partidoSigla: z.string().max(50).optional().default(''),
  tipo: z.string().max(50).optional().default('plurinominal'),
  cargoDirectiva: z.string().max(200).optional().default(''),
  email: z.string().email('Email inválido').max(300).optional().default(''),
  fotoUrl: z.string().max(500).optional().default(''),
});

// ─── Suscriptor ───────────────────────────────────────────────────
export const suscriptorCreateSchema = z.object({
  nombre: z.string().trim().max(200).optional().default(''),
  email: z.string().email('Email inválido').max(300),
  whatsapp: z.string().max(50).optional().default(''),
  origen: z.string().max(100).optional().default('admin'),
  activo: z.boolean().optional().default(true),
});

export const suscriptorUpdateSchema = z.object({
  nombre: z.string().trim().max(200).optional(),
  email: z.string().email('Email inválido').max(300).optional(),
  whatsapp: z.string().max(50).nullable().optional(),
  origen: z.string().max(100).optional(),
  activo: z.boolean().optional(),
});

// ─── Entrega ──────────────────────────────────────────────────────
export const entregaCreateSchema = z.object({
  contratoId: z.string().min(1, 'Contrato es obligatorio'),
  tipoBoletin: z.string().min(1, 'Tipo de boletín es obligatorio'),
  contenido: z.string().optional().default(''),
  fechaProgramada: z.string().optional().default(''),
  fechaEnvio: z.string().optional().default(''),
  estado: z.enum(['pendiente', 'enviado', 'fallido']).optional().default('enviado'),
  canal: z.enum(['whatsapp', 'email', 'web']).optional().default('whatsapp'),
  destinatarios: z.array(z.string()).optional().default([]),
  error: z.string().max(500).optional().default(''),
});

// ─── Reporte ──────────────────────────────────────────────────────
export const reporteCreateSchema = z.object({
  tipo: z.string().min(1).max(100).optional().default('semanal'),
  personaId: z.string().optional().default(''),
  fechaInicio: z.string().optional().default(''),
  fechaFin: z.string().optional().default(''),
  resumen: z.string().max(5000).optional().default(''),
  totalMenciones: z.number().int().min(0).optional().default(0),
  sentimientoPromedio: z.number().min(0).max(5).optional().default(0),
  temasPrincipales: z.array(z.string()).optional().default([]),
});

// ─── Eje Temático ─────────────────────────────────────────────────
export const ejeCreateSchema = z.object({
  nombre: z.string().trim().min(1, 'Nombre es obligatorio').max(200),
  slug: z.string().trim().max(100).optional(),
  parentId: z.string().max(100).nullable().optional(),
  icono: z.string().max(10).optional().default(''),
  color: z.string().max(20).optional().default('#6b7280'),
  descripcion: z.string().max(500).optional().default(''),
  keywords: z.string().max(500).optional().default(''),
  dimension: z.string().max(50).optional().default(''),
  activo: z.boolean().optional().default(true),
  orden: z.number().int().min(0).optional().default(0),
});

export const ejePatchSchema = z.object({
  activo: z.boolean(),
});

// ─── Medios ───────────────────────────────────────────────────────
export const medioUpdateSchema = z.object({
  activo: z.boolean().optional(),
  nombre: z.string().max(300).optional(),
  url: z.string().max(500).optional(),
  tipo: z.string().max(50).optional(),
  nivel: z.string().max(10).optional(),
  departamento: z.string().max(100).nullable().optional(),
  plataformas: z.string().max(500).optional(),
  notas: z.string().max(1000).optional(),
});

// ─── Auth Setup ───────────────────────────────────────────────────
export const authSetupSchema = z.object({
  name: z.string().trim().min(1, 'Nombre es obligatorio').max(200),
  email: z.string().email('Email inválido').max(300),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres').max(200),
  role: z.enum(['admin', 'agente', 'viewer']).optional().default('admin'),
});

// ─── Login ────────────────────────────────────────────────────────
export const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Contraseña es obligatoria'),
});

// ─── Analyze ──────────────────────────────────────────────────────
export const analyzeSchema = z.object({
  mencionId: z.string().max(100).optional(),
  texto: z.string().max(10000).optional(),
  titulo: z.string().max(1000).optional(),
});

export const analyzeBatchSchema = z.object({
  limit: z.number().int().min(1).max(50).optional().default(10),
});

// ─── Search ───────────────────────────────────────────────────────
export const searchSchema = z.object({
  personaNombre: z.string().trim().min(1, 'Nombre de persona es obligatorio').max(200),
});

// ─── Reporte Generate ─────────────────────────────────────────────
export const reporteGenerateSchema = z.object({
  personaId: z.string().max(100).optional(),
  tipo: z.string().max(100).optional().default('semanal'),
  fecha: z.string().max(50).optional(),
  ejesSeleccionados: z.array(z.string()).optional().default([]),
});

// ─── Bulletins (Admin Generators) ─────────────────────────────────
export const generateFichaSchema = z.object({
  personaId: z.string().min(1, 'personaId es obligatorio'),
  temperatura: z.number().min(0).max(2).optional(),
});

export const generateFocoSchema = z.object({
  ejeSlug: z.string().min(1, 'ejeSlug es obligatorio'),
  temperatura: z.number().min(0).max(2).optional(),
});

export const generateGenericSchema = z.object({
  tipo: z.string().min(1, 'tipo es obligatorio'),
  ejeSlug: z.string().max(100).optional(),
  personaId: z.string().max(100).optional(),
  temperatura: z.number().min(0).max(2).optional(),
  fechaInicio: z.string().max(50).optional(),
  fechaFin: z.string().max(50).optional(),
  clienteId: z.string().max(100).optional(),
});

export const generateRadarSchema = z.object({
  temperatura: z.number().min(0).max(2).optional(),
});

export const generateSaldoSchema = z.object({
  ejesTematicos: z.array(z.string()).optional().default([]),
  personaId: z.string().max(100).optional(),
  nombreCliente: z.string().max(200).optional().default('Cliente'),
  indicadores: z.boolean().optional().default(true),
});

export const generateTermometroSchema = z.object({
  temperatura: z.number().min(0).max(2).optional(),
});

// ─── Seed ─────────────────────────────────────────────────────────
export const seedSchema = z.object({
  force: z.boolean().optional().default(false),
  seed_only: z.string().max(50).optional(),
});

// ─── Paginación ───────────────────────────────────────────────────
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
