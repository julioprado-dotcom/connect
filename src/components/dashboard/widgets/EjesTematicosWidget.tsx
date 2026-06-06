'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tag, Loader2, Inbox, Flame, Layers } from 'lucide-react';
import { fetchWithTimeout } from '@/lib/fetch-utils';
import { usePolling } from '../hooks/usePolling';
import { CollapsibleWidget } from '../CollapsibleWidget';
import type { WidgetStatus } from '../CollapsibleWidget';

// ─── Types ────────────────────────────────────────────────────

interface EjeRow {
  id: string;
  nombre: string;
  slug: string | null;
  color: string | null;
  icono: string | null;
  mencionesHoy: number;
  totalMenciones: number;
  temasCount: number;
}

interface EjesSummaryData {
  timestamp: string;
  totalActivos: number;
  conActividadHoy: number;
  topEje: EjeRow | null;
  ejes: EjeRow[];
}

interface EjesTematicosWidgetProps {
  onNavigate: (viewId: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────

function deriveStatus(data: EjesSummaryData | null, loading: boolean): WidgetStatus {
  if (loading || !data) return 'loading';
  if (data.totalActivos === 0) return 'idle';
  if (data.conActividadHoy === 0) return 'idle';
  return 'ok';
}

// ─── Component ────────────────────────────────────────────────

export function EjesTematicosWidget({ onNavigate }: EjesTematicosWidgetProps) {
  const [data, setData] = useState<EjesSummaryData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchEjes = useCallback(async () => {
    try {
      const res = await fetchWithTimeout('/api/dashboard/ejes-summary', { timeoutMs: 10_000 });
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

  useEffect(() => { fetchEjes(); }, [fetchEjes]);
  usePolling(fetchEjes, 30_000);

  const status = deriveStatus(data, loading);
  const ejes = data?.ejes ?? [];

  return (
    <CollapsibleWidget
      id="widget-ejes-tematicos"
      title="Ejes Tematicos"
      icon={Tag}
      status={status}
      badge={data ? `${data.conActividadHoy}/${data.totalActivos} activos hoy` : undefined}
      badgeLabel="ejes"
      targetView="ejes-tematicos"
      onNavigate={onNavigate}
      mode="section"
    >
      <Card className="border">
        <CardContent className="p-4 space-y-3">
          {/* Summary counters */}
          {data && (
            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col items-center py-2 rounded-lg bg-muted/40 border border-border/50">
                <Layers className="h-4 w-4 text-primary mb-1" />
                <span className="text-lg font-bold text-foreground">{data.totalActivos}</span>
                <span className="text-[9px] text-muted-foreground">Ejes activos</span>
              </div>
              <div className="flex flex-col items-center py-2 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                <Flame className="h-4 w-4 text-emerald-500 mb-1" />
                <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{data.conActividadHoy}</span>
                <span className="text-[9px] text-muted-foreground">Con actividad hoy</span>
              </div>
              {data.topEje && (
                <div className="flex flex-col items-center py-2 rounded-lg bg-amber-500/5 border border-amber-500/20">
                  <Tag className="h-4 w-4 text-amber-500 mb-1" />
                  <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400 text-center leading-tight px-1 truncate max-w-full">
                    {data.topEje.nombre}
                  </span>
                  <span className="text-[9px] text-muted-foreground">
                    {data.topEje.mencionesHoy} menc.
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Ejes list */}
          {ejes.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                Todos los ejes
              </p>
              <div className="space-y-1">
                {ejes.map((eje) => {
                  const isActive = eje.mencionesHoy > 0;
                  return (
                    <div
                      key={eje.id}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/30 transition-colors"
                    >
                      {/* Color dot */}
                      <div
                        className="h-3 w-3 rounded-sm shrink-0"
                        style={{ backgroundColor: eje.color || '#6B7280' }}
                      />

                      {/* Name + metadata */}
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-medium text-foreground truncate leading-tight">
                          {eje.nombre}
                        </p>
                        <div className="flex items-center gap-1 mt-0.5">
                          {eje.slug && (
                            <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5">
                              {eje.slug}
                            </Badge>
                          )}
                          {eje.temasCount > 0 && (
                            <span className="text-[8px] text-muted-foreground">
                              {eje.temasCount} subtemas
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Menciones */}
                      <div className="text-right shrink-0">
                        <span className={`text-xs font-bold tabular-nums ${
                          isActive
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-muted-foreground'
                        }`}>
                          {eje.mencionesHoy}
                        </span>
                        <p className="text-[8px] text-muted-foreground">hoy</p>
                      </div>

                      {/* Total bar */}
                      {eje.totalMenciones > 0 && (
                        <div className="w-12 h-1.5 rounded-full bg-muted/40 shrink-0 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              backgroundColor: eje.color || '#6B7280',
                              width: `${Math.min((eje.totalMenciones / Math.max(...ejes.map(e => e.totalMenciones))) * 100, 100)}%`,
                            }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : !loading ? (
            <div className="py-6 text-center text-muted-foreground">
              <Inbox className="h-5 w-5 mx-auto mb-1.5 opacity-40" />
              <p className="text-xs">Sin ejes tematicos configurados</p>
              <p className="text-[10px] opacity-60 mt-0.5">
                Los ejes se definen desde el Marco Conceptual
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
