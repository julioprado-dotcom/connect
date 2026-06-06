'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileBarChart, Loader2, Inbox, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { fetchWithTimeout } from '@/lib/fetch-utils';
import { usePolling } from '../hooks/usePolling';
import { CollapsibleWidget } from '../CollapsibleWidget';
import type { WidgetStatus } from '../CollapsibleWidget';

// ─── Types ────────────────────────────────────────────────────

interface EntregasHoy {
  enviadas: number;
  fallidas: number;
  pendientes: number;
  total: number;
}

interface UltimaEntrega {
  id: string;
  tipoBoletin: string;
  estado: string;
  canal: string;
  fechaEnvio: string | null;
  cliente: string;
}

interface ProductosSummaryData {
  timestamp: string;
  entregasHoy: EntregasHoy;
  totalEntregas: number;
  porTipo: Record<string, number>;
  ultimasEntregas: UltimaEntrega[];
}

interface BoletinesWidgetProps {
  onNavigate: (viewId: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────

function deriveStatus(data: ProductosSummaryData | null, loading: boolean): WidgetStatus {
  if (loading || !data) return 'loading';
  if (data.totalEntregas === 0) return 'idle';
  if (data.entregasHoy.fallidas > 0) return 'error';
  if (data.entregasHoy.pendientes > 0) return 'warn';
  return 'ok';
}

const ESTADO_ICON: Record<string, React.ReactNode> = {
  enviado: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />,
  fallido: <XCircle className="h-3.5 w-3.5 text-red-500" />,
  pendiente: <Clock className="h-3.5 w-3.5 text-amber-500" />,
};

const TIPO_STYLES: Record<string, string> = {
  ONION200: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300',
  diario: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
  semanal: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  personalizado: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
};

const CANAL_STYLES: Record<string, string> = {
  email: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
  whatsapp: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  telegram: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
};

// ─── Component ────────────────────────────────────────────────

export function BoletinesWidget({ onNavigate }: BoletinesWidgetProps) {
  const [data, setData] = useState<ProductosSummaryData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchBoletines = useCallback(async () => {
    try {
      const res = await fetchWithTimeout('/api/dashboard/productos-summary', { timeoutMs: 10_000 });
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

  useEffect(() => { fetchBoletines(); }, [fetchBoletines]);
  usePolling(fetchBoletines, 30_000);

  const status = deriveStatus(data, loading);
  const ultimas = data?.ultimasEntregas ?? [];

  return (
    <CollapsibleWidget
      id="widget-boletines"
      title="Boletines & Entregas"
      icon={FileBarChart}
      status={status}
      badge={data ? `${data.entregasHoy.enviadas}/${data.entregasHoy.total}` : undefined}
      badgeLabel="hoy"
      targetView="boletines"
      onNavigate={onNavigate}
      mode="section"
    >
      <Card className="border">
        <CardContent className="p-4 space-y-3">
          {/* Delivery counters */}
          {data && (
            <div className="grid grid-cols-4 gap-2">
              <div className="flex flex-col items-center py-1.5 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{data.entregasHoy.enviadas}</span>
                <span className="text-[8px] text-muted-foreground">Enviadas</span>
              </div>
              <div className="flex flex-col items-center py-1.5 rounded-lg bg-amber-500/5 border border-amber-500/20">
                <span className="text-sm font-bold text-amber-600 dark:text-amber-400">{data.entregasHoy.pendientes}</span>
                <span className="text-[8px] text-muted-foreground">Pendientes</span>
              </div>
              <div className="flex flex-col items-center py-1.5 rounded-lg bg-red-500/5 border border-red-500/20">
                <span className="text-sm font-bold text-red-600 dark:text-red-400">{data.entregasHoy.fallidas}</span>
                <span className="text-[8px] text-muted-foreground">Fallidas</span>
              </div>
              <div className="flex flex-col items-center py-1.5 rounded-lg bg-violet-500/5 border border-violet-500/20">
                <span className="text-sm font-bold text-violet-600 dark:text-violet-400">{data.totalEntregas}</span>
                <span className="text-[8px] text-muted-foreground">Total</span>
              </div>
            </div>
          )}

          {/* Type distribution */}
          {data && Object.keys(data.porTipo).length > 0 && (
            <div className="flex gap-1.5 flex-wrap">
              {Object.entries(data.porTipo).map(([tipo, count]) => (
                <Badge
                  key={tipo}
                  variant="secondary"
                  className={`text-[9px] px-2 py-0.5 h-4 ${TIPO_STYLES[tipo] || 'bg-slate-100 text-slate-800 dark:bg-slate-900/40 dark:text-slate-300'}`}
                >
                  {tipo}: {count}
                </Badge>
              ))}
            </div>
          )}

          {/* Recent deliveries */}
          {ultimas.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                Ultimas entregas
              </p>
              <div className="space-y-1">
                {ultimas.map((e) => (
                  <div
                    key={e.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/30 transition-colors"
                  >
                    {/* Status icon */}
                    {ESTADO_ICON[e.estado] || <Clock className="h-3.5 w-3.5 text-muted-foreground" />}

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-medium text-foreground truncate leading-tight">
                        {e.cliente}
                      </p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Badge
                          variant="secondary"
                          className={`text-[8px] px-1 py-0 h-3.5 ${TIPO_STYLES[e.tipoBoletin] || ''}`}
                        >
                          {e.tipoBoletin}
                        </Badge>
                        {e.canal && (
                          <Badge
                            variant="secondary"
                            className={`text-[8px] px-1 py-0 h-3.5 ${CANAL_STYLES[e.canal] || ''}`}
                          >
                            {e.canal}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Timestamp */}
                    {e.fechaEnvio && (
                      <span className="text-[8px] text-muted-foreground shrink-0">
                        {new Date(e.fechaEnvio).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : !loading ? (
            <div className="py-6 text-center text-muted-foreground">
              <Inbox className="h-5 w-5 mx-auto mb-1.5 opacity-40" />
              <p className="text-xs">Sin entregas registradas</p>
              <p className="text-[10px] opacity-60 mt-0.5">
                Los boletines se generan segun la programacion del scheduler
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
