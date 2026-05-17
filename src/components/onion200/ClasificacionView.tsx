'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { fetchWithTimeout } from '@/lib/fetch-utils';
import { PanelShell } from './VitalMonitor';
import {
  Crosshair,
  Brain,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Tag,
  Inbox,
  RefreshCw,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

interface MencionPendiente {
  id: string;
  titulo: string;
  texto: string;
  fechaCaptura: string;
  tipoMencion: string;
  sentimiento: string;
  Persona?: { nombre: string; partidoSigla: string } | null;
  Medio?: { nombre: string; tipo: string } | null;
}

interface BatchResult {
  analizadas: number;
  errores: number;
  totalProcesadas: number;
  detalles?: string[];
  mensaje?: string;
}

// ═══════════════════════════════════════════════════════════════
// ClasificacionView — Panel de clasificacion IA con controles
// ═══════════════════════════════════════════════════════════════

export function ClasificacionView() {
  const [menciones, setMenciones] = useState<MencionPendiente[]>([]);
  const [totalPendientes, setTotalPendientes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [classifying, setClassifying] = useState(false);
  const [batchResult, setBatchResult] = useState<BatchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchPendientes = useCallback(async () => {
    try {
      const res = await fetchWithTimeout(
        '/api/menciones?limit=50&sentimiento=no_clasificado&orderBy=fechaCaptura&orderDir=desc',
        { timeoutMs: 8000 }
      );
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.menciones)) {
          setMenciones(data.menciones);
          setTotalPendientes(data.total ?? data.menciones.length);
        } else if (Array.isArray(data)) {
          setMenciones(data);
          setTotalPendientes(data.length);
        }
        setError(null);
      }
      setLoading(false);
    } catch {
      setError('Error de conexion');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPendientes();
  }, [fetchPendientes]);

  const handleClasificar = async () => {
    setClassifying(true);
    setBatchResult(null);
    try {
      const res = await fetchWithTimeout('/api/analyze/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 20 }),
        timeoutMs: 120000, // AI classification can be slow
      });
      const data = await res.json();
      setBatchResult(data);
      // Refresh pendientes list
      setTimeout(fetchPendientes, 2000);
    } catch (e) {
      setBatchResult({
        analizadas: 0,
        errores: 1,
        totalProcesadas: 0,
        mensaje: e instanceof Error ? e.message : 'Error de conexion',
      });
    } finally {
      setClassifying(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
      {/* Left: Control panel */}
      <div className="lg:col-span-5">
        <PanelShell title="Clasificacion IA" icon={<Crosshair className="w-4 h-4" />}>
          {/* Pending count */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{
                  backgroundColor: totalPendientes > 0 ? '#f59e0b' : '#10b981',
                  boxShadow: totalPendientes > 0 ? '0 0 8px rgba(245,158,11,0.4)' : '0 0 8px rgba(16,185,129,0.4)',
                }}
              />
              <span
                className="text-[10px] font-bold font-mono px-2 py-1 rounded"
                style={{
                  color: totalPendientes > 0 ? '#f59e0b' : '#10b981',
                  backgroundColor: totalPendientes > 0 ? 'rgba(245,158,11,0.08)' : 'rgba(16,185,129,0.08)',
                  border: `1px solid ${totalPendientes > 0 ? 'rgba(245,158,11,0.2)' : 'rgba(16,185,129,0.2)'}`,
                }}
              >
                {totalPendientes} PENDIENTES
              </span>
            </div>
          </div>

          {/* Info text */}
          <div className="mb-4 px-3 py-2.5 rounded-md" style={{
            backgroundColor: 'rgba(6,182,212,0.04)',
            border: '1px solid rgba(6,182,212,0.08)',
          }}>
            <p className="text-[10px] font-mono text-slate-500 leading-relaxed">
              La clasificacion por IA analiza cada mencion pendiente y asigna: tipo de mencion,
              sentimiento, ejes tematicos y personajes relacionados.
            </p>
          </div>

          {/* Classify button */}
          <button
            onClick={handleClasificar}
            disabled={classifying || totalPendientes === 0}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg text-sm font-bold font-mono uppercase tracking-wider transition-all duration-200 hover:scale-[1.02] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
            style={{
              color: totalPendientes > 0 && !classifying ? '#06b6d4' : '#64748b',
              backgroundColor: totalPendientes > 0 && !classifying ? 'rgba(6,182,212,0.08)' : 'rgba(100,116,139,0.05)',
              border: `1px solid ${totalPendientes > 0 && !classifying ? 'rgba(6,182,212,0.2)' : 'rgba(100,116,139,0.15)'}`,
              boxShadow: totalPendientes > 0 && !classifying ? '0 0 20px rgba(6,182,212,0.08)' : 'none',
            }}
          >
            {classifying ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Brain className="w-4 h-4" />
            )}
            {classifying
              ? 'Clasificando con IA...'
              : 'Clasificar Pendientes (20)'}
          </button>

          {/* Batch result */}
          {batchResult && (
            <div className="mt-4 space-y-2">
              <div className="h-[1px]" style={{ background: 'linear-gradient(90deg, transparent, rgba(6,182,212,0.15), transparent)' }} />
              <p className="text-[9px] font-bold uppercase text-slate-600 font-mono">
                Resultado del lote
              </p>
              <div className="grid grid-cols-3 gap-2 text-center py-2">
                <div>
                  <p className="text-[9px] font-bold uppercase text-slate-600 font-mono">Procesadas</p>
                  <p className="text-sm font-mono text-cyan-400 tabular-nums">
                    {batchResult.analizadas ?? 0}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase text-slate-600 font-mono">Errores</p>
                  <p className="text-sm font-mono text-red-400 tabular-nums">
                    {batchResult.errores ?? 0}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase text-slate-600 font-mono">Restantes</p>
                  <p className="text-sm font-mono text-amber-400 tabular-nums">
                    {Math.max(0, totalPendientes - (batchResult.analizadas ?? 0))}
                  </p>
                </div>
              </div>
              {batchResult.mensaje && (
                <div className="flex items-center gap-2 text-[10px] font-mono text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                  {batchResult.mensaje}
                </div>
              )}
              {/* Detail log */}
              {batchResult.detalles && batchResult.detalles.length > 0 && (
                <div className="max-h-[150px] overflow-y-auto custom-scrollbar mt-2 space-y-0.5">
                  {batchResult.detalles.map((d, i) => (
                    <p key={i} className="text-[9px] font-mono text-slate-600 truncate px-1">
                      {d}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </PanelShell>
      </div>

      {/* Right: Pendientes list */}
      <div className="lg:col-span-7">
        <PanelShell
          title="Menciones Pendientes"
          icon={<Inbox className="w-4 h-4" />}
          className="relative"
        >
          {/* Refresh button */}
          <button
            onClick={() => { setLoading(true); fetchPendientes(); }}
            disabled={loading}
            className="absolute top-3 right-3 z-10 flex items-center gap-1 px-2 py-1 rounded text-[9px] font-mono uppercase tracking-wider transition-all hover:bg-slate-800/40 disabled:opacity-40"
            style={{ color: '#06b6d4', border: '1px solid rgba(6,182,212,0.15)' }}
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            Refrescar
          </button>

          {loading && menciones.length === 0 ? (
            <div className="flex items-center gap-2 py-8 text-slate-600 text-xs font-mono justify-center">
              <Loader2 className="w-4 h-4 animate-spin" />
              Cargando menciones pendientes...
            </div>
          ) : error && menciones.length === 0 ? (
            <div className="flex items-center gap-2 py-4 text-red-400/70 text-xs font-mono">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              {error}
            </div>
          ) : menciones.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-slate-600 text-xs font-mono">
              <CheckCircle2 className="w-6 h-6 text-emerald-500/50" />
              <span>Todas las menciones estan clasificadas</span>
            </div>
          ) : (
            <div className="space-y-1 max-h-[500px] overflow-y-auto custom-scrollbar pr-1">
              {menciones.map((m, i) => (
                <div
                  key={m.id}
                  className="group rounded-md px-3 py-2 transition-all duration-200"
                  style={{
                    background: i === 0 ? 'rgba(6,182,212,0.04)' : 'rgba(255,255,255,0.01)',
                    border: `1px solid ${i === 0 ? 'rgba(6,182,212,0.1)' : 'rgba(255,255,255,0.03)'}`,
                  }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {m.Persona?.nombre ? (
                      <span className="text-[10px] font-bold font-mono text-emerald-400 truncate max-w-[140px]">
                        {m.Persona.nombre}
                        {m.Persona.partidoSigla && (
                          <span className="text-slate-600 ml-1">({m.Persona.partidoSigla})</span>
                        )}
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono text-slate-600 italic">Sin persona</span>
                    )}
                    <span className="text-slate-700">·</span>
                    <span className="text-[10px] font-mono text-slate-500 truncate max-w-[100px]">
                      {m.Medio?.nombre || 'N/A'}
                    </span>
                    <Tag className="w-3 h-3 text-amber-500/50 ml-auto" />
                  </div>
                  <p className="text-[11px] text-slate-400 font-mono leading-snug line-clamp-2">
                    {m.titulo || m.texto?.slice(0, 100) || 'Sin texto'}
                  </p>
                </div>
              ))}
              {totalPendientes > menciones.length && (
                <p className="text-center text-[9px] font-mono text-slate-700 py-2">
                  ...y {totalPendientes - menciones.length} mas
                </p>
              )}
            </div>
          )}
        </PanelShell>
      </div>
    </div>
  );
}
