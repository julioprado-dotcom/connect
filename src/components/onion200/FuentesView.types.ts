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
  ESTATICAL: { text: '#06b6d4', bg: 'rgba(6,182,212,0.1)', border: 'rgba(6,182,212,0.25)' },
  ESTATAL: { text: '#06b6d4', bg: 'rgba(6,182,212,0.1)', border: 'rgba(6,182,212,0.25)' },
  PRIVADO: { text: '#94a3b8', bg: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.2)' },
  COMUNITARIO: { text: '#3b82f6', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.2)' },
  MIXTO: { text: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)' },
  ONG: { text: '#a78bfa', bg: 'rgba(167,139,250,0.08)', border: 'rgba(167,139,250,0.2)' },
};

// ═══════════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════════

export const getEstadoColor = (activo: boolean, ultimoError: string): { text: string; bg: string; border: string; blink?: boolean } => {
  if (ultimoError && ultimoError.length > 0) {
    return { text: '#8b5cf6', bg: 'rgba(139,92,246,0.06)', border: 'rgba(139,92,246,0.2)', blink: true };
  }
  if (!activo) {
    return { text: '#f59e0b', bg: 'rgba(245,158,11,0.06)', border: 'rgba(245,158,11,0.2)' };
  }
  return { text: '#06b6d4', bg: 'rgba(6,182,212,0.06)', border: 'rgba(6,182,212,0.15)' };
};

export const getEstadoLabel = (activo: boolean, ultimoError: string): string => {
  if (ultimoError && ultimoError.length > 0) return 'ERROR';
  if (!activo) return 'INACTIVO';
  return 'ACTIVO';
};
