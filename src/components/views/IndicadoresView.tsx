'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Radio, Filter, Package, Send, Loader2,
  Newspaper, Eye, Tag, FileText, Users, Clock,
  CheckCircle2, AlertTriangle, XCircle,
  Database, TrendingUp, Globe, BarChart3,
  RefreshCw,
} from 'lucide-react';

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

type TabId = 'pipeline' | 'captura' | 'clasificacion' | 'produccion' | 'distribucion';

// ─── Status helpers ──────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { color: string; label: string }> = {
    ok: { color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300', label: 'OK' },
    warn: { color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300', label: 'Atención' },
    error: { color: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300', label: 'Error' },
    idle: { color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400', label: 'Inactivo' },
  };
  const c = cfg[status] || cfg.idle;
  return <Badge variant="outline" className={`text-[9px] px-1.5 py-0 h-4 font-medium ${c.color}`}>{c.label}</Badge>;
}

function KPICard({ icon: Icon, value, label, sub, accent }: {
  icon: React.ElementType; value: string | number; label: string; sub?: string; accent?: string;
}) {
  return (
    <div className="text-center p-3 rounded-lg border border-border/60 bg-background">
      <Icon className={`h-4 w-4 mx-auto mb-1.5 ${accent || 'text-muted-foreground'}`} />
      <p className={`text-xl font-bold tabular-nums ${accent || 'text-foreground'}`}>{value}</p>
      <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
      {sub && <p className="text-[9px] text-muted-foreground/70 mt-0.5">{sub}</p>}
    </div>
  );
}

function ProgressBar({ value, max, color, label }: {
  value: number; max: number; color: string; label: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">{value}/{max} ({pct}%)</span>
      </div>
      <div className="h-2 rounded-full bg-muted/60 overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────

export function IndicadoresView() {
  const [data, setData] = useState<PipelineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>('pipeline');
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/indicadores-summary');
      if (res.ok) {
        const json = await res.json();
        setData(json);
        setLastRefresh(new Date());
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <p className="text-sm">No se pudieron cargar los indicadores del pipeline</p>
      </div>
    );
  }

  const tabs: Array<{ id: TabId; label: string; icon: React.ElementType }> = [
    { id: 'pipeline', label: 'Pipeline Completo', icon: BarChart3 },
    { id: 'captura', label: 'Captura', icon: Radio },
    { id: 'clasificacion', label: 'Clasificación', icon: Filter },
    { id: 'produccion', label: 'Producción', icon: Package },
    { id: 'distribucion', label: 'Distribución', icon: Send },
  ];

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Indicadores del Pipeline
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Datos operacionales en tiempo real de las 4 etapas del sistema DECODEX
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lastRefresh && (
            <span className="text-[9px] text-muted-foreground">
              Actualizado: {lastRefresh.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={fetchData} className="text-xs gap-1">
            <RefreshCw className="h-3 w-3" />
            Actualizar
          </Button>
        </div>
      </div>

      {/* ── Tab Navigation ── */}
      <div className="flex items-center gap-1 p-1 rounded-lg bg-muted/50 border border-border overflow-x-auto">
        {tabs.map(tab => {
          const TabIcon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-background text-foreground shadow-sm border border-border'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
              }`}
            >
              <TabIcon className="h-3.5 w-3.5 shrink-0" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── Tab Content ── */}
      {activeTab === 'pipeline' && <PipelineResumen data={data} />}
      {activeTab === 'captura' && <CapturaDetalle data={data} />}
      {activeTab === 'clasificacion' && <ClasificacionDetalle data={data} />}
      {activeTab === 'produccion' && <ProduccionDetalle data={data} />}
      {activeTab === 'distribucion' && <DistribucionDetalle data={data} />}
    </div>
  );
}

// ─── Sub-vistas ───────────────────────────────────────────────

function PipelineResumen({ data }: { data: PipelineData }) {
  return (
    <div className="space-y-4">
      {/* KPIs globales */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPICard icon={Newspaper} value={data.captura.menciones.total} label="Menciones" sub={`+${data.captura.menciones.hoy} hoy`} accent="text-blue-600 dark:text-blue-400" />
        <KPICard icon={Tag} value={data.clasificacion.tasas.eje + '%'} label="Tasa Clasificación" sub={`${data.clasificacion.ejes} ejes`} accent="text-violet-600 dark:text-violet-400" />
        <KPICard icon={FileText} value={data.produccion.productos.total} label="Productos" sub={`${data.produccion.reportes} reportes`} accent="text-emerald-600 dark:text-emerald-400" />
        <KPICard icon={Send} value={data.distribucion.envios.total} label="Envíos" sub={`${data.distribucion.suscriptores} suscriptores`} accent="text-amber-600 dark:text-amber-400" />
      </div>

      {/* Diagrama de flujo simplificado */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            Flujo del Pipeline
          </CardTitle>
          <CardDescription className="text-xs">
            Datos en tiempo real de cada etapa del sistema periodístico
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Captura */}
            <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Radio className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-xs font-semibold">Captura</span>
                </div>
                <StatusBadge status={data.captura.status} />
              </div>
              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between"><span className="text-muted-foreground">Menciones</span><span className="font-semibold">{data.captura.menciones.total}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Hoy</span><span>{data.captura.menciones.hoy}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Semana</span><span>{data.captura.menciones.semana}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Medios</span><span>{data.captura.medios}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Fuentes activas</span><span>{data.captura.fuentes.activas}</span></div>
                {data.captura.fuentes.degradadas > 0 && (
                  <div className="flex justify-between text-amber-600"><span>Degradadas</span><span className="font-medium">{data.captura.fuentes.degradadas}</span></div>
                )}
              </div>
            </div>

            {/* Clasificación */}
            <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                  <span className="text-xs font-semibold">Clasificación</span>
                </div>
                <StatusBadge status={data.clasificacion.status} />
              </div>
              <div className="space-y-1.5">
                <div className="text-[11px] flex justify-between"><span className="text-muted-foreground">Lentes</span><span className="font-semibold">{data.clasificacion.lentes}</span></div>
                <div className="text-[11px] flex justify-between"><span className="text-muted-foreground">Ejes temáticos</span><span className="font-semibold">{data.clasificacion.ejes}</span></div>
                <ProgressBar
                  value={data.clasificacion.mencionesClasificadas.conEje}
                  max={data.clasificacion.mencionesClasificadas.total}
                  color="bg-violet-500"
                  label="Con eje temático"
                />
                <ProgressBar
                  value={data.clasificacion.mencionesClasificadas.conLente}
                  max={data.clasificacion.mencionesClasificadas.total}
                  color="bg-fuchsia-500"
                  label="Con lente"
                />
                <ProgressBar
                  value={data.clasificacion.mencionesClasificadas.conSentimiento}
                  max={data.clasificacion.mencionesClasificadas.total}
                  color="bg-indigo-500"
                  label="Con sentimiento"
                />
              </div>
            </div>

            {/* Producción */}
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-xs font-semibold">Producción</span>
                </div>
                <StatusBadge status={data.produccion.status} />
              </div>
              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between"><span className="text-muted-foreground">Productos</span><span className="font-semibold">{data.produccion.productos.total}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Hoy</span><span>{data.produccion.productos.hoy}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Semana</span><span>{data.produccion.productos.semana}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Reportes</span><span>{data.produccion.reportes}</span></div>
                {data.produccion.ultimoProducto && (
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground pt-1">
                    <Clock className="h-3 w-3" />
                    Ultimo: {data.produccion.ultimoProductoHace}
                  </div>
                )}
                {data.produccion.porTipo.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {data.produccion.porTipo.map(pt => (
                      <Badge key={pt.tipo} variant="secondary" className="text-[8px] px-1.5 py-0 h-4">
                        {pt.tipo}: {pt.total}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Distribución */}
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Send className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <span className="text-xs font-semibold">Distribución</span>
                </div>
                <StatusBadge status={data.distribucion.status} />
              </div>
              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between"><span className="text-muted-foreground">Envíos</span><span className="font-semibold">{data.distribucion.envios.total}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Exitosos</span><span className="text-emerald-600">{data.distribucion.envios.exitosos}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Fallidos</span><span className={data.distribucion.envios.fallidos > 0 ? 'text-red-600 font-medium' : ''}>{data.distribucion.envios.fallidos}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Entregas</span><span>{data.distribucion.entregas.total}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Suscriptores</span><span>{data.distribucion.suscriptores}</span></div>
                {data.distribucion.envios.total > 0 && (
                  <ProgressBar
                    value={data.distribucion.envios.exitosos}
                    max={data.distribucion.envios.total}
                    color="bg-emerald-500"
                    label="Tasa de éxito"
                  />
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actividad del sistema */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Database className="h-4 w-4 text-muted-foreground" />
            Actividad del Sistema (24h)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="text-center p-3 rounded-lg border border-border/60">
              <p className="text-lg font-bold text-foreground">{data.sistema.jobs24h.completados}</p>
              <p className="text-[10px] text-muted-foreground">Jobs completados</p>
            </div>
            <div className="text-center p-3 rounded-lg border border-border/60">
              <p className={`text-lg font-bold ${data.sistema.jobs24h.fallidos > 0 ? 'text-red-600' : 'text-foreground'}`}>{data.sistema.jobs24h.fallidos}</p>
              <p className="text-[10px] text-muted-foreground">Jobs fallidos</p>
            </div>
            <div className="text-center p-3 rounded-lg border border-border/60">
              <p className="text-lg font-bold text-foreground">{data.captura.fuentes.activas + data.captura.fuentes.degradadas}</p>
              <p className="text-[10px] text-muted-foreground">Total fuentes</p>
            </div>
            <div className="text-center p-3 rounded-lg border border-border/60">
              <p className="text-lg font-bold text-foreground">{data.captura.medios}</p>
              <p className="text-[10px] text-muted-foreground">Medios registrados</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CapturaDetalle({ data }: { data: PipelineData }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Radio className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            Captura de Menciones
            <StatusBadge status={data.captura.status} />
          </CardTitle>
          <CardDescription className="text-xs">
            Monitoreo y recolección de menciones desde fuentes periodísticas
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KPICard icon={Newspaper} value={data.captura.menciones.total} label="Total menciones" accent="text-blue-600 dark:text-blue-400" />
            <KPICard icon={BarChart3} value={data.captura.menciones.hoy} label="Capturadas hoy" sub={data.captura.menciones.hoy === 0 ? 'Sin captura hoy' : 'Actividad reciente'} />
            <KPICard icon={TrendingUp} value={data.captura.menciones.semana} label="Esta semana" />
            <KPICard icon={Globe} value={data.captura.medios} label="Medios monitoreados" />
          </div>

          {/* Fuentes */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-foreground">Estado de Fuentes</h4>
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 text-center">
                <p className="text-lg font-bold text-emerald-600">{data.captura.fuentes.activas}</p>
                <p className="text-[10px] text-muted-foreground">Activas</p>
              </div>
              <div className="p-3 rounded-lg border border-amber-500/20 bg-amber-500/5 text-center">
                <p className={`text-lg font-bold ${data.captura.fuentes.degradadas > 0 ? 'text-amber-600' : 'text-foreground'}`}>{data.captura.fuentes.degradadas}</p>
                <p className="text-[10px] text-muted-foreground">Degradadas</p>
              </div>
              <div className="p-3 rounded-lg border border-border/60 text-center">
                <p className="text-lg font-bold text-foreground">{data.captura.fuentes.activas + data.captura.fuentes.degradadas}</p>
                <p className="text-[10px] text-muted-foreground">Total</p>
              </div>
            </div>
          </div>

          {/* Menciones por nivel */}
          {data.captura.porNivel.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-foreground">Menciones por Nivel de Medio</h4>
              <div className="space-y-1.5">
                {data.captura.porNivel.map(n => (
                  <div key={n.nivel} className="flex items-center gap-2 text-[11px]">
                    <span className="text-muted-foreground w-16">Nivel {n.nivel}</span>
                    <div className="flex-1 h-3 rounded-full bg-muted/60 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-blue-500 transition-all duration-500"
                        style={{ width: `${data.captura.menciones.total > 0 ? (n.total / data.captura.menciones.total) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="font-medium tabular-nums w-8 text-right">{n.total}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Ultima captura */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground border-t border-border/50 pt-3">
            <Clock className="h-3.5 w-3.5" />
            <span>Ultima captura registrada: <strong className="text-foreground">{data.captura.ultimaCapturaHace}</strong></span>
            {data.captura.ultimaCaptura && (
              <span className="text-[9px] ml-auto">
                {new Date(data.captura.ultimaCaptura).toLocaleString('es-BO')}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ClasificacionDetalle({ data }: { data: PipelineData }) {
  const c = data.clasificacion;
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Filter className="h-4 w-4 text-violet-600 dark:text-violet-400" />
            Clasificación de Menciones
            <StatusBadge status={c.status} />
          </CardTitle>
          <CardDescription className="text-xs">
            Asignación de ejes temáticos, lentes analíticos y sentimiento
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <KPICard icon={Tag} value={c.lentes} label="Lentes definidos" accent="text-violet-600 dark:text-violet-400" />
            <KPICard icon={Eye} value={c.ejes} label="Ejes temáticos" accent="text-indigo-600 dark:text-indigo-400" />
            <KPICard icon={BarChart3} value={c.mencionesClasificadas.total} label="Total menciones" />
          </div>

          {/* Tasas de clasificación */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-foreground">Cobertura de Clasificación</h4>
            <ProgressBar
              value={c.mencionesClasificadas.conEje}
              max={c.mencionesClasificadas.total}
              color="bg-violet-500"
              label="Eje temático asignado"
            />
            <ProgressBar
              value={c.mencionesClasificadas.conLente}
              max={c.mencionesClasificadas.total}
              color="bg-fuchsia-500"
              label="Lente analítico asignado"
            />
            <ProgressBar
              value={c.mencionesClasificadas.conSentimiento}
              max={c.mencionesClasificadas.total}
              color="bg-indigo-500"
              label="Sentimiento identificado"
            />
          </div>

          {/* Detalle numérico */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-lg border border-border/60 text-center">
              <p className="text-lg font-bold text-violet-600">{c.tasas.eje}%</p>
              <p className="text-[10px] text-muted-foreground">Con eje</p>
              <p className="text-[9px] text-muted-foreground/70">{c.mencionesClasificadas.conEje} menciones</p>
            </div>
            <div className="p-3 rounded-lg border border-border/60 text-center">
              <p className="text-lg font-bold text-fuchsia-600">{c.tasas.lente}%</p>
              <p className="text-[10px] text-muted-foreground">Con lente</p>
              <p className="text-[9px] text-muted-foreground/70">{c.mencionesClasificadas.conLente} menciones</p>
            </div>
            <div className="p-3 rounded-lg border border-border/60 text-center">
              <p className="text-lg font-bold text-indigo-600">{c.tasas.sentimiento}%</p>
              <p className="text-[10px] text-muted-foreground">Con sentimiento</p>
              <p className="text-[9px] text-muted-foreground/70">{c.mencionesClasificadas.conSentimiento} menciones</p>
            </div>
          </div>

          {c.tasas.eje === 0 && (
            <div className="flex items-center gap-2 p-3 rounded-lg border border-amber-500/20 bg-amber-500/5">
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
              <p className="text-[11px] text-amber-700 dark:text-amber-400">
                Ninguna mención tiene ejes temáticos asignados. La clasificación automática o manual necesita activarse para enriquecer las menciones capturadas.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ProduccionDetalle({ data }: { data: PipelineData }) {
  const p = data.produccion;
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Package className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            Producción de Productos
            <StatusBadge status={p.status} />
          </CardTitle>
          <CardDescription className="text-xs">
            Boletines, reportes y productos generados por el sistema
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KPICard icon={FileText} value={p.productos.total} label="Productos" accent="text-emerald-600 dark:text-emerald-400" />
            <KPICard icon={BarChart3} value={p.productos.hoy} label="Generados hoy" />
            <KPICard icon={TrendingUp} value={p.productos.semana} label="Esta semana" />
            <KPICard icon={Database} value={p.reportes} label="Total reportes" />
          </div>

          {/* Productos por tipo */}
          {p.porTipo.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-foreground">Productos por Tipo</h4>
              <div className="space-y-2">
                {p.porTipo.map(pt => (
                  <div key={pt.tipo} className="flex items-center gap-2 text-[11px]">
                    <span className="text-muted-foreground w-48 truncate">{pt.tipo}</span>
                    <div className="flex-1 h-3 rounded-full bg-muted/60 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                        style={{ width: `${p.productos.total > 0 ? (pt.total / p.productos.total) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="font-medium tabular-nums w-8 text-right">{pt.total}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Productos por estado */}
          {p.porEstado.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-foreground">Productos por Estado</h4>
              <div className="flex flex-wrap gap-2">
                {p.porEstado.map(pe => {
                  const estadoColor = pe.estado === 'completado' ? 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/40'
                    : pe.estado === 'pendiente' ? 'text-amber-600 bg-amber-100 dark:bg-amber-900/40'
                    : pe.estado === 'fallido' ? 'text-red-600 bg-red-100 dark:bg-red-900/40'
                    : 'text-slate-600 bg-slate-100 dark:bg-slate-800';
                  return (
                    <Badge key={pe.estado} variant="outline" className={`text-[9px] px-2 py-0.5 h-5 font-medium ${estadoColor}`}>
                      {pe.estado}: {pe.total}
                    </Badge>
                  );
                })}
              </div>
            </div>
          )}

          {/* Ultimo producto */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground border-t border-border/50 pt-3">
            <Clock className="h-3.5 w-3.5" />
            <span>
              Ultimo producto generado: <strong className="text-foreground">{p.ultimoProductoHace}</strong>
              {p.ultimoTipo && <span className="text-[10px] ml-1">({p.ultimoTipo})</span>}
            </span>
            {p.ultimoProducto && (
              <span className="text-[9px] ml-auto">
                {new Date(p.ultimoProducto).toLocaleString('es-BO')}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function DistribucionDetalle({ data }: { data: PipelineData }) {
  const d = data.distribucion;
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Send className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            Distribución y Entregas
            <StatusBadge status={d.status} />
          </CardTitle>
          <CardDescription className="text-xs">
            Envíos de boletines y reportes a suscriptores
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KPICard icon={Send} value={d.envios.total} label="Envíos totales" accent="text-amber-600 dark:text-amber-400" />
            <KPICard icon={CheckCircle2} value={d.envios.exitosos} label="Exitosos" sub={d.envios.total > 0 ? `${d.envios.tasaExito}%` : undefined} />
            <KPICard icon={Users} value={d.suscriptores} label="Suscriptores" />
            <KPICard icon={BarChart3} value={d.entregas.hoy} label="Entregas hoy" />
          </div>

          {/* Tasa de éxito */}
          {d.envios.total > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-foreground">Tasa de Entrega</h4>
              <ProgressBar
                value={d.envios.exitosos}
                max={d.envios.total}
                color={d.envios.tasaExito >= 90 ? 'bg-emerald-500' : d.envios.tasaExito >= 50 ? 'bg-amber-500' : 'bg-red-500'}
                label="Envíos exitosos"
              />
            </div>
          )}

          {/* Envíos fallidos */}
          {d.envios.fallidos > 0 && (
            <div className="flex items-center gap-2 p-3 rounded-lg border border-red-500/20 bg-red-500/5">
              <XCircle className="h-4 w-4 text-red-500 shrink-0" />
              <p className="text-[11px] text-red-700 dark:text-red-400">
                {d.envios.fallidos} envío(s) fallido(s) requieren atención. Verifica la configuración de canales y suscriptores.
              </p>
            </div>
          )}

          {d.envios.total === 0 && (
            <div className="flex items-center gap-2 p-4 rounded-lg border border-dashed border-muted-foreground/30 bg-muted/20">
              <AlertTriangle className="h-5 w-5 text-muted-foreground shrink-0" />
              <div>
                <p className="text-xs font-medium text-muted-foreground">Sin envíos registrados</p>
                <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                  Los envíos se activan al generar productos y configurar suscriptores con canales de entrega (email, WhatsApp, etc.)
                </p>
              </div>
            </div>
          )}

          {/* Último envío */}
          {d.ultimoEnvio && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground border-t border-border/50 pt-3">
              <Clock className="h-3.5 w-3.5" />
              <span>Ultimo envío: <strong className="text-foreground">{d.ultimoEnvioHace}</strong></span>
              <span className="text-[9px] ml-auto">
                {new Date(d.ultimoEnvio).toLocaleString('es-BO')}
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
