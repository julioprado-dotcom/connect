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

// ═══════════════════════════════════════════════════════════════
// Types — matching the actual API shape from /api/indicadores
// ═══════════════════════════════════════════════════════════════

interface UltimoValor {
  valor: string;
  valorRaw?: number;
  fecha: string;
  confiable: boolean;
  fechaCaptura: string;
}

interface UltimaEvaluacion {
  id: string;
  valorCompuesto: number;
  valorTexto: string;
  escalaNivel: string;
  puntuaciones: string;
}

interface EnrichedIndicador {
  id: string;
  nombre: string;
  slug: string;
  categoria: string;
  tipo: string;
  fuente: string;
  periodicidad: string;
  unidad: string;
  formatoNumero: number;
  activo: boolean;
  orden: number;
  tier: number;
  ejesTematicos: string;
  ultimoValor?: UltimoValor | null;
  ultimaEvaluacion?: UltimaEvaluacion | null;
  totalValores: number;
  totalEvaluaciones: number;
}

interface CaptureResult {
  exito: boolean;
  mensaje?: string;
  datos?: {
    exitosos: Array<{ slug: string; valor: string; confiable: boolean }>;
    fallidos: Array<{ slug: string; error: string }>;
    total: number;
    duracionMs: number;
  };
  error?: string;
}

// ═══════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════

const CATEGORIAS: Record<string, { label: string; color: string }> = {
  monetario: { label: 'Monetario', color: '#06b6d4' },
  minero: { label: 'Minero', color: '#f59e0b' },
  agricolas: { label: 'Agricolas', color: '#10b981' },
  macro_bcb: { label: 'Macroeconomia BCB', color: '#8b5cf6' },
  ine: { label: 'INE', color: '#ec4899' },
  salud: { label: 'Salud', color: '#ef4444' },
  social: { label: 'Social', color: '#6366f1' },
  economico: { label: 'Economico', color: '#14b8a6' },
};

const TIER_CONFIG: Record<number, { label: string; color: string }> = {
  1: { label: 'AUTO', color: '#10b981' },
  2: { label: 'SEMI', color: '#f59e0b' },
  3: { label: 'MANUAL', color: '#64748b' },
};

const CATEGORIA_ORDER = ['monetario', 'macro_bcb', 'minero', 'agricolas', 'economico', 'ine', 'salud', 'social'];

// ═══════════════════════════════════════════════════════════════
// Props
// ═══════════════════════════════════════════════════════════════

interface IndicadoresViewProps {
  onNavigateTab?: (tab: string) => void;
}

// ═══════════════════════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════════════════════

function MiniStatCard({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: number | string;
  color: string;
  icon: React.ReactNode;
}) {
  return (
    <div
      className="rounded-lg px-4 py-3 flex items-center gap-3"
      style={{
        background: 'rgba(5, 5, 5, 0.8)',
        border: '1px solid ' + color + '15',
        boxShadow: '0 0 12px ' + color + '06',
      }}
    >
      <span style={{ color: color + '80' }}>{icon}</span>
      <div>
        <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-600 font-mono">
          {label}
        </p>
        <p
          className="text-lg font-bold font-mono tabular-nums leading-none"
          style={{ color }}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

function TierBadge({ tier }: { tier: number }) {
  const cfg = TIER_CONFIG[tier] || TIER_CONFIG[3];
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold font-mono uppercase tracking-wider"
      style={{
        color: cfg.color,
        backgroundColor: cfg.color + '12',
        border: '1px solid ' + cfg.color + '25',
      }}
    >
      {cfg.label}
    </span>
  );
}

function ConfiableDot({ confiable }: { confiable: boolean | undefined }) {
  if (confiable === undefined || confiable === null) return null;
  const color = confiable ? '#10b981' : '#f59e0b';
  return (
    <span
      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
      style={{
        backgroundColor: color,
        boxShadow: '0 0 4px ' + color + '50',
      }}
      title={confiable ? 'Dato confiable' : 'Dato fallback (sin verificar)'}
    />
  );
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('es-BO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function SkeletonCard() {
  return (
    <div
      className="rounded-lg p-4 animate-pulse"
      style={{
        background: 'rgba(5, 5, 5, 0.8)',
        border: '1px solid rgba(6, 182, 212, 0.08)',
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <div
          className="h-3 rounded-sm"
          style={{ backgroundColor: 'rgba(6, 182, 212, 0.08)', width: '60%' }}
        />
        <div
          className="h-4 rounded-sm"
          style={{ backgroundColor: 'rgba(6, 182, 212, 0.06)', width: '40px' }}
        />
      </div>
      <div
        className="h-6 rounded-sm mb-2"
        style={{ backgroundColor: 'rgba(6, 182, 212, 0.06)', width: '45%' }}
      />
      <div
        className="h-2.5 rounded-sm"
        style={{ backgroundColor: 'rgba(6, 182, 212, 0.04)', width: '30%' }}
      />
    </div>
  );
}

function ProgressBar({ elapsed, maxDuration }: { elapsed: number; maxDuration: number }) {
  const pct = Math.min(100, (elapsed / maxDuration) * 100);
  return (
    <div
      className="w-full h-1 rounded-full overflow-hidden"
      style={{ backgroundColor: 'rgba(6, 182, 212, 0.08)' }}
    >
      <div
        className="h-full rounded-full transition-all duration-1000 ease-linear"
        style={{
          width: pct + '%',
          backgroundColor: '#06b6d4',
          boxShadow: '0 0 6px rgba(6, 182, 212, 0.3)',
        }}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Indicator Card — individual indicator display
// ═══════════════════════════════════════════════════════════════

function IndicatorCard({
  indicador,
  syncing,
  onSync,
  catColor,
}: {
  indicador: EnrichedIndicador;
  syncing: boolean;
  onSync: (slug: string) => void;
  catColor: string;
}) {
  const uv = indicador.ultimoValor;
  const ue = indicador.ultimaEvaluacion;
  const hasData = uv || ue;

  // Determine display value and variation
  let displayValue = '---';
  let variation: 'up' | 'down' | 'stable' | null = null;

  if (uv) {
    displayValue = uv.valor;
    // We don't have a previous value from the API, so we show neutral arrow
    // Variation could be computed if we had historical data, but the current API
    // only returns the last value. Show confiable as proxy.
    variation = 'stable';
  } else if (ue) {
    displayValue = ue.valorTexto;
    variation = null;
  }

  const variationArrow = variation === 'up' ? '\u2191' : variation === 'down' ? '\u2193' : variation === 'stable' ? '\u2192' : '';
  const variationColor = variation === 'up' ? '#10b981' : variation === 'down' ? '#ef4444' : '#64748b';

  const isCuantitativo = indicador.tipo === 'cuantitativo';

  return (
    <div
      className="rounded-lg p-3 sm:p-4 relative overflow-hidden transition-all duration-200 group"
      style={{
        background: 'rgba(5, 5, 5, 0.8)',
        border: '1px solid ' + catColor + '10',
        boxShadow: '0 0 12px ' + catColor + '04',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = catColor + '25';
        (e.currentTarget as HTMLElement).style.boxShadow = '0 0 16px ' + catColor + '08';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = catColor + '10';
        (e.currentTarget as HTMLElement).style.boxShadow = '0 0 12px ' + catColor + '04';
      }}
    >
      {/* Scan line */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(6,182,212,0.008) 3px, rgba(6,182,212,0.008) 4px)',
        }}
      />

      <div className="relative z-10">
        {/* Header: name + tier + sync */}
        <div className="flex items-center justify-between mb-2 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <ConfiableDot confiable={uv?.confiable} />
            <h4
              className="text-[11px] font-bold font-mono uppercase tracking-wider truncate"
              style={{ color: '#cbd5e1' }}
            >
              {indicador.nombre}
            </h4>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <TierBadge tier={indicador.tier} />
            <button
              onClick={() => onSync(indicador.slug)}
              disabled={syncing}
              className="p-1 rounded transition-all duration-200 disabled:opacity-30 hover:bg-white/5"
              title={syncing ? 'Sincronizando...' : 'Sincronizar indicador'}
            >
              {syncing ? (
                <Loader2 className="w-3 h-3 animate-spin" style={{ color: '#06b6d4' }} />
              ) : (
                <RefreshCw
                  className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity"
                  style={{ color: '#06b6d4' }}
                />
              )}
            </button>
          </div>
        </div>

        {/* Value */}
        <div className="flex items-baseline gap-2 mb-1.5">
          <span
            className="text-xl sm:text-2xl font-bold font-mono tabular-nums leading-none"
            style={{ color: hasData ? '#e5e5e5' : '#334155' }}
          >
            {displayValue}
          </span>
          {variationArrow && (
            <span className="text-sm font-mono" style={{ color: variationColor }}>
              {variationArrow}
            </span>
          )}
          {indicador.unidad && (
            <span className="text-[9px] font-mono text-slate-600 uppercase tracking-wider">
              {indicador.unidad}
            </span>
          )}
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-3 text-[9px] font-mono text-slate-600">
          {indicador.fuente && (
            <span className="truncate max-w-[120px]" title={indicador.fuente}>
              {indicador.fuente}
            </span>
          )}
          {isCuantitativo && uv && (
            <span>
              {indicador.totalValores} datos
            </span>
          )}
          {!isCuantitativo && ue && (
            <span>
              {indicador.totalEvaluaciones} eval.
            </span>
          )}
          {uv?.fecha && (
            <span className="ml-auto flex-shrink-0">
              {formatDate(uv.fecha)}
            </span>
          )}
        </div>

        {/* Evaluacion badge for cualitativo */}
        {ue && (
          <div className="mt-2">
            <span
              className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold font-mono uppercase tracking-wider"
              style={{
                color: ue.escalaNivel === 'critico' ? '#ef4444' : ue.escalaNivel === 'alto' ? '#f59e0b' : ue.escalaNivel === 'bajo' ? '#10b981' : '#06b6d4',
                backgroundColor: (ue.escalaNivel === 'critico' ? '#ef4444' : ue.escalaNivel === 'alto' ? '#f59e0b' : ue.escalaNivel === 'bajo' ? '#10b981' : '#06b6d4') + '12',
                border: '1px solid ' + (ue.escalaNivel === 'critico' ? '#ef4444' : ue.escalaNivel === 'alto' ? '#f59e0b' : ue.escalaNivel === 'bajo' ? '#10b981' : '#06b6d4') + '25',
              }}
            >
              {ue.escalaNivel} · {ue.valorCompuesto.toFixed(1)}
            </span>
          </div>
        )}

        {/* Bottom glow */}
        <div
          className="absolute bottom-0 left-0 right-0 h-[1px]"
          style={{
            background: 'linear-gradient(90deg, transparent 5%, ' + catColor + '15 50%, transparent 95%)',
          }}
        />
      </div>
    </div>
  );
}

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
              className="flex items-center gap-2 px-3 py-2.5 rounded-md text-[10px] font-mono"
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
                  </span>
                  <span className="ml-2 flex-shrink-0 text-slate-500" style={{ borderLeft: '1px solid rgba(100,116,139,0.2)', paddingLeft: '8px' }}>
                    {captureResult.datos.duracionMs
                      ? formatElapsed(Math.floor(captureResult.datos.duracionMs / 1000))
                      : ''}
                  </span>
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
