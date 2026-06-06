'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  FileBarChart,
  CheckCircle2,
  FileCheck,
  Package,
  Activity,
  BarChart3,
  Loader2,
  RefreshCw,
  Zap,
  Eye,
  Mail,
  FileText,
} from 'lucide-react';
import { KPICard } from '@/components/shared/KPICard';
import { GeneratorPreviewModal } from '@/components/views/GeneratorPreviewModal';
import { GeneratorDedicatedPanel } from '@/components/views/GeneratorDedicatedPanel';
import { useDashboardStore } from '@/stores/useDashboardStore';
import { ALL_PRODUCTS, PRODUCT_CATEGORIES, CANAL_LABELS, FRECUENCIA_LABELS } from '@/constants/nav';
import { PRODUCTOS } from '@/constants/products';

export function GeneradoresView() {
  const { setError } = useDashboardStore();

  // ─── Local State ───
  const [genStats, setGenStats] = useState<{
    periodo: string;
    totalPeriodo: number;
    totalHistorico: number;
    enviadosPeriodo: number;
    porTipo: Array<{ tipo: string; count: number }>;
    porTipoHistorico: Array<{ tipo: string; count: number }>;
    ultimoPorTipo: Array<{
      tipo: string;
      ultimo: { id: string; fechaCreacion: string; totalMenciones: number; sentimientoPromedio: number; resumen: string; enviado: boolean } | null;
      totalGenerados: number;
    }>;
    tendencias: Array<{ fecha: string; total: number }>;
  } | null>(null);
  const [genStatsLoading, setGenStatsLoading] = useState(false);
  const [genPeriodo, setGenPeriodo] = useState('hoy');
  const [generandoTipo, setGenerandoTipo] = useState<string | null>(null);
  const [previewReporte, setPreviewReporte] = useState<Record<string, unknown> | null>(null);

  // Generadores dedicados (El Termómetro / Saldo del Día)
  const [selectedGenerator, setSelectedGenerator] = useState<string | null>(null);
  const [generatorFecha, setGeneratorFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [generatorFiltros, setGeneratorFiltros] = useState<Record<string, string[]>>({});
  const [generatorData, setGeneratorData] = useState<Record<string, unknown> | null>(null);
  const [generatorDataLoading, setGeneratorDataLoading] = useState(false);
  const [generatorGenerating, setGeneratorGenerating] = useState(false);

  // Memoize operational products count
  const operationalCount = useMemo(
    () => ALL_PRODUCTS.filter((p) => p.estado === 'operativo').length,
    [],
  );

  // Memoize max count for bar chart
  const maxPorTipoCount = useMemo(
    () => Math.max(...(genStats?.porTipo.map((t) => t.count) || [1]), 1),
    [genStats?.porTipo],
  );

  // Memoize max trend value
  const maxTendencia = useMemo(
    () => Math.max(...(genStats?.tendencias.map((x) => x.total) || [1]), 1),
    [genStats?.tendencias],
  );
  const [reloadTrigger, setReloadTrigger] = useState(0);

  // ─── Callbacks ───

  const loadGenStats = useCallback(async (periodo?: string) => {
    setGenStatsLoading(true);
    try {
      const p = periodo || genPeriodo;
      const res = await fetch(`/api/reportes/stats?periodo=${p}`);
      const json = await res.json();
      setGenStats(json);
    } catch {
      // silent
    } finally {
      setGenStatsLoading(false);
    }
  }, [genPeriodo]);

  const handleGenerarProducto = async (tipo: string) => {
    const config = PRODUCTOS[tipo as keyof typeof PRODUCTOS]?.generador;

    // Productos dedicados: abren panel con preview antes de generar
    if (config?.tipo === 'dedicado' && config.requierePreview) {
      const today = new Date().toISOString().slice(0, 10);
      setSelectedGenerator(tipo);
      setGeneratorFecha(today);
      setGeneratorFiltros({});
      setGeneratorData(null);
      loadGeneratorData(tipo, today);
      return;
    }

    // Productos genéricos: generan directamente sin preview
    setGenerandoTipo(tipo);
    setError('');
    try {
      const res = await fetch('/api/reportes/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo }),
      });
      const json = await res.json();
      if (json.error) {
        setError(json.error);
      } else {
        await loadGenStats();
      }
    } catch {
      setError('Error al generar producto');
    } finally {
      setGenerandoTipo(null);
    }
  };

  // Cargar datos del generador dedicado
  const loadGeneratorData = useCallback(async (tipo: string, fecha: string, ejeSlug?: string) => {
    setGeneratorDataLoading(true);
    setGeneratorData(null);
    try {
      let url = `/api/reportes/generator-data?tipo=${tipo}&fecha=${fecha}`;
      if (ejeSlug) url += `&ejeSlug=${encodeURIComponent(ejeSlug)}`;
      const res = await fetch(url);
      const json = await res.json();
      if (json.error) {
        setError(json.error);
      } else {
        setGeneratorData(json);
      }
    } catch {
      setError('Error al cargar datos del generador');
    } finally {
      setGeneratorDataLoading(false);
    }
  }, [setError]);

  // Seleccionar eje para El Foco
  const selectGeneratorEje = (ejeSlug: string) => {
    setGeneratorFiltros({ eje: [ejeSlug] });
    if (selectedGenerator) {
      loadGeneratorData(selectedGenerator, generatorFecha, ejeSlug);
    }
  };

  // Volver a selección de ejes en El Foco
  const clearGeneratorEje = () => {
    setGeneratorFiltros({});
    if (selectedGenerator) {
      loadGeneratorData(selectedGenerator, generatorFecha);
    }
  };

  // Toggle eje en filtros del generador
  const toggleGeneratorEje = (ejeSlug: string) => {
    setGeneratorFiltros(prev => {
      const current = prev.ejes || [];
      const updated = current.includes(ejeSlug)
        ? current.filter(s => s !== ejeSlug)
        : [...current, ejeSlug];
      return { ...prev, ejes: updated };
    });
  };

  // Generar desde el panel dedicado
  const handleGenerateFromPanel = async () => {
    if (!selectedGenerator) return;
    setGeneratorGenerating(true);
    setError('');
    try {
      const ejesSeleccionados = generatorFiltros.ejes?.length ? generatorFiltros.ejes : undefined;
      const res = await fetch('/api/reportes/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: selectedGenerator,
          fecha: generatorFecha,
          ejesSeleccionados,
        }),
      });
      const json = await res.json();
      if (json.error) {
        setError(json.error);
      } else {
        setSelectedGenerator(null);
        setGeneratorFiltros({});
        setGeneratorData(null);
        await loadGenStats();
      }
    } catch {
      setError('Error al generar producto');
    } finally {
      setGeneratorGenerating(false);
    }
  };

  const closeGeneratorPanel = () => {
    setSelectedGenerator(null);
    setGeneratorFiltros({});
    setGeneratorData(null);
  };

  // Cambiar fecha del generador y recargar datos
  const handleGeneratorFechaChange = (newFecha: string) => {
    setGeneratorFecha(newFecha);
    if (selectedGenerator) {
      // For products with phases (e.g., El Foco), preserve the selected ejeSlug
      const config = PRODUCTOS[selectedGenerator as keyof typeof PRODUCTOS]?.generador;
      const currentEjeSlug = config?.tieneFases && generatorFiltros.eje?.length
        ? generatorFiltros.eje[0]
        : undefined;
      loadGeneratorData(selectedGenerator, newFecha, currentEjeSlug);
    }
  };

  // ─── Initial load + reload on period/trigger change ───
  useEffect(() => {
    if (reloadTrigger === 0 && genPeriodo !== 'hoy') return;
    let cancelled = false;
    (async () => {
      setGenStatsLoading(true);
      try {
        const res = await fetch(`/api/reportes/stats?periodo=${genPeriodo}`);
        const json = await res.json();
        if (!cancelled) setGenStats(json);
      } catch {
        // silent
      } finally {
        if (!cancelled) setGenStatsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [genPeriodo, reloadTrigger]);

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPICard icon={<FileBarChart className="h-5 w-5" />} value={genStats?.totalPeriodo || 0} label="Este periodo" colorClass="text-primary" />
        <KPICard icon={<CheckCircle2 className="h-5 w-5" />} value={genStats?.enviadosPeriodo || 0} label="Enviados" colorClass="text-emerald-600 dark:text-emerald-400" />
        <KPICard icon={<FileCheck className="h-5 w-5" />} value={genStats?.totalHistorico || 0} label="Total historico" colorClass="text-purple-600 dark:text-purple-400" />
        <KPICard icon={<Package className="h-5 w-5" />} value={operationalCount} label="Productos operativos" colorClass="text-amber-600 dark:text-amber-400" />
      </div>

      {/* Filtros de periodo + distribución por tipo */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Selector de periodo */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Periodo</label>
              <div className="flex items-center gap-1.5 flex-wrap">
                {(['hoy', 'semana', 'mes', 'historico'] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => { setGenPeriodo(p); setReloadTrigger(t => t + 1); }}
                    className={`text-[10px] px-2.5 py-1 rounded-full font-medium transition-colors ${
                      genPeriodo === p
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    {p === 'hoy' ? 'Hoy' : p === 'semana' ? 'Semana' : p === 'mes' ? 'Mes' : 'Historico'}
                  </button>
                ))}
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => loadGenStats()} disabled={genStatsLoading} className="text-xs gap-1 w-full">
              {genStatsLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              Actualizar
            </Button>
          </CardContent>
        </Card>

        {/* Distribución por tipo (periodo actual) */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                Generados por tipo
              </CardTitle>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                {genStats?.porTipo.length || 0} tipos con datos
              </span>
            </div>
            <CardDescription className="text-xs">
              {genPeriodo === 'hoy' ? 'Hoy' : genPeriodo === 'semana' ? 'Esta semana' : genPeriodo === 'mes' ? 'Este mes' : 'Historico'} ({genStats?.totalPeriodo || 0}) · Historico: {genStats?.totalHistorico || 0}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {genStatsLoading ? (
              <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : genStats && genStats.porTipo.length > 0 ? (
              <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                {genStats.porTipo.map((item) => {
                  const prodInfo = ALL_PRODUCTS.find(p => p.tipo === item.tipo);
                  const ProdIcon = prodInfo?.icon || FileText;
                  const maxCount = maxPorTipoCount;
                  const histItem = genStats.porTipoHistorico.find(h => h.tipo === item.tipo);
                  return (
                    <div key={item.tipo} className="flex items-center gap-3">
                      <div className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: (prodInfo?.color || '#6B7280') + '20' }}>
                        <ProdIcon className="h-3.5 w-3.5" style={{ color: prodInfo?.color || '#6B7280' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <p className="text-[11px] font-medium text-foreground truncate">{prodInfo?.nombre || item.tipo.replace(/_/g, ' ')}</p>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[11px] font-bold text-foreground">{item.count}</span>
                            {histItem && (
                              <span className="text-[9px] text-muted-foreground">/ {histItem.count} total</span>
                            )}
                          </div>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{
                            width: `${Math.max((item.count / maxCount) * 100, 3)}%`,
                            backgroundColor: prodInfo?.color || '#6B7280',
                          }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-xs text-muted-foreground">Sin reportes generados en este periodo</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tendencia 7 días */}
      {genStats && genStats.tendencias.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              Tendencia ultimos 7 dias
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="flex items-end gap-2 h-20">
              {genStats.tendencias.map((t) => {
                const h = Math.max((t.total / maxTendencia) * 100, 4);
                return (
                  <div key={t.fecha} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[9px] font-bold text-foreground">{t.total}</span>
                    <div className="w-full rounded-t-sm bg-primary/80 transition-all" style={{ height: `${h}%` }} />
                    <span className="text-[8px] text-muted-foreground">
                      {new Date(t.fecha + 'T12:00:00').toLocaleDateString('es-BO', { weekday: 'short' }).slice(0, 3)}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tarjetas de generación de productos */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                Productos
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Genera, previsualiza y entrega productos ONION200
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {ALL_PRODUCTS.filter(p => p.estado === 'operativo').map((prod) => {
              const ProdIcon = prod.icon;
              const prodConfig = PRODUCTOS[prod.tipo];
              const statsProd = genStats?.ultimoPorTipo.find(s => s.tipo === prod.tipo);
              const ultimo = statsProd?.ultimo;
              const totalGen = statsProd?.totalGenerados || 0;
              const isGenerating = generandoTipo === prod.tipo;
              const catInfo = PRODUCT_CATEGORIES.find(c => c.id === prod.categoria);
              const canales = prodConfig?.canales || [];
              const frecuencia = prodConfig?.frecuencia || '';
              return (
                <div key={prod.tipo} className="p-4 rounded-xl border border-border hover:border-primary/30 transition-all hover:shadow-sm space-y-3">
                  {/* Header */}
                  <div className="flex items-start gap-3">
                    <div
                      className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: prod.color + '20' }}
                    >
                      <ProdIcon className="h-5 w-5" style={{ color: prod.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-sm font-semibold text-foreground">{prod.nombre}</p>
                        {catInfo && (
                          <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-medium ${catInfo.color}`}>{catInfo.label}</span>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{prodConfig?.descripcion || ''}</p>
                    </div>
                  </div>

                  {/* Info: frecuencia + horario + formatos */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                    {frecuencia && (
                      <span className="flex items-center gap-1">
                        <RefreshCw className="h-3 w-3" />
                        {FRECUENCIA_LABELS[frecuencia] || frecuencia}
                      </span>
                    )}
                    {prodConfig?.horarioEnvio && (
                      <span>{prodConfig.horarioEnvio}</span>
                    )}
                    <span className="flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {canales.map(c => CANAL_LABELS[c] || c).join(', ')}
                    </span>
                  </div>

                  {/* Último generado + total */}
                  <div className="flex items-center justify-between text-[10px]">
                    <div className="text-muted-foreground">
                      {ultimo ? (
                        <span>
                          Ultimo: {new Date(ultimo.fechaCreacion).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          {ultimo.totalMenciones > 0 && <span className="ml-1">· {ultimo.totalMenciones} menc.</span>}
                        </span>
                      ) : (
                        <span className="italic">Sin generar aun</span>
                      )}
                    </div>
                    <Badge variant="secondary" className="text-[9px]">{totalGen} total</Badge>
                  </div>

                  {/* Acciones */}
                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      size="sm"
                      onClick={() => handleGenerarProducto(prod.tipo)}
                      disabled={isGenerating}
                      className="flex-1 text-xs gap-1.5"
                      style={isGenerating ? {} : { backgroundColor: prod.color, borderColor: prod.color }}
                    >
                      {isGenerating
                        ? <><Loader2 className="h-3 w-3 animate-spin" /> Generando...</>
                        : <><Zap className="h-3 w-3" /> Generar ahora</>
                      }
                    </Button>
                    {ultimo && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPreviewReporte(ultimo)}
                        className="text-xs gap-1"
                      >
                        <Eye className="h-3 w-3" /> Vista previa
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Modal Vista Previa */}
      <GeneratorPreviewModal
        open={!!previewReporte}
        onClose={() => setPreviewReporte(null)}
        reporte={previewReporte}
      />

      {/* ═══ PANEL GENERADOR DEDICADO (El Termómetro / Saldo del Día / El Foco) ═══ */}
      {selectedGenerator && (
        <GeneratorDedicatedPanel
          selectedGenerator={selectedGenerator}
          generatorData={generatorData}
          generatorDataLoading={generatorDataLoading}
          generatorFecha={generatorFecha}
          generatorFiltros={generatorFiltros}
          generatorGenerating={generatorGenerating}
          onSelectEje={selectGeneratorEje}
          onClearEje={clearGeneratorEje}
          onToggleEje={toggleGeneratorEje}
          onFechaChange={handleGeneratorFechaChange}
          onGenerate={handleGenerateFromPanel}
          onClose={closeGeneratorPanel}
        />
      )}
    </div>
  );
}
