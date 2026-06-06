'use client';

import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Loader2, Activity, Zap, RefreshCw, AlertTriangle, Plus, X,
  RadioTower, ExternalLink, CheckCircle2, ArrowRight,
} from 'lucide-react';
import { useDashboardStore } from '@/stores/useDashboardStore';

// ─── Quick add form options ─────────────────────────────────

const TIPO_OPTIONS = [
  { value: 'diario', label: 'Diario' },
  { value: 'portal_web', label: 'Portal Web' },
  { value: 'television', label: 'Televisión' },
  { value: 'radio', label: 'Radio' },
  { value: 'agencia_noticias', label: 'Agencia' },
  { value: 'institucional', label: 'Institucional' },
  { value: 'red_social', label: 'Red Social' },
  { value: 'otro', label: 'Otro' },
];

const CATEGORIA_OPTIONS = [
  { value: 'oficial', label: 'Oficial' },
  { value: 'corporativo', label: 'Corporativo' },
  { value: 'regional', label: 'Regional' },
  { value: 'alternativo', label: 'Alternativo' },
  { value: 'red_social', label: 'Red Social' },
];

export function CapturaView() {
  const { mediosHealth, setMediosHealth, setError, setData, setActiveView } = useDashboardStore();
  const [captureCount, setCaptureCount] = useState(5);
  const [captureLoading, setCaptureLoading] = useState(false);
  const [captureResult, setCaptureResult] = useState<{
    busquedas: number;
    mencionesNuevas: number;
    errores: number;
    detalles?: string[];
  } | null>(null);
  const [mediosHealthLoading, setMediosHealthLoading] = useState(false);

  // Quick-add state
  const [showAddForm, setShowAddForm] = useState(false);
  const [addSaving, setAddSaving] = useState(false);
  const [addSuccess, setAddSuccess] = useState<string | null>(null);
  const [formNombre, setFormNombre] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formTipo, setFormTipo] = useState('diario');
  const [formCategoria, setFormCategoria] = useState('corporativo');
  const [formNivel, setFormNivel] = useState('2');

  const loadMediosHealth = useCallback(async () => {
    setMediosHealthLoading(true);
    try {
      const res = await fetch('/api/medios/health');
      if (res.ok) {
        const json = await res.json();
        setMediosHealth(json);
      }
    } catch { /* silent */ } finally {
      setMediosHealthLoading(false);
    }
  }, [setMediosHealth]);

  const handleCapture = async () => {
    setCaptureLoading(true);
    setCaptureResult(null);
    setError('');
    try {
      const res = await fetch(`/api/capture?count=${captureCount}`, { method: 'POST' });
      const json = await res.json();
      if (json.error) setError(json.error);
      else {
        setCaptureResult(json);
        try {
          const statsRes = await fetch('/api/stats');
          if (statsRes.ok) {
            const statsJson = await statsRes.json();
            setData(statsJson);
          }
        } catch { /* silent */ }
      }
    } catch {
      setError('Error al ejecutar captura');
    } finally {
      setCaptureLoading(false);
    }
  };

  // ─── Quick-add medio ──────────────────────────────────────
  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNombre.trim()) return;
    setAddSaving(true);
    setAddSuccess(null);
    try {
      const res = await fetch('/api/medios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: formNombre.trim(),
          url: formUrl.trim(),
          tipo: formTipo,
          categoria: formCategoria,
          nivel: formNivel,
        }),
      });
      if (res.ok) {
        setAddSuccess(formNombre.trim());
        setFormNombre('');
        setFormUrl('');
        setFormTipo('diario');
        setFormCategoria('corporativo');
        setFormNivel('2');
        setTimeout(() => setAddSuccess(null), 3000);
        // Refresh health
        loadMediosHealth();
      }
    } catch {
      // silent
    } finally {
      setAddSaving(false);
    }
  };

  return (
    <div className="space-y-4">

      {/* ═══ Agregar Fuente ═══ */}
      <Card className="border-primary/20 bg-primary/[0.02]">
        <CardHeader className="pb-2 pt-3 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-primary/10">
                <RadioTower className="h-4 w-4 text-primary" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold">Fuentes de Monitoreo</CardTitle>
                <CardDescription className="text-[10px]">
                  {mediosHealth
                    ? `${mediosHealth.resumen.total} fuentes registradas · ${mediosHealth.resumen.sanos} sanas`
                    : 'Gestiona las fuentes para captura'
                  }
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveView('medios')}
                className="text-xs gap-1.5"
              >
                Ver todas
                <ArrowRight className="h-3 w-3" />
              </Button>
              <Button
                variant={showAddForm ? 'outline' : 'default'}
                size="sm"
                onClick={() => setShowAddForm(!showAddForm)}
                className="text-xs gap-1.5"
              >
                {showAddForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                {showAddForm ? 'Cancelar' : 'Nueva Fuente'}
              </Button>
            </div>
          </div>
        </CardHeader>

        {/* Quick-add form */}
        {showAddForm && (
          <CardContent className="px-4 pb-4 pt-0">
            <form onSubmit={handleQuickAdd} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                    Nombre *
                  </label>
                  <input
                    type="text"
                    value={formNombre}
                    onChange={(e) => setFormNombre(e.target.value)}
                    placeholder="Ej: La Razon"
                    className="w-full px-3 py-1.5 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                    required
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                    URL
                  </label>
                  <input
                    type="url"
                    value={formUrl}
                    onChange={(e) => setFormUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full px-3 py-1.5 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                    Tipo
                  </label>
                  <select
                    value={formTipo}
                    onChange={(e) => setFormTipo(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {TIPO_OPTIONS.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                    Categoría
                  </label>
                  <select
                    value={formCategoria}
                    onChange={(e) => setFormCategoria(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {CATEGORIA_OPTIONS.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <label className="text-[11px] font-medium text-muted-foreground">Prioridad:</label>
                  <div className="flex gap-1">
                    {[
                      { value: '1', label: 'Alta', color: 'bg-red-100 text-red-700 border-red-200' },
                      { value: '2', label: 'Media', color: 'bg-amber-100 text-amber-700 border-amber-200' },
                      { value: '3', label: 'Baja', color: 'bg-stone-100 text-stone-700 border-stone-200' },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setFormNivel(opt.value)}
                        className={`px-2.5 py-1 rounded-md text-[10px] font-medium border transition-all ${
                          formNivel === opt.value ? opt.color : 'border-border bg-muted text-muted-foreground'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <Button
                  type="submit"
                  disabled={addSaving || !formNombre.trim()}
                  size="sm"
                  className="text-xs gap-1.5"
                >
                  {addSaving && <Loader2 className="h-3 w-3 animate-spin" />}
                  {addSaving ? 'Guardando...' : 'Registrar Fuente'}
                </Button>
              </div>
            </form>
            {addSuccess && (
              <div className="flex items-center gap-2 mt-2 px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                <span className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                  &quot;{addSuccess}&quot; registrada correctamente
                </span>
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* ═══ Health Check de Fuentes ═══ */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Activity className="h-4 w-4 text-muted-foreground" />
                Salud de Fuentes
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Detección de medios inactivos, degradados o con errores
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={loadMediosHealth} disabled={mediosHealthLoading} className="text-xs gap-1">
              {mediosHealthLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              Verificar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          {mediosHealth ? (
            <div className="space-y-3">
              {/* KPIs de salud */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                <div className="text-center p-2 rounded bg-background">
                  <p className="text-lg font-bold text-foreground">{mediosHealth.resumen.total}</p>
                  <p className="text-[10px] text-muted-foreground">Fuentes</p>
                </div>
                <div className="text-center p-2 rounded bg-emerald-50 dark:bg-emerald-950/20">
                  <p className="text-lg font-bold text-emerald-600">{mediosHealth.resumen.sanos}</p>
                  <p className="text-[10px] text-muted-foreground">Sanas</p>
                </div>
                <div className="text-center p-2 rounded bg-amber-50 dark:bg-amber-950/20">
                  <p className="text-lg font-bold text-amber-600">{mediosHealth.resumen.degradados}</p>
                  <p className="text-[10px] text-muted-foreground">Degradadas</p>
                </div>
                <div className="text-center p-2 rounded bg-red-50 dark:bg-red-950/20">
                  <p className="text-lg font-bold text-red-600">{mediosHealth.resumen.muertos}</p>
                  <p className="text-[10px] text-muted-foreground">Muertas</p>
                </div>
                <div className="text-center p-2 rounded bg-purple-50 dark:bg-purple-950/20">
                  <p className="text-lg font-bold text-purple-600">{mediosHealth.resumen.conErrores}</p>
                  <p className="text-[10px] text-muted-foreground">Con errores</p>
                </div>
              </div>

              {/* Barra de salud global */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-medium text-muted-foreground">Cobertura saludable</span>
                  <span className="text-[10px] font-bold">{mediosHealth.resumen.porcentajeSalud}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all"
                    style={{ width: `${mediosHealth.resumen.porcentajeSalud}%` }}
                  />
                </div>
              </div>

              {/* Medios con alertas */}
              {mediosHealth.medios.filter(m => m.salud !== 'sano').length > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> Alertas activas
                  </p>
                  <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-1.5">
                    {mediosHealth.medios.filter(m => m.salud !== 'sano').map(m => (
                      <div key={m.id} className="p-2 rounded-lg border border-border bg-muted/30">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                              m.salud === 'muerto' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' :
                              m.salud === 'degradado' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' :
                              'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
                            }`}>
                              {m.salud === 'muerto' ? 'MUERTA' : m.salud === 'degradado' ? 'DEGRADADA' : 'ERRORES'}
                            </span>
                            <span className="text-xs font-semibold text-foreground">{m.nombre}</span>
                          </div>
                          <span className="text-[10px] text-muted-foreground">{m.menciones30dias} menc. / 30d</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">{m.alerta}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Resumen por nivel */}
              {mediosHealth.porNivel.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-medium text-muted-foreground">Cobertura por nivel</p>
                  {mediosHealth.porNivel.map(n => (
                    <div key={n.nivel} className="flex items-center gap-2">
                      <span className="text-[9px] text-muted-foreground w-28 shrink-0 truncate">{n.label}</span>
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${n.total > 0 ? (n.sanos / n.total) * 100 : 0}%` }} />
                      </div>
                      <span className="text-[9px] font-medium text-muted-foreground w-14 text-right">{n.sanos}/{n.total}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : mediosHealthLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-4">Presiona &quot;Verificar&quot; para analizar el estado de las fuentes</p>
          )}
        </CardContent>
      </Card>

      {/* ═══ Captura Manual ═══ */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Zap className="h-4 w-4 text-muted-foreground" />
            Captura de menciones
          </CardTitle>
          <CardDescription className="text-xs">
            Busca menciones de legisladores en medios bolivianos automáticamente
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">Cantidad de búsquedas</label>
              <Input
                type="number"
                min={1}
                max={20}
                value={captureCount}
                onChange={(e) => setCaptureCount(parseInt(e.target.value) || 5)}
                className="w-32"
              />
            </div>
            <Button onClick={handleCapture} disabled={captureLoading} className="gap-2">
              {captureLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              Ejecutar captura
            </Button>
          </div>

          {captureResult && (
            <div className="p-4 rounded-lg bg-muted/50 border border-border space-y-3">
              <p className="text-sm font-semibold text-foreground">Resultado de la captura</p>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-xl font-bold text-primary">{captureResult.busquedas}</p>
                  <p className="text-[11px] text-muted-foreground">Búsquedas</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-emerald-600">{captureResult.mencionesNuevas}</p>
                  <p className="text-[11px] text-muted-foreground">Nuevas</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-red-600">{captureResult.errores}</p>
                  <p className="text-[11px] text-muted-foreground">Errores</p>
                </div>
              </div>
              {captureResult.detalles && captureResult.detalles.length > 0 && (
                <div className="max-h-40 overflow-y-auto custom-scrollbar">
                  {captureResult.detalles.map((d, i) => (
                    <p key={i} className="text-[11px] text-muted-foreground py-0.5">{d}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="text-[11px] text-muted-foreground">
            <p className="font-medium mb-1">Fuentes disponibles:</p>
            <p>La Razón, El Deber, Los Tiempos, Opinión, Correo del Sur, El Potosí, La Patria, El Diario, Jornada, Unitel, Red Uno, ATB Digital, Bolivia Verifica, ABI, eju.tv, El Mundo, Visión 360</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
