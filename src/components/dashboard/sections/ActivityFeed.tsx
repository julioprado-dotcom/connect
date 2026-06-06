'use client';

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableCell, TableHead } from '@/components/ui/table';
import { Newspaper, Monitor, ChevronRight } from 'lucide-react';
import { MiniGauge } from '@/components/dashboard/gauges/MiniGauge';
import { TIPO_MENCION_LABELS, TRATAMIENTO_STYLES, TRATAMIENTO_LABELS } from '@/constants/ui';
import type { DashboardData, MediosHealthData } from '@/types/dashboard';

// ─── Animation variants (local to this section) ──────────────

const fadeInUp = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.35, ease: 'easeOut' as const },
  }),
};

// ─── Props ────────────────────────────────────────────────────

interface ActivityFeedProps {
  data: DashboardData;
  mediosHealth: MediosHealthData | null;
  setActiveView: (viewId: string) => void;
}

// ─── Component ────────────────────────────────────────────────

export function ActivityFeed({ data, mediosHealth, setActiveView }: ActivityFeedProps) {
  const saludPercent = useMemo(
    () => mediosHealth?.resumen.porcentajeSalud || 0,
    [mediosHealth?.resumen.porcentajeSalud]
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

      {/* Ultimas menciones */}
      <motion.div
        variants={fadeInUp}
        initial="hidden"
        animate="visible"
        custom={6}
      >
        <Card className="hover:shadow-md transition-all cursor-pointer" onClick={() => setActiveView('menciones')}>
          <CardHeader className="pb-2 pt-3 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Newspaper className="h-4 w-4 text-muted-foreground" />
                Ultimas menciones
              </CardTitle>
              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                Ver todas <ChevronRight className="h-3 w-3" />
              </span>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            {data.ultimasMenciones?.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-[10px] h-7">Legislador</TableHead>
                      <TableHead className="text-[10px] h-7 hidden sm:table-cell">Medio</TableHead>
                      <TableHead className="text-[10px] h-7">Tipo</TableHead>
                      <TableHead className="text-[10px] h-7 hidden md:table-cell">Trat.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.ultimasMenciones.slice(0, 5).map((m) => (
                      <TableRow key={m.id} className="hover:bg-muted/50">
                        <TableCell className="py-1.5 px-2">
                          <div className="min-w-0">
                            <p className="text-[11px] font-medium text-foreground truncate max-w-[100px]">{m.persona?.nombre || m.titulo?.substring(0, 25) || '—'}</p>
                            <p className="text-[9px] text-muted-foreground">{m.persona?.partidoSigla || (m.tipoMencion === 'referencia_tematica' ? 'Temático' : '')}</p>
                          </div>
                        </TableCell>
                        <TableCell className="py-1.5 px-2 hidden sm:table-cell">
                          <span className="text-[10px] text-muted-foreground truncate max-w-[80px] block">{m.medio?.nombre || '—'}</span>
                        </TableCell>
                        <TableCell className="py-1.5 px-2">
                          <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                            {TIPO_MENCION_LABELS[m.tipoMencion] || m.tipoMencion}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-1.5 px-2 hidden md:table-cell">
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${TRATAMIENTO_STYLES[m.tratamientoPeriodistico] || TRATAMIENTO_STYLES.sin_tratamiento}`}>
                            {TRATAMIENTO_LABELS[m.tratamientoPeriodistico] || 'S/C'}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="py-6 text-center text-muted-foreground text-xs">
                Sin menciones registradas
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Salud de medios — consolidado con PipelineMonitor */}
      <motion.div
        variants={fadeInUp}
        initial="hidden"
        animate="visible"
        custom={7}
      >
        <Card className="hover:shadow-md transition-all cursor-pointer" onClick={() => setActiveView('captura')}>
          <CardHeader className="pb-2 pt-3 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Monitor className="h-4 w-4 text-muted-foreground" />
                Salud de medios
              </CardTitle>
              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                Salud general <ChevronRight className="h-3 w-3" />
              </span>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            {mediosHealth ? (
              <div className="space-y-3">
                {/* Summary bar */}
                <div className="flex items-center gap-3">
                  <MiniGauge value={saludPercent} label="Salud" size={44} />
                  <div className="flex-1 grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{mediosHealth.resumen.sanos}</p>
                      <p className="text-[9px] text-muted-foreground">Sanos</p>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-amber-600 dark:text-amber-400">{mediosHealth.resumen.degradados}</p>
                      <p className="text-[9px] text-muted-foreground">Degradados</p>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-red-600 dark:text-red-400">{mediosHealth.resumen.muertos}</p>
                      <p className="text-[9px] text-muted-foreground">Caidos</p>
                    </div>
                  </div>
                </div>

                {/* Per-level breakdown */}
                <div className="grid grid-cols-3 gap-2">
                  {mediosHealth.porNivel.map((nivel) => (
                    <div key={nivel.nivel} className="p-2 rounded-lg border border-border/50 bg-muted/30 text-center">
                      <p className="text-[10px] font-medium text-foreground">{nivel.label}</p>
                      <p className="text-xs font-bold text-foreground">{nivel.sanos}/{nivel.total}</p>
                      {nivel.problematicos > 0 && (
                        <p className="text-[9px] text-amber-500">{nivel.problematicos} prob.</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="py-6 text-center text-muted-foreground text-xs">
                <div className="animate-pulse">Cargando estado de fuentes...</div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
