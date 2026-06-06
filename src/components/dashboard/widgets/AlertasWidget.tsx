'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bell, AlertTriangle, ShieldAlert, Loader2, Inbox } from 'lucide-react';
import { fetchWithTimeout } from '@/lib/fetch-utils';
import { usePolling } from '../hooks/usePolling';
import { TRATAMIENTO_LABELS, TRATAMIENTO_STYLES } from '@/constants/ui';
import { CollapsibleWidget } from '../CollapsibleWidget';
import type { WidgetStatus } from '../CollapsibleWidget';
import { timeAgo } from './time-helpers';

// ─── Types ────────────────────────────────────────────────────

interface AlertaItem {
  id: string;
  titulo: string;
  tratamiento: string;
  sentimiento: string;
  fechaCaptura: string;
  persona: { nombre: string; partidoSigla: string; camara: string } | null;
  medio: { nombre: string };
}

interface AlertasSummaryData {
  timestamp: string;
  criticasHoy: number;
  agresivasHoy: number;
  totalAlertasHoy: number;
  ultimas: AlertaItem[];
}

interface AlertasWidgetProps {
  onNavigate: (viewId: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────

function deriveStatus(data: AlertasSummaryData | null, loading: boolean): WidgetStatus {
  if (loading || !data) return 'loading';
  if (data.agresivasHoy > 5) return 'error';
  if (data.totalAlertasHoy > 0) return 'warn';
  return 'ok';
}

// ─── Component ────────────────────────────────────────────────

export function AlertasWidget({ onNavigate }: AlertasWidgetProps) {
  const [data, setData] = useState<AlertasSummaryData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAlertas = useCallback(async () => {
    try {
      const res = await fetchWithTimeout('/api/dashboard/alertas-summary', { timeoutMs: 10_000 });
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

  useEffect(() => { fetchAlertas(); }, [fetchAlertas]);
  usePolling(fetchAlertas, 60_000);

  const status = deriveStatus(data, loading);
  const totalAlertas = data?.totalAlertasHoy ?? 0;
  const alertas = data?.ultimas ?? [];

  return (
    <CollapsibleWidget
      id="widget-alertas"
      title="Alertas Tempranas"
      icon={Bell}
      status={status}
      badge={totalAlertas > 0 ? `${totalAlertas} hoy` : 'sin alertas'}
      badgeLabel="alertas"
      targetView="alertas"
      onNavigate={onNavigate}
      mode="section"
    >
      <Card className="border">
        <CardContent className="p-4 space-y-3">
          {/* 3 severity counters */}
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col items-center py-2 rounded-lg bg-muted/40 border border-border/50">
              <AlertTriangle className="h-4 w-4 text-red-500 mb-1" />
              <span className="text-lg font-bold text-red-600 dark:text-red-400">
                {data?.criticasHoy ?? '--'}
              </span>
              <span className="text-[9px] text-muted-foreground">Criticas</span>
            </div>
            <div className="flex flex-col items-center py-2 rounded-lg bg-muted/40 border border-border/50">
              <ShieldAlert className="h-4 w-4 text-orange-500 mb-1" />
              <span className="text-lg font-bold text-orange-600 dark:text-orange-400">
                {data?.agresivasHoy ?? '--'}
              </span>
              <span className="text-[9px] text-muted-foreground">Agresivas</span>
            </div>
            <div className="flex flex-col items-center py-2 rounded-lg bg-muted/40 border border-border/50">
              <Bell className="h-4 w-4 text-muted-foreground mb-1" />
              <span className="text-lg font-bold text-foreground">
                {totalAlertas}
              </span>
              <span className="text-[9px] text-muted-foreground">Total</span>
            </div>
          </div>

          {/* Last alerts list */}
          {alertas.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                Ultimas alertas
              </p>
              {alertas.map((alerta) => (
                <div
                  key={alerta.id}
                  className="flex items-start gap-2 p-2 rounded-lg bg-muted/20 border border-border/20 hover:bg-muted/30 transition-colors"
                >
                  <div className="shrink-0 mt-0.5">
                    {alerta.tratamiento === 'tratamiento_agresivo' ? (
                      <ShieldAlert className="h-3.5 w-3.5 text-red-500" />
                    ) : (
                      <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-medium text-foreground truncate leading-tight">
                      {alerta.titulo || 'Sin titulo'}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      {alerta.persona && (
                        <span className="text-[9px] text-muted-foreground">
                          {alerta.persona.nombre}
                          {alerta.persona.partidoSigla && (
                            <span className="ml-0.5 opacity-60">({alerta.persona.partidoSigla})</span>
                          )}
                        </span>
                      )}
                      <span className="text-[9px] text-muted-foreground">
                        {alerta.medio.nombre}
                      </span>
                      <Badge
                        variant="secondary"
                        className={`text-[8px] px-1 py-0 h-4 ${TRATAMIENTO_STYLES[alerta.tratamiento] || ''}`}
                      >
                        {TRATAMIENTO_LABELS[alerta.tratamiento] || alerta.tratamiento}
                      </Badge>
                      <span className="text-[8px] text-muted-foreground ml-auto shrink-0">
                        {timeAgo(alerta.fechaCaptura)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : !loading ? (
            <div className="py-6 text-center text-muted-foreground">
              <Inbox className="h-5 w-5 mx-auto mb-1.5 opacity-40" />
              <p className="text-xs">Sin alertas registradas</p>
              <p className="text-[10px] opacity-60 mt-0.5">
                Las menciones con tratamiento critico o agresivo apareceran aqui
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
