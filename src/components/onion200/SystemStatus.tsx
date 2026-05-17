'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { fetchWithTimeout } from '@/lib/fetch-utils';
import { Shield, Bot, Globe, Database, Zap, Calendar } from 'lucide-react';
import { PanelShell } from './VitalMonitor';

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

interface Diagnosis {
  id: string;
  severity: 'ok' | 'warning' | 'critical';
  message: string;
  detail: string;
}

interface SystemHealth {
  healthScore: number;
  diagnoses: Diagnosis[];
  memoryUsage: {
    rss: number;
    heapUsed: number;
    heapLimit: number;
  };
  dbSize: number;
  uptime: number;
  uptimeFormatted: string;
  nodeVersion: string;
  backendVitals: {
    worker: {
      running: boolean;
      uptime: string;
      jobsCompleted: number;
      jobsFailed: number;
      jobsPerHour: number;
    };
    scheduler: {
      running: boolean;
      totalTasks: number;
    };
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
// Status Orb
// ═══════════════════════════════════════════════════════════════

function StatusOrb({
  status,
  label,
  detail,
}: {
  status: 'ok' | 'warning' | 'error' | 'idle' | 'pending';
  label: string;
  detail?: string;
}) {
  const colorMap = {
    ok: '#10b981',
    warning: '#f59e0b',
    error: '#f43f5e',
    idle: '#64748b',
    pending: '#06b6d4',
  };

  const labelMap = {
    ok: 'Online',
    warning: 'Degradado',
    error: 'Offline',
    idle: 'Inactivo',
    pending: 'Pendiente',
  };

  const color = colorMap[status] || colorMap.idle;
  const glowSize = status === 'error' ? 12 : status === 'warning' ? 8 : 6;

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
        {status === 'ok' && (
          <div
            className="absolute inset-0 w-3 h-3 rounded-full animate-ping"
            style={{ backgroundColor: `${color}30` }}
          />
        )}
      </div>
      {/* Info */}
      <div className="min-w-0">
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
            {labelMap[status] || status}
          </span>
        </div>
        {detail && (
          <p className="text-[9px] font-mono text-slate-600 truncate mt-0.5">
            {detail}
          </p>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// HealthScore gauge (circular)
// ═══════════════════════════════════════════════════════════════

function HealthGauge({ score }: { score: number }) {
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const color =
    score >= 80
      ? '#10b981'
      : score >= 50
        ? '#f59e0b'
        : '#f43f5e';

  return (
    <div className="flex items-center gap-4 py-2">
      <div className="relative flex-shrink-0">
        <svg width="68" height="68" viewBox="0 0 68 68">
          {/* Background circle */}
          <circle
            cx="34"
            cy="34"
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.04)"
            strokeWidth="4"
          />
          {/* Value arc */}
          <circle
            cx="34"
            cy="34"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            transform="rotate(-90 34 34)"
            style={{
              filter: `drop-shadow(0 0 6px ${color}60)`,
              transition: 'stroke-dashoffset 1s ease',
            }}
          />
        </svg>
        {/* Score text */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="text-lg font-bold font-mono tabular-nums"
            style={{ color }}
          >
            {score}
          </span>
        </div>
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 font-mono">
          Health Score
        </p>
        <p className="text-[9px] font-mono text-slate-600 mt-0.5">
          {score >= 80
            ? 'Todos los sistemas operativos'
            : score >= 50
              ? 'Alertas activas — revision recomendada'
              : 'Problemas criticos detectados'}
        </p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SystemStatus — Main component
// ═══════════════════════════════════════════════════════════════

export function SystemStatus() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [pipeline, setPipeline] = useState<PipelineStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(null);

  const fetchData = useCallback(async () => {
    try {
      const [healthRes, pipelineRes] = await Promise.all([
        fetchWithTimeout('/api/dashboard/system', { timeoutMs: 6000 }),
        fetchWithTimeout('/api/dashboard/indicadores-summary', {
          timeoutMs: 8000,
        }),
      ]);

      if (healthRes.ok) {
        const data = await healthRes.json();
        setHealth(data);
      }
      if (pipelineRes.ok) {
        const data = await pipelineRes.json();
        setPipeline(data);
      }
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error de conexion');
    }
  }, []);

  useEffect(() => {
    fetchData();
    intervalRef.current = setInterval(fetchData, 15000); // Poll every 15s
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchData]);

  const worker = health?.backendVitals?.worker;
  const scheduler = health?.backendVitals?.scheduler;

  // Determine overall statuses from diagnoses
  const getDiagStatus = (
    id: string
  ): 'ok' | 'warning' | 'error' | 'idle' => {
    if (!health) return 'idle';
    const diag = health.diagnoses.find((d) => d.id === id);
    if (!diag) return 'ok';
    if (diag.severity === 'critical') return 'error';
    if (diag.severity === 'warning') return 'warning';
    return 'ok';
  };

  return (
    <PanelShell
      title="System Status"
      icon={<Shield className="w-4 h-4" />}
    >
      {error && !health ? (
        <div className="flex items-center gap-2 py-4 text-red-400/70 text-xs font-mono">
          <span className="w-2 h-2 rounded-full bg-red-500" />
          Sin conexion — {error}
        </div>
      ) : (
        <div className="space-y-3">
          {/* Health Score */}
          {health && <HealthGauge score={health.healthScore} />}

          {/* Separator */}
          <div
            className="h-[1px]"
            style={{
              background:
                'linear-gradient(90deg, transparent, rgba(6,182,212,0.15), transparent)',
            }}
          />

          {/* Core systems */}
          <StatusOrb
            status={
              worker?.running
                ? worker.jobsFailed > 0
                  ? 'warning'
                  : 'ok'
                : 'error'
            }
            label="Worker"
            detail={
              worker
                ? `${worker.jobsCompleted} completados · ${worker.jobsPerHour}/h`
                : 'Esperando señal...'
            }
          />
          <StatusOrb
            status={
              scheduler?.running
                ? scheduler.totalTasks > 0
                  ? 'ok'
                  : 'idle'
                : 'error'
            }
            label="Scheduler"
            detail={
              scheduler
                ? scheduler.running
                  ? `${scheduler.totalTasks} tareas programadas`
                  : 'Detenido'
                : 'Esperando señal...'
            }
          />

          {/* Separator */}
          <div
            className="h-[1px]"
            style={{
              background:
                'linear-gradient(90deg, transparent, rgba(6,182,212,0.08), transparent)',
            }}
          />

          {/* Pipeline stages */}
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-700 font-mono px-1">
            Pipeline
          </p>
          <StatusOrb
            status={(pipeline?.captura?.status as 'ok' | 'warning' | 'error' | 'idle') || 'idle'}
            label="Captura"
            icon={<Globe className="w-3 h-3" />}
          />
          <StatusOrb
            status={(pipeline?.clasificacion?.status as 'ok' | 'warning' | 'error' | 'idle') || 'idle'}
            label="Clasificacion"
            icon={<Bot className="w-3 h-3" />}
          />
          <StatusOrb
            status={(pipeline?.produccion?.status as 'ok' | 'warning' | 'error' | 'idle') || 'idle'}
            label="Produccion"
            icon={<Zap className="w-3 h-3" />}
          />
          <StatusOrb
            status={(pipeline?.distribucion?.status as 'ok' | 'warning' | 'error' | 'idle') || 'idle'}
            label="Distribucion"
            icon={<Calendar className="w-3 h-3" />}
          />

          {/* Separator */}
          <div
            className="h-[1px]"
            style={{
              background:
                'linear-gradient(90deg, transparent, rgba(6,182,212,0.08), transparent)',
            }}
          />

          {/* Infrastructure */}
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-700 font-mono px-1">
            Infraestructura
          </p>
          <StatusOrb
            status={getDiagStatus('memory')}
            label="Memoria"
            detail={
              health
                ? `Heap: ${health.memoryUsage.heapUsed}/${health.memoryUsage.heapLimit} MB`
                : undefined
            }
          />
          <StatusOrb
            status={getDiagStatus('database')}
            label="Base de Datos"
            detail={
              health ? `${health.dbSize} MB (SQLite)` : undefined
            }
          />
          <StatusOrb
            status={getDiagStatus('uptime')}
            label="Uptime"
            detail={health?.uptimeFormatted}
          />

          {/* Environment badge */}
          {health && (
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800/60 px-1">
              <span className="text-[9px] font-mono text-slate-700">
                Entorno
              </span>
              <span
                className="text-[9px] font-bold font-mono px-1.5 py-0.5 rounded"
                style={{
                  color:
                    health.environment === 'production'
                      ? '#10b981'
                      : '#f59e0b',
                  backgroundColor:
                    health.environment === 'production'
                      ? 'rgba(16,185,129,0.08)'
                      : 'rgba(245,158,11,0.08)',
                  border: `1px solid ${
                    health.environment === 'production'
                      ? 'rgba(16,185,129,0.2)'
                      : 'rgba(245,158,11,0.2)'
                  }`,
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
