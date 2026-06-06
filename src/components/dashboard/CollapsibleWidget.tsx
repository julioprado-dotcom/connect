'use client';

import React, { useState, useEffect, useCallback, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronDown, ChevronRight, ArrowRight, Loader2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────

type WidgetStatus = 'ok' | 'warn' | 'error' | 'idle' | 'loading';

interface CollapsibleWidgetProps {
  /** Unique widget id — used for localStorage key and sidebar nav matching */
  id: string;
  /** Widget display title */
  title: string;
  /** Lucide icon component */
  icon: LucideIcon;
  /** Semantic status for color dot and border glow */
  status?: WidgetStatus;
  /** Primary KPI number/badge shown in collapsed state */
  badge?: string | number;
  /** Label for the badge (e.g. "entregas", "alertas") */
  badgeLabel?: string;
  /** Sidebar view id to navigate to on "Ver completo" */
  targetView?: string;
  /** Navigation handler — receives targetView */
  onNavigate?: (viewId: string) => void;
  /** Expanded content (chart, list, sparklines, etc.) */
  children: ReactNode;
  /** Additional CSS classes */
  className?: string;
  /** Quick action buttons shown in expanded mode */
  actions?: ReactNode;
  /**
   * Render mode:
   * - 'card' (default): wraps everything in a Card with inner bordered content area.
   *   - 'section': no outer Card — child renders its own Card. Provides header + animation + actions only.
   */
  mode?: 'card' | 'section';
}

// ─── Status color mapping ────────────────────────────────────

const STATUS_COLORS: Record<WidgetStatus, { dot: string; glow: string; ring: string; text: string }> = {
  ok: {
    dot: 'bg-emerald-500',
    glow: 'shadow-emerald-500/20',
    ring: 'ring-emerald-500/30',
    text: 'text-emerald-400',
  },
  warn: {
    dot: 'bg-amber-500',
    glow: 'shadow-amber-500/25',
    ring: 'ring-amber-500/30',
    text: 'text-amber-400',
  },
  error: {
    dot: 'bg-red-500',
    glow: 'shadow-red-500/25',
    ring: 'ring-red-500/30',
    text: 'text-red-400',
  },
  idle: {
    dot: 'bg-slate-500',
    glow: 'shadow-slate-500/10',
    ring: 'ring-slate-500/20',
    text: 'text-slate-400',
  },
  loading: {
    dot: 'bg-blue-500',
    glow: 'shadow-blue-500/20',
    ring: 'ring-blue-500/30',
    text: 'text-blue-400',
  },
};

// ─── Animation variants ──────────────────────────────────────

const easeOutQuart: [number, number, number, number] = [0.4, 0, 0.2, 1];

const contentVariants = {
  collapsed: {
    height: 0,
    opacity: 0,
    transition: {
      height: { duration: 0.25, ease: easeOutQuart },
      opacity: { duration: 0.15, delay: 0.05 },
    },
  },
  expanded: {
    height: 'auto',
    opacity: 1,
    transition: {
      height: { duration: 0.3, ease: easeOutQuart },
      opacity: { duration: 0.2, delay: 0.1 },
    },
  },
};

// ─── Skeleton pulse for loading badge ────────────────────────

function BadgeSkeleton() {
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-4 w-16 rounded bg-muted animate-pulse" />
      <div className="h-2.5 w-8 rounded bg-muted/60 animate-pulse" />
    </div>
  );
}

// ─── Status Dot ──────────────────────────────────────────────

function StatusDot({ status }: { status: WidgetStatus }) {
  const colors = STATUS_COLORS[status];
  const needsPulse = status === 'warn' || status === 'error';
  const isLoading = status === 'loading';

  if (isLoading) {
    return (
      <span className="relative flex h-2.5 w-2.5 shrink-0">
        <span className={cn('absolute inset-0 rounded-full bg-blue-500/40 animate-ping')} />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-blue-500" />
      </span>
    );
  }

  return (
    <span className="relative flex h-2.5 w-2.5 shrink-0">
      {needsPulse && (
        <span
          className={cn(
            'absolute inset-0 rounded-full animate-ping',
            status === 'error' ? 'bg-red-400/30' : 'bg-amber-400/30',
          )}
        />
      )}
      <span className={cn('relative inline-flex h-2.5 w-2.5 rounded-full', colors.dot)} />
    </span>
  );
}

// ─── Component ───────────────────────────────────────────────

export function CollapsibleWidget({
  id,
  title,
  icon: Icon,
  status = 'idle',
  badge,
  badgeLabel,
  targetView,
  onNavigate,
  children,
  className,
  actions,
  mode = 'card',
}: CollapsibleWidgetProps) {
  // ─── State ──────────────────────────────────────────────
  const STORAGE_KEY = `widget-collapsed-${id}`;

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored === 'true';
    } catch {
      return false;
    }
  });

  // Persist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(collapsed));
    } catch {
      // localStorage unavailable (private browsing, etc.)
    }
  }, [collapsed, STORAGE_KEY]);

  const toggle = useCallback(() => setCollapsed((prev) => !prev), []);

  const handleNavigate = useCallback(() => {
    if (targetView && onNavigate) {
      onNavigate(targetView);
    }
  }, [targetView, onNavigate]);

  // ─── Derived colors ─────────────────────────────────────
  const colors = STATUS_COLORS[status];
  const hasBadge = badge !== undefined && badge !== null;

  // ─── Shared: header row (both modes) ──────────────────
  const headerRow = (
    <button
      type="button"
      onClick={toggle}
      className={cn(
        'flex items-center w-full gap-2.5 px-3 py-2 text-left',
        'hover:bg-muted/30 transition-colors duration-150 cursor-pointer',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
        collapsed ? 'min-h-[40px]' : 'min-h-[44px]',
      )}
      aria-expanded={!collapsed}
      aria-controls={`widget-content-${id}`}
    >
      {/* Icon */}
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />

      {/* Title */}
      <span className="text-xs font-medium text-foreground truncate">
        {title}
      </span>

      {/* Spacer */}
      <span className="flex-1" />

      {/* Badge or skeleton */}
      <span className="flex items-center gap-1.5 shrink-0">
        {hasBadge ? (
          <>
            <span className={cn('text-xs font-semibold tabular-nums', colors.text)}>
              {badge}
            </span>
            {badgeLabel && (
              <span className="text-[10px] text-muted-foreground hidden sm:inline">
                {badgeLabel}
              </span>
            )}
          </>
        ) : (
          <BadgeSkeleton />
        )}
      </span>

      {/* Status dot */}
      <StatusDot status={status} />

      {/* Chevron */}
      <motion.span
        animate={{ rotate: collapsed ? 0 : 90 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="shrink-0 text-muted-foreground"
      >
        <ChevronRight className="h-3.5 w-3.5" />
      </motion.span>
    </button>
  );

  // ─── Shared: action bar ──────────────────────────────────
  const actionBar = (targetView && onNavigate || actions) ? (
    <div className="flex items-center justify-between px-4 pb-3 pt-1 gap-2">
      <div className="flex items-center gap-1.5">{actions}</div>
      {targetView && onNavigate && (
        <button
          type="button"
          onClick={handleNavigate}
          className={cn(
            'inline-flex items-center gap-1 text-[11px] font-medium',
            'text-muted-foreground hover:text-foreground',
            'transition-colors duration-150 cursor-pointer',
            'focus-visible:outline-none focus-visible:underline',
            'group/view',
          )}
        >
          Ver completo
          <ArrowRight className="h-3 w-3 transition-transform duration-150 group-hover/view:translate-x-0.5" />
        </button>
      )}
    </div>
  ) : null;

  // ─── Section mode: no Card wrapper, child has its own Card ──
  if (mode === 'section') {
    return (
      <div
        className={cn(
          'transition-all duration-300',
          collapsed ? cn('shadow-sm', colors.glow, 'rounded-lg ring-1', colors.ring) : 'rounded-lg',
          !collapsed && 'hover:' + colors.glow,
          className,
        )}
        data-widget-id={id}
        data-widget-status={status}
      >
        {/* Header */}
        {headerRow}

        {/* Expanded content — no CardContent wrapper, child renders its own Card */}
        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.div
              id={`widget-content-${id}`}
              variants={contentVariants}
              initial="collapsed"
              animate="expanded"
              exit="collapsed"
              className="overflow-hidden"
            >
              {children}
              {actionBar}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ─── Card mode (default): full Card wrapper with inner content area ──
  return (
    <Card
      className={cn(
        'overflow-hidden transition-shadow duration-300',
        'hover:shadow-md',
        collapsed
          ? cn('shadow-sm', colors.glow, colors.ring, 'ring-1')
          : 'ring-1 ring-foreground/10',
        !collapsed && 'hover:' + colors.glow,
        className,
      )}
      data-widget-id={id}
      data-widget-status={status}
    >
      {/* Header */}
      {headerRow}

      {/* Expanded content */}
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            id={`widget-content-${id}`}
            variants={contentVariants}
            initial="collapsed"
            animate="expanded"
            exit="collapsed"
            className="overflow-hidden"
          >
            <CardContent className="pt-0 pb-2">
              <div className="rounded-lg bg-muted/20 border border-border/50 p-3 min-h-[120px]">
                {children}
              </div>
            </CardContent>

            {actionBar}
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

export type { CollapsibleWidgetProps, WidgetStatus };
