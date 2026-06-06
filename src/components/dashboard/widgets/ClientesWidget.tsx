'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { UserCircle, Loader2, Inbox, Building2, Crown, Target } from 'lucide-react';
import { fetchWithTimeout } from '@/lib/fetch-utils';
import { usePolling } from '../hooks/usePolling';
import { CollapsibleWidget } from '../CollapsibleWidget';
import type { WidgetStatus } from '../CollapsibleWidget';

// ─── Types ────────────────────────────────────────────────────

interface TopCliente {
  id: string;
  nombre: string;
  organizacion: string | null;
  plan: string | null;
  segmento: string | null;
  contratosCount: number;
  fechaCreacion: string;
}

interface ClientesSummaryData {
  timestamp: string;
  totalActivos: number;
  total: number;
  porSegmento: Record<string, number>;
  porPlan: Record<string, number>;
  ultimoRegistro: TopCliente | null;
  topClientes: TopCliente[];
}

interface ClientesWidgetProps {
  onNavigate: (viewId: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────

function deriveStatus(data: ClientesSummaryData | null, loading: boolean): WidgetStatus {
  if (loading || !data) return 'loading';
  if (data.total === 0) return 'idle';
  return 'ok';
}

const SEGMENTO_STYLES: Record<string, string> = {
  gobierno: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300',
  empresa: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
  consultora: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  otro: 'bg-slate-100 text-slate-800 dark:bg-slate-900/40 dark:text-slate-300',
};

const PLAN_STYLES: Record<string, string> = {
  premium: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  empresarial: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300',
  basico: 'bg-slate-100 text-slate-800 dark:bg-slate-900/40 dark:text-slate-300',
};

// ─── Component ────────────────────────────────────────────────

export function ClientesWidget({ onNavigate }: ClientesWidgetProps) {
  const [data, setData] = useState<ClientesSummaryData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchClientes = useCallback(async () => {
    try {
      const res = await fetchWithTimeout('/api/dashboard/clientes-summary', { timeoutMs: 10_000 });
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

  useEffect(() => { fetchClientes(); }, [fetchClientes]);
  usePolling(fetchClientes, 60_000);

  const status = deriveStatus(data, loading);
  const topClientes = data?.topClientes ?? [];

  return (
    <CollapsibleWidget
      id="widget-clientes"
      title="Clientes"
      icon={UserCircle}
      status={status}
      badge={data ? `${data.totalActivos} activos` : undefined}
      badgeLabel="clientes"
      targetView="clientes"
      onNavigate={onNavigate}
      mode="section"
    >
      <Card className="border">
        <CardContent className="p-4 space-y-3">
          {/* Summary */}
          {data && (
            <div className="grid grid-cols-3 gap-2">
              <div className="flex flex-col items-center py-2 rounded-lg bg-muted/40 border border-border/50">
                <Building2 className="h-4 w-4 text-primary mb-1" />
                <span className="text-lg font-bold text-foreground">{data.total}</span>
                <span className="text-[9px] text-muted-foreground">Total</span>
              </div>
              <div className="flex flex-col items-center py-2 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                <Crown className="h-4 w-4 text-emerald-500 mb-1" />
                <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{data.totalActivos}</span>
                <span className="text-[9px] text-muted-foreground">Activos</span>
              </div>
              <div className="flex flex-col items-center py-2 rounded-lg bg-sky-500/5 border border-sky-500/20">
                <Target className="h-4 w-4 text-sky-500 mb-1" />
                <span className="text-lg font-bold text-sky-600 dark:text-sky-400">
                  {Object.keys(data.porSegmento).length}
                </span>
                <span className="text-[9px] text-muted-foreground">Segmentos</span>
              </div>
            </div>
          )}

          {/* Segment + plan distribution */}
          {data && (Object.keys(data.porSegmento).length > 0 || Object.keys(data.porPlan).length > 0) && (
            <div className="flex gap-1.5 flex-wrap">
              {Object.entries(data.porSegmento).map(([seg, count]) => (
                <Badge
                  key={`seg-${seg}`}
                  variant="secondary"
                  className={`text-[9px] px-2 py-0.5 h-4 ${SEGMENTO_STYLES[seg] || SEGMENTO_STYLES.otro}`}
                >
                  {seg}: {count}
                </Badge>
              ))}
              {Object.entries(data.porPlan).map(([plan, count]) => (
                <Badge
                  key={`plan-${plan}`}
                  variant="secondary"
                  className={`text-[9px] px-2 py-0.5 h-4 ${PLAN_STYLES[plan] || PLAN_STYLES.basico}`}
                >
                  {plan}: {count}
                </Badge>
              ))}
            </div>
          )}

          {/* Top clientes */}
          {topClientes.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                Ultimos registros
              </p>
              <div className="space-y-1">
                {topClientes.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/30 transition-colors"
                  >
                    <UserCircle className="h-3.5 w-3.5 text-primary shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-medium text-foreground truncate leading-tight">
                        {c.nombre}
                      </p>
                      <div className="flex items-center gap-1 mt-0.5">
                        {c.organizacion && (
                          <span className="text-[8px] text-muted-foreground">{c.organizacion}</span>
                        )}
                        {c.segmento && (
                          <Badge variant="secondary" className={`text-[8px] px-1 py-0 h-3.5 ${SEGMENTO_STYLES[c.segmento] || SEGMENTO_STYLES.otro}`}>
                            {c.segmento}
                          </Badge>
                        )}
                        {c.plan && (
                          <Badge variant="secondary" className={`text-[8px] px-1 py-0 h-3.5 ${PLAN_STYLES[c.plan] || PLAN_STYLES.basico}`}>
                            {c.plan}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {c.contratosCount} contr.
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : !loading ? (
            <div className="py-6 text-center text-muted-foreground">
              <Inbox className="h-5 w-5 mx-auto mb-1.5 opacity-40" />
              <p className="text-xs">Sin clientes registrados</p>
              <p className="text-[10px] opacity-60 mt-0.5">
                Los clientes se registran desde la vista de Clientes
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
