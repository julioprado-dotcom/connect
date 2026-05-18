'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { fetchWithTimeout } from '@/lib/fetch-utils';
import { PanelShell } from './VitalMonitor';
import {
  Radio,
  Rocket,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  BarChart3,
  Newspaper,
  Pause,
  Square,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

interface CaptureQueueState {
  running: boolean;
  startedAt: string | null;
  completedAt: string | null;
  currentMedio: string | null;
  progress: { current: number; total: number };
  stats: { menciones: number; clasificadas: number; errores: number; tematicas: number };
  elapsedMin: number;
}

interface CaptureStatus {
  queue: CaptureQueueState;
  recentLogs: string[];
  lastCaptureLog: {
    medioId: string;
    totalArticulos: number;
    exitosa: boolean;
    fecha: string;
    Medio: { nombre: string };
  } | null;
}

// ═══════════════════════════════════════════════════════════════
// CapturaView — Consola de captura con controles manuales
// ═══════════════════════════════════════════════════════════════

export function CapturaView() {
  const [status, setStatus] = useState<CaptureStatus | null>(null);
  const [launching, setLaunching] = useState(false);
  const [launchResult, setLaunchResult] = useState<{
    success: boolean;
    message: string;
    error?: string;
  } | null>(null);
  const [stopping, setStopping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetchWithTimeout('/api/capture', { timeoutMs: 6000 });
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
        setError(null);
      }
    } catch {
      setError('Error de conexion');
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    // Poll every 5s when running, 30s when idle
    intervalRef.current = setInterval(fetchStatus, 5000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchStatus]);

  const handleLaunchCapture = async () => {
    setLaunching(true);
    setLaunchResult(null);
    try {
      const res = await fetchWithTimeout('/api/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'smart-batch' }),
        timeoutMs: 15000,
      });
      const data = await res.json();
      if (res.ok) {
        setLaunchResult({ success: true, message: data.message || 'Captura iniciada' });
      } else {
        setLaunchResult({ success: false, message: data.error || 'Error al iniciar captura', error: data.error });
      }
      // Refresh status immediately
      setTimeout(fetchStatus, 1000);
    } catch (e) {
      setLaunchResult({ success: false, message: e instanceof Error ? e.message : 'Error de conexion' });
    } finally {
      setLaunching(false);
    }
  };

  const handleStopCapture = async () => {
    setStopping(true);
    try {
      const res = await fetchWithTimeout('/api/capture', {
        method: 'DELETE',
        timeoutMs: 10000,
      });
      const data = await res.json();
      if (res.ok) {
        setLaunchResult({ success: true, message: data.message || 'Detención solicitada' });
      } else {
        setLaunchResult({ success: false, message: data.error || 'Error al detener' });
      }
      setTimeout(fetchStatus, 2000);
    } catch (e) {
      setLaunchResult({ success: false, message: e instanceof Error ? e.message : 'Error de conexion' });
    } finally {
      setStopping(false);
    }
  };

  const queue = status?.queue;
  const progressPct = queue ? Math.round((queue.progress.current / queue.progress.total) * 100) : 0;
  const isRunning = queue?.running ?? false;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
      {/* Left panel: Control */}
      <div className="lg:col-span-5">
        <PanelShell title="Captura — Control" icon={<Radio className="w-4 h-4" />}>
          {/* Status badge */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{
                  backgroundColor: isRunning ? '#10b981' : '#64748b',
                  boxShadow: isRunning ? '0 0 8px rgba(16,185,129,0.5)' : 'none',
                }}
              />
              <span
                className="text-[10px] font-bold uppercase font-mono px-2 py-1 rounded"
                style={{
                  color: isRunning ? '#10b981' : '#64748b',
                  backgroundColor: isRunning ? 'rgba(16,185,129,0.08)' : 'rgba(100,116,139,0.08)',
                  border: `1px solid ${isRunning ? 'rgba(16,185,129,0.2)' : 'rgba(100,116,139,0.2)'}`,
                }}
              >
                {isRunning ? 'CAPTURA EN CURSO' : 'INACTIVO'}
              </span>
            </div>
          </div>

          {/* Progress bar */}
          {isRunning && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-mono text-slate-500 uppercase">
                  Progreso
                </span>
                <span className="text-[10px] font-mono text-cyan-400 tabular-nums">
                  {queue?.progress.current ?? 0}/{queue?.progress.total ?? 0} medios
                </span>
              </div>
              <div
                className="h-1.5 rounded-full overflow-hidden"
                style={{ backgroundColor: 'rgba(6,182,212,0.08)' }}
              >
                <div
                  className="h-full rounded-full transition-all duration-1000"
                  style={{
                    width: `${progressPct}%`,
                    background: 'linear-gradient(90deg, #06b6d4, #10b981)',
                    boxShadow: '0 0 8px rgba(6,182,212,0.4)',
                  }}
                />
              </div>
              {queue?.currentMedio && (
                <p className="text-[9px] font-mono text-slate-600 mt-1.5">
                  <Newspaper className="w-3 h-3 inline mr-1" />
                  Procesando: {queue.currentMedio}
                </p>
              )}
            </div>
          )}

          {/* Stats row */}
          {queue && (queue.stats.menciones > 0 || isRunning) && (
            <div className="grid grid-cols-4 gap-2 mb-4 py-3 border-y border-slate-800/60">
              <div className="text-center">
                <p className="text-[9px] font-bold uppercase text-slate-600 font-mono">Menciones</p>
                <p className="text-sm font-mono text-emerald-400 tabular-nums">{queue.stats.menciones}</p>
              </div>
              <div className="text-center">
                <p className="text-[9px] font-bold uppercase text-slate-600 font-mono">Clasificadas</p>
                <p className="text-sm font-mono text-cyan-400 tabular-nums">{queue.stats.clasificadas}</p>
              </div>
              <div className="text-center">
                <p className="text-[9px] font-bold uppercase text-slate-600 font-mono">Tematicas</p>
                <p className="text-sm font-mono text-amber-400 tabular-nums">{queue.stats.tematicas}</p>
              </div>
              <div className="text-center">
                <p className="text-[9px] font-bold uppercase text-slate-600 font-mono">Errores</p>
                <p className="text-sm font-mono text-red-400 tabular-nums">{queue.stats.errores}</p>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2">
            {!isRunning && (
              <button
                onClick={handleLaunchCapture}
                disabled={launching}
                className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg text-sm font-bold font-mono uppercase tracking-wider transition-all duration-200 hover:scale-[1.02] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
                style={{
                  color: '#06b6d4',
                  backgroundColor: 'rgba(6,182,212,0.08)',
                  border: '1px solid rgba(6,182,212,0.2)',
                  boxShadow: '0 0 20px rgba(6,182,212,0.08)',
                }}
              >
                {launching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
                {launching ? 'Lanzando...' : 'Iniciar Captura'}
              </button>
            )}
            {isRunning && (
              <button
                onClick={handleStopCapture}
                disabled={stopping}
                className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg text-sm font-bold font-mono uppercase tracking-wider transition-all duration-200 hover:scale-[1.02] disabled:opacity-40"
                style={{
                  color: '#f43f5e',
                  backgroundColor: 'rgba(244,63,94,0.08)',
                  border: '1px solid rgba(244,63,94,0.25)',
                  boxShadow: stopping ? 'none' : '0 0 20px rgba(244,63,94,0.1)',
                }}
              >
                {stopping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Square className="w-4 h-4" />}
                {stopping ? 'Deteniendo...' : 'Detener Captura'}
              </button>
            )}
          </div>

          {/* Launch result message */}
          {launchResult && (
            <div
              className="mt-3 flex items-center gap-2 px-3 py-2 rounded-md text-[10px] font-mono"
              style={{
                color: launchResult.success ? '#10b981' : '#f43f5e',
                backgroundColor: launchResult.success ? 'rgba(16,185,129,0.06)' : 'rgba(244,63,94,0.06)',
                border: `1px solid ${launchResult.success ? 'rgba(16,185,129,0.15)' : 'rgba(244,63,94,0.15)'}`,
              }}
            >
              {launchResult.success ? (
                <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              )}
              {launchResult.message}
            </div>
          )}

          {/* Last capture info */}
          {status?.lastCaptureLog && !isRunning && (
            <div className="mt-4 pt-3 border-t border-slate-800/60">
              <p className="text-[9px] font-bold uppercase text-slate-700 font-mono mb-2">
                Ultima captura
              </p>
              <div className="flex items-center justify-between text-[10px] font-mono">
                <span className="text-slate-500">
                  {status.lastCaptureLog.Medio?.nombre || 'N/A'}
                </span>
                <span
                  className="px-1.5 py-0.5 rounded"
                  style={{
                    color: status.lastCaptureLog.exitosa ? '#10b981' : '#f59e0b',
                    backgroundColor: status.lastCaptureLog.exitosa
                      ? 'rgba(16,185,129,0.08)'
                      : 'rgba(245,158,11,0.08)',
                  }}
                >
                  {status.lastCaptureLog.exitosa ? 'OK' : 'WARN'}
                </span>
              </div>
            </div>
          )}
        </PanelShell>
      </div>

      {/* Right panel: Live logs */}
      <div className="lg:col-span-7">
        <PanelShell title="Captura — Log en Vivo" icon={<BarChart3 className="w-4 h-4" />}>
          {error ? (
            <div className="flex items-center gap-2 py-4 text-red-400/70 text-xs font-mono">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              {error}
            </div>
          ) : !status?.recentLogs || status.recentLogs.length === 0 ? (
            <div className="flex items-center gap-2 py-8 text-slate-600 text-xs font-mono justify-center">
              <Clock className="w-4 h-4" />
              Sin actividad de captura. Lanza una captura para ver logs aqui.
            </div>
          ) : (
            <div className="space-y-0.5 max-h-[500px] overflow-y-auto custom-scrollbar">
              {status.recentLogs.map((log, i) => {
                const isError = log.includes('ERROR') || log.includes('FATAL');
                const isSuccess = log.includes('FINALIZADA') || log.includes('✅');
                const isWarning = log.includes('⚠️');
                const color = isError
                  ? '#f43f5e'
                  : isSuccess
                    ? '#10b981'
                    : isWarning
                      ? '#f59e0b'
                      : '#475569';
                return (
                  <div
                    key={i}
                    className="px-2 py-1 rounded text-[9px] font-mono leading-relaxed"
                    style={{
                      color,
                      backgroundColor: isError ? 'rgba(244,63,94,0.03)' : 'transparent',
                    }}
                  >
                    {log}
                  </div>
                );
              })}
            </div>
          )}
        </PanelShell>
      </div>
    </div>
  );
}
