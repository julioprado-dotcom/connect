'use client';

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface RadialGaugeProps {
  value: number;        // 0-100 percentage
  label: string;        // e.g. "Memoria"
  valueLabel: string;   // e.g. "128 MB"
  size?: number;        // default 140
  zones?: { from: number; to: number; color: string }[];
  icon?: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

// Semi-circular arc: from -135° to +135° = 270° sweep
const START_ANGLE = -135;
const END_ANGLE = 135;
const SWEEP = END_ANGLE - START_ANGLE; // 270

const DEFAULT_ZONES = [
  { from: 0, to: 60, color: '#22c55e' },   // green
  { from: 60, to: 80, color: '#f59e0b' },   // amber
  { from: 80, to: 100, color: '#ef4444' },  // red
];

export function RadialGauge({
  value,
  label,
  valueLabel,
  size = 140,
  zones = DEFAULT_ZONES,
  icon,
  onClick,
  className,
}: RadialGaugeProps) {
  const clampedValue = Math.min(100, Math.max(0, value));

  const center = size / 2;
  const strokeWidth = Math.max(6, size * 0.07);
  const radius = (size - strokeWidth * 2) / 2 - 2;

  // Circumference for the semi-arc
  const arcLength = (SWEEP / 360) * 2 * Math.PI * radius;

  // Determine color based on value and zones
  const activeColor = useMemo(() => {
    for (const zone of zones) {
      if (clampedValue >= zone.from && clampedValue < zone.to) return zone.color;
    }
    return zones[zones.length - 1]?.color || '#ef4444';
  }, [clampedValue, zones]);

  // Generate arc path (background track)
  const describeArc = (startAngle: number, endAngle: number) => {
    const start = polarToCartesian(center, center, radius, endAngle);
    const end = polarToCartesian(center, center, radius, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? 0 : 1;
    return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
  };

  // Needle angle: map value 0-100 to START_ANGLE..END_ANGLE
  const needleAngle = START_ANGLE + (clampedValue / 100) * SWEEP;

  // Needle endpoint
  const needleLength = radius * 0.7;
  const needleRad = (needleAngle * Math.PI) / 180;
  const needleX = center + needleLength * Math.cos(needleRad);
  const needleY = center + needleLength * Math.sin(needleRad);

  // Zone arcs for coloring
  const zoneArcs = useMemo(() => {
    return zones.map((zone) => {
      const zStart = START_ANGLE + (zone.from / 100) * SWEEP;
      const zEnd = START_ANGLE + (zone.to / 100) * SWEEP;
      return {
        ...zone,
        path: describeArc(zStart, zEnd),
        length: ((zEnd - zStart) / 360) * 2 * Math.PI * radius,
        offset: ((START_ANGLE - zStart + SWEEP) / 360) * 2 * Math.PI * radius,
      };
    });
  }, [zones, radius, describeArc]);

  return (
    <Card
      className={cn(
        'hover:shadow-md hover:ring-1 hover:ring-primary/30 transition-all',
        onClick && 'cursor-pointer',
        className
      )}
      onClick={onClick}
    >
      <CardContent className="p-3 flex flex-col items-center">
        {/* Icon */}
        {icon && (
          <div className="text-muted-foreground mb-1">{icon}</div>
        )}

        {/* SVG Gauge */}
        <svg
          width={size}
          height={size * 0.7}
          viewBox={`0 0 ${size} ${size * 0.7}`}
          className="overflow-visible"
        >
          <defs>
            <filter id={`glow-${label.replace(/\s/g, '')}`}>
              <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Background track */}
          <path
            d={describeArc(START_ANGLE, END_ANGLE)}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            className="text-muted/30"
          />

          {/* Zone color arcs (only up to current value) */}
          {zoneArcs.map((zone, i) => {
            const zoneValue = Math.min(clampedValue, zone.to) - zone.from;
            if (zoneValue <= 0) return null;
            const zoneProgress = Math.min(1, zoneValue / (zone.to - zone.from));
            const dashLength = zone.length * zoneProgress;

            return (
              <motion.path
                key={i}
                d={zone.path}
                fill="none"
                stroke={zone.color}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeDasharray={`${zone.length} ${zone.length}`}
                strokeDashoffset={zone.length - dashLength}
                initial={{ strokeDashoffset: zone.length }}
                animate={{ strokeDashoffset: zone.length - dashLength }}
                transition={{ duration: 1, ease: 'easeOut' }}
                filter={`url(#glow-${label.replace(/\s/g, '')})`}
                style={{ opacity: 0.85 }}
              />
            );
          })}

          {/* Needle */}
          <motion.g
            initial={{ rotate: START_ANGLE }}
            animate={{ rotate: needleAngle }}
            transition={{ duration: 1, ease: 'easeOut', type: 'spring', stiffness: 60, damping: 15 }}
            style={{ transformOrigin: `${center}px ${center}px` }}
          >
            <line
              x1={center}
              y1={center}
              x2={center + needleLength}
              y2={center}
              stroke={activeColor}
              strokeWidth={2}
              strokeLinecap="round"
            />
          </motion.g>

          {/* Pivot circle */}
          <circle
            cx={center}
            cy={center}
            r={strokeWidth * 0.6}
            fill={activeColor}
            className="opacity-90"
          />

          {/* Center readout */}
          <text
            x={center}
            y={center + radius * 0.45}
            textAnchor="middle"
            className="fill-foreground font-bold"
            style={{ fontSize: Math.max(14, size * 0.14) }}
          >
            {Math.round(clampedValue)}%
          </text>
        </svg>

        {/* Value label */}
        <p className="text-xs font-semibold text-foreground mt-1">{valueLabel}</p>

        {/* Label */}
        <p className="text-[10px] text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

function polarToCartesian(
  cx: number,
  cy: number,
  r: number,
  angleDeg: number
): { x: number; y: number } {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}
