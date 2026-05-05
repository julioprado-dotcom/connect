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
  Plus,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  CheckCircle2,
  XCircle,
  RotateCw,
  X,
} from 'lucide-react';

// -- Local types --

interface IndicadorItem {
  slug: string;
  nombre: string;
  categoria: string;
  fuente: string;
  periodicidad: string;
  unidad: string;
  tipo: 'cuantitativo' | 'cualitativo';
  metodologia?: string;
  variables?: string;
  escalaMin?: number;
  escalaMax?: number;
  ultimaEvaluacion?: {
    valorCompuesto: number;
    valorTexto: string;
    escalaNivel: 'alto' | 'medio' | 'bajo' | 'critico';
    puntuaciones: Record<string, number>;
    fechaEvaluacion: string;
  } | null;
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

interface IndicadorCualitativoItem {
  id: string;
  slug: string;
  nombre: string;
  categoria: string;
  tipo: 'cualitativo';
  metodologia: string;
  variables: string;
  escalaMin: number;
  escalaMax: number;
  ultimaEvaluacion: {
    valorCompuesto: number;
    valorTexto: string;
    escalaNivel: 'alto' | 'medio' | 'bajo' | 'critico';
    puntuaciones: Record<string, number>;
    fechaEvaluacion: string;
  } | null;
}

interface EvaluacionFormState {
  indicadorId: string;
  indicadorSlug: string;
  puntuaciones: Record<string, number>;
  observaciones: string;
  evaluador: string;
  fuentes: string;
  submitting: boolean;
}

const ESCALA_NIVEL_STYLES: Record<string, string> = {
  critico: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border-red-200 dark:border-red-800',
  alto: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 border-orange-200 dark:border-orange-800',
  medio: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  bajo: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
};

const ESCALA_NIVEL_DOT: Record<string, string> = {
  critico: 'bg-red-500',
  alto: 'bg-orange-500',
  medio: 'bg-amber-500',
  bajo: 'bg-emerald-500',
};

// -- Component --

export function IndicadoresView() {
  const data = useDashboardStore((s) => s.data);

  // -- Local state --
  const [indicadoresTab, setIndicadoresTab] = useState<'macro' | 'presencia' | 'conflictividad'>('macro');
  const [indicadoresPeriodo, setIndicadoresPeriodo] = useState('30d');
  const [indicadoresCategoria, setIndicadoresCategoria] = useState('');
  const [indicadores, setIndicadores] = useState<Array<IndicadorItem> | null>(null);
  const [indicadoresHistorico, setIndicadoresHistorico] = useState<IndicadoresHistorico | null>(null);
  const [indicadoresLoading, setIndicadoresLoading] = useState(false);
  const [capturaIndicadoresLoading, setCapturaIndicadoresLoading] = useState(false);
  // -- Sync state: individual indicator tracking --
  const [syncAllLoading, setSyncAllLoading] = useState(false);
  const [syncingSlugs, setSyncingSlugs] = useState<Set<string>>(new Set());
  const [syncResultMap, setSyncResultMap] = useState<Record<string, {
    exito: boolean;
    valorTexto?: string;
    error?: string;
    timestamp?: string;
  }>>({});
  const [showSyncPanel, setShowSyncPanel] = useState(false);
  const [syncAllSlugs, setSyncAllSlugs] = useState<string[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newInd, setNewInd] = useState({
    nombre: '', slug: '', categoria: 'monetario', fuente: '', url: '',
    periodicidad: 'diaria', unidad: '', formatoNumero: 2, tier: 1,
    tipo: 'cuantitativo' as 'cuantitativo' | 'cualitativo',
    metodologia: '',
    variables: '',
    escalaMin: 1,
    escalaMax: 10,
    notas: '', ejesTematicos: '' as string,
  });
  const [savingInd, setSavingInd] = useState(false);

  // -- Qualitative indicators + evaluations state --
  const [indicadoresCualitativos, setIndicadoresCualitativos] = useState<IndicadorCualitativoItem[]>([]);
  const [cualitativosLoading, setCualitativosLoading] = useState(false);
  const [expandedEvaluacion, setExpandedEvaluacion] = useState<string | null>(null);
  const [evaluacionForms, setEvaluacionForms] = useState<Record<string, EvaluacionFormState>>({});

  // -- Mount + reload effect --

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

  // Fetch qualitative social indicators when on conflictividad tab
  useEffect(() => {
    if (indicadoresTab !== 'conflictividad') return;
    let cancelled = false;
    const controller = new AbortController();
    (async () => {
      setCualitativosLoading(true);
      try {
        const res = await fetch('/api/indicadores?tipo=cualitativo&categoria=social', { signal: controller.signal });
        const json = await res.json();
        if (!cancelled && Array.isArray(json)) {
          setIndicadoresCualitativos(json);
        }
      } catch {
        /* silent */
      } finally {
        if (!cancelled) setCualitativosLoading(false);
      }
    })();
    return () => { cancelled = true; controller.abort(); };
  }, [indicadoresTab, reloadTrigger]);

  // -- Callbacks --

  const handleCapturaIndicadores = async () => {
    setCapturaIndicadoresLoading(true);
    try {
      await fetch('/api/indicadores/capture', { method: 'POST' });
      reloadTrigger(n => n + 1);
    } catch { /* silent */ } finally {
      setCapturaIndicadoresLoading(false);
    }
  };

  // -- Sync individual: un solo indicador --
  const handleSyncOne = async (slug: string) => {
    setSyncingSlugs(prev => new Set(prev).add(slug));
    try {
      const res = await fetch(`/api/indicadores/sync/${slug}`, { method: 'POST' });
      const json = await res.json();
      setSyncResultMap(prev => ({
        ...prev,
        [slug]: {
          exito: json.exito,
          valorTexto: json.valorTexto || 'N/D',
          error: json.error || null,
          timestamp: json.timestamp,
        },
      }));
      reloadTrigger(n => n + 1);
    } catch {
      setSyncResultMap(prev => ({
        ...prev,
        [slug]: { exito: false, error: 'Error de conexion', timestamp: new Date().toISOString() },
      }));
    } finally {
      setSyncingSlugs(prev => {
        const next = new Set(prev);
        next.delete(slug);
        return next;
      });
    }
  };

  // -- Sync secuencial: todos uno por uno (micro-llamadas) --
  const handleSyncAll = async () => {
    if (syncAllLoading) return;
    setSyncAllLoading(true);
    setShowSyncPanel(true);
    setSyncResultMap({});

    // Obtener los slugs con fuente automática
    const slugs = syncAllSlugs.length > 0
      ? syncAllSlugs
      : (indicadoresHistorico?.indicadores
          .filter(i => i.tier === 1 && i.activo)
          .map(i => i.slug) || []);

    // Procesar uno por uno de forma secuencial
    for (const slug of slugs) {
      setSyncingSlugs(prev => new Set(prev).add(slug));
      try {
        const res = await fetch(`/api/indicadores/sync/${slug}`, { method: 'POST' });
        const json = await res.json();
        setSyncResultMap(prev => ({
          ...prev,
          [slug]: {
            exito: json.exito,
            valorTexto: json.valorTexto || 'N/D',
            error: json.error || null,
            timestamp: json.timestamp,
          },
        }));
      } catch {
        setSyncResultMap(prev => ({
          ...prev,
          [slug]: { exito: false, error: 'Error de conexion', timestamp: new Date().toISOString() },
        }));
      } finally {
        setSyncingSlugs(prev => {
          const next = new Set(prev);
          next.delete(slug);
          return next;
        });
      }
    }

    reloadTrigger(n => n + 1);
    setSyncAllLoading(false);
  };

  // -- Retry fallidos --
  const handleRetryFailed = async () => {
    const failedSlugs = Object.entries(syncResultMap)
      .filter(([, r]) => !r.exito)
      .map(([slug]) => slug);
    if (failedSlugs.length === 0) return;

    setSyncAllLoading(true);
    for (const slug of failedSlugs) {
      setSyncingSlugs(prev => new Set(prev).add(slug));
      try {
        const res = await fetch(`/api/indicadores/sync/${slug}`, { method: 'POST' });
        const json = await res.json();
        setSyncResultMap(prev => ({
          ...prev,
          [slug]: {
            exito: json.exito,
            valorTexto: json.valorTexto || 'N/D',
            error: json.error || null,
            timestamp: json.timestamp,
          },
        }));
      } catch {
        setSyncResultMap(prev => ({
          ...prev,
          [slug]: { exito: false, error: 'Error de conexion', timestamp: new Date().toISOString() },
        }));
      } finally {
        setSyncingSlugs(prev => {
          const next = new Set(prev);
          next.delete(slug);
          return next;
        });
      }
    }
    reloadTrigger(n => n + 1);
    setSyncAllLoading(false);
  };

  const handleSaveIndicador = async () => {
    if (!newInd.nombre || !newInd.slug) return;
    setSavingInd(true);
    try {
      const payload: Record<string, unknown> = {
        nombre: newInd.nombre,
        slug: newInd.slug,
        categoria: newInd.categoria,
        fuente: newInd.fuente,
        url: newInd.url,
        periodicidad: newInd.periodicidad,
        unidad: newInd.unidad,
        formatoNumero: newInd.formatoNumero,
        tier: newInd.tier,
        tipo: newInd.tipo,
        notas: newInd.notas,
        ejesTematicos: newInd.ejesTematicos || undefined,
      };
      if (newInd.tipo === 'cualitativo') {
        payload.metodologia = newInd.metodologia;
        payload.variables = newInd.variables;
        payload.escalaMin = newInd.escalaMin;
        payload.escalaMax = newInd.escalaMax;
      }
      const res = await fetch('/api/indicadores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setShowCreateForm(false);
        setNewInd({
          nombre: '', slug: '', categoria: 'monetario', fuente: '', url: '',
          periodicidad: 'diaria', unidad: '', formatoNumero: 2, tier: 1,
          tipo: 'cuantitativo',
          metodologia: '', variables: '', escalaMin: 1, escalaMax: 10,
          notas: '', ejesTematicos: '',
        });
        reloadTrigger(n => n + 1);
      }
    } catch { /* silent */ } finally {
      setSavingInd(false);
    }
  };

  const handleSaveEvaluacion = async (indicadorId: string) => {
    const form = evaluacionForms[indicadorId];
    if (!form || form.submitting) return;
    const updatedForm = { ...form, submitting: true };
    setEvaluacionForms(prev => ({ ...prev, [indicadorId]: updatedForm }));
    try {
      const fuentesArr = form.fuentes
        .split(',')
        .map(f => f.trim())
        .filter(Boolean);
      const res = await fetch('/api/indicadores/evaluaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          indicadorId,
          puntuaciones: form.puntuaciones,
          observaciones: form.observaciones || undefined,
          evaluador: form.evaluador || 'analista',
          fuentes: fuentesArr.length > 0 ? fuentesArr : undefined,
        }),
      });
      if (res.ok) {
        setExpandedEvaluacion(null);
        setEvaluacionForms(prev => {
          const next = { ...prev };
          delete next[indicadorId];
          return next;
        });
        reloadTrigger(n => n + 1);
      }
    } catch { /* silent */ } finally {
      setEvaluacionForms(prev => ({
        ...prev,
        [indicadorId]: { ...prev[indicadorId], submitting: false },
      }));
    }
  };

  const toggleEvalForm = useCallback((ind: IndicadorCualitativoItem) => {
    setExpandedEvaluacion(prev => prev === ind.id ? null : ind.id);
    setEvaluacionForms(prev => {
      if (prev[ind.id]) return prev;
      const vars: string[] = [];
      try { vars.push(...JSON.parse(ind.variables || '[]')); } catch { /* empty */ }
      const puntuaciones: Record<string, number> = {};
      vars.forEach(v => { puntuaciones[v] = Math.round((ind.escalaMin + ind.escalaMax) / 2); });
      return {
        ...prev,
        [ind.id]: {
          indicadorId: ind.id,
          indicadorSlug: ind.slug,
          puntuaciones,
          observaciones: '',
          evaluador: 'analista',
          fuentes: '',
          submitting: false,
        },
      };
    });
  }, []);

  // Helper to parse variables JSON
  const parseVariables = useCallback((varsJson: string): string[] => {
    try { return JSON.parse(varsJson || '[]'); } catch { return []; }
  }, []);

  // -- Render --

  return (
    <div className="space-y-4">
      {/* -- Tab Navigation -- */}
      <div className="flex items-center gap-1 p-1 rounded-lg bg-muted/50 border border-border">
        {([
          { id: 'macro' as const, label: 'Macroeconomia', icon: TrendingUp, desc: 'TC, reserva, inflacion, mineria' },
          { id: 'presencia' as const, label: 'Presencia Mediatica', icon: Newspaper, desc: 'Menciones por partido, ranking de actores' },
          { id: 'conflictividad' as const, label: 'Conflictividad', icon: AlertTriangle, desc: 'Tension social y escalamiento' },
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

      {/* -- Crear Indicador Button + Form -- */}
      <div className="flex items-center justify-between">
        <div />
        <Button
          variant={showCreateForm ? 'outline' : 'default'}
          size="sm"
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="text-xs gap-1"
        >
          <Plus className="h-3.5 w-3.5" />
          Crear indicador
        </Button>
      </div>
      {showCreateForm && (
        <Card className="border-primary/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary" />
              Nuevo indicador
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-3">
            {/* Row 1: Nombre + Slug */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Nombre</label>
                <input type="text" value={newInd.nombre} onChange={(e) => setNewInd(p => ({ ...p, nombre: e.target.value }))} placeholder="Ej: Tasa de Desempleo" className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Slug (identificador unico)</label>
                <input type="text" value={newInd.slug} onChange={(e) => setNewInd(p => ({ ...p, slug: e.target.value.toLowerCase().replace(/\s/g, '-') }))} placeholder="Ej: tasa-desempleo" className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
            </div>
            {/* Row 2: Categoria + Periodicidad + Tier */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Categoria</label>
                <select value={newInd.categoria} onChange={(e) => setNewInd(p => ({ ...p, categoria: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm">
                  <option value="monetario">Monetario</option>
                  <option value="minero">Minero</option>
                  <option value="economico">Economico</option>
                  <option value="hidrocarburos">Hidrocarburos</option>
                  <option value="climatico">Climatico</option>
                  <option value="social">Social</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Periodicidad</label>
                <select value={newInd.periodicidad} onChange={(e) => setNewInd(p => ({ ...p, periodicidad: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm">
                  <option value="diaria">Diaria</option>
                  <option value="semanal">Semanal</option>
                  <option value="mensual">Mensual</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Tier</label>
                <select value={newInd.tier} onChange={(e) => setNewInd(p => ({ ...p, tier: parseInt(e.target.value) }))} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm">
                  <option value="1">Tier 1 - Inmediato</option>
                  <option value="2">Tier 2 - Corto plazo</option>
                  <option value="3">Tier 3 - Mediano plazo</option>
                </select>
              </div>
            </div>
            {/* Row 3: Tipo toggle */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Tipo de indicador</label>
              <div className="flex gap-2">
                {(['cuantitativo', 'cualitativo'] as const).map(t => (
                  <button key={t} onClick={() => setNewInd(p => ({ ...p, tipo: t }))} className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${newInd.tipo === t ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-border hover:border-primary/50'}`}>
                    {t === 'cuantitativo' ? 'Cuantitativo (numero)' : 'Cualitativo (evaluacion)'}
                  </button>
                ))}
              </div>
            </div>
            {/* Conditional fields for cualitativo */}
            {newInd.tipo === 'cualitativo' && (
              <div className="space-y-3 p-3 rounded-lg border border-primary/20 bg-primary/5">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Metodologia</label>
                  <textarea value={newInd.metodologia} onChange={(e) => setNewInd(p => ({ ...p, metodologia: e.target.value }))} placeholder="Descripcion de la metodologia de evaluacion..." rows={2} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Variables (separadas por coma)</label>
                  <input type="text" value={newInd.variables} onChange={(e) => setNewInd(p => ({ ...p, variables: e.target.value }))} placeholder="Ej: frecuencia, intensidad, alcance" className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                  {newInd.variables.trim() && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {newInd.variables.split(',').map((v, i) => v.trim() && (
                        <span key={i} className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{v.trim()}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Escala minima</label>
                    <input type="number" value={newInd.escalaMin} onChange={(e) => setNewInd(p => ({ ...p, escalaMin: parseInt(e.target.value) || 0 }))} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Escala maxima</label>
                    <input type="number" value={newInd.escalaMax} onChange={(e) => setNewInd(p => ({ ...p, escalaMax: parseInt(e.target.value) || 0 }))} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                  </div>
                </div>
              </div>
            )}
            {/* Row 4: Fuente + URL + Unidad (shown for cuantitativo) */}
            {newInd.tipo === 'cuantitativo' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Fuente</label>
                  <input type="text" value={newInd.fuente} onChange={(e) => setNewInd(p => ({ ...p, fuente: e.target.value }))} placeholder="Ej: BCB" className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">URL de la fuente</label>
                  <input type="text" value={newInd.url} onChange={(e) => setNewInd(p => ({ ...p, url: e.target.value }))} placeholder="https://..." className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Unidad</label>
                  <input type="text" value={newInd.unidad} onChange={(e) => setNewInd(p => ({ ...p, unidad: e.target.value }))} placeholder="Ej: Bs/USD" className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
              </div>
            )}
            {/* Row 5: Decimales + Notas */}
            {newInd.tipo === 'cuantitativo' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Decimales</label>
                  <input type="number" value={newInd.formatoNumero} onChange={(e) => setNewInd(p => ({ ...p, formatoNumero: parseInt(e.target.value) || 0 }))} min={0} max={6} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Notas</label>
                  <input type="text" value={newInd.notas} onChange={(e) => setNewInd(p => ({ ...p, notas: e.target.value }))} placeholder="Notas adicionales..." className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
              </div>
            )}
            {/* Actions */}
            <div className="flex items-center gap-2 pt-1">
              <Button onClick={handleSaveIndicador} disabled={savingInd || !newInd.nombre || !newInd.slug} className="text-xs gap-1">
                {savingInd ? 'Guardando...' : 'Guardar indicador'}
              </Button>
              <Button variant="outline" onClick={() => setShowCreateForm(false)} className="text-xs">Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ========== TAB: MACROECONOMIA ========== */}
      {indicadoresTab === 'macro' && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  Indicadores Macroeconomicos
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  {indicadoresHistorico
                    ? `${indicadoresHistorico.conDatos} de ${indicadoresHistorico.totalIndicadores} con datos - Periodo: ${indicadoresPeriodo}`
                    : 'Datos macroeconomicos del ecosistema boliviano'}
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
                    {p === '7d' ? '7 dias' : p === '30d' ? '30 dias' : p === '90d' ? '90 dias' : '1 ano'}
                  </button>
                ))}
                <select
                  value={indicadoresCategoria}
                  onChange={(e) => { setIndicadoresCategoria(e.target.value); reloadTrigger(n => n + 1); }}
                  className="text-[10px] border border-border rounded-lg px-2 py-1 bg-background text-foreground"
                >
                  <option value="">Todas las categorias</option>
                  <option value="monetario">Monetario</option>
                  <option value="minero">Minero</option>
                  <option value="social">Social</option>
                  <option value="economico">Economico</option>
                  <option value="hidrocarburos">Hidrocarburos</option>
                  <option value="climatico">Climatico</option>
                </select>
                <Button variant="default" size="sm" onClick={handleSyncAll} disabled={syncAllLoading} className="text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white">
                  {syncAllLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                  {syncAllLoading ? `Sync ${Object.keys(syncResultMap).length}/${syncAllSlugs.length || (indicadoresHistorico?.indicadores.filter(i => i.tier === 1 && i.activo).length || 0)}` : 'Sincronizar'}
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

            {/* Tabla de indicadores con estadisticas */}
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
                          {/* Botón sync individual (micro-llamada) */}
                          {ind.tier === 1 && ind.activo && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleSyncOne(ind.slug); }}
                              disabled={syncingSlugs.has(ind.slug) || syncAllLoading}
                              className="p-1 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground disabled:opacity-50"
                              title={`Sincronizar ${ind.nombre}`}
                            >
                              {syncingSlugs.has(ind.slug)
                                ? <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                                : syncResultMap[ind.slug]?.exito
                                  ? <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                                  : syncResultMap[ind.slug] && !syncResultMap[ind.slug].exito
                                    ? <XCircle className="h-3 w-3 text-red-500" />
                                    : <RefreshCw className="h-3 w-3" />
                              }
                            </button>
                          )}
                          {stats && (
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                              stats.tendencia === 'ascendente' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                              : stats.tendencia === 'descendente' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                              : 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400'
                            }`}>
                              {stats.tendencia === 'ascendente' ? '^' : stats.tendencia === 'descendente' ? 'v' : '-'} {stats.diffPct > 0 ? '+' : ''}{stats.diffPct}%
                            </span>
                          )}
                          <p className={`text-sm font-bold ${tieneValor ? 'text-foreground' : 'text-muted-foreground'}`}>
                            {tieneValor ? ind.ultimoValor!.valor : 'N/D'}
                          </p>
                          <span className="text-[9px] text-muted-foreground">{ind.unidad}</span>
                        </div>
                      </div>

                      {/* Estadisticas expandidas */}
                      {stats && (
                        <div className="mt-2 grid grid-cols-2 sm:grid-cols-5 gap-2 pl-1">
                          <div className="text-[9px] text-muted-foreground">
                            <span className="font-medium text-foreground">{stats.puntos}</span> pts en {stats.periodo}
                          </div>
                          <div className="text-[9px] text-muted-foreground">
                            Min: <span className="font-medium text-foreground">{stats.min}</span>
                          </div>
                          <div className="text-[9px] text-muted-foreground">
                            Max: <span className="font-medium text-foreground">{stats.max}</span>
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

                      {/* Fuente y ultima captura */}
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
                <p className="text-xs text-muted-foreground">Sin datos de indicadores para el periodo seleccionado.</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ========== PANEL DE SINCRONIZACION CON ALERTAS ========== */}
      {showSyncPanel && Object.keys(syncResultMap).length > 0 && (
        <Card className={`border ${Object.values(syncResultMap).some(r => !r.exito) ? 'border-amber-300 dark:border-amber-700' : 'border-emerald-200 dark:border-emerald-800'}`}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                {syncAllLoading
                  ? <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                  : Object.values(syncResultMap).some(r => !r.exito)
                    ? <AlertTriangle className="h-4 w-4 text-amber-500" />
                    : <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                }
                Sincronizacion {syncAllLoading ? 'en curso' : 'finalizada'}
              </CardTitle>
              <button onClick={() => setShowSyncPanel(false)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-3">
            {/* Resumen de progreso */}
            <div className="grid grid-cols-3 gap-2">
              <div className="text-center p-2 rounded bg-background">
                <p className="text-lg font-bold text-foreground">{Object.keys(syncResultMap).length}</p>
                <p className="text-[10px] text-muted-foreground">Procesados</p>
              </div>
              <div className="text-center p-2 rounded bg-emerald-50 dark:bg-emerald-950/20">
                <p className="text-lg font-bold text-emerald-600">{Object.values(syncResultMap).filter(r => r.exito).length}</p>
                <p className="text-[10px] text-muted-foreground">Exitosos</p>
              </div>
              <div className="text-center p-2 rounded bg-red-50 dark:bg-red-950/20">
                <p className="text-lg font-bold text-red-600">{Object.values(syncResultMap).filter(r => !r.exito).length}</p>
                <p className="text-[10px] text-muted-foreground">Con alerta</p>
              </div>
            </div>

            {/* Barra de progreso visual */}
            {syncAllLoading && (
              <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all duration-300 rounded-full"
                  style={{ width: `${(Object.keys(syncResultMap).length / (syncAllSlugs.length || indicadoresHistorico?.indicadores.filter(i => i.tier === 1 && i.activo).length || 1)) * 100}%` }}
                />
              </div>
            )}

            {/* Alerta si hay fallidos */}
            {Object.values(syncResultMap).some(r => !r.exito) && !syncAllLoading && (
              <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                <div className="flex items-center gap-2 mb-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                  <p className="text-xs font-medium text-amber-800 dark:text-amber-200">
                    {Object.values(syncResultMap).filter(r => !r.exito).length} indicador(es) con alerta
                  </p>
                </div>
                <p className="text-[10px] text-amber-700 dark:text-amber-300 mb-2">
                  La falla de estos indicadores no afecto a los demas. Puedes reintentar solo los que fallaron.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRetryFailed}
                  disabled={syncAllLoading}
                  className="text-[10px] gap-1 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-950/40"
                >
                  <RotateCw className="h-3 w-3" />
                  Reintentar fallidos
                </Button>
              </div>
            )}

            {/* Detalle por indicador */}
            <div className="space-y-1 max-h-[300px] overflow-y-auto custom-scrollbar">
              {Object.entries(syncResultMap).map(([slug, result]) => (
                <div
                  key={slug}
                  className={`flex items-center justify-between text-[10px] p-1.5 rounded ${
                    syncingSlugs.has(slug) ? 'bg-blue-50 dark:bg-blue-950/20' :
                    result.exito ? 'bg-emerald-50 dark:bg-emerald-950/20' :
                    'bg-red-50 dark:bg-red-950/20'
                  }`}
                >
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    {syncingSlugs.has(slug) ? (
                      <Loader2 className="h-3 w-3 animate-spin text-blue-500 shrink-0" />
                    ) : result.exito ? (
                      <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                    ) : (
                      <XCircle className="h-3 w-3 text-red-500 shrink-0" />
                    )}
                    <span className="font-medium text-foreground truncate">{slug}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {result.valorTexto && result.exito && (
                      <span className="text-emerald-600 font-medium">{result.valorTexto}</span>
                    )}
                    {!result.exito && (
                      <div className="flex items-center gap-1">
                        <span className="text-red-600">{result.error || 'Fallo'}</span>
                        <button
                          onClick={() => handleSyncOne(slug)}
                          disabled={syncingSlugs.has(slug)}
                          className="p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-950/40 text-red-500"
                          title="Reintentar"
                        >
                          <RotateCw className="h-2.5 w-2.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <p className="text-[9px] text-muted-foreground">
              {Object.values(syncResultMap).find(r => r.timestamp)?.timestamp
                ? `Ultima sync: ${new Date(Object.values(syncResultMap).find(r => r.timestamp)!.timestamp!).toLocaleString('es-BO')}`
                : ''
              }
            </p>
          </CardContent>
        </Card>
      )}

      {/* ========== TAB: PRESENCIA MEDIATICA ========== */}
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
              label="Max. menciones individuales"
              subtext={data?.topActores?.[0]?.nombre || '--'}
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

          {/* Top 10 presencia mediatica */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    Top 10 presencia mediatica
                  </CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    Actores con mayor presencia mediatica - {indicadoresPeriodo === '7d' ? 'ultimos 7 dias' : indicadoresPeriodo === '30d' ? 'ultimos 30 dias' : indicadoresPeriodo === '90d' ? 'ultimos 90 dias' : 'ultimo ano'}
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
                <p className="text-xs text-muted-foreground text-center py-8">Sin datos de presencia para el periodo seleccionado</p>
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
                  Distribucion de menciones por agrupacion politica
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

      {/* ========== TAB: CONFLICTIVIDAD ========== */}
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
                    <p className="text-[10px] font-medium text-muted-foreground mb-1">Periodo de analisis</p>
                    <p className="text-xl font-bold text-foreground">{indicadoresPeriodo === '7d' ? '7 dias' : indicadoresPeriodo === '30d' ? '30 dias' : indicadoresPeriodo === '90d' ? '90 dias' : '1 ano'}</p>
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
                    Tension social y escalamiento regional - ONION200
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
                              {esEscalamiento ? 'Global' : 'Analisis'}
                            </span>
                            <span className="text-xs font-semibold text-foreground">{ind.nombre}</span>
                            {tieneValor && (
                              <span className={`text-[9px] ${ind.ultimoValor!.confiable ? 'text-emerald-500' : 'text-amber-500'}`}>
                                {ind.ultimoValor!.confiable ? 'OK confiable' : 'AT verificar'}
                              </span>
                            )}
                          </div>
                          <p className={`text-lg font-bold ${esEscalamiento && tieneValor && ind.ultimoValor!.valor.toLowerCase().includes('alto') ? 'text-red-600 dark:text-red-400' : 'text-foreground'}`}>
                            {tieneValor ? ind.ultimoValor!.valor : 'N/D'}
                          </p>
                        </div>
                        <p className="text-[10px] text-muted-foreground">{ind.unidad} - Fuente: {ind.fuente}</p>

                        {/* Estadisticas historicas */}
                        {stats && (
                          <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[9px] text-muted-foreground">
                            <div>Puntos: <span className="font-medium text-foreground">{stats.puntos}</span></div>
                            <div>Min: <span className="font-medium text-foreground">{stats.min}</span></div>
                            <div>Max: <span className="font-medium text-foreground">{stats.max}</span></div>
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
                    Los indicadores de conflictividad se calculan a partir del analisis de menciones y keywords de protesta. Fuente: ONION200.
                  </p>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-xs text-muted-foreground">Sin indicadores de conflictividad para el periodo seleccionado.</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-1">Usa el boton de captura para obtener datos actualizados.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ========== Evaluaciones Cualitativas ========== */}
          <Card>
            <CardHeader className="pb-3">
              <div>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-muted-foreground" />
                  Evaluaciones Cualitativas
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Indicadores cualitativos de tension social con evaluaciones por sub-variables
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              {cualitativosLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : indicadoresCualitativos.length > 0 ? (
                <div className="space-y-3 max-h-[600px] overflow-y-auto custom-scrollbar">
                  {indicadoresCualitativos.map((ind) => {
                    const vars = parseVariables(ind.variables);
                    const evalData = ind.ultimaEvaluacion;
                    const isExpanded = expandedEvaluacion === ind.id;
                    const form = evaluacionForms[ind.id];

                    return (
                      <div key={ind.id} className="p-4 rounded-lg border border-border hover:bg-muted/20 transition-colors">
                        {/* Header row */}
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                                Cualitativo
                              </span>
                              <span className="text-xs font-semibold text-foreground">{ind.nombre}</span>
                            </div>
                            {ind.metodologia && (
                              <p className="text-[9px] text-muted-foreground line-clamp-2">{ind.metodologia}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {evalData && (
                              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium border ${ESCALA_NIVEL_STYLES[evalData.escalaNivel] || ESCALA_NIVEL_STYLES.medio}`}>
                                <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${ESCALA_NIVEL_DOT[evalData.escalaNivel] || ESCALA_NIVEL_DOT.medio}`} />
                                {evalData.escalaNivel.toUpperCase()} ({evalData.valorCompuesto.toFixed(1)})
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Sub-variables with last scores */}
                        {vars.length > 0 && (
                          <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {vars.map((v) => {
                              const lastScore = evalData?.puntuaciones?.[v];
                              return (
                                <div key={v} className="flex items-center justify-between p-1.5 rounded bg-muted/30 text-[9px]">
                                  <span className="text-muted-foreground font-medium">{v}</span>
                                  <span className={`font-bold ${lastScore != null ? (lastScore >= (ind.escalaMax * 0.7) ? 'text-red-600 dark:text-red-400' : lastScore >= (ind.escalaMax * 0.4) ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400') : 'text-muted-foreground'}`}>
                                    {lastScore != null ? lastScore : '-'}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Last evaluation meta */}
                        {evalData && (
                          <div className="mt-1.5 flex items-center justify-between pl-1">
                            <span className="text-[9px] text-muted-foreground">
                              {evalData.valorTexto}
                            </span>
                            <span className="text-[9px] text-muted-foreground">
                              {new Date(evalData.fechaEvaluacion).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </span>
                          </div>
                        )}

                        {/* Toggle evaluation form button */}
                        <button
                          onClick={() => toggleEvalForm(ind)}
                          className="mt-2 flex items-center gap-1 text-[10px] font-medium text-primary hover:text-primary/80 transition-colors"
                        >
                          {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                          Nueva Evaluacion
                        </button>

                        {/* Evaluation form */}
                        {isExpanded && form && (
                          <div className="mt-2 p-3 rounded-lg border border-primary/20 bg-muted/20 space-y-3">
                            {/* Slider inputs for each sub-variable */}
                            {vars.map((v) => (
                              <div key={v} className="space-y-1">
                                <div className="flex items-center justify-between">
                                  <label className="text-[10px] font-medium text-muted-foreground">{v}</label>
                                  <span className="text-[10px] font-bold text-foreground">{form.puntuaciones[v] ?? '-'}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[8px] text-muted-foreground w-4">{ind.escalaMin}</span>
                                  <input
                                    type="range"
                                    min={ind.escalaMin}
                                    max={ind.escalaMax}
                                    value={form.puntuaciones[v] ?? Math.round((ind.escalaMin + ind.escalaMax) / 2)}
                                    onChange={(e) => setEvaluacionForms(prev => ({
                                      ...prev,
                                      [ind.id]: {
                                        ...prev[ind.id],
                                        puntuaciones: { ...prev[ind.id].puntuaciones, [v]: parseInt(e.target.value) },
                                      },
                                    }))}
                                    className="flex-1 h-1.5 accent-primary"
                                  />
                                  <span className="text-[8px] text-muted-foreground w-4 text-right">{ind.escalaMax}</span>
                                </div>
                              </div>
                            ))}

                            {/* Observaciones */}
                            <div>
                              <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Observaciones</label>
                              <textarea
                                value={form.observaciones}
                                onChange={(e) => setEvaluacionForms(prev => ({
                                  ...prev,
                                  [ind.id]: { ...prev[ind.id], observaciones: e.target.value },
                                }))}
                                placeholder="Notas sobre la evaluacion..."
                                rows={2}
                                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                              />
                            </div>

                            {/* Evaluador + Fuentes */}
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Evaluador</label>
                                <input
                                  type="text"
                                  value={form.evaluador}
                                  onChange={(e) => setEvaluacionForms(prev => ({
                                    ...prev,
                                    [ind.id]: { ...prev[ind.id], evaluador: e.target.value },
                                  }))}
                                  placeholder="analista"
                                  className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Fuentes (separadas por coma)</label>
                                <input
                                  type="text"
                                  value={form.fuentes}
                                  onChange={(e) => setEvaluacionForms(prev => ({
                                    ...prev,
                                    [ind.id]: { ...prev[ind.id], fuentes: e.target.value },
                                  }))}
                                  placeholder="Ej: redes sociales, prensa"
                                  className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                                />
                              </div>
                            </div>

                            {/* Submit */}
                            <div className="flex items-center gap-2 pt-1">
                              <Button
                                size="sm"
                                onClick={() => handleSaveEvaluacion(ind.id)}
                                disabled={form.submitting}
                                className="text-xs gap-1"
                              >
                                {form.submitting ? (
                                  <><Loader2 className="h-3 w-3 animate-spin" /> Guardando...</>
                                ) : (
                                  <>Registrar evaluacion</>
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setExpandedEvaluacion(null)}
                                className="text-xs"
                              >
                                Cancelar
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <ClipboardList className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                  <p className="text-xs text-muted-foreground">No hay indicadores cualitativos de categoria social.</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-1">Crea un indicador cualitativo con categoria "social" para comenzar.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
