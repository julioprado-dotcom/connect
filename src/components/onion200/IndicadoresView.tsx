'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { fetchWithTimeout } from '@/lib/fetch-utils';
import { PanelShell } from './PanelShell';
import {
  TrendingUp,
  RefreshCw,
  Loader2,
  Activity,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Zap,
  BarChart3,
} from 'lucide-react';
import {
  CATEGORIAS,
  CATEGORIA_ORDER,
} from './IndicadoresView.types';
import type {
  EnrichedIndicador,
  CaptureResult,
  IndicadoresViewProps,
} from './IndicadoresView.types';
import {
  MiniStatCard,
  SkeletonCard,
  ProgressBar,
  IndicatorCard,
  HistoryModal,
} from './IndicadoresView.subcomponents';

// ═══════════════════════════════════════════════════════════════
// Main Component — Compact Terminal Layout
// ═══════════════════════════════════════════════════════════════

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function IndicadoresView({ onNavigateTab }: IndicadoresViewProps) {
  // ── State ──
  const [indicadores, setIndicadores] = useState<EnrichedIndicador[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // History modal state
  const [historyIndicator, setHistoryIndicator] = useState<EnrichedIndicador | null>(null);
  const [historyCatColor, setHistoryCatColor] = useState('#06b6d4');

  // Capture state
  const [capturing, setCapturing] = useState(false);
  const [captureResult, setCaptureResult] = useState<CaptureResult | null>(null);
  const [captureElapsed, setCaptureElapsed] = useState(0);
  const captureTimerRef = useRef<ReturnType<typeof setInterval>>(null);

  // Per-indicator sync
  const [syncingSlugs, setSyncingSlugs] = useState<Set<string>>(new Set());

  // Auto-refresh interval
  const intervalRef = useRef<ReturnType<typeof setInterval>>(null);

  // ── Fetch indicadores ──
  const fetchIndicadores = useCallback(async () => {
    try {
      const res = await fetchWithTimeout('/api/indicadores?history=7', { timeoutMs: 12000 });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      setIndicadores(Array.isArray(data.indicadores) ? data.indicadores : []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error de conexion');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await fetchWithTimeout('/api/indicadores?history=7', { timeoutMs: 12000 });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        if (mounted) {
          setIndicadores(Array.isArray(data.indicadores) ? data.indicadores : []);
          setError(null);
        }
      } catch (e) {
        if (mounted) setError(e instanceof Error ? e.message : 'Error de conexion');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    intervalRef.current = setInterval(load, 300000); // 5 minutes
    return () => {
      mounted = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // ── Capture Tier 1 ──
  const handleCapture = useCallback(async () => {
    if (capturing) return;
    setCapturing(true);
    setCaptureResult(null);
    setCaptureElapsed(0);

    captureTimerRef.current = setInterval(() => {
      setCaptureElapsed((prev) => prev + 1);
    }, 1000);

    try {
      const res = await fetchWithTimeout('/api/indicadores/capture', {
        method: 'POST',
        timeoutMs: 120000,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setCaptureResult({
          exito: false,
          error: errData.error || 'Error HTTP ' + res.status,
        });
        return;
      }

      const data: CaptureResult = await res.json();
      setCaptureResult(data);
      if (data.exito) {
        setTimeout(fetchIndicadores, 1000);
      }
    } catch (e) {
      setCaptureResult({
        exito: false,
        error: e instanceof Error ? e.message : 'Error de conexion',
      });
    } finally {
      setCapturing(false);
      if (captureTimerRef.current) {
        clearInterval(captureTimerRef.current);
        captureTimerRef.current = null;
      }
    }
  }, [capturing, fetchIndicadores]);

  // ── Sync individual indicator ──
  const handleSyncOne = useCallback(
    async (slug: string) => {
      if (syncingSlugs.has(slug)) return;
      setSyncingSlugs((prev) => new Set(prev).add(slug));

      try {
        await fetchWithTimeout('/api/indicadores/sync/' + slug, {
          method: 'POST',
          timeoutMs: 30000,
        });
        setTimeout(fetchIndicadores, 500);
      } catch {
        // Silent
      } finally {
        setSyncingSlugs((prev) => {
          const next = new Set(prev);
          next.delete(slug);
          return next;
        });
      }
    },
    [syncingSlugs, fetchIndicadores],
  );

  // ── Computed ──
  const totalActivos = indicadores.filter((i) => i.activo).length;
  const conDatos = indicadores.filter((i) => i.ultimoValor || i.ultimaEvaluacion).length;
  const tier1 = indicadores.filter((i) => i.tier === 1 && i.activo).length;

  // Group by category
  const grouped = indicadores.reduce<Record<string, EnrichedIndicador[]>>((acc, ind) => {
    const cat = ind.categoria || 'economico';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(ind);
    return acc;
  }, {});

  const categoryKeys = CATEGORIA_ORDER.filter((k) => grouped[k] && grouped[k].length > 0);

  // ── Format elapsed time ──
  const formatElapsed = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    if (mins > 0) return mins + 'm ' + secs + 's';
    return secs + 's';
  };

  // ── Render ──
  return (
    <div className="space-y-4">
      {/* ── Stats Row — inline, no cards ── */}
      <div className="flex items-center gap-4 px-1 text-[9px] font-mono">
        <MiniStatCard label="Activos" value={loading ? '---' : totalActivos} color="#06b6d4" icon={<BarChart3 className="w-3 h-3" />} />
        <MiniStatCard label="Con Datos" value={loading ? '---' : conDatos} color="#10b981" icon={<CheckCircle2 className="w-3 h-3" />} />
        <MiniStatCard label="T1 Auto" value={loading ? '---' : tier1} color="#f59e0b" icon={<Zap className="w-3 h-3" />} />

        {/* Capture button — inline */}
        <button
          onClick={handleCapture}
          disabled={capturing}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded text-[9px] font-bold font-mono uppercase tracking-wider transition-all duration-150 hover:scale-[1.01] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 whitespace-nowrap"
          style={{
            color: capturing ? '#64748b' : '#06b6d4',
            backgroundColor: capturing ? 'rgba(100,116,139,0.05)' : 'rgba(6,182,212,0.06)',
            border: capturing
              ? '1px solid rgba(100,116,139,0.15)'
              : '1px solid rgba(6,182,212,0.2)',
          }}
        >
          {capturing ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <TrendingUp className="w-3 h-3" />
          )}
          {capturing ? `${formatElapsed(captureElapsed)}` : 'Capturar T1'}
        </button>

        <button
          onClick={fetchIndicadores}
          disabled={loading}
          className="p-1.5 rounded text-slate-500 hover:text-cyan-400 transition-colors disabled:opacity-40"
          title="Refrescar"
        >
          <RefreshCw className={'w-3 h-3' + (loading ? ' animate-spin' : '')} />
        </button>
      </div>

      {/* ── Capture progress bar (inline, no panel) ── */}
      {capturing && (
        <ProgressBar elapsed={captureElapsed} maxDuration={90} />
      )}

      {/* ── Capture result (inline banner) ── */}
      {captureResult && (
        <div
          className="flex flex-wrap items-center gap-2 px-3 py-1.5 rounded text-[9px] font-mono"
          style={{
            color: captureResult.exito ? '#06b6d4' : '#8b5cf6',
            backgroundColor: captureResult.exito ? 'rgba(6,182,212,0.06)' : 'rgba(139,92,246,0.06)',
            border: captureResult.exito
              ? '1px solid rgba(6,182,212,0.15)'
              : '1px solid rgba(139,92,246,0.15)',
          }}
        >
          {captureResult.exito ? (
            <CheckCircle2 className="w-3 h-3 flex-shrink-0" />
          ) : (
            <XCircle className="w-3 h-3 flex-shrink-0" />
          )}
          {captureResult.datos ? (
            <>
              <span>
                {captureResult.datos.exitosos.length} ok · {captureResult.datos.fallidos.length} fail
                <span className="ml-2 text-slate-500">
                  {captureResult.datos.duracionMs
                    ? formatElapsed(Math.floor(captureResult.datos.duracionMs / 1000))
                    : '---'}
                </span>
              </span>
              {captureResult.datos.fallidos.length > 0 && (
                <details className="ml-2">
                  <summary className="cursor-pointer text-slate-500 hover:text-violet-400 transition-colors">errores</summary>
                  <div className="mt-1 space-y-0.5">
                    {captureResult.datos.fallidos.map((f, idx) => (
                      <div key={idx} className="text-[8px] text-slate-500">
                        <span className="text-violet-400">{f.slug}</span>: {typeof f.error === 'string' ? (() => { try { const p = JSON.parse(f.error); return p.error || p.hint || f.error; } catch { return f.error; } })() : JSON.stringify(f.error)}
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </>
          ) : (
            <span>{captureResult.error || 'Error desconocido'}</span>
          )}
        </div>
      )}

      {/* ── Error banner ── */}
      {error && !loading && (
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded text-[9px] font-mono"
          style={{
            color: '#8b5cf6',
            backgroundColor: 'rgba(139,92,246,0.06)',
            border: '1px solid rgba(139,92,246,0.15)',
          }}
        >
          <AlertTriangle className="w-3 h-3 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* ── Indicators Grid ── */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
          {Array.from({ length: 12 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : categoryKeys.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <BarChart3 className="w-8 h-8 text-slate-700 mb-3" />
          <p className="text-xs font-mono text-slate-600">Sin indicadores</p>
        </div>
      ) : (
        <div className="space-y-4">
          {categoryKeys.map((catKey) => {
            const cat = CATEGORIAS[catKey] || { label: catKey, color: '#64748b' };
            const items = grouped[catKey];

            return (
              <div key={catKey}>
                {/* Category header — thin line, not full panel */}
                <div
                  className="flex items-center gap-2 px-2 py-1 mb-1.5"
                  style={{ borderBottom: '1px solid ' + cat.color + '10' }}
                >
                  <span
                    className="w-2 h-2 rounded-sm"
                    style={{ backgroundColor: cat.color, boxShadow: '0 0 6px ' + cat.color + '40' }}
                  />
                  <h3 className="text-[10px] font-bold uppercase tracking-[0.15em] font-mono" style={{ color: cat.color + 'cc' }}>
                    {cat.label}
                  </h3>
                  <span className="text-[8px] font-mono text-slate-700">
                    {items.filter(i => i.activo).length} activos · {items.filter(i => i.ultimoValor || i.ultimaEvaluacion).length} datos
                  </span>
                  <span className="ml-auto flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full animate-pulse" style={{ backgroundColor: cat.color + '60' }} />
                    <span className="text-[7px] font-mono" style={{ color: cat.color + '50' }}>LIVE</span>
                  </span>
                </div>

                {/* Grid balanceado: 2 mobile, 3 tablet, 4 desktop, 5 wide */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
                  {items
                    .sort((a, b) => a.orden - b.orden)
                    .map((ind) => (
                      <IndicatorCard
                        key={ind.id}
                        indicador={ind}
                        syncing={syncingSlugs.has(ind.slug)}
                        onSync={handleSyncOne}
                        catColor={cat.color}
                        onClick={() => {
                          if (ind.tipo === 'cuantitativo') {
                            setHistoryIndicator(ind);
                            setHistoryCatColor(cat.color);
                          }
                        }}
                      />
                    ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── History Modal ── */}
      {historyIndicator && (
        <HistoryModal
          indicador={historyIndicator}
          catColor={historyCatColor}
          onClose={() => setHistoryIndicator(null)}
        />
      )}
    </div>
  );
}
