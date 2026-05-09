'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { KPICard } from '@/components/shared/KPICard';
import {
  Clock, Loader2, CheckCircle2, XCircle, RefreshCw,
  Pause, Play, Calendar, Database, Zap, Trash2,
} from 'lucide-react';

// -- Types --

interface QueueStats {
  pendientes: number;
  enProgreso: number;
  fallidos24h: number;
  completados24h: number;
  tiempoPromedioMs: number;
}

interface WorkerInfo {
  running: boolean;
  uptime: string;
  jobsCompleted: number;
  jobsFailed: number;
  jobsPerHora: number;
  startTime: string | null;
  lastJobTime: string | null;
}

interface CheckFirstInfo {
  sinCambios24h: number;
  conCambios24h: number;
  tasaAhorro: number;
}

interface FuentesInfo {
  activas: number;
  conCambiosHoy: number;
  degradadas: number;
}

interface SchedulerInfo {
  running: boolean;
  totalTasks: number;
  tasks: Array<{ nombre: string; expresion: string; activa: boolean }>;
}

interface StatsData {
  cola: QueueStats;
  worker: WorkerInfo;
  checkFirst: CheckFirstInfo;
  fuentes: FuentesInfo;
  scheduler: SchedulerInfo;
}

interface JobItem {
  id: string;
  tipo: string;
  prioridad: number;
  estado: string;
  payload: Record<string, unknown> | null;
  intentos: number;
  maxIntentos: number;
  fechaCreacion: string;
  fechaInicio: string | null;
  fechaFin: string | null;
  resultado: Record<string, unknown> | null;
  error: string | null;
}

interface JobsResponse {
  jobs: JobItem[];
  total: number;
  porEstado: Record<string, number>;
}

interface FuenteItem {
  id: string;
  medioId: string;
  medio: { id: string; nombre: string; url: string };
  tipoCheck: string;
  frecuenciaBase: string;
  frecuenciaEfectiva: string;
  horariosOptimos: number[];
  ultimoCheck: string | null;
  ultimoCambio: string | null;
  totalChecks: number;
  totalCambios: number;
  checksSinCambio: number;
  responseTimePromedio: number;
  activo: boolean;
  error: string;
}

// -- Constants --

const JOB_TYPE_COLORS: Record<string, string> = {
  check_fuente: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  scrape_fuente: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  capture_indicador: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  generar_boletin: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  enviar_entrega: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
  verificar_enlaces: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  mantenimiento: 'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300',
  check_indicador: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
};

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

const ESTADO_COLORS: Record<string, string> = {
  pendiente: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  en_progreso: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  completado: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  fallido: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  cancelado: 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400',
};

const ESTADO_LABELS: Record<string, string> = {
  pendiente: 'Pendiente',
  en_progreso: 'En Progreso',
  completado: 'Completado',
  fallido: 'Fallido',
  cancelado: 'Cancelado',
};

const CHECK_TYPE_COLORS: Record<string, string> = {
  rss: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  head: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
  fingerprint: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  api: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
};

const ALL_JOB_TYPES = [
  'check_fuente', 'check_indicador', 'scrape_fuente',
  'capture_indicador', 'generar_boletin', 'enviar_entrega',
  'verificar_enlaces', 'mantenimiento',
];

const ALL_ESTADOS = ['todos', 'pendiente', 'en_progreso', 'completado', 'fallido'];

// -- Helpers --

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return '--';
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  if (diffMs < 0) return 'hace 0s';
  const diffS = Math.floor(diffMs / 1000);
  if (diffS < 60) return `hace ${diffS}s`;
  const diffM = Math.floor(diffS / 60);
  if (diffM < 60) return `hace ${diffM}m`;
  const diffH = Math.floor(diffM / 60);
  if (diffH < 24) return `hace ${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  return `hace ${diffD}d`;
}

function formatUptime(uptime: string): string {
  if (!uptime) return '--';
  const parts = uptime.split(':').map(Number);
  if (parts.length >= 2) {
    const h = parts[0] || 0;
    const m = parts[1] || 0;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  }
  return uptime;
}

function payloadSummary(payload: Record<string, unknown> | null): string {
  if (!payload) return '--';
  const keys = Object.keys(payload);
  if (keys.length === 0) return '{}';
  // Show the most relevant key-value pairs (up to 2)
  const relevant = keys.slice(0, 2).map(k => {
    const v = payload[k];
    if (typeof v === 'string') return `${k}: ${v.length > 30 ? v.slice(0, 30) + '...' : v}`;
    if (typeof v === 'number') return `${k}: ${v}`;
    return `${k}: ${typeof v}`;
  });
  return relevant.join(' | ');
}

// -- Component --

export function JobsView() {
  // -- State --
  const [stats, setStats] = useState<StatsData | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<'jobs' | 'fuentes'>('jobs');

  // Jobs tab state
  const [jobs, setJobs] = useState<JobItem[] | null>(null);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobsTotal, setJobsTotal] = useState(0);
  const [jobsPorEstado, setJobsPorEstado] = useState<Record<string, number>>({});
  const [jobFilterEstado, setJobFilterEstado] = useState('todos');
  const [jobFilterTipo, setJobFilterTipo] = useState('todos');

  // Fuentes tab state
  const [fuentes, setFuentes] = useState<FuenteItem[] | null>(null);
  const [fuentesLoading, setFuentesLoading] = useState(false);

  // Worker action state
  const [workerAction, setWorkerAction] = useState<'pause' | 'resume' | null>(null);
  const [workerStatus, setWorkerStatus] = useState<'running' | 'paused' | null>(null);

  // Scheduler action state
  const [schedulerActioning, setSchedulerActioning] = useState(false);

  // Stats refresh counter
  const [refreshCounter, setRefreshCounter] = useState(0);

  // -- Fetch Stats (auto-refresh every 10s) --
  const fetchStats = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch('/api/jobs/stats', { signal });
      if (!res.ok) return;
      const data = await res.json();
      setStats(data);
      setWorkerStatus(data?.worker?.running ? 'running' : 'paused');
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // -- Fetch Jobs --
  const fetchJobs = useCallback(async (signal?: AbortSignal) => {
    setJobsLoading(true);
    try {
      const params = new URLSearchParams({ limit: '50', offset: '0' });
      if (jobFilterEstado !== 'todos') params.set('estado', jobFilterEstado);
      if (jobFilterTipo !== 'todos') params.set('tipo', jobFilterTipo);
      const res = await fetch(`/api/jobs?${params}`, { signal });
      if (!res.ok) return;
      const data: JobsResponse = await res.json();
      setJobs(data.jobs || []);
      setJobsTotal(data.total || 0);
      setJobsPorEstado(data.porEstado || {});
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
    } finally {
      setJobsLoading(false);
    }
  }, [jobFilterEstado, jobFilterTipo]);

  // -- Fetch Fuentes --
  const fetchFuentes = useCallback(async (signal?: AbortSignal) => {
    setFuentesLoading(true);
    try {
      const res = await fetch('/api/jobs/fuentes', { signal });
      if (!res.ok) return;
      const data = await res.json();
      setFuentes(Array.isArray(data) ? data : []);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
    } finally {
      setFuentesLoading(false);
    }
  }, []);

  // -- Auto-refresh stats every 10s --
  useEffect(() => {
    const controller = new AbortController();
    fetchStats(controller.signal);
    const interval = setInterval(() => {
      fetchStats(controller.signal);
    }, 10000);
    return () => {
      clearInterval(interval);
      controller.abort();
    };
  }, [fetchStats, refreshCounter]);

  // -- Fetch jobs/fuentes when tab is active --
  useEffect(() => {
    const controller = new AbortController();
    if (activeTab === 'jobs') {
      fetchJobs(controller.signal);
    } else {
      fetchFuentes(controller.signal);
    }
    return () => { controller.abort(); };
  }, [activeTab, fetchJobs, fetchFuentes, jobFilterEstado, jobFilterTipo]);

  // -- Manual refresh --
  const handleRefresh = () => {
    setRefreshCounter(n => n + 1);
  };

  // -- Worker pause/resume --
  const handleWorkerToggle = async () => {
    if (!workerStatus) return;
    const accion = workerStatus === 'running' ? 'pause' : 'resume';
    setWorkerAction(accion);
    try {
      const res = await fetch('/api/jobs/worker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion }),
      });
      if (res.ok) {
        setWorkerStatus(accion === 'pause' ? 'paused' : 'running');
        setTimeout(handleRefresh, 500);
      }
    } catch { /* silent */ } finally {
      setWorkerAction(null);
    }
  };

  // -- Scheduler recalculate --
  const handleSchedulerRecalc = async () => {
    setSchedulerActioning(true);
    try {
      await fetch('/api/jobs/scheduler', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'recalcular' }),
      });
      setTimeout(handleRefresh, 500);
    } catch { /* silent */ } finally {
      setSchedulerActioning(false);
    }
  };

  // -- Force check --
  const handleForceCheck = async () => {
    try {
      await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: 'check_fuente', prioridad: 3 }),
      });
      setTimeout(handleRefresh, 500);
    } catch { /* silent */ }
  };

  // -- Purge completed --
  const handlePurgeCompleted = async () => {
    try {
      await fetch('/api/jobs', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });
      setTimeout(handleRefresh, 500);
    } catch { /* silent */ }
  };

  // -- Render --

  if (statsLoading && !stats) {
    return (
      <div className="space-y-4">
        <div className="h-6 bg-muted rounded w-48 animate-pulse" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
        <div className="h-10 bg-muted rounded-lg animate-pulse" />
        <div className="h-64 bg-muted rounded-lg animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* -- Section 1: KPI Bar -- */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPICard
          icon={<Clock className="h-5 w-5" />}
          value={stats?.cola?.pendientes ?? 0}
          label="Pendientes"
          subtext={`tiempo prom: ${stats?.cola?.tiempoPromedioMs ? Math.round(stats.cola.tiempoPromedioMs / 1000) + 's' : '--'}`}
          colorClass="text-amber-600 dark:text-amber-400"
        />
        <KPICard
          icon={<Loader2 className="h-5 w-5" />}
          value={stats?.cola?.enProgreso ?? 0}
          label="En Progreso"
          colorClass="text-blue-600 dark:text-blue-400"
        />
        <KPICard
          icon={<CheckCircle2 className="h-5 w-5" />}
          value={stats?.cola?.completados24h ?? 0}
          label="Completados 24h"
          colorClass="text-emerald-600 dark:text-emerald-400"
        />
        <KPICard
          icon={<XCircle className="h-5 w-5" />}
          value={stats?.cola?.fallidos24h ?? 0}
          label="Fallidos 24h"
          colorClass="text-red-600 dark:text-red-400"
        />
      </div>

      {/* -- Status Bar -- */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
            <span className="font-medium text-foreground">
              Check-First: {stats?.checkFirst ? Math.round(stats.checkFirst.tasaAhorro * 100) : 0}% ahorro
              ({stats?.checkFirst?.sinCambios24h ?? 0}/{(stats?.checkFirst?.sinCambios24h ?? 0) + (stats?.checkFirst?.conCambios24h ?? 0)} checks sin descarga)
            </span>
            <span className="hidden sm:inline text-muted-foreground/40">|</span>
            <span>
              Worker: {stats?.worker?.running ? (
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">activo</span>
              ) : (
                <span className="text-red-500 font-medium">inactivo</span>
              )}
              {' | uptime: '}{formatUptime(stats?.worker?.uptime ?? '')}
              {' | '}{stats?.worker?.jobsPerHora ?? 0} jobs/h
            </span>
            <span className="hidden sm:inline text-muted-foreground/40">|</span>
            <span>
              {stats?.fuentes?.activas ?? 0} fuentes activas
              {' | '}{stats?.fuentes?.conCambiosHoy ?? 0} con cambios hoy
              {' | '}{stats?.fuentes?.degradadas ?? 0} degradadas
            </span>
          </div>
        </CardContent>
      </Card>

      {/* -- Section 2: Control Buttons Bar -- */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={workerStatus === 'paused' ? 'default' : 'outline'}
          size="sm"
          onClick={handleWorkerToggle}
          disabled={workerAction !== null}
          className="text-xs gap-1.5"
        >
          {workerAction === 'pause' ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : workerAction === 'resume' ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : workerStatus === 'running' ? (
            <Pause className="h-3 w-3" />
          ) : (
            <Play className="h-3 w-3" />
          )}
          {workerStatus === 'running' ? 'Pausar Worker' : 'Reanudar Worker'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleSchedulerRecalc}
          disabled={schedulerActioning}
          className="text-xs gap-1.5"
        >
          {schedulerActioning ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Calendar className="h-3 w-3" />
          )}
          Recalcular Horarios
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleForceCheck}
          className="text-xs gap-1.5"
        >
          <Database className="h-3 w-3" />
          Forzar Check
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handlePurgeCompleted}
          className="text-xs gap-1.5"
        >
          <Trash2 className="h-3 w-3" />
          Limpiar Completados
        </Button>
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          className="text-xs gap-1.5 text-muted-foreground"
        >
          <RefreshCw className="h-3 w-3" />
          Refresh
        </Button>
      </div>

      {/* -- Section 3: Tabs -- */}
      <div className="flex items-center gap-1 p-1 rounded-lg bg-muted/50 border border-border">
        {([
          { id: 'jobs' as const, label: 'Jobs', icon: Zap },
          { id: 'fuentes' as const, label: 'Fuentes', icon: Database },
        ]).map(tab => {
          const TabIcon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-medium transition-colors flex-1 justify-center ${
                activeTab === tab.id
                  ? 'bg-background text-foreground shadow-sm border border-border'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
              }`}
            >
              <TabIcon className="h-3.5 w-3.5 shrink-0" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* -- Tab: Jobs -- */}
      {activeTab === 'jobs' && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Zap className="h-4 w-4 text-muted-foreground" />
                  Jobs Recientes
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  {jobsTotal} jobs totales
                  {jobsPorEstado && Object.entries(jobsPorEstado).map(([k, v], i) => (
                    <span key={k}>
                      {i === 0 ? ' (' : ' | '}
                      <span className={ESTADO_COLORS[k]?.split(' ')[1] || ''}>{v}</span> {ESTADO_LABELS[k] || k}
                    </span>
                  ))}
                  {jobsPorEstado && ')'}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={jobFilterEstado}
                  onChange={(e) => setJobFilterEstado(e.target.value)}
                  className="text-[10px] border border-border rounded-lg px-2 py-1.5 bg-background text-foreground"
                >
                  {ALL_ESTADOS.map(e => (
                    <option key={e} value={e}>
                      {e === 'todos' ? 'Todos los estados' : ESTADO_LABELS[e] || e}
                    </option>
                  ))}
                </select>
                <select
                  value={jobFilterTipo}
                  onChange={(e) => setJobFilterTipo(e.target.value)}
                  className="text-[10px] border border-border rounded-lg px-2 py-1.5 bg-background text-foreground"
                >
                  <option value="todos">Todos los tipos</option>
                  {ALL_JOB_TYPES.map(t => (
                    <option key={t} value={t}>{JOB_TYPE_LABELS[t] || t}</option>
                  ))}
                </select>
                <Button variant="outline" size="sm" onClick={() => fetchJobs()} className="text-xs gap-1">
                  <RefreshCw className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {jobsLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : jobs && jobs.length > 0 ? (
              <div className="space-y-1.5 max-h-[600px] overflow-y-auto custom-scrollbar">
                {jobs.map((job) => (
                  <div
                    key={job.id}
                    className="flex items-center gap-3 p-2.5 rounded-lg border border-border hover:bg-muted/30 transition-colors"
                  >
                    {/* Type badge */}
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${JOB_TYPE_COLORS[job.tipo] || 'bg-stone-100 text-stone-600'}`}>
                      {JOB_TYPE_LABELS[job.tipo] || job.tipo}
                    </span>
                    {/* Priority */}
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted font-mono shrink-0">
                      P{job.prioridad}
                    </span>
                    {/* Status */}
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${ESTADO_COLORS[job.estado] || 'bg-stone-100 text-stone-600'}`}>
                      {ESTADO_LABELS[job.estado] || job.estado}
                    </span>
                    {/* Payload summary */}
                    <p className="text-[10px] text-muted-foreground truncate flex-1 min-w-0">
                      {payloadSummary(job.payload)}
                    </p>
                    {/* Attempts */}
                    {job.intentos > 0 && (
                      <span className="text-[9px] text-muted-foreground shrink-0">
                        {job.intentos}/{job.maxIntentos}
                      </span>
                    )}
                    {/* Error */}
                    {job.error && (
                      <span className="text-[9px] text-red-500 truncate max-w-[120px] shrink-0" title={job.error}>
                        Err
                      </span>
                    )}
                    {/* Time */}
                    <span className="text-[9px] text-muted-foreground shrink-0 whitespace-nowrap">
                      {relativeTime(job.fechaCreacion)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Zap className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">No hay jobs para los filtros seleccionados</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* -- Tab: Fuentes -- */}
      {activeTab === 'fuentes' && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Database className="h-4 w-4 text-muted-foreground" />
                  Monitoreo de Fuentes
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  {fuentes?.length ?? 0} fuentes registradas
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => fetchFuentes()} className="text-xs gap-1">
                <RefreshCw className="h-3 w-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {fuentesLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : fuentes && fuentes.length > 0 ? (
              <div className="space-y-1.5 max-h-[600px] overflow-y-auto custom-scrollbar">
                {fuentes.map((f) => {
                  const isDegradada = f.checksSinCambio >= 5;
                  const hasError = !!f.error;
                  const statusColor = hasError
                    ? 'border-l-red-400'
                    : !f.activo
                      ? 'border-l-stone-400'
                      : isDegradada
                        ? 'border-l-amber-400'
                        : 'border-l-emerald-400';

                  return (
                    <div
                      key={f.id}
                      className={`flex items-center gap-3 p-2.5 rounded-lg border border-border border-l-2 ${statusColor} hover:bg-muted/30 transition-colors`}
                    >
                      {/* Medio name */}
                      <p className="text-xs font-semibold text-foreground truncate min-w-0 max-w-[180px] shrink-0">
                        {f.medio?.nombre || f.medioId}
                      </p>
                      {/* Tipo check badge */}
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${CHECK_TYPE_COLORS[f.tipoCheck] || 'bg-stone-100 text-stone-600'}`}>
                        {f.tipoCheck?.toUpperCase() || 'N/A'}
                      </span>
                      {/* Frecuencia */}
                      <span className="text-[9px] text-muted-foreground shrink-0">
                        {f.frecuenciaBase || '--'}
                      </span>
                      {/* Horarios */}
                      {f.horariosOptimos && f.horariosOptimos.length > 0 && (
                        <span className="text-[9px] text-muted-foreground shrink-0 hidden lg:inline">
                          [{f.horariosOptimos.map(h => `${String(h).padStart(2, '0')}:00`).join(', ')}]
                        </span>
                      )}
                      {/* Response time */}
                      {f.responseTimePromedio > 0 && (
                        <span className="text-[9px] text-muted-foreground shrink-0">
                          {f.responseTimePromedio}ms
                        </span>
                      )}
                      {/* Stats */}
                      <span className="text-[9px] text-muted-foreground shrink-0 hidden sm:inline">
                        {f.totalChecks} checks | {f.totalCambios} cambios | {f.checksSinCambio} sin cambio
                      </span>
                      {/* Ultimo check */}
                      <span className="text-[9px] text-muted-foreground shrink-0 ml-auto whitespace-nowrap">
                        {relativeTime(f.ultimoCheck)}
                      </span>
                      {/* Activo status */}
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${
                        !f.activo
                          ? 'bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400'
                          : hasError
                            ? 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300'
                            : isDegradada
                              ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300'
                              : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300'
                      }`}>
                        {!f.activo ? 'OFF' : hasError ? 'ERR' : isDegradada ? 'DEG' : 'OK'}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <Database className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">No hay fuentes registradas</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
