'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { fetchWithTimeout } from '@/lib/fetch-utils';
import { PanelShell } from './PanelShell';
import {
  Radio,
  Rocket,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  BarChart3,
  Newspaper,
  ExternalLink,
  RefreshCw,
  Pause,
  Square,
  Wifi,
  WifiOff,
  Eye,
} from 'lucide-react';
import { MencionDetailModal } from './LiveFeed';

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

interface CaptureQueueState {
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
  version?: string;
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

interface Mencion {
  id: string;
  titulo: string;
  contenido: string;
  url: string | null;
  medio: { nombre: string } | null;
  persona: { nombre: string; camara: string } | null;
  sentimiento: 'positivo' | 'negativo' | 'neutro' | 'no_clasificado';
  fechaCaptura: string;
  tratamientoPeriodistico: string | null;
  ejesTematicos: { eje: { nombre: string } }[];
}

interface MencionesResponse {
  menciones: Mencion[];
  total: number;
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
  const [connTest, setConnTest] = useState<null | {
    connectivity: { total: number; ok: number; failed: number; verdict: string };
    tests: { label: string; url: string; ok: boolean; source: string; htmlLength?: number; latencyMs?: number; totalCambios?: number; ultimoCheck?: string; error?: string }[];
  }>(null);
  const [connLoading, setConnLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(null);

  // ── Contenido Capturado state ──
  const [menciones, setMenciones] = useState<Mencion[]>([]);
  const [mencionesLoading, setMencionesLoading] = useState(false);
  const [mencionesTotal, setMencionesTotal] = useState(0);
  const [selectedMencionId, setSelectedMencionId] = useState<string | null>(null);

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

  // ── Fetch menciones ──
  const fetchMenciones = useCallback(async (offset = 0, append = false) => {
    setMencionesLoading(true);
    try {
      const res = await fetchWithTimeout(
        `/api/menciones?limit=20&offset=${offset}&orderBy=fechaCaptura&orderDir=desc`,
        { timeoutMs: 10000 },
      );
      if (res.ok) {
        const data: MencionesResponse = await res.json();
        setMenciones(prev => (append ? [...prev, ...data.menciones] : data.menciones));
        setMencionesTotal(data.total);
      }
    } catch {
      /* silent */
    } finally {
      setMencionesLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMenciones(0, false);
  }, [fetchMenciones]);

  const handleRefreshMenciones = () => fetchMenciones(0, false);
  const handleLoadMore = () => fetchMenciones(menciones.length, true);

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

  const handleConnectivityTest = async () => {
    setConnLoading(true);
    setConnTest(null);
    try {
      const res = await fetchWithTimeout('/api/capture/connectivity', { timeoutMs: 60000 });
      if (res.ok) {
        const data = await res.json();
        setConnTest(data);
      }
    } catch {
      setConnTest(null);
    } finally {
      setConnLoading(false);
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

          {/* Stats row — v2 scraping directo */}
          {queue && (queue.stats.mencionesCreadas > 0 || isRunning) && (
            <div className="grid grid-cols-4 gap-2 mb-4 py-3 border-y border-slate-800/60">
              <div className="text-center">
                <p className="text-[9px] font-bold uppercase text-slate-600 font-mono">Menciones</p>
                <p className="text-sm font-mono text-emerald-400 tabular-nums">{queue.stats.mencionesCreadas}</p>
              </div>
              <div className="text-center">
                <p className="text-[9px] font-bold uppercase text-slate-600 font-mono">Triaje</p>
                <p className="text-sm font-mono text-cyan-400 tabular-nums">{queue.stats.notasTriajeadas}</p>
              </div>
              <div className="text-center">
                <p className="text-[9px] font-bold uppercase text-slate-600 font-mono">Links</p>
                <p className="text-sm font-mono text-amber-400 tabular-nums">{queue.stats.totalLinksExtraidos}</p>
              </div>
              <div className="text-center">
                <p className="text-[9px] font-bold uppercase text-slate-600 font-mono">Errores</p>
                <p className="text-sm font-mono text-red-400 tabular-nums">{queue.stats.errores}</p>
              </div>
            </div>
          )}

          {/* Stats row — medias procesados (siempre visible cuando corre) */}
          {queue && isRunning && queue.stats.mediosProcesados > 0 && (
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="text-center">
                <p className="text-[9px] font-bold uppercase text-slate-700 font-mono">Medios</p>
                <p className="text-xs font-mono text-slate-400 tabular-nums">{queue.stats.mediosProcesados}</p>
              </div>
              <div className="text-center">
                <p className="text-[9px] font-bold uppercase text-slate-700 font-mono">Clasif.</p>
                <p className="text-xs font-mono text-slate-400 tabular-nums">{queue.stats.notasClasificadas}</p>
              </div>
              <div className="text-center">
                <p className="text-[9px] font-bold uppercase text-slate-700 font-mono">Duplicados</p>
                <p className="text-xs font-mono text-slate-400 tabular-nums">{queue.stats.mencionesDuplicadas}</p>
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

          {/* Connectivity test */}
          <div className="mt-4 pt-3 border-t border-slate-800/60">
            <button
              onClick={handleConnectivityTest}
              disabled={connLoading || isRunning}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-[10px] font-bold font-mono uppercase tracking-wider transition-all duration-200 hover:scale-[1.01] disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                color: connTest?.connectivity.verdict === 'OK' ? '#10b981' : connTest?.connectivity.verdict === 'CRITICAL' ? '#f43f5e' : '#64748b',
                backgroundColor: connTest?.connectivity.verdict === 'OK' ? 'rgba(16,185,129,0.06)' : connTest?.connectivity.verdict === 'CRITICAL' ? 'rgba(244,63,94,0.06)' : 'rgba(100,116,139,0.06)',
                border: `1px solid ${connTest?.connectivity.verdict === 'OK' ? 'rgba(16,185,129,0.15)' : connTest?.connectivity.verdict === 'CRITICAL' ? 'rgba(244,63,94,0.15)' : 'rgba(100,116,139,0.15)'}`,
              }}
            >
              {connLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : connTest?.connectivity.verdict === 'OK' ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
              {connLoading ? 'Probando red...' : connTest ? `Red: ${connTest.connectivity.ok}/${connTest.connectivity.total} OK` : 'Probar Conectividad'}
            </button>

            {connTest && (
              <div className="mt-2 space-y-1">
                {connTest.tests.map((t) => (
                  <div key={t.label} className="flex items-center justify-between text-[9px] font-mono px-2 py-1 rounded" style={{
                    color: t.ok ? '#10b981' : '#f43f5e',
                    backgroundColor: t.ok ? 'rgba(16,185,129,0.03)' : 'rgba(244,63,94,0.03)',
                  }}>
                    <span>{(t.ok || t.totalCambios) ? '✓' : '✗'} {t.label}</span>
                    <span className="text-slate-600">{t.ok ? `${t.latencyMs}ms` + (t.totalCambios ? ` / ${t.totalCambios} cambios` : '') : (t.totalCambios ? `${t.totalCambios} cambios (monitoreo)` : (t.error || 'falló'))}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

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

      {/* ═══ Contenido Capturado — full width below ═══ */}
      <div className="lg:col-span-12">
        <PanelShell title="Contenido Capturado" icon={<Newspaper className="w-4 h-4" />}>
          {/* Toolbar */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-mono text-slate-600">
              {mencionesTotal} menciones · mostrando {menciones.length}
            </span>
            <button
              onClick={handleRefreshMenciones}
              disabled={mencionesLoading}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[10px] font-mono uppercase font-bold transition-all hover:scale-[1.02] disabled:opacity-40"
              style={{
                color: '#06b6d4',
                backgroundColor: 'rgba(6,182,212,0.06)',
                border: '1px solid rgba(6,182,212,0.15)',
              }}
            >
              <RefreshCw className={`w-3 h-3 ${mencionesLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {/* Loading / Empty / List */}
          {mencionesLoading && menciones.length === 0 ? (
            <div className="flex items-center justify-center py-8 gap-2 text-slate-600 text-xs font-mono">
              <Loader2 className="w-4 h-4 animate-spin" />
              Cargando menciones...
            </div>
          ) : menciones.length === 0 ? (
            <div className="flex items-center justify-center py-8 gap-2 text-slate-600 text-xs font-mono">
              <Newspaper className="w-4 h-4" />
              Sin menciones capturadas
            </div>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar pr-1">
              {menciones.map(m => {
                const sentColor =
                  m.sentimiento === 'positivo'
                    ? '#10b981'
                    : m.sentimiento === 'negativo'
                      ? '#f43f5e'
                      : m.sentimiento === 'no_clasificado'
                        ? '#f59e0b'
                        : '#64748b';
                const sentBg =
                  m.sentimiento === 'positivo'
                    ? 'rgba(16,185,129,0.1)'
                    : m.sentimiento === 'negativo'
                      ? 'rgba(244,63,94,0.1)'
                      : m.sentimiento === 'no_clasificado'
                        ? 'rgba(245,158,11,0.1)'
                        : 'rgba(100,116,139,0.1)';
                const sentLabel =
                  m.sentimiento === 'no_clasificado'
                    ? 'N/C'
                    : m.sentimiento.charAt(0).toUpperCase() + m.sentimiento.slice(1);

                return (
                  <button
                    key={m.id}
                    onClick={() => setSelectedMencionId(m.id)}
                    className="group rounded-md p-3 transition-all duration-200 hover:scale-[1.005] cursor-pointer text-left w-full"
                    style={{
                      backgroundColor: '#080808',
                      border: '1px solid rgba(100,116,139,0.1)',
                    }}
                    title="Click para ver detalle completo"
                  >
                    {/* Header: medio · persona · sentimiento */}
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      {m.medio?.nombre && (
                        <span
                          className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded"
                          style={{
                            color: '#a855f7',
                            backgroundColor: 'rgba(168,85,247,0.1)',
                            border: '1px solid rgba(168,85,247,0.2)',
                          }}
                        >
                          {m.medio.nombre}
                        </span>
                      )}
                      {m.persona?.nombre && (
                        <span className="text-[10px] font-mono text-slate-300">
                          {m.persona.nombre}
                          {m.persona.camara && (
                            <span className="text-slate-600 ml-1">
                              ({m.persona.camara})
                            </span>
                          )}
                        </span>
                      )}
                      <span
                        className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ml-auto"
                        style={{ color: sentColor, backgroundColor: sentBg }}
                      >
                        {sentLabel}
                      </span>
                    </div>

                    {/* Title */}
                    {m.titulo && (
                      <p className="text-[11px] font-mono text-slate-200 font-semibold mb-1 leading-snug">
                        {m.titulo}
                      </p>
                    )}

                    {/* URL */}
                    {m.url && (
                      <a
                        href={m.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-[9px] font-mono text-cyan-400 hover:text-cyan-300 transition-colors mb-1 truncate max-w-full"
                      >
                        <ExternalLink className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{m.url}</span>
                      </a>
                    )}

                    {/* Timestamp + click hint */}
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[9px] font-mono text-slate-600">
                        {new Date(m.fechaCaptura).toLocaleString('es-BO', {
                          timeZone: 'America/La_Paz',
                        })}
                      </p>
                      <span className="text-[8px] font-mono text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                        <Eye className="w-3 h-3" /> VER DETALLE →
                      </span>
                    </div>

                    {/* Content snippet */}
                    {m.contenido && (
                      <p className="text-[10px] font-mono text-slate-500 leading-relaxed mt-1">
                        {m.contenido.slice(0, 200)}
                        {m.contenido.length > 200 ? '...' : ''}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* VER MAS button */}
          {menciones.length > 0 && menciones.length < mencionesTotal && (
            <button
              onClick={handleLoadMore}
              disabled={mencionesLoading}
              className="mt-3 w-full flex items-center justify-center gap-2 py-2 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider transition-all hover:scale-[1.01] disabled:opacity-40"
              style={{
                color: '#06b6d4',
                backgroundColor: 'rgba(6,182,212,0.06)',
                border: '1px solid rgba(6,182,212,0.15)',
              }}
            >
              {mencionesLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Ver Mas ({mencionesTotal - menciones.length} restantes)
            </button>
          )}
        </PanelShell>

        {/* Detail Modal */}
        {selectedMencionId && (
          <MencionDetailModal
            mencionId={selectedMencionId}
            onClose={() => setSelectedMencionId(null)}
          />
        )}
      </div>
    </div>
  );
}
