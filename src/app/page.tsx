'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { fetchWithTimeout } from '@/lib/fetch-utils';
import { VitalMonitor } from '@/components/onion200/VitalMonitor';
import { LiveFeed } from '@/components/onion200/LiveFeed';
import { SystemStatus } from '@/components/onion200/SystemStatus';
import {
  Crosshair,
  Radio,
  BarChart3,
  FileText,
  Send,
  ArrowUpRight,
  RefreshCw,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════
// Types — Real data from /api/dashboard/indicadores-summary
// ═══════════════════════════════════════════════════════════════

interface PipelineKPIs {
  captura?: {
    menciones?: { total: number; hoy: number; semana: number };
    fuentes?: { activas: number; degradadas: number };
    status?: string;
  };
  clasificacion?: {
    tasas?: { eje: number; lente: number; sentimiento: number };
    status?: string;
  };
  produccion?: {
    productos?: { total: number; hoy: number; semana: number };
    status?: string;
  };
  distribucion?: {
    envios?: { total: number; exitosos: number; fallidos: number };
    status?: string;
  };
}

// ═══════════════════════════════════════════════════════════════
// KPI Card — Real data, zero hardcode
// ═══════════════════════════════════════════════════════════════

function KPICard({
  icon,
  label,
  value,
  sub,
  color,
  status,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number | null;
  sub?: string;
  color: string;
  status?: string;
}) {
  const statusColor =
    status === 'error'
      ? '#f43f5e'
      : status === 'warning'
        ? '#f59e0b'
        : status === 'ok'
          ? '#10b981'
          : '#64748b';

  return (
    <div
      className="rounded-lg p-3 relative overflow-hidden transition-all duration-300"
      style={{
        background: `linear-gradient(135deg, ${color}06 0%, rgba(5,5,5,0.9) 60%)`,
        border: `1px solid ${color}15`,
        boxShadow: `0 0 12px ${color}06`,
      }}
    >
      {/* Scan line */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(6,182,212,0.01) 3px, rgba(6,182,212,0.01) 4px)',
        }}
      />
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-1.5">
          <span style={{ color: `${color}90` }}>{icon}</span>
          {status && status !== 'idle' && (
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{
                backgroundColor: statusColor,
                boxShadow: `0 0 6px ${statusColor}60`,
              }}
            />
          )}
        </div>
        <p
          className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-600 font-mono mb-1"
        >
          {label}
        </p>
        <p
          className="text-xl font-bold font-mono tabular-nums leading-none"
          style={{ color: value !== null ? '#e5e5e5' : '#334155' }}
        >
          {value !== null ? value : '---'}
        </p>
        {sub && (
          <p className="text-[9px] font-mono text-slate-600 mt-1 truncate">
            {sub}
          </p>
        )}
        {/* Bottom glow */}
        <div
          className="absolute bottom-0 left-0 right-0 h-[1px]"
          style={{
            background: `linear-gradient(90deg, transparent, ${color}20, transparent)`,
          }}
        />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Pipeline Status Bar — real status from API
// ═══════════════════════════════════════════════════════════════

function PipelineStatusBar({ pipeline }: { pipeline: PipelineKPIs }) {
  const stages = [
    {
      key: 'captura',
      label: 'CAPTURA',
      icon: <Radio className="w-3.5 h-3.5" />,
      status: pipeline.captura?.status,
    },
    {
      key: 'clasificacion',
      label: 'CLASIFICACION',
      icon: <Crosshair className="w-3.5 h-3.5" />,
      status: pipeline.clasificacion?.status,
    },
    {
      key: 'produccion',
      label: 'PRODUCCION',
      icon: <FileText className="w-3.5 h-3.5" />,
      status: pipeline.produccion?.status,
    },
    {
      key: 'distribucion',
      label: 'DISTRIBUCION',
      icon: <Send className="w-3.5 h-3.5" />,
      status: pipeline.distribucion?.status,
    },
  ];

  const colorForStatus = (s?: string) =>
    s === 'error'
      ? '#f43f5e'
      : s === 'warning'
        ? '#f59e0b'
        : s === 'ok'
          ? '#10b981'
          : '#334155';

  return (
    <div
      className="flex items-center gap-1 sm:gap-2 overflow-x-auto py-2 px-3"
      style={{ borderBottom: '1px solid rgba(6,182,212,0.06)' }}
    >
      {stages.map((stage, i) => {
        const color = colorForStatus(stage.status);
        return (
          <React.Fragment key={stage.key}>
            <div className="flex items-center gap-1.5 flex-shrink-0 px-2 py-1 rounded-md transition-all">
              <span style={{ color: `${color}90` }}>{stage.icon}</span>
              <span
                className="text-[9px] font-bold tracking-wider font-mono"
                style={{ color }}
              >
                {stage.label}
              </span>
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{
                  backgroundColor: color,
                  boxShadow: `0 0 4px ${color}50`,
                }}
              />
            </div>
            {i < stages.length - 1 && (
              <ArrowUpRight
                className="w-3 h-3 text-slate-800 flex-shrink-0 rotate-90"
              />
            )}
          </React.Fragment>
        );
      })}
      {/* Refresh timestamp */}
      <span className="ml-auto text-[9px] font-mono text-slate-700 flex-shrink-0">
        {new Date().toLocaleTimeString('es-BO', { hour12: false })}
      </span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ONION200 Dashboard — Main orchestrator
// ═══════════════════════════════════════════════════════════════

export default function ONION200Dashboard() {
  const [kpis, setKpis] = useState<PipelineKPIs | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string>('');

  const fetchKPIs = useCallback(async () => {
    try {
      const res = await fetchWithTimeout('/api/dashboard/indicadores-summary', {
        timeoutMs: 8000,
      });
      if (res.ok) {
        const data = await res.json();
        setKpis(data);
        setLastUpdate(
          new Date().toLocaleTimeString('es-BO', { hour12: false })
        );
      }
    } catch {
      // Silent — KPI cards will show "---"
    }
  }, []);

  useEffect(() => {
    fetchKPIs();
    const iv = setInterval(fetchKPIs, 60000); // Refresh KPIs every 60s
    return () => clearInterval(iv);
  }, [fetchKPIs]);

  const captura = kpis?.captura;
  const clasif = kpis?.clasificacion;
  const prod = kpis?.produccion;
  const dist = kpis?.distribucion;

  return (
    <div
      className="min-h-screen flex flex-col overflow-hidden"
      style={{ backgroundColor: '#020202' }}
    >
      {/* ═══ HEADER — ONION200 Branding ═══ */}
      <header
        className="flex-shrink-0 px-4 sm:px-6 py-3 flex items-center justify-between"
        style={{
          borderBottom: '1px solid rgba(6,182,212,0.08)',
          background:
            'linear-gradient(180deg, rgba(6,182,212,0.04) 0%, transparent 100%)',
        }}
      >
        <div className="flex items-center gap-3">
          {/* Logo */}
          <div
            className="flex items-center justify-center w-9 h-9 rounded-lg"
            style={{
              border: '1px solid rgba(6,182,212,0.25)',
              backgroundColor: 'rgba(6,182,212,0.08)',
              boxShadow: '0 0 12px rgba(6,182,212,0.1)',
            }}
          >
            <Crosshair size={18} className="text-cyan-400" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-[0.2em] text-cyan-300 font-mono uppercase">
              ONION200
            </h1>
            <p className="text-[9px] tracking-wider text-slate-600 font-mono">
              PUENTE DE MANDO · DECODEX BOLIVIA
            </p>
          </div>
        </div>

        {/* Right side: status + clock */}
        <div className="flex items-center gap-3">
          {lastUpdate && (
            <span className="hidden sm:flex items-center gap-1.5 text-[9px] font-mono text-slate-600">
              <RefreshCw className="w-3 h-3" />
              {lastUpdate}
            </span>
          )}
          <div className="flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-full bg-emerald-500"
              style={{
                boxShadow: '0 0 6px rgba(16,185,129,0.5)',
                animation: 'pulse 2s infinite',
              }}
            />
            <span className="text-[9px] font-bold uppercase text-emerald-500/60 font-mono">
              Online
            </span>
          </div>
        </div>
      </header>

      {/* ═══ PIPELINE STATUS BAR ═══ */}
      <PipelineStatusBar pipeline={kpis || {}} />

      {/* ═══ KPI CARDS — Real data row ═══ */}
      <div
        className="flex-shrink-0 px-4 sm:px-6 py-3 grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3"
        style={{ borderBottom: '1px solid rgba(6,182,212,0.04)' }}
      >
        <KPICard
          icon={<Radio className="w-4 h-4" />}
          label="Menciones Hoy"
          value={captura?.menciones?.hoy ?? null}
          sub={
            captura
              ? `${captura.menciones?.total ?? 0} total · ${captura.fuentes?.activas ?? 0} fuentes`
              : undefined
          }
          color="#10b981"
          status={captura?.status}
        />
        <KPICard
          icon={<Crosshair className="w-4 h-4" />}
          label="Clasificacion"
          value={
            clasif?.tasas?.eje !== undefined
              ? `${clasif.tasas.eje}%`
              : null
          }
          sub={clasif ? 'con eje tematico' : undefined}
          color="#06b6d4"
          status={clasif?.status}
        />
        <KPICard
          icon={<BarChart3 className="w-4 h-4" />}
          label="Productos Semana"
          value={prod?.productos?.semana ?? null}
          sub={
            prod ? `${prod.productos?.hoy ?? 0} hoy` : undefined
          }
          color="#f59e0b"
          status={prod?.status}
        />
        <KPICard
          icon={<Send className="w-4 h-4" />}
          label="Envios"
          value={
            dist?.envios?.total !== undefined
              ? dist.envios.total
              : null
          }
          sub={
            dist
              ? `${dist.envios?.exitosos ?? 0} OK · ${dist.envios?.fallidos ?? 0} fallidos`
              : undefined
          }
          color="#a78bfa"
          status={dist?.status}
        />
      </div>

      {/* ═══ MAIN GRID — 3 panels ═══ */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 max-w-[1400px] mx-auto">
          {/* ── Left: Vital Monitor (5 cols) ── */}
          <div className="lg:col-span-5">
            <VitalMonitor />
          </div>

          {/* ── Right top: System Status (4 cols) ── */}
          <div className="lg:col-span-4">
            <SystemStatus />
          </div>

          {/* ── Right bottom: Live Feed (3 cols) ── */}
          <div className="lg:col-span-3">
            <LiveFeed />
          </div>
        </div>
      </div>

      {/* ═══ FOOTER BAR ═══ */}
      <footer
        className="flex-shrink-0 px-4 sm:px-6 py-1.5 flex items-center justify-between"
        style={{
          borderTop: '1px solid rgba(6,182,212,0.06)',
          background: 'rgba(5,5,5,0.9)',
        }}
      >
        <span className="text-[9px] font-mono text-slate-700">
          ONION200 v1.0 · Fase 1 — El Latido de la Nave
        </span>
        <span className="text-[9px] font-mono text-slate-700">
          DECODEX Bolivia · Inteligencia de Senales · 2025-2030
        </span>
      </footer>
    </div>
  );
}
