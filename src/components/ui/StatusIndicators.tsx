'use client';

import React from 'react';
import { statusColor, statusGlow, statusLabel } from '@/constants/colors';

// ═══════════════════════════════════════════════════════════════
// StatusDot — Punto indicador de estado (semáforo)
// ═══════════════════════════════════════════════════════════════
// REGLA: Usa SIEMPRE una clave de STATUS de @/constants/colors.
// PROHIBIDO: pasar colores inline. Usa normalizeStatus() si tienes
// un string crudo (ej. estado de DB) y no sabes la clave exacta.
//
// Uso:
//   <StatusDot status="ok" />
//   <StatusDot status="en_progreso" glow />
//   <StatusDot status="error" size={12} blink />

interface StatusDotProps {
  /** Clave del semáforo STATUS (ok, running, error, warning, idle, etc.) */
  status: string;
  /** Tamaño del punto en px */
  size?: number;
  /** ¿Mostrar glow/aura alrededor? */
  glow?: boolean;
  /** ¿Parpadeo para estados críticos? */
  blink?: boolean;
  /** ¿Mostrar label al lado? */
  showLabel?: boolean;
  /** Clase CSS adicional */
  className?: string;
}

export function StatusDot({
  status,
  size = 8,
  glow = false,
  blink = false,
  showLabel = false,
  className = '',
}: StatusDotProps) {
  const color = statusColor(status);
  const glowShadow = glow ? statusGlow(status, size) : 'none';
  const label = statusLabel(status);

  // Auto-blink: parpadeo si es error/critico/caida/fallido y blink no fue override a false
  const shouldBlink = blink !== false && ['error', 'failed', 'fallido', 'offline', 'caida', 'critico'].includes(status);

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span
        className="rounded-full shrink-0"
        style={{
          width: size,
          height: size,
          backgroundColor: color,
          boxShadow: glowShadow,
          animation: shouldBlink ? 'pulse 1.5s cubic-bezier(0.4,0,0.6,1) infinite' : undefined,
        }}
      />
      {showLabel && (
        <span
          className="text-[9px] uppercase font-mono"
          style={{ color }}
        >
          {label}
        </span>
      )}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════
// StatusBadge — Badge de estado (semáforo con label)
// ═══════════════════════════════════════════════════════════════
// Reemplaza TODOS los badges inline de estado con ternarios de color.
//
// Uso:
//   <StatusBadge status="completado" />
//   <StatusBadge status="fallido" size="sm" />
//   <StatusBadge status="pending" pulse />

import { statusToken } from '@/constants/colors';

interface StatusBadgeProps {
  /** Clave del semáforo STATUS */
  status: string;
  /** Tamaño: 'sm' (8px font) | 'md' (9px font) | 'lg' (10px font) */
  size?: 'sm' | 'md' | 'lg';
  /** ¿Mostrar dot antes del label? */
  dot?: boolean;
  /** ¿Usar label personalizado en vez del automático? */
  label?: string;
  /** Clase CSS adicional */
  className?: string;
}

const SIZE_MAP = {
  sm: 'text-[8px] px-1.5 py-0.5',
  md: 'text-[9px] px-2 py-0.5',
  lg: 'text-[10px] px-2.5 py-1',
};

const DOT_SIZE_MAP = {
  sm: 5,
  md: 6,
  lg: 7,
};

export function StatusBadge({
  status,
  size = 'md',
  dot = true,
  label: customLabel,
  className = '',
}: StatusBadgeProps) {
  const token = statusToken(status);
  const displayLabel = customLabel || token.label;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded font-mono font-bold uppercase ${SIZE_MAP[size]} ${className}`}
      style={{
        color: token.color,
        backgroundColor: token.bg,
        border: `1px solid ${token.border}`,
      }}
    >
      {dot && (
        <span
          className="rounded-full shrink-0"
          style={{
            width: DOT_SIZE_MAP[size],
            height: DOT_SIZE_MAP[size],
            backgroundColor: token.color,
          }}
        />
      )}
      {displayLabel}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════
// ProgressBar — Barra de progreso con semáforo
// ═══════════════════════════════════════════════════════════════

interface ProgressBarProps {
  /** Porcentaje 0-100 */
  value: number;
  /** Clave de STATUS para color (o calcula automático si omites) */
  status?: string;
  /** Ancho */
  width?: string | number;
  /** Alto en px */
  height?: number;
  /** Clase CSS adicional */
  className?: string;
}

export function ProgressBar({
  value,
  status: forcedStatus,
  width = '100%',
  height = 4,
  className = '',
}: ProgressBarProps) {
  // Calcular status si no se fuerza
  const resolvedStatus = forcedStatus
    || (value >= 85 ? 'error' : value >= 60 ? 'warning' : 'ok');
  const color = statusColor(resolvedStatus);

  return (
    <div
      className={`rounded-full overflow-hidden ${className}`}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height,
        backgroundColor: 'rgba(255,255,255,0.06)',
      }}
    >
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{
          width: `${Math.min(100, Math.max(0, value))}%`,
          backgroundColor: color,
        }}
      />
    </div>
  );
}
