'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useDashboardStore } from '@/stores/useDashboardStore';
import { KPICard } from '@/components/shared/KPICard';
import { PARTIDO_COLORS, PARTIDO_TEXT_COLORS } from '@/constants/ui';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  TrendingUp,
  Newspaper,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Users,
  BarChart3,
  Radio,
} from 'lucide-react';

// ─── Local types ───

interface IndicadorItem {
  slug: string;
  nombre: string;
  categoria: string;
  fuente: string;
  periodicidad: string;
  unidad: string;
  ultimoValor: {
    valor: string;
    valorRaw: number;
    fecha: string;
    confiable: boolean;
    fechaCaptura: string;
  } | null;
}

interface IndicadorHistorico {
  slug: string;
  nombre: string;
  categoria: string;
  categoriaLabel: string;
  fuente: string;
  periodicidad: string;
  unidad: string;
  tier: number;
  activo: boolean;
  historial: Array<{
    fecha: string;
    fechaHora: string;
    valor: string;
    valorRaw: number;
    confiable: boolean;
  }>;
  ultimoValor: {
    valor: string;
    valorRaw: number;
    fecha: string;
    confiable: boolean;
    fechaCaptura: string;
  } | null;
  estadisticas: {
    periodo: string;
    puntos: number;
    min: number;
    max: number;
    promedio: number;
    variacionPeriodo: string;
    tendencia: string;
    diffPct: number;
  } | null;
}

interface IndicadoresHistorico {
  periodo: string;
  fechaInicio: string;
  fechaFin: string;
  totalIndicadores: number;
  conDatos: number;
  porCategoria: Record<string, { total: number; conDatos: number }>;
  indicadores: IndicadorHistorico[];
}

// ─── Component ───

export function IndicadoresView() {
  const data = useDashboardStore((s) => s.data);

  // ── Local state ──
  const [indicadoresTab, setIndicadoresTab] = useState<'macro' | 'presencia' | 'conflictividad'>('macro');
  const [indicadoresPeriodo, setIndicadoresPeriodo] = useState('30d');
  const [indicadoresCategoria, setIndicadoresCategoria] = useState('');
  const [indicadores, setIndicadores] = useState<Array<IndicadorItem> | null>(null);
  const [indicadoresHistorico, setIndicadoresHistorico] = useState<IndicadoresHistorico | null>(null);
  const [indicadoresLoading, setIndicadoresLoading] = useState(false);
  const [capturaIndicadoresLoading, setCapturaIndicadoresLoading] = useState(false);

  // ── Mount + reload effect ──

  const reloadTrigger = useState(0)[1];

  // Memoize filtered social indicadores for conflictividad tab
  const indicadoresSocial = useMemo(
    () => indicadores?.filter((i) => i.categoria === 'social') || [],
    [indicadores],
  );
  const indicadoresSocialConDatos = useMemo(
    () => indicadoresSocial.filter((i) => i.ultimoValor !== null).length,
    [indicadoresSocial],
  );

  // Memoize social indicadores from historico for conflictividad tab
  const indicadoresHistoricoSocial = useMemo(
    () => indicadoresHistorico?.indicadores.filter((i) => i.categoria === 'social') || [],
    [indicadoresHistorico],
  );

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    (async () => {
      setIndicadoresLoading(true);
      try {
        // Fully parallel: capture + historico via Promise.all
        const params = new URLSearchParams({ periodo: indicadoresPeriodo });
        if (indicadoresCategoria) params.set('categoria', indicadoresCategoria);

        const [resCapture, resHist] = await Promise.all([
          fetch('/api/indicadores/capture', { signal: controller.signal }),
          fetch(`/api/indicadores/historico?${params}`, { signal: controller.signal }),
        ]);

        const [jsonCapture, jsonHist] = await Promise.all([
          resCapture.json(),
          resHist.json(),
        ]);

        if (!cancelled) {
          if (jsonCapture.exito) setIndicadores(jsonCapture.indicadores || []);
          if (!jsonHist.error) setIndicadoresHistorico(jsonHist);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        /* silent */
      } finally {
        if (!cancelled) setIndicadoresLoading(false);
      }
    })();
    return () => { cancelled = true; controller.abort(); };
  }, [indicadoresPeriodo, indicadoresCategoria, reloadTrigger]);

  // ── Callbacks ──

  const handleCapturaIndicadores = async () => {
    setCapturaIndicadoresLoading(true);
    try {
      await fetch('/api/indicadores/capture', { method: 'POST' });
      reloadTrigger(n => n + 1);
    } catch { /* silent */ } finally {
      setCapturaIndicadoresLoading(false);
    }
  };

  // ── Render ──

  return (
    <div className="space-y-4">
      {/* ── Tab Navigation ── */}
      <div className="flex items-center gap-1 p-1 rounded-lg bg-muted/50 border border-border">
        {([
          { id: 'macro' as const, label: 'Macroeconomía', icon: TrendingUp, desc: 'TC, reserva, inflación, minería' },
          { id: 'presencia' as const, label: 'Presencia Mediática', icon: Newspaper, desc: 'Menciones por partido, ranking de actores' },
          { id: 'conflictividad' as const, label: 'Conflictividad', icon: AlertTriangle, desc: 'Tensión social y escalamiento' },
        ]).map(tab => {
          const TabIcon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setIndicadoresTab(tab.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium transition-colors flex-1 justify-center ${
                indicadoresTab === tab.id
                  ? 'bg-background text-foreground shadow-sm border border-border'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
              }`}
            >
              <TabIcon className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
            </button>
          );
        })}
      </div>

      {/* ═════════ TAB: MACROECONOMÍA ═════════ */}
      {indicadoresTab === 'macro' && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  Indicadores Macroeconómicos
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  {indicadoresHistorico
                    ? `${indicadoresHistorico.conDatos} de ${indicadoresHistorico.totalIndicadores} con datos · Período: ${indicadoresPeriodo}`
                    : 'Datos macroeconómicos del ecosistema boliviano'}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {['7d', '30d', '90d', '1y'].map(p => (
                  <button
                    key={p}
                    onClick={() => { setIndicadoresPeriodo(p); reloadTrigger(n => n + 1); }}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-colors ${
                      indicadoresPeriodo === p
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    {p === '7d' ? '7 días' : p === '30d' ? '30 días' : p === '90d' ? '90 días' : '1 año'}
                  </button>
                ))}
                <select
                  value={indicadoresCategoria}
                  onChange={(e) => { setIndicadoresCategoria(e.target.value); reloadTrigger(n => n + 1); }}
                  className="text-[10px] border border-border rounded-lg px-2 py-1 bg-background text-foreground"
                >
                  <option value="">Todas las categorías</option>
                  <option value="monetario">Monetario</option>
                  <option value="minero">Minero</option>
                  <option value="social">Social</option>
                  <option value="economico">Económico</option>
                  <option value="hidrocarburos">Hidrocarburos</option>
                  <option value="climatico">Climático</option>
                </select>
                <Button variant="outline" size="sm" onClick={handleCapturaIndicadores} disabled={capturaIndicadoresLoading} className="text-xs gap-1">
                  {capturaIndicadoresLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                  Capturar
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {/* KPIs de cobertura */}
            {indicadoresHistorico && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                <div className="text-center p-2 rounded bg-background">
                  <p className="text-lg font-bold text-foreground">{indicadoresHistorico.totalIndicadores}</p>
                  <p className="text-[10px] text-muted-foreground">Indicadores</p>
                </div>
                <div className="text-center p-2 rounded bg-emerald-50 dark:bg-emerald-950/20">
                  <p className="text-lg font-bold text-emerald-600">{indicadoresHistorico.conDatos}</p>
                  <p className="text-[10px] text-muted-foreground">Con datos</p>
                </div>
                {indicadoresHistorico.porCategoria && Object.entries(indicadoresHistorico.porCategoria).map(([cat, catData]) => (
                  <div key={cat} className="text-center p-2 rounded bg-background">
                    <p className="text-lg font-bold text-foreground">{catData.conDatos}</p>
                    <p className="text-[10px] text-muted-foreground capitalize">{cat}</p>
                  </div>
                )).slice(0, 2)}
              </div>
            )}

            {/* Tabla de indicadores con estadísticas */}
            {indicadoresLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : indicadoresHistorico && indicadoresHistorico.indicadores.length > 0 ? (
              <div className="space-y-2 max-h-[700px] overflow-y-auto custom-scrollbar">
                {indicadoresHistorico.indicadores.map((ind) => {
                  const tieneValor = ind.ultimoValor !== null;
                  const stats = ind.estadisticas;
                  const catColor = ind.categoria === 'monetario' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                    : ind.categoria === 'minero' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                    : ind.categoria === 'social' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                    : 'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300';

                  return (
                    <div key={ind.slug} className="p-3 rounded-lg border border-border hover:bg-muted/20 transition-colors">
                      {/* Fila principal */}
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${catColor}`}>{ind.categoriaLabel}</span>
                          <span className="text-xs font-semibold text-foreground truncate">{ind.nombre}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {stats && (
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                              stats.tendencia === 'ascendente' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                              : stats.tendencia === 'descendente' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                              : 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400'
                            }`}>
                              {stats.tendencia === 'ascendente' ? '↑' : stats.tendencia === 'descendente' ? '↓' : '→'} {stats.diffPct > 0 ? '+' : ''}{stats.diffPct}%
                            </span>
                          )}
                          <p className={`text-sm font-bold ${tieneValor ? 'text-foreground' : 'text-muted-foreground'}`}>
                            {tieneValor ? ind.ultimoValor!.valor : 'N/D'}
                          </p>
                          <span className="text-[9px] text-muted-foreground">{ind.unidad}</span>
                        </div>
                      </div>

                      {/* Estadísticas expandidas */}
                      {stats && (
                        <div className="mt-2 grid grid-cols-2 sm:grid-cols-5 gap-2 pl-1">
                          <div className="text-[9px] text-muted-foreground">
                            <span className="font-medium text-foreground">{stats.puntos}</span> pts en {stats.periodo}
                          </div>
                          <div className="text-[9px] text-muted-foreground">
                            Mín: <span className="font-medium text-foreground">{stats.min}</span>
                          </div>
                          <div className="text-[9px] text-muted-foreground">
                            Máx: <span className="font-medium text-foreground">{stats.max}</span>
                          </div>
                          <div className="text-[9px] text-muted-foreground">
                            Prom: <span className="font-medium text-foreground">{stats.promedio}</span>
                          </div>
                          <div className="text-[9px] text-muted-foreground">
                            Var: <span className={`font-medium ${
                              stats.variacionPeriodo.startsWith('+') ? 'text-emerald-600'
                              : stats.variacionPeriodo.startsWith('-') ? 'text-red-600' : 'text-foreground'
                            }`}>{stats.variacionPeriodo}</span>
                          </div>
                        </div>
                      )}

                      {/* Mini serie temporal */}
                      {ind.historial.length > 1 && (
                        <div className="mt-2 flex items-end gap-px h-8 pl-1">
                          {ind.historial.slice(-20).map((h, i) => {
                            const vals = ind.historial.map(v => v.valorRaw).filter(v => v > 0);
                            const minV = Math.min(...vals);
                            const maxV = Math.max(...vals);
                            const range = maxV - minV || 1;
                            const height = Math.max(4, ((h.valorRaw - minV) / range) * 100);
                            return (
                              <div
                                key={i}
                                className="flex-1 rounded-t-sm bg-primary/30 hover:bg-primary/50 transition-colors min-w-[3px] cursor-default"
                                style={{ height: `${height}%` }}
                                title={`${h.fecha}: ${h.valor} ${ind.unidad}`}
                              />
                            );
                          })}
                        </div>
                      )}

                      {/* Fuente y última captura */}
                      <div className="mt-1.5 flex items-center justify-between pl-1">
                        <span className="text-[9px] text-muted-foreground">Fuente: {ind.fuente}</span>
                        {tieneValor && ind.ultimoValor!.fechaCaptura && (
                          <span className="text-[9px] text-muted-foreground">
                            {new Date(ind.ultimoValor!.fechaCaptura).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-xs text-muted-foreground">Sin datos de indicadores para el período seleccionado.</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ═════════ TAB: PRESENCIA MEDIÁTICA ═════════ */}
      {indicadoresTab === 'presencia' && (
        <div className="space-y-4">
          {/* KPIs de presencia */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KPICard
              icon={<Users className="h-5 w-5" />}
              value={data?.mencionesSemana || 0}
              label="Menciones semana"
              subtext={`${data?.mencionesHoy || 0} hoy`}
              colorClass="text-sky-600 dark:text-sky-400"
            />
            <KPICard
              icon={<BarChart3 className="h-5 w-5" />}
              value={data?.mencionesPorPartido?.length || 0}
              label="Partidos monitoreados"
              colorClass="text-purple-600 dark:text-purple-400"
            />
            <KPICard
              icon={<TrendingUp className="h-5 w-5" />}
              value={data?.topActores?.[0]?.mencionesCount || 0}
              label="Máx. menciones individuales"
              subtext={data?.topActores?.[0]?.nombre || '—'}
              colorClass="text-amber-600 dark:text-amber-400"
            />
            <KPICard
              icon={<Radio className="h-5 w-5" />}
              value={data?.totalMedios || 0}
              label="Medios en monitoreo"
              subtext={`${data?.fuentesPorNivel?.length || 0} niveles de fuentes`}
              colorClass="text-emerald-600 dark:text-emerald-400"
            />
          </div>

          {/* Top 10 presencia mediática */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    Top 10 presencia mediática
                  </CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    Actores con mayor presencia mediática · {indicadoresPeriodo === '7d' ? 'últimos 7 días' : indicadoresPeriodo === '30d' ? 'últimos 30 días' : indicadoresPeriodo === '90d' ? 'últimos 90 días' : 'último año'}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              {data?.topActores && data.topActores.length > 0 ? (
                <div className="space-y-2">
                  {data.topActores.slice(0, 10).map((p, i) => {
                    const maxCount = data.topActores[0].mencionesCount || 1;
                    return (
                      <div key={p.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-border hover:bg-muted/30 transition-colors">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                          i < 3 ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                        }`}>{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-semibold text-foreground truncate">{p.nombre}</p>
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium" style={{
                              backgroundColor: (PARTIDO_COLORS[p.partidoSigla] || '#6B7280') + '20',
                              color: PARTIDO_TEXT_COLORS[p.partidoSigla] || 'text-foreground',
                            }}>{p.partidoSigla}</span>
                            <span className="text-[9px] text-muted-foreground">{p.camara}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${PARTIDO_COLORS[p.partidoSigla] || 'bg-stone-500'}`}
                                style={{ width: `${Math.max((p.mencionesCount / maxCount) * 100, 3)}%` }} />
                            </div>
                            <span className="text-[10px] font-bold text-foreground shrink-0">{p.mencionesCount}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-8">Sin datos de presencia para el período seleccionado</p>
              )}
            </CardContent>
          </Card>

          {/* Menciones por partido */}
          <Card>
            <CardHeader className="pb-3">
              <div>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  Menciones por partido
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Distribución de menciones por agrupación política
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              {data?.mencionesPorPartido && data.mencionesPorPartido.length > 0 ? (
                <div className="space-y-2.5">
                  {data.mencionesPorPartido.map((p) => {
                    const maxCount = data.mencionesPorPartido[0].count || 1;
                    const total = data.mencionesPorPartido.reduce((s, x) => s + x.count, 0);
                    const pct = total > 0 ? Math.round((p.count / total) * 100) : 0;
                    return (
                      <div key={p.partido} className="p-2.5 rounded-lg border border-border hover:bg-muted/30 transition-colors">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className={`text-[11px] font-semibold ${PARTIDO_TEXT_COLORS[p.partido] || 'text-foreground'}`}>{p.partido}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-muted-foreground">{pct}%</span>
                            <span className="text-[11px] font-bold text-foreground">{p.count}</span>
                          </div>
                        </div>
                        <div className="h-3 bg-muted rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${PARTIDO_COLORS[p.partido] || 'bg-stone-500'}`}
                            style={{ width: `${Math.max((p.count / maxCount) * 100, 3)}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-8">Sin datos por partido</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ═════════ TAB: CONFLICTIVIDAD ═════════ */}
      {indicadoresTab === 'conflictividad' && (
        <div className="space-y-4">
          {/* KPIs de conflictividad */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {(() => {
              const escalamiento = indicadoresSocial.find(i => i.slug === 'conflictividad-escalamiento');
              const escValor = escalamiento?.ultimoValor?.valor || 'N/D';
              const esAlto = escValor.toLowerCase().includes('alto');
              const esMedio = escValor.toLowerCase().includes('medio');
              return (
                <>
                  <div className={`p-4 rounded-lg border ${esAlto ? 'border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20' : esMedio ? 'border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20' : 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20'}`}>
                    <p className="text-[10px] font-medium text-muted-foreground mb-1">Nivel de escalamiento</p>
                    <p className={`text-xl font-bold ${esAlto ? 'text-red-600 dark:text-red-400' : esMedio ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{escValor}</p>
                  </div>
                  <div className="p-4 rounded-lg border border-border bg-muted/30">
                    <p className="text-[10px] font-medium text-muted-foreground mb-1">Indicadores sociales</p>
                    <p className="text-xl font-bold text-foreground">{indicadoresSocial.length}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {indicadoresSocialConDatos} con datos
                    </p>
                  </div>
                  <div className="p-4 rounded-lg border border-border bg-muted/30">
                    <p className="text-[10px] font-medium text-muted-foreground mb-1">Período de análisis</p>
                    <p className="text-xl font-bold text-foreground">{indicadoresPeriodo === '7d' ? '7 días' : indicadoresPeriodo === '30d' ? '30 días' : indicadoresPeriodo === '90d' ? '90 días' : '1 año'}</p>
                  </div>
                </>
              );
            })()}
          </div>

          {/* Detalle de indicadores sociales */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                    Indicadores de conflictividad
                  </CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    Tensión social y escalamiento regional · ONION200
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {['7d', '30d', '90d', '1y'].map(p => (
                    <button
                      key={p}
                      onClick={() => { setIndicadoresPeriodo(p); reloadTrigger(n => n + 1); }}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-colors ${
                        indicadoresPeriodo === p
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      }`}
                    >
                      {p === '7d' ? '7d' : p === '30d' ? '30d' : p === '90d' ? '90d' : '1a'}
                    </button>
                  ))}
                  <Button variant="outline" size="sm" onClick={handleCapturaIndicadores} disabled={capturaIndicadoresLoading} className="text-xs gap-1">
                    {capturaIndicadoresLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              {indicadoresLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : indicadoresHistoricoSocial.length > 0 ? (
                <div className="space-y-3">
                  {indicadoresHistoricoSocial.map((ind) => {
                    const tieneValor = ind.ultimoValor !== null;
                    const stats = ind.estadisticas;
                    const esEscalamiento = ind.slug === 'conflictividad-escalamiento';
                    return (
                      <div key={ind.slug} className={`p-4 rounded-lg border transition-colors ${
                        esEscalamiento
                          ? 'border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20'
                          : 'border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-950/20'
                      }`}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
                              {esEscalamiento ? 'Global' : 'Análisis'}
                            </span>
                            <span className="text-xs font-semibold text-foreground">{ind.nombre}</span>
                            {tieneValor && (
                              <span className={`text-[9px] ${ind.ultimoValor!.confiable ? 'text-emerald-500' : 'text-amber-500'}`}>
                                {ind.ultimoValor!.confiable ? '✓ confiable' : '⚠ verificar'}
                              </span>
                            )}
                          </div>
                          <p className={`text-lg font-bold ${esEscalamiento && tieneValor && ind.ultimoValor!.valor.toLowerCase().includes('alto') ? 'text-red-600 dark:text-red-400' : 'text-foreground'}`}>
                            {tieneValor ? ind.ultimoValor!.valor : 'N/D'}
                          </p>
                        </div>
                        <p className="text-[10px] text-muted-foreground">{ind.unidad} · Fuente: {ind.fuente}</p>

                        {/* Estadísticas históricas */}
                        {stats && (
                          <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[9px] text-muted-foreground">
                            <div>Puntos: <span className="font-medium text-foreground">{stats.puntos}</span></div>
                            <div>Mín: <span className="font-medium text-foreground">{stats.min}</span></div>
                            <div>Máx: <span className="font-medium text-foreground">{stats.max}</span></div>
                            <div>Tendencia: <span className={`font-medium ${
                              stats.tendencia === 'ascendente' ? 'text-red-600' : stats.tendencia === 'descendente' ? 'text-emerald-600' : 'text-foreground'
                            }`}>{stats.tendencia}</span></div>
                          </div>
                        )}

                        {/* Mini serie temporal */}
                        {ind.historial.length > 1 && (
                          <div className="mt-2 flex items-end gap-px h-6">
                            {ind.historial.slice(-15).map((h, i) => {
                              const vals = ind.historial.map(v => v.valorRaw).filter(v => v > 0);
                              const minV = Math.min(...vals);
                              const maxV = Math.max(...vals);
                              const range = maxV - minV || 1;
                              const height = Math.max(4, ((h.valorRaw - minV) / range) * 100);
                              return (
                                <div
                                  key={i}
                                  className={`flex-1 rounded-t-sm min-w-[4px] cursor-default transition-colors ${esEscalamiento ? 'bg-red-400/40 hover:bg-red-400/70' : 'bg-orange-400/40 hover:bg-orange-400/70'}`}
                                  style={{ height: `${height}%` }}
                                  title={`${h.fecha}: ${h.valor}`}
                                />
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <p className="text-[10px] text-muted-foreground/60 mt-2 text-center">
                    Los indicadores de conflictividad se calculan a partir del análisis de menciones y keywords de protesta. Fuente: ONION200.
                  </p>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-xs text-muted-foreground">Sin indicadores de conflictividad para el período seleccionado.</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-1">Usa el botón de captura para obtener datos actualizados.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
