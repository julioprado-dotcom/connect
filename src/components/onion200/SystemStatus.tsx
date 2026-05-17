'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { fetchWithTimeout } from '@/lib/fetch-utils';
import { Shield, Bot, Globe, Database, Zap, Calendar, Play, Square, Loader2 } from 'lucide-react';
import { PanelShell } from './VitalMonitor';

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

interface ProcessInfo {
  name: string;
  online: boolean;
  pid?: number | null;
  uptime?: number;
  jobsCompleted?: number;
  jobsFailed?: number;
  totalTasks?: number;
  totalScheduled?: number;
  lastJobTime?: string | null;
  heartbeatAge?: number | null;
}

interface ProcessesData {
  processes: {
    web: ProcessInfo;
    worker: ProcessInfo;
    scheduler: ProcessInfo;
  };
  pm2Status?: Array<Record<string, unknown>> | null;
  architecture: string;
}

interface Diagnosis {
  id: string;
  severity: 'ok' | 'warning' | 'critical';
  message: string;
  detail: string;
}

interface SystemHealth {
  healthScore: number;
  diagnoses: Diagnosis[];
  memoryUsage: { rss: number; heapUsed: number; heapLimit: number };
  dbSize: number;
  uptime: number;
  uptimeFormatted: string;
  nodeVersion: string;
  backendVitals: {
    worker: { running: boolean; uptime: string; jobsCompleted: number; jobsFailed: number; jobsPerHour: number };
    scheduler: { running: boolean; totalTasks: number };
  };
  environment: string;
  timestamp: string;
}

interface PipelineStatus {
  captura?: { status: string };
  clasificacion?: { status: string };
  produccion?: { status: string };
  distribucion?: { status: string };
  sistema?: { status: string };
}

// ═══════════════════════════════════════════════════════════════
// StatusOrb with toggle button
// ═══════════════════════════════════════════════════════════════

function ProcessOrb({
  online,
  label,
  detail,
  togglable,
  toggleEndpoint,
  onToggle,
  loading,
}: {
  online: boolean;
  label: string;
  detail?: string;
  togglable?: boolean;
  toggleEndpoint?: string;
  onToggle?: () => void;
  loading?: boolean;
}) {
  const status = online ? 'ok' : 'error';
  const color = online ? '#10b981' : '#f43f5e';
  const statusLabel = online ? 'En línea' : 'Desconectado';
  const glowSize = online ? 6 : 12;

  return (
    <div className="flex items-center gap-3 py-1.5">
      {/* Orb */}
      <div className="relative flex-shrink-0">
        <div
          className="w-3 h-3 rounded-full"
          style={{
            backgroundColor: color,
            boxShadow: `0 0 ${glowSize}px ${color}60, 0 0 ${glowSize * 2}px ${color}20`,
          }}
        />
        {online && (
          <div
            className="absolute inset-0 w-3 h-3 rounded-full animate-ping"
            style={{ backgroundColor: `${color}30` }}
          />
        )}
      </div>
      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 font-mono">
            {label}
          </span>
          <span
            className="text-[9px] font-bold uppercase font-mono px-1.5 py-0.5 rounded"
            style={{
              color,
              backgroundColor: `${color}10`,
              border: `1px solid ${color}20`,
            }}
          >
            {statusLabel}
          </span>
        </div>
        {detail && (
          <p className="text-[9px] font-mono text-slate-600 truncate mt-0.5">
            {detail}
          </p>
        )}
      </div>
      {/* Toggle Button */}
      {togglable && (
        <button
          onClick={onToggle}
          disabled={loading}
          className="flex items-center gap-1 px-2 py-1 rounded text-[9px] font-mono font-bold uppercase tracking-wider transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            color: online ? '#f43f5e' : '#10b981',
            backgroundColor: online ? 'rgba(244,63,94,0.08)' : 'rgba(16,185,129,0.08)',
            border: `1px solid ${online ? 'rgba(244,63,94,0.2)' : 'rgba(16,185,129,0.2)'}`,
          }}
          title={online ? `Detener ${label}` : `Activar ${label}`}
        >
          {loading ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : online ? (
            <Square className="w-3 h-3" />
          ) : (
            <Play className="w-3 h-3" />
          )}
          <span>{online ? 'DETENER' : 'ACTIVAR'}</span>
        </button>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// HealthScore gauge
// ═══════════════════════════════════════════════════════════════

function HealthGauge({ score }: { score: number }) {
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? '#10b981' : score >= 50 ? '#f59e0b' : '#f43f5e';

  return (
    <div className="flex items-center gap-4 py-2">
      <div className="relative flex-shrink-0">
        <svg width="68" height="68" viewBox="0 0 68 68">
          <circle cx="34" cy="34" r={radius} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="4" />
          <circle
            cx="34" cy="34" r={radius} fill="none" stroke={color} strokeWidth="4"
            strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}
            transform="rotate(-90 34 34)"
            style={{ filter: `drop-shadow(0 0 6px ${color}60)`, transition: 'stroke-dashoffset 1s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-bold font-mono tabular-nums" style={{ color }}>{score}</span>
        </div>
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 font-mono">Índice de Salud</p>
        <p className="text-[9px] font-mono text-slate-600 mt-0.5">
          {score >= 80 ? 'Todos los sistemas operativos' : score >= 50 ? 'Alertas activas' : 'Problemas criticos'}
        </p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Pipeline StatusOrb (sin toggle)
// ═══════════════════════════════════════════════════════════════

function PipelineOrb({
  status,
  label,
}: {
  status: 'ok' | 'warning' | 'error' | 'idle' | 'warn' | 'pending' | string;
  label: string;
}) {
  const statusKey = status === 'warn' ? 'warning' : (status as 'ok' | 'warning' | 'error' | 'idle') || 'idle';
  const colorMap = { ok: '#10b981', warning: '#f59e0b', error: '#f43f5e', idle: '#64748b', pending: '#06b6d4' };
  const labelMap = { ok: 'En línea', warning: 'Degradado', error: 'Desconectado', idle: 'Inactivo', pending: 'Pendiente' };
  const color = colorMap[statusKey] || colorMap.idle;
  const glowSize = statusKey === 'error' ? 12 : statusKey === 'warning' ? 8 : 6;

  return (
    <div className="flex items-center gap-3 py-1">
      <div className="relative flex-shrink-0">
        <div
          className="w-2.5 h-2.5 rounded-full"
          style={{
            backgroundColor: color,
            boxShadow: `0 0 ${glowSize}px ${color}60, 0 0 ${glowSize * 2}px ${color}20`,
          }}
        />
        {statusKey === 'ok' && (
          <div className="absolute inset-0 w-2.5 h-2.5 rounded-full animate-ping" style={{ backgroundColor: `${color}30` }} />
        )}
      </div>
      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 font-mono">{label}</span>
      <span
        className="text-[9px] font-bold uppercase font-mono px-1.5 py-0.5 rounded"
        style={{ color, backgroundColor: `${color}10`, border: `1px solid ${color}20` }}
      >
        {labelMap[statusKey] || status}
      </span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SystemStatus — Main component (updated for multi-process)
// ═══════════════════════════════════════════════════════════════

export function SystemStatus() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [processes, setProcesses] = useState<ProcessesData | null>(null);
  const [pipeline, setPipeline] = useState<PipelineStatus | null>(null);
  const [toggleLoading, setToggleLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(null);

  const fetchData = useCallback(async () => {
    try {
      const [healthRes, processesRes, pipelineRes] = await Promise.all([
        fetchWithTimeout('/api/dashboard/system', { timeoutMs: 6000 }),
        fetchWithTimeout('/api/system/processes', { timeoutMs: 5000 }),
        fetchWithTimeout('/api/dashboard/indicadores-summary', { timeoutMs: 8000 }),
      ]);

      if (healthRes.ok) setHealth(await healthRes.json());
      if (processesRes.ok) setProcesses(await processesRes.json());
      if (pipelineRes.ok) setPipeline(await pipelineRes.json());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error de conexion');
    }
  }, []);

  useEffect(() => {
    fetchData();
    intervalRef.current = setInterval(fetchData, 15000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchData]);

  const toggleProcess = async (endpoint: string) => {
    setToggleLoading(endpoint);
    try {
      const res = await fetch(endpoint, { method: 'POST' });
      const data = await res.json();
      console.log(`[SystemStatus] Toggle ${endpoint}:`, data);
      // Re-fetch después de toggle para actualizar UI
      setTimeout(fetchData, 2000);
    } catch (e) {
      console.error(`[SystemStatus] Toggle error:`, e);
    } finally {
      setToggleLoading(null);
    }
  };

  // Usar datos de procesos (heartbeat) como fuente primaria para Worker/Scheduler
  // y datos de health (diagnósticos) para infraestructura
  const workerOnline = processes?.processes?.worker?.online ?? health?.backendVitals?.worker?.running ?? false;
  const schedulerOnline = processes?.processes?.scheduler?.online ?? health?.backendVitals?.scheduler?.running ?? false;

  const workerInfo = processes?.processes?.worker;
  const schedulerInfo = processes?.processes?.scheduler;
  const workerHealth = health?.backendVitals?.worker;
  const schedulerHealth = health?.backendVitals?.scheduler;

  // Calculate Health Score from real process states
  const score = (() => {
    if (!processes) return health?.healthScore ?? 0;
    let s = 100;
    if (!processes.processes.worker.online) s -= 30;
    if (!processes.processes.scheduler.online) s -= 20;
    if (workerInfo && (workerInfo.jobsFailed ?? 0) > 5) s -= 10;
    const diag = health?.diagnoses ?? [];
    const realDiag = diag.filter(d => !['dev-overhead', 'auth'].includes(d.id));
    s -= realDiag.filter(d => d.severity === 'critical').length * 10;
    s -= realDiag.filter(d => d.severity === 'warning').length * 5;
    return Math.max(0, s);
  })();

  const getDiagStatus = (id: string): 'ok' | 'warning' | 'error' | 'idle' => {
    if (!health) return 'idle';
    const diag = health.diagnoses.find(d => d.id === id);
    if (!diag) return 'ok';
    if (diag.severity === 'critical') return 'error';
    if (diag.severity === 'warning') return 'warning';
    return 'ok';
  };

  return (
    <PanelShell title="Estado del Sistema" icon={<Shield className="w-4 h-4" />}>
      {error && !health && !processes ? (
        <div className="flex items-center gap-2 py-4 text-red-400/70 text-xs font-mono">
          <span className="w-2 h-2 rounded-full bg-red-500" />
          Sin conexion — {error}
        </div>
      ) : (
        <div className="space-y-3">
          {/* Health Score */}
          <HealthGauge score={score} />

          {/* Architecture badge */}
          {processes && (
            <div className="flex items-center justify-center gap-2 py-1">
              <span className="text-[8px] font-mono text-slate-600 uppercase tracking-widest">
                {processes.architecture === 'multi-process' ? 'Multi-Proceso PM2' : 'Monolítico'}
              </span>
            </div>
          )}

          {/* Separator */}
          <div className="h-[1px]" style={{ background: 'linear-gradient(90deg, transparent, rgba(6,182,212,0.15), transparent)' }} />

          {/* ── PROCESOS PM2 ── */}
          <p className="text-[9px] font-bold uppercase tracking-widest text-cyan-500/60 font-mono px-1">
            Procesos
          </p>

          {/* Web */}
          <ProcessOrb
            online={processes?.processes?.web?.online ?? true}
            label="Web"
            detail={processes?.processes?.web
              ? `PID ${processes.processes.web.pid} · ${processes.processes.web.memoryMB ?? 0} MB`
              : 'Servidor web'}
          />

          {/* Worker (togglable) */}
          <ProcessOrb
            online={workerOnline}
            label="Trabajador"
            detail={workerInfo
              ? `${workerInfo.jobsCompleted ?? 0} completados · ${workerInfo.jobsFailed ?? 0} fallidos${workerInfo.heartbeatAge != null ? ` · HB ${workerInfo.heartbeatAge}s` : ''}`
              : workerHealth
                ? `${workerHealth.jobsCompleted} completados · ${workerHealth.jobsPerHour}/h`
                : 'Sin datos'}
            togglable
            toggleEndpoint="/api/system/worker/toggle"
            onToggle={() => toggleProcess('/api/system/worker/toggle')}
            loading={toggleLoading === '/api/system/worker/toggle'}
          />

          {/* Scheduler (togglable) */}
          <ProcessOrb
            online={schedulerOnline}
            label="Planificador"
            detail={schedulerInfo
              ? `${schedulerInfo.totalTasks ?? 0} tareas · ${schedulerInfo.totalScheduled ?? 0} encolados${schedulerInfo.heartbeatAge != null ? ` · HB ${schedulerInfo.heartbeatAge}s` : ''}`
              : schedulerHealth
                ? schedulerHealth.running ? `${schedulerHealth.totalTasks} tareas` : 'Detenido'
                : 'Sin datos'}
            togglable
            toggleEndpoint="/api/system/scheduler/toggle"
            onToggle={() => toggleProcess('/api/system/scheduler/toggle')}
            loading={toggleLoading === '/api/system/scheduler/toggle'}
          />

          {/* Separator */}
          <div className="h-[1px]" style={{ background: 'linear-gradient(90deg, transparent, rgba(6,182,212,0.08), transparent)' }} />

          {/* ── PIPELINE ── */}
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-700 font-mono px-1">
            Flujo de Proceso
          </p>
          <PipelineOrb status={pipeline?.captura?.status ?? 'idle'} label="Captura" />
          <PipelineOrb status={pipeline?.clasificacion?.status ?? 'idle'} label="Clasificacion" />
          <PipelineOrb status={pipeline?.produccion?.status ?? 'idle'} label="Produccion" />
          <PipelineOrb status={pipeline?.distribucion?.status ?? 'idle'} label="Distribucion" />

          {/* Separator */}
          <div className="h-[1px]" style={{ background: 'linear-gradient(90deg, transparent, rgba(6,182,212,0.08), transparent)' }} />

          {/* ── INFRAESTRUCTURA ── */}
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-700 font-mono px-1">
            Infraestructura
          </p>
          <PipelineOrb status={getDiagStatus('memory')} label="Memoria" />
          <PipelineOrb status={getDiagStatus('database')} label="Base de Datos" />
          <PipelineOrb status={getDiagStatus('uptime')} label="Tiempo Activo" />

          {/* Environment badge */}
          {health && (
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800/60 px-1">
              <span className="text-[9px] font-mono text-slate-700">Entorno</span>
              <span
                className="text-[9px] font-bold font-mono px-1.5 py-0.5 rounded"
                style={{
                  color: health.environment === 'production' ? '#10b981' : '#f59e0b',
                  backgroundColor: health.environment === 'production' ? 'rgba(16,185,129,0.08)' : 'rgba(245,158,11,0.08)',
                  border: `1px solid ${health.environment === 'production' ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)'}`,
                }}
              >
                {health.environment}
              </span>
            </div>
          )}
        </div>
      )}
    </PanelShell>
  );
}
