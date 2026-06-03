import { statusToken, ACCENT } from '@/constants/colors';

// ═══════════════════════════════════════════════════════════════
// FuentesView — Types, Constants, and Helpers
// ═══════════════════════════════════════════════════════════════

export interface Medio {
  id: string;
  nombre: string;
  url: string;
  tipo: string;
  categoria: string;
  nivel: string;
  departamento: string | null;
  plataformas: string;
  notas: string;
  pais: string;
  activo: boolean;
  naturaleza: string;
  ambito: string;
  enfoque: string;
  credibilidad: number;
  ultimaRevisionHumana: string | null;
  ultimoError: string;
  fechaCreacion: string;
  mencionesCount?: number;
}

export interface ProbeLogEntry {
  step: string;
  status: 'ok' | 'error' | 'warn';
  message: string;
  ms?: number;
}

export interface ProbeResult {
  medioId: string;
  nombre: string;
  url: string;
  logs: ProbeLogEntry[];
  success: boolean;
  estado: string;
}

export interface AIAnalysis {
  naturaleza: string;
  ambito: string;
  enfoque: string;
  credibilidad: number;
  razon: string;
}

export interface EditForm {
  nombre: string;
  url: string;
  naturaleza: string;
  ambito: string;
  enfoque: string;
  credibilidad: number;
}

export interface MedioMencion {
  id: string;
  titulo: string;
  fechaCaptura: string;
  sentimiento: string;
  Persona?: { nombre: string } | null;
}

export type FilterMode = 'todos' | 'errores' | 'inactivos';

// ═══════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════

export const NATURALEZA_OPTS = ['ESTATAL', 'PRIVADO', 'COMUNITARIO', 'MIXTO', 'ONG'] as const;
export const AMBITO_OPTS = ['NACIONAL', 'REGIONAL', 'LOCAL', 'INTERNACIONAL'] as const;
export const ENFOQUE_OPTS = ['GENERALISTA', 'ECONOMICO', 'POLITICO', 'DEPORTIVO', 'CULTURAL'] as const;

export const NATURALEZA_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  ESTATICAL: { text: ACCENT.estatical.color, bg: ACCENT.estatical.bg, border: ACCENT.estatical.border },
  ESTATAL: { text: ACCENT.estatal.color, bg: ACCENT.estatal.bg, border: ACCENT.estatal.border },
  PRIVADO: { text: ACCENT.privado.color, bg: ACCENT.privado.bg, border: ACCENT.privado.border },
  COMUNITARIO: { text: ACCENT.comunitario.color, bg: ACCENT.comunitario.bg, border: ACCENT.comunitario.border },
  MIXTO: { text: ACCENT.mixto_naturaleza.color, bg: ACCENT.mixto_naturaleza.bg, border: ACCENT.mixto_naturaleza.border },
  ONG: { text: ACCENT.ong.color, bg: ACCENT.ong.bg, border: ACCENT.ong.border },
};

// ═══════════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════════

export const getEstadoColor = (activo: boolean, ultimoError: string): { text: string; bg: string; border: string; blink?: boolean } => {
  if (ultimoError && ultimoError.length > 0) {
    const t = statusToken('error');
    return { text: t.color, bg: t.bg, border: t.border, blink: true };
  }
  if (!activo) {
    const t = statusToken('inactiva');
    return { text: t.color, bg: t.bg, border: t.border };
  }
  const t = statusToken('active');
  return { text: t.color, bg: t.bg, border: t.border };
};

export const getEstadoLabel = (activo: boolean, ultimoError: string): string => {
  if (ultimoError && ultimoError.length > 0) return 'ERROR';
  if (!activo) return 'INACTIVO';
  return 'ACTIVO';
};
