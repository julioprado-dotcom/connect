'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { fetchWithTimeout } from '@/lib/fetch-utils';
import { Cpu, MemoryStick, HardDrive, Clock, Server } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

interface VitalsData {
  timestamp: string;
  cpu: {
    model: string;
    cores: number;
    loadAvg1m: number;
    loadAvg5m: number;
    usagePct: number;
    idlePct: number;
  };
  memory: {
    totalMB: number;
    usedMB: number;
    freeMB: number;
    usagePct: number;
  };
  process: {
    memory: {
      rssMB: number;
      heapUsedMB: number;
      heapTotalMB: number;
    };
    uptime: number;
    uptimeFormatted: string;
    nodeVersion: string;
    pid: number;
  };
  database: {
    sizeMB: number;
    engine: string;
  };
  worker: {
    running: boolean;
    jobsCompleted: number;
    jobsFailed: number;
    jobsPerHour: number;
  };
  scheduler: {
    running: boolean;
    totalTasks: number;
  };
}

interface DataPoint {
  t: number; // timestamp
  v: number; // value 0-100
}

const MAX_POINTS = 60; // 5 minutes of data at 5s intervals
const HEAP_BASELINE_MB = 512; // Fixed baseline for heap % calculation (avoids false 95% alerts)

// ═══════════════════════════════════════════════════════════════
// SVG Sparkline
// ═══════════════════════════════════════════════════════════════

function Sparkline({
  data,
  color,
  label,
  current,
  unit = '%',
  icon,
}: {
  data: DataPoint[];
  color: string;
  label: string;
  current: number;
  unit?: string;
  icon: React.ReactNode;
}) {
  const w = 240;
  const h = 48;
  const padY = 4;

  if (data.length < 2) {
    return (
      <div className="flex items-center gap-3 py-2">
        <span className="text-cyan-500/70">{icon}</span>
        <div className="flex-1">
          <div className="flex items-baseline justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 font-mono">
              {label}
            </span>
            <span className="text-xs font-mono" style={{ color }}>
              Esperando señal...
            </span>
          </div>
          <div className="mt-1 h-[2px] bg-slate-800 rounded" />
        </div>
      </div>
    );
  }

  const minV = 0;
  const maxV = 100;
  const points = data.map((d, i) => {
    const x = (i / (MAX_POINTS - 1)) * w;
    const y = padY + (1 - (d.v - minV) / (maxV - minV)) * (h - padY * 2);
    return `${x},${y}`;
  });

  const areaPath = `M0,${h} L${points.join(' L')} L${w},${h} Z`;
  const linePath = `M${points.join(' L')}`;

  // Gradient fill color based on severity
  const fillColor = current > 85 ? `${color}20` : `${color}10`;
  const glowIntensity = current > 85 ? 15 : current > 60 ? 8 : 4;

  return (
    <div className="flex items-center gap-3 py-2">
      <span className="text-cyan-500/70">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between mb-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 font-mono">
            {label}
          </span>
          <span
            className="text-sm font-bold font-mono tabular-nums"
            style={{ color }}
          >
            {current.toFixed(1)}{unit}
          </span>
        </div>
        <svg
          viewBox={`0 0 ${w} ${h}`}
          className="w-full h-10"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id={`grad-${label}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.3" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          {/* Glow effect */}
          <path
            d={areaPath}
            fill={`url(#grad-${label})`}
            style={{ filter: `drop-shadow(0 0 ${glowIntensity}px ${color}40)` }}
          />
          <path
            d={linePath}
            fill="none"
            stroke={color}
            strokeWidth="1.5"
            strokeLinejoin="round"
            strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 4px ${color}60)` }}
          />
          {/* Current value dot */}
          {data.length > 0 && (
            <circle
              cx={(data.length - 1) / (MAX_POINTS - 1) * w}
              cy={
                padY +
                (1 - (data[data.length - 1].v - minV) / (maxV - minV)) *
                  (h - padY * 2)
              }
              r="3"
              fill={color}
              style={{ filter: `drop-shadow(0 0 6px ${color})` }}
            />
          )}
        </svg>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// VitalMonitor — Main component
// ═══════════════════════════════════════════════════════════════

export function VitalMonitor() {
  const [vitals, setVitals] = useState<VitalsData | null>(null);
  const [cpuHistory, setCpuHistory] = useState<DataPoint[]>([]);
  const [ramHistory, setRamHistory] = useState<DataPoint[]>([]);
  const [heapHistory, setHeapHistory] = useState<DataPoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(null);
  const pollCountRef = useRef(0);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetchWithTimeout('/api/system/vitals', { timeoutMs: 6000 });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: VitalsData = await res.json();
      setVitals(data);
      setError(null);
      pollCountRef.current++;

      const now = Date.now();

      // Push data points (skip first poll since CPU idle snapshot may be inaccurate)
      if (pollCountRef.current > 1) {
        setCpuHistory((prev) => {
          const next = [...prev, { t: now, v: data.cpu.usagePct }];
          return next.length > MAX_POINTS ? next.slice(-MAX_POINTS) : next;
        });
        setRamHistory((prev) => {
          const next = [...prev, { t: now, v: data.memory.usagePct }];
          return next.length > MAX_POINTS ? next.slice(-MAX_POINTS) : next;
        });
        setHeapHistory((prev) => {
          // Use fixed baseline (512MB) instead of heapTotalMB which is unreliable
          // heapTotalMB is what Node has currently allocated (grows dynamically),
          // not the actual memory limit. Using it causes false 95%+ alerts when
          // heapUsed is only ~45MB but heapTotal is ~47MB.
          const heapPct = (data.process.memory.heapUsedMB / HEAP_BASELINE_MB) * 100;
          const next = [...prev, { t: now, v: Math.min(100, heapPct) }];
          return next.length > MAX_POINTS ? next.slice(-MAX_POINTS) : next;
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error de conexion');
    }
  }, []);

  useEffect(() => {
    fetchData();
    intervalRef.current = setInterval(fetchData, 5000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchData]);

  // Determine color based on severity
  const getColor = (pct: number): string => {
    if (pct > 85) return '#f43f5e'; // red
    if (pct > 60) return '#f59e0b'; // amber
    return '#06b6d4'; // cyan
  };

  if (error && !vitals) {
    return (
      <PanelShell title="Monitor Vital" icon={<Cpu className="w-4 h-4" />}>
        <div className="flex items-center gap-2 text-red-400/80 text-xs font-mono py-4">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          Conexion perdida — {error}
        </div>
      </PanelShell>
    );
  }

  return (
    <PanelShell title="Vital Monitor" icon={<Cpu className="w-4 h-4" />}>
      {/* System info bar */}
      {vitals && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3 px-1">
          <InfoChip
            icon={<Server className="w-3 h-3" />}
            label="Nodo"
            value={vitals.process.nodeVersion}
          />
          <InfoChip
            icon={<Cpu className="w-3 h-3" />}
            label="CPU"
            value={`${vitals.cpu.cores} cores`}
          />
          <InfoChip
            icon={<Clock className="w-3 h-3" />}
            label="Tiempo Activo"
            value={vitals.process.uptimeFormatted}
          />
          <InfoChip
            icon={<HardDrive className="w-3 h-3" />}
            label="DB"
            value={`${vitals.database.sizeMB} MB`}
          />
        </div>
      )}

      {/* Sparkline charts */}
      <Sparkline
        data={cpuHistory}
        color={vitals ? getColor(vitals.cpu.usagePct) : '#06b6d4'}
        label="Uso de CPU"
        current={vitals?.cpu.usagePct ?? 0}
        icon={<Cpu className="w-4 h-4" />}
      />
      <Sparkline
        data={ramHistory}
        color={vitals ? getColor(vitals.memory.usagePct) : '#10b981'}
        label="RAM del Sistema"
        current={vitals?.memory.usagePct ?? 0}
        unit="%"
        icon={<MemoryStick className="w-4 h-4" />}
      />
      <Sparkline
        data={heapHistory}
        color={
          vitals
            ? getColor((vitals.process.memory.heapUsedMB / HEAP_BASELINE_MB) * 100)
            : '#a78bfa'
        }
        label="Heap de Node"
        current={
          vitals
            ? (vitals.process.memory.heapUsedMB / HEAP_BASELINE_MB) * 100
            : 0
        }
        unit="%"
        icon={<MemoryStick className="w-4 h-4" />}
      />

      {/* Process memory detail */}
      {vitals && (
        <div className="mt-2 pt-2 border-t border-slate-800/60">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-[9px] font-bold uppercase text-slate-600 font-mono">
                RSS
              </p>
              <p className="text-xs font-mono text-cyan-400 tabular-nums">
                {vitals.process.memory.rssMB} MB
              </p>
            </div>
            <div>
              <p className="text-[9px] font-bold uppercase text-slate-600 font-mono">
                Heap Usado
              </p>
              <p className="text-xs font-mono tabular-nums" style={{ color: getColor((vitals.process.memory.heapUsedMB / HEAP_BASELINE_MB) * 100) }}>
                {vitals.process.memory.heapUsedMB} MB
              </p>
              <p className="text-[8px] font-mono text-slate-700">
                / {HEAP_BASELINE_MB} MB
              </p>
            </div>
            <div>
              <p className="text-[9px] font-bold uppercase text-slate-600 font-mono">
                Tamaño BD
              </p>
              <p className="text-xs font-mono text-cyan-400 tabular-nums">
                {vitals.database.sizeMB} MB
              </p>
            </div>
          </div>
        </div>
      )}
    </PanelShell>
  );
}

// ═══════════════════════════════════════════════════════════════
// PanelShell — reusable sci-fi container
// ═══════════════════════════════════════════════════════════════

export function PanelShell({
  title,
  icon,
  children,
  className = '',
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-lg overflow-hidden ${className}`}
      style={{
        background: 'rgba(5, 5, 5, 0.8)',
        border: '1px solid rgba(6, 182, 212, 0.12)',
        boxShadow: '0 0 20px rgba(6, 182, 212, 0.04), inset 0 1px 0 rgba(6, 182, 212, 0.06)',
      }}
    >
      {/* Scan lines overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-30"
        style={{
          background:
            'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(6, 182, 212, 0.008) 2px, rgba(6, 182, 212, 0.008) 4px)',
        }}
      />
      {/* Header */}
      <div
        className="flex items-center gap-2 px-4 py-2.5 border-b"
        style={{ borderColor: 'rgba(6, 182, 212, 0.08)' }}
      >
        <span className="text-cyan-500">{icon}</span>
        <h3 className="text-[11px] font-bold uppercase tracking-[0.15em] text-cyan-400/90 font-mono">
          {title}
        </h3>
        {/* Live indicator */}
        <span className="ml-auto flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[9px] uppercase text-emerald-500/60 font-mono">
            en vivo
          </span>
        </span>
      </div>
      {/* Content */}
      <div className="relative p-4">{children}</div>
      {/* Bottom glow line */}
      <div
        className="h-[1px]"
        style={{
          background:
            'linear-gradient(90deg, transparent 5%, rgba(6, 182, 212, 0.2) 50%, transparent 95%)',
        }}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// InfoChip — tiny label+value
// ═══════════════════════════════════════════════════════════════

function InfoChip({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] font-mono text-slate-500">
      <span className="text-slate-600">{icon}</span>
      <span className="text-slate-600">{label}:</span>
      <span className="text-slate-400">{value}</span>
    </span>
  );
}
