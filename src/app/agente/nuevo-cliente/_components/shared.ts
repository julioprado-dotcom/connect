import { ALL_PRODUCTS } from '@/constants/nav';
import type { TipoBoletin } from '@/types/bulletin';

/* ─── Segmento options ────────────────────────────────────── */
export const SEGMENTOS = [
  { value: 'partido_politico', label: 'Partido Pol&iacute;tico' },
  { value: 'movimiento_social', label: 'Movimiento Social' },
  { value: 'ong', label: 'ONG' },
  { value: 'embajada', label: 'Embajada / Org. Internacional' },
  { value: 'legislador', label: 'Legislador' },
  { value: 'medio', label: 'Medio de Comunicaci&oacute;n' },
  { value: 'academico', label: 'Acad&eacute;mico' },
  { value: 'otro', label: 'Otro' },
];

/* ─── Types ───────────────────────────────────────────────── */
export interface ClienteData {
  nombre: string;
  organizacion: string;
  nombreContacto: string;
  email: string;
  telefono: string;
  whatsapp: string;
  segmento: string;
  notas: string;
  ci: string;
  razonSocial: string;
  nit: string;
}

export interface ProductConfig {
  tipo: TipoBoletin;
  canal: string;
  frecuencia: string;
  precio: number;
  fechaInicio: string;
}

/* ─── Helper: get today as YYYY-MM-DD ─────────────────────── */
export function todayStr() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

/* ─── Price map from combos / defaults ────────────────────── */
export function getDefaultPrice(tipo: TipoBoletin): number {
  const cat = ALL_PRODUCTS.find((p) => p.tipo === tipo)?.categoria;
  if (cat === 'premium_alta') return 2000;
  if (cat === 'premium_mid') return 1500;
  if (cat === 'premium') return 500;
  return 0;
}
