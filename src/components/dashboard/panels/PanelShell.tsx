'use client';

import React, { type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

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
        className={`rounded-lg overflow-hidden font-mono ${className || ''}`}
        style={{
          background: 'rgba(15,23,42,0.4)',
          border: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        {/* ── Header ──────────────────────────────────────── */}
        <div
          className="flex items-center gap-2.5 px-4 py-3"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}
        >
          <span style={{ color: '#00ff88' }}>{icon}</span>
          <h2
            className="text-sm font-semibold flex-1"
            style={{
              fontFamily: 'Inter, Geist Sans, sans-serif',
              color: '#ffffff',
            }}
          >
            {title}
          </h2>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="flex items-center justify-center rounded-md transition-colors hover:bg-white/5"
              style={{ color: '#64748b', width: 24, height: 24 }}
              aria-label="Cerrar panel"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* ── Body (scrollable) ────────────────────────────── */}
        <div
          className="overflow-y-auto"
          style={{
            maxHeight: 'calc(100vh - 240px)',
            minHeight: 320,
          }}
        >
          {children}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
