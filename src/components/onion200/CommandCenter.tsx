'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { fetchWithTimeout } from '@/lib/fetch-utils';
import { PanelShell } from './VitalMonitor';
import {
  Zap,
  Play,
  Square,
  RotateCcw,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Layers,
  Radio,
  ChevronDown,
  ChevronUp,
  Database,
  Activity,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

interface QueueStatus {
  queueStatus: {
    pending: number;
    enProgreso: number;
    fuentesActivas: number;
  };
  kickAvailable: boolean;
}

interface CaptureQueue {
  queue: {
    running: boolean;
    startedAt: string | null;
    completedAt: string | null;
    currentMedio: string | null;
    progress: { current: number; total: number };
    stats: {
      mediosProcesados: number;
      mediosConError: number;
      totalLinksExtraidos: number;
      notasTriajeadas: number;
      notasClasificadas: number;
      mencionesCreadas: number;
      mencionesDuplicadas: number;
      errores: number;
    };
    elapsedMin: number;
    version: string;
  };
  recentLogs: string[];
}

interface JobsSummary {
  porEstado: Record<string, number>;
}

// ═══════════════════════════════════════════════════════════════
// CommandCenter — Manual control panel for the pipeline
// ═══════════════════════════════════════════════════════════════

export function CommandCenter() {
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);
  const [captureQueue, setCaptureQueue] = useState<CaptureQueue | null>(null);
  const [jobsSummary, setJobsSummary] = useState<JobsSummary | null>(null);
  const [kickLoading, setKickLoading] = useState(false);
  const [captureLoading, setCaptureLoading] = useState(false);
  const [stopCaptureLoading, setStopCaptureLoading] = useState(false);
  const [kickResult, setKickResult] = useState<{ success: boolean; message: string } | null>(null);
  const [captureResult, setCaptureResult] = useState<{ success: boolean; message: string } | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [logsExpanded, setLogsExpanded] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(null);

  const fetchData = useCallback(async () => {
    try {
      const [queueRes, captureRes, jobsRes] = await Promise.all([
        fetchWithTimeout('/api/admin/kick-capture', { timeoutMs: 5000 }),
        fetchWithTimeout('/api/capture', { timeoutMs: 5000 }),
        fetchWithTimeout('/api/jobs?limit=1', { timeoutMs: 5000 }),
      ]);

      if (queueRes.ok) setQueueStatus(await queueRes.json());
      if (captureRes.ok) setCaptureQueue(await captureRes.json());
      if (jobsRes.ok) setJobsSummary(await jobsRes.json());
    } catch {
      // Silent — panel shows "sin datos"
    }
  }, []);

  useEffect(() => {
    fetchData();
    intervalRef.current = setInterval(fetchData, 10000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchData]);

  const handleKickCapture = async () => {
    setKickLoading(true);
    setKickResult(null);
    try {
      const res = await fetch('/api/admin/kick-capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxSources: 8 }),
      });
      const data = await res.json();
      if (data.success) {
        setKickResult({
          success: true,
          message: `${data.checksEncolados} fuentes encoladas (reset: ${data.fuentesReseteadas})`,
        });
      } else {
        setKickResult({ success: false, message: data.error || 'Error al forzar captura' });
      }
    } catch {
      setKickResult({ success: false, message: 'Error de conexion' });
    } finally {
      setKickLoading(false);
      setTimeout(fetchData, 3000);
    }
  };

  const handleStartCapture = async () => {
    setCaptureLoading(true);
    setCaptureResult(null);
    try {
      const res = await fetch('/api/capture', {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        setCaptureResult({
          success: true,
          message: `Captura v2 iniciada para ${data.totalMedios} medios (~${data.estimatedTimeMin} min)`,
        });
      } else {
        setCaptureResult({
          success: false,
          message: data.error || 'Error al iniciar captura',
        });
      }
    } catch {
      setCaptureResult({ success: false, message: 'Error de conexion' });
    } finally {
      setCaptureLoading(false);
      setTimeout(fetchData, 3000);
    }
  };

  const handleStopCapture = async () => {
    setStopCaptureLoading(true);
    try {
      const res = await fetch('/api/capture', { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setCaptureResult({ success: true, message: 'Detencion solicitada — finalizando medio actual...' });
      }
    } catch {
      // silent
    } finally {
      setStopCaptureLoading(false);
      setTimeout(fetchData, 3000);
    }
  };

  const cq = captureQueue?.queue;
  const qs = queueStatus?.queueStatus;

  return (
    <PanelShell title="Centro de Comando" icon={<Zap className="w-4 h-4" />} className="relative">
      {/* Collapse toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="absolute top-3 right-3 z-10 flex items-center gap-1 px-2 py-1 rounded text-[9px] font-mono uppercase tracking-wider transition-all hover:bg-slate-800/40"
        style={{ color: '#06b6d4', border: '1px solid rgba(6,182,212,0.1)' }}
      >
        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>

      {expanded ? (
        <div className="space-y-4">
          {/* ── Row 1: Action Buttons ── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

            {/* Forzar Captura (kick) */}
            <div
              className="rounded-lg p-3"
              style={{
                background: 'rgba(16,185,129,0.03)',
                border: '1px solid rgba(16,185,129,0.1)',
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <Radio className="w-3.5 h-3.5 text-emerald-500/70" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400/70 font-mono">
                  Forzar Captura
                </span>
              </div>
              <p className="text-[9px] font-mono text-slate-600 mb-2.5 leading-relaxed">
                Encola checks inmediatos para las 8 fuentes mas productivas via job queue.
              </p>
              <button
                onClick={handleKickCapture}
                disabled={kickLoading || !queueStatus?.kickAvailable}
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-md text-[10px] font-bold font-mono uppercase tracking-wider transition-all hover:scale-[1.01] disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  color: '#10b981',
                  backgroundColor: 'rgba(16,185,129,0.08)',
                  border: '1px solid rgba(16,185,129,0.2)',
                }}
                title={queueStatus?.kickAvailable ? 'Encolar checks para fuentes top' : 'Cola saturada'}
              >
                {kickLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Play className="w-3.5 h-3.5" />
                )}
                Kick Capture
              </button>
              {kickResult && (
                <div className={`mt-2 flex items-center gap-1.5 text-[9px] font-mono ${kickResult.success ? 'text-emerald-500/80' : 'text-red-400/80'}`}>
                  {kickResult.success ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                  {kickResult.message}
                </div>
              )}
            </div>

            {/* Captura v2 (scraping directo) */}
            <div
              className="rounded-lg p-3"
              style={{
                background: 'rgba(6,182,212,0.03)',
                border: '1px solid rgba(6,182,212,0.1)',
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-3.5 h-3.5 text-cyan-500/70" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-cyan-400/70 font-mono">
                  Captura Completa v2
                </span>
              </div>
              <p className="text-[9px] font-mono text-slate-600 mb-2.5 leading-relaxed">
                Pipeline completo: scraping directo de todos los medios activos → triaje → LLM classify.
              </p>
              {!cq?.running ? (
                <button
                  onClick={handleStartCapture}
                  disabled={captureLoading}
                  className="w-full flex items-center justify-center gap-1.5 py-2 rounded-md text-[10px] font-bold font-mono uppercase tracking-wider transition-all hover:scale-[1.01] disabled:opacity-40"
                  style={{
                    color: '#06b6d4',
                    backgroundColor: 'rgba(6,182,212,0.08)',
                    border: '1px solid rgba(6,182,212,0.2)',
                  }}
                >
                  {captureLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Play className="w-3.5 h-3.5" />
                  )}
                  Iniciar Captura v2
                </button>
              ) : (
                <button
                  onClick={handleStopCapture}
                  disabled={stopCaptureLoading}
                  className="w-full flex items-center justify-center gap-1.5 py-2 rounded-md text-[10px] font-bold font-mono uppercase tracking-wider transition-all hover:scale-[1.01] disabled:opacity-40"
                  style={{
                    color: '#f43f5e',
                    backgroundColor: 'rgba(244,63,94,0.08)',
                    border: '1px solid rgba(244,63,94,0.2)',
                  }}
                >
                  {stopCaptureLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Square className="w-3.5 h-3.5" />
                  )}
                  Detener Captura
                </button>
              )}
              {captureResult && (
                <div className={`mt-2 flex items-center gap-1.5 text-[9px] font-mono ${captureResult.success ? 'text-cyan-400/80' : 'text-red-400/80'}`}>
                  {captureResult.success ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                  {captureResult.message}
                </div>
              )}
            </div>

            {/* Queue Status */}
            <div
              className="rounded-lg p-3"
              style={{
                background: 'rgba(245,158,11,0.03)',
                border: '1px solid rgba(245,158,11,0.08)',
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <Layers className="w-3.5 h-3.5 text-amber-500/70" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400/70 font-mono">
                  Cola de Trabajos
                </span>
              </div>
              {qs ? (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-mono text-slate-600">Pendientes</span>
                    <span className="text-xs font-mono text-amber-400 tabular-nums">{qs.pending}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-mono text-slate-600">En progreso</span>
                    <span className="text-xs font-mono text-cyan-400 tabular-nums">{qs.enProgreso}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-mono text-slate-600">Fuentes activas</span>
                    <span className="text-xs font-mono text-emerald-400 tabular-nums">{qs.fuentesActivas}</span>
                  </div>
                </div>
              ) : (
                <p className="text-[9px] font-mono text-slate-700">Cargando estado de cola...</p>
              )}
            </div>
          </div>

          {/* ── Capture v2 Progress Bar ── */}
          {cq && (cq.running || cq.completedAt) && (
            <div
              className="rounded-lg p-3"
              style={{
                background: cq.running ? 'rgba(6,182,212,0.03)' : 'rgba(255,255,255,0.01)',
                border: `1px solid ${cq.running ? 'rgba(6,182,212,0.12)' : 'rgba(255,255,255,0.04)'}`,
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                {cq.running ? (
                  <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
                ) : (
                  <CheckCircle2 className="w-3 h-3 text-emerald-500/60" />
                )}
                <span className="text-[10px] font-bold uppercase tracking-widest font-mono" style={{ color: cq.running ? '#06b6d4' : '#10b981' }}>
                  {cq.running ? `Capturando: ${cq.currentMedio || '...'}` : 'Captura Finalizada'}
                </span>
                <span className="ml-auto text-[9px] font-mono text-slate-600">
                  {cq.elapsedMin} min
                </span>
              </div>

              {/* Progress bar */}
              {cq.total > 0 && (
                <div className="mb-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[9px] font-mono text-slate-600">
                      {cq.progress.current}/{cq.progress.total} medios
                    </span>
                    <span className="text-[9px] font-mono text-cyan-400 tabular-nums">
                      {Math.round((cq.progress.current / cq.progress.total) * 100)}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}>
                    <div
                      className="h-full rounded-full transition-all duration-1000"
                      style={{
                        width: `${(cq.progress.current / cq.progress.total) * 100}%`,
                        background: cq.running
                          ? 'linear-gradient(90deg, #06b6d4, #10b981)'
                          : '#10b981',
                        boxShadow: cq.running ? '0 0 8px rgba(6,182,212,0.4)' : '0 0 6px rgba(16,185,129,0.3)',
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Stats row */}
              <div className="grid grid-cols-4 gap-2 text-center">
                <MiniStat label="Links" value={cq.stats.totalLinksExtraidos} />
                <MiniStat label="Triaje" value={cq.stats.notasTriajeadas} />
                <MiniStat label="Clasific." value={cq.stats.notasClasificadas} />
                <MiniStat label="Menciones" value={cq.stats.mencionesCreadas} highlight />
              </div>

              {/* Error/warning badges */}
              {(cq.stats.errores > 0 || cq.stats.mediosConError > 0) && (
                <div className="flex items-center gap-2 mt-2 px-2 py-1.5 rounded-md" style={{ backgroundColor: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.08)' }}>
                  <AlertTriangle className="w-3 h-3 text-amber-500/70 flex-shrink-0" />
                  <span className="text-[9px] font-mono text-amber-400/70">
                    {cq.stats.mediosConError} medios con error · {cq.stats.errores} errores totales
                  </span>
                </div>
              )}

              {/* Recent logs toggle */}
              {captureQueue?.recentLogs && captureQueue.recentLogs.length > 0 && (
                <div className="mt-2">
                  <button
                    onClick={() => setLogsExpanded(!logsExpanded)}
                    className="flex items-center gap-1.5 text-[9px] font-mono text-slate-600 hover:text-slate-500 transition-colors"
                  >
                    {logsExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    Logs recientes ({captureQueue.recentLogs.length})
                  </button>
                  {logsExpanded && (
                    <div className="mt-1.5 max-h-[120px] overflow-y-auto custom-scrollbar rounded-md p-2" style={{
                      backgroundColor: 'rgba(0,0,0,0.3)',
                      border: '1px solid rgba(255,255,255,0.03)',
                    }}>
                      {captureQueue.recentLogs.map((log, i) => (
                        <p key={i} className="text-[8px] font-mono leading-relaxed" style={{ color: log.includes('ERROR') || log.includes('error') ? '#f43f5e90' : log.includes('menciones') ? '#10b98190' : '#475569' }}>
                          {log}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Jobs Summary (compact) ── */}
          {jobsSummary && (
            <div className="flex items-center gap-3 px-1 flex-wrap">
              <span className="text-[9px] font-bold uppercase text-slate-700 font-mono">Trabajos:</span>
              {Object.entries(jobsSummary.porEstado).map(([estado, count]) => {
                const colors: Record<string, string> = {
                  pendiente: '#f59e0b',
                  en_progreso: '#06b6d4',
                  completado: '#10b981',
                  fallido: '#f43f5e',
                };
                const color = colors[estado] || '#64748b';
                return (
                  <span key={estado} className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                    <span className="text-[9px] font-mono text-slate-500">
                      {estado.replace('_', ' ')}
                    </span>
                    <span className="text-[9px] font-mono tabular-nums" style={{ color }}>
                      {count}
                    </span>
                  </span>
                );
              })}
            </div>
          )}

          {/* ── Info footer ── */}
          <p className="text-[8px] font-mono text-slate-700 leading-relaxed px-1">
            <b>Kick Capture</b> encola checks via job queue (rapido, sin LLM). <b>Captura v2</b> ejecuta el pipeline completo de scraping directo con clasificacion LLM. Los datos se refrescan cada 10s.
          </p>
        </div>
      ) : (
        <div className="flex items-center justify-center gap-2 py-3 text-slate-600 text-xs font-mono">
          <Database className="w-4 h-4" />
          Centro de Comando colapsado — click para expandir
        </div>
      )}
    </PanelShell>
  );
}

// ═══════════════════════════════════════════════════════════════
// MiniStat — tiny stat display
// ═══════════════════════════════════════════════════════════════

function MiniStat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div>
      <p className="text-[8px] font-bold uppercase text-slate-600 font-mono">{label}</p>
      <p
        className="text-sm font-mono tabular-nums"
        style={{ color: highlight ? '#10b981' : '#e5e5e5' }}
      >
        {value}
      </p>
    </div>
  );
}
