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
} from './IndicadoresView.subcomponents';

// ═══════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function IndicadoresView({ onNavigateTab }: IndicadoresViewProps) {
  // ── State ──
  const [indicadores, setIndicadores] = useState<EnrichedIndicador[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      const res = await fetchWithTimeout('/api/indicadores', { timeoutMs: 12000 });
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
        const res = await fetchWithTimeout('/api/indicadores', { timeoutMs: 12000 });
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

    // Start elapsed timer
    captureTimerRef.current = setInterval(() => {
      setCaptureElapsed((prev) => prev + 1);
    }, 1000);

    try {
      const res = await fetchWithTimeout('/api/indicadores/capture', {
        method: 'POST',
        timeoutMs: 120000, // 2 min timeout — capture can be slow
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
      // Refresh data after successful capture
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
        // Refresh after sync
        setTimeout(fetchIndicadores, 500);
      } catch {
        // Silent — individual sync failure shouldn't block UI
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
    <div className="space-y-4 sm:space-y-6">
      {/* ── Stats Summary Row (3 mini cards, no PanelShell) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <MiniStatCard
          label="Total Activos"
          value={loading ? '---' : totalActivos}
          color="#06b6d4"
          icon={<BarChart3 className="w-4 h-4" />}
        />
        <MiniStatCard
          label="Con Datos"
          value={loading ? '---' : conDatos}
          color="#10b981"
          icon={<CheckCircle2 className="w-4 h-4" />}
        />
        <MiniStatCard
          label="Tier 1 (Auto)"
          value={loading ? '---' : tier1}
          color="#f59e0b"
          icon={<Zap className="w-4 h-4" />}
        />
      </div>

      {/* ── Capture Controls Panel ── */}
      <PanelShell title="CAPTURA DE DATOS" icon={<Activity className="w-4 h-4" />}>
        <div className="space-y-4">
          {/* Main capture button + info */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <button
              onClick={handleCapture}
              disabled={capturing}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-[10px] font-bold font-mono uppercase tracking-wider transition-all duration-200 hover:scale-[1.02] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 whitespace-nowrap"
              style={{
                color: capturing ? '#64748b' : '#06b6d4',
                backgroundColor: capturing ? 'rgba(100,116,139,0.05)' : 'rgba(6,182,212,0.06)',
                border: capturing
                  ? '1px solid rgba(100,116,139,0.15)'
                  : '1px solid rgba(6,182,212,0.2)',
              }}
            >
              {capturing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <TrendingUp className="w-3.5 h-3.5" />
              )}
              {capturing ? 'Capturando indicadores...' : 'Capturar Tier 1'}
            </button>

            {/* Progress indicator during capture */}
            {capturing && (
              <div className="flex-1 flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-mono text-cyan-400/70">
                    Obteniendo datos de Yahoo Finance, Stooq, BCB...
                  </span>
                  <span className="text-[9px] font-mono text-slate-500 tabular-nums">
                    {formatElapsed(captureElapsed)}
                  </span>
                </div>
                <ProgressBar elapsed={captureElapsed} maxDuration={90} />
              </div>
            )}
          </div>

          {/* Capture result */}
          {captureResult && (
            <div
              className="flex flex-wrap items-center gap-2 px-3 py-2.5 rounded-md text-[10px] font-mono"
              style={{
                color: captureResult.exito ? '#06b6d4' : '#8b5cf6',
                backgroundColor: captureResult.exito ? 'rgba(6,182,212,0.06)' : 'rgba(139,92,246,0.06)',
                border: captureResult.exito
                  ? '1px solid rgba(6,182,212,0.15)'
                  : '1px solid rgba(139,92,246,0.15)',
              }}
            >
              {captureResult.exito ? (
                <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
              ) : (
                <XCircle className="w-3.5 h-3.5 flex-shrink-0" />
              )}
              {captureResult.datos ? (
                <>
                  <span>
                    Exitosos: {captureResult.datos.exitosos.length} | Fallidos:{' '}
                    {captureResult.datos.fallidos.length}
                    <span className="ml-3 text-slate-500" style={{ borderLeft: '2px solid rgba(100,116,139,0.3)', paddingLeft: '10px' }}>
                      en {captureResult.datos.duracionMs
                        ? formatElapsed(Math.floor(captureResult.datos.duracionMs / 1000))
                        : '---'}
                    </span>
                  </span>
                  {captureResult.datos.fallidos.length > 0 && (
                    <details className="ml-3">
                      <summary className="cursor-pointer text-slate-500 hover:text-violet-400 transition-colors">Ver errores</summary>
                      <div className="mt-1.5 space-y-0.5">
                        {captureResult.datos.fallidos.map((f, idx) => (
                          <div key={idx} className="text-[9px] text-slate-500">
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

          {/* Auto-refresh footer */}
          <div className="flex items-center justify-between text-[9px] font-mono text-slate-700">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: '#06b6d4' }} />
              Auto-refresco cada 5 min
            </span>
            <button
              onClick={fetchIndicadores}
              disabled={loading}
              className="flex items-center gap-1 px-2 py-1 rounded text-slate-500 hover:text-cyan-400 transition-colors disabled:opacity-40"
              title="Refrescar datos"
            >
              <RefreshCw className={'w-3 h-3' + (loading ? ' animate-spin' : '')} />
              REFRESCAR
            </button>
          </div>
        </div>
      </PanelShell>

      {/* ── Error banner ── */}
      {error && !loading && (
        <div
          className="flex items-center gap-2 px-3 py-2.5 rounded-md text-[10px] font-mono"
          style={{
            color: '#8b5cf6',
            backgroundColor: 'rgba(139,92,246,0.06)',
            border: '1px solid rgba(139,92,246,0.15)',
          }}
        >
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
          Error al cargar indicadores: {error}
        </div>
      )}

      {/* ── Indicators by Category ── */}
      {loading ? (
        // Skeleton loading
        <div className="space-y-6">
          {CATEGORIA_ORDER.slice(0, 3).map((cat) => (
            <PanelShell
              key={cat}
              title={CATEGORIAS[cat]?.label || cat}
              icon={<BarChart3 className="w-4 h-4" />}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            </PanelShell>
          ))}
        </div>
      ) : categoryKeys.length === 0 ? (
        // Empty state
        <div className="flex flex-col items-center justify-center py-16">
          <BarChart3 className="w-10 h-10 text-slate-700 mb-4" />
          <p className="text-sm font-mono text-slate-600 mb-1">Sin indicadores disponibles</p>
          <p className="text-[10px] font-mono text-slate-700">
            Los indicadores se poblaran tras la primera captura de datos.
          </p>
        </div>
      ) : (
        // Category groups
        <div className="space-y-6">
          {categoryKeys.map((catKey) => {
            const cat = CATEGORIAS[catKey] || { label: catKey, color: '#64748b' };
            const items = grouped[catKey];
            const catActivos = items.filter((i) => i.activo).length;
            const catConDatos = items.filter((i) => i.ultimoValor || i.ultimaEvaluacion).length;

            return (
              <PanelShell
                key={catKey}
                title={cat.label.toUpperCase()}
                icon={
                  <span
                    className="w-3 h-3 rounded-sm"
                    style={{ backgroundColor: cat.color, boxShadow: '0 0 8px ' + cat.color + '40' }}
                  />
                }
              >
                {/* Category header info */}
                <div className="flex items-center gap-3 mb-4 text-[9px] font-mono text-slate-600">
                  <span>{catActivos} activos</span>
                  <span className="w-1 h-1 rounded-full bg-slate-700" />
                  <span>{catConDatos} con datos</span>
                  <span className="w-1 h-1 rounded-full bg-slate-700" />
                  <span>{items.length} total</span>
                </div>

                {/* Indicator cards grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {items
                    .sort((a, b) => a.orden - b.orden)
                    .map((ind) => (
                      <IndicatorCard
                        key={ind.id}
                        indicador={ind}
                        syncing={syncingSlugs.has(ind.slug)}
                        onSync={handleSyncOne}
                        catColor={cat.color}
                      />
                    ))}
                </div>
              </PanelShell>
            );
          })}
        </div>
      )}
    </div>
  );
}
