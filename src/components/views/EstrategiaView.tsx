'use client';

import { useState } from 'react';
import { Rocket, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { ESTRATEGIA_SECCIONES } from '@/constants/strategy';

export function EstrategiaView() {
  const [estrategiaSeccion, setEstrategiaSeccion] = useState(0);
  const sec = ESTRATEGIA_SECCIONES[estrategiaSeccion];
  const SeccionIcon = sec.icon;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      {/* TOC */}
      <div className="lg:col-span-3">
        <Card className="sticky top-20">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold flex items-center gap-2">
              <Rocket className="h-3.5 w-3.5 text-primary" />
              Estrategia Comercial
            </CardTitle>
            <CardDescription className="text-[10px]">v0.7.0 · Mayo 2025</CardDescription>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <nav className="space-y-0.5">
              {ESTRATEGIA_SECCIONES.map((s, i) => {
                const SIcon = s.icon;
                const isActive = i === estrategiaSeccion;
                return (
                  <button
                    key={s.id}
                    onClick={() => setEstrategiaSeccion(i)}
                    className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-[11px] font-medium transition-colors text-left ${
                      isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    <SIcon className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{s.titulo}</span>
                  </button>
                );
              })}
            </nav>
            <div className="mt-4 pt-3 border-t border-border">
              <p className="text-[9px] text-muted-foreground/60">Fuente: DECODEX_Estrategia_Comercial.pdf</p>
            </div>
          </CardContent>
        </Card>
      </div>
      {/* Content */}
      <div className="lg:col-span-9 space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <SeccionIcon className="h-4 w-4 text-primary" />
              </div>
              <CardTitle className="text-sm font-semibold">{sec.titulo}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {sec.id === 'resumen' && (
              <div className="space-y-4">
                <p className="text-xs text-foreground/80 leading-relaxed">{sec.contenido}</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {sec.kpis?.map((kpi) => (
                    <div key={kpi.label} className="p-3 rounded-lg bg-muted/50 border border-border text-center">
                      <p className="text-lg font-bold text-primary">{kpi.value}</p>
                      <p className="text-[10px] text-muted-foreground">{kpi.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {sec.id === 'vision' && (
              <div className="space-y-4">
                {sec.secciones?.map((s) => (
                  <div key={s.subtitulo}>
                    <h4 className="text-xs font-semibold text-foreground mb-1.5">{s.subtitulo}</h4>
                    <p className="text-xs text-foreground/80 leading-relaxed">{s.texto}</p>
                  </div>
                ))}
              </div>
            )}
            {sec.id === 'catalogo' && (
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-[10px]">Producto</TableHead>
                        <TableHead className="text-[10px]">Frec.</TableHead>
                        <TableHead className="text-[10px] hidden sm:table-cell">Horario</TableHead>
                        <TableHead className="text-[10px] hidden md:table-cell">Canales</TableHead>
                        <TableHead className="text-[10px]">Precio</TableHead>
                        <TableHead className="text-[10px]">Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sec.productos?.map((p) => (
                        <TableRow key={p.nombre}>
                          <TableCell className="py-2 text-xs font-medium">{p.nombre}</TableCell>
                          <TableCell className="py-2 text-[10px] text-muted-foreground">{p.frec}</TableCell>
                          <TableCell className="py-2 text-[10px] text-muted-foreground hidden sm:table-cell">{p.horario}</TableCell>
                          <TableCell className="py-2 text-[10px] text-muted-foreground hidden md:table-cell">{p.canales}</TableCell>
                          <TableCell className="py-2 text-[10px] font-semibold">{p.precio}</TableCell>
                          <TableCell className="py-2">
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${p.estado === 'operativo' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'}`}>
                              {p.estado === 'operativo' ? '✅ Op.' : '⚠️ Def.'}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <h4 className="text-xs font-semibold text-foreground">Combos Estratégicos</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {sec.combos?.map((c) => (
                    <div key={c.nombre} className="p-2.5 rounded-lg border border-border">
                      <p className="text-[11px] font-semibold text-foreground">{c.nombre}</p>
                      <p className="text-[10px] text-muted-foreground">{c.incluye}</p>
                      <p className="text-[10px] font-bold text-primary mt-1">{c.precio}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {sec.id === 'segmentacion' && (
              <div className="space-y-3">
                <p className="text-xs text-foreground/80 leading-relaxed">{sec.descripcion}</p>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-[10px]">Segmento</TableHead>
                        <TableHead className="text-[10px]">Prioridad</TableHead>
                        <TableHead className="text-[10px] hidden sm:table-cell">Actores</TableHead>
                        <TableHead className="text-[10px]">Mercado</TableHead>
                        <TableHead className="text-[10px] hidden md:table-cell">Ticket</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sec.segmentos?.map((s) => (
                        <TableRow key={s.nombre}>
                          <TableCell className="py-2 text-[11px] font-medium">{s.nombre}</TableCell>
                          <TableCell className="py-2">
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${s.prioridad === 'Alta' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' : s.prioridad === 'Media-Alta' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' : s.prioridad === 'Media' ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300' : 'bg-stone-100 text-stone-600 dark:bg-stone-800/40 dark:text-stone-300'}`}>{s.prioridad}</span>
                          </TableCell>
                          <TableCell className="py-2 text-[10px] text-muted-foreground hidden sm:table-cell">{s.actores}</TableCell>
                          <TableCell className="py-2 text-[10px] font-semibold">{s.mercado}</TableCell>
                          <TableCell className="py-2 text-[10px] text-muted-foreground hidden md:table-cell">{s.ticket}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
            {sec.id === 'ingresos' && (
              <div className="space-y-4">
                <p className="text-xs text-foreground/80 leading-relaxed">{sec.descripcion}</p>
                <div className="space-y-2">
                  {sec.fuentes?.map((f) => (
                    <div key={f.nombre} className="flex items-center gap-3">
                      <span className="text-[10px] font-bold text-primary w-8 text-right">{f.pct}%</span>
                      <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden"><div className="h-full bg-primary/20 rounded-full" style={{ width: `${f.pct}%` }} /></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-medium text-foreground truncate">{f.nombre}</p>
                        <p className="text-[9px] text-muted-foreground truncate">{f.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <h4 className="text-xs font-semibold text-foreground mt-4">Proyección por Fase</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {sec.proyeccion?.map((p) => (
                    <div key={p.fase} className="p-2.5 rounded-lg border border-border text-center">
                      <p className="text-[10px] text-muted-foreground">{p.fase}</p>
                      <p className="text-[10px] text-muted-foreground/60">{p.periodo}</p>
                      <p className="text-sm font-bold text-primary mt-1">{p.ingresos}</p>
                      <p className="text-[9px] text-muted-foreground">{p.clientes} clientes</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {sec.id === 'embudo' && (
              <div className="space-y-3">
                <p className="text-xs text-foreground/80 leading-relaxed">{sec.descripcion}</p>
                {sec.niveles?.map((n) => (
                  <div key={n.nivel} className="flex items-start gap-3 p-3 rounded-lg border border-border">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0"><span className="text-xs font-bold text-primary">{n.nivel}</span></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2"><p className="text-xs font-semibold text-foreground">{n.nombre}</p><span className="text-[10px] font-bold text-primary">{n.contactos}</span></div>
                      <p className="text-[10px] text-muted-foreground">{n.accion}</p>
                      <p className="text-[9px] text-muted-foreground/60">{n.conversion}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {sec.id === 'roadmap' && (
              <div className="space-y-3">
                <p className="text-xs text-foreground/80 leading-relaxed">{sec.descripcion}</p>
                {sec.fases?.map((f) => (
                  <div key={f.nombre} className={`p-3 rounded-lg border-l-4 ${f.estado === 'en_curso' ? 'border-l-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20' : 'border-l-muted-foreground/30 bg-muted/30'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-xs font-semibold text-foreground">{f.nombre}</p>
                      <span className="text-[10px] text-muted-foreground">{f.periodo}</span>
                      {f.estado === 'en_curso' && <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">En curso</span>}
                      {f.estado === 'pendiente' && <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium bg-stone-100 text-stone-500 dark:bg-stone-800/40 dark:text-stone-400">Pendiente</span>}
                    </div>
                    <p className="text-[10px] text-foreground/70 leading-relaxed">{f.detalle}</p>
                  </div>
                ))}
              </div>
            )}
            {sec.id === 'expansion' && (
              <div className="space-y-4">
                <div>
                  <h4 className="text-xs font-semibold text-foreground mb-2">Expansión Vertical</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {sec.vertical?.map((v) => (
                      <div key={v.nombre} className="p-3 rounded-lg border border-border">
                        <p className="text-[11px] font-semibold text-foreground">{v.nombre}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">{v.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-foreground mb-2">Expansión Horizontal</h4>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader><TableRow><TableHead className="text-[10px]">Mercado</TableHead><TableHead className="text-[10px]">Prioridad</TableHead><TableHead className="text-[10px]">Justificación</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {sec.horizontal?.map((h) => (
                          <TableRow key={h.mercado}>
                            <TableCell className="py-2 text-[11px] font-medium">{h.mercado}</TableCell>
                            <TableCell className="py-2"><span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${h.prioridad === 'Alta' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' : h.prioridad === 'Media-Alta' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' : 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300'}`}>{h.prioridad}</span></TableCell>
                            <TableCell className="py-2 text-[10px] text-muted-foreground">{h.justificacion}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            )}
            {sec.id === 'ventajas' && (
              <div className="space-y-3">
                {sec.ventajas?.map((v) => (
                  <div key={v.nombre} className="p-3 rounded-lg border border-border">
                    <p className="text-xs font-semibold text-foreground mb-1">{v.nombre}</p>
                    <p className="text-[10px] text-foreground/80 leading-relaxed">{v.desc}</p>
                  </div>
                ))}
              </div>
            )}
            {sec.id === 'estado' && (
              <div className="space-y-3">
                <p className="text-xs text-foreground/80 leading-relaxed">{sec.descripcion}</p>
                {sec.estadoProductos?.map((p) => (
                  <div key={p.nombre} className="flex items-center gap-3 p-2.5 rounded-lg border border-border">
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${p.estado === 'operativo' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'}`}>{p.estado === 'operativo' ? '✅' : '⚠️'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-medium text-foreground">{p.nombre}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{p.detalle}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
              <Button variant="outline" size="sm" onClick={() => setEstrategiaSeccion(Math.max(0, estrategiaSeccion - 1))} disabled={estrategiaSeccion === 0} className="text-xs gap-1"><ChevronLeft className="h-3 w-3" /> Anterior</Button>
              <span className="text-[10px] text-muted-foreground">{estrategiaSeccion + 1} / {ESTRATEGIA_SECCIONES.length}</span>
              <Button variant="outline" size="sm" onClick={() => setEstrategiaSeccion(Math.min(ESTRATEGIA_SECCIONES.length - 1, estrategiaSeccion + 1))} disabled={estrategiaSeccion === ESTRATEGIA_SECCIONES.length - 1} className="text-xs gap-1">Siguiente <ChevronRight className="h-3 w-3" /></Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
