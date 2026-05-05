'use client';

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface MiniGaugeProps {
  value: number;        // 0-100 percentage
  label: string;
  color?: string;       // default based on value (green/amber/red)
  size?: number;        // default 60
}

const COLORS = {
  green: '#22c55e',
  amber: '#f59e0b',
  red: '#ef4444',
};

function getAutoColor(v: number): string {
  if (v < 60) return COLORS.green;
  if (v < 80) return COLORS.amber;
  return COLORS.red;
}

export function MiniGauge({
  value,
  label,
  color,
  size = 60,
}: MiniGaugeProps) {
  const clamped = Math.min(100, Math.max(0, value));
  const activeColor = color || getAutoColor(clamped);

  const strokeWidth = Math.max(4, size * 0.1);
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (clamped / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          {/* Background track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-muted/30"
          />
          {/* Progress arc */}
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={activeColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: dashOffset }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            style={{ opacity: 0.85 }}
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className={cn('font-bold text-foreground')}
            style={{ fontSize: Math.max(10, size * 0.22) }}
          >
            {Math.round(clamped)}%
          </span>
        </div>
      </div>
      <span className="text-[9px] text-muted-foreground leading-tight text-center truncate max-w-[70px]">
        {label}
      </span>
    </div>
  );
}
