// ═══════════════════════════════════════════════════════════════
// Types — matching the actual API shape from /api/indicadores
// ═══════════════════════════════════════════════════════════════

export interface UltimoValor {
  valor: string;
  valorRaw?: number;
  fecha: string;
  confiable: boolean;
  fechaCaptura: string;
}

export interface UltimaEvaluacion {
  id: string;
  valorCompuesto: number;
  valorTexto: string;
  escalaNivel: string;
  puntuaciones: string;
}

export interface EnrichedIndicador {
  id: string;
  nombre: string;
  slug: string;
  categoria: string;
  tipo: string;
  fuente: string;
  periodicidad: string;
  unidad: string;
  formatoNumero: number;
  activo: boolean;
  orden: number;
  tier: number;
  ejesTematicos: string;
  ultimoValor?: UltimoValor | null;
  ultimaEvaluacion?: UltimaEvaluacion | null;
  totalValores: number;
  totalEvaluaciones: number;
  historial?: Array<{ fecha: string; valor: number }>;
}

export interface CaptureResult {
  exito: boolean;
  mensaje?: string;
  datos?: {
    exitosos: Array<{ slug: string; valor: string; confiable: boolean }>;
    fallidos: Array<{ slug: string; error: string; metadata?: string }>;
    total: number;
    duracionMs: number;
  };
  error?: string;
}

// ═══════════════════════════════════════════════════════════════
// Props
// ═══════════════════════════════════════════════════════════════

export interface IndicadoresViewProps {
  onNavigateTab?: (tab: string) => void;
}

// ═══════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════

export const CATEGORIAS: Record<string, { label: string; color: string }> = {
  monetario: { label: 'Monetario', color: '#06b6d4' },
  minero: { label: 'Minero', color: '#f59e0b' },
  agricolas: { label: 'Agricolas', color: '#10b981' },
  macro_bcb: { label: 'Macroeconomia BCB', color: '#8b5cf6' },
  ine: { label: 'INE', color: '#ec4899' },
  salud: { label: 'Salud', color: '#ef4444' },
  social: { label: 'Social', color: '#6366f1' },
  economico: { label: 'Economico', color: '#14b8a6' },
};

export const TIER_CONFIG: Record<number, { label: string; color: string }> = {
  1: { label: 'AUTO', color: '#10b981' },
  2: { label: 'SEMI', color: '#f59e0b' },
  3: { label: 'MANUAL', color: '#64748b' },
};

export const CATEGORIA_ORDER = [
  'monetario',
  'macro_bcb',
  'minero',
  'agricolas',
  'economico',
  'ine',
  'salud',
  'social',
];
