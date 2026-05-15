'use client';

import React, { type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Crosshair } from 'lucide-react';

// ─── Tactical Theme ────────────────────────────────────────────

const T = {
  bg: '#0a0e17',
  panelBg: '#0d1321',
  headerBg: '#0f1629',
  border: '#1a2744',
  borderGlow: '#0ea5e9',
  accent: '#00ff88',
  accentCyan: '#06b6d4',
  textPrimary: '#e2e8f0',
  textMuted: '#64748b',
  scanLine: 'rgba(6, 182, 212, 0.02)',
};

// ─── Types ────────────────────────────────────────────────────

interface PanelShellProps {
  title: string;
  icon: ReactNode;
  onClose?: () => void;
  children: ReactNode;
  className?: string;
}

// ─── Animation ────────────────────────────────────────────────

const panelVariants = {
  hidden: {
    opacity: 0,
    y: -12,
    transition: { duration: 0.2, ease: 'easeIn' },
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: { duration: 0.15, ease: 'easeIn' },
  },
};

// ─── Component ────────────────────────────────────────────────

export function PanelShell({ title, icon, onClose, children, className }: PanelShellProps) {
  return (
    <AnimatePresence>
      <motion.div
        variants={panelVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        className={`rounded-xl overflow-hidden relative ${className || ''}`}
        style={{
          background: T.bg,
          border: `1px solid ${T.border}`,
          boxShadow: `0 0 20px rgba(6, 182, 212, 0.05), inset 0 0 20px rgba(6, 182, 212, 0.02)`,
        }}
      >
        {/* ── Scan lines overlay ── */}
        <div
          className="absolute inset-0 pointer-events-none z-0"
          style={{
            background: `repeating-linear-gradient(
              0deg,
              transparent,
              transparent 3px,
              ${T.scanLine} 3px,
              ${T.scanLine} 4px
            )`,
          }}
        />

        {/* ── Top glow line ── */}
        <div
          className="absolute top-0 left-0 right-0 h-[1px] z-10"
          style={{
            background: `linear-gradient(90deg, transparent, ${T.accentCyan}40, ${T.borderGlow}60, ${T.accentCyan}40, transparent)`,
          }}
        />

        {/* ── Header ──────────────────────────────────────── */}
        <div
          className="relative z-10 flex items-center gap-2.5 px-4 py-3"
          style={{
            background: `linear-gradient(180deg, ${T.headerBg} 0%, transparent 100%)`,
            borderBottom: `1px solid ${T.border}`,
          }}
        >
          <span style={{ color: T.accentCyan }}>{icon}</span>
          <h2
            className="text-sm font-bold uppercase tracking-widest flex-1"
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              color: T.textPrimary,
            }}
          >
            {title}
          </h2>

          {/* Tactical corner marks */}
          <div className="hidden sm:block absolute top-1.5 right-12 w-3 h-3" style={{ borderTop: `1px solid ${T.accentCyan}30`, borderRight: `1px solid ${T.accentCyan}30` }} />
          <div className="hidden sm:block absolute bottom-1.5 right-12 w-3 h-3" style={{ borderBottom: `1px solid ${T.accentCyan}30`, borderRight: `1px solid ${T.accentCyan}30` }} />

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="relative z-20 flex items-center justify-center rounded-md transition-all duration-200 hover:bg-white/5"
              style={{ color: T.textMuted, width: 24, height: 24, border: '1px solid transparent' }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = T.accent;
                (e.currentTarget as HTMLButtonElement).style.borderColor = `${T.accent}40`;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = T.textMuted;
                (e.currentTarget as HTMLButtonElement).style.borderColor = 'transparent';
              }}
              aria-label="Cerrar panel"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* ── Body (scrollable) ────────────────────────────── */}
        <div
          className="relative z-10 overflow-y-auto"
          style={{
            maxHeight: 'calc(100vh - 240px)',
            minHeight: 320,
          }}
        >
          {children}
        </div>

        {/* ── Bottom glow line ── */}
        <div
          className="absolute bottom-0 left-0 right-0 h-[1px] z-10"
          style={{
            background: `linear-gradient(90deg, transparent, ${T.border}, transparent)`,
          }}
        />
      </motion.div>
    </AnimatePresence>
  );
}
