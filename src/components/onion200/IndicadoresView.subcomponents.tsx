'use client';

import React from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { TIER_CONFIG } from './IndicadoresView.types';
import type { EnrichedIndicador } from './IndicadoresView.types';

// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('es-BO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
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
      className="rounded-lg px-4 py-3 flex items-center gap-3"
      style={{
        background: 'rgba(5, 5, 5, 0.8)',
        border: '1px solid ' + color + '15',
        boxShadow: '0 0 12px ' + color + '06',
      }}
    >
      <span style={{ color: color + '80' }}>{icon}</span>
      <div>
        <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-600 font-mono">
          {label}
        </p>
        <p
          className="text-lg font-bold font-mono tabular-nums leading-none"
          style={{ color }}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

export function TierBadge({ tier }: { tier: number }) {
  const cfg = TIER_CONFIG[tier] || TIER_CONFIG[3];
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold font-mono uppercase tracking-wider"
      style={{
        color: cfg.color,
        backgroundColor: cfg.color + '12',
        border: '1px solid ' + cfg.color + '25',
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
      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
      style={{
        backgroundColor: color,
        boxShadow: '0 0 4px ' + color + '50',
      }}
      title={confiable ? 'Dato confiable' : 'Dato fallback (sin verificar)'}
    />
  );
}

export function SkeletonCard() {
  return (
    <div
      className="rounded-lg p-4 animate-pulse"
      style={{
        background: 'rgba(5, 5, 5, 0.8)',
        border: '1px solid rgba(6, 182, 212, 0.08)',
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <div
          className="h-3 rounded-sm"
          style={{ backgroundColor: 'rgba(6, 182, 212, 0.08)', width: '60%' }}
        />
        <div
          className="h-4 rounded-sm"
          style={{ backgroundColor: 'rgba(6, 182, 212, 0.06)', width: '40px' }}
        />
      </div>
      <div
        className="h-6 rounded-sm mb-2"
        style={{ backgroundColor: 'rgba(6, 182, 212, 0.06)', width: '45%' }}
      />
      <div
        className="h-2.5 rounded-sm"
        style={{ backgroundColor: 'rgba(6, 182, 212, 0.04)', width: '30%' }}
      />
    </div>
  );
}

export function ProgressBar({ elapsed, maxDuration }: { elapsed: number; maxDuration: number }) {
  const pct = Math.min(100, (elapsed / maxDuration) * 100);
  return (
    <div
      className="w-full h-1 rounded-full overflow-hidden"
      style={{ backgroundColor: 'rgba(6, 182, 212, 0.08)' }}
    >
      <div
        className="h-full rounded-full transition-all duration-1000 ease-linear"
        style={{
          width: pct + '%',
          backgroundColor: '#06b6d4',
          boxShadow: '0 0 6px rgba(6, 182, 212, 0.3)',
        }}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Indicator Card — individual indicator display
// ═══════════════════════════════════════════════════════════════

export function IndicatorCard({
  indicador,
  syncing,
  onSync,
  catColor,
}: {
  indicador: EnrichedIndicador;
  syncing: boolean;
  onSync: (slug: string) => void;
  catColor: string;
}) {
  const uv = indicador.ultimoValor;
  const ue = indicador.ultimaEvaluacion;
  const hasData = uv || ue;

  // Determine display value and variation
  let displayValue = '---';
  let variation: 'up' | 'down' | 'stable' | null = null;

  if (uv) {
    displayValue = uv.valor;
    // We don't have a previous value from the API, so we show neutral arrow
    // Variation could be computed if we had historical data, but the current API
    // only returns the last value. Show confiable as proxy.
    variation = 'stable';
  } else if (ue) {
    displayValue = ue.valorTexto;
    variation = null;
  }

  const variationArrow = variation === 'up' ? '\u2191' : variation === 'down' ? '\u2193' : variation === 'stable' ? '\u2192' : '';
  const variationColor = variation === 'up' ? '#10b981' : variation === 'down' ? '#ef4444' : '#64748b';

  const isCuantitativo = indicador.tipo === 'cuantitativo';

  return (
    <div
      className="rounded-lg p-3 sm:p-4 relative overflow-hidden transition-all duration-200 group"
      style={{
        background: 'rgba(5, 5, 5, 0.8)',
        border: '1px solid ' + catColor + '10',
        boxShadow: '0 0 12px ' + catColor + '04',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = catColor + '25';
        (e.currentTarget as HTMLElement).style.boxShadow = '0 0 16px ' + catColor + '08';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = catColor + '10';
        (e.currentTarget as HTMLElement).style.boxShadow = '0 0 12px ' + catColor + '04';
      }}
    >
      {/* Scan line */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(6,182,212,0.008) 3px, rgba(6,182,212,0.008) 4px)',
        }}
      />

      <div className="relative z-10">
        {/* Header: name + tier + sync */}
        <div className="flex items-center justify-between mb-2 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <ConfiableDot confiable={uv?.confiable} />
            <h4
              className="text-[11px] font-bold font-mono uppercase tracking-wider truncate"
              style={{ color: '#cbd5e1' }}
            >
              {indicador.nombre}
            </h4>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <TierBadge tier={indicador.tier} />
            <button
              onClick={() => onSync(indicador.slug)}
              disabled={syncing}
              className="p-1 rounded transition-all duration-200 disabled:opacity-30 hover:bg-white/5"
              title={syncing ? 'Sincronizando...' : 'Sincronizar indicador'}
            >
              {syncing ? (
                <Loader2 className="w-3 h-3 animate-spin" style={{ color: '#06b6d4' }} />
              ) : (
                <RefreshCw
                  className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity"
                  style={{ color: '#06b6d4' }}
                />
              )}
            </button>
          </div>
        </div>

        {/* Value */}
        <div className="flex items-baseline gap-2 mb-1.5">
          <span
            className="text-xl sm:text-2xl font-bold font-mono tabular-nums leading-none"
            style={{ color: hasData ? '#e5e5e5' : '#334155' }}
          >
            {displayValue}
          </span>
          {variationArrow && (
            <span className="text-sm font-mono" style={{ color: variationColor }}>
              {variationArrow}
            </span>
          )}
          {indicador.unidad && (
            <span className="text-[9px] font-mono text-slate-600 uppercase tracking-wider">
              {indicador.unidad}
            </span>
          )}
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-3 text-[9px] font-mono text-slate-600">
          {indicador.fuente && (
            <span className="truncate max-w-[120px]" title={indicador.fuente}>
              {indicador.fuente}
            </span>
          )}
          {isCuantitativo && uv && (
            <span>
              {indicador.totalValores} datos
            </span>
          )}
          {!isCuantitativo && ue && (
            <span>
              {indicador.totalEvaluaciones} eval.
            </span>
          )}
          {uv?.fecha && (
            <span className="ml-auto flex-shrink-0">
              {formatDate(uv.fecha)}
            </span>
          )}
        </div>

        {/* Evaluacion badge for cualitativo */}
        {ue && (
          <div className="mt-2">
            <span
              className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold font-mono uppercase tracking-wider"
              style={{
                color: ue.escalaNivel === 'critico' ? '#ef4444' : ue.escalaNivel === 'alto' ? '#f59e0b' : ue.escalaNivel === 'bajo' ? '#10b981' : '#06b6d4',
                backgroundColor: (ue.escalaNivel === 'critico' ? '#ef4444' : ue.escalaNivel === 'alto' ? '#f59e0b' : ue.escalaNivel === 'bajo' ? '#10b981' : '#06b6d4') + '12',
                border: '1px solid ' + (ue.escalaNivel === 'critico' ? '#ef4444' : ue.escalaNivel === 'alto' ? '#f59e0b' : ue.escalaNivel === 'bajo' ? '#10b981' : '#06b6d4') + '25',
              }}
            >
              {ue.escalaNivel} · {ue.valorCompuesto.toFixed(1)}
            </span>
          </div>
        )}

        {/* Bottom glow */}
        <div
          className="absolute bottom-0 left-0 right-0 h-[1px]"
          style={{
            background: 'linear-gradient(90deg, transparent 5%, ' + catColor + '15 50%, transparent 95%)',
          }}
        />
      </div>
    </div>
  );
}
