'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { fetchWithTimeout } from '@/lib/fetch-utils';

// ─── Types ────────────────────────────────────────────────────────────

interface IndicadorDataPoint {
  fecha: string;
  valor: number;
  valorTexto?: string;
  confiable: boolean;
}

interface IndicadorHistory {
  slug: string;
  nombre: string;
  dias: number;
  data: IndicadorDataPoint[];
}

interface IndicadorSummaryProps {
  indicadorSlug: string;
  indicadorNombre: string;
  unidad?: string;
  defaultDays?: number;
}

// ─── Period selector ─────────────────────────────────────────────────

const PERIODS = [
  { label: '7D', days: 7 },
  { label: '30D', days: 30 },
  { label: '90D', days: 90 },
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────

function calcStats(data: IndicadorDataPoint[]) {
  if (!data.length) return { actual: 0, promedio: 0, max: 0, min: 0, variacion: 0, maxFecha: '', minFecha: '' };
  const valores = data.map(d => d.valor);
  const actual = valores[0];
  const promedio = valores.reduce((a, b) => a + b, 0) / valores.length;
  const max = Math.max(...valores);
  const min = Math.min(...valores);
  const maxIdx = valores.indexOf(max);
  const minIdx = valores.indexOf(min);
  const variacion = valores.length >= 2
    ? ((actual - valores[valores.length - 1]) / (valores[valores.length - 1] || 1)) * 100
    : 0;
  return {
    actual,
    promedio,
    max,
    min,
    variacion,
    maxFecha: data[maxIdx]?.fecha || '',
    minFecha: data[minIdx]?.fecha || '',
  };
}

function formatNum(n: number, decimals = 2): string {
  return n.toLocaleString('es-BO', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function formatDate(d: string): string {
  try {
    const parts = d.split('-');
    return `${parts[2]}/${parts[1]}`;
  } catch {
    return d;
  }
}

// ─── Stat Card ────────────────────────────────────────────────────────

function StatCard({ label, value, color, subtext }: {
  label: string;
  value: string;
  color: string;
  subtext?: string;
}) {
  return (
    <div
      className="rounded px-2.5 py-1.5 min-w-[80px]"
      style={{
        backgroundColor: color + '10',
        border: `1px solid ${color}25`,
      }}
    >
      <p className="text-[8px] font-mono uppercase tracking-wider" style={{ color: color + '99' }}>{label}</p>
      <p className="text-[13px] font-bold font-mono" style={{ color }}>{value}</p>
      {subtext && <p className="text-[7px] font-mono" style={{ color: color + '70' }}>{subtext}</p>}
    </div>
  );
}

// ─── Pure SVG Sparkline Chart ────────────────────────────────────────

function SparklineChart({ data, promedio, unidad }: {
  data: IndicadorDataPoint[];
  promedio: number;
  unidad: string;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; point: IndicadorDataPoint } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Data is newest-first; reverse for chart (oldest → newest, left → right)
  const chartData = [...data].reverse();
  const n = chartData.length;

  if (n < 2) {
    return (
      <div className="flex items-center justify-center h-[120px] text-slate-600 text-[10px] font-mono">
        Insuficientes datos para graficar
      </div>
    );
  }

  const vals = chartData.map(d => d.valor);
  const minVal = Math.min(...vals);
  const maxVal = Math.max(...vals);
  const range = maxVal - minVal || 1;

  // SVG viewport (viewBox is 300 wide)
  const VB_W = 300;
  const H = 120;
  const PAD = { top: 8, right: 8, bottom: 22, left: 42 };

  const plotH = H - PAD.top - PAD.bottom;

  const toX = (i: number, width: number) => PAD.left + (i / (n - 1)) * (width - PAD.left - PAD.right);
  const toY = (v: number) => PAD.top + plotH - ((v - minVal) / range) * plotH;

  const points = () =>
    chartData.map((d, i) => `${toX(i, VB_W)},${toY(d.valor)}`).join(' ');

  const avgY = toY(promedio);

  // Grid lines
  const gridLines = 4;
  const gridStep = range / gridLines;

  return (
    <div ref={containerRef} className="relative w-full" style={{ height: `${H}px` }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VB_W} ${H}`}
        preserveAspectRatio="none"
        className="w-full h-full"
        onMouseLeave={() => setTooltip(null)}
      >
        {/* Grid lines + Y labels */}
        {Array.from({ length: gridLines + 1 }, (_, i) => {
          const v = minVal + gridStep * i;
          const y = toY(v);
          return (
            <g key={i}>
              <line x1={PAD.left} y1={y} x2={VB_W - PAD.right} y2={y} stroke="rgba(148,163,184,0.07)" strokeWidth={0.5} />
              <text x={PAD.left - 4} y={y + 3} textAnchor="end" fill="#64748b" fontSize="7" fontFamily="monospace">
                {formatNum(v, v > 100 ? 0 : 1)}
              </text>
            </g>
          );
        })}

        {/* Average reference line */}
        {promedio >= minVal && promedio <= maxVal && (
          <line
            x1={PAD.left} y1={avgY} x2={VB_W - PAD.right} y2={avgY}
            stroke="#475569" strokeWidth={0.5} strokeDasharray="3 3" strokeOpacity={0.5}
          />
        )}

        {/* Area fill under line */}
        <polygon
          points={`${points()} ${toX(n - 1, VB_W)},${PAD.top + plotH} ${toX(0, VB_W)},${PAD.top + plotH}`}
          fill="url(#areaGradient)" opacity={0.3}
        />

        {/* Line */}
        <polyline
          points={points()}
          fill="none"
          stroke="#f59e0b"
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Data points — show circles on each point */}
        {chartData.map((d, i) => {
          const cx = toX(i, VB_W);
          const cy = toY(d.valor);
          const isHovered = tooltip?.point === d;
          const isLast = i === n - 1;
          const showDot = isLast || isHovered || n <= 14;
          return (
            <g key={i}>
              {showDot && (
                <circle
                  cx={cx} cy={cy}
                  r={isHovered ? 4 : isLast ? 3 : 1.5}
                  fill={isHovered ? '#f59e0b' : d.confiable ? '#f59e0b' : '#f59e0b'}
                  stroke={isHovered ? '#0f172a' : 'none'}
                  strokeWidth={isHovered ? 2 : 0}
                  opacity={isHovered || isLast ? 1 : 0.5}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={(e) => setTooltip({ x: cx, y: cy, point: d })}
                />
              )}
              {/* X-axis labels (sparse) */}
              {n <= 14 && (
                <text
                  x={cx} y={H - 4}
                  textAnchor="middle"
                  fill="#64748b" fontSize="6" fontFamily="monospace"
                >
                  {formatDate(d.fecha)}
                </text>
              )}
            </g>
          );
        })}

        {/* Gradient def */}
        <defs>
          <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
          </linearGradient>
        </defs>
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute pointer-events-none z-50 rounded px-2 py-1.5 text-[9px] font-mono"
          style={{
            backgroundColor: '#1e293b',
            border: '1px solid rgba(148,163,184,0.2)',
            left: `${(tooltip.x / VB_W) * 100}%`,
            top: `${(tooltip.y / H) * 100}%`,
            transform: 'translate(-50%, -110%)',
            color: '#e2e8f0',
          }}
        >
          <div style={{ color: '#94a3b8', marginBottom: '2px' }}>{tooltip.point.fecha}</div>
          <div>{formatNum(tooltip.point.valor)} {unidad}</div>
          <div style={{ color: tooltip.point.confiable ? '#10b981' : '#f59e0b', marginTop: '1px' }}>
            {tooltip.point.confiable ? 'Confiable' : 'Dudoso'}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────

export function IndicadorChart({
  indicadorSlug,
  indicadorNombre,
  unidad = '',
  defaultDays = 7,
}: IndicadorSummaryProps) {
  const [period, setPeriod] = useState(defaultDays);
  const [history, setHistory] = useState<IndicadorHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(async (days: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithTimeout(`/api/indicadores/${indicadorSlug}/history?dias=${days}`, { timeout: 10000 });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const data: IndicadorHistory = await res.json();
      setHistory(data);
    } catch (e) {
      setError('No se pudo cargar el historial');
      console.warn('[IndicadorChart]', e);
    } finally {
      setLoading(false);
    }
  }, [indicadorSlug]);

  useEffect(() => {
    loadHistory(period);
  }, [period, loadHistory]);

  if (loading && !history) {
    return (
      <div className="rounded p-3 text-center" style={{ backgroundColor: 'rgba(148,163,184,0.05)', border: '1px solid rgba(148,163,184,0.1)' }}>
        <p className="text-[10px] font-mono text-slate-500">Cargando indicador {indicadorNombre}...</p>
      </div>
    );
  }

  if (error || !history?.data.length) {
    return null;
  }

  const stats = calcStats(history.data);
  const isPositive = stats.variacion >= 0;
  const variationColor = isPositive ? '#10b981' : '#ef4444';

  return (
    <div
      className="rounded overflow-hidden"
      style={{
        backgroundColor: 'rgba(15,23,42,0.4)',
        border: '1px solid rgba(148,163,184,0.1)',
      }}
    >
      {/* Header: name + period selector */}
      <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: '1px solid rgba(148,163,184,0.08)' }}>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold font-mono uppercase text-slate-300">{indicadorNombre}</span>
          {unidad && <span className="text-[9px] font-mono text-slate-500">{unidad}</span>}
          <span className="text-[8px] font-mono text-slate-600">{history.dias} registros</span>
        </div>
        <div className="flex gap-1">
          {PERIODS.map(p => (
            <button
              key={p.days}
              onClick={() => setPeriod(p.days)}
              className="px-2 py-0.5 rounded text-[9px] font-bold font-mono transition-all cursor-pointer"
              style={{
                backgroundColor: period === p.days ? 'rgba(245,158,11,0.15)' : 'transparent',
                color: period === p.days ? '#f59e0b' : '#64748b',
                border: `1px solid ${period === p.days ? 'rgba(245,158,11,0.3)' : 'rgba(148,163,184,0.1)'}`,
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats row */}
      <div className="flex gap-2 px-3 py-2 flex-wrap" style={{ borderBottom: '1px solid rgba(148,163,184,0.06)' }}>
        <StatCard label="Actual" value={formatNum(stats.actual)} color="#f59e0b" />
        <StatCard label="Promedio" value={formatNum(stats.promedio)} color="#94a3b8" />
        <StatCard label="Max" value={formatNum(stats.max)} color="#10b981" subtext={formatDate(stats.maxFecha)} />
        <StatCard label="Min" value={formatNum(stats.min)} color="#ef4444" subtext={formatDate(stats.minFecha)} />
        <StatCard
          label="Variacion"
          value={`${isPositive ? '+' : ''}${formatNum(stats.variacion)}%`}
          color={variationColor}
        />
      </div>

      {/* Chart — pure SVG, no recharts */}
      <div className="px-1 py-1">
        <SparklineChart data={history.data} promedio={stats.promedio} unidad={unidad} />
      </div>

      {/* Data table */}
      <div className="px-3 pb-2 max-h-[120px] overflow-y-auto custom-scrollbar">
        <table className="w-full text-[9px] font-mono">
          <thead>
            <tr className="text-slate-500 uppercase tracking-wider">
              <th className="text-left py-1 pr-2">Fecha</th>
              <th className="text-right py-1 pr-2">Valor</th>
              <th className="text-center py-1">Estado</th>
            </tr>
          </thead>
          <tbody>
            {history.data.slice(0, 15).map((d, i) => (
              <tr key={d.fecha + i} style={{ borderBottom: '1px solid rgba(148,163,184,0.04)' }}>
                <td className="py-1 pr-2 text-slate-400">{d.fecha}</td>
                <td className="py-1 pr-2 text-right text-slate-300 font-medium">
                  {formatNum(d.valor)}
                  {unidad && <span className="text-slate-500 ml-0.5">{unidad}</span>}
                </td>
                <td className="py-1 text-center">
                  <span style={{ color: d.confiable ? '#10b981' : '#f59e0b' }}>
                    {d.confiable ? '\u25CF' : '\u25D0'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Multi-Indicator List ─────────────────────────────────────────────

interface IndicadorListProps {
  indicadores: Array<{ slug: string; nombre: string; unidad?: string }>;
  defaultDays?: number;
}

export function IndicadorChartList({ indicadores, defaultDays = 7 }: IndicadorListProps) {
  if (!indicadores.length) return null;
  return (
    <div className="space-y-3">
      <p className="text-[9px] font-bold uppercase font-mono text-cyan-500/60 tracking-wider">
        Indicadores de presencia
      </p>
      {indicadores.map(ind => (
        <IndicadorChart
          key={ind.slug}
          indicadorSlug={ind.slug}
          indicadorNombre={ind.nombre}
          unidad={ind.unidad}
          defaultDays={defaultDays}
        />
      ))}
    </div>
  );
}