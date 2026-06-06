/**
 * theme-utils.ts — Shared theme color system for ONION200 components
 *
 * Provides consistent dark/light colors for PanelShell, IndicatorCard,
 * ClasificacionView, InteligenciaView, and other dashboard sub-components.
 *
 * Usage:
 *   import { usePanelColors } from '@/lib/theme-utils';
 *   const pc = usePanelColors();
 *   <div style={{ background: pc.panelBg, border: `1px solid ${pc.border}` }}>
 */

import { useTheme } from '@/components/theme-provider';

// ─── Types ──────────────────────────────────────────────────────

export interface PanelColors {
  // Backgrounds
  panelBg: string;
  panelBgSubtle: string;
  panelBgHover: string;
  headerBg: string;

  // Borders
  border: string;
  borderSubtle: string;
  borderAccent: string;
  borderLight: string;

  // Text
  text: string;
  textMuted: string;
  textFaint: string;
  textLabel: string;

  // Status colors
  cyan: string;
  cyanGlow: string;
  emerald: string;
  amber: string;
  violet: string;
  red: string;

  // Shadows
  glow: string;
  glowSubtle: string;

  // Scan lines
  scanLine: string;

  // Card backgrounds (for InteligenciaView etc.)
  cardBg: string;

  // Log container
  logBg: string;
}

// ─── Light palette ──────────────────────────────────────────────

const LIGHT_PANEL: PanelColors = {
  panelBg: 'rgba(255, 255, 255, 0.95)',
  panelBgSubtle: 'rgba(244, 248, 252, 0.8)',
  panelBgHover: 'rgba(6, 182, 212, 0.06)',
  headerBg: 'transparent',

  border: 'rgba(6, 182, 212, 0.18)',
  borderSubtle: 'rgba(6, 182, 212, 0.1)',
  borderAccent: 'rgba(6, 182, 212, 0.25)',
  borderLight: 'rgba(100, 116, 139, 0.12)',

  text: '#1e293b',
  textMuted: '#64748b',
  textFaint: '#94a3b8',
  textLabel: '#64748b',

  cyan: '#0891b2',
  cyanGlow: 'rgba(6, 182, 212, 0.12)',
  emerald: '#059669',
  amber: '#d97706',
  violet: '#7c3aed',
  red: '#dc2626',

  glow: '0 0 20px rgba(6, 182, 212, 0.08)',
  glowSubtle: '0 0 12px rgba(6, 182, 212, 0.04)',

  scanLine:
    'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(6,182,212,0.015) 2px, rgba(6,182,212,0.015) 4px)',

  cardBg: 'rgba(255, 255, 255, 0.9)',
  logBg: 'rgba(241, 245, 249, 0.9)',
};

// ─── Dark palette (sci-fi tactical) ────────────────────────────

const DARK_PANEL: PanelColors = {
  panelBg: 'rgba(5, 5, 5, 0.8)',
  panelBgSubtle: 'rgba(5, 5, 5, 0.6)',
  panelBgHover: 'rgba(6, 182, 212, 0.06)',
  headerBg: 'transparent',

  border: 'rgba(6, 182, 212, 0.12)',
  borderSubtle: 'rgba(6, 182, 212, 0.08)',
  borderAccent: 'rgba(6, 182, 212, 0.2)',
  borderLight: 'rgba(100, 116, 139, 0.08)',

  text: '#e2e8f0',
  textMuted: '#94a3b8',
  textFaint: '#475569',
  textLabel: '#64748b',

  cyan: '#06b6d4',
  cyanGlow: 'rgba(6, 182, 212, 0.06)',
  emerald: '#10b981',
  amber: '#f59e0b',
  violet: '#a78bfa',
  red: '#ef4444',

  glow: '0 0 20px rgba(6, 182, 212, 0.04), inset 0 1px 0 rgba(6, 182, 212, 0.06)',
  glowSubtle: '0 0 12px rgba(6, 182, 212, 0.04)',

  scanLine:
    'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(6,182,212,0.008) 2px, rgba(6,182,212,0.008) 4px)',

  cardBg: 'rgba(5, 5, 5, 0.9)',
  logBg: 'rgba(0, 0, 0, 0.4)',
};

// ─── Hook ───────────────────────────────────────────────────────

export function usePanelColors(): PanelColors {
  const { theme } = useTheme();
  return theme === 'dark' ? DARK_PANEL : LIGHT_PANEL;
}

// ─── Value formatting ──────────────────────────────────────────

/**
 * Ensures a space between numeric value and unit text.
 * "3.25682Bs/UFV" → "3.25682 Bs/UFV"
 * "7.12 Bs/USD" → "7.12 Bs/USD" (no change)
 * "1,234 USD" → "1,234 USD" (no change)
 */
export function formatIndicatorValue(val: string): string {
  if (!val || val === '---' || val === 'N/D') return val;
  // Insert space between digit(s) and letter(s): "3.25682Bs" → "3.25682 Bs"
  return val.replace(/([0-9.,]+)([A-Za-z/])/g, '$1 $2');
}
