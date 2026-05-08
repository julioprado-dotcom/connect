'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from '@/components/ui/table';
import {
  Newspaper, Radio, Bell, UserCircle, Package, TrendingUp,
  ChevronRight, ArrowRight, Cpu, Database, Clock, Activity,
  CheckCircle2, XCircle, AlertTriangle, BarChart3, Zap, FileBarChart,
  Monitor, Eye, ArrowUpRight, ArrowDownRight, Minus, ShieldAlert,
  Send, AlertOctagon, Timer, ChevronDown, ChevronUp, Sparkles,
} from 'lucide-react';
import { useDashboardStore } from '@/stores/useDashboardStore';
import { MiniGauge } from '@/components/dashboard/gauges/MiniGauge';
import { TopVariations } from '@/components/dashboard/TopVariations';
import { AlarmasComerciales } from '@/components/dashboard/AlarmasComerciales';
import { PipelineMonitor } from '@/components/dashboard/PipelineMonitor';
import { SENTIMIENTO_STYLES, TIPO_MENCION_LABELS } from '@/constants/ui';
import { ALL_PRODUCTS } from '@/constants/nav';
import { fetchWithTimeout } from '@/lib/fetch-utils';
import type { SystemMetrics } from '@/types/dashboard';
import { StatusOrb, StatusPill, StatusBar } from '@/components/dashboard/gauges/StatusOrb';
import type { StatusLevel } from '@/components/dashboard/gauges/StatusOrb';

// ─── Alertas Comerciales types ──────────────────────────

interface VariacionItem {
  id: string;
  nombre: string;
  slug?: string;
  color?: string;
  icono?: string;
  partidoSigla?: string;
  camara?: string;
  mencionesActuales: number;
  mencionesAnteriores: number;
  variacion: number;
}

interface ContratoPorVencer {
  id: string;
  clienteId: string;
  clienteNombre: string;
  tipoProducto: string;
  frecuencia: string;
  fechaFin: string;
  diasRestantes: number;
  montoMensual: number;
  moneda: string;
}

interface SolicitudPendiente {
  contratoId: string;
  tipo: string;
  descripcion: string;
  clienteNombre: string;
}

interface AlertasComercialesData {
  topVariaciones: {
    personas: VariacionItem[];
    ejes: VariacionItem[];
  };
  contratosPorVencer: ContratoPorVencer[];
  solicitudesPendientes: SolicitudPendiente[];
  entregasPendientes: number;
}

// ─── AI Health types ──────────────────────────────────────

interface AiHealthData {
  statusLevel: StatusLevel;
  statusText: string;
  llamadasLLMHoy: number;
  mencionesCreadasHoy: number;
  mencionesClasificadasHoy: number;
  reportesGeneradosHoy: number;
  costoEstimadoHoy: number;
  ultimaActividad: string | null;
  ultimaActividadHace: string;
  jobsFallidosHoy: number;
  uptimeIA: string;
}

// ─── Entregas Hoy types ────────────────────────────────────

interface FallidaConDiagnostico {
  id: string;
  tipoBoletin: string;
  canal: string;
  fechaEnvio: string | null;
  error: string | null;
  contrato: string;
  clienteNombre: string;
  diagnostico: {
    causa: string;
    accion: string;
    equipo: string;
  };
}

interface EntregasHoyData {
  total: number;
  enviadas: number;
  pendientes: number;
  fallidas: number;
  enProcesoCount: number;
  porTipo: Record<string, { total: number; enviadas: number; pendientes: number; fallidas: number }>;
  fallidasConDiagnostico: FallidaConDiagnostico[];
  enProceso: {
    id: string;
    tipoBoletin: string;
    canal: string;
    fechaCreacion: string;
    contrato: string;
    clienteNombre: string;
    fechaProgramada: string | null;
  }[];
}

// ─── Animation variants ────────────────────────────────────

const fadeInUp = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.35, ease: 'easeOut' as const },
  }),
};

const stagger = {
  visible: { transition: { staggerChildren: 0.05 } },
};

// ─── Trend indicator helper ────────────────────────────────

function TrendIndicator({ value, label }: { value: number; label: string }) {
  const isUp = value > 0;
  const isNeutral = value === 0;
  return (
    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
      {isNeutral ? (
        <Minus className="h-3 w-3 text-stone-400" />
      ) : isUp ? (
        <ArrowUpRight className="h-3 w-3 text-emerald-500" />
      ) : (
        <ArrowDownRight className="h-3 w-3 text-red-500" />
      )}
      <span className={isNeutral ? '' : isUp ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
        {Math.abs(value)}%
      </span>
      <span>{label}</span>
    </div>
  );
}

// ─── Mini KPI Box ──────────────────────────────────────────

function MiniKPI({ value, label, color }: { value: number | string; label: string; color?: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 min-w-[56px]">
      <span className={`text-lg font-bold ${color || 'text-foreground'}`}>{value}</span>
      <span className="text-[9px] text-muted-foreground leading-tight text-center">{label}</span>
    </div>
  );
}

// ─── Category Card ─────────────────────────────────────────

function CategoryCard({
  index,
  icon,
  title,
  viewId,
  kpis,
  featured,
  variation,
  borderColor,
  onClick,
}: {
  index: number;
  icon: React.ReactNode;
  title: string;
  viewId: string;
  kpis: { value: number | string; label: string; color?: string }[];
  featured: React.ReactNode;
  variation: React.ReactNode;
  borderColor?: string;
  onClick: () => void;
}) {
  return (
    <motion.div
      custom={index}
      variants={fadeInUp}
      initial="hidden"
      animate="visible"
    >
      <Card
        className={`cursor-pointer hover:shadow-md hover:ring-1 hover:ring-primary/30 transition-all ${borderColor || ''}`}
        onClick={onClick}
      >
        {/* Header */}
        <CardHeader className="pb-2 pt-3 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="text-muted-foreground">{icon}</div>
              <CardTitle className="text-sm font-semibold">{title}</CardTitle>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary transition-colors" />
          </div>
        </CardHeader>

        <CardContent className="px-4 pb-3 space-y-3">
          {/* KPIs row */}
          <div className="flex items-center justify-around py-2 rounded-lg bg-muted/40 border border-border/50">
            {kpis.map((kpi, i) => (
              <MiniKPI key={i} value={kpi.value} label={kpi.label} color={kpi.color} />
            ))}
          </div>

          {/* Featured */}
          <div className="text-xs">{featured}</div>

          {/* Variation */}
          <div className="border-t border-border/50 pt-2">{variation}</div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════

// ─── Hook: polling con debounce onFocus ─────────────────────
// Pausa polling cuando el tab no es visible, reanuda al volver.
// Intervalo minimo 30s. Fetch inmediato al recuperar foco.

function usePolling(fetchFn: () => void | Promise<void>, intervalMs: number = 30_000) {
  useEffect(() => {
    fetchFn();
    const interval = setInterval(fetchFn, intervalMs);
    let onFocusFn: (() => void) | null = null;

    const onBlur = () => clearInterval(interval);
    const onFocus = () => {
      fetchFn();
      // Reanudar polling
      const reanudar = setInterval(fetchFn, intervalMs);
      onFocusFn = () => clearInterval(reanudar);
    };

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        onBlur();
      } else {
        onFocus();
      }
    });

    return () => {
      clearInterval(interval);
      onFocusFn?.();
    };
  }, [fetchFn, intervalMs]);
}

export function DashboardCommandCenter() {
  const data = useDashboardStore((s) => s.data);
  const mediosHealth = useDashboardStore((s) => s.mediosHealth);
  const setActiveView = useDashboardStore((s) => s.setActiveView);

  // System metrics state
  const [sysMetrics, setSysMetrics] = useState<SystemMetrics | null>(null);

  // Alertas comerciales state
  const [alertasCom, setAlertasCom] = useState<AlertasComercialesData | null>(null);

  // Entregas hoy state
  const [entregasHoy, setEntregasHoy] = useState<EntregasHoyData | null>(null);
  const [showEntregasDetail, setShowEntregasDetail] = useState(false);

  // AI Health state
  const [aiHealth, setAiHealth] = useState<AiHealthData | null>(null);

  // Pipeline Monitor state (matches /api/jobs/stats response shape)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [pipelineData, setPipelineData] = useState<any>(null);

  // Marco Conceptual state
  const [mcResumen, setMcResumen] = useState<{
    inicializado: boolean;
    version: number | null;
    vacios: string[];
  } | null>(null);

  // Fetch functions estables
  const fetchSystemMetrics = useCallback(async () => {
    try {
      const res = await fetchWithTimeout('/api/dashboard/system', { timeoutMs: 12_000 });
      if (res.ok) setSysMetrics(await res.json());
    } catch { /* silent */ }
  }, []);

  const fetchAlertasComerciales = useCallback(async () => {
    try {
      const res = await fetchWithTimeout('/api/dashboard/alertas-comerciales', { timeoutMs: 12_000 });
      if (res.ok) setAlertasCom(await res.json());
    } catch { /* silent */ }
  }, []);

  const fetchEntregasHoy = useCallback(async () => {
    try {
      const res = await fetchWithTimeout('/api/dashboard/entregas-hoy', { timeoutMs: 12_000 });
      if (res.ok) setEntregasHoy(await res.json());
    } catch { /* silent */ }
  }, []);

  const fetchAiHealth = useCallback(async () => {
    try {
      const res = await fetchWithTimeout('/api/dashboard/ai-health', { timeoutMs: 12_000 });
      if (res.ok) setAiHealth(await res.json());
    } catch { /* silent */ }
  }, []);

  const fetchPipelineStats = useCallback(async () => {
    try {
      const res = await fetchWithTimeout('/api/jobs/stats', { timeoutMs: 12_000 });
      if (res.ok) setPipelineData(await res.json());
    } catch { /* silent */ }
  }, []);

  const fetchMC = useCallback(async () => {
    try {
      const res = await fetchWithTimeout('/api/marco-conceptual/resumen', { timeoutMs: 12_000 });
      if (res.ok) setMcResumen(await res.json());
    } catch { /* silent */ }
  }, []);

  // Polling con debounce onFocus — intervalo minimo 30s
  usePolling(fetchSystemMetrics, 30_000);
  usePolling(fetchAlertasComerciales, 30_000);
  usePolling(fetchEntregasHoy, 30_000);
  usePolling(fetchAiHealth, 30_000);
  usePolling(fetchPipelineStats, 15_000);
  usePolling(fetchMC, 60_000);

  // ─── Computed values ────────────────────────────────────

  const totalCapturasHoy = useMemo(() => {
    if (!data?.fuentesPorNivel) return 0;
    return data.fuentesPorNivel.reduce((sum, f) => sum + f.capturasHoy, 0);
  }, [data?.fuentesPorNivel]);

  const uptimeHours = useMemo(
    () => (sysMetrics?.uptime || 0) / 3600,
    [sysMetrics?.uptime]
  );

  const saludPercent = useMemo(
    () => mediosHealth?.resumen.porcentajeSalud || 0,
    [mediosHealth?.resumen.porcentajeSalud]
  );

  const productsOperativo = useMemo(
    () => ALL_PRODUCTS.filter((p) => p.estado === 'operativo'),
    []
  );

  const productsByCategory = useMemo(() => {
    const cats: Record<string, number> = {};
    ALL_PRODUCTS.forEach((p) => {
      const cat = (p as unknown as Record<string, unknown>).categoria as string || 'otro';
      cats[cat] = (cats[cat] || 0) + 1;
    });
    return cats;
  }, []);

  const topPartido = useMemo(() => {
    if (!data?.mencionesPorPartido?.length) return null;
    return data.mencionesPorPartido[0];
  }, [data?.mencionesPorPartido]);

  // Menciones trend: hoy vs promedio semanal
  const mencionesTrend = useMemo(() => {
    const hoy = data?.mencionesHoy || 0;
    const semana = data?.mencionesSemana || 0;
    const promedio = semana / 7;
    if (promedio === 0) return hoy > 0 ? 100 : 0;
    return Math.round(((hoy - promedio) / promedio) * 100);
  }, [data?.mencionesHoy, data?.mencionesSemana]);

  // Medios con problema
  const mediosConProblema = useMemo(
    () => mediosHealth?.medios.filter((m) => m.salud !== 'sano') || [],
    [mediosHealth]
  );

  // ─── Health border color for Monitoreo card ─────────────
  const monitoreoBorder = useMemo(() => {
    if (!mediosHealth) return '';
    if (mediosHealth.resumen.muertos > 0) return 'border-l-4 border-l-red-500';
    if (mediosHealth.resumen.degradados > 0) return 'border-l-4 border-l-amber-500';
    return 'border-l-4 border-l-emerald-500';
  }, [mediosHealth]);

  // ─── Health diagnostics ────────────────────────────────
  const healthScore = sysMetrics?.healthScore ?? null;
  const diagnoses = sysMetrics?.diagnoses ?? [];
  const criticals = diagnoses.filter(d => d.severity === 'critical');
  const warnings = diagnoses.filter(d => d.severity === 'warning');
  // Warnings triviales (informativos, no penalizan score)
  const nonTrivialWarnings = warnings.filter(d => d.id !== 'dev-overhead' && d.id !== 'auth');

  // Motivo del score (texto para mostrar junto al numero)
  const scoreReason = useMemo(() => {
    if (criticals.length > 0) {
      return `${criticals.length} critico${criticals.length > 1 ? 's' : ''}: ${criticals.map(d => d.message).join(', ')}`;
    }
    if (nonTrivialWarnings.length > 0) {
      return `${nonTrivialWarnings.length} advertencia${nonTrivialWarnings.length > 1 ? 's' : ''}: ${nonTrivialWarnings.map(d => d.message).join(', ')}`;
    }
    return '';
  }, [criticals, nonTrivialWarnings]);

  // ─── StatusLevel derived from sysMetrics ───────────────
  const systemLevel: StatusLevel = useMemo(() => {
    if (criticals.length > 0) return 'critical';
    if (warnings.length > 0) return 'warning';
    return 'ok';
  }, [criticals, warnings]);

  const memoryLevel: StatusLevel = useMemo(() => {
    if (!sysMetrics?.memoryUsage) return 'ok';
    const heapPct = (sysMetrics.memoryUsage.heapUsed / Math.max(1, sysMetrics.memoryUsage.heapLimit)) * 100;
    if (heapPct > 85) return 'critical';
    if (heapPct > 60) return 'warning';
    return 'ok';
  }, [sysMetrics?.memoryUsage]);

  const uptimeLevel: StatusLevel = useMemo(() => {
    if (!sysMetrics?.uptime) return 'ok';
    if (sysMetrics.uptime < 300) return 'critical';
    if (sysMetrics.uptime < 600) return 'warning';
    return 'ok';
  }, [sysMetrics?.uptime]);

  const dbLevel: StatusLevel = useMemo(() => {
    if (!sysMetrics?.dbSize) return 'ok';
    return sysMetrics.dbSize > 500 ? 'warning' : 'ok';
  }, [sysMetrics?.dbSize]);

  const entregasLevel: StatusLevel = useMemo(() => {
    if (!entregasHoy) return 'ok';
    if (entregasHoy.fallidas > 0) return 'critical';
    if (entregasHoy.pendientes > 0) return 'warning';
    return 'ok';
  }, [entregasHoy]);

  // AI diagnostic message (for diagnostics panel)
  const aiDiagnostic = useMemo(() => {
    if (!aiHealth) return null;
    if (aiHealth.statusLevel === 'critical') {
      return { severity: 'critical' as const, message: 'IA sin actividad en 6 horas. Verificar scheduler y jobs.', action: 'Revisar /api/jobs y scheduler' };
    }
    if (aiHealth.statusLevel === 'warning') {
      return { severity: 'warning' as const, message: `${aiHealth.jobsFallidosHoy} jobs de IA fallieron hoy. Revisar logs.`, action: 'Ejecutar check manual' };
    }
    return null;
  }, [aiHealth]);

  // Colores del score (kept for section 4 compatibility)
  const healthColor = useMemo(() => {
    if (healthScore === null) return 'text-muted-foreground';
    if (healthScore >= 90) return 'text-emerald-500';
    if (healthScore >= 70) return 'text-amber-500';
    return 'text-red-500';
  }, [healthScore]);

  const healthBg = useMemo(() => {
    if (healthScore === null) return 'bg-muted';
    if (healthScore >= 90) return 'bg-emerald-500/10 border-emerald-500/30';
    if (healthScore >= 70) return 'bg-amber-500/10 border-amber-500/30';
    return 'bg-red-500/10 border-red-500/30';
  }, [healthScore]);

  // StatusOrb display values
  const memoryPct = useMemo(() => {
    if (!sysMetrics?.memoryUsage) return '--';
    return `${Math.round((sysMetrics.memoryUsage.heapUsed / Math.max(1, sysMetrics.memoryUsage.heapLimit)) * 100)}%`;
  }, [sysMetrics?.memoryUsage]);

  const dbSizeStr = useMemo(() => {
    return sysMetrics?.dbSize ? `${sysMetrics.dbSize} MB` : '--';
  }, [sysMetrics?.dbSize]);

  const uptimeStr = useMemo(() => {
    return sysMetrics?.uptimeFormatted || '--';
  }, [sysMetrics?.uptimeFormatted]);

  // ═══════════════════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════════════════

  if (!data) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <div className="animate-pulse flex flex-col items-center gap-3">
          <BarChart3 className="h-8 w-8 opacity-40" />
          <span className="text-sm">Cargando Centro de Comando...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ═══ Section 1: Diagnostico del Sistema + StatusOrbs ═══ */}
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 gap-3 sm:gap-4"
      >
        {/* FILA 1: StatusOrbs + Diagnosticos activos */}
        <motion.div custom={0} variants={fadeInUp}>
          <Card className="border">
            <CardContent className="p-4">
              <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                {/* Panel izquierdo: 5 StatusOrbs en fila */}
                <div className="flex-1">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-3">Estado del Sistema</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:flex lg:items-center lg:justify-between gap-3 lg:gap-2">
                    <StatusOrb
                      level={systemLevel}
                      icon={<Activity className="h-3.5 w-3.5" />}
                      label="Sistema"
                      value={healthScore !== null ? `${healthScore}%` : '--'}
                      size="md"
                      horizontal={true}
                      onClick={() => setActiveView('jobs')}
                    />
                    {scoreReason && (
                      <span className="text-[8px] text-muted-foreground max-w-[120px] truncate hidden lg:inline-block lg:col-span-1" title={scoreReason}>
                        {scoreReason}
                      </span>
                    )}
                    <StatusOrb
                      level={memoryLevel}
                      icon={<Cpu className="h-3.5 w-3.5" />}
                      label="Memoria"
                      value={memoryPct}
                      size="md"
                      horizontal={true}
                      onClick={() => setActiveView('jobs')}
                    />
                    <StatusOrb
                      level={dbLevel}
                      icon={<Database className="h-3.5 w-3.5" />}
                      label="DB"
                      value={dbSizeStr}
                      size="md"
                      horizontal={true}
                      onClick={() => setActiveView('captura')}
                    />
                    <StatusOrb
                      level={uptimeLevel}
                      icon={<Clock className="h-3.5 w-3.5" />}
                      label="Uptime"
                      value={uptimeStr}
                      size="md"
                      horizontal={true}
                      onClick={() => setActiveView('jobs')}
                    />
                    <StatusOrb
                      level={entregasLevel}
                      icon={<Send className="h-3.5 w-3.5" />}
                      label="Entregas"
                      value={entregasHoy ? `${entregasHoy.enviadas}/${entregasHoy.total}` : '--'}
                      size="md"
                      horizontal={true}
                      onClick={() => setActiveView('boletines')}
                    />
                    <StatusOrb
                      level={aiHealth?.statusLevel || 'ok'}
                      icon={<Sparkles className="h-3.5 w-3.5" />}
                      label="IA"
                      value={aiHealth ? `${aiHealth.llamadasLLMHoy}` : '--'}
                      detail={`$${(aiHealth?.costoEstimadoHoy ?? 0).toFixed(2)}`}
                      size="sm"
                      horizontal={true}
                      onClick={() => setActiveView('generadores')}
                    />
                    {/* Indicador Marco Conceptual */}
                    {mcResumen && (
                      <div className="flex items-center gap-1.5">
                        {mcResumen.inicializado ? (
                          <>
                            <span className="text-[9px] font-medium text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
                              MC v{mcResumen.version}
                            </span>
                            {mcResumen.vacios && mcResumen.vacios.length > 0 && (
                              <span className="text-[9px] text-amber-500" title={`Directrices vacías: ${mcResumen.vacios.join(', ')}`}>
                                <AlertTriangle className="h-3 w-3" />
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-[9px] font-medium text-red-500 bg-red-50 dark:bg-red-950/30 px-1.5 py-0.5 rounded">
                            MC no configurado
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Separador vertical */}
                <div className="hidden lg:block w-px h-10 bg-border/50 self-center" />

                {/* Panel derecho: Diagnosticos activos */}
                <div className="lg:w-72 shrink-0">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-3">Diagnosticos</p>
                  <div className="space-y-1.5">
                    {criticals.length > 0 && criticals.map(d => (
                      <div key={d.id} className="flex items-start gap-2">
                        <XCircle className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-[11px] font-medium text-red-600 dark:text-red-400">{d.message}</p>
                          {d.action && <p className="text-[9px] text-muted-foreground mt-0.5">{d.action}</p>}
                        </div>
                      </div>
                    ))}
                    {warnings.length > 0 && warnings.map(d => (
                      <div key={d.id} className="flex items-start gap-2">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-[11px] font-medium text-amber-600 dark:text-amber-400">{d.message}</p>
                          {d.action && <p className="text-[9px] text-amber-700/70 dark:text-amber-400/70 mt-0.5">{d.action}</p>}
                        </div>
                      </div>
                    ))}
                    {aiDiagnostic && aiDiagnostic.severity === 'critical' && (
                      <div key="ai-critical" className="flex items-start gap-2">
                        <XCircle className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-[11px] font-medium text-red-600 dark:text-red-400">{aiDiagnostic.message}</p>
                          {aiDiagnostic.action && <p className="text-[9px] text-muted-foreground mt-0.5">{aiDiagnostic.action}</p>}
                        </div>
                      </div>
                    )}
                    {aiDiagnostic && aiDiagnostic.severity === 'warning' && (
                      <div key="ai-warning" className="flex items-start gap-2">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-[11px] font-medium text-amber-600 dark:text-amber-400">{aiDiagnostic.message}</p>
                          {aiDiagnostic.action && <p className="text-[9px] text-amber-700/70 dark:text-amber-400/70 mt-0.5">{aiDiagnostic.action}</p>}
                        </div>
                      </div>
                    )}
                    {criticals.length === 0 && warnings.length === 0 && !aiDiagnostic && (
                      <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="h-4 w-4" />
                        <span className="text-xs font-medium">Todo normal</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* FILA 2: Entregas Hoy */}
        <motion.div custom={1} variants={fadeInUp}>
          <Card className="border">
            <CardContent className="p-4 space-y-3">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Send className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold text-foreground">Entregas Hoy</span>
                  {entregasHoy && entregasHoy.fallidas > 0 && (
                    <AlertOctagon className="h-3.5 w-3.5 text-red-500" />
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-[10px] gap-1 h-6 px-2"
                  onClick={() => setShowEntregasDetail(prev => !prev)}
                >
                  {showEntregasDetail ? 'Ocultar' : 'Ver mas'}
                  {showEntregasDetail
                    ? <ChevronUp className="h-3 w-3" />
                    : <ChevronDown className="h-3 w-3" />
                  }
                </Button>
              </div>

              {/* 4 contadores en fila */}
              <div className="grid grid-cols-4 gap-3">
                <div className="flex flex-col items-center py-2 rounded-lg bg-muted/40 border border-border/50">
                  <span className="text-lg font-bold text-foreground">{entregasHoy?.total ?? '--'}</span>
                  <span className="text-[9px] text-muted-foreground">Total</span>
                </div>
                <div className="flex flex-col items-center py-2 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                  <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{entregasHoy?.enviadas ?? '--'}</span>
                  <span className="text-[9px] text-muted-foreground">Enviadas</span>
                </div>
                <div className="flex flex-col items-center py-2 rounded-lg bg-amber-500/5 border border-amber-500/20">
                  <span className="text-lg font-bold text-amber-600 dark:text-amber-400">{entregasHoy?.pendientes ?? '--'}</span>
                  <span className="text-[9px] text-muted-foreground">En proceso</span>
                </div>
                <div className="flex flex-col items-center py-2 rounded-lg bg-red-500/5 border border-red-500/20">
                  <span className="text-lg font-bold text-red-600 dark:text-red-400">{entregasHoy?.fallidas ?? '--'}</span>
                  <span className="text-[9px] text-muted-foreground">Fallidas</span>
                </div>
              </div>

              {/* Alarma por rechazos con diagnostico */}
              {entregasHoy && entregasHoy.fallidas > 0 && entregasHoy.fallidasConDiagnostico.length > 0 && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <AlertOctagon className="h-4 w-4 text-red-500" />
                    <span className="text-xs font-semibold text-red-600 dark:text-red-400">
                      {entregasHoy.fallidas} entrega{entregasHoy.fallidas > 1 ? 's' : ''} fallida{entregasHoy.fallidas > 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {entregasHoy.fallidasConDiagnostico.slice(0, 3).map((f) => (
                      <div key={f.id} className="bg-background/50 rounded-md p-2 border border-red-500/10">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-medium text-foreground truncate">
                            {f.clienteNombre} — {f.tipoBoletin.replace(/_/g, ' ')}
                          </span>
                          <StatusPill level="critical" label={f.canal} compact />
                        </div>
                        <p className="text-[9px] text-red-600 dark:text-red-400 font-medium">{f.diagnostico.causa}</p>
                        <p className="text-[9px] text-muted-foreground mt-0.5">{f.diagnostico.accion}</p>
                      </div>
                    ))}
                    {entregasHoy.fallidasConDiagnostico.length > 3 && (
                      <p className="text-[9px] text-muted-foreground text-center">
                        +{entregasHoy.fallidasConDiagnostico.length - 3} fallida{entregasHoy.fallidasConDiagnostico.length - 3 > 1 ? 's' : ''} mas
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Expandible: detalle por tipo + en proceso */}
              {showEntregasDetail && entregasHoy && (
                <div className="space-y-3 border-t border-border/50 pt-3">
                  {/* Por tipo de boletin */}
                  {Object.keys(entregasHoy.porTipo).length > 0 && (
                    <div>
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Por tipo de boletin</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {Object.entries(entregasHoy.porTipo).map(([tipo, counts]) => (
                          <div key={tipo} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-muted/30 border border-border/30">
                            <div className="min-w-0">
                              <p className="text-[11px] font-medium text-foreground truncate">{tipo.replace(/_/g, ' ')}</p>
                              <p className="text-[9px] text-muted-foreground">{counts.total} total</p>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {counts.fallidas > 0 && <StatusPill level="critical" label={`${counts.fallidas} fall.`} compact />}
                              {counts.pendientes > 0 && <StatusPill level="warning" label={`${counts.pendientes} pend.`} compact />}
                              {counts.enviadas > 0 && <StatusPill level="ok" label={`${counts.enviadas} env.`} compact />}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* En proceso */}
                  {entregasHoy.enProceso.length > 0 && (
                    <div>
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
                        En proceso ({entregasHoy.enProceso.length})
                      </p>
                      <div className="space-y-1.5">
                        {entregasHoy.enProceso.map((ep) => (
                          <div key={ep.id} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-muted/20 border border-border/20">
                            <div className="min-w-0">
                              <p className="text-[11px] font-medium text-foreground truncate">{ep.clienteNombre}</p>
                              <p className="text-[9px] text-muted-foreground">
                                {ep.tipoBoletin.replace(/_/g, ' ')} · {ep.canal}
                                {ep.fechaProgramada && (
                                  <span className="ml-1">
                                    · <Timer className="h-2.5 w-2.5 inline" />{' '}
                                    {new Date(ep.fechaProgramada).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                )}
                              </p>
                            </div>
                            <StatusPill level="warning" label="pendiente" compact icon={<Clock className="h-2.5 w-2.5" />} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {Object.keys(entregasHoy.porTipo).length === 0 && entregasHoy.enProceso.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-3">
                      Sin entregas registradas hoy
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* FILA 3: Monitor de Pipeline */}
        <motion.div custom={2} variants={fadeInUp}>
          <PipelineMonitor
            data={pipelineData}
            onRefresh={fetchPipelineStats}
          />
        </motion.div>
      </motion.div>

      {/* ═══ Section 2: Category Cards ═══ */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">

        {/* 1. Analisis */}
        <CategoryCard
          index={0}
          icon={<Newspaper className="h-5 w-5" />}
          title="Analisis"
          viewId="menciones"
          onClick={() => setActiveView('menciones')}
          kpis={[
            { value: data.totalPersonas, label: 'Legisladores' },
            { value: data.mencionesHoy, label: 'Hoy', color: 'text-sky-600 dark:text-sky-400' },
            { value: data.mencionesSemana, label: 'Semana' },
          ]}
          featured={
            data.topActores?.[0] ? (
              <div className="flex items-start gap-2">
                <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="font-medium text-foreground truncate">{data.topActores[0].nombre}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {data.topActores[0].partidoSigla} · {data.topActores[0].mencionesCount} menciones
                  </p>
                </div>
              </div>
            ) : (
              <span className="text-muted-foreground text-[10px]">Sin datos de actores</span>
            )
          }
          variation={
            <TrendIndicator value={mencionesTrend} label="vs. promedio diario" />
          }
        />

        {/* 2. Monitoreo */}
        <CategoryCard
          index={1}
          icon={<Radio className="h-5 w-5" />}
          title="Monitoreo"
          viewId="captura"
          onClick={() => setActiveView('captura')}
          kpis={[
            { value: data.totalMedios, label: 'Fuentes' },
            { value: `${Math.round(saludPercent)}%`, label: 'Salud', color: saludPercent >= 80 ? 'text-emerald-600 dark:text-emerald-400' : saludPercent >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400' },
            { value: totalCapturasHoy, label: 'Capturas' },
          ]}
          featured={
            mediosConProblema.length > 0 ? (
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="font-medium text-amber-700 dark:text-amber-400 truncate">
                    {mediosConProblema[0]?.nombre}
                    {mediosConProblema.length > 1 && ` +${mediosConProblema.length - 1}`}
                  </p>
                  <p className="text-[10px] text-muted-foreground">con problemas de captura</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                <span className="text-emerald-700 dark:text-emerald-400 text-[10px] font-medium">Todos sanos</span>
              </div>
            )
          }
          variation={
            <div className="flex items-center gap-2">
              <MiniGauge value={saludPercent} label="Salud" size={36} />
              <span className="text-[10px] text-muted-foreground">{mediosHealth?.resumen.sanos || 0} sanos · {mediosHealth?.resumen.muertos || 0} caidos</span>
            </div>
          }
          borderColor={monitoreoBorder}
        />

        {/* 3. Alertas */}
        <CategoryCard
          index={2}
          icon={<Bell className="h-5 w-5" />}
          title="Alertas"
          viewId="alertas"
          onClick={() => setActiveView('alertas')}
          kpis={[
            { value: data.alertas.negativasHoy, label: 'Rojas', color: 'text-red-600 dark:text-red-400' },
            { value: data.alertas.positivasHoy, label: 'Verdes', color: 'text-emerald-600 dark:text-emerald-400' },
            { value: data.alertas.neutrasHoy, label: 'Neutras' },
          ]}
          featured={
            data.alertas.ultimaAlerta ? (
              <div className="flex items-start gap-2">
                <Zap className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-foreground truncate">{data.alertas.ultimaAlerta.resumen}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(data.alertas.ultimaAlerta.fechaCreacion).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ) : (
              <span className="text-muted-foreground text-[10px]">Sin alertas registradas</span>
            )
          }
          variation={
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              {data.alertas.negativasHoy + data.alertas.positivasHoy + data.alertas.neutrasHoy > 0 ? (
                <>
                  <span className="font-medium text-foreground">{data.alertas.negativasHoy + data.alertas.positivasHoy + data.alertas.neutrasHoy}</span>
                  <span>alertas procesadas hoy</span>
                </>
              ) : (
                <span>Sin actividad de alertas</span>
              )}
            </div>
          }
        />

        {/* 4. Comercial */}
        <CategoryCard
          index={3}
          icon={<UserCircle className="h-5 w-5" />}
          title="Comercial"
          viewId="clientes"
          onClick={() => setActiveView('clientes')}
          kpis={[
            { value: data.clientesActivos, label: 'Clientes' },
            { value: data.contratosVigentes, label: 'Contratos' },
            { value: data.entregasHoy, label: 'Entregas', color: 'text-emerald-600 dark:text-emerald-400' },
          ]}
          featured={
            data.entregasHoy > 0 ? (
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                <span className="text-foreground">{data.entregasHoy} entregas procesadas hoy</span>
              </div>
            ) : (
              <span className="text-muted-foreground text-[10px]">Sin entregas procesadas hoy</span>
            )
          }
          variation={
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <span>{data.totalReportes} reportes generados</span>
            </div>
          }
        />

        {/* 5. Productos */}
        <CategoryCard
          index={4}
          icon={<Package className="h-5 w-5" />}
          title="Productos"
          viewId="productos"
          onClick={() => setActiveView('productos')}
          kpis={[
            { value: productsOperativo.length, label: 'Operativos', color: 'text-emerald-600 dark:text-emerald-400' },
            { value: ALL_PRODUCTS.length, label: 'Total' },
            { value: data.totalReportes, label: 'Reportes' },
          ]}
          featured={
            <div className="space-y-1">
              {ALL_PRODUCTS.slice(0, 3).map((prod) => {
                const ProdIcon = prod.icon;
                return (
                  <div key={prod.tipo} className="flex items-center gap-1.5">
                    <ProdIcon className="h-3 w-3 shrink-0" style={{ color: prod.color }} />
                    <span className="text-foreground text-[11px]">{prod.nombre}</span>
                    <Badge variant="secondary" className="text-[8px] px-1 py-0 ml-auto">
                      {prod.estado === 'operativo' ? 'Op.' : 'Def.'}
                    </Badge>
                  </div>
                );
              })}
            </div>
          }
          variation={
            <div className="flex items-center gap-2 flex-wrap">
              {Object.entries(productsByCategory).map(([cat, count]) => (
                <span key={cat} className="text-[10px] text-muted-foreground">
                  {cat}: <span className="font-medium text-foreground">{count}</span>
                </span>
              ))}
            </div>
          }
        />

        {/* 6. Indicadores */}
        <CategoryCard
          index={5}
          icon={<TrendingUp className="h-5 w-5" />}
          title="Indicadores"
          viewId="indicadores"
          onClick={() => setActiveView('indicadores')}
          kpis={[
            { value: data.totalEjes, label: 'Ejes' },
            { value: data.totalComentarios, label: 'Comentarios' },
            { value: data.enlacesRotos, label: 'Rotos', color: data.enlacesRotos > 0 ? 'text-red-600 dark:text-red-400' : undefined },
          ]}
          featured={
            topPartido ? (
              <div className="flex items-start gap-2">
                <BarChart3 className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{topPartido.partido}</p>
                  <p className="text-[10px] text-muted-foreground">{topPartido.count} menciones · partido lider</p>
                </div>
              </div>
            ) : (
              <span className="text-muted-foreground text-[10px]">Sin datos de partidos</span>
            )
          }
          variation={
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <span>Diputados: <span className="font-medium text-foreground">{data.distribucionCamara.diputados}</span></span>
              <span className="text-border">|</span>
              <span>Senadores: <span className="font-medium text-foreground">{data.distribucionCamara.senadores}</span></span>
            </div>
          }
        />
      </div>

      {/* ═══ Section 3: Activity Feed ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Ultimas menciones */}
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
          custom={6}
        >
          <Card className="hover:shadow-md transition-all cursor-pointer" onClick={() => setActiveView('menciones')}>
            <CardHeader className="pb-2 pt-3 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Newspaper className="h-4 w-4 text-muted-foreground" />
                  Ultimas menciones
                </CardTitle>
                <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                  Ver todas <ChevronRight className="h-3 w-3" />
                </span>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              {data.ultimasMenciones?.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="text-[10px] h-7">Legislador</TableHead>
                        <TableHead className="text-[10px] h-7 hidden sm:table-cell">Medio</TableHead>
                        <TableHead className="text-[10px] h-7">Tipo</TableHead>
                        <TableHead className="text-[10px] h-7 hidden md:table-cell">Sent.</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.ultimasMenciones.slice(0, 5).map((m) => (
                        <TableRow key={m.id} className="hover:bg-muted/50">
                          <TableCell className="py-1.5 px-2">
                            <div className="min-w-0">
                              <p className="text-[11px] font-medium text-foreground truncate max-w-[100px]">{m.persona?.nombre || '—'}</p>
                              <p className="text-[9px] text-muted-foreground">{m.persona?.partidoSigla}</p>
                            </div>
                          </TableCell>
                          <TableCell className="py-1.5 px-2 hidden sm:table-cell">
                            <span className="text-[10px] text-muted-foreground truncate max-w-[80px] block">{m.medio?.nombre || '—'}</span>
                          </TableCell>
                          <TableCell className="py-1.5 px-2">
                            <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                              {TIPO_MENCION_LABELS[m.tipoMencion] || m.tipoMencion}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-1.5 px-2 hidden md:table-cell">
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${SENTIMIENTO_STYLES[m.sentimiento] || SENTIMIENTO_STYLES.no_clasificado}`}>
                              {m.sentimiento?.replace('_', ' ') || '—'}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="py-6 text-center text-muted-foreground text-xs">
                  Sin menciones registradas
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Estado de fuentes */}
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
          custom={7}
        >
          <Card className="hover:shadow-md transition-all cursor-pointer" onClick={() => setActiveView('captura')}>
            <CardHeader className="pb-2 pt-3 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Monitor className="h-4 w-4 text-muted-foreground" />
                  Estado de fuentes
                </CardTitle>
                <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                  Salud general <ChevronRight className="h-3 w-3" />
                </span>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              {mediosHealth ? (
                <div className="space-y-3">
                  {/* Summary bar */}
                  <div className="flex items-center gap-3">
                    <MiniGauge value={saludPercent} label="Salud" size={44} />
                    <div className="flex-1 grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{mediosHealth.resumen.sanos}</p>
                        <p className="text-[9px] text-muted-foreground">Sanos</p>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-amber-600 dark:text-amber-400">{mediosHealth.resumen.degradados}</p>
                        <p className="text-[9px] text-muted-foreground">Degradados</p>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-red-600 dark:text-red-400">{mediosHealth.resumen.muertos}</p>
                        <p className="text-[9px] text-muted-foreground">Caidos</p>
                      </div>
                    </div>
                  </div>

                  {/* Per-level breakdown */}
                  <div className="grid grid-cols-3 gap-2">
                    {mediosHealth.porNivel.map((nivel) => (
                      <div key={nivel.nivel} className="p-2 rounded-lg border border-border/50 bg-muted/30 text-center">
                        <p className="text-[10px] font-medium text-foreground">{nivel.label}</p>
                        <p className="text-xs font-bold text-foreground">{nivel.sanos}/{nivel.total}</p>
                        {nivel.problematicos > 0 && (
                          <p className="text-[9px] text-amber-500">{nivel.problematicos} prob.</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center text-muted-foreground text-xs">
                  <div className="animate-pulse">Cargando estado de fuentes...</div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ═══ Section 4: Top Variaciones + Alarmas Comerciales ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top 5 con mayor variacion */}
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
          custom={8}
        >
          {alertasCom ? (
            <TopVariations
              data={alertasCom.topVariaciones}
              onNavigate={setActiveView}
            />
          ) : (
            <Card className="hover:shadow-md transition-all">
              <CardContent className="py-10 text-center">
                <div className="animate-pulse flex flex-col items-center gap-2 text-muted-foreground">
                  <TrendingUp className="h-5 w-5 opacity-40" />
                  <span className="text-xs">Calculando variaciones...</span>
                </div>
              </CardContent>
            </Card>
          )}
        </motion.div>

        {/* Alarmas comerciales */}
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
          custom={9}
        >
          {alertasCom ? (
            <AlarmasComerciales
              contratosPorVencer={alertasCom.contratosPorVencer}
              solicitudesPendientes={alertasCom.solicitudesPendientes}
              entregasPendientes={alertasCom.entregasPendientes}
              onNavigate={setActiveView}
            />
          ) : (
            <Card className="hover:shadow-md transition-all">
              <CardContent className="py-10 text-center">
                <div className="animate-pulse flex flex-col items-center gap-2 text-muted-foreground">
                  <ShieldAlert className="h-5 w-5 opacity-40" />
                  <span className="text-xs">Cargando alarmas comerciales...</span>
                </div>
              </CardContent>
            </Card>
          )}
        </motion.div>
      </div>

      {/* ═══ Section 5: Quick Actions ═══ */}
      <motion.div
        variants={fadeInUp}
        initial="hidden"
        animate="visible"
        custom={10}
      >
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">Acciones rapidas</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                className="text-xs gap-1.5"
                onClick={() => setActiveView('menciones')}
              >
                <Eye className="h-3.5 w-3.5" />
                Ver Menciones
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs gap-1.5"
                onClick={() => setActiveView('alertas')}
              >
                <Bell className="h-3.5 w-3.5" />
                Ver Alertas
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs gap-1.5"
                onClick={() => setActiveView('captura')}
              >
                <Database className="h-3.5 w-3.5" />
                Captura Manual
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs gap-1.5"
                onClick={() => setActiveView('reportes')}
              >
                <FileBarChart className="h-3.5 w-3.5" />
                Generar Reporte
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs gap-1.5"
                onClick={() => setActiveView('clientes')}
              >
                <UserCircle className="h-3.5 w-3.5" />
                Contratos
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs gap-1.5"
                onClick={() => setActiveView('jobs')}
              >
                <Activity className="h-3.5 w-3.5" />
                Ver Jobs
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* System info footer */}
      {sysMetrics && (
        <div className="flex items-center justify-between text-[10px] text-muted-foreground/60 px-1 pb-2">
          <span>Node {sysMetrics.nodeVersion} · {sysMetrics.environment}</span>
          <span>Heap {sysMetrics.memoryUsage.heapUsed} MB · Contenedor {sysMetrics.memoryUsage.cgroupUsage}/{sysMetrics.memoryUsage.cgroupLimit} MB</span>
          <span>DB: {sysMetrics.dbSize} MB · {sysMetrics.uptimeFormatted}</span>
        </div>
      )}
    </div>
  );
}
