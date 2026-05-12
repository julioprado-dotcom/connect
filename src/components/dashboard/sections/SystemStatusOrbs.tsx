'use client';

import React, { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import {
  Activity, Cpu, Database, Clock, Send, Sparkles,
  CheckCircle2, XCircle, AlertTriangle,
} from 'lucide-react';
import { StatusOrb } from '@/components/dashboard/gauges/StatusOrb';
import type { StatusLevel } from '@/components/dashboard/gauges/StatusOrb';
import type { SystemMetrics } from '@/types/dashboard';

// ─── AI Health type (used only here) ──────────────────────────

export interface AiHealthData {
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

// ─── Props ────────────────────────────────────────────────────

interface SystemStatusOrbsProps {
  sysMetrics: SystemMetrics | null;
  entregasHoy: EntregasHoyData | null;
  aiHealth: AiHealthData | null;
  mcResumen: {
    inicializado: boolean;
    version: number | null;
    vacios: string[];
  } | null;
  setActiveView: (viewId: string) => void;
}

interface EntregasHoyData {
  total: number;
  enviadas: number;
  pendientes: number;
  fallidas: number;
}

// ─── Component ────────────────────────────────────────────────

export function SystemStatusOrbs({ sysMetrics, entregasHoy, aiHealth, mcResumen, setActiveView }: SystemStatusOrbsProps) {
  // ─── Health diagnostics ────────────────────────────────
  const healthScore = sysMetrics?.healthScore ?? null;
  const diagnoses = sysMetrics?.diagnoses ?? [];
  const criticals = diagnoses.filter(d => d.severity === 'critical');
  const warnings = diagnoses.filter(d => d.severity === 'warning');
  const nonTrivialWarnings = warnings.filter(d => d.id !== 'dev-overhead' && d.id !== 'auth');

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
  }, [sysMetrics]);

  const uptimeLevel: StatusLevel = useMemo(() => {
    if (!sysMetrics?.uptime) return 'ok';
    if (sysMetrics.uptime < 300) return 'critical';
    if (sysMetrics.uptime < 600) return 'warning';
    return 'ok';
  }, [sysMetrics]);

  const dbLevel: StatusLevel = useMemo(() => {
    if (!sysMetrics?.dbSize) return 'ok';
    return sysMetrics.dbSize > 500 ? 'warning' : 'ok';
  }, [sysMetrics]);

  const entregasLevel: StatusLevel = useMemo(() => {
    if (!entregasHoy) return 'ok';
    if (entregasHoy.fallidas > 0) return 'critical';
    if (entregasHoy.pendientes > 0) return 'warning';
    return 'ok';
  }, [entregasHoy]);

  // AI diagnostic message (for diagnostics panel)
  const hasMcWarning = useMemo(() => {
    if (!mcResumen) return false;
    if (!mcResumen.inicializado) return true;
    return (mcResumen.vacios && mcResumen.vacios.length > 0) ?? false;
  }, [mcResumen]);

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

  // StatusOrb display values
  const memoryPct = useMemo(() => {
    if (!sysMetrics?.memoryUsage) return '--';
    return `${Math.round((sysMetrics.memoryUsage.heapUsed / Math.max(1, sysMetrics.memoryUsage.heapLimit)) * 100)}%`;
  }, [sysMetrics]);

  const dbSizeStr = useMemo(() => {
    return sysMetrics?.dbSize ? `${sysMetrics.dbSize} MB` : '--';
  }, [sysMetrics]);

  const uptimeStr = useMemo(() => {
    return sysMetrics?.uptimeFormatted || '--';
  }, [sysMetrics]);

  return (
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
                    <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${mcResumen.vacios && mcResumen.vacios.length > 0 ? 'text-amber-600 bg-amber-50 dark:bg-amber-950/30' : 'text-muted-foreground bg-muted/50'}`}>
                      MC v{mcResumen.version}
                    </span>
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
              {/* Diagnóstico: Marco Conceptual con directrices vacías */}
              {mcResumen && !mcResumen.inicializado && (
                <div key="mc-not-configured" className="flex items-start gap-2">
                  <XCircle className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-red-600 dark:text-red-400">Marco Conceptual no configurado</p>
                    <p className="text-[9px] text-muted-foreground mt-0.5">Ir a Configuración &gt; Marco Conceptual para inicializar</p>
                  </div>
                </div>
              )}
              {mcResumen && mcResumen.inicializado && mcResumen.vacios && mcResumen.vacios.length > 0 && (
                <div key="mc-vacios" className="flex items-start gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-amber-600 dark:text-amber-400">Marco Conceptual: directrices sin contenido</p>
                    <p className="text-[9px] text-amber-700/70 dark:text-amber-400/70 mt-0.5">
                      Vacíos: {mcResumen.vacios.join(', ')}
                    </p>
                    <p className="text-[9px] text-muted-foreground mt-0.5">
                      Ir a Configuración &gt; Marco Conceptual para completar
                    </p>
                  </div>
                </div>
              )}
              {criticals.length === 0 && warnings.length === 0 && !aiDiagnostic && !hasMcWarning && (
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
  );
}
