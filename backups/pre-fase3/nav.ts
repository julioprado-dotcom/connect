/**
 * Navegación y catálogo de productos — DECODEX Bolivia
 * Items de sidebar y definiciones de productos operativos.
 */

import type { TipoBoletin } from '@/types/bulletin';
import {
  BarChart3, UserCircle, FileCheck, Newspaper, Tag, Mail, Bell,
  Rocket, Zap, FileBarChart, Database, TrendingUp, Package, Settings,
  Thermometer, Scale, Search, FileText, UserCheck, GraduationCap,
  Radio, ListChecks, Link2, Target,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// ─── Nav Items ────────────────────────────────────────────────

export interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'resumen', label: 'Centro de Comando', icon: BarChart3 },
  { id: 'clientes', label: 'Clientes', icon: UserCircle },
  { id: 'contratos', label: 'Contratos', icon: FileCheck },
  { id: 'menciones', label: 'Menciones', icon: Newspaper },
  { id: 'clasificadores', label: 'Clasificadores', icon: Tag },
  { id: 'boletines', label: 'Boletines', icon: Mail },
  { id: 'alertas', label: 'Alertas', icon: Bell },
  { id: 'estrategia', label: 'Estrategia', icon: Rocket },
  { id: 'generadores', label: 'Generadores', icon: Zap },
  { id: 'reportes', label: 'Reportes', icon: FileBarChart },
  { id: 'captura', label: 'Captura', icon: Database },
  { id: 'indicadores', label: 'Indicadores', icon: TrendingUp },
  { id: 'productos', label: 'Productos', icon: Package },
  { id: 'configuracion', label: 'Configuración', icon: Settings },
];

// ─── All Products ─────────────────────────────────────────────

export interface ProductDisplay {
  tipo: TipoBoletin;
  nombre: string;
  icon: LucideIcon;
  color: string;
  categoria: string;
  estado: string;
}

export const ALL_PRODUCTS: ProductDisplay[] = [
  // Premium
  { tipo: 'EL_TERMOMETRO', nombre: 'El Termómetro', icon: Thermometer, color: '#3B82F6', categoria: 'premium', estado: 'operativo' },
  { tipo: 'SALDO_DEL_DIA', nombre: 'Saldo del Día', icon: Scale, color: '#8B5CF6', categoria: 'premium', estado: 'operativo' },
  { tipo: 'EL_FOCO', nombre: 'El Foco', icon: Search, color: '#F59E0B', categoria: 'premium', estado: 'operativo' },
  { tipo: 'EL_INFORME_CERRADO', nombre: 'El Informe Cerrado', icon: FileText, color: '#10B981', categoria: 'premium', estado: 'definido' },
  { tipo: 'FICHA_LEGISLADOR', nombre: 'Ficha del Legislador', icon: UserCheck, color: '#06B6D4', categoria: 'premium', estado: 'definido' },
  { tipo: 'EL_ESPECIALIZADO', nombre: 'El Especializado', icon: GraduationCap, color: '#EC4899', categoria: 'premium_mid', estado: 'definido' },
  // Premium Alta
  { tipo: 'ALERTA_TEMPRANA', nombre: 'Alerta Temprana', icon: Bell, color: '#EF4444', categoria: 'premium_alta', estado: 'definido' },
  // Gratuitos
  { tipo: 'EL_RADAR', nombre: 'El Radar', icon: Radio, color: '#22C55E', categoria: 'gratuito', estado: 'operativo' },
  { tipo: 'VOZ_Y_VOTO', nombre: 'Voz y Voto', icon: ListChecks, color: '#6366F1', categoria: 'gratuito', estado: 'definido' },
  { tipo: 'EL_HILO', nombre: 'El Hilo', icon: Link2, color: '#14B8A6', categoria: 'gratuito', estado: 'definido' },
  { tipo: 'FOCO_DE_LA_SEMANA', nombre: 'Foco de la Semana', icon: Target, color: '#10B981', categoria: 'gratuito', estado: 'definido' },
];

// ─── Product Categories ───────────────────────────────────────

export const PRODUCT_CATEGORIES = [
  { id: 'premium', label: 'Premium', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' },
  { id: 'premium_mid', label: 'Premium Mid', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300' },
  { id: 'premium_alta', label: 'Premium Alta', color: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' },
  { id: 'gratuito', label: 'Gratuito', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' },
];

// ─── Labels ───────────────────────────────────────────────────

export const CANAL_LABELS: Record<string, string> = {
  whatsapp: 'WhatsApp',
  email: 'Email',
  web: 'Web',
  pdf: 'PDF',
};

export const FRECUENCIA_LABELS: Record<string, string> = {
  diario_am: 'Diario (AM)',
  diario_pm: 'Diario (PM)',
  diario: 'Diario',
  semanal: 'Semanal',
  mensual: 'Mensual',
  bajo_demanda: 'Bajo demanda',
  tiempo_real: 'Tiempo real',
};
