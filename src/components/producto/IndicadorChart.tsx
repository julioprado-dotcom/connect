'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
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
    ? ((actual - valores[valores.length - 1]) / valores[valores.length - 1]) * 100
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
    return null; // Don't show anything if no data
  }

  const stats = calcStats(history.data);
  // Recharts needs oldest first for proper X-axis
  const chartData = [...history.data].reverse().map(d => ({
    ...d,
    label: formatDate(d.fecha),
  }));

  const isPositive = stats.variacion >= 0;
  const variationColor = isPositive ? '#10b981' : '#ef4444';
  const lineColor = isPositive ? '#f59e0b' : '#f59e0b'; // Always amber/orange like the reference

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

      {/* Chart */}
      <div className="px-2 py-2" style={{ height: '140px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <XAxis
              dataKey="label"
              tick={{ fontSize: 9, fill: '#64748b', fontFamily: 'monospace' }}
              axisLine={{ stroke: 'rgba(148,163,184,0.15)' }}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 9, fill: '#64748b', fontFamily: 'monospace' }}
              axisLine={false}
              tickLine={false}
              domain={['auto', 'auto']}
              width={55}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1e293b',
                border: '1px solid rgba(148,163,184,0.2)',
                borderRadius: '6px',
                fontSize: '10px',
                fontFamily: 'monospace',
                padding: '6px 10px',
              }}
              labelStyle={{ color: '#94a3b8', marginBottom: '2px' }}
              formatter={(value: number) => [formatNum(value), 'Valor']}
            />
            <ReferenceLine y={stats.promedio} stroke="#475569" strokeDasharray="3 3" strokeOpacity={0.5} />
            <Line
              type="monotone"
              dataKey="valor"
              stroke={lineColor}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: lineColor, stroke: '#0f172a', strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
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
                    {d.confiable ? '●' : '◐'}
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
