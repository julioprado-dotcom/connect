'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Activity, CheckCircle2, XCircle, AlertTriangle, ShieldAlert,
  Radio, Clock, Zap, TrendingDown, TrendingUp, RefreshCw,
  Filter, Loader2, Globe, Eye, ChevronDown, ChevronUp,
  Heart, Shield, ShieldOff, Skull, Bug, Timer, ExternalLink,
  ArrowUpDown, BarChart3, CircleDot, CheckSquare, Square,
  Play, Pause, RotateCcw, SkipForward, CalendarClock, Gauge,
  Layers, Sparkles, Thermometer, Wifi, WifiOff,
} from 'lucide-react';
import { KPICard, EmptyState, FilterSelect } from '@/components/shared/KPICard';
import { fetchWithTimeout } from '@/lib/fetch-utils';

// ─── Types ────────────────────────────────────────────────────

interface HealthResumen {
  total: number;
  sanos: number;
  degradados: number;
  muertos: number;
  conErrores: number;
  porcentajeSalud: number;
  fechaAnalisis: string;
}

interface HealthNivel {
  nivel: number;
  label: string;
  total: number;
  sanos: number;
  problematicos: number;
}

interface HealthMedio {
  id: string;
  nombre: string;
  url: string;
  tipo: string;
  nivel: string;
  nivelLabel: string;
  totalMenciones: number;
  menciones7dias: number;
  menciones30dias: number;
  errorRate: number;
  salud: 'sano' | 'degradado' | 'muerto' | 'con_errores';
  alerta: string;
  ultimaCaptura: string | null;
}

interface FuenteEstado {
  id: string;
  medioId: string;
  medio: { id: string; nombre: string; url: string };
  tipoCheck: string;
  frecuenciaBase: string;
  frecuenciaActual: string;
  horariosOptimos: number[];
  horasPublicacion: string;
  ultimoCheck: string | null;
  ultimoCambio: string | null;
  totalChecks: number;
  totalCambios: number;
  checksSinCambio: number;
  responseTime: number;
  activo: boolean;
  error: string;
  etag: string;
  fingerprint: string;
  lastModified: string;
  ultimoValor: string;
  ultimosIds: string;
}

interface HealthData {
  resumen: HealthResumen;
  porNivel: HealthNivel[];
  medios: HealthMedio[];
}

type SaludFilter = 'todos' | 'sano' | 'degradado' | 'muerto' | 'con_errores';
type SortKey = 'nombre' | 'salud' | 'menciones7dias' | 'errorRate' | 'totalChecks' | 'responseTime' | 'checksSinCambio' | 'frecuencia';
type SortDir = 'asc' | 'desc';

// ─── Frecuencia labels ────────────────────────────────────────

const FREQ_LABELS: Record<string, string> = {
  '15m': '15m', '30m': '30m', '1h': '1h', '2h': '2h',
  '4h': '4h', '6h': '6h', '12h': '12h', '1d': '1d', '1w': '1sem',
};

const FREQ_ORDER = ['15m', '30m', '1h', '2h', '4h', '6h', '12h', '1d', '1w'];

// ─── Health Gauge SVG ────────────────────────────────────────

function HealthGauge({ porcentaje }: { porcentaje: number }) {
  const radius = 40;
  const stroke = 8;
  const circumference = Math.PI * radius;
  const filled = (porcentaje / 100) * circumference;
  const color = porcentaje >= 75 ? '#22C55E' : porcentaje >= 50 ? '#F59E0B' : '#EF4444';

  return (
    <div className="relative inline-flex flex-col items-center">
      <svg width="100" height="58" viewBox="0 0 100 58">
        <path
          d={`M ${10} 50 A ${radius} ${radius} 0 0 1 90 50`}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-muted/30"
          strokeLinecap="round"
        />
        <path
          d={`M ${10} 50 A ${radius} ${radius} 0 0 1 90 50`}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={`${circumference}`}
          strokeDashoffset={circumference - filled}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s ease-out' }}
        />
      </svg>
      <div className="absolute top-5 text-center">
        <span className="text-lg font-bold" style={{ color }}>{porcentaje}%</span>
      </div>
      <span className="text-[10px] text-muted-foreground mt-0.5">Salud Global</span>
    </div>
  );
}

// ─── Mini bar chart by level ─────────────────────────────────

function NivelBars({ niveles }: { niveles: HealthNivel[] }) {
  return (
    <div className="flex items-end gap-2 h-20">
      {niveles.map(n => {
        const pct = n.total > 0 ? Math.round((n.sanos / n.total) * 100) : 0;
        const barH = Math.max(4, (n.total / Math.max(...niveles.map(x => x.total))) * 60);
        return (
          <div key={n.nivel} className="flex-1 flex flex-col items-center gap-0.5">
            <span className="text-[9px] font-medium text-muted-foreground">{pct}%</span>
            <div className="w-full relative rounded-t overflow-hidden" style={{ height: barH }}>
              <div
                className="absolute bottom-0 left-0 bg-emerald-500 rounded-t transition-all duration-700"
                style={{ height: `${pct}%`, width: '100%' }}
              />
              <div
                className="absolute bottom-0 left-0 rounded-t transition-all duration-700"
                style={{
                  height: `${100 - pct}%`,
                  width: '100%',
                  marginTop: `${pct}%`,
                  backgroundColor: pct >= 50 ? '#F59E0B' : '#EF4444',
                  opacity: 0.7,
                }}
              />
            </div>
            <span className="text-[9px] text-muted-foreground">N{n.nivel}</span>
            <span className="text-[8px] text-muted-foreground/60">{n.total}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Salud Badge ─────────────────────────────────────────────

function SaludBadge({ salud, size = 'sm' }: { salud: HealthMedio['salud']; size?: 'sm' | 'md' }) {
  const config = {
    sano: { icon: <CheckCircle2 className="h-3 w-3" />, label: 'Sano', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' },
    degradado: { icon: <AlertTriangle className="h-3 w-3" />, label: 'Degradado', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800' },
    muerto: { icon: <Skull className="h-3 w-3" />, label: 'Muerto', cls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border-red-200 dark:border-red-800' },
    con_errores: { icon: <Bug className="h-3 w-3" />, label: 'Errores', cls: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 border-orange-200 dark:border-orange-800' },
  }[salud];
  const sz = size === 'md' ? 'text-xs px-2.5 py-0.5' : 'text-[10px] gap-1 px-2';
  return (
    <Badge variant="outline" className={`${sz} ${config.cls}`}>
      {config.icon} {config.label}
    </Badge>
  );
}

// ─── Menciones sparkline (mini dots) ────────────────────────

function MencionesIndicator({ m7, m30 }: { m7: number; m30: number }) {
  const color = m7 > 0 ? 'text-emerald-500' : m30 > 0 ? 'text-amber-500' : 'text-red-400';
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex gap-0.5">
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className={`w-1.5 h-1.5 rounded-full transition-colors ${
              i < m7 ? 'bg-emerald-500' : i < m30 ? 'bg-amber-400/50' : 'bg-muted-foreground/20'
            }`}
          />
        ))}
      </div>
      <div className="text-right leading-none">
        <span className={`text-[11px] font-bold ${color}`}>{m7}</span>
        <span className="text-[8px] text-muted-foreground ml-0.5">/ {m30}</span>
      </div>
    </div>
  );
}

// ─── Error Rate bar ──────────────────────────────────────────

function ErrorRateBar({ rate }: { rate: number }) {
  const color = rate === 0 ? 'bg-emerald-500' : rate <= 25 ? 'bg-amber-500' : rate <= 50 ? 'bg-orange-500' : 'bg-red-500';
  return (
    <div className="flex flex-col items-end gap-0.5" title={`Error rate: ${rate}%`}>
      <div className="h-2 w-16 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${Math.min(rate, 100)}%` }} />
      </div>
      <span className="text-[8px] text-muted-foreground">{rate}%</span>
    </div>
  );
}

// ─── Response Time mini bar ──────────────────────────────────

function ResponseTimeBar({ ms }: { ms: number }) {
  if (ms <= 0) return <span className="text-[9px] text-muted-foreground/50">—</span>;
  // Clamp to 5s for visualization
  const pct = Math.min(100, (ms / 5000) * 100);
  const color = ms < 500 ? 'bg-emerald-500' : ms < 1500 ? 'bg-amber-500' : ms < 3000 ? 'bg-orange-500' : 'bg-red-500';
  const label = ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
  return (
    <div className="flex flex-col items-end gap-0.5" title={`Response time: ${ms}ms`}>
      <div className="h-1.5 w-12 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[8px] text-muted-foreground">{label}</span>
    </div>
  );
}

// ─── Checks Sin Cambio Heatmap ──────────────────────────────

function ChecksSinCambioHeat({ count }: { count: number }) {
  // 0-2 green, 3-5 yellow, 6-8 orange, 9+ red
  const color = count <= 2 ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20'
    : count <= 5 ? 'text-amber-600 bg-amber-500/10 border-amber-500/20'
    : count <= 8 ? 'text-orange-600 bg-orange-500/10 border-orange-500/20'
    : 'text-red-600 bg-red-500/10 border-red-500/20';
  const icon = count <= 2 ? <Sparkles className="h-3 w-3" />
    : count <= 5 ? <Clock className="h-3 w-3" />
    : count <= 8 ? <AlertTriangle className="h-3 w-3" />
    : <Skull className="h-3 w-3" />;
  return (
    <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded border ${color}`} title={`Checks sin cambio: ${count}`}>
      {icon}
      <span className="text-[10px] font-bold">{count}</span>
    </div>
  );
}

// ─── Frequency Degradation Visual ───────────────────────────

function FreqDegradationVisual({ base, actual }: { base: string; actual: string }) {
  const baseIdx = FREQ_ORDER.indexOf(base);
  const actualIdx = FREQ_ORDER.indexOf(actual);
  const isDegraded = actualIdx > baseIdx;
  return (
    <div className="flex items-center gap-1" title={`Frecuencia: ${FREQ_LABELS[base] || base} → ${FREQ_LABELS[actual] || actual}`}>
      <span className={`text-[9px] font-medium ${isDegraded ? 'text-muted-foreground line-through' : 'text-emerald-600'}`}>
        {FREQ_LABELS[base] || base}
      </span>
      {isDegraded && (
        <>
          <TrendingDown className="h-2.5 w-2.5 text-amber-500" />
          <span className="text-[9px] font-bold text-amber-600">
            {FREQ_LABELS[actual] || actual}
          </span>
        </>
      )}
    </div>
  );
}

// ─── Checks/Cambios Ratio ────────────────────────────────────

function ChecksCambiosRatio({ checks, cambios }: { checks: number; cambios: number }) {
  if (checks === 0) return <span className="text-[9px] text-muted-foreground/50">0/0</span>;
  const ratio = Math.round((cambios / checks) * 100);
  const color = ratio >= 20 ? 'text-emerald-600' : ratio >= 5 ? 'text-amber-600' : 'text-red-500';
  return (
    <div className="flex flex-col items-center" title={`${cambios} cambios de ${checks} checks (${ratio}%)`}>
      <span className={`text-[10px] font-bold ${color}`}>{ratio}%</span>
      <span className="text-[7px] text-muted-foreground">{cambios}/{checks}</span>
    </div>
  );
}

// ─── Publication Hours Histogram ─────────────────────────────

function HorasPublicacionChart({ horasJSON }: { horasJSON: string }) {
  let data: Record<number, number> = {};
  try {
    data = JSON.parse(horasJSON || '{}');
  } catch {
    data = {};
  }

  const entries = Object.entries(data)
    .map(([h, count]) => ({ hour: parseInt(h), count: count as number }))
    .filter(e => !isNaN(e.hour) && e.count > 0)
    .sort((a, b) => a.hour - b.hour);

  if (entries.length === 0) {
    return <p className="text-[10px] text-muted-foreground italic">Sin datos de publicacion</p>;
  }

  const maxCount = Math.max(...entries.map(e => e.count));
  const peakHours = entries.filter(e => e.count >= maxCount * 0.7).map(e => `${e.hour}:00`);

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <CalendarClock className="h-3 w-3 text-muted-foreground" />
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
          Patron de Publicacion
        </span>
        {peakHours.length > 0 && (
          <span className="text-[9px] text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded">
            Pico: {peakHours.join(', ')}
          </span>
        )}
      </div>
      <div className="flex items-end gap-px h-16">
        {Array.from({ length: 24 }).map((_, idx) => {
          const h = idx;
          const entry = entries.find(e => e.hour === h);
          const count = entry?.count || 0;
          const barH = maxCount > 0 ? Math.max(0, (count / maxCount) * 52) : 0;
          const isPeak = count >= maxCount * 0.7;
          return (
            <div key={h} className="flex-1 flex flex-col items-center gap-0.5">
              <div className="w-full relative" style={{ height: 52 }}>
                <div
                  className={`absolute bottom-0 w-full rounded-t transition-all duration-500 ${
                    isPeak ? 'bg-emerald-500' : count > 0 ? 'bg-sky-500/60' : 'bg-transparent'
                  }`}
                  style={{ height: barH }}
                />
              </div>
              <span className={`text-[7px] ${isPeak ? 'text-emerald-600 font-bold' : 'text-muted-foreground/50'} ${h % 3 !== 0 ? 'opacity-0' : ''}`}>
                {h}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Strategy Badge ──────────────────────────────────────────

function StrategyBadge({ tipo }: { tipo: string }) {
  const config: Record<string, { label: string; cls: string }> = {
    rss: { label: 'RSS', cls: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 border-orange-200' },
    head: { label: 'HEAD', cls: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300 border-sky-200' },
    fingerprint: { label: 'HASH', cls: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 border-violet-200' },
    api: { label: 'API', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200' },
  };
  const c = config[tipo] || { label: tipo, cls: 'bg-muted text-muted-foreground border-border' };
  return <Badge variant="outline" className={`text-[8px] px-1.5 py-0 h-4 ${c.cls}`}>{c.label}</Badge>;
}

// ─── Fila de Medio (card individual) ────────────────────────

function MedioCard({
  medio,
  fuente,
  onCheck,
  selected,
  onToggleSelect,
  batchMode,
}: {
  medio: HealthMedio;
  fuente: FuenteEstado | undefined;
  onCheck: (medioId: string) => void;
  selected: boolean;
  onToggleSelect: (medioId: string) => void;
  batchMode: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [checkLoading, setCheckLoading] = useState(false);

  const borderColor =
    medio.salud === 'muerto' ? 'border-l-red-500' :
    medio.salud === 'con_errores' ? 'border-l-orange-500' :
    medio.salud === 'degradado' ? 'border-l-amber-500' :
    'border-l-emerald-500';

  const bgColor =
    medio.salud === 'muerto' ? 'bg-red-500/5' :
    medio.salud === 'con_errores' ? 'bg-orange-500/5' :
    medio.salud === 'degradado' ? 'bg-amber-500/5' :
    'bg-emerald-500/[0.02]';

  const hace = (iso: string | null) => {
    if (!iso) return 'nunca';
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m`;
    const hs = Math.floor(mins / 60);
    if (hs < 24) return `${hs}h`;
    return `${Math.floor(hs / 24)}d`;
  };

  const handleCheck = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCheckLoading(true);
    onCheck(medio.id);
    setTimeout(() => setCheckLoading(false), 2000);
  };

  const isDegradedFuente = fuente ? (fuente.checksSinCambio >= 7) : false;
  const isDeadFuente = fuente ? (fuente.activo && fuente.ultimoCheck && (Date.now() - new Date(fuente.ultimoCheck).getTime() > 48 * 3600000)) : false;

  return (
    <div className={`border border-border/50 rounded-lg border-l-4 ${borderColor} ${bgColor} overflow-hidden transition-all hover:shadow-sm`}>
      {/* Main row */}
      <div
        className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-background/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Batch checkbox */}
        {batchMode && (
          <div onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => onToggleSelect(medio.id)}
              className={`h-5 w-5 rounded border-2 flex items-center justify-center transition-all ${
                selected
                  ? 'bg-primary border-primary text-primary-foreground'
                  : 'border-muted-foreground/30 hover:border-primary/50'
              }`}
            >
              {selected && <CheckSquare className="h-3 w-3" />}
            </button>
          </div>
        )}

        {/* Dual health dot indicator */}
        <div className="flex flex-col gap-0.5 shrink-0">
          <div className={`h-2 w-2 rounded-full ${
            medio.salud === 'sano' ? 'bg-emerald-500' :
            medio.salud === 'degradado' ? 'bg-amber-500' :
            medio.salud === 'muerto' ? 'bg-red-500' :
            'bg-orange-500'
          }`} title={`Salud menciones: ${medio.salud}`} />
          <div className={`h-2 w-2 rounded-full ${
            isDeadFuente ? 'bg-red-600' :
            isDegradedFuente ? 'bg-amber-500' :
            'bg-emerald-400'
          }`} title={`Salud check-first: ${isDeadFuente ? 'muerto' : isDegradedFuente ? 'degradado' : 'sano'}`} />
        </div>

        {/* Nombre + badges */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-semibold text-foreground truncate">{medio.nombre}</span>
            <Badge variant="outline" className="text-[8px] px-1.5 py-0 h-4 bg-muted/50 shrink-0">
              N{medio.nivel}
            </Badge>
            {fuente && <StrategyBadge tipo={fuente.tipoCheck} />}
            {!fuente?.activo && (
              <Badge variant="outline" className="text-[8px] px-1.5 py-0 h-4 bg-red-500/10 text-red-500 border-red-500/20 shrink-0">
                OFF
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            {fuente && <FreqDegradationVisual base={fuente.frecuenciaBase} actual={fuente.frecuenciaActual} />}
            {medio.alerta && (
              <span className="text-[9px] text-muted-foreground truncate">{medio.alerta}</span>
            )}
          </div>
        </div>

        {/* Checks sin cambio heatmap */}
        {fuente && <ChecksSinCambioHeat count={fuente.checksSinCambio} />}

        {/* Checks/Cambios ratio */}
        {fuente && <ChecksCambiosRatio checks={fuente.totalChecks} cambios={fuente.totalCambios} />}

        {/* Menciones indicator */}
        <MencionesIndicator m7={medio.menciones7dias} m30={medio.menciones30dias} />

        {/* Error rate */}
        <ErrorRateBar rate={medio.errorRate} />

        {/* Response time */}
        {fuente && <ResponseTimeBar ms={fuente.responseTime} />}

        {/* Ultimo check */}
        {fuente && (
          <div className="text-right shrink-0" title="Ultimo check">
            <span className="text-[9px] font-medium text-muted-foreground">{hace(fuente.ultimoCheck)}</span>
          </div>
        )}

        {/* Status badge */}
        <SaludBadge salud={medio.salud} />

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={handleCheck}
            disabled={checkLoading}
            title="Forzar check"
          >
            {checkLoading ? <Loader2 className="h-3 w-3 text-sky-500 animate-spin" /> : <Zap className="h-3 w-3 text-sky-500" />}
          </Button>
          {expanded ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-3 pb-3 pt-2 border-t border-border/30">
          {/* Publication hours histogram */}
          {fuente?.horasPublicacion && (
            <div className="mb-3 p-2 rounded-lg bg-muted/30">
              <HorasPublicacionChart horasJSON={fuente.horasPublicacion} />
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
            {fuente && (
              <>
                <div className="p-2 rounded bg-background/80">
                  <p className="text-[9px] text-muted-foreground uppercase">Ultimo Check</p>
                  <p className="text-[11px] font-medium">{hace(fuente.ultimoCheck)}</p>
                </div>
                <div className="p-2 rounded bg-background/80">
                  <p className="text-[9px] text-muted-foreground uppercase">Ultimo Cambio</p>
                  <p className="text-[11px] font-medium">{hace(fuente.ultimoCambio)}</p>
                </div>
                <div className="p-2 rounded bg-background/80">
                  <p className="text-[9px] text-muted-foreground uppercase">Checks / Cambios</p>
                  <p className="text-[11px] font-medium">{fuente.totalChecks} / {fuente.totalCambios}</p>
                </div>
                <div className="p-2 rounded bg-background/80">
                  <p className="text-[9px] text-muted-foreground uppercase">Response Time</p>
                  <p className="text-[11px] font-medium">{fuente.responseTime > 0 ? `${fuente.responseTime}ms` : '—'}</p>
                </div>
                <div className="p-2 rounded bg-background/80">
                  <p className="text-[9px] text-muted-foreground uppercase">Estrategia</p>
                  <p className="text-[11px] font-medium">{fuente.tipoCheck}</p>
                </div>
                <div className="p-2 rounded bg-background/80">
                  <p className="text-[9px] text-muted-foreground uppercase">Frecuencia</p>
                  <p className="text-[11px] font-medium">
                    {fuente.frecuenciaBase}
                    {fuente.frecuenciaBase !== fuente.frecuenciaActual && (
                      <span className="text-amber-600 ml-1">→ {fuente.frecuenciaActual}</span>
                    )}
                  </p>
                </div>
                <div className="p-2 rounded bg-background/80">
                  <p className="text-[9px] text-muted-foreground uppercase">Horarios Optimos</p>
                  <p className="text-[11px] font-medium">{fuente.horariosOptimos.length > 0 ? fuente.horariosOptimos.join(', ') + 'h' : '—'}</p>
                </div>
                <div className="p-2 rounded bg-background/80">
                  <p className="text-[9px] text-muted-foreground uppercase">Estado</p>
                  <p className="text-[11px] font-medium">
                    {fuente.activo ? (
                      <span className="text-emerald-600 flex items-center gap-1"><Wifi className="h-3 w-3" /> Activo</span>
                    ) : (
                      <span className="text-red-500 flex items-center gap-1"><WifiOff className="h-3 w-3" /> Inactivo</span>
                    )}
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Cache info */}
          {fuente && (
            <div className="grid grid-cols-3 gap-2 mt-2">
              <div className="p-1.5 rounded bg-muted/30 text-center">
                <p className="text-[8px] text-muted-foreground uppercase">ETag</p>
                <p className="text-[9px] font-mono text-muted-foreground truncate" title={fuente.etag}>
                  {fuente.etag ? `${fuente.etag.substring(0, 20)}...` : '—'}
                </p>
              </div>
              <div className="p-1.5 rounded bg-muted/30 text-center">
                <p className="text-[8px] text-muted-foreground uppercase">Fingerprint</p>
                <p className="text-[9px] font-mono text-muted-foreground truncate" title={fuente.fingerprint}>
                  {fuente.fingerprint ? `${fuente.fingerprint.substring(0, 20)}...` : '—'}
                </p>
              </div>
              <div className="p-1.5 rounded bg-muted/30 text-center">
                <p className="text-[8px] text-muted-foreground uppercase">Last-Modified</p>
                <p className="text-[9px] text-muted-foreground truncate" title={fuente.lastModified}>
                  {fuente.lastModified || '—'}
                </p>
              </div>
            </div>
          )}

          {/* Error */}
          {fuente?.error && (
            <div className="flex items-start gap-1.5 mt-2 p-2 rounded bg-red-500/10 border border-red-500/20">
              <ShieldAlert className="h-3 w-3 text-red-500 mt-0.5 shrink-0" />
              <span className="text-[10px] text-red-600 dark:text-red-400 break-all">{fuente.error}</span>
            </div>
          )}

          {/* URL */}
          <div className="flex items-center gap-1.5 mt-2 text-[10px] text-muted-foreground">
            <Globe className="h-3 w-3 shrink-0" />
            <span className="truncate">{medio.url}</span>
            <a href={medio.url} target="_blank" rel="noopener noreferrer" className="shrink-0 hover:text-foreground">
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Main View
// ═══════════════════════════════════════════════════════════

export function AuditoriaFuentesView() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [fuentes, setFuentes] = useState<FuenteEstado[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroSalud, setFiltroSalud] = useState<SaludFilter>('todos');
  const [filtroNivel, setFiltroNivel] = useState('todos');
  const [filtroTipoCheck, setFiltroTipoCheck] = useState('todos');
  const [sortKey, setSortKey] = useState<SortKey>('salud');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Batch mode
  const [batchMode, setBatchMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchAction, setBatchAction] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [hRes, fRes] = await Promise.all([
        fetchWithTimeout('/api/medios/health', { timeoutMs: 15_000 }),
        fetchWithTimeout('/api/jobs/fuentes', { timeoutMs: 10_000 }),
      ]);
      if (hRes.ok) setHealth(await hRes.json());
      if (fRes.ok) setFuentes(await fRes.json());
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const forceCheck = useCallback(async (medioId: string) => {
    const fuente = fuentes.find(f => f.medioId === medioId);
    if (!fuente) return;
    setActionLoading(medioId);
    try {
      await fetchWithTimeout('/api/scraping/phase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'forzar_check', fuenteId: fuente.id }),
        timeoutMs: 10_000,
      });
      setTimeout(fetchData, 2000);
    } catch { /* silent */ }
    setActionLoading(null);
  }, [fuentes, fetchData]);

  // Batch actions
  const toggleSelect = useCallback((medioId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(medioId)) next.delete(medioId);
      else next.add(medioId);
      return next;
    });
  }, []);

  const executeBatchAction = useCallback(async (action: string) => {
    if (selectedIds.size === 0) return;
    setBatchAction(action);
    try {
      for (const medioId of selectedIds) {
        const fuente = fuentes.find(f => f.medioId === medioId);
        if (!fuente) continue;

        if (action === 'force_check') {
          await fetchWithTimeout('/api/scraping/phase', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accion: 'forzar_check', fuenteId: fuente.id }),
            timeoutMs: 10_000,
          });
        } else if (action === 'reset_frecuencia') {
          // Reset frequency to base via direct DB update
          await fetchWithTimeout(`/api/jobs/fuentes/${fuente.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ frecuenciaActual: fuente.frecuenciaBase, checksSinCambio: 0 }),
            timeoutMs: 10_000,
          });
        } else if (action === 'toggle_active') {
          await fetchWithTimeout(`/api/jobs/fuentes/${fuente.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ activo: !fuente.activo }),
            timeoutMs: 10_000,
          });
        }

        // Small delay between actions to avoid flooding
        await new Promise(r => setTimeout(r, 300));
      }
      setTimeout(fetchData, 1500);
    } catch { /* silent */ }
    setBatchAction(null);
    setSelectedIds(new Set());
  }, [selectedIds, fuentes, fetchData]);

  // Build fuentes map by medioId
  const fuentesMap = useMemo(() => new Map(fuentes.map(f => [f.medioId, f])), [fuentes]);

  // Filter + sort medios
  // mediosFiltered computed here, referenced by selectAll above
  const mediosFiltered = useMemo(() => {
    return (health?.medios || [])
      .filter(m => {
        if (filtroSalud !== 'todos' && m.salud !== filtroSalud) return false;
        if (filtroNivel !== 'todos' && m.nivel !== filtroNivel) return false;
        if (search && !m.nombre.toLowerCase().includes(search.toLowerCase())) return false;
        if (filtroTipoCheck !== 'todos') {
          const fuente = fuentesMap.get(m.id);
          if (!fuente || fuente.tipoCheck !== filtroTipoCheck) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const saludOrder = { muerto: 0, con_errores: 1, degradado: 2, sano: 3 };
        const dir = sortDir === 'asc' ? 1 : -1;
        switch (sortKey) {
          case 'salud': return (saludOrder[a.salud] - saludOrder[b.salud]) * dir;
          case 'nombre': return a.nombre.localeCompare(b.nombre) * dir;
          case 'menciones7dias': return (a.menciones7dias - b.menciones7dias) * dir;
          case 'errorRate': return (a.errorRate - b.errorRate) * dir;
          case 'totalChecks': return ((fuentesMap.get(a.id)?.totalChecks || 0) - (fuentesMap.get(b.id)?.totalChecks || 0)) * dir;
          case 'responseTime': return ((fuentesMap.get(b.id)?.responseTime || 0) - (fuentesMap.get(a.id)?.responseTime || 0)) * dir;
          case 'checksSinCambio': return ((fuentesMap.get(b.id)?.checksSinCambio || 0) - (fuentesMap.get(a.id)?.checksSinCambio || 0)) * dir;
          case 'frecuencia': {
            const fa = fuentesMap.get(a.id)?.frecuenciaActual || '1w';
            const fb = fuentesMap.get(b.id)?.frecuenciaActual || '1w';
            return (FREQ_ORDER.indexOf(fa) - FREQ_ORDER.indexOf(fb)) * dir;
          }
          default: return 0;
        }
      });
  }, [health?.medios, filtroSalud, filtroNivel, filtroTipoCheck, search, sortKey, sortDir, fuentesMap]);

  const selectAll = useCallback(() => {
    const allIds = mediosFiltered.map(m => m.id);
    if (selectedIds.size === allIds.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allIds));
    }
  }, [mediosFiltered, selectedIds.size]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const r = health?.resumen;
  const niveles = health?.porNivel || [];

  // Stats computed from fuentes
  const statsFuentes = useMemo(() => {
    const totalCambios = fuentes.reduce((s, f) => s + f.totalCambios, 0);
    const totalChecks = fuentes.reduce((s, f) => s + f.totalChecks, 0);
    const avgResponseTime = fuentes.length > 0
      ? Math.round(fuentes.reduce((s, f) => s + f.responseTime, 0) / fuentes.filter(f => f.responseTime > 0).length)
      : 0;
    const degradadas = fuentes.filter(f => f.frecuenciaActual !== f.frecuenciaBase).length;
    const activas = fuentes.filter(f => f.activo).length;
    const withError = fuentes.filter(f => !!f.error).length;
    return { totalCambios, totalChecks, avgResponseTime, degradadas, activas, withError };
  }, [fuentes]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Auditoria de Fuentes
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Monitoreo de salud, rendimiento y estado operativo de todas las fuentes
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={batchMode ? 'default' : 'outline'}
            size="sm"
            className="text-xs gap-1.5"
            onClick={() => { setBatchMode(!batchMode); setSelectedIds(new Set()); }}
          >
            <Layers className="h-3.5 w-3.5" />
            {batchMode ? 'Salir Batch' : 'Batch'}
          </Button>
          <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={fetchData}>
            <RefreshCw className="h-3.5 w-3.5" />
            Actualizar
          </Button>
        </div>
      </div>

      {/* ── Batch Actions Bar ── */}
      {batchMode && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium">
                  {selectedIds.size} seleccionadas
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-[10px] h-7 gap-1"
                  onClick={selectAll}
                >
                  {selectedIds.size === mediosFiltered.length ? 'Deseleccionar' : 'Seleccionar todas'}
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-[10px] h-7 gap-1 text-sky-600 border-sky-200 hover:bg-sky-50"
                  onClick={() => executeBatchAction('force_check')}
                  disabled={selectedIds.size === 0 || !!batchAction}
                >
                  {batchAction === 'force_check' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
                  Forzar Check ({selectedIds.size})
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-[10px] h-7 gap-1 text-amber-600 border-amber-200 hover:bg-amber-50"
                  onClick={() => executeBatchAction('reset_frecuencia')}
                  disabled={selectedIds.size === 0 || !!batchAction}
                >
                  {batchAction === 'reset_frecuencia' ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                  Reset Frecuencia
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-[10px] h-7 gap-1 text-violet-600 border-violet-200 hover:bg-violet-50"
                  onClick={() => executeBatchAction('toggle_active')}
                  disabled={selectedIds.size === 0 || !!batchAction}
                >
                  {batchAction === 'toggle_active' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                  Activar/Desactivar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── KPI Row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KPICard
          icon={<Radio className="h-5 w-5" />}
          value={r?.total ?? 0}
          label="Total Fuentes"
          subtext={`${statsFuentes.activas} activas`}
          colorClass="text-sky-500"
        />
        <KPICard
          icon={<Heart className="h-5 w-5" />}
          value={r?.sanos ?? 0}
          label="Sanas"
          subtext={r ? `${r.porcentajeSalud}% del total` : undefined}
          colorClass="text-emerald-500"
        />
        <KPICard
          icon={<TrendingDown className="h-5 w-5" />}
          value={r?.degradados ?? 0}
          label="Degradadas"
          subtext="Sin menciones en 7d"
          colorClass="text-amber-500"
        />
        <KPICard
          icon={<Skull className="h-5 w-5" />}
          value={r?.muertos ?? 0}
          label="Muertas"
          subtext="Sin menciones en 30d+"
          colorClass="text-red-500"
        />
        <KPICard
          icon={<Bug className="h-5 w-5" />}
          value={statsFuentes.withError}
          label="Con Errores"
          subtext="Error en FuenteEstado"
          colorClass="text-orange-500"
        />
        <KPICard
          icon={<Gauge className="h-5 w-5" />}
          value={statsFuentes.avgResponseTime}
          label="Avg. Respuesta"
          subtext={`ms · ${statsFuentes.totalChecks} checks`}
          colorClass="text-violet-500"
        />
      </div>

      {/* ── Health Gauge + Nivel Bars + Extra stats ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Health Gauge */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="text-center">
                <HealthGauge porcentaje={r?.porcentajeSalud ?? 0} />
              </div>
              <div className="space-y-2 flex-1 ml-4">
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  <span className="text-[10px] text-muted-foreground">Sanas</span>
                  <span className="text-[10px] font-semibold text-emerald-600 ml-auto">{r?.sanos}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                  <span className="text-[10px] text-muted-foreground">Degradadas</span>
                  <span className="text-[10px] font-semibold text-amber-600 ml-auto">{r?.degradados}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full bg-orange-500" />
                  <span className="text-[10px] text-muted-foreground">Con errores</span>
                  <span className="text-[10px] font-semibold text-orange-600 ml-auto">{statsFuentes.withError}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full bg-red-500" />
                  <span className="text-[10px] text-muted-foreground">Muertas</span>
                  <span className="text-[10px] font-semibold text-red-600 ml-auto">{r?.muertos}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Nivel Bars */}
        <Card>
          <CardContent className="p-4">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-3">
              <BarChart3 className="h-3 w-3 inline mr-1" />
              Salud por Nivel
            </p>
            {niveles.length > 0 ? (
              <NivelBars niveles={niveles} />
            ) : (
              <p className="text-xs text-muted-foreground">Sin datos por nivel</p>
            )}
            <div className="mt-3 space-y-1">
              {niveles.map(n => (
                <div key={n.nivel} className="flex items-center justify-between text-[10px]">
                  <span className="text-muted-foreground">{n.label}</span>
                  <span className="font-medium">
                    <span className="text-emerald-600">{n.sanos}</span>
                    <span className="text-muted-foreground/50">/{n.total}</span>
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Operational Stats */}
        <Card>
          <CardContent className="p-4">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-3">
              <Activity className="h-3 w-3 inline mr-1" />
              Estadisticas Operativas
            </p>
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between text-[10px] mb-1">
                  <span className="text-muted-foreground">Total Checks</span>
                  <span className="font-semibold">{statsFuentes.totalChecks.toLocaleString()}</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-sky-500" style={{ width: '100%' }} />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between text-[10px] mb-1">
                  <span className="text-muted-foreground">Cambios Detectados</span>
                  <span className="font-semibold text-emerald-600">{statsFuentes.totalCambios.toLocaleString()}</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all duration-700"
                    style={{ width: `${statsFuentes.totalChecks > 0 ? Math.min(100, (statsFuentes.totalCambios / statsFuentes.totalChecks) * 100) : 0}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between text-[10px] mb-1">
                  <span className="text-muted-foreground">Frecuencia Degradada</span>
                  <span className="font-semibold text-amber-600">{statsFuentes.degradadas}</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-amber-500 transition-all duration-700"
                    style={{ width: `${fuentes.length > 0 ? (statsFuentes.degradadas / fuentes.length) * 100 : 0}%` }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="p-1.5 rounded bg-muted/30 text-center">
                  <p className="text-[8px] text-muted-foreground uppercase">Tasa Cambio</p>
                  <p className="text-[11px] font-bold text-emerald-600">
                    {statsFuentes.totalChecks > 0 ? Math.round((statsFuentes.totalCambios / statsFuentes.totalChecks) * 100) : 0}%
                  </p>
                </div>
                <div className="p-1.5 rounded bg-muted/30 text-center">
                  <p className="text-[8px] text-muted-foreground uppercase">Avg. Response</p>
                  <p className="text-[11px] font-bold text-violet-600">
                    {statsFuentes.avgResponseTime > 0 ? `${statsFuentes.avgResponseTime}ms` : '—'}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Filters + Search ── */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <FilterSelect
              value={filtroSalud}
              onChange={(v) => setFiltroSalud(v as SaludFilter)}
              options={['todos', 'sano', 'degradado', 'muerto', 'con_errores']}
            />
            <FilterSelect
              value={filtroNivel}
              onChange={setFiltroNivel}
              options={['todos', '1', '2', '3', '4', '5'].map(n => n === 'todos' ? 'todos' : `Nivel ${n}`)}
            />
            <FilterSelect
              value={filtroTipoCheck}
              onChange={setFiltroTipoCheck}
              options={['todos', 'rss', 'head', 'fingerprint', 'api'].map(v => v === 'todos' ? 'todos' : v.toUpperCase())}
            />
            <div className="flex-1 min-w-[150px]">
              <input
                type="text"
                placeholder="Buscar fuente..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-8 rounded-md border border-input bg-background px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <span className="text-[10px] text-muted-foreground">
              {mediosFiltered.length} de {health?.medios.length ?? 0}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* ── Sort bar ── */}
      <div className="flex items-center gap-1 flex-wrap">
        {([
          ['salud', 'Salud'],
          ['nombre', 'Nombre'],
          ['menciones7dias', 'Menciones 7d'],
          ['errorRate', 'Error Rate'],
          ['checksSinCambio', 'Sin Cambio'],
          ['responseTime', 'Respuesta'],
          ['frecuencia', 'Frecuencia'],
          ['totalChecks', 'Total Checks'],
        ] as [SortKey, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => toggleSort(key)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors ${
              sortKey === key
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            <ArrowUpDown className="h-2.5 w-2.5" />
            {label}
            {sortKey === key && <span className="text-[8px]">{sortDir === 'asc' ? '↑' : '↓'}</span>}
          </button>
        ))}
      </div>

      {/* ── Legend ── */}
      <div className="flex items-center gap-4 flex-wrap text-[9px] text-muted-foreground">
        <div className="flex items-center gap-1">
          <span className="font-medium">Doble dot:</span>
          <div className="flex flex-col gap-px">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            <div className="h-1.5 w-1.5 rounded-full bg-sky-400" />
          </div>
          <span>Arriba=menciones, Abajo=check-first</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          <span>0-2 sin cambio</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          <span>3-5 sin cambio</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-1.5 w-1.5 rounded-full bg-orange-500" />
          <span>6-8 sin cambio</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-1.5 w-1.5 rounded-full bg-red-500" />
          <span>9+ sin cambio</span>
        </div>
      </div>

      {/* ── Medios list ── */}
      {mediosFiltered.length > 0 ? (
        <div className="space-y-2">
          {mediosFiltered.map(m => (
            <MedioCard
              key={m.id}
              medio={m}
              fuente={fuentesMap.get(m.id)}
              onCheck={forceCheck}
              selected={selectedIds.has(m.id)}
              onToggleSelect={toggleSelect}
              batchMode={batchMode}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<ShieldOff className="h-8 w-8" />}
          text="No se encontraron fuentes"
          subtext={filtroSalud !== 'todos' || filtroNivel !== 'todos' || search ? 'Prueba cambiar los filtros' : 'No hay fuentes registradas'}
        />
      )}
    </div>
  );
}
