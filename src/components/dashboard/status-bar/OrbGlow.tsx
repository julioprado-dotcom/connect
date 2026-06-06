'use client';

import React from 'react';
import { motion } from 'framer-motion';

// ═══════════════════════════════════════════════════════════
// OrbGlow — Glassmorphism orb with status glow
// ═══════════════════════════════════════════════════════════

export type OrbStatus = 'ok' | 'warning' | 'error';

export interface OrbGlowProps {
  status: OrbStatus;
  size?: number;        // diameter in px (default 32)
  label?: string;
  value?: string | number;
  onClick?: () => void;
  pulseError?: boolean;  // pulsating red glow if true
}

const STATUS_COLORS: Record<OrbStatus, { glow: string; border: string; bg: string }> = {
  ok: {
    glow: 'rgba(0, 255, 136, 0.35)',
    border: 'rgba(0, 255, 136, 0.25)',
    bg: 'rgba(0, 255, 136, 0.08)',
  },
  warning: {
    glow: 'rgba(255, 170, 0, 0.35)',
    border: 'rgba(255, 170, 0, 0.25)',
    bg: 'rgba(255, 170, 0, 0.08)',
  },
  error: {
    glow: 'rgba(255, 51, 85, 0.4)',
    border: 'rgba(255, 51, 85, 0.3)',
    bg: 'rgba(255, 51, 85, 0.1)',
  },
};

const CORE_COLORS: Record<OrbStatus, string> = {
  ok: '#00ff88',
  warning: '#ffaa00',
  error: '#ff3355',
};

// Pulsating animations
const pulseNormal = {
  animate: {
    scale: [1, 1.08, 1],
    opacity: [0.6, 0.85, 0.6],
  },
  transition: {
    duration: 2.5,
    repeat: Infinity,
    ease: 'easeInOut' as const,
  },
};

const errorPulse = {
  animate: {
    scale: [1, 1.2, 1],
    opacity: [0.5, 0.95, 0.5],
  },
  transition: {
    duration: 1.2,
    repeat: Infinity,
    ease: 'easeInOut' as const,
  },
};

export function OrbGlow({
  status,
  size = 32,
  label,
  value,
  onClick,
  pulseError = false,
}: OrbGlowProps) {
  const colors = STATUS_COLORS[status];
  const coreColor = CORE_COLORS[status];
  const coreSize = size * 0.6;

  return (
    <div
      className="flex flex-col items-center gap-1"
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined}
    >
      {/* Label above */}
      {label && (
        <span className="text-[11px] font-medium text-gray-400 whitespace-nowrap leading-none">
          {label}
        </span>
      )}

      {/* Orb */}
      <div
        className="relative flex items-center justify-center cursor-pointer"
        style={{ width: size, height: size }}
      >
        {/* Outer glow (pulsating) */}
        <motion.div
          className="absolute rounded-full"
          style={{
            width: size,
            height: size,
            background: `radial-gradient(circle, ${colors.glow} 0%, transparent 70%)`,
            filter: `blur(${size * 0.15}px)`,
          }}
          animate={pulseError && status === 'error' ? errorPulse.animate : pulseNormal.animate}
          transition={pulseError && status === 'error' ? errorPulse.transition : pulseNormal.transition}
        />

        {/* Glassmorphism sphere */}
        <motion.div
          className="relative rounded-full"
          style={{
            width: coreSize,
            height: coreSize,
            background: `radial-gradient(circle at 35% 35%, ${coreColor}44, ${coreColor}18 60%, ${coreColor}08)`,
            border: `1px solid ${colors.border}`,
            boxShadow: `0 0 ${size * 0.3}px ${colors.glow}, inset 0 0 ${size * 0.15}px ${colors.bg}`,
            backdropFilter: 'blur(8px)',
          }}
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        />

        {/* Inner highlight */}
        <div
          className="absolute rounded-full pointer-events-none"
          style={{
            width: coreSize * 0.35,
            height: coreSize * 0.35,
            top: coreSize * 0.12,
            left: coreSize * 0.18,
            background: `radial-gradient(circle, rgba(255,255,255,0.25), transparent)`,
          }}
        />
      </div>

      {/* Value below */}
      {value !== undefined && (
        <span
          className="text-[18px] font-bold text-white leading-none"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          {typeof value === 'number' ? value.toLocaleString('es-BO') : value}
        </span>
      )}
    </div>
  );
}
