'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Loader2, Inbox, TrendingUp, Eye } from 'lucide-react';
import { fetchWithTimeout } from '@/lib/fetch-utils';
import { usePolling } from '../hooks/usePolling';
import { CollapsibleWidget } from '../CollapsibleWidget';
import type { WidgetStatus } from '../CollapsibleWidget';

// ─── Types ────────────────────────────────────────────────────

interface TopPersona {
  id: string;
  nombre: string;
  camara: string | null;
  partidoSigla: string | null;
  departamento: string | null;
  mencionesHoy: number;
}

interface PersonasSummaryData {
  timestamp: string;
  totalPersonas: number;
  mencionesHoy: number;
  mencionesSemana: number;
  topPersonas: TopPersona[];
}

interface PersonasRadarWidgetProps {
  onNavigate: (viewId: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────

function deriveStatus(data: PersonasSummaryData | null, loading: boolean): WidgetStatus {
  if (loading || !data) return 'loading';
  if (data.totalPersonas === 0) return 'idle';
  if (data.mencionesHoy === 0) return 'idle';
  return 'ok';
}

function CamaraBadge({ camara }: { camara: string | null }) {
  if (!camara) return null;
  const styles: Record<string, string> = {
    'Diputados': 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
    'Senadores': 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300',
  };
  return (
    <Badge variant="secondary" className={`text-[8px] px-1 py-0 h-3.5 ${styles[camara] || 'bg-slate-100 text-slate-800 dark:bg-slate-900/40 dark:text-slate-300'}`}>
      {camara}
    </Badge>
  );
}

// ─── Component ────────────────────────────────────────────────

export function PersonasRadarWidget({ onNavigate }: PersonasRadarWidgetProps) {
  const [data, setData] = useState<PersonasSummaryData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPersonas = useCallback(async () => {
    try {
      const res = await fetchWithTimeout('/api/dashboard/personas-summary', { timeoutMs: 10_000 });
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

  useEffect(() => { fetchPersonas(); }, [fetchPersonas]);
  usePolling(fetchPersonas, 30_000);

  const status = deriveStatus(data, loading);
  const topPersonas = data?.topPersonas ?? [];

  return (
    <CollapsibleWidget
      id="widget-personas-radar"
      title="Radar de Personas"
      icon={Users}
      status={status}
      badge={data ? `${data.totalPersonas} activas` : undefined}
      badgeLabel="personas"
      targetView="personas-seguimiento"
      onNavigate={onNavigate}
      mode="section"
    >
      <Card className="border">
        <CardContent className="p-4 space-y-3">
          {/* Summary counters */}
          {data && (
            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col items-center py-2 rounded-lg bg-muted/40 border border-border/50">
                <Users className="h-4 w-4 text-primary mb-1" />
                <span className="text-lg font-bold text-foreground">{data.totalPersonas}</span>
                <span className="text-[9px] text-muted-foreground">Activas</span>
              </div>
              <div className="flex flex-col items-center py-2 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                <Eye className="h-4 w-4 text-emerald-500 mb-1" />
                <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{data.mencionesHoy}</span>
                <span className="text-[9px] text-muted-foreground">Hoy</span>
              </div>
              <div className="flex flex-col items-center py-2 rounded-lg bg-sky-500/5 border border-sky-500/20">
                <TrendingUp className="h-4 w-4 text-sky-500 mb-1" />
                <span className="text-lg font-bold text-sky-600 dark:text-sky-400">{data.mencionesSemana}</span>
                <span className="text-[9px] text-muted-foreground">Semana</span>
              </div>
            </div>
          )}

          {/* Top personas table */}
          {topPersonas.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                Top 10 por menciones hoy
              </p>
              <div className="space-y-1">
                {topPersonas.map((p, idx) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/30 transition-colors"
                  >
                    {/* Rank */}
                    <span className={`text-[10px] font-bold w-4 text-center shrink-0 ${
                      idx < 3 ? 'text-amber-500' : 'text-muted-foreground'
                    }`}>
                      {idx + 1}
                    </span>

                    {/* Name + metadata */}
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-medium text-foreground truncate leading-tight">
                        {p.nombre}
                      </p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <CamaraBadge camara={p.camara} />
                        {p.partidoSigla && (
                          <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5">
                            {p.partidoSigla}
                          </Badge>
                        )}
                        {p.departamento && (
                          <span className="text-[8px] text-muted-foreground">{p.departamento}</span>
                        )}
                      </div>
                    </div>

                    {/* Menciones count */}
                    <div className="text-right shrink-0">
                      <span className={`text-xs font-bold tabular-nums ${
                        p.mencionesHoy > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'
                      }`}>
                        {p.mencionesHoy}
                      </span>
                      <p className="text-[8px] text-muted-foreground">menc.</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : !loading ? (
            <div className="py-6 text-center text-muted-foreground">
              <Inbox className="h-5 w-5 mx-auto mb-1.5 opacity-40" />
              <p className="text-xs">Sin menciones detectadas hoy</p>
              <p className="text-[10px] opacity-60 mt-0.5">
                El radar se activa cuando el scraper captura menciones
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
