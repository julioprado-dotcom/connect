'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Newspaper, Loader2, Inbox, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { fetchWithTimeout } from '@/lib/fetch-utils';
import { usePolling } from '../hooks/usePolling';
import { CollapsibleWidget } from '../CollapsibleWidget';
import type { WidgetStatus } from '../CollapsibleWidget';
import { timeAgo } from './time-helpers';

// ─── Types ────────────────────────────────────────────────────

interface UltimaMencion {
  id: string;
  titulo: string;
  fechaCaptura: string;
  tratamientoPeriodistico: string | null;
  persona: { nombre: string } | null;
  medio: { nombre: string };
}

interface MencionesSummaryData {
  timestamp: string;
  hoy: number;
  ayer: number;
  semana: number;
  total: number;
  tendencia: 'up' | 'down' | 'stable';
  ultimas: UltimaMencion[];
}

interface MencionesRecientesWidgetProps {
  onNavigate: (viewId: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────

function deriveStatus(data: MencionesSummaryData | null, loading: boolean): WidgetStatus {
  if (loading || !data) return 'loading';
  if (data.total === 0) return 'idle';
  if (data.hoy === 0 && data.ayer === 0) return 'warn';
  return 'ok';
}

function TendenciaBadge({ tendencia }: { tendencia: 'up' | 'down' | 'stable' }) {
  if (tendencia === 'up') return <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />;
  if (tendencia === 'down') return <TrendingDown className="h-3.5 w-3.5 text-red-500" />;
  return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
}

const TRATAMIENTO_STYLES: Record<string, string> = {
  tratamiento_critico: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  tratamiento_agresivo: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  tratamiento_natural: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
  tratamiento_positivo: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
};

// ─── Component ────────────────────────────────────────────────

export function MencionesRecientesWidget({ onNavigate }: MencionesRecientesWidgetProps) {
  const [data, setData] = useState<MencionesSummaryData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMenciones = useCallback(async () => {
    try {
      const res = await fetchWithTimeout('/api/dashboard/menciones-summary', { timeoutMs: 10_000 });
      if (res.ok) {
        const json = await res.json();
        if (!json.error) {
          setData(json);
          setLoading(false);
          return;
        }
      }
      // Fallback: use /api/dashboard/summary endpoint
      const res2 = await fetchWithTimeout('/api/dashboard/summary', { timeoutMs: 10_000 });
      if (res2.ok) {
        const sum = await res2.json();
        const fallbackData: MencionesSummaryData = {
          timestamp: sum.timestamp || '',
          hoy: sum.menciones?.hoy || 0,
          ayer: 0,
          semana: sum.menciones?.semana || 0,
          total: sum.menciones?.total || 0,
          tendencia: 'stable' as const,
          ultimas: [],
        };
        setData(fallbackData);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMenciones(); }, [fetchMenciones]);
  usePolling(fetchMenciones, 30_000);

  const status = deriveStatus(data, loading);
  const ultimas = data?.ultimas ?? [];

  return (
    <CollapsibleWidget
      id="widget-menciones-recientes"
      title="Menciones Recientes"
      icon={Newspaper}
      status={status}
      badge={data ? `${data.hoy} hoy` : undefined}
      badgeLabel="menciones"
      targetView="menciones"
      onNavigate={onNavigate}
      mode="section"
    >
      <Card className="border">
        <CardContent className="p-4 space-y-3">
          {/* Summary counters */}
          {data && (
            <div className="grid grid-cols-4 gap-2">
              <div className="flex flex-col items-center py-1.5 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{data.hoy}</span>
                <span className="text-[8px] text-muted-foreground">Hoy</span>
              </div>
              <div className="flex flex-col items-center py-1.5 rounded-lg bg-slate-500/5 border border-slate-500/20">
                <span className="text-sm font-bold text-slate-600 dark:text-slate-400">{data.ayer}</span>
                <span className="text-[8px] text-muted-foreground">Ayer</span>
              </div>
              <div className="flex flex-col items-center py-1.5 rounded-lg bg-sky-500/5 border border-sky-500/20">
                <span className="text-sm font-bold text-sky-600 dark:text-sky-400">{data.semana}</span>
                <span className="text-[8px] text-muted-foreground">Semana</span>
              </div>
              <div className="flex flex-col items-center py-1.5 rounded-lg bg-violet-500/5 border border-violet-500/20">
                <TendenciaBadge tendencia={data.tendencia} />
                <span className="text-[8px] text-muted-foreground mt-0.5">Tendencia</span>
              </div>
            </div>
          )}

          {/* Recent menciones */}
          {ultimas.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                Ultimas 10 menciones capturadas
              </p>
              <div className="space-y-1">
                {ultimas.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-start gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/30 transition-colors"
                  >
                    {/* Title + metadata */}
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-medium text-foreground truncate leading-tight">
                        {m.titulo || 'Sin titulo'}
                      </p>
                      <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                        {m.persona && (
                          <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5">
                            {m.persona.nombre}
                          </Badge>
                        )}
                        <span className="text-[8px] text-muted-foreground">{m.medio.nombre}</span>
                        <span className="text-[8px] text-muted-foreground">· {timeAgo(m.fechaCaptura)}</span>
                      </div>
                    </div>

                    {/* Treatment badge */}
                    {m.tratamientoPeriodistico && (
                      <Badge
                        variant="secondary"
                        className={`text-[8px] px-1 py-0 h-3.5 shrink-0 mt-0.5 ${TRATAMIENTO_STYLES[m.tratamientoPeriodistico] || ''}`}
                      >
                        {m.tratamientoPeriodistico.replace('tratamiento_', '')}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : !loading ? (
            <div className="py-6 text-center text-muted-foreground">
              <Inbox className="h-5 w-5 mx-auto mb-1.5 opacity-40" />
              <p className="text-xs">Sin menciones capturadas</p>
              <p className="text-[10px] opacity-60 mt-0.5">
                Las menciones se capturan automaticamente via scraping
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
