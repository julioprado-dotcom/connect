'use client';

import React from 'react';
import { PanelShell } from './VitalMonitor';

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

interface NivelItem { nivel: number; total: number }
interface SentimientoItem { sentimiento: string; total: number }
interface TipoMencionItem { tipoMencion: string; total: number }

interface MiniChartsProps {
  porNivel?: NivelItem[];
  porSentimiento?: SentimientoItem[];
  porTipoMencion?: TipoMencionItem[];
  totalMenciones?: number;
}

// ═══════════════════════════════════════════════════════════════
// Labels
// ═══════════════════════════════════════════════════════════════

const NIVEL_LABELS: Record<number, string> = {
  1: 'N1', 2: 'N2', 3: 'N3', 4: 'N4', 5: 'N5',
};

const SENTIMIENTO_LABELS: Record<string, string> = {
  positivo: 'Pos', negativo: 'Neg', neutral: 'Neu', mixto: 'Mix',
};

// ═══════════════════════════════════════════════════════════════
// Thin Bars — monochrome cyan, 2px height
// ═══════════════════════════════════════════════════════════════

function ThinBars({
  data,
  title,
}: {
  data: Array<{ label: string; value: number }>;
  title: string;
}) {
  const maxVal = Math.max(...data.map(d => d.value), 1);

  return (
    <div>
      <p className="text-[9px] font-bold uppercase tracking-widest text-slate-600 font-mono mb-1.5">
        {title}
      </p>
      {data.length === 0 ? (
        <p className="text-[9px] font-mono text-slate-700 py-1">—</p>
      ) : (
        <div className="space-y-1">
          {data.map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-[9px] font-mono text-slate-600 w-[28px] flex-shrink-0 text-right">
                {item.label}
              </span>
              <div className="flex-1 h-[2px] rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.03)' }}>
                <div
                  className="h-full rounded-full transition-all duration-700 ease-out"
                  style={{
                    width: `${(item.value / maxVal) * 100}%`,
                    minWidth: item.value > 0 ? '3px' : '0px',
                    backgroundColor: 'rgba(6,182,212,0.35)',
                  }}
                />
              </div>
              <span className="text-[9px] font-mono tabular-nums text-slate-500 w-[32px] flex-shrink-0 text-right">
                {item.value.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Sentiment Ring — thin SVG ring, monochrome
// ═══════════════════════════════════════════════════════════════

function SentimentRing({
  data,
  total,
}: {
  data: Array<{ label: string; value: number }>;
  total: number;
}) {
  if (data.length === 0 || total === 0) {
    return (
      <div>
        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-600 font-mono mb-1.5">
          Sentimiento
        </p>
        <p className="text-[9px] font-mono text-slate-700 py-1">—</p>
      </div>
    );
  }

  // Build arcs
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  let accumulated = 0;
  const arcs = data.map(d => {
    const pct = d.value / total;
    const dashLen = pct * circumference;
    const gap = circumference - dashLen;
    const offset = -accumulated * circumference;
    accumulated += pct;
    return { ...d, pct, dashLen, gap, offset };
  });

  return (
    <div>
      <p className="text-[9px] font-bold uppercase tracking-widest text-slate-600 font-mono mb-1.5">
        Sentimiento
      </p>
      <div className="flex items-center gap-3">
        {/* Ring */}
        <div className="relative flex-shrink-0">
          <svg width="56" height="56" viewBox="0 0 56 56" className="-rotate-90">
            {/* Background track */}
            <circle cx="28" cy="28" r={radius} fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="2" />
            {/* Arcs */}
            {arcs.map((arc, i) => (
              <circle
                key={i}
                cx="28" cy="28" r={radius}
                fill="none"
                stroke="rgba(6,182,212,0.3)"
                strokeWidth="2"
                strokeDasharray={`${arc.dashLen} ${arc.gap}`}
                strokeDashoffset={arc.offset}
                strokeLinecap="round"
              />
            ))}
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[10px] font-mono tabular-nums text-slate-400">
              {total.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Legend */}
        <div className="space-y-0.5 flex-1">
          {arcs.map((arc, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: 'rgba(6,182,212,0.35)' }} />
              <span className="text-[9px] font-mono text-slate-500">{arc.label}</span>
              <span className="text-[9px] font-mono tabular-nums text-slate-600 ml-auto">
                {(arc.pct * 100).toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MiniCharts — Main
// ═══════════════════════════════════════════════════════════════

export function MiniCharts({ porNivel, porSentimiento, porTipoMencion, totalMenciones = 0 }: MiniChartsProps) {
  const nivelData = (porNivel || []).map(item => ({
    label: NIVEL_LABELS[item.nivel] || `N${item.nivel}`,
    value: item.total,
  }));

  const sentimientoData = (porSentimiento || []).map(item => ({
    label: SENTIMIENTO_LABELS[item.sentimiento] || item.sentimiento,
    value: item.total,
  }));
  const sentimientoTotal = sentimientoData.reduce((s, d) => s + d.value, 0);

  const tipoData = (porTipoMencion || []).map(item => ({
    label: item.tipoMencion.length > 12 ? item.tipoMencion.slice(0, 11) + '..' : item.tipoMencion,
    value: item.total,
  }));

  return (
    <PanelShell
      title="Graficos"
      icon={
        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 3v18h18" /><path d="M7 16l4-8 4 4 4-6" />
        </svg>
      }
    >
      <div className="space-y-4">
        {/* Sentiment */}
        <SentimentRing data={sentimientoData} total={sentimientoTotal} />

        {/* Thin separator */}
        <div className="h-[1px]" style={{ background: 'rgba(6,182,212,0.06)' }} />

        {/* Nivel bars */}
        <ThinBars data={nivelData} title="Nivel de Medio" />

        {/* Tipo Mencion — only if has data */}
        {tipoData.length > 0 && (
          <>
            <div className="h-[1px]" style={{ background: 'rgba(6,182,212,0.06)' }} />
            <ThinBars data={tipoData} title="Tipo de Mencion" />
          </>
        )}

        {/* Total footer */}
        {totalMenciones > 0 && (
          <div className="pt-2 flex items-center justify-between" style={{ borderTop: '1px solid rgba(6,182,212,0.04)' }}>
            <span className="text-[8px] font-mono text-slate-700 uppercase tracking-widest">Total</span>
            <span className="text-[9px] font-mono tabular-nums text-slate-500">{totalMenciones.toLocaleString()}</span>
          </div>
        )}
      </div>
    </PanelShell>
  );
}
