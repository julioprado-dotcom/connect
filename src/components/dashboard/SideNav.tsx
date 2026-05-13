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
}

interface SideNavProps {
  activeView?: string;
  onNavigate?: (viewId: string) => void;
}

// ─── Navigation items ─────────────────────────────────────

const NAV_ENTRIES: NavEntry[] = [
  { id: 'resumen',          icon: Home,     tooltip: 'Inicio' },
  { id: 'captura',          icon: Radio,    tooltip: 'Captura' },
  { id: 'clasificacion',    icon: Tags,     tooltip: 'Clasificacion' },
  { id: 'produccion',       icon: FileText, tooltip: 'Produccion' },
  { id: 'distribucion',     icon: Send,     tooltip: 'Distribucion' },
  { id: 'configuracion',    icon: Settings, tooltip: 'Configuracion' },
];

// ═══════════════════════════════════════════════════════════
// Custom Tooltip (no library)
// ═══════════════════════════════════════════════════════════

function SideTooltip({ text, visible }: { text: string; visible: boolean }) {
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
            backgroundColor: '#12121a',
            border: '1px solid #1a1a2e',
            color: '#e5e7eb',
            fontSize: '11px',
            fontFamily: "'Geist Sans', sans-serif",
            fontWeight: 500,
            letterSpacing: '0.02em',
          }}
        >
          {text}
          {/* Tooltip arrow */}
          <div
            className="absolute right-full top-1/2 -translate-y-1/2"
            style={{
              width: 0,
              height: 0,
              borderTop: '5px solid transparent',
              borderBottom: '5px solid transparent',
              borderRight: '5px solid #1a1a2e',
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
      className="flex flex-col items-center justify-between py-4 shrink-0"
      style={{ width: 60, backgroundColor: 'transparent' }}
    >
      {/* ── Top: Navigation icons ── */}
      <div className="flex flex-col items-center gap-2 pt-3">
        {NAV_ENTRIES.map((entry) => {
          const isActive = activeView === entry.id;
          const Icon = entry.icon;
          const isHovered = hoveredId === entry.id;

          return (
            <div key={entry.id} className="relative">
              {/* Tooltip */}
              <SideTooltip text={entry.tooltip} visible={isHovered} />

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
                  width: 40,
                  height: 40,
                  backgroundColor: isActive ? '#12121a' : 'transparent',
                  color: isActive ? '#00ff88' : isHovered ? '#9ca3af' : '#6b7280',
                  boxShadow: isActive
                    ? '0 0 12px rgba(0, 255, 136, 0.15), inset 0 0 8px rgba(0, 255, 136, 0.05)'
                    : 'none',
                  border: isActive ? '1px solid rgba(0, 255, 136, 0.25)' : '1px solid transparent',
                }}
                aria-label={entry.tooltip}
                title={undefined} // prevent native tooltip
              >
                <Icon
                  size={20}
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
                      backgroundColor: '#00ff88',
                      boxShadow: '0 0 6px rgba(0, 255, 136, 0.6)',
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
      <div className="flex items-center justify-center">
        <div
          className="flex items-center justify-center rounded-md overflow-hidden"
          style={{
            width: 24,
            height: 24,
            backgroundColor: '#0F2027',
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
    </nav>
  );
}

export default SideNav;
