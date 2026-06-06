'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileCheck, Loader2, Inbox, BarChart3 } from 'lucide-react';
import { fetchWithTimeout } from '@/lib/fetch-utils';
import { usePolling } from '../hooks/usePolling';
import { CollapsibleWidget } from '../CollapsibleWidget';
import type { WidgetStatus } from '../CollapsibleWidget';

// ─── Types ────────────────────────────────────────────────────

interface ReporteRow {
  id: string;
  tipo: string;
  fechaCreacion: string;
  totalMenciones: number;
  persona: { nombre: string } | null;
}

interface ReportesSummaryData {
  timestamp: string;
  total: number;
  porTipo: Record<string, number>;
  ultimo: ReporteRow | null;
  ultimos: ReporteRow[];
}

interface ReportesWidgetProps {
  onNavigate: (viewId: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────

function deriveStatus(data: ReportesSummaryData | null, loading: boolean): WidgetStatus {
  if (loading || !data) return 'loading';
  if (data.total === 0) return 'idle';
  return 'ok';
}

const TIPO_COLORS: Record<string, string> = {
  personalizado: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300',
  diario: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
  semanal: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  quincenal: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  mensual: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
};

// ─── Component ────────────────────────────────────────────────

export function ReportesWidget({ onNavigate }: ReportesWidgetProps) {
  const [data, setData] = useState<ReportesSummaryData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchReportes = useCallback(async () => {
    try {
      const res = await fetchWithTimeout('/api/dashboard/reportes-summary', { timeoutMs: 10_000 });
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

  useEffect(() => { fetchReportes(); }, [fetchReportes]);
  usePolling(fetchReportes, 60_000);

  const status = deriveStatus(data, loading);
  const ultimos = data?.ultimos ?? [];

  return (
    <CollapsibleWidget
      id="widget-reportes"
      title="Reportes"
      icon={FileCheck}
      status={status}
      badge={data ? `${data.total}` : undefined}
      badgeLabel="reportes"
      targetView="reportes"
      onNavigate={onNavigate}
      mode="section"
    >
      <Card className="border">
        <CardContent className="p-4 space-y-3">
          {/* Summary */}
          {data && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col items-center py-2 rounded-lg bg-muted/40 border border-border/50">
                  <BarChart3 className="h-4 w-4 text-primary mb-1" />
                  <span className="text-lg font-bold text-foreground">{data.total}</span>
                  <span className="text-[9px] text-muted-foreground">Total</span>
                </div>
                {data.ultimo && (
                  <div className="flex flex-col items-center py-2 rounded-lg bg-violet-500/5 border border-violet-500/20">
                    <FileCheck className="h-4 w-4 text-violet-500 mb-1" />
                    <span className="text-[10px] font-medium text-violet-600 dark:text-violet-400 truncate max-w-full px-1">
                      {data.ultimo.tipo}
                    </span>
                    <span className="text-[9px] text-muted-foreground">
                      {data.ultimo.totalMenciones} menc.
                    </span>
                  </div>
                )}
              </div>

              {/* Type distribution */}
              {Object.keys(data.porTipo).length > 0 && (
                <div className="flex gap-1.5 flex-wrap">
                  {Object.entries(data.porTipo).map(([tipo, count]) => (
                    <Badge
                      key={tipo}
                      variant="secondary"
                      className={`text-[9px] px-2 py-0.5 h-4 ${TIPO_COLORS[tipo] || 'bg-slate-100 text-slate-800 dark:bg-slate-900/40 dark:text-slate-300'}`}
                    >
                      {tipo}: {count}
                    </Badge>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Recent reportes */}
          {ultimos.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                Ultimos reportes generados
              </p>
              <div className="space-y-1">
                {ultimos.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/30 transition-colors"
                  >
                    <FileCheck className="h-3.5 w-3.5 text-violet-500 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <Badge
                          variant="secondary"
                          className={`text-[8px] px-1 py-0 h-3.5 ${TIPO_COLORS[r.tipo] || ''}`}
                        >
                          {r.tipo}
                        </Badge>
                        {r.persona && (
                          <span className="text-[10px] text-foreground truncate">{r.persona.nombre}</span>
                        )}
                      </div>
                      <p className="text-[8px] text-muted-foreground mt-0.5">
                        {r.totalMenciones} menciones · {new Date(r.fechaCreacion).toLocaleDateString('es-BO')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : !loading ? (
            <div className="py-6 text-center text-muted-foreground">
              <Inbox className="h-5 w-5 mx-auto mb-1.5 opacity-40" />
              <p className="text-xs">Sin reportes generados</p>
              <p className="text-[10px] opacity-60 mt-0.5">
                Los reportes se generan a partir de las menciones capturadas
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
