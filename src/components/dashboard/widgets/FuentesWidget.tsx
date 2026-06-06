'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RadioTower, Loader2, Inbox, Signal, WifiOff } from 'lucide-react';
import { fetchWithTimeout } from '@/lib/fetch-utils';
import { usePolling } from '../hooks/usePolling';
import { CollapsibleWidget } from '../CollapsibleWidget';
import type { WidgetStatus } from '../CollapsibleWidget';
import { timeAgo } from './time-helpers';

// ─── Types ────────────────────────────────────────────────────

interface FuenteRow {
  id: string;
  medioId: string;
  nombre: string;
  url: string;
  tipoCheck: string;
  estado: string;
  activo: boolean;
  capaActual: number;
  fallosConsecutivos: number;
  totalChecks: number;
  totalCambios: number;
  checksSinCambio: number;
  ultimoCheck: string | null;
  ultimoCambio: string | null;
  frecuenciaActual: string;
  responseTime: number;
}

interface FuentesSummaryData {
  timestamp: string;
  total: number;
  activas: number;
  inactivas: number;
  degradadas: number;
  deprecadas: number;
  porCapa: Record<string, number>;
  fuentes: FuenteRow[];
}

interface FuentesWidgetProps {
  onNavigate: (viewId: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────

const CAPA_LABELS: Record<number, { label: string; color: string; bg: string }> = {
  0: { label: 'Sin respuesta', color: 'text-red-500', bg: 'bg-red-100 dark:bg-red-900/30' },
  1: { label: 'Check-First OK', color: 'text-amber-500', bg: 'bg-amber-100 dark:bg-amber-900/30' },
  2: { label: 'Headlines', color: 'text-sky-500', bg: 'bg-sky-100 dark:bg-sky-900/30' },
  3: { label: 'Texto completo', color: 'text-indigo-500', bg: 'bg-indigo-100 dark:bg-indigo-900/30' },
  4: { label: 'Menciones LLM', color: 'text-emerald-500', bg: 'bg-emerald-100 dark:bg-emerald-900/30' },
};

const ESTADO_STYLES: Record<string, string> = {
  activa: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  validando: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  inactiva: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  deprecada: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  creada: 'bg-slate-100 text-slate-800 dark:bg-slate-900/40 dark:text-slate-300',
};

function deriveStatus(data: FuentesSummaryData | null, loading: boolean): WidgetStatus {
  if (loading || !data) return 'loading';
  if (data.total === 0) return 'idle';
  const inactivasRate = data.inactivas / data.total;
  if (inactivasRate > 0.3) return 'error';
  if (data.degradadas > 0 || inactivasRate > 0.1) return 'warn';
  return 'ok';
}

// ─── Component ────────────────────────────────────────────────

export function FuentesWidget({ onNavigate }: FuentesWidgetProps) {
  const [data, setData] = useState<FuentesSummaryData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchFuentes = useCallback(async () => {
    try {
      const res = await fetchWithTimeout('/api/dashboard/fuentes-summary', { timeoutMs: 10_000 });
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

  useEffect(() => { fetchFuentes(); }, [fetchFuentes]);
  usePolling(fetchFuentes, 30_000);

  const status = deriveStatus(data, loading);
  const fuentes = data?.fuentes ?? [];

  return (
    <CollapsibleWidget
      id="widget-fuentes"
      title="Fuentes Monitoreadas"
      icon={RadioTower}
      status={status}
      badge={data ? `${data.activas}/${data.total} activas` : undefined}
      badgeLabel="fuentes"
      targetView="medios"
      onNavigate={onNavigate}
      mode="section"
    >
      <Card className="border">
        <CardContent className="p-4 space-y-3">
          {/* Status counters */}
          {data && (
            <div className="grid grid-cols-4 gap-2">
              <div className="flex flex-col items-center py-1.5 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{data.activas}</span>
                <span className="text-[8px] text-muted-foreground">Activas</span>
              </div>
              <div className="flex flex-col items-center py-1.5 rounded-lg bg-blue-500/5 border border-blue-500/20">
                <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                  {data.porCapa['1'] ?? 0}
                </span>
                <span className="text-[8px] text-muted-foreground">Capa 1+</span>
              </div>
              <div className="flex flex-col items-center py-1.5 rounded-lg bg-amber-500/5 border border-amber-500/20">
                <span className="text-sm font-bold text-amber-600 dark:text-amber-400">{data.degradadas}</span>
                <span className="text-[8px] text-muted-foreground">Degradadas</span>
              </div>
              <div className="flex flex-col items-center py-1.5 rounded-lg bg-red-500/5 border border-red-500/20">
                <span className="text-sm font-bold text-red-600 dark:text-red-400">{data.deprecadas}</span>
                <span className="text-[8px] text-muted-foreground">Deprecadas</span>
              </div>
            </div>
          )}

          {/* Layer distribution bar */}
          {data && (
            <div className="space-y-1">
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Distribucion por capa</p>
              <div className="flex rounded-md overflow-hidden h-4 bg-muted/30">
                {[0, 1, 2, 3, 4].map((capa) => {
                  const count = data.porCapa[String(capa)] ?? 0;
                  if (count === 0) return null;
                  const pct = (count / data.total) * 100;
                  const colors = ['bg-red-400', 'bg-amber-400', 'bg-sky-400', 'bg-indigo-400', 'bg-emerald-400'];
                  return (
                    <div
                      key={capa}
                      className={`${colors[capa]} relative group`}
                      style={{ width: `${Math.max(pct, 3)}%` }}
                      title={`Capa ${capa}: ${count} fuentes`}
                    />
                  );
                })}
              </div>
              <div className="flex justify-between text-[8px] text-muted-foreground">
                <span>C0: Sin respuesta</span>
                <span>C4: Menciones LLM</span>
              </div>
            </div>
          )}

          {/* Sources table */}
          {fuentes.length > 0 ? (
            <div className="space-y-1">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                Estado de fuentes
              </p>
              <div className="space-y-0.5">
                {fuentes.map((fuente) => {
                  const capaInfo = CAPA_LABELS[fuente.capaActual] || CAPA_LABELS[0];
                  return (
                    <div
                      key={fuente.id}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/30 transition-colors"
                    >
                      {/* Status icon */}
                      {fuente.activo ? (
                        <Signal className="h-3 w-3 text-emerald-500 shrink-0" />
                      ) : (
                        <WifiOff className="h-3 w-3 text-muted-foreground shrink-0" />
                      )}

                      {/* Name + URL */}
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-medium text-foreground truncate leading-tight">
                          {fuente.nombre}
                        </p>
                        <p className="text-[8px] text-muted-foreground truncate">
                          {fuente.frecuenciaActual} · ultimo check: {timeAgo(fuente.ultimoCheck)}
                        </p>
                      </div>

                      {/* Layer badge */}
                      <Badge
                        variant="secondary"
                        className={`text-[8px] px-1 py-0 h-3.5 shrink-0 ${capaInfo.bg} ${capaInfo.color}`}
                      >
                        C{fuente.capaActual}
                      </Badge>

                      {/* Estado badge */}
                      <Badge
                        variant="secondary"
                        className={`text-[8px] px-1 py-0 h-3.5 shrink-0 ${ESTADO_STYLES[fuente.estado] || ''}`}
                      >
                        {fuente.estado}
                      </Badge>

                      {/* Failures */}
                      {fuente.fallosConsecutivos > 0 && (
                        <span className="text-[8px] font-medium text-red-500 tabular-nums shrink-0">
                          -{fuente.fallosConsecutivos}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : !loading ? (
            <div className="py-6 text-center text-muted-foreground">
              <Inbox className="h-5 w-5 mx-auto mb-1.5 opacity-40" />
              <p className="text-xs">Sin fuentes monitoreadas</p>
              <p className="text-[10px] opacity-60 mt-0.5">
                Las fuentes se registran desde la vista de Medios
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
