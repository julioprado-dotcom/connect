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
  id: string;
  tipo: string;
  titulo: string;
  contenido: string;
  resumen: string;
  fechaCreacion: string;
  metadata: Record<string, unknown>;
}

export interface Notification {
  id: string;
  tipo: 'success' | 'error';
  message: string;
  detail?: string;
  timestamp: number;
}
