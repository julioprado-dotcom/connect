// ═══════════════════════════════════════════════════════════════
// ProduccionView — Type Definitions
// ═══════════════════════════════════════════════════════════════

export interface ProductoSummary {
  total: number;
  hoy: number;
  semana: number;
  tipos?: Record<string, number>;
}

export interface ProduccionData {
  productos?: ProductoSummary;
  status?: string;
  recientes?: Array<{
    id: string;
    tipo: string;
    titulo: string;
    fechaCreacion: string;
    estado: string;
  }>;
}

export interface CatalogProduct {
  tipo: string;
  nombre: string;
  estado: string;             // Operational status from ALL_PRODUCTS ('operativo'|'definido')
  estadoDatos?: string;       // Data state from API ('generado'|'sin_datos'|'sin_menciones')
  categoria: string;
  ultimaEdicion: string | null;
  ultimoId: string | null;
  mencionesUsadas?: number;
  totalEdiciones?: number;
}

export interface EjeItem {
  slug: string;
  nombre: string;
}

export interface PersonaItem {
  id: string;
  nombre: string;
  tipo?: string;
}

export interface UltimoProduct {
  encontrado: boolean;
  id: string;
  tipo: string;
  resumen: string;
  contenido: string | Record<string, unknown>;  // Puede ser string o objeto JSON parseado
  totalMenciones?: number;
  fechaCreacion: string;
  fechaInicio?: string;
  fechaFin?: string;
  temasPrincipales?: string;
}

export interface Notification {
  id: string;
  tipo: 'success' | 'error';
  message: string;
  detail?: string;
  timestamp: number;
}
