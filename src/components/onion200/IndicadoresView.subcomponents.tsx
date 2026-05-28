'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, RefreshCw, X, TrendingUp, Minus, TrendingDown, Plus, Pause, Play, Trash2 } from 'lucide-react';
import { TIER_CONFIG, CATEGORIAS } from './IndicadoresView.types';
import type { EnrichedIndicador } from './IndicadoresView.types';

// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('es-BO', {
      day: '2-digit',
      month: 'short',
    });
  } catch {
    return dateStr;
  }
}

// ═══════════════════════════════════════════════════════════════
// Small UI primitives
// ═══════════════════════════════════════════════════════════════

export function MiniStatCard({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: number | string;
  color: string;
  icon: React.ReactNode;
}) {
  return (
    <div
      className="rounded px-3 py-2 flex items-center gap-2.5"
      style={{
        background: 'rgba(5, 5, 5, 0.8)',
        border: '1px solid ' + color + '15',
        boxShadow: '0 0 12px ' + color + '08',
      }}
    >
      <span style={{ color: color + '80' }}>{icon}</span>
      <div className="flex items-baseline gap-2">
        <span
          className="text-lg font-bold font-mono tabular-nums leading-none"
          style={{ color }}
        >
          {value}
        </span>
        <span className="text-[8px] font-bold uppercase tracking-[0.1em] text-slate-600 font-mono">
          {label}
        </span>
      </div>
    </div>
  );
}

export function TierBadge({ tier }: { tier: number }) {
  const cfg = TIER_CONFIG[tier] || TIER_CONFIG[3];
  return (
    <span
      className="inline-flex items-center px-1 py-0 rounded text-[7px] font-bold font-mono uppercase tracking-wider leading-none"
      style={{
        color: cfg.color,
        backgroundColor: cfg.color + '12',
        border: '1px solid ' + cfg.color + '20',
      }}
    >
      {cfg.label}
    </span>
  );
}

export function ConfiableDot({ confiable }: { confiable: boolean | undefined }) {
  if (confiable === undefined || confiable === null) return null;
  const color = confiable ? '#10b981' : '#f59e0b';
  return (
    <span
      className="w-1 h-1 rounded-full flex-shrink-0"
      style={{
        backgroundColor: color,
        boxShadow: '0 0 3px ' + color + '50',
      }}
      title={confiable ? 'Dato confiable' : 'Dato fallback (sin verificar)'}
    />
  );
}

export function SkeletonCard() {
  return (
    <div
      className="rounded p-2.5 animate-pulse"
      style={{
        background: 'rgba(5, 5, 5, 0.8)',
        border: '1px solid rgba(6, 182, 212, 0.08)',
      }}
    >
      <div className="h-2 rounded-sm mb-2" style={{ backgroundColor: 'rgba(6, 182, 212, 0.08)', width: '70%' }} />
      <div className="h-4 rounded-sm mb-1.5" style={{ backgroundColor: 'rgba(6, 182, 212, 0.06)', width: '50%' }} />
      <div className="h-1.5 rounded-sm" style={{ backgroundColor: 'rgba(6, 182, 212, 0.04)', width: '35%' }} />
    </div>
  );
}

export function ProgressBar({ elapsed, maxDuration }: { elapsed: number; maxDuration: number }) {
  const pct = Math.min(100, (elapsed / maxDuration) * 100);
  return (
    <div
      className="w-full h-0.5 rounded-full overflow-hidden"
      style={{ backgroundColor: 'rgba(6, 182, 212, 0.08)' }}
    >
      <div
        className="h-full rounded-full transition-all duration-1000 ease-linear"
        style={{
          width: pct + '%',
          backgroundColor: '#06b6d4',
          boxShadow: '0 0 4px rgba(6, 182, 212, 0.3)',
        }}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Mini Sparkline — tiny SVG line chart (stock-ticker style)
// ═══════════════════════════════════════════════════════════════

export function MiniSparkline({
  data,
  color,
  width = 80,
  height = 24,
}: {
  data: Array<{ fecha: string; valor: number }>;
  color: string;
  width?: number;
  height?: number;
}) {
  if (!data || data.length < 2) return null;

  // Reverse so oldest is first (left), newest is last (right)
  const points = [...data].reverse();
  const values = points.map(p => p.valor);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const svgPoints = points.map((p, i) => {
    const x = (i / (points.length - 1)) * width;
    const y = height - ((p.valor - min) / range) * (height - 2) - 1;
    return `${x},${y}`;
  }).join(' ');

  const lastVal = values[values.length - 1];
  const prevVal = values[values.length - 2];
  const trend = lastVal >= prevVal ? 'up' : 'down';
  const trendColor = trend === 'up' ? '#10b981' : '#f43f5e';

  return (
    <div className="flex items-end gap-1">
      <svg width={width} height={height} className="flex-shrink-0">
        <polyline
          points={svgPoints}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.7"
        />
        {/* End dot */}
        <circle
          cx={(points.length - 1) / (points.length - 1) * width}
          cy={height - ((lastVal - min) / range) * (height - 2) - 1}
          r="2"
          fill={trendColor}
          opacity="0.9"
        />
      </svg>
      <span className="text-[7px] font-mono font-bold" style={{ color: trendColor }}>
        {trend === 'up' ? '▲' : '▼'}
      </span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Indicator Card — compact terminal-style display
// ═══════════════════════════════════════════════════════════════

export function IndicatorCard({
  indicador,
  syncing,
  onSync,
  catColor,
  onClick,
}: {
  indicador: EnrichedIndicador;
  syncing: boolean;
  onSync: (slug: string) => void;
  catColor: string;
  onClick?: () => void;
}) {
  const uv = indicador.ultimoValor;
  const ue = indicador.ultimaEvaluacion;
  const hasData = uv || ue;

  // Determine display value
  let displayValue = '---';

  if (uv) {
    displayValue = uv.valor;
  } else if (ue) {
    displayValue = ue.valorTexto;
  }

  const isCuantitativo = indicador.tipo === 'cuantitativo';

  return (
    <div
      className="rounded p-3 relative overflow-hidden transition-all duration-150 group cursor-pointer"
      style={{
        background: 'rgba(5, 5, 5, 0.8)',
        border: '1px solid ' + catColor + '18',
        boxShadow: '0 0 8px ' + catColor + '08',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = catColor + '35';
        (e.currentTarget as HTMLElement).style.background = 'rgba(8, 8, 8, 0.95)';
        (e.currentTarget as HTMLElement).style.boxShadow = '0 0 16px ' + catColor + '15';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = catColor + '18';
        (e.currentTarget as HTMLElement).style.background = 'rgba(5, 5, 5, 0.8)';
        (e.currentTarget as HTMLElement).style.boxShadow = '0 0 8px ' + catColor + '08';
      }}
      onClick={(e) => {
        // Don't trigger if clicking sync button
        if ((e.target as HTMLElement).closest('button[disabled]') || (e.target as HTMLElement).closest('button')) return;
        onClick?.();
      }}
    >
      <div className="relative z-10">
        {/* Header row: dot + name + tier + sync */}
        <div className="flex items-center gap-1.5 mb-2">
          <ConfiableDot confiable={uv?.confiable} />
          <h4
            className="text-[10px] font-bold font-mono uppercase tracking-wider truncate text-slate-400"
            title={indicador.nombre}
          >
            {indicador.nombre}
          </h4>
          <span className="ml-auto flex items-center gap-1 flex-shrink-0">
            <TierBadge tier={indicador.tier} />
            <button
              onClick={() => onSync(indicador.slug)}
              disabled={syncing}
              className="p-0.5 rounded transition-all duration-150 disabled:opacity-20 opacity-0 group-hover:opacity-60 hover:!opacity-100"
              title={syncing ? 'Sincronizando...' : 'Sincronizar'}
            >
              {syncing ? (
                <Loader2 className="w-2.5 h-2.5 animate-spin" style={{ color: '#06b6d4' }} />
              ) : (
                <RefreshCw className="w-2.5 h-2.5" style={{ color: '#06b6d4' }} />
              )}
            </button>
          </span>
        </div>

        {/* Value + unit — single line */}
        <div className="flex items-baseline gap-2 mb-1">
          <span
            className="text-xl sm:text-2xl font-bold font-mono tabular-nums leading-none"
            style={{ color: hasData ? '#f0f0f0' : '#334155' }}
          >
            {displayValue}
          </span>
          {indicador.unidad && (
            <span className="text-[9px] font-mono text-slate-600 uppercase tracking-wider truncate">
              {indicador.unidad}
            </span>
          )}
        </div>

        {/* Sparkline — only for cuantitativo with history */}
        {isCuantitativo && indicador.historial && indicador.historial.length >= 2 && (
          <div className="mt-1.5 mb-1">
            <MiniSparkline data={indicador.historial} color={catColor} />
          </div>
        )}

        {/* Meta: source · date — single line */}
        <div className="flex items-center gap-1.5 text-[8px] font-mono text-slate-500 leading-none">
          {indicador.fuente && (
            <span className="truncate max-w-[90px]" title={indicador.fuente}>
              {indicador.fuente.length > 18 ? indicador.fuente.slice(0, 16) + '...' : indicador.fuente}
            </span>
          )}
          {uv?.fecha && (
            <span className="ml-auto flex-shrink-0 text-slate-600">
              {formatDate(uv.fecha)}
            </span>
          )}
        </div>

        {/* Evaluacion badge for cualitativo */}
        {ue && (
          <div className="mt-1">
            <span
              className="inline-flex items-center px-1.5 py-0 rounded text-[8px] font-bold font-mono uppercase tracking-wider leading-none"
              style={{
                color: ue.escalaNivel === 'critico' ? '#ef4444' : ue.escalaNivel === 'alto' ? '#f59e0b' : ue.escalaNivel === 'bajo' ? '#10b981' : '#06b6d4',
                backgroundColor: (ue.escalaNivel === 'critico' ? '#ef4444' : ue.escalaNivel === 'alto' ? '#f59e0b' : ue.escalaNivel === 'bajo' ? '#10b981' : '#06b6d4') + '12',
                border: '1px solid ' + (ue.escalaNivel === 'critico' ? '#ef4444' : ue.escalaNivel === 'alto' ? '#f59e0b' : ue.escalaNivel === 'bajo' ? '#10b981' : '#06b6d4') + '20',
              }}
            >
              {ue.escalaNivel} · {ue.valorCompuesto.toFixed(1)}
            </span>
          </div>
        )}

        {/* Bottom accent line */}
        <div
          className="absolute bottom-0 left-0 right-0 h-[1px]"
          style={{
            background: 'linear-gradient(90deg, transparent 10%, ' + catColor + '12 50%, transparent 90%)',
          }}
        />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// History Chart — SVG line chart for modal view
// ═══════════════════════════════════════════════════════════════

function HistoryChart({
  data,
  color,
  width = 500,
  height = 180,
}: {
  data: Array<{ fecha: string; valor: number; confiable?: boolean }>;
  color: string;
  width?: number;
  height?: number;
}) {
  if (!data || data.length < 2) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-[10px] font-mono text-slate-600">
          Sin suficientes datos historicos (necesitas al menos 2 capturas en dias diferentes)
        </p>
      </div>
    );
  }

  const points = [...data].reverse();
  const values = points.map(p => p.valor);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const padY = 12;
  const padX = 40;
  const chartW = width - padX - 16;
  const chartH = height - padY * 2;

  // Y-axis labels
  const ySteps = 4;
  const yLabels = Array.from({ length: ySteps + 1 }, (_, i) => {
    const val = min + (range * (ySteps - i)) / ySteps;
    return val;
  });

  // Build path
  const linePoints = points.map((p, i) => {
    const x = padX + (i / (points.length - 1)) * chartW;
    const y = padY + chartH - ((p.valor - min) / range) * chartH;
    return { x, y, ...p };
  });

  const pathD = linePoints.map((p, i) => (i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`)).join(' ');

  // Area fill
  const areaD = pathD + ` L${linePoints[linePoints.length - 1].x},${padY + chartH} L${linePoints[0].x},${padY + chartH} Z`;

  // Stats
  const first = values[0];
  const last = values[values.length - 1];
  const change = last - first;
  const changePct = first !== 0 ? ((change / first) * 100).toFixed(2) : '0.00';
  const avg = (values.reduce((a, b) => a + b, 0) / values.length);
  const high = max;
  const low = min;

  return (
    <div>
      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        <StatBox label="Actual" value={last.toFixed(2)} color={color} />
        <StatBox label="Promedio" value={avg.toFixed(2)} color="#64748b" />
        <StatBox label="Max" value={high.toFixed(2)} color="#10b981" />
        <StatBox label="Min" value={low.toFixed(2)} color="#f43f5e" />
      </div>

      {/* Change indicator */}
      <div className="flex items-center gap-2 mb-3 px-1">
        {change > 0 ? <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> :
         change < 0 ? <TrendingDown className="w-3.5 h-3.5 text-rose-400" /> :
         <Minus className="w-3.5 h-3.5 text-slate-400" />}
        <span className="text-[10px] font-mono" style={{ color: change > 0 ? '#10b981' : change < 0 ? '#f43f5e' : '#64748b' }}>
          {change > 0 ? '+' : ''}{changePct}% variacion
        </span>
        <span className="text-[9px] font-mono text-slate-600 ml-auto">
          {points[0].fecha} — {points[points.length - 1].fecha}
        </span>
      </div>

      {/* Chart */}
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} className="block">
        {/* Grid lines */}
        {yLabels.map((val, i) => {
          const y = padY + chartH - (i / ySteps) * chartH;
          return (
            <g key={i}>
              <line x1={padX} y1={y} x2={padX + chartW} y2={y} stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
              <text x={padX - 4} y={y + 3} textAnchor="end" fill="#475569" fontSize="8" fontFamily="monospace">
                {val.toFixed(val >= 100 ? 0 : 2)}
              </text>
            </g>
          );
        })}

        {/* Area fill */}
        <path d={areaD} fill={color} opacity="0.06" />

        {/* Line */}
        <path d={pathD} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />

        {/* Data points */}
        {linePoints.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="2.5" fill={color} opacity={p.confiable === false ? 0.3 : 0.8} />
            {/* Date label for every Nth point */}
            {(i === 0 || i === linePoints.length - 1 || i % Math.max(1, Math.floor(linePoints.length / 6)) === 0) && (
              <text x={p.x} y={height - 2} textAnchor="middle" fill="#475569" fontSize="7" fontFamily="monospace">
                {p.fecha.slice(5)}
              </text>
            )}
          </g>
        ))}

        {/* Current value dot with glow */}
        <circle cx={linePoints[linePoints.length - 1].x} cy={linePoints[linePoints.length - 1].y} r="4" fill={color}>
          <animate attributeName="r" values="3;5;3" dur="2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.8;0.4;0.8" dur="2s" repeatCount="indefinite" />
        </circle>
      </svg>
    </div>
  );
}

// Helper stat box for chart header
function StatBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="text-center px-2 py-1.5 rounded" style={{ background: color + '08', border: '1px solid ' + color + '12' }}>
      <p className="text-[8px] font-mono uppercase text-slate-600 tracking-wider">{label}</p>
      <p className="text-sm font-bold font-mono tabular-nums" style={{ color }}>{value}</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// History Modal — detailed chart when clicking an indicator
// ═══════════════════════════════════════════════════════════════

interface HistoryData {
  fecha: string;
  valor: number;
  valorTexto: string;
  confiable: boolean;
}

export function HistoryModal({
  indicador,
  catColor,
  onClose,
}: {
  indicador: EnrichedIndicador;
  catColor: string;
  onClose: () => void;
}) {
  const [history, setHistory] = useState<HistoryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [dias, setDias] = useState(30);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/indicadores/${indicador.id}/history?dias=${dias}`);
      if (res.ok) {
        const json = await res.json();
        setHistory(json.data || []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [indicador.id, dias]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="rounded-lg overflow-hidden max-w-lg w-full"
        style={{
          background: '#0a0a0a',
          border: '1px solid ' + catColor + '25',
          boxShadow: '0 0 40px ' + catColor + '10',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid ' + catColor + '15' }}>
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: catColor, boxShadow: '0 0 6px ' + catColor + '60' }} />
          <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-300 flex-1 truncate">
            {indicador.nombre}
          </h3>
          <span className="text-[8px] font-mono text-slate-600">{history.length} registros</span>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/5 transition-colors">
            <X className="w-3.5 h-3.5 text-slate-500" />
          </button>
        </div>

        {/* Period selector */}
        <div className="flex items-center gap-1 px-4 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
          {[7, 30, 90, 180, 365].map((d) => (
            <button
              key={d}
              onClick={() => setDias(d)}
              className="px-2 py-1 rounded text-[8px] font-bold font-mono uppercase transition-all"
              style={{
                color: dias === d ? catColor : '#475569',
                backgroundColor: dias === d ? catColor + '12' : 'transparent',
                border: '1px solid ' + (dias === d ? catColor + '25' : 'transparent'),
              }}
            >
              {d}d
            </button>
          ))}
          <button
            onClick={fetchHistory}
            disabled={loading}
            className="ml-auto p-1 rounded hover:bg-white/5 transition-colors disabled:opacity-40"
          >
            <RefreshCw className={'w-3 h-3 text-slate-500' + (loading ? ' animate-spin' : '')} />
          </button>
        </div>

        {/* Chart content */}
        <div className="p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-cyan-500" />
              <span className="ml-2 text-[10px] font-mono text-slate-500">Cargando historial...</span>
            </div>
          ) : (
            <HistoryChart data={history} color={catColor} />
          )}

          {/* Data table (last 10) */}
          {history.length > 0 && (
            <div className="mt-4 max-h-[120px] overflow-y-auto custom-scrollbar" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
              <table className="w-full text-[8px] font-mono">
                <thead>
                  <tr className="text-slate-600 uppercase">
                    <th className="text-left py-1.5 px-2">Fecha</th>
                    <th className="text-right py-1.5 px-2">Valor</th>
                    <th className="text-right py-1.5 px-2">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {history.slice(0, 20).map((row, i) => (
                    <tr key={i} className="border-t border-white/[0.02] hover:bg-white/[0.02]">
                      <td className="py-1 px-2 text-slate-400">{row.fecha}</td>
                      <td className="py-1 px-2 text-right text-slate-300">{row.valorTexto || row.valor}</td>
                      <td className="py-1 px-2 text-right">
                        <span className="w-1 h-1 rounded-full inline-block" style={{
                          backgroundColor: row.confiable ? '#10b981' : '#f59e0b',
                          boxShadow: '0 0 3px ' + (row.confiable ? '#10b981' : '#f59e0b') + '50',
                        }} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Bottom glow */}
        <div className="h-[1px]" style={{ background: 'linear-gradient(90deg, transparent 5%, ' + catColor + '30 50%, transparent 95%)' }} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Manage Modal — add, pause, delete indicators
// ═══════════════════════════════════════════════════════════════

const CATEGORY_OPTIONS = Object.entries(CATEGORIAS).map(([key, val]) => ({ key, label: val.label }));

const emptyForm = {
  nombre: '',
  slug: '',
  categoria: 'economico',
  tipo: 'cuantitativo',
  fuente: '',
  unidad: '',
  formatoNumero: 2,
  tier: 3,
};

export function ManageModal({
  indicadores,
  onClose,
  onUpdated,
}: {
  indicadores: EnrichedIndicador[];
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [mode, setMode] = useState<'list' | 'add'>('list');
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const sorted = [...indicadores].sort((a, b) => {
    if (a.activo !== b.activo) return a.activo ? -1 : 1;
    return a.orden - b.orden;
  });

  const handleToggle = async (ind: EnrichedIndicador) => {
    setBusyId(ind.id);
    try {
      const res = await fetch('/api/indicadores/' + ind.id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo: !ind.activo }),
      });
      if (res.ok) {
        onUpdated();
        setMsg({ ok: true, text: ind.activo ? ind.nombre + ' pausado' : ind.nombre + ' reactivado' });
      }
    } catch { /* silent */ }
    setBusyId(null);
    setTimeout(() => setMsg(null), 2000);
  };

  const handleDelete = async (id: string) => {
    setBusyId(id);
    try {
      const res = await fetch('/api/indicadores/' + id, { method: 'DELETE' });
      if (res.ok) {
        onUpdated();
        setMsg({ ok: true, text: 'Indicador eliminado' });
        setDeleteConfirm(null);
      }
    } catch { /* silent */ }
    setBusyId(null);
    setTimeout(() => setMsg(null), 2000);
  };

  const handleAdd = async () => {
    if (!form.nombre.trim() || !form.slug.trim()) {
      setMsg({ ok: false, text: 'Nombre y slug son obligatorios' });
      setTimeout(() => setMsg(null), 3000);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/indicadores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        onUpdated();
        setMode('list');
        setForm(emptyForm);
        setMsg({ ok: true, text: 'Indicador creado' });
      } else {
        const err = await res.json().catch(() => ({}));
        setMsg({ ok: false, text: err.error || 'Error al crear' });
      }
    } catch {
      setMsg({ ok: false, text: 'Error de conexion' });
    }
    setSaving(false);
    setTimeout(() => setMsg(null), 3000);
  };

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const accent = '#a78bfa';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="rounded-lg overflow-hidden w-full max-w-xl"
        style={{
          background: '#0a0a0a',
          border: '1px solid ' + accent + '25',
          boxShadow: '0 0 40px ' + accent + '10',
          maxHeight: '80vh',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid ' + accent + '15' }}>
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: accent, boxShadow: '0 0 6px ' + accent + '60' }} />
          <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-300 flex-1">
            Gestionar Indicadores
          </h3>
          <span className="text-[8px] font-mono text-slate-600">{indicadores.length} total</span>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/5 transition-colors">
            <X className="w-3.5 h-3.5 text-slate-500" />
          </button>
        </div>

        {/* Message banner */}
        {msg && (
          <div
            className="px-4 py-1.5 text-[9px] font-mono"
            style={{
              color: msg.ok ? '#10b981' : '#f43f5e',
              backgroundColor: msg.ok ? 'rgba(16,185,129,0.06)' : 'rgba(244,63,94,0.06)',
              borderBottom: '1px solid ' + (msg.ok ? 'rgba(16,185,129,0.1)' : 'rgba(244,63,94,0.1)'),
            }}
          >
            {msg.text}
          </div>
        )}

        {mode === 'list' ? (
          <>
            {/* Add button */}
            <div className="px-4 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
              <button
                onClick={() => { setMode('add'); setForm(emptyForm); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[9px] font-bold font-mono uppercase tracking-wider transition-all"
                style={{
                  color: accent,
                  backgroundColor: accent + '10',
                  border: '1px solid ' + accent + '25',
                }}
              >
                <Plus className="w-3 h-3" />
                Nuevo indicador
              </button>
            </div>

            {/* Indicator list */}
            <div className="overflow-y-auto custom-scrollbar" style={{ maxHeight: '50vh' }}>
              {sorted.map((ind) => {
                const catCfg = CATEGORIAS[ind.categoria] || { label: ind.categoria, color: '#64748b' };
                const isDeleting = deleteConfirm === ind.id;
                const isBusy = busyId === ind.id;

                return (
                  <div
                    key={ind.id}
                    className="flex items-center gap-2 px-4 py-2 transition-colors hover:bg-white/[0.02]"
                    style={{
                      borderBottom: '1px solid rgba(255,255,255,0.02)',
                      opacity: ind.activo ? 1 : 0.4,
                    }}
                  >
                    {/* Status dot */}
                    <span
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{
                        backgroundColor: ind.activo ? catCfg.color : '#475569',
                        boxShadow: ind.activo ? '0 0 4px ' + catCfg.color + '50' : 'none',
                      }}
                    />

                    {/* Name + meta */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-mono font-bold text-slate-300 truncate">{ind.nombre}</p>
                      <p className="text-[8px] font-mono text-slate-600">
                        {catCfg.label} · {TIER_CONFIG[ind.tier]?.label || 'T' + ind.tier}
                        {ind.fuente ? ' · ' + (ind.fuente.length > 25 ? ind.fuente.slice(0, 23) + '...' : ind.fuente) : ''}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {/* Pause/Play */}
                      <button
                        onClick={() => handleToggle(ind)}
                        disabled={isBusy}
                        className="p-1 rounded transition-colors hover:bg-white/5 disabled:opacity-40"
                        title={ind.activo ? 'Pausar' : 'Reactivar'}
                      >
                        {isBusy ? (
                          <Loader2 className="w-3 h-3 text-slate-500 animate-spin" />
                        ) : ind.activo ? (
                          <Pause className="w-3 h-3 text-amber-400" />
                        ) : (
                          <Play className="w-3 h-3 text-emerald-400" />
                        )}
                      </button>

                      {/* Delete */}
                      {!isDeleting ? (
                        <button
                          onClick={() => setDeleteConfirm(ind.id)}
                          className="p-1 rounded transition-colors hover:bg-red-500/10"
                          title="Eliminar"
                        >
                          <Trash2 className="w-3 h-3 text-slate-600 hover:text-rose-400" />
                        </button>
                      ) : (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDelete(ind.id)}
                            className="px-1.5 py-0.5 rounded text-[7px] font-bold font-mono uppercase bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:bg-rose-500/30 transition-colors"
                          >
                            SI
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(null)}
                            className="px-1.5 py-0.5 rounded text-[7px] font-bold font-mono uppercase text-slate-500 border border-slate-700 hover:bg-white/5 transition-colors"
                          >
                            no
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          /* Add form */
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[8px] font-mono uppercase text-slate-500 mb-1 tracking-wider">Nombre *</label>
                <input
                  type="text"
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  placeholder="Ej: Oro (por onza)"
                  className="w-full px-2 py-1.5 rounded text-[10px] font-mono text-slate-200 bg-white/[0.03] border border-white/[0.08] focus:outline-none focus:border-violet-500/40 placeholder:text-slate-700"
                />
              </div>
              <div>
                <label className="block text-[8px] font-mono uppercase text-slate-500 mb-1 tracking-wider">Slug *</label>
                <input
                  type="text"
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  placeholder="Ej: com-oro-onza"
                  className="w-full px-2 py-1.5 rounded text-[10px] font-mono text-slate-200 bg-white/[0.03] border border-white/[0.08] focus:outline-none focus:border-violet-500/40 placeholder:text-slate-700"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[8px] font-mono uppercase text-slate-500 mb-1 tracking-wider">Categoria</label>
                <select
                  value={form.categoria}
                  onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                  className="w-full px-2 py-1.5 rounded text-[10px] font-mono text-slate-200 bg-white/[0.03] border border-white/[0.08] focus:outline-none focus:border-violet-500/40"
                >
                  {CATEGORY_OPTIONS.map((c) => (
                    <option key={c.key} value={c.key} style={{ background: '#0a0a0a' }}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[8px] font-mono uppercase text-slate-500 mb-1 tracking-wider">Tipo</label>
                <select
                  value={form.tipo}
                  onChange={(e) => setForm({ ...form, tipo: e.target.value })}
                  className="w-full px-2 py-1.5 rounded text-[10px] font-mono text-slate-200 bg-white/[0.03] border border-white/[0.08] focus:outline-none focus:border-violet-500/40"
                >
                  <option value="cuantitativo" style={{ background: '#0a0a0a' }}>Cuantitativo</option>
                  <option value="cualitativo" style={{ background: '#0a0a0a' }}>Cualitativo</option>
                </select>
              </div>
              <div>
                <label className="block text-[8px] font-mono uppercase text-slate-500 mb-1 tracking-wider">Tier</label>
                <select
                  value={form.tier}
                  onChange={(e) => setForm({ ...form, tier: parseInt(e.target.value) })}
                  className="w-full px-2 py-1.5 rounded text-[10px] font-mono text-slate-200 bg-white/[0.03] border border-white/[0.08] focus:outline-none focus:border-violet-500/40"
                >
                  <option value={1} style={{ background: '#0a0a0a' }}>T1 AUTO</option>
                  <option value={2} style={{ background: '#0a0a0a' }}>T2 SEMI</option>
                  <option value={3} style={{ background: '#0a0a0a' }}>T3 MANUAL</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[8px] font-mono uppercase text-slate-500 mb-1 tracking-wider">Fuente</label>
                <input
                  type="text"
                  value={form.fuente}
                  onChange={(e) => setForm({ ...form, fuente: e.target.value })}
                  placeholder="Ej: Yahoo Finance"
                  className="w-full px-2 py-1.5 rounded text-[10px] font-mono text-slate-200 bg-white/[0.03] border border-white/[0.08] focus:outline-none focus:border-violet-500/40 placeholder:text-slate-700"
                />
              </div>
              <div>
                <label className="block text-[8px] font-mono uppercase text-slate-500 mb-1 tracking-wider">Unidad</label>
                <input
                  type="text"
                  value={form.unidad}
                  onChange={(e) => setForm({ ...form, unidad: e.target.value })}
                  placeholder="Ej: USD, Bs, %"
                  className="w-full px-2 py-1.5 rounded text-[10px] font-mono text-slate-200 bg-white/[0.03] border border-white/[0.08] focus:outline-none focus:border-violet-500/40 placeholder:text-slate-700"
                />
              </div>
            </div>

            {/* Form actions */}
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={handleAdd}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded text-[9px] font-bold font-mono uppercase tracking-wider transition-all"
                style={{
                  color: accent,
                  backgroundColor: accent + '10',
                  border: '1px solid ' + accent + '25',
                  opacity: saving ? 0.5 : 1,
                }}
              >
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                {saving ? 'Creando...' : 'Crear indicador'}
              </button>
              <button
                onClick={() => setMode('list')}
                className="px-3 py-1.5 rounded text-[9px] font-bold font-mono uppercase tracking-wider text-slate-500 border border-slate-700 hover:bg-white/5 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Bottom glow */}
        <div className="h-[1px]" style={{ background: 'linear-gradient(90deg, transparent 5%, ' + accent + '30 50%, transparent 95%)' }} />
      </div>
    </div>
  );
}
