'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, Loader2, Inbox, CheckCircle2, XCircle, Clock, Zap } from 'lucide-react';
import { fetchWithTimeout } from '@/lib/fetch-utils';
import { usePolling } from '../hooks/usePolling';
import { CollapsibleWidget } from '../CollapsibleWidget';
import type { WidgetStatus } from '../CollapsibleWidget';
import { timeAgo } from './time-helpers';

// ─── Types ────────────────────────────────────────────────────

interface JobRow {
  id: string;
  tipo: string;
  estado: string;
  prioridad: number;
  intentos: number;
  maxIntentos: number;
  duracionSegundos: number | null;
  fechaCreacion: string;
  error: string | null;
}

interface JobsSummaryData {
  timestamp: string;
  completadosHoy: number;
  fallidos24h: number;
  enProgreso: number;
  pendientes: number;
  cancelados: number;
  jobsByType: Record<string, number>;
  ultimos: JobRow[];
}

interface JobsWidgetProps {
  onNavigate: (viewId: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────

function deriveStatus(data: JobsSummaryData | null, loading: boolean): WidgetStatus {
  if (loading || !data) return 'loading';
  if (data.fallidos24h > 5) return 'error';
  if (data.fallidos24h > 2) return 'warn';
  if (data.completadosHoy === 0 && data.enProgreso === 0) return 'idle';
  return 'ok';
}

const ESTADO_STYLES: Record<string, string> = {
  completado: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  fallido: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  en_progreso: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  pendiente: 'bg-slate-100 text-slate-800 dark:bg-slate-900/40 dark:text-slate-300',
  cancelado: 'bg-zinc-100 text-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-300',
};

const ESTADO_ICONS: Record<string, React.ReactNode> = {
  completado: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />,
  fallido: <XCircle className="h-3.5 w-3.5 text-red-500" />,
  en_progreso: <Zap className="h-3.5 w-3.5 text-blue-500 animate-pulse" />,
  pendiente: <Clock className="h-3.5 w-3.5 text-muted-foreground" />,
  cancelado: <XCircle className="h-3.5 w-3.5 text-zinc-400" />,
};

const TIPO_LABELS: Record<string, string> = {
  scrape_fuente: 'Scrape',
  capture_indicador: 'Indicador',
  generar_boletin: 'Boletin',
  enviar_entrega: 'Entrega',
  check_fuente: 'Check',
  check_indicador: 'Check Ind.',
  verificar_enlaces: 'Verif.',
  mantenimiento: 'Manto.',
};

// ─── Component ────────────────────────────────────────────────

export function JobsWidget({ onNavigate }: JobsWidgetProps) {
  const [data, setData] = useState<JobsSummaryData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetchWithTimeout('/api/dashboard/jobs-summary', { timeoutMs: 10_000 });
      if (res.ok) {
        const json = await res.json();
        setData(json);
        setLoading(false);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);
  usePolling(fetchJobs, 15_000);

  const status = deriveStatus(data, loading);
  const ultimos = data?.ultimos ?? [];

  return (
    <CollapsibleWidget
      id="widget-jobs"
      title="Jobs / Cola de Trabajo"
      icon={Activity}
      status={status}
      badge={data ? `${data.completadosHoy} hoy` : undefined}
      badgeLabel="completados"
      targetView="jobs"
      onNavigate={onNavigate}
      mode="section"
    >
      <Card className="border">
        <CardContent className="p-4 space-y-3">
          {/* Status counters */}
          {data && (
            <div className="grid grid-cols-5 gap-2">
              <div className="flex flex-col items-center py-1.5 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{data.completadosHoy}</span>
                <span className="text-[8px] text-muted-foreground">Completados</span>
              </div>
              <div className="flex flex-col items-center py-1.5 rounded-lg bg-red-500/5 border border-red-500/20">
                <span className="text-sm font-bold text-red-600 dark:text-red-400">{data.fallidos24h}</span>
                <span className="text-[8px] text-muted-foreground">Fallidos 24h</span>
              </div>
              <div className="flex flex-col items-center py-1.5 rounded-lg bg-blue-500/5 border border-blue-500/20">
                <Zap className="h-3.5 w-3.5 text-blue-500 mb-0.5" />
                <span className="text-sm font-bold text-blue-600 dark:text-blue-400">{data.enProgreso}</span>
                <span className="text-[8px] text-muted-foreground">En progreso</span>
              </div>
              <div className="flex flex-col items-center py-1.5 rounded-lg bg-slate-500/5 border border-slate-500/20">
                <Clock className="h-3.5 w-3.5 text-muted-foreground mb-0.5" />
                <span className="text-sm font-bold text-slate-600 dark:text-slate-400">{data.pendientes}</span>
                <span className="text-[8px] text-muted-foreground">Pendientes</span>
              </div>
              <div className="flex flex-col items-center py-1.5 rounded-lg bg-zinc-500/5 border border-zinc-500/20">
                <XCircle className="h-3.5 w-3.5 text-zinc-400 mb-0.5" />
                <span className="text-sm font-bold text-zinc-600 dark:text-zinc-400">{data.cancelados}</span>
                <span className="text-[8px] text-muted-foreground">Cancelados</span>
              </div>
            </div>
          )}

          {/* Job type distribution */}
          {data && Object.keys(data.jobsByType).length > 0 && (
            <div className="flex gap-1.5 flex-wrap">
              {Object.entries(data.jobsByType).map(([tipo, count]) => (
                <Badge key={tipo} variant="secondary" className="text-[9px] px-2 py-0.5 h-4 bg-slate-100 text-slate-700 dark:bg-slate-900/40 dark:text-slate-300">
                  {TIPO_LABELS[tipo] || tipo}: {count}
                </Badge>
              ))}
            </div>
          )}

          {/* Recent jobs */}
          {ultimos.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                Ultimos 10 jobs
              </p>
              <div className="space-y-0.5">
                {ultimos.map((j) => (
                  <div
                    key={j.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/30 transition-colors"
                  >
                    {/* Status icon */}
                    {ESTADO_ICONS[j.estado] || <Clock className="h-3.5 w-3.5 text-muted-foreground" />}

                    {/* Type + metadata */}
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-medium text-foreground truncate leading-tight">
                        {TIPO_LABELS[j.tipo] || j.tipo}
                      </p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Badge variant="secondary" className={`text-[8px] px-1 py-0 h-3.5 ${ESTADO_STYLES[j.estado] || ''}`}>
                          {j.estado}
                        </Badge>
                        {j.duracionSegundos !== null && (
                          <span className="text-[8px] text-muted-foreground">
                            {j.duracionSegundos}s
                          </span>
                        )}
                        {j.error && (
                          <span className="text-[8px] text-red-500 truncate max-w-[80px]">
                            {j.error}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Time */}
                    <span className="text-[8px] text-muted-foreground shrink-0">
                      {timeAgo(j.fechaCreacion)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : !loading ? (
            <div className="py-6 text-center text-muted-foreground">
              <Inbox className="h-5 w-5 mx-auto mb-1.5 opacity-40" />
              <p className="text-xs">Sin jobs registrados</p>
              <p className="text-[10px] opacity-60 mt-0.5">
                Los jobs se crean cuando el worker ejecuta tareas
              </p>
            </div>
          ) : (
            <div className="py-6 flex items-center justify-center">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}
        </CardContent>
      </Card>
    </CollapsibleWidget>
  );
}
