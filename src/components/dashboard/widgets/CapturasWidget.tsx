'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Database, Loader2, Inbox, CheckCircle2, XCircle, Newspaper } from 'lucide-react';
import { fetchWithTimeout } from '@/lib/fetch-utils';
import { usePolling } from '../hooks/usePolling';
import { CollapsibleWidget } from '../CollapsibleWidget';
import type { WidgetStatus } from '../CollapsibleWidget';
import { timeAgo } from './time-helpers';

// ─── Types ────────────────────────────────────────────────────

interface CapturaRow {
  id: string;
  fecha: string;
  nivel: string;
  totalArticulos: number;
  mencionesEncontradas: number;
  exitosa: boolean;
  errores: string;
  medio: { nombre: string; tipo: string };
}

interface CapturasSummaryData {
  timestamp: string;
  capturasHoy: number;
  capturas24h: number;
  totalCapturas: number;
  exitosas24h: number;
  fallidas24h: number;
  successRate: number;
  totalMenciones24h: number;
  totalArticulos24h: number;
  ultimas: CapturaRow[];
}

interface CapturasWidgetProps {
  onNavigate: (viewId: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────

function deriveStatus(data: CapturasSummaryData | null, loading: boolean): WidgetStatus {
  if (loading || !data) return 'loading';
  if (data.totalCapturas === 0) return 'idle';
  if (data.fallidas24h > data.exitosas24h) return 'error';
  if (data.fallidas24h > 0) return 'warn';
  if (data.capturasHoy === 0) return 'idle';
  return 'ok';
}

// ─── Component ────────────────────────────────────────────────

export function CapturasWidget({ onNavigate }: CapturasWidgetProps) {
  const [data, setData] = useState<CapturasSummaryData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCapturas = useCallback(async () => {
    try {
      const res = await fetchWithTimeout('/api/dashboard/capturas-summary', { timeoutMs: 10_000 });
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

  useEffect(() => { fetchCapturas(); }, [fetchCapturas]);
  usePolling(fetchCapturas, 30_000);

  const status = deriveStatus(data, loading);
  const ultimas = data?.ultimas ?? [];

  return (
    <CollapsibleWidget
      id="widget-capturas"
      title="Capturas / Evidencias"
      icon={Database}
      status={status}
      badge={data ? `${data.capturasHoy} hoy` : undefined}
      badgeLabel="capturas"
      targetView="captura"
      onNavigate={onNavigate}
      mode="section"
    >
      <Card className="border">
        <CardContent className="p-4 space-y-3">
          {/* Summary counters */}
          {data && (
            <div className="grid grid-cols-4 gap-2">
              <div className="flex flex-col items-center py-1.5 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mb-0.5" />
                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{data.exitosas24h}</span>
                <span className="text-[8px] text-muted-foreground">Exitosas 24h</span>
              </div>
              <div className="flex flex-col items-center py-1.5 rounded-lg bg-red-500/5 border border-red-500/20">
                <XCircle className="h-3.5 w-3.5 text-red-500 mb-0.5" />
                <span className="text-sm font-bold text-red-600 dark:text-red-400">{data.fallidas24h}</span>
                <span className="text-[8px] text-muted-foreground">Fallidas 24h</span>
              </div>
              <div className="flex flex-col items-center py-1.5 rounded-lg bg-sky-500/5 border border-sky-500/20">
                <Newspaper className="h-3.5 w-3.5 text-sky-500 mb-0.5" />
                <span className="text-sm font-bold text-sky-600 dark:text-sky-400">{data.totalMenciones24h}</span>
                <span className="text-[8px] text-muted-foreground">Menciones</span>
              </div>
              <div className="flex flex-col items-center py-1.5 rounded-lg bg-violet-500/5 border border-violet-500/20">
                <Database className="h-3.5 w-3.5 text-violet-500 mb-0.5" />
                <span className="text-sm font-bold text-violet-600 dark:text-violet-400">{data.totalArticulos24h}</span>
                <span className="text-[8px] text-muted-foreground">Articulos</span>
              </div>
            </div>
          )}

          {/* Success rate bar */}
          {data && data.capturas24h > 0 && (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Tasa de exito</span>
                <span className={`text-xs font-bold ${data.successRate >= 80 ? 'text-emerald-600' : data.successRate >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                  {data.successRate}%
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-muted/40 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${data.successRate >= 80 ? 'bg-emerald-500' : data.successRate >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                  style={{ width: `${data.successRate}%` }}
                />
              </div>
            </div>
          )}

          {/* Recent captures */}
          {ultimas.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                Ultimas capturas
              </p>
              <div className="space-y-1">
                {ultimas.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/30 transition-colors"
                  >
                    {c.exitosa ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                    )}

                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-medium text-foreground truncate leading-tight">
                        {c.medio.nombre}
                      </p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5">
                          Nivel {c.nivel}
                        </Badge>
                        <span className="text-[8px] text-muted-foreground">
                          {c.totalArticulos} art. · {c.mencionesEncontradas} menc.
                        </span>
                      </div>
                    </div>

                    <span className="text-[8px] text-muted-foreground shrink-0">
                      {timeAgo(c.fecha)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : !loading ? (
            <div className="py-6 text-center text-muted-foreground">
              <Inbox className="h-5 w-5 mx-auto mb-1.5 opacity-40" />
              <p className="text-xs">Sin capturas registradas</p>
              <p className="text-[10px] opacity-60 mt-0.5">
                Las capturas se ejecutan automaticamente via el worker
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
