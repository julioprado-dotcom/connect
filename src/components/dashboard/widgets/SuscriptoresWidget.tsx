'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Mail, Loader2, Inbox, UserPlus, Users } from 'lucide-react';
import { fetchWithTimeout } from '@/lib/fetch-utils';
import { usePolling } from '../hooks/usePolling';
import { CollapsibleWidget } from '../CollapsibleWidget';
import type { WidgetStatus } from '../CollapsibleWidget';
import { timeAgo } from './time-helpers';

// ─── Types ────────────────────────────────────────────────────

interface UltimoSuscriptor {
  id: string;
  nombre: string;
  email: string;
  canal: string | null;
  origen: string | null;
  activo: boolean;
  fechaSuscripcion: string;
}

interface SuscriptoresSummaryData {
  timestamp: string;
  totalSuscriptores: number;
  totalGratuitos: number;
  activos: number;
  registradosSemana: number;
  ultimos: UltimoSuscriptor[];
}

interface SuscriptoresWidgetProps {
  onNavigate: (viewId: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────

function deriveStatus(data: SuscriptoresSummaryData | null, loading: boolean): WidgetStatus {
  if (loading || !data) return 'loading';
  if (data.totalSuscriptores === 0 && data.totalGratuitos === 0) return 'idle';
  return 'ok';
}

const CANAL_STYLES: Record<string, string> = {
  email: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
  whatsapp: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  telegram: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  web: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
};

// ─── Component ────────────────────────────────────────────────

export function SuscriptoresWidget({ onNavigate }: SuscriptoresWidgetProps) {
  const [data, setData] = useState<SuscriptoresSummaryData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSuscriptores = useCallback(async () => {
    try {
      const res = await fetchWithTimeout('/api/dashboard/suscriptores-summary', { timeoutMs: 10_000 });
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

  useEffect(() => { fetchSuscriptores(); }, [fetchSuscriptores]);
  usePolling(fetchSuscriptores, 60_000);

  const status = deriveStatus(data, loading);
  const ultimos = data?.ultimos ?? [];

  return (
    <CollapsibleWidget
      id="widget-suscriptores"
      title="Suscriptores"
      icon={Mail}
      status={status}
      badge={data ? `${data.activos} activos` : undefined}
      badgeLabel="suscriptores"
      targetView="suscriptores"
      onNavigate={onNavigate}
      mode="section"
    >
      <Card className="border">
        <CardContent className="p-4 space-y-3">
          {/* Summary counters */}
          {data && (
            <div className="grid grid-cols-4 gap-2">
              <div className="flex flex-col items-center py-1.5 rounded-lg bg-muted/40 border border-border/50">
                <span className="text-sm font-bold text-foreground">{data.totalSuscriptores}</span>
                <span className="text-[8px] text-muted-foreground">De pago</span>
              </div>
              <div className="flex flex-col items-center py-1.5 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{data.totalGratuitos}</span>
                <span className="text-[8px] text-muted-foreground">Gratuitos</span>
              </div>
              <div className="flex flex-col items-center py-1.5 rounded-lg bg-sky-500/5 border border-sky-500/20">
                <Users className="h-3.5 w-3.5 text-sky-500 mb-0.5" />
                <span className="text-sm font-bold text-sky-600 dark:text-sky-400">{data.activos}</span>
                <span className="text-[8px] text-muted-foreground">Activos</span>
              </div>
              <div className="flex flex-col items-center py-1.5 rounded-lg bg-violet-500/5 border border-violet-500/20">
                <UserPlus className="h-3.5 w-3.5 text-violet-500 mb-0.5" />
                <span className="text-sm font-bold text-violet-600 dark:text-violet-400">{data.registradosSemana}</span>
                <span className="text-[8px] text-muted-foreground">Esta semana</span>
              </div>
            </div>
          )}

          {/* Recent subscribers */}
          {ultimos.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                Ultimos registros gratuitos
              </p>
              <div className="space-y-1">
                {ultimos.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/30 transition-colors"
                  >
                    {/* Status dot */}
                    <div className={`h-2 w-2 rounded-full shrink-0 ${s.activo ? 'bg-emerald-500' : 'bg-muted-foreground/30'}`} />

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-medium text-foreground truncate leading-tight">
                        {s.nombre}
                      </p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-[8px] text-muted-foreground truncate">{s.email}</span>
                        {s.canal && (
                          <Badge
                            variant="secondary"
                            className={`text-[8px] px-1 py-0 h-3.5 shrink-0 ${CANAL_STYLES[s.canal] || ''}`}
                          >
                            {s.canal}
                          </Badge>
                        )}
                        {s.origen && (
                          <span className="text-[8px] text-muted-foreground">via {s.origen}</span>
                        )}
                      </div>
                    </div>

                    {/* Time */}
                    <span className="text-[8px] text-muted-foreground shrink-0">
                      {timeAgo(s.fechaSuscripcion)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : !loading ? (
            <div className="py-6 text-center text-muted-foreground">
              <Inbox className="h-5 w-5 mx-auto mb-1.5 opacity-40" />
              <p className="text-xs">Sin suscriptores registrados</p>
              <p className="text-[10px] opacity-60 mt-0.5">
                Los suscriptores se registran via formularios publicos o importacion
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
