'use client';

import React, { useEffect, useRef } from 'react';
import { Activity, Loader2 } from 'lucide-react';
import type { ProbeLogEntry } from './FuentesView.types';

// ═══════════════════════════════════════════════════════════════
// ProbeTerminal — inline diagnostic terminal for probing
// ═══════════════════════════════════════════════════════════════

export function ProbeTerminal({
  logs,
  probing,
}: {
  logs: ProbeLogEntry[];
  probing: boolean;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  if (logs.length === 0 && !probing) return null;

  return (
    <div
      className="rounded-md overflow-hidden mt-2"
      style={{
        backgroundColor: 'rgba(0,0,0,0.5)',
        border: '1px solid rgba(6,182,212,0.08)',
      }}
    >
      <div className="px-3 py-1.5 border-b border-slate-800/60 flex items-center gap-2">
        <Activity className="w-3 h-3 text-cyan-500/60" />
        <span className="text-[9px] font-bold uppercase tracking-widest text-slate-600 font-mono">
          Diagnostico de Conexion
        </span>
        {probing && (
          <span className="ml-auto flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin text-cyan-400" />
            <span className="text-[9px] font-mono text-cyan-400/70">Sondeando...</span>
          </span>
        )}
      </div>
      <div className="max-h-[160px] overflow-y-auto p-2 space-y-0.5 custom-scrollbar">
        {logs.map((log, i) => {
          const color =
            log.status === 'ok'
              ? '#06b6d4'
              : log.status === 'error'
                ? '#8b5cf6'
                : '#f59e0b';
          return (
            <div
              key={i}
              className="text-[9px] font-mono leading-relaxed px-1"
              style={{ color }}
            >
              <span className="text-slate-600">{'>'}</span> {log.message}
              {log.ms !== undefined && (
                <span className="text-slate-600 ml-1">({log.ms}ms)</span>
              )}
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
    </div>
  );
}
