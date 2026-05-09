'use client';

// Card imports available if needed
// import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Loader2,
  Zap,
  X,
  Activity,
  BarChart3,
  Thermometer,
  Target,
  Newspaper,
  Tag,
  Search,
  Radio,
  ArrowRight,
  ChevronLeft,
  Scale,
  AlertCircle,
  Clock,
} from 'lucide-react';
import { ALL_PRODUCTS } from '@/constants/nav';
import { PRODUCTOS } from '@/constants/products';
import { SENTIMIENTO_STYLES } from '@/constants/ui';

interface GeneratorDedicatedPanelProps {
  selectedGenerator: string;
  generatorData: Record<string, unknown> | null;
  generatorDataLoading: boolean;
  generatorFecha: string;
  generatorFiltros: Record<string, string[]>;
  generatorGenerating: boolean;
  onSelectEje: (ejeSlug: string) => void;
  onClearEje: () => void;
  onToggleEje: (ejeSlug: string) => void;
  onFechaChange: (newFecha: string) => void;
  onGenerate: () => void;
  onClose: () => void;
}

export function GeneratorDedicatedPanel({
  selectedGenerator,
  generatorData,
  generatorDataLoading,
  generatorFecha,
  generatorFiltros,
  generatorGenerating,
  onSelectEje,
  onClearEje,
  onToggleEje,
  onFechaChange,
  onGenerate,
  onClose,
}: GeneratorDedicatedPanelProps) {
  if (!selectedGenerator) return null;

  const prod = ALL_PRODUCTS.find(p => p.tipo === selectedGenerator);
  const productColor = prod?.color || '#6B7280';
  const ProductIcon = prod?.icon || Zap;
  const productConfig = PRODUCTOS[selectedGenerator as keyof typeof PRODUCTOS];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-card rounded-xl shadow-xl border border-border max-w-3xl w-full mx-4 max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>

        {/* ── HEADER (data-driven desde ALL_PRODUCTS) ── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div
              className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: productColor + '20' }}
            >
              <ProductIcon className="h-5 w-5" style={{ color: productColor }} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">
                {prod?.nombre || selectedGenerator} — Generador
              </h3>
              <p className="text-[10px] text-muted-foreground">
                {productConfig?.generador.descripcionVentana || productConfig?.descripcion || ''}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* ── BODY ── */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {generatorDataLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Cargando datos del generador...</p>
            </div>
          ) : generatorData ? (
            <>

              {/* ═══ Panel FASE ANALISIS (productos con tieneFases, eje seleccionado) ═══ */}
              {(() => {
                const config = PRODUCTOS[selectedGenerator as keyof typeof PRODUCTOS]?.generador;
                return config?.tieneFases && (generatorData.fase as string) === 'analisis';
              })() && (
                <>
                  {/* Sub-header con eje seleccionado */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: (generatorData.ejeSeleccionado as { color: string })?.color || '#F59E0B' }} />
                      <h4 className="text-sm font-bold text-foreground">{(generatorData.ejeSeleccionado as { nombre: string })?.nombre}</h4>
                      <Badge variant="secondary" className="text-[9px]">{generatorData.totalMenciones as number} menciones</Badge>
                    </div>
                    <Button variant="ghost" size="sm" onClick={onClearEje} className="text-[10px] gap-1 h-7">
                      <ChevronLeft className="h-3 w-3" /> Cambiar eje
                    </Button>
                  </div>

                  {/* 2x2 Deep Analysis Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

                    {/* 1. Sentimiento del Eje */}
                    <div className="p-4 rounded-xl border border-border space-y-3">
                      <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <Thermometer className="h-3.5 w-3.5 text-amber-500" />
                        Sentimiento del Eje
                      </p>
                      {(generatorData.sentimientoResumen as { promedio: number; label: string; distribucion: Record<string, number> }) && (
                        <>
                          <div className="flex items-center gap-3">
                            <div className="text-2xl font-bold text-foreground">
                              {(generatorData.sentimientoResumen as { promedio: number }).promedio.toFixed(1)}
                            </div>
                            <div className="flex-1">
                              <div className="h-3 bg-muted rounded-full overflow-hidden">
                                <div className="h-full rounded-full transition-all" style={{
                                  width: `${((generatorData.sentimientoResumen as { promedio: number }).promedio / 5) * 100}%`,
                                  backgroundColor: (generatorData.sentimientoResumen as { promedio: number }).promedio >= 3.5 ? '#10B981'
                                    : (generatorData.sentimientoResumen as { promedio: number }).promedio >= 2.5 ? '#F59E0B' : '#EF4444',
                                }} />
                              </div>
                              <div className="flex items-center justify-between mt-0.5">
                                <span className="text-[9px] text-muted-foreground">Negativo</span>
                                <span className={`text-[10px] font-semibold ${
                                  (generatorData.sentimientoResumen as { promedio: number }).promedio >= 3.5 ? 'text-emerald-600 dark:text-emerald-400'
                                    : (generatorData.sentimientoResumen as { promedio: number }).promedio >= 2.5 ? 'text-amber-600 dark:text-amber-400'
                                    : 'text-red-600 dark:text-red-400'
                                }`}>
                                  {(generatorData.sentimientoResumen as { label: string }).label.toUpperCase()}
                                </span>
                                <span className="text-[9px] text-muted-foreground">Positivo</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 flex-wrap">
                            {Object.entries((generatorData.sentimientoResumen as { distribucion: Record<string, number> }).distribucion)
                              .sort(([, a], [, b]) => b - a)
                              .slice(0, 4)
                              .map(([sent, count]) => (
                                <span key={sent} className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${SENTIMIENTO_STYLES[sent] || 'bg-muted text-muted-foreground'}`}>
                                  {sent.replace('_', ' ')} ({count})
                                </span>
                              ))
                            }
                          </div>
                        </>
                      )}
                    </div>

                    {/* 2. Actividad del Eje */}
                    <div className="p-4 rounded-xl border border-border space-y-3">
                      <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
                        Actividad del Eje
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold text-foreground">{generatorData.totalMenciones as number || 0}</span>
                        <span className="text-xs text-muted-foreground">menciones</span>
                      </div>
                      {/* Mini bar chart by hour */}
                      {(generatorData.evolucionHoraria as Array<{ hora: number; count: number }>)?.length > 0 && (
                        <div className="flex items-end gap-0.5 h-12">
                          {(generatorData.evolucionHoraria as Array<{ hora: number; count: number }>).map((ev) => {
                            const maxCount = Math.max(...(generatorData.evolucionHoraria as Array<{ count: number }>).map(e => e.count), 1);
                            const height = ev.count > 0 ? Math.max((ev.count / maxCount) * 100, 4) : 4;
                            return (
                              <div key={ev.hora} className="flex-1 flex flex-col items-center gap-0.5" title={`${ev.hora}:00 — ${ev.count} menc.`}>
                                <div
                                  className="w-full rounded-t-sm transition-all"
                                  style={{
                                    height: `${height}%`,
                                    backgroundColor: ev.count > 0 ? '#F59E0B' : '#E4E4E720',
                                    minHeight: '2px',
                                  }}
                                />
                                <span className="text-[7px] text-muted-foreground leading-none">{String(ev.hora).padStart(2, '0')}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* 3. Actores en el Eje */}
                    <div className="p-4 rounded-xl border border-border space-y-3">
                      <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <Target className="h-3.5 w-3.5 text-muted-foreground" />
                        Actores en el Eje
                      </p>
                      <div className="space-y-1.5">
                        {(generatorData.topActores as Array<{ nombre: string; partidoSigla: string; count: number }>)?.length > 0
                          ? (generatorData.topActores as Array<{ nombre: string; partidoSigla: string; count: number }>).slice(0, 5).map((actor, i) => (
                            <div key={actor.nombre} className="flex items-center gap-2 text-[10px]">
                              <span className={`font-bold w-4 text-center ${i === 0 ? 'text-amber-500' : i === 1 ? 'text-stone-400' : 'text-amber-700'}`}>
                                #{i + 1}
                              </span>
                              <span className="text-foreground font-medium truncate">{actor.nombre}</span>
                              <span className="text-muted-foreground shrink-0">{actor.partidoSigla}</span>
                              <Badge variant="secondary" className="text-[8px] ml-auto shrink-0">{actor.count}</Badge>
                            </div>
                          ))
                          : <p className="text-[10px] text-muted-foreground italic">Sin actores en este eje</p>
                        }
                      </div>
                    </div>

                    {/* 4. Fuentes del Eje */}
                    <div className="p-4 rounded-xl border border-border space-y-3">
                      <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <Newspaper className="h-3.5 w-3.5 text-muted-foreground" />
                        Fuentes del Eje
                      </p>
                      <div className="space-y-1.5">
                        {(generatorData.mediosDistribucion as Array<{ nombre: string; count: number }>)?.length > 0
                          ? (generatorData.mediosDistribucion as Array<{ nombre: string; count: number }>).slice(0, 5).map((medio, i) => (
                            <div key={medio.nombre} className="flex items-center gap-2 text-[10px]">
                              <span className={`font-bold w-4 text-center ${i === 0 ? 'text-amber-500' : i === 1 ? 'text-stone-400' : 'text-amber-700'}`}>
                                #{i + 1}
                              </span>
                              <span className="text-foreground font-medium truncate">{medio.nombre}</span>
                              <Badge variant="secondary" className="text-[8px] ml-auto shrink-0">{medio.count}</Badge>
                            </div>
                          ))
                          : <p className="text-[10px] text-muted-foreground italic">Sin fuentes para este eje</p>
                        }
                      </div>
                    </div>
                  </div>

                  {/* Sub-temas */}
                  {(generatorData.subTemas as Array<{ tema: string; count: number }>)?.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                        Sub-temas en el eje
                      </p>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {(generatorData.subTemas as Array<{ tema: string; count: number }>).map((st) => (
                          <Badge key={st.tema} variant="secondary" className="text-[9px] gap-1">
                            {st.tema} <span className="text-muted-foreground">({st.count})</span>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Preview de menciones */}
                  {(generatorData.mencionesPreview as Array<{ id: string; titulo: string; sentimiento: string; persona: { nombre: string } | null; fechaCaptura: string; medio: { nombre: string } }>)?.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <Newspaper className="h-3.5 w-3.5 text-muted-foreground" />
                        Menciones del eje
                        <span className="text-[9px] font-normal text-muted-foreground">
                          (máx. 20 de {generatorData.totalMenciones as number})
                        </span>
                      </p>
                      <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
                        {(generatorData.mencionesPreview as Array<{ id: string; titulo: string; sentimiento: string; persona: { nombre: string } | null; fechaCaptura: string; medio: { nombre: string } }>).map((m) => (
                          <div key={m.id} className="flex items-start gap-2 p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                            <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-medium shrink-0 mt-0.5 ${SENTIMIENTO_STYLES[m.sentimiento] || ''}`}>
                              {(m.sentimiento || '').replace('_', ' ')}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] text-foreground font-medium truncate">{m.titulo}</p>
                              <p className="text-[9px] text-muted-foreground">
                                {m.persona?.nombre && <span>{m.persona.nombre} · </span>}
                                {m.medio?.nombre && <span>{m.medio.nombre} · </span>}
                                {m.fechaCaptura && <Clock className="h-2.5 w-2.5 inline mr-0.5" />}
                                {m.fechaCaptura && new Date(m.fechaCaptura).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* ═══ Panel SELECCION DE EJE (productos con tieneFases, sin eje seleccionado) ═══ */}
              {(() => {
                const config = PRODUCTOS[selectedGenerator as keyof typeof PRODUCTOS]?.generador;
                return config?.tieneFases && (generatorData.fase as string) !== 'analisis';
              })() && (
                <>
                  {/* Fecha */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                      Fecha del reporte
                    </label>
                    <div className="flex items-center gap-3">
                      <Input
                        type="date"
                        value={generatorFecha}
                        onChange={(e) => onFechaChange(e.target.value)}
                        className="max-w-[200px] text-sm h-9"
                      />
                      {(generatorData.windowLabel as string) && (
                        <span className="text-[10px] text-muted-foreground">
                          Ventana: {(generatorData.windowLabel as string)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Grid de ejes disponibles */}
                  {(generatorData.ejesDisponibles as Array<{ id: string; nombre: string; slug: string; color: string; descripcion: string; mencionesCount: number }>)?.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                          <Search className="h-3.5 w-3.5 text-amber-500" />
                          Selecciona un eje temático
                        </label>
                        <span className="text-[9px] text-muted-foreground">
                          {(generatorData.totalMencionesDia as number) || 0} menciones en el día
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto custom-scrollbar">
                        {(generatorData.ejesDisponibles as Array<{ id: string; nombre: string; slug: string; color: string; descripcion: string; mencionesCount: number }>).map((eje) => (
                          <button
                            key={eje.id}
                            onClick={() => onSelectEje(eje.slug)}
                            className="flex items-start gap-3 p-3 rounded-xl border border-border hover:border-amber-400/50 hover:bg-amber-50/50 dark:hover:bg-amber-950/20 transition-all text-left"
                          >
                            <div className="h-3 w-3 rounded-full shrink-0 mt-0.5" style={{ backgroundColor: eje.color || '#F59E0B' }} />
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] font-bold text-foreground">{eje.nombre}</p>
                              {eje.descripcion && (
                                <p className="text-[9px] text-muted-foreground mt-0.5 line-clamp-2">{eje.descripcion}</p>
                              )}
                              <div className="flex items-center gap-1.5 mt-1.5">
                                <Badge variant="secondary" className="text-[8px]">
                                  {eje.mencionesCount} menc.
                                </Badge>
                              </div>
                            </div>
                            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-1" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* ═══ Panel RADAR SEMANAL (productos con panelId === 'radar') ═══ */}
              {(() => {
                const config = PRODUCTOS[selectedGenerator as keyof typeof PRODUCTOS]?.generador;
                return config?.panelId === 'radar';
              })() && (
                <>
                  {/* Fecha + ventana semanal */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                      Semana del reporte
                    </label>
                    <div className="flex items-center gap-3">
                      <Input
                        type="date"
                        value={generatorFecha}
                        onChange={(e) => onFechaChange(e.target.value)}
                        className="max-w-[200px] text-sm h-9"
                      />
                      {(generatorData.windowLabel as string) && (
                        <span className="text-[10px] text-muted-foreground">
                          {(generatorData.windowLabel as string)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Hallazgo clave */}
                  {(generatorData.hallazgoClave as string) && (
                    <div className="p-3 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 space-y-1">
                      <p className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                        <Radio className="h-3 w-3" /> Hallazgo clave
                      </p>
                      <p className="text-[11px] text-foreground leading-relaxed">{generatorData.hallazgoClave as string}</p>
                    </div>
                  )}

                  {/* KPIs rápidos */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="p-3 rounded-lg border border-border text-center">
                      <p className="text-lg font-bold text-foreground">{generatorData.totalMenciones as number || 0}</p>
                      <p className="text-[9px] text-muted-foreground">Menciones</p>
                    </div>
                    <div className="p-3 rounded-lg border border-border text-center">
                      <p className="text-lg font-bold text-foreground">{generatorData.totalEjesActivos as number || 0}</p>
                      <p className="text-[9px] text-muted-foreground">Ejes activos</p>
                    </div>
                    <div className="p-3 rounded-lg border border-border text-center">
                      <div className="text-lg font-bold text-foreground">
                        {(generatorData.sentimientoGlobal as { promedio: number })?.promedio?.toFixed(1) || '—'}
                      </div>
                      <p className="text-[9px] text-muted-foreground">
                        {(generatorData.sentimientoGlobal as { label: string })?.label || 'N/D'}
                      </p>
                    </div>
                  </div>

                  {/* Evolución diaria */}
                  {(generatorData.evolucionDiaria as Array<{ dia: string; count: number }>)?.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
                        Evolución diaria
                      </p>
                      <div className="flex items-end gap-2 h-20">
                        {(generatorData.evolucionDiaria as Array<{ fecha: string; dia: string; count: number }>).map((d) => {
                          const maxDay = Math.max(...(generatorData.evolucionDiaria as Array<{ count: number }>).map(x => x.count), 1);
                          const h = Math.max((d.count / maxDay) * 100, 4);
                          return (
                            <div key={d.fecha} className="flex-1 flex flex-col items-center gap-1">
                              <span className="text-[9px] font-bold text-foreground">{d.count}</span>
                              <div className="w-full rounded-t-sm bg-emerald-500/80 transition-all" style={{ height: `${h}%` }} />
                              <span className="text-[8px] text-muted-foreground">{d.dia}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Radar de 11 ejes */}
                  {(generatorData.radarEjes as Array<{
                    nombre: string; slug: string; color: string; menciones: number;
                    sentimientoProm: number; sentimientoLabel: string;
                    topActor: string | null; hallazgo: string;
                    tendencia: 'ascendente' | 'estable' | 'descendente';
                  }>)?.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <Radio className="h-3 w-3 text-emerald-500" />
                        Radar de ejes temáticos
                        <span className="text-[9px] font-normal text-muted-foreground">
                          {(generatorData.radarEjes as unknown[]).length} ejes
                        </span>
                      </p>
                      <div className="space-y-1.5 max-h-72 overflow-y-auto custom-scrollbar">
                        {(generatorData.radarEjes as Array<{
                          nombre: string; slug: string; color: string; menciones: number;
                          sentimientoProm: number; sentimientoLabel: string;
                          topActor: string | null; hallazgo: string;
                          tendencia: 'ascendente' | 'estable' | 'descendente';
                        }>).map((eje) => {
                          const maxMenc = Math.max(...(generatorData.radarEjes as Array<{ menciones: number }>).map(e => e.menciones), 1);
                          const barWidth = Math.max((eje.menciones / maxMenc) * 100, 2);
                          const tendenciaIcon = eje.tendencia === 'ascendente' ? '↑' : eje.tendencia === 'descendente' ? '↓' : '→';
                          const tendenciaColor = eje.tendencia === 'ascendente' ? 'text-emerald-500' : eje.tendencia === 'descendente' ? 'text-red-500' : 'text-muted-foreground';
                          return (
                            <div key={eje.slug} className="p-2.5 rounded-lg border border-border hover:border-primary/20 transition-all">
                              <div className="flex items-center gap-2 mb-1.5">
                                <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: eje.color || '#22C55E' }} />
                                <p className="text-[11px] font-bold text-foreground flex-1 truncate">{eje.nombre}</p>
                                <span className={`text-[10px] font-mono font-bold ${tendenciaColor}`}>{tendenciaIcon}</span>
                                <Badge variant="secondary" className="text-[8px] shrink-0">{eje.menciones} menc.</Badge>
                              </div>
                              <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-1.5">
                                <div className="h-full rounded-full transition-all" style={{ width: `${barWidth}%`, backgroundColor: eje.color || '#22C55E' }} />
                              </div>
                              <div className="flex items-center gap-3 text-[9px] text-muted-foreground">
                                <span>Sentimiento: <span className={`font-medium ${eje.sentimientoLabel === 'positivo' ? 'text-emerald-600 dark:text-emerald-400' : eje.sentimientoLabel === 'negativo' ? 'text-red-600 dark:text-red-400' : ''}`}>{eje.sentimientoProm.toFixed(1)}</span></span>
                                {eje.topActor && <span>Actor: <span className="font-medium text-foreground">{eje.topActor}</span></span>}
                              </div>
                              <p className="text-[9px] text-muted-foreground mt-1 line-clamp-1">{eje.hallazgo}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Top actores de la semana */}
                  {(generatorData.topActores as Array<{ nombre: string; partidoSigla: string; count: number; ejesPrincipales: string[] }>)?.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <Target className="h-3.5 w-3.5 text-muted-foreground" />
                        Actores de la semana
                      </p>
                      <div className="space-y-1.5">
                        {(generatorData.topActores as Array<{ nombre: string; partidoSigla: string; camara: string; count: number; ejesPrincipales: string[] }>).slice(0, 5).map((actor, i) => (
                          <div key={actor.nombre} className="flex items-center gap-2 text-[10px]">
                            <span className={`font-bold w-4 text-center ${i === 0 ? 'text-amber-500' : i === 1 ? 'text-stone-400' : 'text-amber-700'}`}>
                              #{i + 1}
                            </span>
                            <span className="text-foreground font-medium truncate">{actor.nombre}</span>
                            <span className="text-muted-foreground shrink-0">{actor.partidoSigla}</span>
                            {actor.ejesPrincipales.length > 0 && (
                              <div className="flex items-center gap-0.5 ml-auto shrink-0">
                                {actor.ejesPrincipales.slice(0, 2).map(ej => {
                                  const ejeInfo = (generatorData.radarEjes as Array<{ slug: string; color: string; nombre: string }>)?.find(e => e.slug === ej);
                                  return ejeInfo ? (
                                    <span key={ej} className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: ejeInfo.color }} title={ejeInfo.nombre} />
                                  ) : null;
                                })}
                                {actor.ejesPrincipales.length > 2 && <span className="text-[8px] text-muted-foreground">+{actor.ejesPrincipales.length - 2}</span>}
                              </div>
                            )}
                            <Badge variant="secondary" className="text-[8px] shrink-0">{actor.count}</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Preview menciones */}
                  {(generatorData.mencionesPreview as Array<{ id: string; titulo: string; sentimiento: string; persona: { nombre: string } | null; fechaCaptura: string; medio: { nombre: string }; ejes: Array<{ nombre: string; color: string }> }>)?.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <Newspaper className="h-3.5 w-3.5 text-muted-foreground" />
                        Menciones recientes
                        <span className="text-[9px] font-normal text-muted-foreground">
                          (máx. 15 de {(generatorData.totalMenciones as number)})
                        </span>
                      </p>
                      <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
                        {(generatorData.mencionesPreview as Array<{ id: string; titulo: string; sentimiento: string; persona: { nombre: string } | null; fechaCaptura: string; medio: { nombre: string }; ejes: Array<{ nombre: string; color: string }> }>).map((m) => (
                          <div key={m.id} className="flex items-start gap-2 p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                            <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-medium shrink-0 mt-0.5 ${SENTIMIENTO_STYLES[m.sentimiento] || ''}`}>
                              {(m.sentimiento || '').replace('_', ' ')}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] text-foreground font-medium truncate">{m.titulo}</p>
                              <div className="flex items-center gap-1 mt-0.5">
                                {m.persona?.nombre && <span className="text-[9px] text-muted-foreground">{m.persona.nombre}</span>}
                                {m.medio?.nombre && <span className="text-[9px] text-muted-foreground">· {m.medio.nombre}</span>}
                                <span className="text-[9px] text-muted-foreground">
                                  <Clock className="h-2 w-2 inline mr-0.5" />
                                  {new Date(m.fechaCaptura).toLocaleDateString('es-BO', { day: '2-digit', month: 'short' })}
                                </span>
                              </div>
                              {m.ejes?.length > 0 && (
                                <div className="flex items-center gap-0.5 mt-0.5">
                                  {m.ejes.slice(0, 3).map(ej => (
                                    <span key={ej.nombre} className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: ej.color }} title={ej.nombre} />
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* ═══ Panel TERMOMETRO/SALDO (productos con panelId === 'termometro_saldo') ═══ */}
              {(() => {
                const config = PRODUCTOS[selectedGenerator as keyof typeof PRODUCTOS]?.generador;
                return config?.panelId === 'termometro_saldo';
              })() && (
                <>
                  {/* Fecha */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                      Fecha del reporte
                    </label>
                    <div className="flex items-center gap-3">
                      <Input
                        type="date"
                        value={generatorFecha}
                        onChange={(e) => onFechaChange(e.target.value)}
                        className="max-w-[200px] text-sm h-9"
                      />
                      {(generatorData.windowLabel as string) && (
                        <span className="text-[10px] text-muted-foreground">
                          Ventana: {(generatorData.windowLabel as string)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Ejes temáticos */}
                  {(generatorData.ejesTematicos as Array<{ id: string; nombre: string; slug: string; color: string }>)?.length > 0 && (
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                        Ejes temáticos a incluir
                        <span className="text-[9px] font-normal text-muted-foreground">
                          {(generatorFiltros.ejes?.length || 0)} de {(generatorData.ejesTematicos as Array<unknown>).length} seleccionados
                        </span>
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto custom-scrollbar">
                        {(generatorData.ejesTematicos as Array<{ id: string; nombre: string; slug: string; color: string }>).map((eje) => {
                          const isSelected = (generatorFiltros.ejes || []).includes(eje.slug);
                          const ejeMenciones = (generatorData.ejesConMenciones as Array<{ slug: string; count: number }>)?.find(ec => ec.slug === eje.slug);
                          return (
                            <button
                              key={eje.id}
                              onClick={() => onToggleEje(eje.slug)}
                              className={`
                                flex items-center gap-2 p-2 rounded-lg border text-left transition-all text-[11px]
                                ${isSelected
                                  ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                                  : 'border-border hover:border-primary/30 hover:bg-muted/50'
                                }
                              `}
                            >
                              <div className="h-4 w-4 rounded flex items-center justify-center shrink-0 border"
                                style={{
                                  borderColor: isSelected ? (eje.color || 'var(--primary)') : undefined,
                                  backgroundColor: isSelected ? (eje.color || 'var(--primary)') + '30' : undefined,
                                }}
                              >
                                {isSelected && (
                                  <svg className="h-2.5 w-2.5" style={{ color: eje.color || 'var(--primary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <span className="font-medium text-foreground truncate block">{eje.nombre}</span>
                                {ejeMenciones && ejeMenciones.count > 0 && (
                                  <span className="text-[9px] text-muted-foreground">{ejeMenciones.count} menc.</span>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Resumen de menciones y clima */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Clima / Sentimiento */}
                    <div className="p-4 rounded-xl border border-border space-y-3">
                      <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        {selectedGenerator === 'EL_TERMOMETRO'
                          ? <Thermometer className="h-3.5 w-3.5 text-blue-500" />
                          : <Scale className="h-3.5 w-3.5 text-purple-500" />
                        }
                        {selectedGenerator === 'EL_TERMOMETRO' ? 'Indicador de Clima' : 'Balance de Sentimiento'}
                      </p>
                      {(generatorData.sentimientoResumen as { promedio: number; label: string; distribucion: Record<string, number> }) && (
                        <>
                          <div className="flex items-center gap-3">
                            <div className="text-2xl font-bold text-foreground">
                              {(generatorData.sentimientoResumen as { promedio: number }).promedio.toFixed(1)}
                            </div>
                            <div className="flex-1">
                              <div className="h-3 bg-muted rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{
                                    width: `${((generatorData.sentimientoResumen as { promedio: number }).promedio / 5) * 100}%`,
                                    backgroundColor: (generatorData.sentimientoResumen as { promedio: number }).promedio >= 3.5
                                      ? '#10B981'
                                      : (generatorData.sentimientoResumen as { promedio: number }).promedio >= 2.5
                                        ? '#F59E0B'
                                        : '#EF4444',
                                  }}
                                />
                              </div>
                              <div className="flex items-center justify-between mt-0.5">
                                <span className="text-[9px] text-muted-foreground">Negativo</span>
                                <span className={`text-[10px] font-semibold ${
                                  (generatorData.sentimientoResumen as { promedio: number }).promedio >= 3.5
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : (generatorData.sentimientoResumen as { promedio: number }).promedio >= 2.5
                                      ? 'text-amber-600 dark:text-amber-400'
                                      : 'text-red-600 dark:text-red-400'
                                }`}>
                                  {(generatorData.sentimientoResumen as { label: string }).label.toUpperCase()}
                                </span>
                                <span className="text-[9px] text-muted-foreground">Positivo</span>
                              </div>
                            </div>
                          </div>
                          {/* Distribución */}
                          <div className="flex items-center gap-1 flex-wrap">
                            {Object.entries((generatorData.sentimientoResumen as { distribucion: Record<string, number> }).distribucion)
                              .sort(([, a], [, b]) => b - a)
                              .slice(0, 4)
                              .map(([sent, count]) => (
                                <span key={sent} className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${SENTIMIENTO_STYLES[sent] || 'bg-muted text-muted-foreground'}`}>
                                  {sent.replace('_', ' ')} ({count})
                                </span>
                              ))
                            }
                          </div>
                        </>
                      )}
                    </div>

                    {/* Total menciones + top actores / ejes */}
                    <div className="p-4 rounded-xl border border-border space-y-3">
                      <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
                        Resumen de actividad
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold text-foreground">{(generatorData.totalMenciones as number) || 0}</span>
                        <span className="text-xs text-muted-foreground">menciones</span>
                      </div>
                      {selectedGenerator === 'EL_TERMOMETRO' && (
                        <>
                          <p className="text-[10px] font-medium text-muted-foreground">Top 3 actores nocturnos</p>
                          <div className="space-y-1.5">
                            {(generatorData.topActores as Array<{ nombre: string; partidoSigla: string; count: number }>)?.slice(0, 3).map((actor, i) => (
                              <div key={actor.nombre} className="flex items-center gap-2 text-[10px]">
                                <span className={`font-bold w-4 text-center ${i === 0 ? 'text-amber-500' : i === 1 ? 'text-stone-400' : 'text-amber-700'}`}>
                                  #{i + 1}
                                </span>
                                <span className="text-foreground font-medium truncate">{actor.nombre}</span>
                                <span className="text-muted-foreground shrink-0">{actor.partidoSigla}</span>
                                <Badge variant="secondary" className="text-[8px] ml-auto shrink-0">{actor.count}</Badge>
                              </div>
                            )) || (
                              <p className="text-[10px] text-muted-foreground italic">Sin actores en la ventana</p>
                            )}
                          </div>
                        </>
                      )}
                      {selectedGenerator === 'SALDO_DEL_DIA' && (
                        <>
                          <p className="text-[10px] font-medium text-muted-foreground">Top 3 ejes del día</p>
                          <div className="space-y-1.5">
                            {(generatorData.topEjes as Array<{ nombre: string; slug: string; count: number; color: string }>)?.slice(0, 3).map((eje, i) => (
                              <div key={eje.slug} className="flex items-center gap-2 text-[10px]">
                                <span className={`font-bold w-4 text-center ${i === 0 ? 'text-amber-500' : i === 1 ? 'text-stone-400' : 'text-amber-700'}`}>
                                  #{i + 1}
                                </span>
                                <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: eje.color || '#6B7280' }} />
                                <span className="text-foreground font-medium truncate">{eje.nombre}</span>
                                <Badge variant="secondary" className="text-[8px] ml-auto shrink-0">{eje.count}</Badge>
                              </div>
                            )) || (
                              <p className="text-[10px] text-muted-foreground italic">Sin ejes con actividad</p>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Menciones recientes (preview) */}
                  {(generatorData.menciones as Array<{ id: string; titulo: string; sentimiento: string; persona: { nombre: string } | null; fechaCaptura: string }>)?.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <Newspaper className="h-3.5 w-3.5 text-muted-foreground" />
                        Menciones recientes
                        <span className="text-[9px] font-normal text-muted-foreground">
                          (máx. 50 de {(generatorData.totalMenciones as number)})
                        </span>
                      </p>
                      <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
                        {(generatorData.menciones as Array<{ id: string; titulo: string; sentimiento: string; persona: { nombre: string } | null; fechaCaptura: string }>).slice(0, 15).map((m) => (
                          <div key={m.id} className="flex items-start gap-2 p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                            <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-medium shrink-0 mt-0.5 ${SENTIMIENTO_STYLES[m.sentimiento] || ''}`}>
                              {(m.sentimiento || '').replace('_', ' ')}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] text-foreground font-medium truncate">{m.titulo}</p>
                              <p className="text-[9px] text-muted-foreground">
                                {m.persona?.nombre && <span>{m.persona.nombre} · </span>}
                                {new Date(m.fechaCaptura).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <AlertCircle className="h-5 w-5 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">No se pudieron cargar los datos</p>
            </div>
          )}
        </div>

        {/* ── FOOTER (data-driven) ── */}
        {(() => {
          const tieneFases = productConfig?.generador?.tieneFases;
          const inAnalisis = tieneFases && (generatorData?.fase as string) === 'analisis';

          // Determine button disabled state
          const disabled = generatorGenerating || generatorDataLoading
            || !generatorData
            || (tieneFases && !inAnalisis);

          // Button label: append context for phased products
          let buttonLabel = `Generar ${prod?.nombre || selectedGenerator}`;
          if (tieneFases && generatorData?.ejeSeleccionado) {
            buttonLabel += `: ${(generatorData.ejeSeleccionado as { nombre: string }).nombre}`;
          }

          return (
            <div className="flex items-center justify-between px-5 py-4 border-t border-border shrink-0">
              <Button variant="ghost" size="sm" onClick={onClose} className="text-xs">
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={onGenerate}
                disabled={disabled}
                className="text-xs gap-1.5"
                style={{ backgroundColor: productColor, borderColor: productColor }}
              >
                {generatorGenerating
                  ? <><Loader2 className="h-3 w-3 animate-spin" /> Generando...</>
                  : <><ProductIcon className="h-3 w-3" /> {buttonLabel}</>
                }
              </Button>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
