'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useTheme } from '@/components/theme-provider';

// ═══════════════════════════════════════════════════════════════
// Theme-aware color sets for sub-pages
// ═══════════════════════════════════════════════════════════════

export interface SubPageColors {
  bg: string;
  headerBg: string;
  headerBorder: string;
  footerBg: string;
  footerBorder: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  logoBg: string;
  logoBorder: string;
  logoColor: string;
  accentColor: string;
  accentBg: string;
  accentBorder: string;
}

const DARK: SubPageColors = {
  bg: '#080c14',
  headerBg: '#0d1321',
  headerBorder: '#1a2744',
  footerBg: '#0d1321',
  footerBorder: '#1a2744',
  text: '#e2e8f0',
  textMuted: '#64748b',
  textSubtle: '#334155',
  logoBg: 'rgba(6, 182, 212, 0.1)',
  logoBorder: 'rgba(6, 182, 212, 0.25)',
  logoColor: '#06b6d4',
  accentColor: '#06b6d4',
  accentBg: 'rgba(6, 182, 212, 0.08)',
  accentBorder: 'rgba(6, 182, 212, 0.15)',
};

const LIGHT: SubPageColors = {
  bg: '#f8fafc',
  headerBg: '#ffffff',
  headerBorder: '#e2e8f0',
  footerBg: '#ffffff',
  footerBorder: '#e2e8f0',
  text: '#1e293b',
  textMuted: '#64748b',
  textSubtle: '#94a3b8',
  logoBg: 'rgba(18, 132, 186, 0.1)',
  logoBorder: 'rgba(18, 132, 186, 0.25)',
  logoColor: '#1284BA',
  accentColor: '#1284BA',
  accentBg: 'rgba(18, 132, 186, 0.08)',
  accentBorder: 'rgba(18, 132, 186, 0.15)',
};

/**
 * Hook that returns theme-aware colors for sub-pages.
 * Import and use in any sub-page that needs theme support.
 */
export function usePageColors(): SubPageColors {
  const { theme } = useTheme();
  return theme === 'dark' ? DARK : LIGHT;
}

// ═══════════════════════════════════════════════════════════════
// Theme-aware sub-page layout shell
// ═══════════════════════════════════════════════════════════════

interface SubPageShellProps {
  title: string;
  subtitle?: string;
  backHref?: string;
  backLabel?: string;
  accentColor?: string; // override accent color (e.g., '#00ff88' for agente)
  children: React.ReactNode;
}

export function SubPageShell({
  title,
  subtitle,
  backHref = '/',
  backLabel = 'Dashboard',
  accentColor,
  children,
}: SubPageShellProps) {
  const colors = usePageColors();
  const accent = accentColor || colors.accentColor;

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: colors.bg }}
    >
      {/* ═══ HEADER ═══ */}
      <header
        className="sticky top-0 z-50 px-4 py-3 flex items-center justify-between"
        style={{
          backgroundColor: colors.headerBg,
          borderBottom: '1px solid ' + colors.headerBorder,
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="h-8 w-8 rounded-lg flex items-center justify-center overflow-hidden"
            style={{
              backgroundColor: accentColor
                ? accentColor + '18'
                : colors.logoBg,
              border: '1px solid ' + (accentColor
                ? accentColor + '30'
                : colors.logoBorder),
            }}
          >
            <Image src="/decodex-logo.png" alt="D" width={24} height={24} className="object-contain" />
          </div>
          <div>
            <p
              className="text-xs font-bold leading-none"
              style={{ color: colors.text }}
            >
              DECODEX BOLIVIA
            </p>
            <p className="text-[9px]" style={{ color: colors.textMuted }}>
              {subtitle || title}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={backHref}
            className="text-[10px] transition-colors flex items-center gap-1"
            style={{ color: colors.textMuted }}
          >
            &larr; {backLabel}
          </Link>
        </div>
      </header>

      {/* ═══ CONTENT ═══ */}
      <main className="flex-1 p-4 max-w-6xl mx-auto w-full">
        {children}
      </main>

      {/* ═══ FOOTER ═══ */}
      <footer
        className="px-4 py-2 text-center"
        style={{
          backgroundColor: colors.footerBg,
          borderTop: '1px solid ' + colors.footerBorder,
        }}
      >
        <p className="text-[10px]" style={{ color: colors.textSubtle }}>
          DECODEX Bolivia &middot; Inteligencia de Señales
        </p>
      </footer>
    </div>
  );
}
