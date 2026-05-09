/**
 * Secciones de Estrategia — DECODEX Bolivia
 * Contenido estático del plan de negocio y roadmap.
 * Extraído de page.tsx para reducir bundle del cliente.
 */

import type { LucideIcon } from 'lucide-react';
import {
  BarChart3, Target, Package, Users, TrendingUp, Rocket,
  ListChecks, Globe, Shield, Activity,
} from 'lucide-react';

export interface EstrategiaSeccion {
  id: string;
  titulo: string;
  icon: LucideIcon;
  contenido?: string;
  kpis?: Array<{ label: string; value: string }>;
  secciones?: Array<{ subtitulo: string; texto: string }>;
  descripcion?: string;
  productos?: Array<{
    nombre: string; frec: string; horario: string; canales: string;
    precio: string; cat: string; estado: string;
  }>;
  combos?: Array<{ nombre: string; incluye: string; precio: string }>;
  segmentos?: Array<{
    nombre: string; prioridad: string; actores: string;
    mercado: string; ticket: string;
  }>;
  fuentes?: Array<{ nombre: string; pct: number; desc: string }>;
  proyeccion?: Array<{ fase: string; periodo: string; clientes: string; ingresos: string }>;
  niveles?: Array<{
    nivel: number; nombre: string; accion: string;
    contactos: string; conversion: string;
  }>;
  fases?: Array<{ nombre: string; periodo: string; detalle: string; estado: string }>;
  vertical?: Array<{ nombre: string; desc: string }>;
  horizontal?: Array<{ mercado: string; prioridad: string; justificacion: string }>;
  ventajas?: Array<{ nombre: string; desc: string }>;
  estadoProductos?: Array<{ nombre: string; estado: string; detalle: string }>;
}

export const ESTRATEGIA_SECCIONES: EstrategiaSeccion[] = [
  {
    id: 'resumen',
    titulo: 'Resumen Ejecutivo',
    icon: BarChart3,
    contenido: 'DECODEX es una plataforma de monitoreo mediático inteligente impulsada por el motor ONION200, diseñada para capturar, analizar y distribuir información estratégica sobre la presencia en medios de actores públicos, instituciones y temas de interés en Bolivia. La plataforma procesa diariamente datos de más de 30 fuentes mediáticas nacionales, generando alertas, boletines analíticos y dashboards interactivos que permiten a los tomadores de decisiones anticipar tendencias, gestionar crisis y optimizar su visibilidad pública.',
    kpis: [
      { label: 'Fuentes monitoreadas', value: '30+' },
      { label: 'Personas en radar', value: '173' },
      { label: 'Menciones/día', value: '77+' },
      { label: 'Ejes temáticos', value: '11' },
    ],
  },
  {
    id: 'vision',
    titulo: 'Visión y Posicionamiento',
    icon: Target,
    secciones: [
      { subtitulo: 'Misión', texto: 'Transformar la inteligencia mediática en Bolivia mediante tecnología de análisis en tiempo real, proporcionando a tomadores de decisiones información accionable, oportuna y precisa sobre presencia en medios, sentimiento público y dinámicas de conflictividad.' },
      { subtitulo: 'Propuesta de valor diferenciada', texto: 'A diferencia de los servicios de recorte de prensa tradicionales, DECODEX incorpora capas de IA que permiten clasificación automática por sentimiento, detección de conflictividad, seguimiento de ejes temáticos y generación de boletines con prospectiva. El motor ONION200 procesa múltiples fuentes en paralelo con tiempos de respuesta en minutos.' },
      { subtitulo: 'Posicionamiento competitivo', texto: 'Segmento premium de inteligencia mediática, espacio dominado por servicios genéricos de clipping sin análisis de sentimiento. El modelo freemium con productos gratuitos de alto valor (El Radar, Voz y Voto, El Hilo, Foco de la Semana) sirve como motor de adquisición que alimenta el embudo de conversión.' },
    ],
  },
  {
    id: 'catalogo',
    titulo: 'Catálogo de Productos',
    icon: Package,
    productos: [
      { nombre: 'El Termómetro', frec: 'Diario AM', horario: '07:00', canales: 'WhatsApp, Email', precio: 'Bs 350/mes', cat: 'Premium', estado: 'operativo' },
      { nombre: 'Saldo del Día', frec: 'Diario PM', horario: '19:00', canales: 'WA, Email', precio: 'Bs 350/mes', cat: 'Premium', estado: 'operativo' },
      { nombre: 'El Foco', frec: 'Diario AM', horario: '09:00', canales: 'WA, Email, PDF', precio: 'Bs 500-3K/mes', cat: 'Premium', estado: 'operativo' },
      { nombre: 'El Informe Cerrado', frec: 'Semanal', horario: 'Lun 10:00', canales: 'Email, PDF', precio: 'Bs 800/mes', cat: 'Premium', estado: 'definido' },
      { nombre: 'Ficha del Legislador', frec: 'Bajo demanda', horario: 'A solicitud', canales: 'Email, PDF', precio: 'Bs 200/und', cat: 'Premium', estado: 'definido' },
      { nombre: 'El Especializado', frec: 'Diario', horario: '10:00', canales: 'Email, PDF', precio: 'Bs 1.500/mes', cat: 'Premium Mid', estado: 'definido' },
      { nombre: 'Alerta Temprana', frec: 'Tiempo real', horario: 'Inmediata', canales: 'WhatsApp', precio: 'Bs 2.000/mes', cat: 'Premium Alta', estado: 'definido' },
      { nombre: 'El Radar', frec: 'Semanal', horario: 'Lun 08:00', canales: 'Email, Web', precio: 'Gratuito', cat: 'Gratuito', estado: 'operativo' },
      { nombre: 'Voz y Voto', frec: 'Semanal', horario: 'Lun 08:00', canales: 'Email, Web', precio: 'Gratuito', cat: 'Gratuito', estado: 'definido' },
      { nombre: 'El Hilo', frec: 'Semanal', horario: 'Lun 08:00', canales: 'Email, Web', precio: 'Gratuito', cat: 'Gratuito', estado: 'definido' },
      { nombre: 'Foco de la Semana', frec: 'Semanal', horario: 'Lun 08:00', canales: 'Email, Web', precio: 'Gratuito', cat: 'Gratuito', estado: 'definido' },
    ],
    combos: [
      { nombre: 'Duo Diario Premium', incluye: 'Termómetro + Saldo', precio: 'Bs 700/mes' },
      { nombre: 'Trio Premium', incluye: 'Termómetro + Saldo + Inf. Cerrado', precio: 'Bs 1.200/mes' },
      { nombre: 'El Foco Starter (1 eje)', incluye: 'El Foco', precio: 'Bs 500/mes' },
      { nombre: 'El Foco Expandido (3 ejes)', incluye: 'El Foco', precio: 'Bs 1.200/mes' },
      { nombre: 'El Foco Total (11 ejes)', incluye: 'El Foco', precio: 'Bs 3.000/mes' },
      { nombre: 'Plan Institucional', incluye: 'Todos los productos', precio: 'Bs 5.000/mes' },
    ],
  },
  {
    id: 'segmentacion',
    titulo: 'Segmentación del Mercado',
    icon: Users,
    descripcion: 'El mercado objetivo se estructura en siete segmentos diferenciados. El mercado total direccionable se estima en Bs 400.000 mensuales con una penetración objetivo del 10-15% en el primer año.',
    segmentos: [
      { nombre: 'Gobierno Central', prioridad: 'Alta', actores: 'Ministerios, viceministerios', mercado: 'Bs 80.000/mes', ticket: 'Bs 3.000-5.000' },
      { nombre: 'Gobiernos Municipales', prioridad: 'Media', actores: 'Alcaldías, secretarías', mercado: 'Bs 60.000/mes', ticket: 'Bs 700-1.200' },
      { nombre: 'Organismos Internacionales', prioridad: 'Alta', actores: 'Embajadas, ONU, BID', mercado: 'Bs 90.000/mes', ticket: 'Bs 2.000-5.000' },
      { nombre: 'Sector Privado', prioridad: 'Media-Alta', actores: 'Bancos, telecom, minería', mercado: 'Bs 80.000/mes', ticket: 'Bs 500-3.000' },
      { nombre: 'Legisladores', prioridad: 'Media', actores: 'Diputados, senadores', mercado: 'Bs 40.000/mes', ticket: 'Bs 350-800' },
      { nombre: 'ONGs y Academia', prioridad: 'Baja-Media', actores: 'Think tanks, universidades', mercado: 'Bs 25.000/mes', ticket: 'Bs 200-500' },
      { nombre: 'Medios y Periodistas', prioridad: 'Baja', actores: 'Medios, corresponsales', mercado: 'Bs 25.000/mes', ticket: 'Bs 0-350' },
    ],
  },
  {
    id: 'ingresos',
    titulo: 'Modelo de Ingresos',
    icon: TrendingUp,
    descripcion: 'Modelo de ingresos diversificado con cinco fuentes principales, reduciendo la dependencia de un único flujo de caja.',
    fuentes: [
      { nombre: 'Suscripciones Mensuales', pct: 60, desc: 'Pagos recurrentes por productos premium y combos' },
      { nombre: 'Contratos Anuales', pct: 20, desc: 'Compromisos de largo plazo con descuento 15-20%' },
      { nombre: 'Servicios a Medida', pct: 10, desc: 'Informes especiales, Fichas, dashboards personalizados' },
      { nombre: 'Alerta Temprana (Add-on)', pct: 5, desc: 'Alertas en tiempo real via WhatsApp' },
      { nombre: 'Consultoría de Datos', pct: 5, desc: 'Análisis de datos históricos, tendencias sectoriales' },
    ],
    proyeccion: [
      { fase: '1. Fundación', periodo: 'Meses 1-3', clientes: '5-8', ingresos: 'Bs 15-25K/mes' },
      { fase: '2. Crecimiento', periodo: 'Meses 4-6', clientes: '12-20', ingresos: 'Bs 40-70K/mes' },
      { fase: '3. Consolidación', periodo: 'Meses 7-9', clientes: '20-30', ingresos: 'Bs 70-110K/mes' },
      { fase: '4. Expansión', periodo: 'Meses 10-12', clientes: '25-40', ingresos: 'Bs 80-150K/mes' },
    ],
  },
  {
    id: 'embudo',
    titulo: 'Embudo de Conversión',
    icon: Rocket,
    descripcion: 'Embudo de cinco niveles, desde la captación masiva con productos gratuitos hasta la retención de contratos institucionales.',
    niveles: [
      { nivel: 1, nombre: 'Awareness', accion: 'Radar, Voz y Voto, El Hilo, Foco Semana', contactos: '10.000+', conversion: 'Base gratuita' },
      { nivel: 2, nombre: 'Engagement', accion: 'Webinars, demos, prueba premium', contactos: '1.500', conversion: '15% awareness' },
      { nivel: 3, nombre: 'Trial', accion: '15 días a Termómetro o El Foco', contactos: '300', conversion: '20% engagement' },
      { nivel: 4, nombre: 'Conversion', accion: 'Suscripción premium o combos', contactos: '75', conversion: '25% trial' },
      { nivel: 5, nombre: 'Retención', accion: 'Upsell Plan Institucional', contactos: '50', conversion: '67% retención' },
    ],
  },
  {
    id: 'roadmap',
    titulo: 'Roadmap de Implementación',
    icon: ListChecks,
    descripcion: 'Plan a 12 meses en cuatro fases progresivas con objetivos claros y métricas de éxito.',
    fases: [
      { nombre: 'Fase 1: Fundación', periodo: 'Meses 1-3', detalle: 'Estabilizar ONION200, lanzar 4 gratuitos + activar Termómetro, Saldo, Foco, Radar. 5-8 clientes.', estado: 'en_curso' },
      { nombre: 'Fase 2: Expansión Catálogo', periodo: 'Meses 4-6', detalle: 'Incorporar Inf. Cerrado, Especializado, Ficha, Alerta Temprana. Combos. 12-20 clientes.', estado: 'pendiente' },
      { nombre: 'Fase 3: Consolidación', periodo: 'Meses 7-9', detalle: 'Penetración institucional, Plan Institucional insignia, alianzas estratégicas. 20-30 clientes.', estado: 'pendiente' },
      { nombre: 'Fase 4: Escalamiento', periodo: 'Meses 10-12', detalle: 'Expansión regional (Paraguay, Ecuador, Perú), análisis predictivo. 25-40 clientes.', estado: 'pendiente' },
    ],
  },
  {
    id: 'expansion',
    titulo: 'Oportunidades de Expansión',
    icon: Globe,
    vertical: [
      { nombre: 'Inteligencia de Datos', desc: 'Dashboards avanzados con tendencias, comparativas históricas y benchmarking entre actores.' },
      { nombre: 'Servicios Personalizados', desc: 'Informes ad-hoc, monitoreo de campañas, análisis de impacto de declaraciones.' },
      { nombre: 'Herramientas Proactivas', desc: 'Alertas predictivas basadas en patrones de sentimiento, scoring de riesgo mediático.' },
    ],
    horizontal: [
      { mercado: 'Paraguay', prioridad: 'Alta', justificacion: 'Ecosistema mediático similar, demanda creciente.' },
      { mercado: 'Ecuador', prioridad: 'Media-Alta', justificacion: 'Mercado robusto, oportunidad para alianzas.' },
      { mercado: 'Perú', prioridad: 'Media', justificacion: 'Mercado grande, segmento premium desatendido.' },
      { mercado: 'Sectorial Bolivia', prioridad: 'Alta', justificacion: 'Hidrocarburos, minería, telecom, banca.' },
    ],
  },
  {
    id: 'ventajas',
    titulo: 'Ventajas Competitivas',
    icon: Shield,
    ventajas: [
      { nombre: 'Motor ONION200', desc: 'Tecnología propia de procesamiento y análisis en tiempo real. Clasificación automática por sentimiento, conflictividad y ejes temáticos.' },
      { nombre: 'Base de Datos', desc: 'Acumulación continua de datos históricos. Cada día de operación incrementa el valor del activo.' },
      { nombre: 'Conocimiento Local', desc: 'Entendimiento profundo del ecosistema mediático boliviano: fuentes, actores, dinámicas y contextos políticos.' },
      { nombre: 'Multi-canal', desc: 'Entrega simultánea por WhatsApp, email, PDF y dashboard web sin fricción tecnológica.' },
      { nombre: 'Modelo Freemium', desc: 'Productos gratuitos de alto valor que generan awareness y alimentan el embudo de conversión.' },
    ],
  },
  {
    id: 'estado',
    titulo: 'Estado Actual',
    icon: Activity,
    descripcion: 'v0.7.0: 4 productos con generador operativo, dashboard con 15 vistas, 173 personas, 30 medios, 8 clientes registrados.',
    estadoProductos: [
      { nombre: 'El Termómetro', estado: 'operativo', detalle: 'Generador automático, WhatsApp + email' },
      { nombre: 'Saldo del Día', estado: 'operativo', detalle: 'Generador automático, WhatsApp + email' },
      { nombre: 'El Foco', estado: 'operativo', detalle: 'Generador automático, 11 ejes temáticos' },
      { nombre: 'El Radar', estado: 'operativo', detalle: 'Generador automático, distribución semanal gratuita' },
      { nombre: 'El Informe Cerrado', estado: 'definido', detalle: 'Configuración completa, generador en desarrollo' },
      { nombre: 'El Especializado', estado: 'definido', detalle: 'Configuración completa, generador pendiente' },
      { nombre: 'Alerta Temprana', estado: 'definido', detalle: 'Vista dashboard, motor en desarrollo' },
      { nombre: 'Voz y Voto', estado: 'definido', detalle: 'Configuración completa, generador pendiente' },
      { nombre: 'El Hilo', estado: 'definido', detalle: 'Configuración completa, generador pendiente' },
      { nombre: 'Foco de la Semana', estado: 'definido', detalle: 'Configuración completa, generador pendiente' },
      { nombre: 'Ficha del Legislador', estado: 'definido', detalle: 'Configuración completa, generador pendiente' },
    ],
  },
];
