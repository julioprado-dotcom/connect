'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from '@/components/ui/table';
import {
  Newspaper, Radio, Bell, UserCircle, Package, TrendingUp,
  ChevronRight, ArrowRight, Cpu, Database, Clock, Activity,
  CheckCircle2, XCircle, AlertTriangle, BarChart3, Zap, FileBarChart,
  Monitor, Eye, ArrowUpRight, ArrowDownRight, Minus,
} from 'lucide-react';
import { useDashboardStore } from '@/stores/useDashboardStore';
import { RadialGauge } from '@/components/dashboard/gauges/RadialGauge';
import { MiniGauge } from '@/components/dashboard/gauges/MiniGauge';
import { SENTIMIENTO_STYLES, TIPO_MENCION_LABELS } from '@/constants/ui';
import { ALL_PRODUCTS } from '@/constants/nav';
import type { SystemMetrics } from '@/types/dashboard';

// ─── Animation variants ────────────────────────────────────

const fadeInUp = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.35, ease: 'easeOut' as const },
  }),
};

const stagger = {
  visible: { transition: { staggerChildren: 0.05 } },
};

// ─── Trend indicator helper ────────────────────────────────

function TrendIndicator({ value, label }: { value: number; label: string }) {
  const isUp = value > 0;
  const isNeutral = value === 0;
  return (
    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
      {isNeutral ? (
        <Minus className="h-3 w-3 text-stone-400" />
      ) : isUp ? (
        <ArrowUpRight className="h-3 w-3 text-emerald-500" />
      ) : (
        <ArrowDownRight className="h-3 w-3 text-red-500" />
      )}
      <span className={isNeutral ? '' : isUp ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
        {Math.abs(value)}%
      </span>
      <span>{label}</span>
    </div>
  );
}

// ─── Mini KPI Box ──────────────────────────────────────────

function MiniKPI({ value, label, color }: { value: number | string; label: string; color?: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 min-w-[56px]">
      <span className={`text-lg font-bold ${color || 'text-foreground'}`}>{value}</span>
      <span className="text-[9px] text-muted-foreground leading-tight text-center">{label}</span>
    </div>
  );
}

// ─── Category Card ─────────────────────────────────────────

function CategoryCard({
  index,
  icon,
  title,
  viewId,
  kpis,
  featured,
  variation,
  borderColor,
  onClick,
}: {
  index: number;
  icon: React.ReactNode;
  title: string;
  viewId: string;
  kpis: { value: number | string; label: string; color?: string }[];
  featured: React.ReactNode;
  variation: React.ReactNode;
  borderColor?: string;
  onClick: () => void;
}) {
  return (
    <motion.div
      custom={index}
      variants={fadeInUp}
      initial="hidden"
      animate="visible"
    >
      <Card
        className={`cursor-pointer hover:shadow-md hover:ring-1 hover:ring-primary/30 transition-all ${borderColor || ''}`}
        onClick={onClick}
      >
        {/* Header */}
        <CardHeader className="pb-2 pt-3 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="text-muted-foreground">{icon}</div>
              <CardTitle className="text-sm font-semibold">{title}</CardTitle>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary transition-colors" />
          </div>
        </CardHeader>

        <CardContent className="px-4 pb-3 space-y-3">
          {/* KPIs row */}
          <div className="flex items-center justify-around py-2 rounded-lg bg-muted/40 border border-border/50">
            {kpis.map((kpi, i) => (
              <MiniKPI key={i} value={kpi.value} label={kpi.label} color={kpi.color} />
            ))}
          </div>

          {/* Featured */}
          <div className="text-xs">{featured}</div>

          {/* Variation */}
          <div className="border-t border-border/50 pt-2">{variation}</div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════

export function DashboardCommandCenter() {
  const data = useDashboardStore((s) => s.data);
  const mediosHealth = useDashboardStore((s) => s.mediosHealth);
  const setActiveView = useDashboardStore((s) => s.setActiveView);

  // System metrics state
  const [sysMetrics, setSysMetrics] = useState<SystemMetrics | null>(null);

  // Fetch system metrics
  const fetchSystemMetrics = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/system');
      if (res.ok) {
        const json = await res.json();
        setSysMetrics(json);
      }
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchSystemMetrics();
    const interval = setInterval(fetchSystemMetrics, 10000);
    return () => clearInterval(interval);
  }, [fetchSystemMetrics]);

  // ─── Computed values ────────────────────────────────────

  const totalCapturasHoy = useMemo(() => {
    if (!data?.fuentesPorNivel) return 0;
    return data.fuentesPorNivel.reduce((sum, f) => sum + f.capturasHoy, 0);
  }, [data?.fuentesPorNivel]);

  const uptimeHours = useMemo(
    () => (sysMetrics?.uptime || 0) / 3600,
    [sysMetrics?.uptime]
  );

  const saludPercent = useMemo(
    () => mediosHealth?.resumen.porcentajeSalud || 0,
    [mediosHealth?.resumen.porcentajeSalud]
  );

  const productsOperativo = useMemo(
    () => ALL_PRODUCTS.filter((p) => p.estado === 'operativo'),
    []
  );

  const productsByCategory = useMemo(() => {
    const cats: Record<string, number> = {};
    ALL_PRODUCTS.forEach((p) => {
      const cat = (p as unknown as Record<string, unknown>).categoria as string || 'otro';
      cats[cat] = (cats[cat] || 0) + 1;
    });
    return cats;
  }, []);

  const topPartido = useMemo(() => {
    if (!data?.mencionesPorPartido?.length) return null;
    return data.mencionesPorPartido[0];
  }, [data?.mencionesPorPartido]);

  // Menciones trend: hoy vs promedio semanal
  const mencionesTrend = useMemo(() => {
    const hoy = data?.mencionesHoy || 0;
    const semana = data?.mencionesSemana || 0;
    const promedio = semana / 7;
    if (promedio === 0) return hoy > 0 ? 100 : 0;
    return Math.round(((hoy - promedio) / promedio) * 100);
  }, [data?.mencionesHoy, data?.mencionesSemana]);

  // Medios con problema
  const mediosConProblema = useMemo(
    () => mediosHealth?.medios.filter((m) => m.salud !== 'sano') || [],
    [mediosHealth]
  );

  // ─── Health border color for Monitoreo card ─────────────
  const monitoreoBorder = useMemo(() => {
    if (!mediosHealth) return '';
    if (mediosHealth.resumen.muertos > 0) return 'border-l-4 border-l-red-500';
    if (mediosHealth.resumen.degradados > 0) return 'border-l-4 border-l-amber-500';
    return 'border-l-4 border-l-emerald-500';
  }, [mediosHealth]);

  // ─── Gauge values ───────────────────────────────────────
  const memoryPercent = sysMetrics?.memoryPercent || 0;
  const heapUsed = sysMetrics?.memoryUsage?.heapUsed || 0;
  const dbSizeMB = sysMetrics?.dbSize || 0;
  const dbGaugeValue = Math.min(100, (dbSizeMB / 50) * 100);
  const uptimeGaugeValue = Math.min(100, (uptimeHours / 72) * 100);
  const jobsValue = Math.min(100, ((data?.entregasHoy || 0) / 50) * 100);

  // ═══════════════════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════════════════

  if (!data) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <div className="animate-pulse flex flex-col items-center gap-3">
          <BarChart3 className="h-8 w-8 opacity-40" />
          <span className="text-sm">Cargando Centro de Comando...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ═══ Section 1: System Gauges ═══ */}
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4"
      >
        <motion.div custom={0} variants={fadeInUp}>
          <RadialGauge
            value={memoryPercent}
            label="Memoria"
            valueLabel={`${heapUsed} MB`}
            icon={<Cpu className="h-4 w-4" />}
            onClick={() => setActiveView('configuracion')}
          />
        </motion.div>
        <motion.div custom={1} variants={fadeInUp}>
          <RadialGauge
            value={dbGaugeValue}
            label="Base de Datos"
            valueLabel={`${dbSizeMB} MB`}
            icon={<Database className="h-4 w-4" />}
            onClick={() => setActiveView('configuracion')}
          />
        </motion.div>
        <motion.div custom={2} variants={fadeInUp}>
          <RadialGauge
            value={uptimeGaugeValue}
            label="Uptime"
            valueLabel={sysMetrics?.uptimeFormatted || '0m'}
            icon={<Clock className="h-4 w-4" />}
            onClick={() => setActiveView('jobs')}
          />
        </motion.div>
        <motion.div custom={3} variants={fadeInUp}>
          <RadialGauge
            value={jobsValue}
            label="Entregas Hoy"
            valueLabel={`${data.entregasHoy} procesadas`}
            icon={<Activity className="h-4 w-4" />}
            onClick={() => setActiveView('jobs')}
          />
        </motion.div>
      </motion.div>

      {/* ═══ Section 2: Category Cards ═══ */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">

        {/* 1. Analisis */}
        <CategoryCard
          index={0}
          icon={<Newspaper className="h-5 w-5" />}
          title="Analisis"
          viewId="menciones"
          onClick={() => setActiveView('menciones')}
          kpis={[
            { value: data.totalPersonas, label: 'Legisladores' },
            { value: data.mencionesHoy, label: 'Hoy', color: 'text-sky-600 dark:text-sky-400' },
            { value: data.mencionesSemana, label: 'Semana' },
          ]}
          featured={
            data.topActores?.[0] ? (
              <div className="flex items-start gap-2">
                <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="font-medium text-foreground truncate">{data.topActores[0].nombre}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {data.topActores[0].partidoSigla} · {data.topActores[0].mencionesCount} menciones
                  </p>
                </div>
              </div>
            ) : (
              <span className="text-muted-foreground text-[10px]">Sin datos de actores</span>
            )
          }
          variation={
            <TrendIndicator value={mencionesTrend} label="vs. promedio diario" />
          }
        />

        {/* 2. Monitoreo */}
        <CategoryCard
          index={1}
          icon={<Radio className="h-5 w-5" />}
          title="Monitoreo"
          viewId="captura"
          onClick={() => setActiveView('captura')}
          kpis={[
            { value: data.totalMedios, label: 'Fuentes' },
            { value: `${Math.round(saludPercent)}%`, label: 'Salud', color: saludPercent >= 80 ? 'text-emerald-600 dark:text-emerald-400' : saludPercent >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400' },
            { value: totalCapturasHoy, label: 'Capturas' },
          ]}
          featured={
            mediosConProblema.length > 0 ? (
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="font-medium text-amber-700 dark:text-amber-400 truncate">
                    {mediosConProblema[0]?.nombre}
                    {mediosConProblema.length > 1 && ` +${mediosConProblema.length - 1}`}
                  </p>
                  <p className="text-[10px] text-muted-foreground">con problemas de captura</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                <span className="text-emerald-700 dark:text-emerald-400 text-[10px] font-medium">Todos sanos</span>
              </div>
            )
          }
          variation={
            <div className="flex items-center gap-2">
              <MiniGauge value={saludPercent} label="Salud" size={36} />
              <span className="text-[10px] text-muted-foreground">{mediosHealth?.resumen.sanos || 0} sanos · {mediosHealth?.resumen.muertos || 0} caidos</span>
            </div>
          }
          borderColor={monitoreoBorder}
        />

        {/* 3. Alertas */}
        <CategoryCard
          index={2}
          icon={<Bell className="h-5 w-5" />}
          title="Alertas"
          viewId="alertas"
          onClick={() => setActiveView('alertas')}
          kpis={[
            { value: data.alertas.negativasHoy, label: 'Rojas', color: 'text-red-600 dark:text-red-400' },
            { value: data.alertas.positivasHoy, label: 'Verdes', color: 'text-emerald-600 dark:text-emerald-400' },
            { value: data.alertas.neutrasHoy, label: 'Neutras' },
          ]}
          featured={
            data.alertas.ultimaAlerta ? (
              <div className="flex items-start gap-2">
                <Zap className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-foreground truncate">{data.alertas.ultimaAlerta.resumen}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(data.alertas.ultimaAlerta.fechaCreacion).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ) : (
              <span className="text-muted-foreground text-[10px]">Sin alertas registradas</span>
            )
          }
          variation={
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              {data.alertas.negativasHoy + data.alertas.positivasHoy + data.alertas.neutrasHoy > 0 ? (
                <>
                  <span className="font-medium text-foreground">{data.alertas.negativasHoy + data.alertas.positivasHoy + data.alertas.neutrasHoy}</span>
                  <span>alertas procesadas hoy</span>
                </>
              ) : (
                <span>Sin actividad de alertas</span>
              )}
            </div>
          }
        />

        {/* 4. Comercial */}
        <CategoryCard
          index={3}
          icon={<UserCircle className="h-5 w-5" />}
          title="Comercial"
          viewId="clientes"
          onClick={() => setActiveView('clientes')}
          kpis={[
            { value: data.clientesActivos, label: 'Clientes' },
            { value: data.contratosVigentes, label: 'Contratos' },
            { value: data.entregasHoy, label: 'Entregas', color: 'text-emerald-600 dark:text-emerald-400' },
          ]}
          featured={
            data.entregasHoy > 0 ? (
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                <span className="text-foreground">{data.entregasHoy} entregas procesadas hoy</span>
              </div>
            ) : (
              <span className="text-muted-foreground text-[10px]">Sin entregas procesadas hoy</span>
            )
          }
          variation={
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <span>{data.totalReportes} reportes generados</span>
            </div>
          }
        />

        {/* 5. Productos */}
        <CategoryCard
          index={4}
          icon={<Package className="h-5 w-5" />}
          title="Productos"
          viewId="productos"
          onClick={() => setActiveView('productos')}
          kpis={[
            { value: productsOperativo.length, label: 'Operativos', color: 'text-emerald-600 dark:text-emerald-400' },
            { value: ALL_PRODUCTS.length, label: 'Total' },
            { value: data.totalReportes, label: 'Reportes' },
          ]}
          featured={
            <div className="space-y-1">
              {ALL_PRODUCTS.slice(0, 3).map((prod) => {
                const ProdIcon = prod.icon;
                return (
                  <div key={prod.tipo} className="flex items-center gap-1.5">
                    <ProdIcon className="h-3 w-3 shrink-0" style={{ color: prod.color }} />
                    <span className="text-foreground text-[11px]">{prod.nombre}</span>
                    <Badge variant="secondary" className="text-[8px] px-1 py-0 ml-auto">
                      {prod.estado === 'operativo' ? 'Op.' : 'Def.'}
                    </Badge>
                  </div>
                );
              })}
            </div>
          }
          variation={
            <div className="flex items-center gap-2 flex-wrap">
              {Object.entries(productsByCategory).map(([cat, count]) => (
                <span key={cat} className="text-[10px] text-muted-foreground">
                  {cat}: <span className="font-medium text-foreground">{count}</span>
                </span>
              ))}
            </div>
          }
        />

        {/* 6. Indicadores */}
        <CategoryCard
          index={5}
          icon={<TrendingUp className="h-5 w-5" />}
          title="Indicadores"
          viewId="indicadores"
          onClick={() => setActiveView('indicadores')}
          kpis={[
            { value: data.totalEjes, label: 'Ejes' },
            { value: data.totalComentarios, label: 'Comentarios' },
            { value: data.enlacesRotos, label: 'Rotos', color: data.enlacesRotos > 0 ? 'text-red-600 dark:text-red-400' : undefined },
          ]}
          featured={
            topPartido ? (
              <div className="flex items-start gap-2">
                <BarChart3 className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{topPartido.partido}</p>
                  <p className="text-[10px] text-muted-foreground">{topPartido.count} menciones · partido lider</p>
                </div>
              </div>
            ) : (
              <span className="text-muted-foreground text-[10px]">Sin datos de partidos</span>
            )
          }
          variation={
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <span>Diputados: <span className="font-medium text-foreground">{data.distribucionCamara.diputados}</span></span>
              <span className="text-border">|</span>
              <span>Senadores: <span className="font-medium text-foreground">{data.distribucionCamara.senadores}</span></span>
            </div>
          }
        />
      </div>

      {/* ═══ Section 3: Activity Feed ═══ */}
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
                        <TableHead className="text-[10px] h-7 hidden md:table-cell">Sent.</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.ultimasMenciones.slice(0, 5).map((m) => (
                        <TableRow key={m.id} className="hover:bg-muted/50">
                          <TableCell className="py-1.5 px-2">
                            <div className="min-w-0">
                              <p className="text-[11px] font-medium text-foreground truncate max-w-[100px]">{m.persona?.nombre || '—'}</p>
                              <p className="text-[9px] text-muted-foreground">{m.persona?.partidoSigla}</p>
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
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${SENTIMIENTO_STYLES[m.sentimiento] || SENTIMIENTO_STYLES.no_clasificado}`}>
                              {m.sentimiento?.replace('_', ' ') || '—'}
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

        {/* Estado de fuentes */}
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
                  Estado de fuentes
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

      {/* ═══ Section 4: Quick Actions ═══ */}
      <motion.div
        variants={fadeInUp}
        initial="hidden"
        animate="visible"
        custom={8}
      >
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">Acciones rapidas</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                className="text-xs gap-1.5"
                onClick={() => setActiveView('menciones')}
              >
                <Eye className="h-3.5 w-3.5" />
                Ver Menciones
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs gap-1.5"
                onClick={() => setActiveView('alertas')}
              >
                <Bell className="h-3.5 w-3.5" />
                Ver Alertas
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs gap-1.5"
                onClick={() => setActiveView('captura')}
              >
                <Database className="h-3.5 w-3.5" />
                Captura Manual
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs gap-1.5"
                onClick={() => setActiveView('reportes')}
              >
                <FileBarChart className="h-3.5 w-3.5" />
                Generar Reporte
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs gap-1.5"
                onClick={() => setActiveView('jobs')}
              >
                <Activity className="h-3.5 w-3.5" />
                Ver Jobs
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* System info footer */}
      {sysMetrics && (
        <div className="flex items-center justify-between text-[10px] text-muted-foreground/60 px-1 pb-2">
          <span>Node {sysMetrics.nodeVersion} · {sysMetrics.platform}</span>
          <span>DB: {sysMetrics.dbSize} MB · RSS: {sysMetrics.memoryUsage.rss} MB</span>
          <span>Ultima actualizacion: {new Date(sysMetrics.timestamp).toLocaleTimeString('es-BO')}</span>
        </div>
      )}
    </div>
  );
}
