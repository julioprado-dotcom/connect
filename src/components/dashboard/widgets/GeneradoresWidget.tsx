'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Zap, Loader2, Inbox, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { fetchWithTimeout } from '@/lib/fetch-utils';
import { usePolling } from '../hooks/usePolling';
import { CollapsibleWidget } from '../CollapsibleWidget';
import type { WidgetStatus } from '../CollapsibleWidget';

// ─── Types ────────────────────────────────────────────────────

interface GeneradorRow {
  id: string;
  nombre: string;
  descripcion: string;
  tipo: string;
  activo: boolean;
  frecuencia: string;
  ultimoEnvio: string | null;
  clientesActivos: number;
}

interface GeneradoresSummaryData {
  timestamp: string;
  total: number;
  activos: number;
  inactivos: number;
  generadores: GeneradorRow[];
  nota?: string;
}

interface GeneradoresWidgetProps {
  onNavigate: (viewId: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────

function deriveStatus(data: GeneradoresSummaryData | null, loading: boolean): WidgetStatus {
  if (loading || !data) return 'loading';
  if (data.total === 0) return 'idle';
  if (data.inactivos > 0) return 'warn';
  return 'ok';
}

const TIPO_STYLES: Record<string, string> = {
  personal: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
  tematico: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300',
  alertas: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
};

// ─── Component ────────────────────────────────────────────────

export function GeneradoresWidget({ onNavigate }: GeneradoresWidgetProps) {
  const [data, setData] = useState<GeneradoresSummaryData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchGeneradores = useCallback(async () => {
    try {
      const res = await fetchWithTimeout('/api/dashboard/generadores-summary', { timeoutMs: 10_000 });
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

  useEffect(() => { fetchGeneradores(); }, [fetchGeneradores]);
  usePolling(fetchGeneradores, 60_000);

  const status = deriveStatus(data, loading);
  const generadores = data?.generadores ?? [];

  return (
    <CollapsibleWidget
      id="widget-generadores"
      title="Generadores"
      icon={Zap}
      status={status}
      badge={data ? `${data.activos}/${data.total} activos` : undefined}
      badgeLabel="generadores"
      targetView="generadores"
      onNavigate={onNavigate}
      mode="section"
    >
      <Card className="border">
        <CardContent className="p-4 space-y-3">
          {/* Summary */}
          {data && (
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col items-center py-2 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 mb-1" />
                <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{data.activos}</span>
                <span className="text-[9px] text-muted-foreground">Activos</span>
              </div>
              <div className="flex flex-col items-center py-2 rounded-lg bg-slate-500/5 border border-slate-500/20">
                {data.inactivos > 0 ? (
                  <XCircle className="h-4 w-4 text-red-500 mb-1" />
                ) : (
                  <Zap className="h-4 w-4 text-primary mb-1" />
                )}
                <span className="text-lg font-bold text-foreground">{data.total}</span>
                <span className="text-[9px] text-muted-foreground">Total</span>
              </div>
            </div>
          )}

          {/* Generadores list */}
          {generadores.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                Productos ONION200
              </p>
              <div className="space-y-1">
                {generadores.map((g) => (
                  <div
                    key={g.id}
                    className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-muted/30 transition-colors"
                  >
                    {g.activo ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                    )}

                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-medium text-foreground leading-tight">
                        {g.nombre}
                      </p>
                      <p className="text-[9px] text-muted-foreground mt-0.5 line-clamp-1">
                        {g.descripcion}
                      </p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Badge variant="secondary" className={`text-[8px] px-1 py-0 h-3.5 ${TIPO_STYLES[g.tipo] || 'bg-slate-100 text-slate-800 dark:bg-slate-900/40 dark:text-slate-300'}`}>
                          {g.tipo}
                        </Badge>
                        <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5">
                          <Clock className="h-2 w-2 mr-0.5" />
                          {g.frecuencia}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : !loading ? (
            <div className="py-6 text-center text-muted-foreground">
              <Inbox className="h-5 w-5 mx-auto mb-1.5 opacity-40" />
              <p className="text-xs">Sin generadores configurados</p>
            </div>
          ) : (
            <div className="py-6 flex items-center justify-center">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Note */}
          {data?.nota && (
            <p className="text-[8px] text-muted-foreground/60 italic text-center">
              {data.nota}
            </p>
          )}
        </CardContent>
      </Card>
    </CollapsibleWidget>
  );
}
