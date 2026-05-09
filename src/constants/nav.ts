/**
 * Navegacion y catalogo de productos - DECODEX Bolivia
 * Sidebar con grupos colapsables, sub-items y jerarquia.
 */

import type { TipoBoletin } from '@/types/bulletin';
import {
  BarChart3, UserCircle, FileCheck, Newspaper, Tag, Mail, Bell,
  Rocket, Zap, FileBarChart, Database, TrendingUp, Package, Settings,
  Thermometer, Scale, Search, FileText, UserCheck, GraduationCap,
  Radio, ListChecks, Link2, Target, Users, MonitorPlay, Globe,
  RadioTower, UsersRound, ChevronRight, Eye, Bookmark, LayoutGrid, Activity,
  Shield,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// ─── Nav Item con soporte para sub-items ────────────────────────

export interface NavItem {
  id: string;
  label: string;
  icon?: LucideIcon;         // si no tiene icono, es un separador de grupo
  children?: NavItem[];      // sub-items (colapsables)
}

// ─── Nav Groups (orden del sidebar) ────────────────────────────

export const NAV_ITEMS: NavItem[] = [
  // ── ANALISIS ──────────────────────────────────────────────
  { id: 'resumen', label: 'Centro de Comando', icon: BarChart3 },
  {
    id: 'menciones',
    label: 'Menciones',
    icon: Newspaper,
    children: [
      { id: 'personas-seguimiento', label: 'Personas en seguimiento', icon: UsersRound },
      { id: 'temas-seguimiento', label: 'Temas en seguimiento', icon: Tag },
    ],
  },
  { id: 'alertas', label: 'Alertas', icon: Bell },
  { id: 'indicadores', label: 'Indicadores', icon: TrendingUp },

  // ── ONION200 (Productos) ──────────────────────────────────
  { id: 'boletines', label: 'Boletines', icon: Mail },
  { id: 'reportes', label: 'Reportes', icon: FileBarChart },
  { id: 'productos', label: 'Productos', icon: Package },
  { id: 'estrategia', label: 'Estrategia', icon: Rocket },

  // ── GESTION COMERCIAL ─────────────────────────────────────
  { id: 'clientes', label: 'Clientes', icon: UserCircle },
  { id: 'contratos', label: 'Contratos', icon: FileCheck },
  { id: 'suscriptores', label: 'Suscriptores', icon: Users },

  // ── CONFIGURACION ─────────────────────────────────────────
  { id: 'medios', label: 'Fuentes (Medios)', icon: RadioTower },
  { id: 'clasificadores', label: 'Ejes y Temas', icon: Tag },
  { id: 'generadores', label: 'Generadores', icon: Zap },
  { id: 'auditoria', label: 'Auditoria de Fuentes', icon: Shield },
  { id: 'captura', label: 'Captura', icon: Database },
  { id: 'jobs', label: 'Sistema de Jobs', icon: Activity },
  { id: 'configuracion', label: 'Configuracion', icon: Settings },
];

// ─── Grupo labels para headers de seccion ──────────────────────

export interface NavGroup {
  id: string;
  label: string;
  /** indices en NAV_ITEMS que pertenecen a este grupo */
  from: number;
  to: number;
  /** optional icon for the group header */
  icon?: LucideIcon;
  /** optional accent color for highlighted groups */
  color?: string;
  /** whether this group is a major section (more prominent) */
  prominent?: boolean;
}

export const NAV_GROUPS: NavGroup[] = [
  { id: 'analisis', label: 'Analisis', from: 0, to: 3 },
  { id: 'onion200', label: 'ONION200', from: 4, to: 7, icon: Rocket, color: '#8B5CF6', prominent: true },
  { id: 'comercial', label: 'Gestion Comercial', from: 8, to: 10, icon: UserCircle, color: '#F59E0B', prominent: true },
  { id: 'config', label: 'Configuracion', from: 11, to: 17, icon: Settings, color: '#0EA5E9', prominent: true },
];

// ─── Helper: obtener label de cualquier item (incluyendo children) ──

export function getNavLabel(viewId: string): string {
  for (const item of NAV_ITEMS) {
    if (item.id === viewId) return item.label;
    if (item.children) {
      const child = item.children.find(c => c.id === viewId);
      if (child) return `${item.label} / ${child.label}`;
    }
  }
  return 'Centro de Comando';
}

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
  { tipo: 'EL_TERMOMETRO', nombre: 'El Termometro', icon: Thermometer, color: '#3B82F6', categoria: 'premium', estado: 'operativo' },
  { tipo: 'SALDO_DEL_DIA', nombre: 'Saldo del Dia', icon: Scale, color: '#8B5CF6', categoria: 'premium', estado: 'operativo' },
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
