'use client';

import { useState, useEffect, useCallback } from 'react';
import { Activity, Cpu, DollarSign, Zap } from 'lucide-react';
import { PanelShell } from '@/components/onion200/PanelShell';

interface AiUsageData {
  totales: { llamadas: number; promptTokens: number; completionTokens: number; totalTokens: number; costoUSD: number };
  hoy: { llamadas: number; totalTokens: number; costoUSD: number };
  porFuente: Array<{ fuente: string; llamadas: number; totalTokens: number; costoUSD: number }>;
  porDia: Array<{ fecha: string; llamadas: number; totalTokens: number; costoUSD: number }>;
}

const FUENTE_LABELS: Record<string, string> = {
  captura: 'Captura',
  clasificacion: 'Clasificacion',
  deduplicacion: 'Deduplicacion',
  discovery: 'Discovery',
  generacion: 'Generacion',
  instruccion: 'Instruccion',
  signal: 'Signal',
  medio_analyze: 'Medio AI',
};

const FUENTE_COLORS: Record<string, string> = {
  captura: '#06b6d4',
  clasificacion: '#10b981',
  deduplicacion: '#f59e0b',
  discovery: '#8b5cf6',
  generacion: '#ec4899',
  instruccion: '#3b82f6',
  signal: '#f97316',
  medio_analyze: '#14b8a6',
};

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function AiUsagePanel() {
  const [data, setData] = useState<AiUsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dias, setDias] = useState(7);

  const fetchUsage = useCallback(async () => {
    try {
      const res = await fetch(`/api/dashboard/ai/usage?dias=${dias}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.warn('[AiUsagePanel] fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [dias]);

  useEffect(() => {
    fetchUsage();
    const interval = setInterval(fetchUsage, 60000); // cada 60s
    return () => clearInterval(interval);
  }, [fetchUsage]);

  if (loading || !data) {
    return (
      <PanelShell title="Uso de IA" icon={<Cpu className="w-4 h-4" />}>
        <div className="flex items-center justify-center py-6 text-slate-600 text-[10px] font-mono">
          <Activity className="w-3 h-3 mr-2 animate-pulse" />
          Cargando...
        </div>
      </PanelShell>
    );
  }

  const maxTokensFuente = Math.max(...data.porFuente.map(f => f.totalTokens), 1);

  return (
    <PanelShell title="Uso de IA" icon={<Cpu className="w-4 h-4" />}>
      {/* Selector de período */}
      <div className="flex items-center gap-2 mb-3">
        {[
          { label: 'Hoy', value: 1 },
          { label: '3d', value: 3 },
          { label: '7d', value: 7 },
          { label: '30d', value: 30 },
        ].map(opt => (
          <button
            key={opt.value}
            onClick={() => setDias(opt.value)}
            className="text-[8px] font-mono px-1.5 py-0.5 rounded transition-colors"
            style={{
              color: dias === opt.value ? '#06b6d4' : '#475569',
              backgroundColor: dias === opt.value ? 'rgba(6,182,212,0.08)' : 'transparent',
              border: dias === opt.value ? '1px solid rgba(6,182,212,0.2)' : '1px solid transparent',
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* KPIs principales */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="text-center p-2 rounded" style={{ backgroundColor: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.03)' }}>
          <div className="text-[8px] font-mono text-slate-500 uppercase mb-1">Llamadas</div>
          <div className="text-sm font-bold font-mono" style={{ color: '#06b6d4' }}>
            {dias === 1 ? data.hoy.llamadas.toLocaleString() : data.totales.llamadas.toLocaleString()}
          </div>
        </div>
        <div className="text-center p-2 rounded" style={{ backgroundColor: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.03)' }}>
          <div className="text-[8px] font-mono text-slate-500 uppercase mb-1">Tokens</div>
          <div className="text-sm font-bold font-mono" style={{ color: '#10b981' }}>
            {formatTokens(dias === 1 ? data.hoy.totalTokens : data.totales.totalTokens)}
          </div>
        </div>
        <div className="text-center p-2 rounded" style={{ backgroundColor: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.03)' }}>
          <div className="text-[8px] font-mono text-slate-500 uppercase mb-1">Costo</div>
          <div className="text-sm font-bold font-mono" style={{ color: '#f59e0b' }}>
            ${dias === 1 ? data.hoy.costoUSD.toFixed(2) : data.totales.costoUSD.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Desglose por fuente (barras) */}
      <div className="space-y-1.5">
        <div className="text-[8px] font-mono text-slate-600 uppercase tracking-wider">Por fuente</div>
        {data.porFuente.length === 0 ? (
          <div className="text-[9px] font-mono text-slate-600 py-2 text-center">Sin datos</div>
        ) : (
          data.porFuente.map(f => (
            <div key={f.fuente} className="flex items-center gap-2">
              <div className="text-[8px] font-mono w-16 truncate" style={{ color: FUENTE_COLORS[f.fuente] || '#64748b' }}>
                {FUENTE_LABELS[f.fuente] || f.fuente}
              </div>
              <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.03)' }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.max(2, (f.totalTokens / maxTokensFuente) * 100)}%`,
                    backgroundColor: FUENTE_COLORS[f.fuente] || '#64748b',
                    opacity: 0.7,
                  }}
                />
              </div>
              <div className="text-[8px] font-mono text-slate-500 w-10 text-right">
                {formatTokens(f.totalTokens)}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Últimos días (sparkline) */}
      {data.porDia.length > 1 && (
        <div className="mt-3 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.03)' }}>
          <div className="text-[8px] font-mono text-slate-600 uppercase tracking-wider mb-1.5">Tendencia ({dias}d)</div>
          <div className="flex items-end gap-0.5 h-8">
            {[...data.porDia].reverse().map((d, i) => {
              const maxLlamadas = Math.max(...data.porDia.map(x => x.llamadas), 1);
              const height = Math.max(2, (d.llamadas / maxLlamadas) * 100);
              return (
                <div key={d.fecha} className="flex-1 flex flex-col items-center gap-0.5">
                  <div
                    className="w-full rounded-t transition-all duration-300"
                    style={{ height: `${height}%`, backgroundColor: '#06b6d4', opacity: 0.5 + (i / data.porDia.length) * 0.5, minHeight: 2 }}
                  />
                  <div className="text-[6px] font-mono text-slate-600" style={{ transform: 'rotate(-45deg)', transformOrigin: 'top' }}>
                    {d.fecha?.substring(5) || ''}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modelo */}
      <div className="mt-2 flex items-center gap-1.5 text-[8px] font-mono text-slate-600">
        <Zap className="w-2.5 h-2.5" />
        glm-4.7-flash · Free tier
      </div>
    </PanelShell>
  );
}
