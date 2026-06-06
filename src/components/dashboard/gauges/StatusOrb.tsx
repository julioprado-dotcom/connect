'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

// ─── Types ──────────────────────────────────────────────────

export type StatusLevel = 'ok' | 'warning' | 'danger' | 'critical';

export interface StatusOrbProps {
  level: StatusLevel;
  icon?: React.ReactNode;
  label: string;
  value?: string;
  detail?: string;
  size?: 'sm' | 'md' | 'lg';
  horizontal?: boolean;
  onClick?: () => void;
}

// ─── Color maps ─────────────────────────────────────────────

const LEVEL_COLORS: Record<StatusLevel, { bg: string; glow: string; text: string; ring: string }> = {
  ok: {
    bg: 'bg-emerald-500',
    glow: 'shadow-[0_0_12px_rgba(34,197,94,0.5)]',
    text: 'text-emerald-500',
    ring: 'ring-emerald-500/30',
  },
  warning: {
    bg: 'bg-amber-500',
    glow: 'shadow-[0_0_12px_rgba(245,158,11,0.5)]',
    text: 'text-amber-500',
    ring: 'ring-amber-500/30',
  },
  danger: {
    bg: 'bg-orange-500',
    glow: 'shadow-[0_0_14px_rgba(249,115,22,0.55)]',
    text: 'text-orange-500',
    ring: 'ring-orange-500/30',
  },
  critical: {
    bg: 'bg-red-500',
    glow: 'shadow-[0_0_16px_rgba(239,68,68,0.6)]',
    text: 'text-red-500',
    ring: 'ring-red-500/30',
  },
};

const PILL_COLORS: Record<StatusLevel, string> = {
  ok: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  warning: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
  danger: 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30',
  critical: 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30',
};

const DOT_COLORS: Record<StatusLevel, string> = {
  ok: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-orange-500',
  critical: 'bg-red-500',
};

const SIZE_MAP = {
  sm: { orb: 20, icon: 10, label: 'text-[9px]', value: 'text-[10px]' },
  md: { orb: 32, icon: 14, label: 'text-[10px]', value: 'text-xs' },
  lg: { orb: 44, icon: 18, label: 'text-xs', value: 'text-sm' },
};

// ─── Pulsating halo animation ───────────────────────────────

const haloPulse = {
  animate: {
    scale: [1, 1.15, 1],
    opacity: [0.5, 0.8, 0.5],
  },
  transition: {
    duration: 2,
    repeat: Infinity,
    ease: 'easeInOut' as const,
  },
};

const criticalPulse = {
  animate: {
    scale: [1, 1.25, 1],
    opacity: [0.6, 1, 0.6],
  },
  transition: {
    duration: 1,
    repeat: Infinity,
    ease: 'easeInOut' as const,
  },
};

// ═══════════════════════════════════════════════════════════
// StatusOrb — Pulsating sphere with halo
// ═══════════════════════════════════════════════════════════

export function StatusOrb({ level, icon, label, value, detail, size = 'md', horizontal, onClick }: StatusOrbProps) {
  const colors = LEVEL_COLORS[level];
  const dim = SIZE_MAP[size];

  return (
    <div
      className={cn(
        'flex items-center gap-2 min-w-0',
        horizontal ? 'flex-row' : 'flex-col',
        onClick ? 'cursor-pointer rounded-lg px-1.5 py-1 -mx-1.5 -my-1 hover:bg-muted/60 transition-colors' : '',
      )}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined}
      title={onClick ? `Ver ${label}` : undefined}
    >
      {/* Orb container */}
      <div className="relative flex items-center justify-center" style={{ width: dim.orb, height: dim.orb }}>
        {/* Outer halo (pulsating) */}
        <motion.div
          className={cn(
            'absolute rounded-full',
            colors.bg,
            level === 'critical' ? 'opacity-60' : 'opacity-40',
          )}
          style={{
            width: dim.orb,
            height: dim.orb,
            filter: `blur(${dim.orb * 0.2}px)`,
          }}
          animate={level === 'critical' ? criticalPulse.animate : haloPulse.animate}
          transition={level === 'critical' ? criticalPulse.transition : haloPulse.transition}
        />

        {/* Core sphere */}
        <motion.div
          className={cn(
            'relative rounded-full flex items-center justify-center',
            colors.bg,
            colors.glow,
            level === 'critical' && 'ring-2 ring-red-400/50',
          )}
          style={{ width: dim.orb * 0.7, height: dim.orb * 0.7 }}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        >
          {/* Icon inside orb */}
          {icon && (
            <span className="text-white drop-shadow-sm" style={{ width: dim.icon, height: dim.icon }}>
              {icon}
            </span>
          )}
        </motion.div>
      </div>

      {/* Value + Label */}
      <div className={cn('leading-tight', horizontal ? 'text-left' : 'text-center')}>
        {value && (
          <span className={cn('font-bold leading-none block', colors.text, dim.value)}>
            {value}
          </span>
        )}
        <span className={cn('text-muted-foreground block', dim.label)}>
          {label}
        </span>
        {detail && (
          <span className="text-[8px] text-muted-foreground/70 block">{detail}</span>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// StatusPill — Compact horizontal indicator
// ═══════════════════════════════════════════════════════════

export interface StatusPillProps {
  level: StatusLevel;
  label: string;
  icon?: React.ReactNode;
  compact?: boolean;
}

export function StatusPill({ level, label, icon, compact }: StatusPillProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border font-medium',
        PILL_COLORS[level],
        compact ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-0.5 text-[10px]',
      )}
    >
      {icon ? (
        icon
      ) : (
        <span className={cn('rounded-full', DOT_COLORS[level], compact ? 'h-1.5 w-1.5' : 'h-2 w-2')} />
      )}
      {label}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════
// StatusBar — Semaphore bar (vertical or horizontal)
// ═══════════════════════════════════════════════════════════

export interface StatusBarProps {
  levels: { label: string; level: StatusLevel }[];
  orientation?: 'horizontal' | 'vertical';
  size?: 'sm' | 'md';
}

export function StatusBar({ levels, orientation = 'horizontal', size = 'sm' }: StatusBarProps) {
  const isH = orientation === 'horizontal';
  return (
    <div className={cn('flex items-center gap-2', isH ? 'flex-row' : 'flex-col')}>
      {levels.map((item) => {
        const dotSize = size === 'sm' ? 'h-2 w-2' : 'h-2.5 w-2.5';
        return (
          <div key={item.label} className={cn('flex items-center gap-1', isH ? 'flex-row' : 'flex-col')}>
            <span className={cn('rounded-full shrink-0', DOT_COLORS[item.level], dotSize)} />
            <span className="text-[9px] text-muted-foreground whitespace-nowrap">{item.label}</span>
          </div>
        );
      })}
    </div>
  );
}
