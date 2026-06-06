'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shield, Loader2, Inbox, CheckCircle2, AlertTriangle, Eye } from 'lucide-react';
import { fetchWithTimeout } from '@/lib/fetch-utils';
import { usePolling } from '../hooks/usePolling';
import { CollapsibleWidget } from '../CollapsibleWidget';
import type { WidgetStatus } from '../CollapsibleWidget';
import { timeAgo } from './time-helpers';

// ─── Types ────────────────────────────────────────────────────

interface AuditoriaRow {
  id: string;
  nombre: string;
  estado: string;
  activo: boolean;
  capaActual: number;
  ultimoCheck: string | null;
  ultimoCheckHace: string;
  totalChecks: number;
  totalCambios: number;
  checksSinCambio: number;
  responseTime: number;
  esDegradado: boolean;
}

interface AuditoriaData {
  timestamp: string;
  totalAuditadas: number;
  activas: number;
  degradadas: number;
  sinCheckReciente: number;
  scorePromedio: number;
  fuentes: AuditoriaRow[];
}

interface AuditoriaWidgetProps {
  onNavigate: (viewId: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────

function deriveStatus(data: AuditoriaData | null, loading: boolean): WidgetStatus {
  if (loading || !data) return 'loading';
  if (data.totalAuditadas === 0) return 'idle';
  if (data.sinCheckReciente > data.totalAuditadas * 0.5) return 'error';
  if (data.degradadas > 0 || data.sinCheckReciente > 0) return 'warn';
  return 'ok';
}

const ESTADO_STYLES: Record<string, string> = {
  activa: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  validando: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  inactiva: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  deprecada: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  creada: 'bg-slate-100 text-slate-800 dark:bg-slate-900/40 dark:text-slate-300',
};

const CAPA_LABELS: Record<number, { label: string; color: string }> = {
  0: { label: 'C0', color: 'text-red-500' },
  1: { label: 'C1', color: 'text-amber-500' },
  2: { label: 'C2', color: 'text-sky-500' },
  3: { label: 'C3', color: 'text-indigo-500' },
  4: { label: 'C4', color: 'text-emerald-500' },
};

// ─── Component ────────────────────────────────────────────────

export function AuditoriaWidget({ onNavigate }: AuditoriaWidgetProps) {
  const [data, setData] = useState<AuditoriaData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAuditoria = useCallback(async () => {
    try {
      const res = await fetchWithTimeout('/api/dashboard/fuentes-summary', { timeoutMs: 12_000 });
      if (res.ok) {
        const json = await res.json();
        // Transform fuentes-summary into auditoria view
        const fuentes = json.fuentes || [];
        const totalAuditadas = fuentes.length;
        const activas = fuentes.filter((f: { estado: string }) => f.estado === 'activa').length;
        const degradadas = fuentes.filter((f: { fallosConsecutivos: number }) => f.fallosConsecutivos >= 1).length;
        const sinCheckReciente = fuentes.filter((f: { ultimoCheck: string | null }) => {
          if (!f.ultimoCheck) return true;
          return Date.now() - new Date(f.ultimoCheck).getTime() > 24 * 3600000;
        }).length;

        // Score: average of (capaActual / 4) for active sources
        const activasF = fuentes.filter((f: { estado: string }) => f.estado === 'activa');
        const scorePromedio = activasF.length > 0
          ? Math.round((activasF.reduce((s: number, f: { capaActual: number }) => s + f.capaActual, 0) / activasF.length) * 25)
          : 0;

        setData({
          timestamp: json.timestamp,
          totalAuditadas,
          activas,
          degradadas,
          sinCheckReciente,
          scorePromedio,
          fuentes: fuentes.map((f: { id: string; nombre: string; estado: string; activo: boolean; capaActual: number; ultimoCheck: string | null; totalChecks: number; totalCambios: number; checksSinCambio: number; responseTime: number }) => ({
            id: f.id,
            nombre: f.nombre,
            estado: f.estado,
            activo: f.activo,
            capaActual: f.capaActual,
            ultimoCheck: f.ultimoCheck,
            ultimoCheckHace: f.ultimoCheck ? timeAgo(f.ultimoCheck) : 'nunca',
            totalChecks: f.totalChecks,
            totalCambios: f.totalCambios,
            checksSinCambio: f.checksSinCambio,
            responseTime: f.responseTime,
            esDegradado: f.checksSinCambio >= 7,
          })),
        });
        setLoading(false);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAuditoria(); }, [fetchAuditoria]);
  usePolling(fetchAuditoria, 60_000);

  const status = deriveStatus(data, loading);
  const fuentes = data?.fuentes ?? [];

  return (
    <CollapsibleWidget
      id="widget-auditoria"
      title="Auditoria de Fuentes"
      icon={Shield}
      status={status}
      badge={data ? `score ${data.scorePromedio}%` : undefined}
      badgeLabel="auditoria"
      targetView="auditoria"
      onNavigate={onNavigate}
      mode="section"
    >
      <Card className="border">
        <CardContent className="p-4 space-y-3">
          {/* Score + counters */}
          {data && (
            <div className="grid grid-cols-4 gap-2">
              <div className="flex flex-col items-center py-1.5 rounded-lg bg-muted/40 border border-border/50">
                <span className="text-sm font-bold text-foreground">{data.totalAuditadas}</span>
                <span className="text-[8px] text-muted-foreground">Total</span>
              </div>
              <div className="flex flex-col items-center py-1.5 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{data.activas}</span>
                <span className="text-[8px] text-muted-foreground">Activas</span>
              </div>
              <div className="flex flex-col items-center py-1.5 rounded-lg bg-amber-500/5 border border-amber-500/20">
                <span className="text-sm font-bold text-amber-600 dark:text-amber-400">{data.degradadas}</span>
                <span className="text-[8px] text-muted-foreground">Degradadas</span>
              </div>
              <div className="flex flex-col items-center py-1.5 rounded-lg bg-red-500/5 border border-red-500/20">
                <span className="text-sm font-bold text-red-600 dark:text-red-400">{data.sinCheckReciente}</span>
                <span className="text-[8px] text-muted-foreground">Sin check</span>
              </div>
            </div>
          )}

          {/* Score bar */}
          {data && (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Score de salud</span>
                <span className={`text-xs font-bold ${data.scorePromedio >= 70 ? 'text-emerald-600' : data.scorePromedio >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                  {data.scorePromedio}%
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-muted/40 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${data.scorePromedio >= 70 ? 'bg-emerald-500' : data.scorePromedio >= 40 ? 'bg-amber-500' : 'bg-red-500'}`}
                  style={{ width: `${data.scorePromedio}%` }}
                />
              </div>
            </div>
          )}

          {/* Fuentes audit list */}
          {fuentes.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                Estado de fuentes
              </p>
              <div className="space-y-0.5">
                {fuentes.slice(0, 8).map((f) => {
                  const capa = CAPA_LABELS[f.capaActual] || CAPA_LABELS[0];
                  return (
                    <div
                      key={f.id}
                      className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-muted/30 transition-colors"
                    >
                      {f.esDegradado ? (
                        <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />
                      ) : f.activo ? (
                        <Eye className="h-3 w-3 text-emerald-500 shrink-0" />
                      ) : (
                        <AlertTriangle className="h-3 w-3 text-red-500 shrink-0" />
                      )}

                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-medium text-foreground truncate leading-tight">
                          {f.nombre}
                        </p>
                        <p className="text-[8px] text-muted-foreground">
                          ultimo check: {f.ultimoCheckHace}
                        </p>
                      </div>

                      <Badge variant="secondary" className={`text-[8px] px-1 py-0 h-3.5 ${capa.color}`}>
                        {capa.label}
                      </Badge>
                      <Badge variant="secondary" className={`text-[8px] px-1 py-0 h-3.5 ${ESTADO_STYLES[f.estado] || ''}`}>
                        {f.estado}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : !loading ? (
            <div className="py-6 text-center text-muted-foreground">
              <Inbox className="h-5 w-5 mx-auto mb-1.5 opacity-40" />
              <p className="text-xs">Sin fuentes para auditar</p>
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
