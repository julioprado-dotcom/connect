'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shield, Loader2, Inbox, AlertTriangle, DollarSign, Timer } from 'lucide-react';
import { fetchWithTimeout } from '@/lib/fetch-utils';
import { usePolling } from '../hooks/usePolling';
import { CollapsibleWidget } from '../CollapsibleWidget';
import type { WidgetStatus } from '../CollapsibleWidget';

// ─── Types ────────────────────────────────────────────────────

interface ContratoPorVencer {
  id: string;
  tipoProducto: string;
  fechaFin: string | null;
  diasRestantes: number | null;
  montoMensual: number;
  moneda: string;
  cliente: {
    nombre: string;
    organizacion: string | null;
  };
}

interface ContratosSummaryData {
  timestamp: string;
  vigentes: number;
  porVencer15d: number;
  vencidos: number;
  mrrTotal: number;
  porTipoProducto: Record<string, number>;
  porVencer: ContratoPorVencer[];
}

interface ContratosWidgetProps {
  onNavigate: (viewId: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────

function deriveStatus(data: ContratosSummaryData | null, loading: boolean): WidgetStatus {
  if (loading || !data) return 'loading';
  if (data.vigentes === 0 && data.vencidos === 0) return 'idle';
  if (data.porVencer15d > 0) {
    const minDays = data.porVencer.reduce((min, c) => {
      const d = c.diasRestantes ?? 999;
      return d < min ? d : min;
    }, 999);
    if (minDays <= 7) return 'error';
    return 'warn';
  }
  if (data.vencidos > 0) return 'warn';
  return 'ok';
}

function diasColor(dias: number | null): string {
  if (dias === null) return 'text-muted-foreground';
  if (dias <= 3) return 'text-red-600 dark:text-red-400 font-bold';
  if (dias <= 7) return 'text-orange-600 dark:text-orange-400 font-medium';
  if (dias <= 15) return 'text-amber-600 dark:text-amber-400';
  return 'text-emerald-600 dark:text-emerald-400';
}

// ─── Component ────────────────────────────────────────────────

export function ContratosWidget({ onNavigate }: ContratosWidgetProps) {
  const [data, setData] = useState<ContratosSummaryData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchContratos = useCallback(async () => {
    try {
      const res = await fetchWithTimeout('/api/dashboard/contratos-summary', { timeoutMs: 10_000 });
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

  useEffect(() => { fetchContratos(); }, [fetchContratos]);
  usePolling(fetchContratos, 30_000);

  const status = deriveStatus(data, loading);
  const porVencer = data?.porVencer ?? [];

  return (
    <CollapsibleWidget
      id="widget-contratos"
      title="Contratos"
      icon={Shield}
      status={status}
      badge={data ? `${data.vigentes} vigentes` : undefined}
      badgeLabel="contratos"
      targetView="contratos"
      onNavigate={onNavigate}
      mode="section"
    >
      <Card className="border">
        <CardContent className="p-4 space-y-3">
          {/* Summary counters */}
          {data && (
            <div className="grid grid-cols-4 gap-2">
              <div className="flex flex-col items-center py-1.5 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                <Shield className="h-3.5 w-3.5 text-emerald-500 mb-0.5" />
                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{data.vigentes}</span>
                <span className="text-[8px] text-muted-foreground">Vigentes</span>
              </div>
              <div className="flex flex-col items-center py-1.5 rounded-lg bg-amber-500/5 border border-amber-500/20">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mb-0.5" />
                <span className="text-sm font-bold text-amber-600 dark:text-amber-400">{data.porVencer15d}</span>
                <span className="text-[8px] text-muted-foreground">Por vencer</span>
              </div>
              <div className="flex flex-col items-center py-1.5 rounded-lg bg-red-500/5 border border-red-500/20">
                <Timer className="h-3.5 w-3.5 text-red-500 mb-0.5" />
                <span className="text-sm font-bold text-red-600 dark:text-red-400">{data.vencidos}</span>
                <span className="text-[8px] text-muted-foreground">Vencidos</span>
              </div>
              <div className="flex flex-col items-center py-1.5 rounded-lg bg-violet-500/5 border border-violet-500/20">
                <DollarSign className="h-3.5 w-3.5 text-violet-500 mb-0.5" />
                <span className="text-sm font-bold text-violet-600 dark:text-violet-400">
                  {data.mrrTotal.toLocaleString('es-BO')}
                </span>
                <span className="text-[8px] text-muted-foreground">MRR (Bs)</span>
              </div>
            </div>
          )}

          {/* Type distribution */}
          {data && Object.keys(data.porTipoProducto).length > 0 && (
            <div className="flex gap-1.5 flex-wrap">
              {Object.entries(data.porTipoProducto).map(([tipo, count]) => (
                <Badge key={tipo} variant="secondary" className="text-[9px] px-2 py-0.5 h-4 bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300">
                  {tipo}: {count}
                </Badge>
              ))}
            </div>
          )}

          {/* Expiring contracts */}
          {porVencer.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                Contratos por vencer (prox. 15 dias)
              </p>
              <div className="space-y-1">
                {porVencer.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/30 transition-colors"
                  >
                    <AlertTriangle className={`h-3.5 w-3.5 shrink-0 ${
                      (c.diasRestantes ?? 99) <= 7 ? 'text-red-500' : 'text-amber-500'
                    }`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-medium text-foreground truncate leading-tight">
                        {c.cliente.nombre}
                      </p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-[8px] text-muted-foreground">{c.tipoProducto}</span>
                        {c.montoMensual > 0 && (
                          <span className="text-[8px] text-muted-foreground">
                            · {c.montoMensual.toLocaleString('es-BO')} {c.moneda}/mes
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      {c.diasRestantes !== null && (
                        <span className={`text-xs font-bold tabular-nums ${diasColor(c.diasRestantes)}`}>
                          {c.diasRestantes}d
                        </span>
                      )}
                      {c.fechaFin && (
                        <p className="text-[8px] text-muted-foreground">
                          {new Date(c.fechaFin).toLocaleDateString('es-BO', { day: '2-digit', month: 'short' })}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : !loading ? (
            <div className="py-6 text-center text-muted-foreground">
              <Inbox className="h-5 w-5 mx-auto mb-1.5 opacity-40" />
              <p className="text-xs">Sin contratos proximos a vencer</p>
              <p className="text-[10px] opacity-60 mt-0.5">
                Los contratos se gestionan desde la vista de Contratos
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
