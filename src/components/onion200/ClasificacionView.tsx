'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Crosshair,
  Brain,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Tag,
  Inbox,
  RefreshCw,
  Play,
  Eye,
  Activity,
  Cpu,
  Clock,
} from 'lucide-react';
import { fetchWithTimeout } from '@/lib/fetch-utils';
import { PanelShell } from './PanelShell';
import { MencionDetailModal } from './LiveFeed';

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

interface PipelineStatus {
  running: boolean;
  tipo: string;
  elapsedSec: number;
  notaRawPendientes: number;
  notaRawProcesadas: number;
  mencionesTotal: number;
  avgTimePerNote: number;
  estimatedRemaining: string;
  recentLog: string[];
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
  const [batchSize, setBatchSize] = useState(1);
  const [classifyingId, setClassifyingId] = useState<string | null>(null);
  const [selectedMencionId, setSelectedMencionId] = useState<string | null>(null);

  // ── Pipeline batch_llm status (polling en vivo cada 8s) ──
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatus | null>(null);
  const pipelineIntervalRef = useRef<ReturnType<typeof setInterval>>(null);

  const fetchPipelineStatus = useCallback(async () => {
    try {
      const res = await fetchWithTimeout('/api/capture', { timeoutMs: 6000 });
      if (res.ok) {
        const data = await res.json();
        const p = data.pipeline;
        if (!p) return;

        const runningBatch = p.runningJobs?.find((j: { tipo: string }) => j.tipo === 'batch_llm');
        const notaRawPend = p.notaRawPendientes ?? 0;
        const notaRawTotal = p.notaRawTotal ?? 0;
        const notaRawProc = notaRawTotal - notaRawPend;
        const elapsedSec = runningBatch?.elapsedSec ?? 0;

        // Estimar tiempo promedio por nota (si hay batch_llm corriendo o completados recientes)
        let avgSec = 15; // default
        if (elapsedSec > 30) {
          // Si lleva más de 30s, estimar ~1 nota cada 15-25s basado en histórico
          avgSec = 20;
        }

        const remaining = notaRawPend;
        const estTimeSec = remaining > 0 ? remaining * avgSec : 0;
        const estMin = Math.floor(estTimeSec / 60);
        const estStr = estTimeSec > 3600 ? `${Math.floor(estMin / 60)}h ${estMin % 60}m` : estMin > 0 ? `${estMin}m` : '<1m';

        setPipelineStatus({
          running: p.running && !!runningBatch,
          tipo: runningBatch?.tipo ?? '',
          elapsedSec,
          notaRawPendientes: notaRawPend,
          notaRawProcesadas: notaRawProc,
          mencionesTotal: p.mencionesHoy ?? 0,
          avgTimePerNote: avgSec,
          estimatedRemaining: remaining > 0 ? estStr : '—',
          recentLog: p.recentLogs?.slice(0, 10) ?? [],
        });
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchPipelineStatus();
    pipelineIntervalRef.current = setInterval(fetchPipelineStatus, 8000);
    return () => { if (pipelineIntervalRef.current) clearInterval(pipelineIntervalRef.current); };
  }, [fetchPipelineStatus]);

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

  // Auto-refresh pendientes cuando pipeline termina
  useEffect(() => {
    if (pipelineStatus && !pipelineStatus.running && pipelineStatus.notaRawProcesadas > 0) {
      const timer = setTimeout(() => fetchPendientes(), 3000);
      return () => clearTimeout(timer);
    }
  }, [pipelineStatus?.running, pipelineStatus?.notaRawProcesadas, fetchPendientes]);

  const handleClasificar = async (limit?: number) => {
    const count = limit ?? batchSize;
    setClassifying(true);
    setBatchResult(null);
    try {
      const res = await fetchWithTimeout('/api/analyze/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: count }),
        timeoutMs: 120000,
      });
      const data = await res.json();
      setBatchResult(data);
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

  const handleClasificarIndividual = async (mencionId: string) => {
    setClassifyingId(mencionId);
    try {
      const res = await fetchWithTimeout('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mencionId }),
        timeoutMs: 60000,
      });
      const data = await res.json();
      if (res.ok) {
        setBatchResult({
          analizadas: 1,
          errores: 0,
          totalProcesadas: 1,
          detalles: [`${data.tipoMencion} / ${data.sentimiento} / [${(data.ejesTematicos || []).map((e: any) => e.slug || e).join(',')}]`],
        });
        setTimeout(fetchPendientes, 1500);
      } else {
        setBatchResult({
          analizadas: 0,
          errores: 1,
          totalProcesadas: 1,
          mensaje: data.error || 'Error desconocido',
        });
      }
    } catch (e) {
      setBatchResult({
        analizadas: 0,
        errores: 1,
        totalProcesadas: 1,
        mensaje: e instanceof Error ? e.message : 'Error de conexion',
      });
    } finally {
      setClassifyingId(null);
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

          {/* ═══ Pipeline batch_llm en vivo ═══ */}
          {pipelineStatus && (
            <div className="mb-4 py-3 border-y border-slate-800/60">
              <p className="text-[9px] font-bold uppercase font-mono mb-2.5 flex items-center gap-1.5" style={{
                color: pipelineStatus.running ? '#10b981' : '#64748b',
              }}>
                <Cpu className="w-3 h-3" />
                Pipeline de Clasificacion
                {pipelineStatus.running && (
                  <span className="ml-auto flex items-center gap-1 text-[8px] font-mono px-1.5 py-0.5 rounded" style={{
                    color: '#10b981',
                    backgroundColor: 'rgba(16,185,129,0.08)',
                    border: '1px solid rgba(16,185,129,0.15)',
                  }}>
                    <Activity className="w-2.5 h-2.5" />
                    CLASIFICANDO
                  </span>
                )}
                {!pipelineStatus.running && pipelineStatus.notaRawProcesadas > 0 && (
                  <span className="ml-auto text-[8px] font-mono px-1.5 py-0.5 rounded" style={{
                    color: '#64748b',
                    backgroundColor: 'rgba(100,116,139,0.06)',
                    border: '1px solid rgba(100,116,139,0.12)',
                  }}>
                    IDLE
                  </span>
                )}
              </p>

              {/* Stats grid */}
              <div className="grid grid-cols-4 gap-2 mb-2">
                <div className="text-center">
                  <p className="text-[8px] font-bold uppercase text-slate-600 font-mono">NotaRaw</p>
                  <p className="text-xs font-mono tabular-nums">
                    <span className="text-cyan-400">{pipelineStatus.notaRawProcesadas}</span>
                    <span className="text-slate-700">/</span>
                    <span className="text-slate-400">{pipelineStatus.notaRawProcesadas + pipelineStatus.notaRawPendientes}</span>
                  </p>
                  <p className="text-[7px] font-mono text-slate-600">procesadas</p>
                </div>
                <div className="text-center">
                  <p className="text-[8px] font-bold uppercase text-slate-600 font-mono">Pendientes</p>
                  <p className="text-xs font-mono text-amber-400 tabular-nums">{pipelineStatus.notaRawPendientes}</p>
                  <p className="text-[7px] font-mono text-slate-600">por clasificar</p>
                </div>
                <div className="text-center">
                  <p className="text-[8px] font-bold uppercase text-slate-600 font-mono">Menciones</p>
                  <p className="text-xs font-mono text-emerald-400 tabular-nums">{pipelineStatus.mencionesTotal}</p>
                  <p className="text-[7px] font-mono text-slate-600">creadas hoy</p>
                </div>
                <div className="text-center">
                  <p className="text-[8px] font-bold uppercase text-slate-600 font-mono">Tiempo/nota</p>
                  <p className="text-xs font-mono tabular-nums" style={{ color: '#a78bfa' }}>{pipelineStatus.avgTimePerNote}s</p>
                  <p className="text-[7px] font-mono text-slate-600">promedio</p>
                </div>
              </div>

              {/* Progress bar + estimate cuando está corriendo */}
              {pipelineStatus.running && (
                <div className="mt-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[8px] font-mono text-slate-600 flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" />
                      {Math.floor(pipelineStatus.elapsedSec / 60)}m {pipelineStatus.elapsedSec % 60}s transcurridos
                    </span>
                    <span className="text-[8px] font-mono text-purple-400">
                      ~{pipelineStatus.estimatedRemaining} restantes
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(167,139,250,0.1)' }}>
                    <div
                      className="h-full rounded-full transition-all duration-1000"
                      style={{
                        width: `${Math.min(100, Math.round((pipelineStatus.notaRawProcesadas / Math.max(1, pipelineStatus.notaRawProcesadas + pipelineStatus.notaRawPendientes)) * 100))}%`,
                        background: 'linear-gradient(90deg, #a78bfa, #06b6d4)',
                        boxShadow: '0 0 6px rgba(167,139,250,0.3)',
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Recent pipeline log */}
              {pipelineStatus.recentLog.length > 0 && (
                <div className="mt-2.5 max-h-[130px] overflow-y-auto custom-scrollbar space-y-0.5">
                  <p className="text-[7px] font-bold uppercase text-slate-700 font-mono mb-1">Log del pipeline</p>
                  {pipelineStatus.recentLog.map((log, i) => (
                    <p key={i} className="text-[8px] font-mono leading-relaxed truncate px-1" style={{
                      color: log.includes('✓') || log.includes('✅') ? '#10b981'
                           : log.includes('▶') ? '#a78bfa'
                           : '#475569',
                    }}>
                      {log}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Batch size selector */}
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[9px] font-mono text-slate-600 uppercase tracking-wider">Lote:</span>
            {[1, 3, 5, 10, 20].map(n => (
              <button
                key={n}
                onClick={() => setBatchSize(n)}
                className="px-2 py-1 rounded text-[10px] font-mono font-bold transition-all"
                style={{
                  color: batchSize === n ? '#06b6d4' : '#64748b',
                  backgroundColor: batchSize === n ? 'rgba(6,182,212,0.1)' : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${batchSize === n ? 'rgba(6,182,212,0.25)' : 'rgba(255,255,255,0.06)'}`,
                }}
              >
                {n}
              </button>
            ))}
          </div>

          {/* Classify button */}
          <button
            onClick={() => handleClasificar(batchSize)}
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
              : `Clasificar Pendientes (${batchSize})`}
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
                <button
                  key={m.id}
                  onClick={() => setSelectedMencionId(m.id)}
                  className="group rounded-md px-3 py-2 transition-all duration-200 cursor-pointer text-left w-full hover:scale-[1.005]"
                  style={{
                    background: i === 0 ? 'rgba(6,182,212,0.04)' : 'rgba(255,255,255,0.01)',
                    border: `1px solid ${i === 0 ? 'rgba(6,182,212,0.1)' : 'rgba(255,255,255,0.03)'}`,
                  }}
                  title="Click para ver detalle completo"
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
                    <span className="text-[8px] font-mono text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                      <Eye className="w-3 h-3" /> VER →
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleClasificarIndividual(m.id); }}
                      disabled={classifyingId === m.id || classifying}
                      className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-mono uppercase tracking-wider transition-all hover:bg-cyan-500/10 disabled:opacity-30"
                      style={{ color: classifyingId === m.id ? '#06b6d4' : '#64748b', border: '1px solid rgba(6,182,212,0.12)' }}
                      title="Clasificar esta mención"
                    >
                      {classifyingId === m.id
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : <Play className="w-3 h-3" />
                      }
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400 font-mono leading-snug line-clamp-2">
                    {m.titulo || m.texto?.slice(0, 100) || 'Sin texto'}
                  </p>
                </button>
              ))}
              {totalPendientes > menciones.length && (
                <p className="text-center text-[9px] font-mono text-slate-700 py-2">
                  ...y {totalPendientes - menciones.length} mas
                </p>
              )}
            </div>
          )}

          {/* Detail Modal */}
          {selectedMencionId && (
            <MencionDetailModal
              mencionId={selectedMencionId}
              onClose={() => setSelectedMencionId(null)}
            />
          )}
        </PanelShell>
      </div>
    </div>
  );
}
