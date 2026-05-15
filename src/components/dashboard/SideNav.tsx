'use client';

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Home,
  Radio,
  Tags,
  FileText,
  Send,
  Settings,
  Crosshair,
  type LucideIcon,
} from 'lucide-react';
import Image from 'next/image';

// ═══════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════

interface NavEntry {
  id: string;
  icon: LucideIcon;
  tooltip: string;
  /** Optional: use a special accent color instead of default green */
  accentColor?: string;
}

interface SideNavProps {
  activeView?: string;
  onNavigate?: (viewId: string) => void;
}

// ─── Tactical Theme ──────────────────────────────────────────

const T = {
  bg: '#080c14',
  border: '#1a2744',
  accent: '#00ff88',
  accentCyan: '#06b6d4',
  accentRed: '#ff3355',
  accentAmber: '#ffaa00',
  textMuted: '#334155',
  textSecondary: '#64748b',
};

// ─── Navigation items ─────────────────────────────────────

const NAV_ENTRIES: NavEntry[] = [
  { id: 'resumen',          icon: Home,       tooltip: 'Inicio' },
  { id: 'alertas',          icon: Crosshair,  tooltip: 'Alertas',       accentColor: T.accentAmber },
  { id: 'captura',          icon: Radio,      tooltip: 'Captura' },
  { id: 'clasificacion',    icon: Tags,       tooltip: 'Clasificacion' },
  { id: 'produccion',       icon: FileText,   tooltip: 'Produccion' },
  { id: 'distribucion',     icon: Send,       tooltip: 'Distribucion' },
  { id: 'configuracion',    icon: Settings,   tooltip: 'Configuracion' },
];

// ═══════════════════════════════════════════════════════════
// Custom Tooltip (no library)
// ═══════════════════════════════════════════════════════════

function SideTooltip({ text, visible, accentColor }: { text: string; visible: boolean; accentColor?: string }) {
  const color = accentColor || T.accent;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -6 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          className="absolute left-full ml-2.5 top-1/2 -translate-y-1/2 z-50
                     px-2.5 py-1 rounded-md whitespace-nowrap
                     pointer-events-none select-none"
          style={{
            backgroundColor: '#0d1321',
            border: `1px solid ${color}30`,
            color: '#e2e8f0',
            fontSize: '10px',
            fontFamily: "'JetBrains Mono', monospace",
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            boxShadow: `0 0 10px ${color}15`,
          }}
        >
          {text}
          {/* Tooltip arrow */}
          <div
            className="absolute right-full top-1/2 -translate-y-1/2"
            style={{
              width: 0,
              height: 0,
              borderTop: '4px solid transparent',
              borderBottom: '4px solid transparent',
              borderRight: `4px solid ${color}30`,
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ═══════════════════════════════════════════════════════════
// SideNav Component
// ═══════════════════════════════════════════════════════════

export function SideNav({ activeView = 'resumen', onNavigate }: SideNavProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const handleClick = useCallback(
    (viewId: string) => {
      onNavigate?.(viewId);
    },
    [onNavigate],
  );

  return (
    <nav
      className="relative flex flex-col items-center justify-between py-3 shrink-0"
      style={{
        width: 60,
        backgroundColor: T.bg,
        borderRight: `1px solid ${T.border}`,
      }}
    >
      {/* ── Top scan line ── */}
      <div
        className="absolute top-0 left-0 right-0 h-[1px]"
        style={{
          background: `linear-gradient(180deg, ${T.accentCyan}20, transparent)`,
        }}
      />

      {/* ── Top: Navigation icons ── */}
      <div className="flex flex-col items-center gap-1.5 pt-2">
        {NAV_ENTRIES.map((entry) => {
          const isActive = activeView === entry.id;
          const Icon = entry.icon;
          const isHovered = hoveredId === entry.id;
          const accent = entry.accentColor || T.accent;

          return (
            <div key={entry.id} className="relative">
              {/* Tooltip */}
              <SideTooltip text={entry.tooltip} visible={isHovered} accentColor={accent} />

              {/* Icon button */}
              <button
                onClick={() => handleClick(entry.id)}
                onMouseEnter={() => setHoveredId(entry.id)}
                onMouseLeave={() => setHoveredId(null)}
                onFocus={() => setHoveredId(entry.id)}
                onBlur={() => setHoveredId(null)}
                className="relative flex items-center justify-center rounded-lg
                           transition-all duration-200 outline-none
                           focus-visible:ring-1 focus-visible:ring-[#00ff88]/50"
                style={{
                  width: 38,
                  height: 38,
                  backgroundColor: isActive ? `${accent}12` : 'transparent',
                  color: isActive ? accent : isHovered ? T.textSecondary : T.textMuted,
                  boxShadow: isActive
                    ? `0 0 15px ${accent}20, inset 0 0 10px ${accent}08, 0 0 1px ${accent}40`
                    : 'none',
                  border: isActive ? `1px solid ${accent}35` : '1px solid transparent',
                }}
                aria-label={entry.tooltip}
                title={undefined} // prevent native tooltip
              >
                <Icon
                  size={18}
                  strokeWidth={isActive ? 2 : 1.5}
                  className="transition-all duration-200"
                />

                {/* Active glow dot at bottom */}
                {isActive && (
                  <motion.div
                    layoutId="sideNavActiveDot"
                    className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 rounded-full"
                    style={{
                      width: 4,
                      height: 4,
                      backgroundColor: accent,
                      boxShadow: `0 0 8px ${accent}`,
                    }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* ── Bottom: DECODEX logo ── */}
      <div className="flex flex-col items-center gap-2 pb-2">
        {/* Separator line */}
        <div
          className="w-6 h-[1px]"
          style={{
            background: `linear-gradient(90deg, transparent, ${T.accentCyan}30, transparent)`,
          }}
        />
        <div
          className="flex items-center justify-center rounded-md overflow-hidden"
          style={{
            width: 24,
            height: 24,
            backgroundColor: '#0F2027',
            border: `1px solid ${T.border}`,
          }}
        >
          <Image
            src="/logo.png"
            alt="DECODEX"
            width={24}
            height={24}
            className="object-cover"
          />
        </div>
      </div>

      {/* ── Right edge glow ── */}
      <div
        className="absolute top-0 bottom-0 -right-px w-[1px]"
        style={{
          background: `linear-gradient(180deg, transparent 10%, ${T.accentCyan}15 50%, transparent 90%)`,
        }}
      />
    </nav>
  );
}

export default SideNav;
