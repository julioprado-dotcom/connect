'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Activity, Play, Pause, RotateCcw, Trash2, AlertTriangle,
  RefreshCw, Clock, Cpu, Database, Zap, ChevronDown, ChevronUp,
  CheckCircle2, XCircle, Timer, Loader2, CircleDot, Wrench,
  ArrowRight, MoreHorizontal, Layers, Gauge, Radio,
} from 'lucide-react';
import { fetchWithTimeout } from '@/lib/fetch-utils';
import type { QueueStats, CheckFirstStats, FuentesStats } from '@/lib/jobs/types';
import type { StatusLevel } from './gauges/StatusOrb';

// ─── Types ────────────────────────────────────────────────

interface SchedulerStatus {
  running: boolean;
  totalTasks: number;
  tasks: Array<{
    expresion: string;
    humana: string;
  }>;
}

interface PipelineData {
  cola: QueueStats;
  worker: {
    running: boolean;
    uptime: string;
    jobsCompleted: number;
    jobsFailed: number;
    jobsPerHour: number;
    startTime: string | null;
    lastJobTime: string | null;
  };
  checkFirst: CheckFirstStats;
  fuentes: FuentesStats;
  scheduler: SchedulerStatus;
}

interface ActionFeedback {
  id: string;
  tipo: 'exito' | 'error' | 'info';
  mensaje: string;
  timestamp: number;
}

interface RecentJob {
  id: string;
  tipo: string;
  estado: string;
  fechaCreacion: string;
  fechaFin: string | null;
  error: string | null;
  intentos: number;
}

// ─── Helpers ──────────────────────────────────────────────

const JOB_TYPE_LABELS: Record<string, string> = {
  check_fuente: 'Check Fuente',
  check_indicador: 'Check Indicador',
  scrape_fuente: 'Scrape Fuente',
  capture_indicador: 'Captura Indicador',
  generar_boletin: 'Generar Boletin',
  enviar_entrega: 'Enviar Entrega',
  verificar_enlaces: 'Verificar Enlaces',
  mantenimiento: 'Mantenimiento',
};

const JOB_TYPE_COLORS: Record<string, string> = {
  check_fuente: 'text-sky-600 dark:text-sky-400',
  check_indicador: 'text-violet-600 dark:text-violet-400',
  scrape_fuente: 'text-amber-600 dark:text-amber-400',
  capture_indicador: 'text-indigo-600 dark:text-indigo-400',
  generar_boletin: 'text-emerald-600 dark:text-emerald-400',
  enviar_entrega: 'text-teal-600 dark:text-teal-400',
  verificar_enlaces: 'text-orange-600 dark:text-orange-400',
  mantenimiento: 'text-stone-500',
};

const ESTADO_BADGE: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; className: string }> = {
  pendiente: { variant: 'outline', className: 'border-amber-500/40 text-amber-700 dark:text-amber-400' },
  en_progreso: { variant: 'default', className: 'bg-sky-500/20 text-sky-700 dark:text-sky-300' },
  completado: { variant: 'secondary', className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' },
  fallido: { variant: 'destructive', className: 'bg-red-500/15 text-red-700 dark:text-red-400' },
  cancelado: { variant: 'secondary', className: 'text-muted-foreground' },
};

function timeAgo(date: string | null): string {
  if (!date) return '--';
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'ahora';
  if (mins < 60) return `hace ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours}h`;
  return `hace ${Math.floor(hours / 24)}d`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

// ─── Sub-components ───────────────────────────────────────

function MetricBox({
  icon,
  label,
  value,
  subValue,
  color,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subValue?: string;
  color?: string;
  onClick?: () => void;
}) {
  return (
    <div
      className={`flex flex-col items-center gap-0.5 py-2 px-3 rounded-lg bg-muted/40 border border-border/50 min-w-0 ${onClick ? 'cursor-pointer hover:bg-muted/70 transition-colors' : ''}`}
      onClick={onClick}
    >
      <div className="text-muted-foreground">{icon}</div>
      <span className={`text-base font-bold ${color || 'text-foreground'}`}>{value}</span>
      <span className="text-[9px] text-muted-foreground leading-tight text-center">{label}</span>
      {subValue && <span className="text-[8px] text-muted-foreground/70">{subValue}</span>}
    </div>
  );
}

function PulseDot({ active, color = 'bg-emerald-500' }: { active: boolean; color?: string }) {
  return (
    <span className={`relative flex h-2.5 w-2.5 ${active ? '' : 'opacity-30'}`}>
      {active && <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${color} opacity-75`} />}
      <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${active ? color : 'bg-muted-foreground/40'}`} />
    </span>
  );
}

function ActionButton({
  icon,
  label,
  color,
  loading,
  onClick,
  confirmLabel,
}: {
  icon: React.ReactNode;
  label: string;
  color?: string;
  loading?: boolean;
  onClick: () => void;
  confirmLabel?: string;
}) {
  const [confirming, setConfirming] = useState(false);

  const handleClick = () => {
    if (confirmLabel && !confirming) {
      setConfirming(true);
      setTimeout(() => setConfirming(false), 3000);
      return;
    }
    setConfirming(false);
    onClick();
  };

  return (
    <Button
      variant="outline"
      size="sm"
      className={`text-[10px] gap-1.5 h-7 px-2 ${color || ''} ${confirming ? 'border-red-500/50 bg-red-500/10' : ''}`}
      disabled={loading}
      onClick={handleClick}
    >
      {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : icon}
      <span>{confirming && confirmLabel ? confirmLabel : label}</span>
    </Button>
  );
}

// ─── Feedback Toast ───────────────────────────────────────

function FeedbackToast({ feedback, onDismiss }: { feedback: ActionFeedback; onDismiss: (id: string) => void }) {
  const colors = {
    exito: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
    error: 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-400',
    info: 'border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-400',
  };
  const icons = {
    exito: <CheckCircle2 className="h-3.5 w-3.5" />,
    error: <XCircle className="h-3.5 w-3.5" />,
    info: <AlertTriangle className="h-3.5 w-3.5" />,
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-[11px] ${colors[feedback.tipo]}`}
      onClick={() => onDismiss(feedback.id)}
    >
      {icons[feedback.tipo]}
      <span className="flex-1">{feedback.mensaje}</span>
      <span className="text-[9px] opacity-60">{timeAgo(new Date(feedback.timestamp).toISOString())}</span>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════
// Main Component: PipelineMonitor
// ═══════════════════════════════════════════════════════════

interface PipelineMonitorProps {
  /** Los datos del pipeline ya obtenidos por el padre (via polling) */
  data: PipelineData | null;
  /** Forzar refresh manual desde el padre */
  onRefresh: () => void;
}

export function PipelineMonitor({ data, onRefresh }: PipelineMonitorProps) {
  // UI State
  const [expanded, setExpanded] = useState(false);
  const [showRecent, setShowRecent] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [feedbacks, setFeedbacks] = useState<ActionFeedback[]>([]);
  const [recentJobs, setRecentJobs] = useState<RecentJob[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);

  // ─── Feedback management ──────────────────────────────
  const addFeedback = useCallback((tipo: ActionFeedback['tipo'], mensaje: string) => {
    const fb: ActionFeedback = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      tipo,
      mensaje,
      timestamp: Date.now(),
    };
    setFeedbacks(prev => [fb, ...prev].slice(0, 5));
    // Auto-dismiss after 8s
    setTimeout(() => {
      setFeedbacks(prev => prev.filter(f => f.id !== fb.id));
    }, 8000);
  }, []);

  const dismissFeedback = useCallback((id: string) => {
    setFeedbacks(prev => prev.filter(f => f.id !== id));
  }, []);

  // ─── Actions ──────────────────────────────────────────
  const executeAction = useCallback(async (
    actionId: string,
    url: string,
    body: Record<string, unknown>,
    successMsg: string,
  ) => {
    setActionLoading(actionId);
    try {
      const res = await fetchWithTimeout(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        timeoutMs: 15_000,
      });
      const data = await res.json();
      if (res.ok) {
        addFeedback('exito', data.mensaje || successMsg);
        // Refresh data after action
        setTimeout(onRefresh, 500);
      } else {
        addFeedback('error', data.error || `Error en ${actionId}`);
      }
    } catch (err) {
      addFeedback('error', `Error de conexion: ${err instanceof Error ? err.message : actionId}`);
    } finally {
      setActionLoading(null);
    }
  }, [addFeedback, onRefresh]);

  const toggleWorker = useCallback(() => {
    const isRunning = data?.worker?.running;
    executeAction(
      'worker',
      '/api/jobs/worker',
      { accion: isRunning ? 'pause' : 'resume' },
      isRunning ? 'Worker pausado' : 'Worker reanudado',
    );
  }, [data?.worker?.running, executeAction]);

  const recalcScheduler = useCallback(() => {
    executeAction('scheduler', '/api/jobs/scheduler', { accion: 'recalcular' }, 'Scheduler recalculado');
  }, [executeAction]);

  const purgeCompleted = useCallback(() => {
    executeAction('purge_c', '/api/jobs/maintenance', { accion: 'purge_completados', dias: 3 }, 'Completados limpiados');
  }, [executeAction]);

  const purgeFailed = useCallback(() => {
    executeAction('purge_f', '/api/jobs/maintenance', { accion: 'purge_fallidos', dias: 7 }, 'Fallidos limpiados');
  }, [executeAction]);

  const reclaimOrphans = useCallback(() => {
    executeAction('reclaim', '/api/jobs/maintenance', { accion: 'reclaim_huerfanos', timeoutMin: 10 }, 'Huerfanos recuperados');
  }, [executeAction]);

  // ─── Recent jobs ──────────────────────────────────────
  const fetchRecentJobs = useCallback(async () => {
    setLoadingJobs(true);
    try {
      const res = await fetchWithTimeout('/api/jobs?limit=10&estado=fallido', { timeoutMs: 10_000 });
      if (res.ok) {
        const json = await res.json();
        setRecentJobs(json.jobs || []);
      }
    } catch { /* silent */ }
    setLoadingJobs(false);
  }, []);

  const handleShowRecent = useCallback(() => {
    if (!showRecent) fetchRecentJobs();
    setShowRecent(prev => !prev);
  }, [showRecent, fetchRecentJobs]);

  // ─── Cancel job ───────────────────────────────────────
  const cancelJob = useCallback(async (jobId: string) => {
    try {
      const res = await fetchWithTimeout(`/api/jobs/${jobId}`, {
        method: 'DELETE',
        timeoutMs: 10_000,
      });
      if (res.ok) {
        addFeedback('exito', 'Job cancelado');
        fetchRecentJobs();
        setTimeout(onRefresh, 500);
      } else {
        const data = await res.json();
        addFeedback('error', data.error || 'No se pudo cancelar');
      }
    } catch {
      addFeedback('error', 'Error de conexion al cancelar');
    }
  }, [addFeedback, fetchRecentJobs, onRefresh]);

  // ─── Trigger manual job ───────────────────────────────
  const triggerJob = useCallback(async (tipo: string) => {
    executeAction(`trigger_${tipo}`, '/api/jobs', { tipo, prioridad: 7 }, `${JOB_TYPE_LABELS[tipo] || tipo} encolado`);
  }, [executeAction]);

  // ─── Computed: pipeline health level ──────────────────
  const pipelineLevel: StatusLevel = useMemo(() => {
    if (!data) return 'ok';
    if (data.cola.fallidos24h > 10) return 'critical';
    if (!data.worker.running) return 'warning';
    if (data.cola.fallidos24h > 3) return 'warning';
    if (data.cola.pendientes > 50) return 'warning';
    return 'ok';
  }, [data]);

  const levelColors: Record<StatusLevel, string> = {
    ok: 'border-l-emerald-500',
    warning: 'border-l-amber-500',
    danger: 'border-l-orange-500',
    critical: 'border-l-red-500',
  };

  // ═══════════════════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════════════════

  return (
    <Card className={`border-l-4 ${levelColors[pipelineLevel]} overflow-hidden`}>
      <CardContent className="p-4 space-y-3">

        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Monitor de Pipeline</span>
            <PulseDot active={data?.worker?.running ?? false} />
            <Badge
              variant="secondary"
              className={`text-[9px] px-1.5 py-0 ${
                pipelineLevel === 'critical' ? 'bg-red-500/15 text-red-600 dark:text-red-400' :
                pipelineLevel === 'warning' ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' :
                'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {data?.worker?.running ? 'Activo' : 'Pausado'}
            </Badge>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="text-[10px] gap-1 h-6 px-2"
              onClick={() => { onRefresh(); }}
            >
              <RefreshCw className="h-3 w-3" />
              Refresh
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-[10px] gap-1 h-6 px-2"
              onClick={() => setExpanded(prev => !prev)}
            >
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {expanded ? 'Menos' : 'Mas'}
            </Button>
          </div>
        </div>

        {/* ── Feedbacks (toasts) ── */}
        <AnimatePresence>
          {feedbacks.length > 0 && (
            <div className="space-y-1.5">
              {feedbacks.map(fb => (
                <FeedbackToast key={fb.id} feedback={fb} onDismiss={dismissFeedback} />
              ))}
            </div>
          )}
        </AnimatePresence>

        {/* ══ COMPACT VIEW (always visible) ══ */}
        {!expanded && data && (
          <div className="space-y-3">
            {/* Metrics row */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              <MetricBox
                icon={<Layers className="h-3.5 w-3.5" />}
                label="Pendientes"
                value={data.cola.pendientes}
                color={data.cola.pendientes > 50 ? 'text-amber-600 dark:text-amber-400' : undefined}
              />
              <MetricBox
                icon={<Loader2 className="h-3.5 w-3.5" />}
                label="En Progreso"
                value={data.cola.enProgreso}
              />
              <MetricBox
                icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                label="Completados 24h"
                value={data.cola.completados24h}
              />
              <MetricBox
                icon={<XCircle className="h-3.5 w-3.5" />}
                label="Fallidos 24h"
                value={data.cola.fallidos24h}
                color={data.cola.fallidos24h > 3 ? 'text-red-600 dark:text-red-400' : undefined}
              />
              <MetricBox
                icon={<Gauge className="h-3.5 w-3.5" />}
                label="Promedio"
                value={data.cola.tiempoPromedioMs > 0 ? formatDuration(data.cola.tiempoPromedioMs) : '--'}
                subValue="por job"
              />
              <MetricBox
                icon={<Timer className="h-3.5 w-3.5" />}
                label="Worker"
                value={data.worker.running ? `${data.worker.jobsPerHour}/h` : 'Pausado'}
                subValue={data.worker.lastJobTime ? timeAgo(data.worker.lastJobTime) : 'sin actividad'}
                color={data.worker.running ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}
                onClick={toggleWorker}
              />
            </div>

            {/* Quick actions row */}
            <div className="flex flex-wrap gap-1.5">
              <ActionButton
                icon={data.worker.running ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                label={data.worker.running ? 'Pausar Worker' : 'Reanudar Worker'}
                loading={actionLoading === 'worker'}
                onClick={toggleWorker}
              />
              <ActionButton
                icon={<RotateCcw className="h-3 w-3" />}
                label="Recalcular Scheduler"
                loading={actionLoading === 'scheduler'}
                onClick={recalcScheduler}
              />
              <ActionButton
                icon={<Trash2 className="h-3 w-3" />}
                label="Limpiar Completados"
                loading={actionLoading === 'purge_c'}
                onClick={purgeCompleted}
                confirmLabel="Confirmar limpieza?"
              />
              <ActionButton
                icon={<Trash2 className="h-3 w-3" />}
                label="Limpiar Fallidos"
                color="text-red-600 dark:text-red-400"
                loading={actionLoading === 'purge_f'}
                onClick={purgeFailed}
                confirmLabel="Confirmar?"
              />
              <ActionButton
                icon={<Wrench className="h-3 w-3" />}
                label="Recuperar Huerfanos"
                loading={actionLoading === 'reclaim'}
                onClick={reclaimOrphans}
              />
            </div>
          </div>
        )}

        {/* ══ EXPANDED VIEW ══ */}
        {expanded && data && (
          <div className="space-y-4">

            {/* ── 3-column metrics ── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">

              {/* Col 1: Queue */}
              <div className="space-y-2">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Cola de Trabajos</p>
                <div className="grid grid-cols-2 gap-2">
                  <MetricBox
                    icon={<Layers className="h-3.5 w-3.5" />}
                    label="Pendientes"
                    value={data.cola.pendientes}
                    color={data.cola.pendientes > 50 ? 'text-amber-600 dark:text-amber-400' : undefined}
                  />
                  <MetricBox
                    icon={<Loader2 className="h-3.5 w-3.5" />}
                    label="En Progreso"
                    value={data.cola.enProgreso}
                  />
                  <MetricBox
                    icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                    label="Completados 24h"
                    value={data.cola.completados24h}
                    color="text-emerald-600 dark:text-emerald-400"
                  />
                  <MetricBox
                    icon={<XCircle className="h-3.5 w-3.5" />}
                    label="Fallidos 24h"
                    value={data.cola.fallidos24h}
                    color={data.cola.fallidos24h > 3 ? 'text-red-600 dark:text-red-400' : undefined}
                  />
                </div>
                {data.cola.tiempoPromedioMs > 0 && (
                  <p className="text-[10px] text-muted-foreground">
                    Tiempo promedio: <span className="font-medium text-foreground">{formatDuration(data.cola.tiempoPromedioMs)}</span>
                  </p>
                )}
              </div>

              {/* Col 2: Worker + CheckFirst */}
              <div className="space-y-2">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Worker</p>
                <div className="flex items-center gap-2 mb-1">
                  <PulseDot active={data.worker.running} />
                  <span className={`text-xs font-medium ${data.worker.running ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                    {data.worker.running ? 'Ejecutando' : 'Pausado'}
                  </span>
                  <span className="text-[10px] text-muted-foreground ml-auto">
                    Uptime: {data.worker.uptime || '--'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <MetricBox
                    icon={<Gauge className="h-3.5 w-3.5" />}
                    label="Jobs/hora"
                    value={data.worker.jobsPerHour}
                  />
                  <MetricBox
                    icon={<Clock className="h-3.5 w-3.5" />}
                    label="Ultimo Job"
                    value={data.worker.lastJobTime ? timeAgo(data.worker.lastJobTime) : '--'}
                  />
                </div>

                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mt-3">Check-First</p>
                <div className="grid grid-cols-2 gap-2">
                  <MetricBox
                    icon={<AlertTriangle className="h-3.5 w-3.5" />}
                    label="Con Cambios"
                    value={data.checkFirst.conCambios24h}
                    color="text-emerald-600 dark:text-emerald-400"
                  />
                  <MetricBox
                    icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                    label="Sin Cambios"
                    value={data.checkFirst.sinCambios24h}
                  />
                </div>
                {data.checkFirst.tasaAhorro > 0 && (
                  <p className="text-[10px] text-muted-foreground">
                    Tasa ahorro check-first: <span className="font-medium text-emerald-600 dark:text-emerald-400">{data.checkFirst.tasaAhorro}%</span>
                  </p>
                )}
              </div>

              {/* Col 3: Fuentes + Scheduler */}
              <div className="space-y-2">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Fuentes</p>
                <div className="grid grid-cols-2 gap-2">
                  <MetricBox
                    icon={<Radio className="h-3.5 w-3.5" />}
                    label="Activas"
                    value={data.fuentes.activas}
                    color="text-emerald-600 dark:text-emerald-400"
                  />
                  <MetricBox
                    icon={<Zap className="h-3.5 w-3.5" />}
                    label="Cambios Hoy"
                    value={data.fuentes.conCambiosHoy}
                  />
                  <MetricBox
                    icon={<AlertTriangle className="h-3.5 w-3.5" />}
                    label="Degradadas"
                    value={data.fuentes.degradadas}
                    color={data.fuentes.degradadas > 0 ? 'text-amber-600 dark:text-amber-400' : undefined}
                  />
                  <MetricBox
                    icon={<XCircle className="h-3.5 w-3.5" />}
                    label="Con Error"
                    value={data.fuentes.conError}
                    color={data.fuentes.conError > 0 ? 'text-red-600 dark:text-red-400' : undefined}
                  />
                </div>

                {data.fuentes.topProductoras?.length > 0 && (
                  <div className="mt-1 space-y-0.5">
                    <p className="text-[9px] text-muted-foreground">Top productoras:</p>
                    {data.fuentes.topProductoras.slice(0, 3).map((fp, i) => (
                      <div key={i} className="flex items-center gap-1 text-[10px]">
                        <ArrowRight className="h-2 w-2 text-muted-foreground/50" />
                        <span className="text-foreground truncate">{fp.medio}</span>
                        <span className="text-muted-foreground ml-auto">{fp.cambios}</span>
                      </div>
                    ))}
                  </div>
                )}

                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mt-3">Scheduler</p>
                <div className="flex items-center gap-2">
                  <PulseDot active={data.scheduler?.running ?? false} />
                  <span className="text-[11px] font-medium">
                    {data.scheduler?.running ? `${data.scheduler.totalTasks} tareas` : 'Inactivo'}
                  </span>
                </div>
              </div>
            </div>

            {/* ── Admin Actions ── */}
            <div className="space-y-2">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Acciones del Administrador</p>
              <div className="flex flex-wrap gap-2">
                <ActionButton
                  icon={data.worker.running ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                  label={data.worker.running ? 'Pausar Worker' : 'Reanudar Worker'}
                  loading={actionLoading === 'worker'}
                  onClick={toggleWorker}
                />
                <ActionButton
                  icon={<RotateCcw className="h-3 w-3" />}
                  label="Recalcular Scheduler"
                  loading={actionLoading === 'scheduler'}
                  onClick={recalcScheduler}
                />
                <ActionButton
                  icon={<Trash2 className="h-3 w-3" />}
                  label="Purgar Completados (>3d)"
                  loading={actionLoading === 'purge_c'}
                  onClick={purgeCompleted}
                  confirmLabel="Confirmar limpieza"
                />
                <ActionButton
                  icon={<Trash2 className="h-3 w-3" />}
                  label="Purgar Fallidos (>7d)"
                  color="text-red-600 dark:text-red-400"
                  loading={actionLoading === 'purge_f'}
                  onClick={purgeFailed}
                  confirmLabel="Confirmar purge"
                />
                <ActionButton
                  icon={<Wrench className="h-3 w-3" />}
                  label="Recuperar Huerfanos"
                  loading={actionLoading === 'reclaim'}
                  onClick={reclaimOrphans}
                />
              </div>

              {/* Manual job trigger */}
              <div className="space-y-1.5 mt-2">
                <p className="text-[9px] text-muted-foreground">Disparar job manualmente:</p>
                <div className="flex flex-wrap gap-1.5">
                  {(['check_fuente', 'scrape_fuente', 'verificar_enlaces', 'mantenimiento'] as const).map(tipo => (
                    <ActionButton
                      key={tipo}
                      icon={<Zap className="h-3 w-3" />}
                      label={JOB_TYPE_LABELS[tipo]}
                      color={JOB_TYPE_COLORS[tipo]}
                      loading={actionLoading === `trigger_${tipo}`}
                      onClick={() => triggerJob(tipo)}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* ── Recent Failed Jobs ── */}
            <div className="space-y-2 border-t border-border/50 pt-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  Jobs Fallidos Recientes
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-[9px] gap-1 h-5 px-1.5"
                  onClick={handleShowRecent}
                >
                  {showRecent ? 'Ocultar' : 'Mostrar'}
                  {showRecent ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
                </Button>
              </div>

              {data.cola.fallidos24h === 0 && (
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 py-2">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="text-xs font-medium">Sin fallidos en las ultimas 24 horas</span>
                </div>
              )}

              {showRecent && (
                <div className="space-y-1.5">
                  {loadingJobs ? (
                    <div className="flex items-center gap-2 py-3 justify-center text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span className="text-[10px]">Cargando jobs fallidos...</span>
                    </div>
                  ) : recentJobs.length > 0 ? (
                    recentJobs.map(job => {
                      const estadoStyle = ESTADO_BADGE[job.estado] || ESTADO_BADGE.cancelado;
                      return (
                        <div
                          key={job.id}
                          className="flex items-center justify-between gap-2 p-2 rounded-lg bg-muted/30 border border-border/30"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className={`text-[10px] font-medium ${JOB_TYPE_COLORS[job.tipo] || 'text-foreground'}`}>
                                {JOB_TYPE_LABELS[job.tipo] || job.tipo}
                              </span>
                              <Badge variant={estadoStyle.variant} className={`text-[8px] px-1 py-0 h-4 ${estadoStyle.className}`}>
                                {job.estado.replace('_', ' ')}
                              </Badge>
                            </div>
                            <p className="text-[9px] text-muted-foreground mt-0.5 truncate">
                              {job.error || 'Sin error registrado'} · {job.intentos} intento{job.intentos > 1 ? 's' : ''} · {timeAgo(job.fechaCreacion)}
                            </p>
                          </div>
                          {(job.estado === 'pendiente' || job.estado === 'fallido') && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-[9px] h-6 px-1.5 text-red-500 hover:text-red-400 hover:bg-red-500/10"
                              onClick={() => cancelJob(job.id)}
                            >
                              <XCircle className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-[10px] text-muted-foreground text-center py-2">
                      No se encontraron jobs fallidos
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* ── Scheduler Tasks ── */}
            {data.scheduler?.tasks?.length > 0 && (
              <div className="space-y-2 border-t border-border/50 pt-3">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  Tareas Programadas ({data.scheduler.running ? 'activas' : 'inactivas'})
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {data.scheduler.tasks.map((tarea, i) => (
                    <div key={i} className="flex items-center gap-2 p-1.5 rounded-md bg-muted/20">
                      <PulseDot active={data.scheduler.running} color={data.scheduler.running ? 'bg-sky-500' : 'bg-muted-foreground/40'} />
                      <span className="text-[10px] text-foreground truncate flex-1">{tarea.humana}</span>
                      <span className="text-[9px] text-muted-foreground font-mono">{tarea.expresion}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Loading state ── */}
        {!data && (
          <div className="py-6 text-center text-muted-foreground">
            <div className="animate-pulse flex flex-col items-center gap-2">
              <Activity className="h-5 w-5 opacity-40" />
              <span className="text-xs">Cargando pipeline...</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
