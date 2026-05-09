'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Activity, Play, Pause, RotateCcw, Trash2, AlertTriangle,
  RefreshCw, Clock, Cpu, Database, Zap, ChevronDown, ChevronUp,
  CheckCircle2, XCircle, Timer, Loader2, Wrench,
  ArrowRight, Layers, Gauge, Radio, Eye, Send, Sparkles,
  FileText, Calendar, AlertOctagon, ChevronRight,
} from 'lucide-react';
import { fetchWithTimeout } from '@/lib/fetch-utils';

// ─── Types ────────────────────────────────────────────────

interface PipelineResponse {
  timestamp: string;
  horaBolivia: string;
  diaSemana: string;
  pasado: {
    completados: JobItem[];
    fallidos: JobFallidoItem[];
    entregas: { total: number; enviadas: number; pendientes: number; fallidas: number };
    productosIA: ProductoIA[];
  };
  presente: {
    enEjecucion: JobActivoItem[];
    fuentes: FuenteItem[];
    worker: WorkerStatus;
    scheduler: SchedulerStatus;
  };
  futuro: {
    proximosChecks: ProximoCheckItem[];
    boletines: BoletinProgramado[];
    mantenimiento: { hora: number; minuto: number; minutosHasta: number; estado: string };
    entregasProgramadas: EntregaProgramada[];
    colaPendiente: JobPendienteItem[];
  };
}

interface JobItem {
  id: string; tipo: string; prioridad: number;
  duracionSegundos: number | null; hace: string; fecha: string;
  resultado: Record<string, unknown>;
}

interface JobFallidoItem {
  id: string; tipo: string; prioridad: number;
  error: string; intentos: number; maxIntentos: number;
  puedeReintentar: boolean; duracionSegundos: number | null;
  hace: string; fecha: string;
  fuente: string | null; cliente: string | null; canal: string | null;
}

interface ProductoIA {
  id: string; tipo: string; menciones: number;
  enlacesRotos: number; fecha: string; hace: string;
}

interface JobActivoItem {
  id: string; tipo: string; prioridad: number;
  elapsedSegundos: number; inicio: string | null; hace: string;
  fuente: string | null; url: string | null; cliente: string | null; canal: string | null;
}

interface FuenteItem {
  id: string; medioId: string; nombre: string; url: string;
  tipo: string; categoria: string; activo: boolean; tipoCheck: string;
  frecuenciaBase: string; frecuenciaActual: string; frecuenciaLabel: string;
  esDegradado: boolean; estaMuerto: boolean;
  ultimoCheck: string | null; ultimoCheckHace: string;
  ultimoCambio: string | null; ultimoCambioHace: string;
  totalChecks: number; totalCambios: number; checksSinCambio: number;
  responseTime: number; error: string | null; horariosOptimos: number[];
}

interface WorkerStatus {
  running: boolean; uptime: string; jobsPerHour: number;
  lastJobTime: string | null; lastJobHace: string;
  jobsCompleted: number; jobsFailed: number;
}

interface SchedulerStatus {
  running: boolean; totalTasks: number;
  tasks: Array<{ expresion: string; humana: string }>;
}

interface ProximoCheckItem {
  medioId: string; nombre: string; url: string; tipo: string;
  tipoCheck: string; frecuenciaLabel: string;
  proximoCheck: number; minutosHasta: number;
  horasOptimos: number[]; esDegradado: boolean;
}

interface BoletinProgramado {
  tipo: string; hora: number; minuto: number;
  minutosHasta: number; prioridad: number; estado: string;
}

interface EntregaProgramada {
  id: string; tipoBoletin: string; canal: string;
  clienteNombre: string; fechaProgramada: string | null;
  minutosHasta: number | null;
}

interface JobPendienteItem {
  id: string; tipo: string; prioridad: number;
  hace: string; programadoPara: string | null;
  fuente: string | null; cliente: string | null;
}

// ─── Constants ────────────────────────────────────────────

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

const PRIORIDAD_COLORS: Record<number, string> = {
  0: 'bg-red-500', 1: 'bg-orange-500', 3: 'bg-amber-500',
  5: 'bg-blue-500', 7: 'bg-gray-400', 9: 'bg-stone-400',
};

function formatDuration(secs: number | null): string {
  if (!secs) return '--';
  if (secs < 60) return `${secs}s`;
  return `${Math.floor(secs / 60)}m ${secs % 60}s`;
}

function formatMins(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

// ─── Action Feedback ──────────────────────────────────────

interface Feedback {
  id: string; tipo: 'exito' | 'error' | 'info'; mensaje: string;
}

function FeedbackToast({ fb, onDismiss }: { fb: Feedback; onDismiss: (id: string) => void }) {
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
      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-[11px] cursor-pointer ${colors[fb.tipo]}`}
      onClick={() => onDismiss(fb.id)}
    >
      {icons[fb.tipo]}
      <span className="flex-1">{fb.mensaje}</span>
    </motion.div>
  );
}

// ─── Pulse Dot ────────────────────────────────────────────

function PulseDot({ active, color = 'bg-emerald-500' }: { active: boolean; color?: string }) {
  return (
    <span className={`relative flex h-2 w-2 ${active ? '' : 'opacity-30'}`}>
      {active && <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${color} opacity-75`} />}
      <span className={`relative inline-flex rounded-full h-2 w-2 ${active ? color : 'bg-muted-foreground/40'}`} />
    </span>
  );
}

// ═══════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════

interface PipelineMonitorProps {
  data: PipelineResponse | null;
  onRefresh: () => void;
}

export function PipelineMonitor({ data, onRefresh }: PipelineMonitorProps) {
  const [expanded, setExpanded] = useState(false);
  const [section, setSection] = useState<'pasado' | 'presente' | 'futuro'>('presente');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);

  // ─── Feedback ──────────────────────────────────────────
  const addFeedback = useCallback((tipo: Feedback['tipo'], mensaje: string) => {
    const fb: Feedback = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, tipo, mensaje };
    setFeedbacks(prev => [fb, ...prev].slice(0, 5));
    setTimeout(() => setFeedbacks(prev => prev.filter(f => f.id !== fb.id)), 8000);
  }, []);

  // ─── Actions ──────────────────────────────────────────
  const executeAction = useCallback(async (
    actionId: string, url: string, body: Record<string, unknown>, successMsg: string,
  ) => {
    setActionLoading(actionId);
    try {
      const res = await fetchWithTimeout(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body), timeoutMs: 15_000,
      });
      const json = await res.json();
      if (res.ok) { addFeedback('exito', json.mensaje || successMsg); setTimeout(onRefresh, 500); }
      else { addFeedback('error', json.error || `Error en ${actionId}`); }
    } catch (err) { addFeedback('error', `Error: ${err instanceof Error ? err.message : actionId}`); }
    finally { setActionLoading(null); }
  }, [addFeedback, onRefresh]);

  const toggleWorker = useCallback(() => {
    const isRunning = data?.presente?.worker?.running;
    executeAction('worker', '/api/jobs/worker',
      { accion: isRunning ? 'pause' : 'resume' },
      isRunning ? 'Worker pausado' : 'Worker reanudado');
  }, [data?.presente?.worker?.running, executeAction]);

  const purgeCompleted = useCallback(() => {
    executeAction('purge_c', '/api/jobs/maintenance', { accion: 'purge_completados', dias: 3 }, 'Completados limpiados');
  }, [executeAction]);

  const purgeFailed = useCallback(() => {
    executeAction('purge_f', '/api/jobs/maintenance', { accion: 'purge_fallidos', dias: 7 }, 'Fallidos limpiados');
  }, [executeAction]);

  const reclaimOrphans = useCallback(() => {
    executeAction('reclaim', '/api/jobs/maintenance', { accion: 'reclaim_huerfanos' }, 'Huerfanos recuperados');
  }, [executeAction]);

  const rescheduleTasks = useCallback(() => {
    executeAction('reschedule', '/api/jobs/scheduler', { accion: 'recalcular' }, 'Tareas reprogramadas');
  }, [executeAction]);

  const forceCheckAll = useCallback(async () => {
    setActionLoading('force_check');
    try {
      // Enqueue check_fuente for all active fuentes
      const res = await fetchWithTimeout('/api/scraping/phase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'ejecutar_uno_all' }),
        timeoutMs: 10_000,
      });
      const json = await res.json();
      if (res.ok) { addFeedback('exito', json.mensaje || 'Check forzado para todas las fuentes'); setTimeout(onRefresh, 1000); }
      else { addFeedback('error', json.error || 'Error forzando checks'); }
    } catch (err) { addFeedback('error', `Error: ${err instanceof Error ? err.message : 'force_check'}`); }
    finally { setActionLoading(null); }
  }, [addFeedback, onRefresh]);

  const cancelJob = useCallback(async (jobId: string) => {
    try {
      const res = await fetchWithTimeout(`/api/jobs/${jobId}`, { method: 'DELETE', timeoutMs: 10_000 });
      if (res.ok) { addFeedback('exito', 'Job cancelado'); setTimeout(onRefresh, 500); }
      else { const d = await res.json(); addFeedback('error', d.error || 'No se pudo cancelar'); }
    } catch { addFeedback('error', 'Error de conexion'); }
  }, [addFeedback, onRefresh]);

  // ─── Computed ──────────────────────────────────────────
  const fallidosCount = data?.pasado?.fallidos?.length ?? 0;
  const enEjecucionCount = data?.presente?.enEjecucion?.length ?? 0;
  const workerRunning = data?.presente?.worker?.running ?? false;

  const borderColor = useMemo(() => {
    if (fallidosCount > 5) return 'border-l-red-500';
    if (fallidosCount > 0) return 'border-l-amber-500';
    if (enEjecucionCount > 0) return 'border-l-sky-500';
    if (workerRunning) return 'border-l-emerald-500';
    return 'border-l-stone-400';
  }, [fallidosCount, enEjecucionCount, workerRunning]);

  // ═══════════════════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════════════════

  if (!data) {
    return (
      <Card className="border border-l-4 border-l-muted">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 py-4 justify-center text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-xs">Cargando pipeline...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { pasado, presente, futuro } = data;

  return (
    <Card className={`border border-l-4 ${borderColor} overflow-hidden`}>
      <CardContent className="p-4 space-y-3">

        {/* ── Header ── */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Monitor de Pipeline</span>
            <PulseDot active={workerRunning} />
            <span className="text-[10px] text-muted-foreground">{data.horaBolivia} — {data.diaSemana}</span>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="text-[10px] gap-1 h-6 px-2" onClick={onRefresh}>
              <RefreshCw className="h-3 w-3" /> Refresh
            </Button>
            <Button variant="ghost" size="sm" className="text-[10px] gap-1 h-6 px-2"
              onClick={() => setExpanded(p => !p)}>
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {expanded ? 'Menos' : 'Expandir'}
            </Button>
          </div>
        </div>

        {/* ── Feedback toasts ── */}
        <AnimatePresence>
          {feedbacks.map(fb => <FeedbackToast key={fb.id} fb={fb} onDismiss={id => setFeedbacks(p => p.filter(f => f.id !== id))} />)}
        </AnimatePresence>

        {/* ══════ COMPACT VIEW ══════ */}
        {!expanded && (
          <div className="space-y-3">
            {/* 3-column summary: Pasado / Presente / Futuro */}
            <div className="grid grid-cols-3 gap-2">
              {/* PASADO */}
              <div className="p-2 rounded-lg bg-muted/30 border border-border/40 space-y-1">
                <p className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider">Pasado (24h)</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">{pasado.entregas.enviadas}</span>
                  <span className="text-[9px] text-muted-foreground">entregadas</span>
                </div>
                {pasado.fallidos.length > 0 && (
                  <div className="flex items-center gap-1">
                    <XCircle className="h-3 w-3 text-red-500" />
                    <span className="text-[10px] text-red-600 dark:text-red-400">{pasado.fallidos.length} fallido{pasado.fallidos.length > 1 ? 's' : ''}</span>
                  </div>
                )}
                {pasado.productosIA.length > 0 && (
                  <div className="flex items-center gap-1">
                    <Sparkles className="h-3 w-3 text-violet-500" />
                    <span className="text-[10px] text-muted-foreground">{pasado.productosIA.length} productos IA</span>
                  </div>
                )}
              </div>

              {/* PRESENTE */}
              <div className="p-2 rounded-lg bg-muted/30 border border-border/40 space-y-1">
                <p className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider">Ahora</p>
                <div className="flex items-center gap-1">
                  <PulseDot active={workerRunning} />
                  <span className={`text-[10px] font-medium ${workerRunning ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                    {workerRunning ? 'Activo' : 'Pausado'}
                  </span>
                </div>
                {presente.enEjecucion.length > 0 ? (
                  <div className="flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin text-sky-500" />
                    <span className="text-[10px] text-foreground truncate">
                      {JOB_TYPE_LABELS[presente.enEjecucion[0].tipo] || presente.enEjecucion[0].tipo}
                      {presente.enEjecucion[0].fuente ? `: ${presente.enEjecucion[0].fuente}` : ''}
                    </span>
                  </div>
                ) : (
                  <span className="text-[10px] text-muted-foreground">Sin jobs en ejecución</span>
                )}
                <div className="text-[9px] text-muted-foreground">
                  {presente.fuentes.filter(f => f.activo).length} fuentes ·
                  {presente.fuentes.filter(f => f.esDegradado).length} degradadas ·
                  {presente.fuentes.filter(f => f.estaMuerto).length} muertas
                </div>
              </div>

              {/* FUTURO */}
              <div className="p-2 rounded-lg bg-muted/30 border border-border/40 space-y-1">
                <p className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider">Próximo</p>
                {futuro.boletines.length > 0 ? (
                  <div className="flex items-center gap-1">
                    <FileText className="h-3 w-3 text-amber-500" />
                    <span className="text-[10px] text-foreground truncate">
                      {futuro.boletines[0].tipo.replace(/_/g, ' ')}
                    </span>
                    <span className="text-[9px] text-muted-foreground ml-auto">
                      en {formatMins(futuro.boletines[0].minutosHasta)}
                    </span>
                  </div>
                ) : (
                  <span className="text-[10px] text-muted-foreground">Sin boletines programados</span>
                )}
                {futuro.proximosChecks.length > 0 && (
                  <div className="flex items-center gap-1">
                    <Radio className="h-3 w-3 text-sky-500" />
                    <span className="text-[10px] text-foreground truncate">
                      {futuro.proximosChecks[0].nombre}
                    </span>
                    <span className="text-[9px] text-muted-foreground ml-auto">
                      en {formatMins(futuro.proximosChecks[0].minutosHasta)}
                    </span>
                  </div>
                )}
                {futuro.entregasProgramadas.length > 0 && (
                  <div className="flex items-center gap-1">
                    <Send className="h-3 w-3 text-teal-500" />
                    <span className="text-[10px] text-muted-foreground">
                      {futuro.entregasProgramadas.length} entrega{futuro.entregasProgramadas.length > 1 ? 's' : ''} pendiente{futuro.entregasProgramadas.length > 1 ? 's' : ''}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Quick actions — controles siempre visibles */}
            <div className="flex flex-wrap gap-1.5">
              <Button variant="outline" size="sm" className="text-[10px] gap-1 h-7 px-2"
                disabled={actionLoading === 'worker'} onClick={toggleWorker}>
                {actionLoading === 'worker' ? <Loader2 className="h-3 w-3 animate-spin" /> :
                  workerRunning ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                {workerRunning ? 'Pausar' : 'Reanudar'}
              </Button>
              <Button variant="outline" size="sm" className="text-[10px] gap-1 h-7 px-2"
                disabled={actionLoading === 'force_check'} onClick={forceCheckAll}>
                {actionLoading === 'force_check' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
                Forzar Check
              </Button>
              <Button variant="outline" size="sm" className="text-[10px] gap-1 h-7 px-2"
                disabled={actionLoading === 'reschedule'} onClick={rescheduleTasks}>
                {actionLoading === 'reschedule' ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                Reprogramar
              </Button>
              <Button variant="outline" size="sm" className="text-[10px] gap-1 h-7 px-2"
                disabled={actionLoading === 'reclaim'} onClick={reclaimOrphans}>
                <Wrench className="h-3 w-3" /> Huerfanos
              </Button>
              <Button variant="outline" size="sm" className="text-[10px] gap-1 h-7 px-2"
                disabled={actionLoading === 'purge_c'} onClick={purgeCompleted}>
                <Trash2 className="h-3 w-3" /> Limpiar
              </Button>
            </div>

            {/* Mini historial — siempre visible en compact view */}
            {pasado.completados.length > 0 || pasado.fallidos.length > 0 ? (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider">
                    <Timer className="h-2.5 w-2.5 inline mr-1" />Actividad Reciente
                  </p>
                  <button onClick={() => { setExpanded(true); setSection('pasado'); }}
                    className="text-[9px] text-sky-600 dark:text-sky-400 hover:underline">
                    Ver todo
                  </button>
                </div>
                {(() => {
                  type MiniJobRow = Record<string, unknown> & {
                    id: string; tipo: string; hace: string;
                    _hasError: boolean; _errorText: string | null;
                    _cambiado: boolean | undefined; _kind: string;
                  }
                  const recentJobs: MiniJobRow[] = [
                    ...pasado.completados.slice(0, 5).map(j => {
                      const r = j.resultado || {}
                      const detalle = String(r.detalle ?? '')
                      const hasError = !!(r.error || (detalle && /HTTP \d{3}|fetch failed|timeout|forbidden|vacío|vacio|no parseable|Error:/i.test(detalle)))
                      return {
                        id: j.id, tipo: j.tipo, hace: j.hace,
                        _kind: 'completado', _hasError: hasError,
                        _errorText: r.error ? String(r.error) : (hasError ? detalle : null),
                        _cambiado: r.cambiado as boolean | undefined,
                      }
                    }),
                    ...pasado.fallidos.slice(0, 3).map(j => ({
                      id: j.id, tipo: j.tipo, hace: j.hace,
                      _kind: 'fallido', _hasError: true, _errorText: j.error || null, _cambiado: false,
                    })),
                  ].sort((a, b) => a.hace.localeCompare(b.hace))

                  return (
                    <div className="space-y-0.5">
                      {recentJobs.map(j => (
                        <div key={j.id} className="flex items-center gap-1.5 text-[10px] px-1.5 py-1 rounded bg-muted/20">
                          {j._kind === 'fallido' ? (
                            <XCircle className="h-2.5 w-2.5 text-red-500 shrink-0" />
                          ) : j._hasError ? (
                            <AlertTriangle className="h-2.5 w-2.5 text-amber-500 shrink-0" />
                          ) : j._cambiado ? (
                            <CheckCircle2 className="h-2.5 w-2.5 text-emerald-500 shrink-0" />
                          ) : (
                            <CheckCircle2 className="h-2.5 w-2.5 text-muted-foreground/40 shrink-0" />
                          )}
                          <span className={`truncate ${JOB_TYPE_COLORS[j.tipo] || 'text-foreground'}`}>
                            {JOB_TYPE_LABELS[j.tipo] || j.tipo}
                          </span>
                          {j._hasError && j._errorText && (
                            <span className="text-[9px] text-red-600 dark:text-red-400 truncate flex-1">{j._errorText}</span>
                          )}
                          <span className="text-[9px] text-muted-foreground shrink-0 ml-auto">{j.hace}</span>
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </div>
            ) : (
              <p className="text-[10px] text-muted-foreground">Sin actividad en las últimas 24h</p>
            )}
          </div>
        )}

        {/* ══════ EXPANDED VIEW ══════ */}
        {expanded && (
          <div className="space-y-4">

            {/* Tab selector */}
            <div className="flex gap-1 bg-muted/40 rounded-lg p-1">
              {(['pasado', 'presente', 'futuro'] as const).map(s => (
                <button key={s} onClick={() => setSection(s)}
                  className={`flex-1 text-center py-1.5 rounded-md text-[11px] font-medium transition-all ${
                    section === s ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}>
                  {s === 'pasado' ? 'Pasado' : s === 'presente' ? 'Presente' : 'Futuro'}
                  {s === 'pasado' && pasado.fallidos.length > 0 && (
                    <span className="ml-1 inline-flex items-center justify-center h-4 w-4 rounded-full bg-red-500/20 text-red-600 dark:text-red-400 text-[9px]">
                      {pasado.fallidos.length}
                    </span>
                  )}
                  {s === 'presente' && presente.enEjecucion.length > 0 && (
                    <span className="ml-1 inline-flex items-center justify-center h-4 w-4 rounded-full bg-sky-500/20 text-sky-600 dark:text-sky-400 text-[9px] animate-pulse">
                      {presente.enEjecucion.length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* ═══ PASADO ═══ */}
            {section === 'pasado' && (
              <div className="space-y-3">
                {/* Entregas summary */}
                <div className="grid grid-cols-4 gap-2">
                  <div className="text-center p-2 rounded-lg bg-muted/30">
                    <span className="text-sm font-bold">{pasado.entregas.total}</span>
                    <p className="text-[9px] text-muted-foreground">Total</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-emerald-500/5">
                    <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{pasado.entregas.enviadas}</span>
                    <p className="text-[9px] text-muted-foreground">Enviadas</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-amber-500/5">
                    <span className="text-sm font-bold text-amber-600 dark:text-amber-400">{pasado.entregas.pendientes}</span>
                    <p className="text-[9px] text-muted-foreground">Pendientes</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-red-500/5">
                    <span className="text-sm font-bold text-red-600 dark:text-red-400">{pasado.entregas.fallidas}</span>
                    <p className="text-[9px] text-muted-foreground">Fallidas</p>
                  </div>
                </div>

                {/* Productos IA */}
                {pasado.productosIA.length > 0 && (
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                      <Sparkles className="h-3 w-3 inline mr-1 text-violet-500" />Productos IA generados hoy
                    </p>
                    <div className="space-y-1">
                      {pasado.productosIA.map(p => (
                        <div key={p.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/20 border border-border/30">
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText className="h-3 w-3 text-violet-500 shrink-0" />
                            <span className={`text-[10px] font-medium truncate ${JOB_TYPE_COLORS.generar_boletin}`}>
                              {p.tipo.replace(/_/g, ' ')}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-[9px] text-muted-foreground shrink-0">
                            <span>{p.menciones} menc.</span>
                            <span>{p.hace}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Historial unificado de jobs */}
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                    <Timer className="h-3 w-3 inline mr-1" />Historial de Jobs (24h)
                  </p>
                  {(() => {
                    // Merge completados + fallidos into unified timeline sorted by date
                    type JobRow = Record<string, unknown> & {
                      id: string; tipo: string; prioridad: number; hace: string; fecha: string;
                      _kind: string; _hasError: boolean; _errorText: string | null;
                      _cambiado: boolean | undefined; _tipoCheck: string | null;
                      _detalle: string | null; duracionSegundos: number | null;
                    }
                    const allJobs: JobRow[] = [
                      ...pasado.completados.map(j => {
                        const r = j.resultado || {}
                        const detalle = String(r.detalle ?? '')
                        const hasError = r.error || (detalle && /HTTP \d{3}|fetch failed|timeout|forbidden|vacío|no parseable/i.test(detalle))
                        return {
                          id: j.id, tipo: j.tipo, prioridad: j.prioridad,
                          duracionSegundos: j.duracionSegundos, hace: j.hace, fecha: j.fecha,
                          resultado: j.resultado, fuente: (j.resultado as Record<string, unknown>)?.fuente as string | undefined,
                          _kind: 'completado', _hasError: !!hasError,
                          _errorText: r.error ? String(r.error) : (hasError ? detalle : null),
                          _cambiado: r.cambiado as boolean | undefined,
                          _tipoCheck: (r.tipoCheckUsado as string) || null,
                          _detalle: detalle || null,
                        }
                      }),
                      ...pasado.fallidos.map(j => ({
                        id: j.id, tipo: j.tipo, prioridad: j.prioridad,
                        duracionSegundos: j.duracionSegundos, hace: j.hace, fecha: j.fecha,
                        _kind: 'fallido', _hasError: true, _errorText: j.error || null,
                        _cambiado: false, _tipoCheck: null, _detalle: null,
                      })),
                    ].sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''))

                    if (allJobs.length === 0) {
                      return <p className="text-[10px] text-muted-foreground">Sin jobs en las últimas 24h</p>
                    }

                    return (
                      <div className="space-y-1">
                        {allJobs.slice(0, 20).map(j => (
                          <div
                            key={j.id}
                            className={`p-2 rounded-lg border ${
                              j._kind === 'fallido'
                                ? 'bg-red-500/5 border-red-500/20'
                                : j._hasError
                                  ? 'bg-amber-500/5 border-amber-500/20'
                                  : j._cambiado
                                    ? 'bg-emerald-500/5 border-emerald-500/20'
                                    : 'bg-muted/20 border-border/30'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 min-w-0">
                                {j._kind === 'fallido' ? (
                                  <XCircle className="h-3 w-3 text-red-500 shrink-0" />
                                ) : j._hasError ? (
                                  <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />
                                ) : j._cambiado ? (
                                  <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                                ) : (
                                  <CheckCircle2 className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                                )}
                                <span className={`text-[10px] font-medium ${JOB_TYPE_COLORS[j.tipo] || 'text-foreground'}`}>
                                  {JOB_TYPE_LABELS[j.tipo] || j.tipo}
                                </span>
                                {(j as { fuente?: string }).fuente && <span className="text-[9px] text-foreground truncate max-w-[100px]">{(j as { fuente?: string }).fuente!}</span>}
                                {j._tipoCheck && (
                                  <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5">{j._tipoCheck}</Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-[9px] text-muted-foreground shrink-0">
                                <span>{j.hace}</span>
                                {j.duracionSegundos !== null && (
                                  <span className="flex items-center gap-0.5">
                                    <Timer className="h-2.5 w-2.5" />{formatDuration(j.duracionSegundos)}
                                  </span>
                                )}
                                <span className={`inline-block h-1.5 w-1.5 rounded-full ${PRIORIDAD_COLORS[j.prioridad] || 'bg-gray-400'}`} title={`P${j.prioridad}`} />
                              </div>
                            </div>
                            {j._hasError && j._errorText && (
                              <p className="text-[9px] text-red-600 dark:text-red-400 mt-0.5 truncate" title={j._errorText}>
                                {j._errorText}
                              </p>
                            )}
                            {!j._hasError && j._cambiado && j._detalle && (
                              <p className="text-[9px] text-emerald-600 dark:text-emerald-400 mt-0.5 truncate" title={j._detalle}>
                                {j._detalle}
                              </p>
                            )}
                            {!j._hasError && !j._cambiado && j._detalle && (
                              <p className="text-[9px] text-muted-foreground mt-0.5 truncate" title={j._detalle}>
                                {j._detalle}
                              </p>
                            )}
                          </div>
                        ))}
                        {allJobs.length > 20 && (
                          <p className="text-[9px] text-muted-foreground text-center pt-1">
                            Mostrando 20 de {allJobs.length} jobs
                          </p>
                        )}
                      </div>
                    )
                  })()}
                </div>
              </div>
            )}

            {/* ═══ PRESENTE ═══ */}
            {section === 'presente' && (
              <div className="space-y-3">
                {/* Worker status */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 rounded-lg bg-muted/30 border border-border/40 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <PulseDot active={workerRunning} />
                      <span className={`text-[11px] font-medium ${workerRunning ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                        Worker {workerRunning ? 'Ejecutando' : 'Pausado'}
                      </span>
                    </div>
                    <div className="text-[9px] text-muted-foreground">
                      Uptime: {presente.worker.uptime} · {presente.worker.jobsPerHour} jobs/h
                    </div>
                    <div className="text-[9px] text-muted-foreground">
                      Último job: {presente.worker.lastJobHace}
                    </div>
                    <div className="text-[9px] text-muted-foreground">
                      Completados: {presente.worker.jobsCompleted} · Fallidos: {presente.worker.jobsFailed}
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/30 border border-border/40 space-y-1">
                    <p className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider">Scheduler</p>
                    <div className="flex items-center gap-1.5">
                      <PulseDot active={presente.scheduler.running} />
                      <span className="text-[11px] font-medium">
                        {presente.scheduler.running ? `${presente.scheduler.totalTasks} tareas activas` : 'Inactivo'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Jobs en ejecución ahora */}
                {presente.enEjecucion.length > 0 ? (
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                      <Loader2 className="h-3 w-3 inline mr-1 animate-spin text-sky-500" />Ejecutando ahora
                    </p>
                    <div className="space-y-1.5">
                      {presente.enEjecucion.map(j => (
                        <div key={j.id} className="p-2 rounded-lg bg-sky-500/5 border border-sky-500/20">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className={`text-[10px] font-medium ${JOB_TYPE_COLORS[j.tipo]}`}>
                                {JOB_TYPE_LABELS[j.tipo] || j.tipo}
                              </span>
                              {j.fuente && <span className="text-[9px] text-foreground truncate max-w-[120px]">{j.fuente}</span>}
                              {j.cliente && <span className="text-[9px] text-muted-foreground">→ {j.cliente}</span>}
                            </div>
                            <span className="text-[10px] text-sky-600 dark:text-sky-400 font-mono">
                              {formatDuration(j.elapsedSegundos)}
                            </span>
                          </div>
                          <div className="text-[9px] text-muted-foreground mt-0.5">
                            Iniciado {j.hace}
                            {j.url && <span className="block truncate">{j.url}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-[10px] text-muted-foreground">Ningún job en ejecución en este momento</p>
                )}

                {/* Fuentes */}
                {presente.fuentes.length > 0 ? (
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                      <Radio className="h-3 w-3 inline mr-1" />Fuentes ({presente.fuentes.filter(f => f.activo).length} activas)
                    </p>
                    <div className="space-y-1">
                      {presente.fuentes.slice(0, 10).map(f => (
                        <div key={f.id}
                          className={`flex items-center justify-between gap-2 p-1.5 rounded-lg border ${
                            f.estaMuerto ? 'bg-red-500/5 border-red-500/20' :
                            f.esDegradado ? 'bg-amber-500/5 border-amber-500/20' :
                            f.error ? 'bg-orange-500/5 border-orange-500/20' :
                            'bg-muted/20 border-border/30'
                          }`}>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className={`inline-block h-1.5 w-1.5 rounded-full ${
                                f.estaMuerto ? 'bg-red-500' : f.esDegradado ? 'bg-amber-500' : f.error ? 'bg-orange-500' : 'bg-emerald-500'
                              }`} />
                              <span className="text-[10px] font-medium text-foreground truncate">{f.nombre}</span>
                              <Badge variant="outline" className="text-[8px] px-1 py-0 h-4">{f.frecuenciaLabel}</Badge>
                            </div>
                            <div className="text-[9px] text-muted-foreground">
                              {f.ultimoCheckHace !== 'nunca' ? `Check: ${f.ultimoCheckHace}` : 'Sin checks'}
                              {f.ultimoCambioHace !== 'nunca' && ` · Cambio: ${f.ultimoCambioHace}`}
                              {f.error && <span className="text-orange-600 dark:text-orange-400"> · {f.error}</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 text-[9px] text-muted-foreground shrink-0">
                            {f.responseTime > 0 && <span>{f.responseTime}ms</span>}
                            {f.totalCambios}/{f.totalChecks}
                          </div>
                        </div>
                      ))}
                      {presente.fuentes.length > 10 && (
                        <p className="text-[9px] text-muted-foreground text-center">+{presente.fuentes.length - 10} fuentes más</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-[10px] text-muted-foreground">No hay fuentes configuradas</p>
                )}

                {/* Actions */}
                <div className="flex flex-wrap gap-1.5 border-t border-border/50 pt-2">
                  <Button variant="outline" size="sm" className="text-[10px] gap-1 h-7 px-2"
                    disabled={actionLoading === 'worker'} onClick={toggleWorker}>
                    {actionLoading === 'worker' ? <Loader2 className="h-3 w-3 animate-spin" /> :
                      workerRunning ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                    {workerRunning ? 'Pausar Worker' : 'Reanudar Worker'}
                  </Button>
                  <Button variant="outline" size="sm" className="text-[10px] gap-1 h-7 px-2"
                    disabled={actionLoading === 'reschedule'} onClick={rescheduleTasks}>
                    {actionLoading === 'reschedule' ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                    Reprogramar Tareas
                  </Button>
                  <Button variant="outline" size="sm" className="text-[10px] gap-1 h-7 px-2"
                    disabled={actionLoading === 'force_check'} onClick={forceCheckAll}>
                    {actionLoading === 'force_check' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
                    Forzar Check Ahora
                  </Button>
                  <Button variant="outline" size="sm" className="text-[10px] gap-1 h-7 px-2"
                    disabled={actionLoading === 'reclaim'} onClick={reclaimOrphans}>
                    <Wrench className="h-3 w-3" /> Recuperar Huerfanos
                  </Button>
                </div>
              </div>
            )}

            {/* ═══ FUTURO ═══ */}
            {section === 'futuro' && (
              <div className="space-y-3">
                {/* Próximos checks de fuentes */}
                {futuro.proximosChecks.length > 0 ? (
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                      <Radio className="h-3 w-3 inline mr-1 text-sky-500" />Próximos checks de fuentes
                    </p>
                    <div className="space-y-1">
                      {futuro.proximosChecks.map((c, i) => (
                        <div key={c.medioId}
                          className={`flex items-center justify-between gap-2 p-2 rounded-lg border ${
                            i === 0 ? 'bg-sky-500/5 border-sky-500/20' : 'bg-muted/20 border-border/30'
                          }`}>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className={`text-[10px] font-medium text-foreground truncate ${
                                c.esDegradado ? 'text-amber-600 dark:text-amber-400' : ''
                              }`}>{c.nombre}</span>
                              <Badge variant="outline" className="text-[8px] px-1 py-0 h-4">{c.tipoCheck}</Badge>
                              {c.esDegradado && <AlertTriangle className="h-3 w-3 text-amber-500" />}
                            </div>
                            <div className="text-[9px] text-muted-foreground">
                              {c.frecuenciaLabel} · Próximo: {String(c.proximoCheck).padStart(2, '0')}:00
                              · Horarios: [{c.horasOptimos.join(', ')}]
                            </div>
                          </div>
                          <span className={`text-[11px] font-mono shrink-0 ${
                            i === 0 ? 'text-sky-600 dark:text-sky-400' : 'text-muted-foreground'
                          }`}>
                            {i === 0 && c.minutosHasta < 30 ? 'AHORA' : formatMins(c.minutosHasta)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-[10px] text-muted-foreground">No hay fuentes programadas para check</p>
                )}

                {/* Boletines programados */}
                {futuro.boletines.length > 0 && (
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                      <FileText className="h-3 w-3 inline mr-1 text-amber-500" />Boletines programados
                    </p>
                    <div className="space-y-1">
                      {futuro.boletines.map((b, i) => (
                        <div key={b.tipo}
                          className={`flex items-center justify-between gap-2 p-2 rounded-lg border ${
                            i === 0 ? 'bg-amber-500/5 border-amber-500/20' : 'bg-muted/20 border-border/30'
                          }`}>
                          <div className="flex items-center gap-1.5">
                            <FileText className={`h-3 w-3 ${i === 0 ? 'text-amber-500' : 'text-muted-foreground'}`} />
                            <span className={`text-[10px] font-medium ${i === 0 ? 'text-foreground' : 'text-muted-foreground'}`}>
                              {b.tipo.replace(/_/g, ' ')}
                            </span>
                            <Badge variant="outline" className="text-[8px] px-1 py-0 h-4">
                              P{b.prioridad}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 text-[9px] shrink-0">
                            <span>{String(b.hora).padStart(2, '0')}:{String(b.minuto).padStart(2, '0')}</span>
                            <span className={i === 0 ? 'text-amber-600 dark:text-amber-400 font-medium' : 'text-muted-foreground'}>
                              {b.estado === 'en ventana' ? 'EN VENTANA' : `en ${formatMins(b.minutosHasta)}`}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Mantenimiento */}
                <div className="flex items-center justify-between p-2 rounded-lg bg-muted/20 border border-border/30">
                  <div className="flex items-center gap-1.5">
                    <Wrench className="h-3 w-3 text-stone-500" />
                    <span className="text-[10px] font-medium">Mantenimiento automático</span>
                  </div>
                  <div className="flex items-center gap-2 text-[9px] text-muted-foreground">
                    <span>04:00</span>
                    <Badge variant="outline" className="text-[8px] px-1 py-0 h-4">{futuro.mantenimiento.estado}</Badge>
                  </div>
                </div>

                {/* Entregas programadas */}
                {futuro.entregasProgramadas.length > 0 && (
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                      <Send className="h-3 w-3 inline mr-1 text-teal-500" />Entregas programadas
                    </p>
                    <div className="space-y-1">
                      {futuro.entregasProgramadas.map(e => (
                        <div key={e.id} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-muted/20 border border-border/30">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-medium text-foreground truncate">
                                {e.tipoBoletin.replace(/_/g, ' ')}
                              </span>
                              <span className="text-[9px] text-muted-foreground">{e.clienteNombre}</span>
                            </div>
                            <div className="text-[9px] text-muted-foreground">{e.canal}</div>
                          </div>
                          <div className="text-[9px] text-muted-foreground shrink-0">
                            {e.minutosHasta !== null ? `en ${formatMins(e.minutosHasta)}` : 'Sin fecha'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Cola pendiente */}
                {futuro.colaPendiente.length > 0 && (
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                      <Layers className="h-3 w-3 inline mr-1" />Cola de jobs (próximos a ejecutar)
                    </p>
                    <div className="space-y-1">
                      {futuro.colaPendiente.map(j => (
                        <div key={j.id} className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-muted/20 border border-border/30">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className={`inline-block h-1.5 w-1.5 rounded-full ${PRIORIDAD_COLORS[j.prioridad] || 'bg-gray-400'}`} />
                              <span className={`text-[10px] font-medium ${JOB_TYPE_COLORS[j.tipo] || 'text-foreground'}`}>
                                {JOB_TYPE_LABELS[j.tipo] || j.tipo}
                              </span>
                              {j.fuente && <span className="text-[9px] text-muted-foreground truncate max-w-[100px]">{j.fuente}</span>}
                            </div>
                          </div>
                          <span className="text-[9px] text-muted-foreground">{j.hace}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Scheduler tasks */}
                {presente.scheduler.tasks.length > 0 && (
                  <div className="border-t border-border/50 pt-2">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                      Tareas del scheduler ({presente.scheduler.tasks.length})
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                      {presente.scheduler.tasks.map((t, i) => (
                        <div key={i} className="flex items-center gap-2 p-1.5 rounded-md bg-muted/20">
                          <PulseDot active={presente.scheduler.running} />
                          <span className="text-[10px] text-foreground truncate flex-1">{t.humana}</span>
                          <span className="text-[9px] text-muted-foreground font-mono">{t.expresion}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
