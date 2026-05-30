'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { fetchWithTimeout } from '@/lib/fetch-utils';
import { PanelShell } from './PanelShell';
import {
  Zap,
  Play,
  Square,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Layers,
  Radio,
  ChevronDown,
  ChevronUp,
  Database,
  Activity,
  Timer,
  FileText,
  TrendingUp,
  ArrowRight,
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

interface JobsStats {
  cola: {
    pendientes: number;
    enProgreso: number;
    fallidos24h: number;
    completados24h: number;
    tiempoPromedioMs: number;
  };
  worker: {
    running: boolean;
    uptime: string;
    jobsCompleted: number;
    jobsFailed: number;
    jobsPerHour: number;
    lastJobTime: string | null;
  };
  checkFirst: {
    sinCambios24h: number;
    conCambios24h: number;
    tasaAhorro: number;
  };
  fuentes: {
    activas: number;
    conCambiosHoy: number;
    degradadas: number;
    conError: number;
    topProductoras: Array<{ nombre: string; count: number }>;
  };
  scheduler: {
    running: boolean;
    totalTasks: number;
  };
}

interface JobsSummaryData {
  completadosHoy: number;
  fallidos24h: number;
  enProgreso: number;
  pendientes: number;
  cancelados: number;
  jobsByType: Record<string, number>;
  ultimos: Array<{
    id: string;
    tipo: string;
    estado: string;
    prioridad: string;
    intentos: number;
    maxIntentos: number;
    duracionSegundos: number | null;
    fechaCreacion: string;
    error: string | null;
  }>;
}

interface NotaRawStatus {
  pendientes: number;
  procesadasHoy: number;
  total: number;
  ultimasProcesadas: Array<{
    id: string;
    titulo: string;
    mencionesCreadas: number;
    puntajeTriaje: number;
    fechaCaptura: string;
    fechaProcesada: string | null;
    medioId: string;
  }>;
}

// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════

function tiempoRelativo(fechaStr: string): string {
  const fecha = new Date(fechaStr);
  const ms = Date.now() - fecha.getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'ahora';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const dias = Math.floor(hrs / 24);
  return `${dias}d`;
}

function estadoColor(estado: string): string {
  const colors: Record<string, string> = {
    pendiente: '#f59e0b',
    en_progreso: '#06b6d4',
    en_proceso: '#06b6d4',
    completado: '#10b981',
    fallido: '#f43f5e',
    cancelado: '#64748b',
  };
  return colors[estado] || '#64748b';
}

function estadoLabel(estado: string): string {
  const labels: Record<string, string> = {
    pendiente: 'Pendiente',
    en_progreso: 'En progreso',
    en_proceso: 'En proceso',
    completado: 'Completado',
    fallido: 'Fallido',
    cancelado: 'Cancelado',
  };
  return labels[estado] || estado;
}

function tipoIcon(tipo: string): string {
  if (tipo.includes('check')) return '🔍';
  if (tipo.includes('scrape') || tipo.includes('captura')) return '📡';
  if (tipo.includes('batch') || tipo.includes('llm')) return '🤖';
  if (tipo.includes('clasif')) return '📊';
  if (tipo.includes('triaje')) return '✂️';
  if (tipo.includes('alerta')) return '🚨';
  return '📋';
}

// ═══════════════════════════════════════════════════════════════
// CommandCenter — Manual control panel for the pipeline
// ═══════════════════════════════════════════════════════════════

export function CommandCenter() {
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);
  const [captureQueue, setCaptureQueue] = useState<CaptureQueue | null>(null);
  const [jobsStats, setJobsStats] = useState<JobsStats | null>(null);
  const [jobsSummaryData, setJobsSummaryData] = useState<JobsSummaryData | null>(null);
  const [notaRawStatus, setNotaRawStatus] = useState<NotaRawStatus | null>(null);
  const [kickLoading, setKickLoading] = useState(false);
  const [captureLoading, setCaptureLoading] = useState(false);
  const [stopCaptureLoading, setStopCaptureLoading] = useState(false);
  const [kickResult, setKickResult] = useState<{ success: boolean; message: string } | null>(null);
  const [captureResult, setCaptureResult] = useState<{ success: boolean; message: string } | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [logsExpanded, setLogsExpanded] = useState(false);
  const [ultimosJobsExpanded, setUltimosJobsExpanded] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(null);

  const fetchData = useCallback(async () => {
    try {
      const [queueRes, captureRes, statsRes, summaryRes, notaRawRes] = await Promise.all([
        fetchWithTimeout('/api/admin/kick-capture', { timeoutMs: 5000 }),
        fetchWithTimeout('/api/capture', { timeoutMs: 5000 }),
        fetchWithTimeout('/api/jobs/stats', { timeoutMs: 5000 }),
        fetchWithTimeout('/api/dashboard/jobs-summary', { timeoutMs: 5000 }),
        fetchWithTimeout('/api/dashboard/nota-raw', { timeoutMs: 5000 }),
      ]);

      if (queueRes.ok) setQueueStatus(await queueRes.json());
      if (captureRes.ok) setCaptureQueue(await captureRes.json());
      if (statsRes.ok) setJobsStats(await statsRes.json());
      if (summaryRes.ok) setJobsSummaryData(await summaryRes.json());
      if (notaRawRes.ok) setNotaRawStatus(await notaRawRes.json());
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
  const workerAlive = jobsStats?.worker.running;
  const schedulerAlive = jobsStats?.scheduler.running;

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
          {/* ── System Pulse: Worker + Scheduler live status ── */}
          <div
            className="rounded-lg px-3 py-2 flex items-center gap-3 flex-wrap"
            style={{
              background: workerAlive && schedulerAlive
                ? 'rgba(16,185,129,0.03)'
                : 'rgba(244,63,94,0.03)',
              border: workerAlive && schedulerAlive
                ? '1px solid rgba(16,185,129,0.08)'
                : '1px solid rgba(244,63,94,0.1)',
            }}
          >
            {/* Worker */}
            <div className="flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-full"
                style={{
                  backgroundColor: workerAlive ? '#10b981' : '#f43f5e',
                  boxShadow: workerAlive ? '0 0 6px rgba(16,185,129,0.6)' : '0 0 6px rgba(244,63,94,0.6)',
                  animation: workerAlive ? 'pulse 2s infinite' : 'none',
                }}
              />
              <span className="text-[9px] font-mono text-slate-500">
                Worker
              </span>
              <span
                className="text-[9px] font-bold font-mono uppercase"
                style={{ color: workerAlive ? '#10b981' : '#f43f5e' }}
              >
                {workerAlive ? 'ONLINE' : 'OFFLINE'}
              </span>
            </div>

            <span className="text-slate-800">·</span>

            {/* Scheduler */}
            <div className="flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-full"
                style={{
                  backgroundColor: schedulerAlive ? '#10b981' : '#f43f5e',
                  boxShadow: schedulerAlive ? '0 0 6px rgba(16,185,129,0.6)' : '0 0 6px rgba(244,63,94,0.6)',
                  animation: schedulerAlive ? 'pulse 2s infinite' : 'none',
                }}
              />
              <span className="text-[9px] font-mono text-slate-500">
                Scheduler
              </span>
              <span
                className="text-[9px] font-bold font-mono uppercase"
                style={{ color: schedulerAlive ? '#10b981' : '#f43f5e' }}
              >
                {schedulerAlive ? `${jobsStats?.scheduler.totalTasks || 0} tareas` : 'OFFLINE'}
              </span>
            </div>

            {/* Worker throughput */}
            {jobsStats?.worker && (
              <>
                <span className="text-slate-800 ml-auto">·</span>
                <span className="text-[9px] font-mono text-slate-600">
                  {jobsStats.worker.jobsPerHour > 0
                    ? `${jobsStats.worker.jobsPerHour.toFixed(1)}/h`
                    : ''}
                </span>
                <span className="text-[9px] font-mono text-slate-700">
                  {jobsStats.worker.uptime !== '0s' ? `up ${jobsStats.worker.uptime}` : ''}
                </span>
              </>
            )}

            {/* Last job time */}
            {jobsStats?.worker.lastJobTime && (
              <span className="text-[9px] font-mono text-slate-700">
                ult. job: {tiempoRelativo(jobsStats.worker.lastJobTime)}
              </span>
            )}
          </div>

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

            {/* Cola de Trabajos — ENHANCED with completados/fallidos */}
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
                    <span className="text-[9px] font-mono text-slate-600">Completados 24h</span>
                    <span className="text-xs font-mono text-emerald-400 tabular-nums">
                      {jobsStats?.cola.completados24h ?? jobsSummaryData?.completadosHoy ?? '—'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-mono text-slate-600">Fallidos 24h</span>
                    <span className="text-xs font-mono tabular-nums" style={{ color: (jobsStats?.cola.fallidos24h ?? 0) > 0 ? '#f43f5e' : '#10b981' }}>
                      {jobsStats?.cola.fallidos24h ?? jobsSummaryData?.fallidos24h ?? '—'}
                    </span>
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

          {/* ── Pipeline Status: NotaRaw → batch LLM ── */}
          <div
            className="rounded-lg p-3"
            style={{
              background: 'rgba(6,182,212,0.02)',
              border: '1px solid rgba(6,182,212,0.08)',
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-3.5 h-3.5 text-cyan-500/70" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-cyan-400/70 font-mono">
                Pipeline NotaRaw → Menciones
              </span>
            </div>
            {notaRawStatus ? (
              <div className="flex items-center gap-2 flex-wrap">
                {/* Pendientes */}
                <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md" style={{
                  backgroundColor: 'rgba(245,158,11,0.06)',
                  border: '1px solid rgba(245,158,11,0.1)',
                }}>
                  <span className="text-[8px] font-bold uppercase text-amber-400/70 font-mono">Pendientes</span>
                  <span className="text-xs font-mono text-amber-400 tabular-nums font-bold">
                    {notaRawStatus.pendientes}
                  </span>
                </div>

                <ArrowRight className="w-3 h-3 text-slate-700 flex-shrink-0" />

                {/* Procesadas hoy */}
                <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md" style={{
                  backgroundColor: 'rgba(6,182,212,0.06)',
                  border: '1px solid rgba(6,182,212,0.1)',
                }}>
                  <span className="text-[8px] font-bold uppercase text-cyan-400/70 font-mono">Procesadas hoy</span>
                  <span className="text-xs font-mono text-cyan-400 tabular-nums font-bold">
                    {notaRawStatus.procesadasHoy}
                  </span>
                </div>

                <ArrowRight className="w-3 h-3 text-slate-700 flex-shrink-0" />

                {/* Total */}
                <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md" style={{
                  backgroundColor: 'rgba(100,116,139,0.06)',
                  border: '1px solid rgba(100,116,139,0.1)',
                }}>
                  <span className="text-[8px] font-bold uppercase text-slate-500 font-mono">Total en BD</span>
                  <span className="text-xs font-mono text-slate-400 tabular-nums font-bold">
                    {notaRawStatus.total}
                  </span>
                </div>

                {/* CheckFirst efficiency */}
                {jobsStats?.checkFirst && jobsStats.checkFirst.tasaAhorro > 0 && (
                  <>
                    <span className="text-slate-800 ml-1">·</span>
                    <div className="flex items-center gap-1">
                      <span className="text-[9px] font-mono text-slate-600">CheckFirst ahorro:</span>
                      <span className="text-[9px] font-mono text-emerald-400 font-bold tabular-nums">
                        {(jobsStats.checkFirst.tasaAhorro * 100).toFixed(0)}%
                      </span>
                    </div>
                  </>
                )}

                {/* Avg job time */}
                {jobsStats?.cola && jobsStats.cola.tiempoPromedioMs > 0 && (
                  <>
                    <span className="text-slate-800">·</span>
                    <div className="flex items-center gap-1">
                      <Timer className="w-3 h-3 text-slate-600" />
                      <span className="text-[9px] font-mono text-slate-500">
                        Promedio: {(jobsStats.cola.tiempoPromedioMs / 1000).toFixed(1)}s
                      </span>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <p className="text-[9px] font-mono text-slate-700">Cargando estado del pipeline...</p>
            )}
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

          {/* ── Últimos Jobs — from /api/dashboard/jobs-summary ── */}
          {jobsSummaryData && jobsSummaryData.ultimos.length > 0 && (
            <div
              className="rounded-lg p-3"
              style={{
                backgroundColor: 'rgba(255,255,255,0.01)',
                border: '1px solid rgba(255,255,255,0.04)',
              }}
            >
              <button
                onClick={() => setUltimosJobsExpanded(!ultimosJobsExpanded)}
                className="w-full flex items-center gap-2 mb-2"
              >
                <TrendingUp className="w-3.5 h-3.5 text-slate-600" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 font-mono">
                  Últimos Jobs
                </span>
                <span className="text-[9px] font-mono text-slate-700">
                  ({jobsSummaryData.ultimos.length})
                </span>
                {ultimosJobsExpanded ? <ChevronUp className="w-3 h-3 ml-auto text-slate-700" /> : <ChevronDown className="w-3 h-3 ml-auto text-slate-700" />}
              </button>

              {ultimosJobsExpanded && (
                <div className="space-y-1 max-h-48 overflow-y-auto custom-scrollbar">
                  {jobsSummaryData.ultimos.slice(0, 5).map((job) => (
                    <div
                      key={job.id}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-md"
                      style={{
                        backgroundColor: 'rgba(255,255,255,0.01)',
                        border: '1px solid rgba(255,255,255,0.03)',
                      }}
                    >
                      {/* Status dot */}
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{
                          backgroundColor: estadoColor(job.estado),
                          boxShadow: job.estado === 'en_progreso'
                            ? '0 0 6px rgba(6,182,212,0.5)'
                            : undefined,
                          animation: job.estado === 'en_progreso' ? 'pulse 2s infinite' : 'none',
                        }}
                      />
                      {/* Type icon */}
                      <span className="text-[10px] flex-shrink-0">{tipoIcon(job.tipo)}</span>
                      {/* Job type */}
                      <span className="text-[9px] font-mono text-slate-400 truncate max-w-[140px] flex-1">
                        {job.tipo}
                      </span>
                      {/* Duration */}
                      {job.duracionSegundos !== null && (
                        <span className="text-[9px] font-mono text-slate-600 tabular-nums flex-shrink-0">
                          {job.duracionSegundos}s
                        </span>
                      )}
                      {/* Status label */}
                      <span
                        className="text-[8px] font-bold font-mono uppercase px-1.5 py-0.5 rounded flex-shrink-0"
                        style={{
                          color: estadoColor(job.estado),
                          backgroundColor: `${estadoColor(job.estado)}15`,
                          border: `1px solid ${estadoColor(job.estado)}25`,
                        }}
                      >
                        {estadoLabel(job.estado)}
                      </span>
                      {/* Time ago */}
                      <span className="text-[8px] font-mono text-slate-700 flex-shrink-0 ml-auto">
                        {tiempoRelativo(job.fechaCreacion)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Jobs by type (compact) ── */}
          {jobsSummaryData && jobsSummaryData.jobsByType && Object.keys(jobsSummaryData.jobsByType).length > 0 && (
            <div className="flex items-center gap-3 px-1 flex-wrap">
              <span className="text-[9px] font-bold uppercase text-slate-700 font-mono">Tipos de job:</span>
              {Object.entries(jobsSummaryData.jobsByType).slice(0, 8).map(([tipo, count]) => (
                <span key={tipo} className="flex items-center gap-1">
                  <span className="text-[10px]">{tipoIcon(tipo)}</span>
                  <span className="text-[9px] font-mono text-slate-500 truncate max-w-[80px]">
                    {tipo}
                  </span>
                  <span className="text-[9px] font-mono tabular-nums text-slate-400">
                    {count}
                  </span>
                </span>
              ))}
            </div>
          )}

          {/* ── Info footer ── */}
          <p className="text-[8px] font-mono text-slate-700 leading-relaxed px-1">
            <b>Kick Capture</b> encola checks via job queue (rapido, sin LLM). <b>Captura v2</b> ejecuta el pipeline completo de scraping directo con clasificacion LLM. <b>Pipeline NotaRaw</b> muestra el estado del procesamiento batch LLM. Los datos se refrescan cada 10s.
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
