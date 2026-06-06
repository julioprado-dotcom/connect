'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Radio, Loader2, Inbox, Globe } from 'lucide-react';
import { fetchWithTimeout } from '@/lib/fetch-utils';
import { usePolling } from '../hooks/usePolling';
import { CollapsibleWidget } from '../CollapsibleWidget';
import type { WidgetStatus } from '../CollapsibleWidget';

// ─── Types ────────────────────────────────────────────────────

interface MedioRow {
  id: string;
  nombre: string;
  tipo: string;
  categoria: string;
  nivel: string;
  departamento: string | null;
  activo: boolean;
  mencionesCount: number;
  tieneFuente: boolean;
  fuenteEstado: string | null;
  fuenteCapa: number | null;
}

interface MediosSummaryData {
  timestamp: string;
  total: number;
  activos: number;
  conFuente: number;
  porCategoria: Record<string, number>;
  porNivel: Record<string, number>;
  medios: MedioRow[];
}

interface MediosWidgetProps {
  onNavigate: (viewId: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────

const CATEGORIA_COLORS: Record<string, string> = {
  oficial: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300',
  corporativo: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
  regional: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  alternativo: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  red_social: 'bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300',
};

function deriveStatus(data: MediosSummaryData | null, loading: boolean): WidgetStatus {
  if (loading || !data) return 'loading';
  if (data.total === 0) return 'idle';
  if (data.activos === 0) return 'error';
  return 'ok';
}

// ─── Component ────────────────────────────────────────────────

export function MediosWidget({ onNavigate }: MediosWidgetProps) {
  const [data, setData] = useState<MediosSummaryData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMedios = useCallback(async () => {
    try {
      const res = await fetchWithTimeout('/api/dashboard/medios-summary', { timeoutMs: 10_000 });
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

  useEffect(() => { fetchMedios(); }, [fetchMedios]);
  usePolling(fetchMedios, 60_000);

  const status = deriveStatus(data, loading);
  const medios = data?.medios ?? [];

  return (
    <CollapsibleWidget
      id="widget-medios"
      title="Medios Registrados"
      icon={Radio}
      status={status}
      badge={data ? `${data.activos}/${data.total}` : undefined}
      badgeLabel="medios"
      targetView="medios"
      onNavigate={onNavigate}
      mode="section"
    >
      <Card className="border">
        <CardContent className="p-4 space-y-3">
          {/* Summary counters */}
          {data && (
            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col items-center py-2 rounded-lg bg-muted/40 border border-border/50">
                <Globe className="h-4 w-4 text-primary mb-1" />
                <span className="text-lg font-bold text-foreground">{data.total}</span>
                <span className="text-[9px] text-muted-foreground">Total</span>
              </div>
              <div className="flex flex-col items-center py-2 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{data.activos}</span>
                <span className="text-[9px] text-muted-foreground">Activos</span>
              </div>
              <div className="flex flex-col items-center py-2 rounded-lg bg-sky-500/5 border border-sky-500/20">
                <span className="text-lg font-bold text-sky-600 dark:text-sky-400">{data.conFuente}</span>
                <span className="text-[9px] text-muted-foreground">Monitoreados</span>
              </div>
            </div>
          )}

          {/* Category distribution */}
          {data && Object.keys(data.porCategoria).length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(data.porCategoria).map(([cat, count]) => (
                <Badge
                  key={cat}
                  variant="secondary"
                  className={`text-[9px] px-1.5 py-0.5 ${CATEGORIA_COLORS[cat] || 'bg-slate-100 text-slate-800'}`}
                >
                  {cat}: {count}
                </Badge>
              ))}
            </div>
          )}

          {/* Medios list */}
          {medios.length > 0 ? (
            <div className="space-y-1">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                Medios configurados
              </p>
              <div className="space-y-0.5">
                {medios.slice(0, 10).map((medio) => (
                  <div
                    key={medio.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/30 transition-colors"
                  >
                    {/* Name */}
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-medium text-foreground truncate leading-tight">
                        {medio.nombre}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Badge
                          variant="secondary"
                          className={`text-[8px] px-1 py-0 h-3.5 ${CATEGORIA_COLORS[medio.categoria] || ''}`}
                        >
                          {medio.categoria}
                        </Badge>
                        <span className="text-[8px] text-muted-foreground">
                          N{medio.nivel} · {medio.mencionesCount} menc.
                        </span>
                        {medio.departamento && (
                          <span className="text-[8px] text-muted-foreground">{medio.departamento}</span>
                        )}
                      </div>
                    </div>

                    {/* Fuente status */}
                    {medio.tieneFuente ? (
                      <Badge
                        variant="secondary"
                        className={`text-[8px] px-1 py-0 h-3.5 shrink-0 ${
                          medio.fuenteEstado === 'activa'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                            : medio.fuenteEstado === 'deprecada'
                              ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
                              : 'bg-slate-100 text-slate-800 dark:bg-slate-900/40 dark:text-slate-300'
                        }`}
                      >
                        C{medio.fuenteCapa ?? 0}
                      </Badge>
                    ) : (
                      <span className="text-[8px] text-muted-foreground shrink-0">sin fuente</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : !loading ? (
            <div className="py-6 text-center text-muted-foreground">
              <Inbox className="h-5 w-5 mx-auto mb-1.5 opacity-40" />
              <p className="text-xs">Sin medios registrados</p>
              <p className="text-[10px] opacity-60 mt-0.5">
                Los medios se configuran desde la vista de Medios
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
