'use client';

import React from 'react';
import { getEstadoColor, getEstadoLabel, NATURALEZA_COLORS } from './FuentesView.types';

// ═══════════════════════════════════════════════════════════════
// SkeletonRow — loading placeholder row
// ═══════════════════════════════════════════════════════════════

export function SkeletonRow() {
  const widths = [75, 50, 40, 60, 55, 45];
  return (
    <tr className="border-b border-slate-800/40">
      {Array.from({ length: 6 }).map((_, i) => (
        <td key={i} className="px-3 py-2.5">
          <div
            className="h-3 rounded-sm animate-pulse"
            style={{
              backgroundColor: 'rgba(6,182,212,0.05)',
              width: widths[i] + '%',
            }}
          />
        </td>
      ))}
    </tr>
  );
}

// ═══════════════════════════════════════════════════════════════
// StatusBadge — shows active/inactive/error status
// ═══════════════════════════════════════════════════════════════

export function StatusBadge({ activo, ultimoError }: { activo: boolean; ultimoError: string }) {
  const { text, bg, border, blink } = getEstadoColor(activo, ultimoError);
  const label = getEstadoLabel(activo, ultimoError);
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase tracking-wider"
      style={{
        color: text,
        backgroundColor: bg,
        border: '1px solid ' + border,
        animation: blink ? 'errorBlink 2s ease-in-out infinite' : undefined,
      }}
    >
      {label}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════
// NaturalezaBadge — shows naturaleza classification
// ═══════════════════════════════════════════════════════════════

export function NaturalezaBadge({ naturaleza }: { naturaleza: string }) {
  const colors = NATURALEZA_COLORS[naturaleza] || {
    text: '#64748b',
    bg: 'rgba(100,116,139,0.06)',
    border: 'rgba(100,116,139,0.15)',
  };
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold font-mono uppercase tracking-wider"
      style={{
        color: colors.text,
        backgroundColor: colors.bg,
        border: '1px solid ' + colors.border,
      }}
    >
      {naturaleza || 'SIN CLASIFICAR'}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════
// CredibilidadBar — horizontal credibility indicator
// ═══════════════════════════════════════════════════════════════

export function CredibilidadBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  const color = pct >= 70 ? '#06b6d4' : pct >= 40 ? '#f59e0b' : '#8b5cf6';
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div
        className="flex-1 h-1.5 rounded-full overflow-hidden"
        style={{ backgroundColor: 'rgba(6,182,212,0.06)' }}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: pct + '%',
            backgroundColor: color,
            boxShadow: '0 0 6px ' + color + '40',
          }}
        />
      </div>
      <span
        className="text-[10px] font-mono font-bold tabular-nums min-w-[24px] text-right"
        style={{ color }}
      >
        {pct}
      </span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// StatBox — summary stat display
// ═══════════════════════════════════════════════════════════════

export function StatBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="text-center py-1">
      <p className="text-[9px] font-bold uppercase text-slate-600 font-mono">{label}</p>
      <p className="text-lg font-bold font-mono tabular-nums" style={{ color }}>
        {value}
      </p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// FormInput — text input for edit form
// ═══════════════════════════════════════════════════════════════

export function FormInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-[9px] font-bold uppercase tracking-widest text-slate-600 font-mono mb-2">
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-md text-[11px] font-mono text-slate-300 outline-none transition-all duration-200"
        style={{
          backgroundColor: 'rgba(0,0,0,0.4)',
          border: '1px solid rgba(6,182,212,0.08)',
        }}
        onFocus={(e) => {
          (e.target as HTMLInputElement).style.borderColor = 'rgba(6,182,212,0.25)';
          (e.target as HTMLInputElement).style.boxShadow = '0 0 8px rgba(6,182,212,0.06)';
        }}
        onBlur={(e) => {
          (e.target as HTMLInputElement).style.borderColor = 'rgba(6,182,212,0.08)';
          (e.target as HTMLInputElement).style.boxShadow = 'none';
        }}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// FormSelect — dropdown select for edit form
// ═══════════════════════════════════════════════════════════════

export function FormSelect({
  label,
  value,
  options,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  placeholder: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-[9px] font-bold uppercase tracking-widest text-slate-600 font-mono mb-2">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-md text-[11px] font-mono text-slate-300 outline-none transition-all duration-200 appearance-none cursor-pointer"
        style={{
          backgroundColor: 'rgba(0,0,0,0.4)',
          border: '1px solid rgba(6,182,212,0.08)',
        }}
        onFocus={(e) => {
          (e.target as HTMLSelectElement).style.borderColor = 'rgba(6,182,212,0.25)';
          (e.target as HTMLSelectElement).style.boxShadow = '0 0 8px rgba(6,182,212,0.06)';
        }}
        onBlur={(e) => {
          (e.target as HTMLSelectElement).style.borderColor = 'rgba(6,182,212,0.08)';
          (e.target as HTMLSelectElement).style.boxShadow = 'none';
        }}
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
}
