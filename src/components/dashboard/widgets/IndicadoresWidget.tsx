'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Loader2, Inbox, Radio, Filter, Package, Send,
  Eye, Tag, FileText, Users, AlertTriangle, CheckCircle2,
  Clock, Database, TrendingUp, Newspaper,
} from 'lucide-react';
import { fetchWithTimeout } from '@/lib/fetch-utils';
import { usePolling } from '../hooks/usePolling';
import { CollapsibleWidget } from '../CollapsibleWidget';
import type { WidgetStatus } from '../CollapsibleWidget';

// ─── Types ────────────────────────────────────────────────────

interface PipelineData {
  timestamp: string;
  captura: {
    menciones: { total: number; hoy: number; semana: number };
    medios: number;
    fuentes: { activas: number; degradadas: number };
    ultimaCaptura: string | null;
    ultimaCapturaHace: string;
    porNivel: Array<{ nivel: number; total: number }>;
    status: string;
  };
  clasificacion: {
    lentes: number;
    ejes: number;
    mencionesClasificadas: { conLente: number; conEje: number; conSentimiento: number; total: number };
    tasas: { lente: number; eje: number; sentimiento: number };
    status: string;
  };
  produccion: {
    productos: { total: number; hoy: number; semana: number };
    reportes: number;
    porTipo: Array<{ tipo: string; total: number }>;
    porEstado: Array<{ estado: string; total: number }>;
    ultimoProducto: string | null;
    ultimoProductoHace: string;
    ultimoTipo: string | null;
    status: string;
  };
  distribucion: {
    envios: { total: number; exitosos: number; fallidos: number; tasaExito: number };
    entregas: { total: number; hoy: number };
    suscriptores: number;
    ultimoEnvio: string | null;
    ultimoEnvioHace: string;
    status: string;
  };
  sistema: {
    jobs24h: { completados: number; fallidos: number };
    status: string;
  };
}

interface IndicadoresWidgetProps {
  onNavigate: (viewId: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────

function deriveStatus(data: PipelineData | null, loading: boolean): WidgetStatus {
  if (loading || !data) return 'loading';
  const statuses = [data.captura.status, data.clasificacion.status, data.produccion.status, data.distribucion.status];
  if (statuses.includes('error')) return 'error';
  if (statuses.includes('warn')) return 'warn';
  if (statuses.includes('ok')) return 'ok';
  return 'idle';
}

function StatusDot({ status }: { status: string }) {
  const color = status === 'ok' ? 'bg-emerald-500'
    : status === 'warn' ? 'bg-amber-500'
    : status === 'error' ? 'bg-red-500'
    : 'bg-slate-400';
  return <span className={`inline-block w-1.5 h-1.5 rounded-full ${color} shrink-0`} />;
}

function MiniMetric({ label, value, icon: Icon, accent }: {
  label: string; value: string | number; icon?: React.ElementType; accent?: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {Icon && <Icon className={`h-3 w-3 shrink-0 ${accent || 'text-muted-foreground'}`} />}
      <span className="text-[9px] text-muted-foreground">{label}</span>
      <span className={`text-[11px] font-semibold tabular-nums ${accent || 'text-foreground'}`}>{value}</span>
    </div>
  );
}

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 h-1 rounded-full bg-muted/60 overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[9px] font-medium text-muted-foreground tabular-nums w-7 text-right">{pct}%</span>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────

export function IndicadoresWidget({ onNavigate }: IndicadoresWidgetProps) {
  const [data, setData] = useState<PipelineData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchIndicadores = useCallback(async () => {
    try {
      const res = await fetchWithTimeout('/api/dashboard/indicadores-summary', { timeoutMs: 12_000 });
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

  useEffect(() => { fetchIndicadores(); }, [fetchIndicadores]);
  usePolling(fetchIndicadores, 60_000);

  const status = deriveStatus(data, loading);

  // Total pipeline badge
  const totalMenciones = data?.captura.menciones.total ?? 0;
  const totalProductos = data?.produccion.productos.total ?? 0;
  const totalEnvios = data?.distribucion.envios.total ?? 0;

  return (
    <CollapsibleWidget
      id="widget-indicadores"
      title="Pipeline ONION200"
      icon={TrendingUp}
      status={status}
      badge={`${totalMenciones} m · ${totalProductos} p · ${totalEnvios} e`}
      badgeLabel="pipeline"
      targetView="indicadores"
      onNavigate={onNavigate}
      mode="section"
    >
      <Card className="border">
        <CardContent className="p-3 space-y-2.5">
          {loading ? (
            <div className="py-8 flex items-center justify-center">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : data ? (
            <>
              {/* ─── 1. CAPTURA ─── */}
              <PipelineCard
                icon={Radio}
                label="Captura"
                status={data.captura.status}
                color="blue"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <MiniMetric label="Menciones" value={data.captura.menciones.total} icon={Newspaper} accent="text-blue-600 dark:text-blue-400" />
                    <span className="text-[9px] text-muted-foreground">
                      +{data.captura.menciones.hoy} hoy · {data.captura.menciones.semana} sem
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <MiniMetric label="Medios" value={data.captura.medios} />
                    <MiniMetric label="Fuentes" value={`${data.captura.fuentes.activas}/${data.captura.fuentes.activas + data.captura.fuentes.degradadas}`} />
                    {data.captura.fuentes.degradadas > 0 && (
                      <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5 text-amber-600 border-amber-300">
                        {data.captura.fuentes.degradadas} degradadas
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    Ultima captura: {data.captura.ultimaCapturaHace}
                  </div>
                </div>
              </PipelineCard>

              {/* ─── 2. CLASIFICACIÓN ─── */}
              <PipelineCard
                icon={Filter}
                label="Clasificación"
                status={data.clasificacion.status}
                color="violet"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-4">
                    <MiniMetric label="Lentes" value={data.clasificacion.lentes} icon={Tag} accent="text-violet-600 dark:text-violet-400" />
                    <MiniMetric label="Ejes" value={data.clasificacion.ejes} icon={Eye} />
                  </div>
                  <ProgressBar
                    value={data.clasificacion.mencionesClasificadas.conEje}
                    max={data.clasificacion.mencionesClasificadas.total}
                    color="bg-violet-500"
                  />
                  <div className="flex items-center gap-3 text-[9px]">
                    <span className="text-muted-foreground">
                      <span className="font-medium text-foreground">{data.clasificacion.tasas.eje}%</span> con eje
                    </span>
                    <span className="text-muted-foreground">
                      <span className="font-medium text-foreground">{data.clasificacion.tasas.lente}%</span> con lente
                    </span>
                    <span className="text-muted-foreground">
                      <span className="font-medium text-foreground">{data.clasificacion.tasas.sentimiento}%</span> con sentimiento
                    </span>
                  </div>
                </div>
              </PipelineCard>

              {/* ─── 3. PRODUCCIÓN ─── */}
              <PipelineCard
                icon={Package}
                label="Producción"
                status={data.produccion.status}
                color="emerald"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <MiniMetric label="Productos" value={data.produccion.productos.total} icon={FileText} accent="text-emerald-600 dark:text-emerald-400" />
                    <span className="text-[9px] text-muted-foreground">
                      +{data.produccion.productos.hoy} hoy · {data.produccion.productos.semana} sem
                    </span>
                  </div>
                  {data.produccion.porTipo.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {data.produccion.porTipo.map(pt => (
                        <Badge key={pt.tipo} variant="secondary" className="text-[8px] px-1.5 py-0 h-4">
                          {pt.tipo}: {pt.total}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {data.produccion.ultimoProducto && (
                    <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      Ultimo producto ({data.produccion.ultimoTipo}): {data.produccion.ultimoProductoHace}
                    </div>
                  )}
                </div>
              </PipelineCard>

              {/* ─── 4. DISTRIBUCIÓN ─── */}
              <PipelineCard
                icon={Send}
                label="Distribución"
                status={data.distribucion.status}
                color="amber"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <MiniMetric label="Envíos" value={data.distribucion.envios.total} icon={Send} accent="text-amber-600 dark:text-amber-400" />
                    <div className="flex items-center gap-2">
                      {data.distribucion.envios.exitosos > 0 && (
                        <span className="flex items-center gap-0.5 text-[9px] text-emerald-600">
                          <CheckCircle2 className="h-3 w-3" /> {data.distribucion.envios.exitosos}
                        </span>
                      )}
                      {data.distribucion.envios.fallidos > 0 && (
                        <span className="flex items-center gap-0.5 text-[9px] text-red-600">
                          <AlertTriangle className="h-3 w-3" /> {data.distribucion.envios.fallidos}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <MiniMetric label="Entregas" value={data.distribucion.entregas.total} />
                    <MiniMetric label="Suscriptores" value={data.distribucion.suscriptores} icon={Users} />
                  </div>
                  {data.distribucion.envios.total === 0 && (
                    <p className="text-[9px] text-muted-foreground italic">
                      Sin envíos registrados. Los envíos se activan al generar y distribuir productos.
                    </p>
                  )}
                </div>
              </PipelineCard>

              {/* ─── Actividad del sistema ─── */}
              <div className="flex items-center justify-between pt-1 border-t border-border/50">
                <div className="flex items-center gap-2 text-[9px] text-muted-foreground">
                  <Database className="h-3 w-3" />
                  <span>Jobs 24h:</span>
                  <span className="font-medium text-emerald-600">{data.sistema.jobs24h.completados} ok</span>
                  {data.sistema.jobs24h.fallidos > 0 && (
                    <span className="font-medium text-red-600">{data.sistema.jobs24h.fallidos} fallidos</span>
                  )}
                </div>
                <span className="text-[8px] text-muted-foreground/60">
                  {new Date(data.timestamp).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </>
          ) : (
            <div className="py-6 text-center text-muted-foreground">
              <Inbox className="h-5 w-5 mx-auto mb-1.5 opacity-40" />
              <p className="text-xs">Sin datos del pipeline</p>
            </div>
          )}
        </CardContent>
      </Card>
    </CollapsibleWidget>
  );
}

// ─── Sub-componente: Tarjeta de etapa ─────────────────────────

function PipelineCard({
  icon: Icon, label, status, color, children,
}: {
  icon: React.ElementType;
  label: string;
  status: string;
  color: string;
  children: React.ReactNode;
}) {
  const borderColor = color === 'blue' ? 'border-blue-500/20 hover:border-blue-500/40'
    : color === 'violet' ? 'border-violet-500/20 hover:border-violet-500/40'
    : color === 'emerald' ? 'border-emerald-500/20 hover:border-emerald-500/40'
    : 'border-amber-500/20 hover:border-amber-500/40';

  const bgColor = color === 'blue' ? 'bg-blue-500/5'
    : color === 'violet' ? 'bg-violet-500/5'
    : color === 'emerald' ? 'bg-emerald-500/5'
    : 'bg-amber-500/5';

  const iconColor = color === 'blue' ? 'text-blue-600 dark:text-blue-400'
    : color === 'violet' ? 'text-violet-600 dark:text-violet-400'
    : color === 'emerald' ? 'text-emerald-600 dark:text-emerald-400'
    : 'text-amber-600 dark:text-amber-400';

  return (
    <div className={`rounded-lg border p-2.5 transition-colors ${borderColor} ${bgColor}`}>
      <div className="flex items-center gap-2 mb-1.5">
        <Icon className={`h-3.5 w-3.5 ${iconColor}`} />
        <span className="text-[11px] font-semibold text-foreground">{label}</span>
        <div className="ml-auto">
          <StatusDot status={status} />
        </div>
      </div>
      {children}
    </div>
  );
}
