'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { fetchWithTimeout } from '@/lib/fetch-utils';
import { Radio, Newspaper, RefreshCw } from 'lucide-react';
import { PanelShell } from './VitalMonitor';

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

interface MencionReciente {
  id: string;
  titulo: string;
  fechaCaptura: string;
  sentimiento: string;
  tipoMencion: string;
  Persona?: { nombre: string; partidoSigla: string; camara: string } | null;
  Medio?: { nombre: string; tipo: string } | null;
}

// ═══════════════════════════════════════════════════════════════
// Sentiment badge color
// ═══════════════════════════════════════════════════════════════

function sentimentColor(s: string): string {
  if (s.includes('positivo')) return '#10b981';
  if (s.includes('negativo')) return '#f43f5e';
  return '#64748b';
}

function sentimentLabel(s: string): string {
  if (s.includes('positivo')) return 'POS';
  if (s.includes('negativo')) return 'NEG';
  if (s.includes('neutro')) return 'NEU';
  return '---';
}

// ═══════════════════════════════════════════════════════════════
// Relative time in Spanish
// ═══════════════════════════════════════════════════════════════

function tiempoRelativo(fechaStr: string): string {
  const fecha = new Date(fechaStr);
  const ms = Date.now() - fecha.getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'ahora mismo';
  if (mins < 60) return `hace ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs}h`;
  const dias = Math.floor(hrs / 24);
  return `hace ${dias}d`;
}

// ═══════════════════════════════════════════════════════════════
// LiveFeed — Real-time mention ticker
// ═══════════════════════════════════════════════════════════════

export function LiveFeed() {
  const [menciones, setMenciones] = useState<MencionReciente[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalToday, setTotalToday] = useState<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(null);

  const fetchData = useCallback(async () => {
    try {
      // Fetch last 5 menciones with persona and medio
      const res = await fetchWithTimeout(
        '/api/menciones?limit=5&orderBy=fechaCaptura&orderDir=desc',
        { timeoutMs: 8000 }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (Array.isArray(data.menciones)) {
        setMenciones(data.menciones);
        setTotalToday(data.total ?? null);
        setError(null);
      } else if (Array.isArray(data)) {
        // Fallback if endpoint returns array directly
        setMenciones(data.slice(0, 5));
        setError(null);
      }
      setLoading(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error de conexion');
      setLoading(false);
    }
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setTimeout(() => setRefreshing(false), 500);
  };

  useEffect(() => {
    fetchData();
    intervalRef.current = setInterval(fetchData, 30000); // Poll every 30s
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchData]);

  return (
    <PanelShell title="Flujo en Vivo" icon={<Radio className="w-4 h-4" />} className="relative">
      {/* Refresh button */}
      <button
        onClick={handleRefresh}
        disabled={refreshing}
        className="absolute top-3 right-3 z-10 flex items-center gap-1 px-2 py-1 rounded text-[9px] font-mono uppercase tracking-wider transition-all hover:bg-slate-800/40 disabled:opacity-40"
        style={{ color: '#06b6d4', border: '1px solid rgba(6,182,212,0.15)' }}
        title="Refrescar menciones"
      >
        <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
      </button>

      {loading && menciones.length === 0 ? (
        <div className="flex items-center gap-2 py-6 text-slate-600 text-xs font-mono justify-center">
          <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
          Escaneando frecuencias...
        </div>
      ) : error && menciones.length === 0 ? (
        <div className="flex items-center gap-2 py-4 text-red-400/70 text-xs font-mono">
          <span className="w-2 h-2 rounded-full bg-red-500" />
          Sin señal — {error}
        </div>
      ) : menciones.length === 0 ? (
        <div className="flex items-center gap-2 py-6 text-slate-600 text-xs font-mono justify-center">
          <Newspaper className="w-4 h-4" />
          Sin menciones capturadas aun
        </div>
      ) : (
        <div className="space-y-2">
          {/* Total counter */}
          {totalToday !== null && (
            <div className="flex items-center gap-2 mb-2 px-1">
              <span className="text-[9px] font-bold uppercase text-slate-600 font-mono">
                Total en BD:
              </span>
              <span className="text-xs font-mono text-cyan-400 tabular-nums">
                {totalToday}
              </span>
            </div>
          )}

          {/* Mention cards */}
          <div className="space-y-1.5">
            {menciones.map((m, i) => (
              <div
                key={m.id}
                className="group relative rounded-md px-3 py-2.5 transition-all duration-200"
                style={{
                  background:
                    i === 0
                      ? 'rgba(6, 182, 212, 0.06)'
                      : 'rgba(255, 255, 255, 0.01)',
                  border: `1px solid ${
                    i === 0
                      ? 'rgba(6, 182, 212, 0.15)'
                      : 'rgba(255, 255, 255, 0.04)'
                  }`,
                }}
              >
                {/* Top row: persona + medio */}
                <div className="flex items-center gap-2 mb-1">
                  {m.Persona?.nombre ? (
                    <span className="text-[10px] font-bold font-mono text-emerald-400 truncate max-w-[120px]">
                      {m.Persona.nombre}
                      {m.Persona.partidoSigla && (
                        <span className="text-slate-600 ml-1">
                          ({m.Persona.partidoSigla})
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono text-slate-600 italic">
                      Sin persona
                    </span>
                  )}
                  <span className="text-slate-700">·</span>
                  <span className="text-[10px] font-mono text-slate-500 truncate max-w-[120px]">
                    {m.Medio?.nombre || 'Medio desconocido'}
                  </span>
                  {/* Sentiment badge */}
                  <span
                    className="ml-auto text-[9px] font-bold font-mono px-1.5 py-0.5 rounded"
                    style={{
                      color: sentimentColor(m.sentimiento),
                      backgroundColor: `${sentimentColor(m.sentimiento)}12`,
                      border: `1px solid ${sentimentColor(m.sentimiento)}25`,
                    }}
                  >
                    {sentimentLabel(m.sentimiento)}
                  </span>
                </div>

                {/* Title */}
                <p className="text-[11px] text-slate-300 font-mono leading-snug line-clamp-2">
                  {m.titulo || 'Sin titulo'}
                </p>

                {/* Bottom row: time + type */}
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[9px] font-mono text-slate-600">
                    {tiempoRelativo(m.fechaCaptura)}
                  </span>
                  <span className="text-slate-800">·</span>
                  <span className="text-[9px] font-mono text-slate-700 uppercase">
                    {m.tipoMencion?.replace(/_/g, ' ') || '---'}
                  </span>
                </div>

                {/* Latest indicator */}
                {i === 0 && (
                  <div
                    className="absolute left-0 top-1 bottom-1 w-[2px] rounded-full"
                    style={{
                      background:
                        'linear-gradient(180deg, #06b6d4, transparent)',
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </PanelShell>
  );
}
