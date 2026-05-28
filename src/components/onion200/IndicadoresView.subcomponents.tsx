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
        boxShadow: '0 0 8px ' + color + '06',
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
// Indicator Card — compact terminal-style display
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
      className="rounded p-2 relative overflow-hidden transition-all duration-150 group"
      style={{
        background: 'rgba(5, 5, 5, 0.8)',
        border: '1px solid ' + catColor + '10',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = catColor + '30';
        (e.currentTarget as HTMLElement).style.background = 'rgba(8, 8, 8, 0.95)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = catColor + '10';
        (e.currentTarget as HTMLElement).style.background = 'rgba(5, 5, 5, 0.8)';
      }}
    >
      <div className="relative z-10">
        {/* Header row: dot + name + tier + sync */}
        <div className="flex items-center gap-1.5 mb-1.5">
          <ConfiableDot confiable={uv?.confiable} />
          <h4
            className="text-[9px] font-bold font-mono uppercase tracking-wider truncate text-slate-500"
            title={indicador.nombre}
          >
            {indicador.nombre.length > 22 ? indicador.nombre.slice(0, 20) + '...' : indicador.nombre}
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
        <div className="flex items-baseline gap-1 mb-1">
          <span
            className="text-base sm:text-lg font-bold font-mono tabular-nums leading-none"
            style={{ color: hasData ? '#e5e5e5' : '#334155' }}
          >
            {displayValue}
          </span>
          {indicador.unidad && (
            <span className="text-[8px] font-mono text-slate-600 uppercase tracking-wider truncate">
              {indicador.unidad}
            </span>
          )}
        </div>

        {/* Meta: source · date — single line */}
        <div className="flex items-center gap-1.5 text-[8px] font-mono text-slate-700 leading-none">
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
