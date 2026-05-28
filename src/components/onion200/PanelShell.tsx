'use client';

import React from 'react';
import { X } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════
// PanelShell — reusable sci-fi container
// ═══════════════════════════════════════════════════════════════

export function PanelShell({
  title,
  icon,
  children,
  className = '',
  onClose,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  onClose?: () => void;
}) {
  return (
    <div
      className={`rounded-lg overflow-hidden ${className}`}
      style={{
        background: 'rgba(5, 5, 5, 0.8)',
        border: '1px solid rgba(6, 182, 212, 0.2)',
        boxShadow: '0 0 24px rgba(6, 182, 212, 0.08), inset 0 1px 0 rgba(6, 182, 212, 0.1)',
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
        {/* Right side: close button or live indicator */}
        <span className="ml-auto flex items-center gap-1.5">
          {onClose ? (
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-slate-800/60 transition-colors"
              title="Cerrar"
            >
              <X className="w-3.5 h-3.5 text-slate-500 hover:text-cyan-400" />
            </button>
          ) : (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-glow-pulse" />
              <span className="text-[9px] uppercase text-emerald-400/80 font-mono">
                en vivo
              </span>
            </>
          )}
        </span>
      </div>
      {/* Content */}
      <div className="relative p-4">{children}</div>
      {/* Bottom glow line */}
      <div
        className="h-[1px]"
        style={{
          background:
            'linear-gradient(90deg, transparent 5%, rgba(6, 182, 212, 0.35) 50%, transparent 95%)',
        }}
      />
    </div>
  );
}
