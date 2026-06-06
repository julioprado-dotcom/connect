'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Settings, Loader2, CheckCircle2, AlertTriangle, Clock, Cpu, Gauge, AlertCircle, Database } from 'lucide-react';
import { fetchWithTimeout } from '@/lib/fetch-utils';
import { usePolling } from '../hooks/usePolling';
import { CollapsibleWidget } from '../CollapsibleWidget';
import type { WidgetStatus } from '../CollapsibleWidget';

// ─── Types ────────────────────────────────────────────────────

interface SystemSummaryData {
  timestamp: string;
  uptimeFormatted: string;
  healthScore: number;
  memoryUsage: number | null;
  nodeVersion: string | null;
  databaseSize: string | null;
  params: {
    label: string;
    value: string;
    status: 'ok' | 'warn';
  }[];
}

interface ConfigWidgetProps {
  onNavigate: (viewId: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────

function deriveStatus(data: SystemSummaryData | null, loading: boolean): WidgetStatus {
  if (loading || !data) return 'loading';
  if (data.healthScore < 50) return 'error';
  if (data.healthScore < 80) return 'warn';
  return 'ok';
}

// ─── Component ────────────────────────────────────────────────

export function ConfigWidget({ onNavigate }: ConfigWidgetProps) {
  const [data, setData] = useState<SystemSummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchConfig = useCallback(async () => {
    try {
      // Get system metrics
      const res = await fetchWithTimeout('/api/dashboard/system', { timeoutMs: 12_000 });
      if (res.ok) {
        const sys = await res.json();

        const params: { label: string; value: string; status: 'ok' | 'warn' }[] = [
          {
            label: 'Frecuencia scraping base',
            value: '6h (adaptativa)',
            status: 'ok' as const,
          },
          {
            label: 'Max jobs concurrentes',
            value: '1 (secuencial)',
            status: 'ok' as const,
          },
          {
            label: 'Warmup delay',
            value: '120s',
            status: 'ok' as const,
          },
          {
            label: 'Umbral alerta degradacion',
            value: '7 checks sin cambio',
            status: 'ok' as const,
          },
          {
            label: 'Max reintentos job',
            value: '3',
            status: 'ok' as const,
          },
          {
            label: 'Retencion logs captura',
            value: '30 dias',
            status: 'ok' as const,
          },
          {
            label: 'Frecuencia polling dashboard',
            value: '15-60s',
            status: 'ok' as const,
          },
          {
            label: 'Auto-recovery intervalo',
            value: '6h / 100 ciclos',
            status: 'ok' as const,
          },
        ];

        const warnings = (sys.diagnoses || []).filter(
          (d: { severity: string }) => d.severity === 'warning' || d.severity === 'critical',
        );

        // Add dynamic warnings
        if (warnings.length > 0) {
          params.unshift({
            label: 'Advertencias activas',
            value: `${warnings.length} diagnosticos`,
            status: 'warn' as const,
          });
        }

        setData({
          timestamp: sys.timestamp,
          uptimeFormatted: sys.uptimeFormatted || '--',
          healthScore: sys.healthScore ?? 0,
          memoryUsage: sys.memoryUsageMB ?? null,
          nodeVersion: sys.nodeVersion ?? null,
          databaseSize: sys.databaseSize ?? null,
          params,
        });
        setLoading(false);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);
  usePolling(fetchConfig, 60_000);

  const status = deriveStatus(data, loading);

  return (
    <CollapsibleWidget
      id="widget-configuracion"
      title="Configuracion del Sistema"
      icon={Settings}
      status={status}
      badge={data ? `${data.healthScore}%` : undefined}
      badgeLabel="health"
      targetView="configuracion"
      onNavigate={onNavigate}
      mode="section"
    >
      <Card className="border">
        <CardContent className="p-4 space-y-3">
          {/* System overview */}
          {data && (
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              <div className="flex flex-col items-center py-2 rounded-lg bg-muted/40 border border-border/50">
                <Gauge className="h-4 w-4 text-primary mb-1" />
                <span className="text-lg font-bold text-foreground">{data.healthScore}%</span>
                <span className="text-[9px] text-muted-foreground">Health</span>
              </div>
              <div className="flex flex-col items-center py-2 rounded-lg bg-sky-500/5 border border-sky-500/20">
                <Clock className="h-4 w-4 text-sky-500 mb-1" />
                <span className="text-xs font-bold text-sky-600 dark:text-sky-400">{data.uptimeFormatted}</span>
                <span className="text-[9px] text-muted-foreground">Uptime</span>
              </div>
              <div className="flex flex-col items-center py-2 rounded-lg bg-violet-500/5 border border-violet-500/20">
                <Cpu className="h-4 w-4 text-violet-500 mb-1" />
                <span className="text-xs font-bold text-violet-600 dark:text-violet-400">
                  {data.memoryUsage ? `${data.memoryUsage}MB` : 'N/A'}
                </span>
                <span className="text-[9px] text-muted-foreground">RAM</span>
              </div>
              <div className="flex flex-col items-center py-2 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                <Settings className="h-4 w-4 text-emerald-500 mb-1" />
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                  {data.nodeVersion || 'N/A'}
                </span>
                <span className="text-[9px] text-muted-foreground">Node</span>
              </div>
              <div className="flex flex-col items-center py-2 rounded-lg bg-amber-500/5 border border-amber-500/20">
                <Database className="h-4 w-4 text-amber-500 mb-1" />
                <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                  {data.databaseSize || 'N/A'}
                </span>
                <span className="text-[9px] text-muted-foreground">DB</span>
              </div>
            </div>
          )}

          {/* Parameters table */}
          {data && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                Parametros del sistema
              </p>
              <div className="space-y-0.5">
                {data.params.map((p, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-muted/30 transition-colors"
                  >
                    {p.status === 'ok' ? (
                      <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                    ) : (
                      <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />
                    )}
                    <span className="text-[10px] text-muted-foreground flex-1 truncate">
                      {p.label}
                    </span>
                    <span className={`text-[10px] font-medium tabular-nums shrink-0 ${
                      p.status === 'ok' ? 'text-foreground' : 'text-amber-600 dark:text-amber-400'
                    }`}>
                      {p.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && !data && (
            <div className="py-6 text-center text-muted-foreground">
              <AlertCircle className="h-5 w-5 mx-auto mb-1.5 opacity-40 text-amber-500" />
              <p className="text-xs">Error al cargar datos del sistema</p>
              <p className="text-[10px] opacity-60 mt-0.5">
                Reintentara automaticamente
              </p>
            </div>
          )}

          {loading && !error && (
            <div className="py-6 flex items-center justify-center">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}
        </CardContent>
      </Card>
    </CollapsibleWidget>
  );
}
