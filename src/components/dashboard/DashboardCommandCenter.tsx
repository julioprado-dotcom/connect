'use client';

import React, { useState, useCallback, Component, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import {
  BarChart3, TrendingUp, ShieldAlert, Loader2,
  Activity, Send, Database, Globe, Zap, Radio,
  Newspaper, UsersRound, Tag, Bell, Mail, FileBarChart,
  Package, Rocket, UserCircle, FileCheck, Users,
  Shield, Settings, LayoutGrid,
} from 'lucide-react';
import { useDashboardStore } from '@/stores/useDashboardStore';
import { TopVariations } from '@/components/dashboard/TopVariations';
import { CollapsibleWidget } from '@/components/dashboard/CollapsibleWidget';
import { fetchWithTimeout } from '@/lib/fetch-utils';
import { usePolling } from './hooks/usePolling';
import type { SystemMetrics } from '@/types/dashboard';
import type { AiHealthData } from './sections/SystemStatusOrbs';
import type { EntregasHoyData } from './sections/EntregasHoy';
import type { WidgetStatus } from '@/components/dashboard/CollapsibleWidget';

// ─── Types ────────────────────────────────────────────────────

// ─── ErrorBoundary para capturar ChunkLoadError sin romper el dashboard ─

interface ErrorBoundaryProps { children: ReactNode; fallback?: ReactNode }
interface ErrorBoundaryState { hasError: boolean; error?: Error }

class ChunkErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    if (error?.message?.includes('ChunkLoadError') || error?.message?.includes('Failed to load chunk')) {
      console.warn('[Dashboard] ChunkLoadError capturado — la sección se mostrará como fallback');
    }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <Card className="border border-dashed border-muted-foreground/30">
          <CardContent className="p-4 text-center text-muted-foreground text-xs">
            <p>Sección temporalmente no disponible</p>
            <button
              className="mt-1 underline text-xs opacity-70 hover:opacity-100"
              onClick={() => this.setState({ hasError: false, error: undefined })}
            >
              Reintentar
            </button>
          </CardContent>
        </Card>
      );
    }
    return this.props.children;
  }
}

interface AlertasComercialesData {
  topVariaciones: {
    personas: { id: string; nombre: string; slug?: string; color?: string; icono?: string; partidoSigla?: string; camara?: string; mencionesActuales: number; mencionesAnteriores: number; variacion: number }[];
    ejes: { id: string; nombre: string; slug?: string; color?: string; icono?: string; partidoSigla?: string; camara?: string; mencionesActuales: number; mencionesAnteriores: number; variacion: number }[];
  };
  contratosPorVencer: { id: string; clienteId: string; clienteNombre: string; tipoProducto: string; frecuencia: string; fechaFin: string; diasRestantes: number; montoMensual: number; moneda: string }[];
  solicitudesPendientes: { contratoId: string; tipo: string; descripcion: string; clienteNombre: string }[];
  entregasPendientes: number;
}

// ─── Lazy-loaded sections (code-split) ───────────────────────

const SystemStatusOrbs = dynamic(
  () => import('./sections/SystemStatusOrbs').then(m => ({ default: m.SystemStatusOrbs })),
  { ssr: false, loading: () => <Card className="border"><CardContent className="p-4 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></CardContent></Card> }
);
const EntregasHoy = dynamic(
  () => import('./sections/EntregasHoy').then(m => ({ default: m.EntregasHoy })),
  { ssr: false, loading: () => <Card className="border"><CardContent className="p-4 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></CardContent></Card> }
);
const CategoryCardsGrid = dynamic(
  () => import('./sections/CategoryCardsGrid').then(m => ({ default: m.CategoryCardsGrid })),
  { ssr: false, loading: () => <Card className="border"><CardContent className="p-4 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></CardContent></Card> }
);
const ActivityFeed = dynamic(
  () => import('./sections/ActivityFeed').then(m => ({ default: m.ActivityFeed })),
  { ssr: false, loading: () => <Card className="border"><CardContent className="p-4 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></CardContent></Card> }
);
const QuickActions = dynamic(
  () => import('./sections/QuickActions').then(m => ({ default: m.QuickActions })),
  { ssr: false, loading: () => <Card className="border"><CardContent className="p-4 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></CardContent></Card> }
);
const CachePressurePanel = dynamic(
  () => import('./sections/CachePressurePanel').then(m => ({ default: m.CachePressurePanel })),
  { ssr: false, loading: () => <Card className="border"><CardContent className="p-4 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></CardContent></Card> }
);

// ─── Already-dynamic heavy sub-components ─────────────────────

const PipelineMonitor = dynamic(
  () => import(/* webpackChunkName: "pipeline-monitor" */'@/components/dashboard/PipelineMonitor').then(m => ({ default: m.PipelineMonitor })),
  { ssr: false, loading: () => <SectionSkeleton /> }
);
const ScrapingPhaseControl = dynamic(
  () => import(/* webpackChunkName: "scraping-phases" */'@/components/dashboard/ScrapingPhaseControl').then(m => ({ default: m.ScrapingPhaseControl })),
  { ssr: false, loading: () => <SectionSkeleton /> }
);
const AlarmasComerciales = dynamic(
  () => import(/* webpackChunkName: "alarmas-comerciales" */'@/components/dashboard/AlarmasComerciales').then(m => ({ default: m.AlarmasComerciales })),
  { ssr: false, loading: () => <SectionSkeleton /> }
);

// ─── Axis 4C widgets (code-split) ────────────────────────────

const AlertasWidget = dynamic(
  () => import('./widgets/AlertasWidget').then(m => ({ default: m.AlertasWidget })),
  { ssr: false, loading: () => <SectionSkeleton /> }
);
const IndicadoresWidget = dynamic(
  () => import('./widgets/IndicadoresWidget').then(m => ({ default: m.IndicadoresWidget })),
  { ssr: false, loading: () => <SectionSkeleton /> }
);
const FuentesWidget = dynamic(
  () => import('./widgets/FuentesWidget').then(m => ({ default: m.FuentesWidget })),
  { ssr: false, loading: () => <SectionSkeleton /> }
);
const MediosWidget = dynamic(
  () => import('./widgets/MediosWidget').then(m => ({ default: m.MediosWidget })),
  { ssr: false, loading: () => <SectionSkeleton /> }
);

// ─── Axis 4D widgets (code-split) ────────────────────────────

const PersonasRadarWidget = dynamic(
  () => import('./widgets/PersonasRadarWidget').then(m => ({ default: m.PersonasRadarWidget })),
  { ssr: false, loading: () => <SectionSkeleton /> }
);
const MencionesRecientesWidget = dynamic(
  () => import('./widgets/MencionesRecientesWidget').then(m => ({ default: m.MencionesRecientesWidget })),
  { ssr: false, loading: () => <SectionSkeleton /> }
);
const BoletinesWidget = dynamic(
  () => import('./widgets/BoletinesWidget').then(m => ({ default: m.BoletinesWidget })),
  { ssr: false, loading: () => <SectionSkeleton /> }
);
const ReportesWidget = dynamic(
  () => import('./widgets/ReportesWidget').then(m => ({ default: m.ReportesWidget })),
  { ssr: false, loading: () => <SectionSkeleton /> }
);
const ClientesWidget = dynamic(
  () => import('./widgets/ClientesWidget').then(m => ({ default: m.ClientesWidget })),
  { ssr: false, loading: () => <SectionSkeleton /> }
);
const ContratosWidget = dynamic(
  () => import('./widgets/ContratosWidget').then(m => ({ default: m.ContratosWidget })),
  { ssr: false, loading: () => <SectionSkeleton /> }
);
const SuscriptoresWidget = dynamic(
  () => import('./widgets/SuscriptoresWidget').then(m => ({ default: m.SuscriptoresWidget })),
  { ssr: false, loading: () => <SectionSkeleton /> }
);
const EjesTematicosWidget = dynamic(
  () => import('./widgets/EjesTematicosWidget').then(m => ({ default: m.EjesTematicosWidget })),
  { ssr: false, loading: () => <SectionSkeleton /> }
);

// ─── Axis 4E widgets (code-split) ────────────────────────────

const GeneradoresWidget = dynamic(
  () => import('./widgets/GeneradoresWidget').then(m => ({ default: m.GeneradoresWidget })),
  { ssr: false, loading: () => <SectionSkeleton /> }
);
const AuditoriaWidget = dynamic(
  () => import('./widgets/AuditoriaWidget').then(m => ({ default: m.AuditoriaWidget })),
  { ssr: false, loading: () => <SectionSkeleton /> }
);
const CapturasWidget = dynamic(
  () => import('./widgets/CapturasWidget').then(m => ({ default: m.CapturasWidget })),
  { ssr: false, loading: () => <SectionSkeleton /> }
);
const JobsWidget = dynamic(
  () => import('./widgets/JobsWidget').then(m => ({ default: m.JobsWidget })),
  { ssr: false, loading: () => <SectionSkeleton /> }
);
const ConfigWidget = dynamic(
  () => import('./widgets/ConfigWidget').then(m => ({ default: m.ConfigWidget })),
  { ssr: false, loading: () => <SectionSkeleton /> }
);
const EstrategiaWidget = dynamic(
  () => import('./widgets/EstrategiaWidget').then(m => ({ default: m.EstrategiaWidget })),
  { ssr: false, loading: () => <SectionSkeleton /> }
);

// ─── Animation variants ──────────────────────────────────────

function SectionSkeleton() {
  return (
    <Card className="border">
      <CardContent className="p-4 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </CardContent>
    </Card>
  );
}

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

// ─── Group Header ────────────────────────────────────────────

function GroupHeader({ label, icon: Icon, color }: { label: string; icon: React.ElementType; color: string }) {
  return (
    <div className="flex items-center gap-2 pt-2 pb-1">
      <div
        className="flex items-center justify-center h-5 w-5 rounded-md"
        style={{ backgroundColor: `${color}20` }}
      >
        <Icon className="h-3.5 w-3.5" style={{ color }} />
      </div>
      <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: `${color}CC` }}>
        {label}
      </span>
      <div className="flex-1 border-t border-border/40" />
    </div>
  );
}

// ─── Derived status helpers ──────────────────────────────────

function systemStatus(sysMetrics: SystemMetrics | null, aiHealth: AiHealthData | null): WidgetStatus {
  if (!sysMetrics) return 'loading';
  const criticals = sysMetrics.diagnoses?.filter(d => d.severity === 'critical') || [];
  if (criticals.length > 0) return 'error';
  const warnings = sysMetrics.diagnoses?.filter(d => d.severity === 'warning') || [];
  if (warnings.length > 0) return 'warn';
  if (aiHealth?.statusLevel === 'critical') return 'error';
  return 'ok';
}

function entregasStatus(entregas: EntregasHoyData | null): WidgetStatus {
  if (!entregas) return 'loading';
  if (entregas.fallidas > 0) return 'error';
  if (entregas.pendientes > 0) return 'warn';
  return 'ok';
}

function pipelineStatus(data: unknown): WidgetStatus {
  if (!data) return 'loading';
  const d = data as { pasado?: { fallidos?: Array<unknown> }; presente?: { worker?: { running?: boolean }; enEjecucion?: Array<unknown> } };
  if ((d.pasado?.fallidos?.length ?? 0) > 5) return 'error';
  if ((d.pasado?.fallidos?.length ?? 0) > 0) return 'warn';
  if (d.presente?.worker?.running) return 'ok';
  return 'idle';
}

function scrapingStatus(loading: boolean): WidgetStatus {
  return loading ? 'loading' : 'idle';
}

function alertasStatus(alertas: AlertasComercialesData | null): WidgetStatus {
  if (!alertas) return 'loading';
  if ((alertas.contratosPorVencer?.length ?? 0) > 0) {
    const minDays = Math.min(...alertas.contratosPorVencer.map(c => c.diasRestantes));
    if (minDays <= 7) return 'error';
    return 'warn';
  }
  return 'ok';
}

// ═══════════════════════════════════════════════════════════
// Main Orchestrator
// ═══════════════════════════════════════════════════════════

export function DashboardCommandCenter() {
  const data = useDashboardStore((s) => s.data);
  const mediosHealth = useDashboardStore((s) => s.mediosHealth);
  const setActiveView = useDashboardStore((s) => s.setActiveView);

  // State
  const [sysMetrics, setSysMetrics] = useState<SystemMetrics | null>(null);
  const [alertasCom, setAlertasCom] = useState<AlertasComercialesData | null>(null);
  const [entregasHoy, setEntregasHoy] = useState<EntregasHoyData | null>(null);
  const [aiHealth, setAiHealth] = useState<AiHealthData | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [pipelineData, setPipelineData] = useState<any>(null);
  const [mcResumen, setMcResumen] = useState<{
    inicializado: boolean;
    version: number | null;
    vacios: string[];
  } | null>(null);

  // Fetch functions
  const fetchSystemMetrics = useCallback(async () => {
    try {
      const res = await fetchWithTimeout('/api/dashboard/system', { timeoutMs: 12_000 });
      if (res.ok) setSysMetrics(await res.json());
    } catch { /* silent */ }
  }, []);

  const fetchAlertasComerciales = useCallback(async () => {
    try {
      const res = await fetchWithTimeout('/api/dashboard/alertas-comerciales', { timeoutMs: 12_000 });
      if (res.ok) setAlertasCom(await res.json());
    } catch { /* silent */ }
  }, []);

  const fetchEntregasHoy = useCallback(async () => {
    try {
      const res = await fetchWithTimeout('/api/dashboard/entregas-hoy', { timeoutMs: 12_000 });
      if (res.ok) setEntregasHoy(await res.json());
    } catch { /* silent */ }
  }, []);

  const fetchAiHealth = useCallback(async () => {
    try {
      const res = await fetchWithTimeout('/api/dashboard/ai-health', { timeoutMs: 12_000 });
      if (res.ok) setAiHealth(await res.json());
    } catch { /* silent */ }
  }, []);

  const fetchPipelineStats = useCallback(async () => {
    try {
      const res = await fetchWithTimeout('/api/dashboard/pipeline', { timeoutMs: 12_000 });
      if (res.ok) setPipelineData(await res.json());
    } catch { /* silent */ }
  }, []);

  const fetchMC = useCallback(async () => {
    try {
      const res = await fetchWithTimeout('/api/marco-conceptual/resumen', { timeoutMs: 12_000 });
      if (res.ok) setMcResumen(await res.json());
    } catch { /* silent */ }
  }, []);

  // Polling
  usePolling(fetchSystemMetrics, 30_000);
  usePolling(fetchAlertasComerciales, 30_000);
  usePolling(fetchEntregasHoy, 30_000);
  usePolling(fetchAiHealth, 30_000);
  usePolling(fetchPipelineStats, 15_000);
  usePolling(fetchMC, 60_000);

  // Loading skeleton
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

  // ─── Derived badge values ────────────────────────────────
  const uptimeStr = sysMetrics?.uptimeFormatted || '--';
  const healthScore = sysMetrics?.healthScore ?? null;
  const workerRunning = (pipelineData as { presente?: { worker?: { running?: boolean } } })?.presente?.worker?.running ?? false;
  const fallidosCount = (pipelineData as { pasado?: { fallidos?: unknown[] } })?.pasado?.fallidos?.length ?? 0;
  const fuentesActivas = (pipelineData as { presente?: { fuentes?: unknown[] } })?.presente?.fuentes?.length ?? 0;

  return (
    <div className="space-y-6">

      {/* ═══════════════════════════════════════════════════
          SISTEMA — Diagnosticos + infraestructura
          ═══════════════════════════════════════════════════ */}
      <GroupHeader label="Sistema" icon={Activity} color="#0EA5E9" />

      <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-3">

        {/* Widget: Diagnostico del Sistema */}
        <motion.div custom={0} variants={fadeInUp}>
          <CollapsibleWidget
            id="widget-system-status"
            title="Diagnostico del Sistema"
            icon={Activity}
            status={systemStatus(sysMetrics, aiHealth)}
            badge={healthScore !== null ? `${healthScore}%` : undefined}
            badgeLabel="health"
            targetView="jobs"
            onNavigate={setActiveView}
            mode="section"
          >
            <SystemStatusOrbs
              sysMetrics={sysMetrics}
              entregasHoy={entregasHoy}
              aiHealth={aiHealth}
              mcResumen={mcResumen}
              setActiveView={setActiveView}
            />
          </CollapsibleWidget>
        </motion.div>

        {/* Widget: Entregas Hoy → Boletines */}
        <motion.div custom={1} variants={fadeInUp}>
          <CollapsibleWidget
            id="widget-entregas"
            title="Entregas Hoy"
            icon={Send}
            status={entregasStatus(entregasHoy)}
            badge={entregasHoy ? `${entregasHoy.enviadas}/${entregasHoy.total}` : undefined}
            badgeLabel="enviadas"
            targetView="boletines"
            onNavigate={setActiveView}
            mode="section"
          >
            <EntregasHoy entregasHoy={entregasHoy} setActiveView={setActiveView} />
          </CollapsibleWidget>
        </motion.div>

        {/* Widget: Pipeline Monitor → Jobs */}
        <motion.div custom={2} variants={fadeInUp}>
          <CollapsibleWidget
            id="widget-pipeline"
            title="Monitor de Pipeline"
            icon={Zap}
            status={pipelineStatus(pipelineData)}
            badge={fuentesActivas}
            badgeLabel="fuentes"
            targetView="jobs"
            onNavigate={setActiveView}
            mode="section"
          >
            <ChunkErrorBoundary>
              <PipelineMonitor data={pipelineData} onRefresh={fetchPipelineStats} />
            </ChunkErrorBoundary>
          </CollapsibleWidget>
        </motion.div>

        {/* Widget: Scraping Phase Control */}
        <motion.div custom={3} variants={fadeInUp}>
          <CollapsibleWidget
            id="widget-scraping"
            title="Control de Scraping"
            icon={Globe}
            status={scrapingStatus(false)}
            targetView="captura"
            onNavigate={setActiveView}
            mode="section"
          >
            <ChunkErrorBoundary>
              <ScrapingPhaseControl />
            </ChunkErrorBoundary>
          </CollapsibleWidget>
        </motion.div>

        {/* Widget: Cache Pressure → Configuracion */}
        <motion.div custom={4} variants={fadeInUp}>
          <CollapsibleWidget
            id="widget-cache"
            title="Contenedor & Cache"
            icon={Database}
            status={sysMetrics ? (sysMetrics.healthScore < 50 ? 'warn' : 'ok') : 'loading'}
            badge={sysMetrics ? `${sysMetrics.uptimeFormatted || '--'}` : undefined}
            badgeLabel="uptime"
            targetView="configuracion"
            onNavigate={setActiveView}
            mode="section"
          >
            <ChunkErrorBoundary>
              <CachePressurePanel />
            </ChunkErrorBoundary>
          </CollapsibleWidget>
        </motion.div>
      </motion.div>

      {/* ═══════════════════════════════════════════════════
          ANALISIS — Menciones, variaciones, alertas
          ═══════════════════════════════════════════════════ */}
      <GroupHeader label="Analisis" icon={BarChart3} color="#3B82F6" />

      {/* Widget: KPIs por categoria */}
      <CollapsibleWidget
        id="widget-kpis"
        title="Resumen por Categoria"
        icon={LayoutGrid}
        status="ok"
        badge={data.totalEjes}
        badgeLabel="ejes"
        mode="section"
      >
        <CategoryCardsGrid data={data} mediosHealth={mediosHealth} setActiveView={setActiveView} />
      </CollapsibleWidget>

      {/* Widget: Activity Feed — Menciones + Medios */}
      <CollapsibleWidget
        id="widget-activity"
        title="Menciones & Medios"
        icon={Newspaper}
        status={data.mencionesSemana > 0 ? 'ok' : 'idle'}
        badge={data.mencionesSemana}
        badgeLabel="esta semana"
        targetView="menciones"
        onNavigate={setActiveView}
        mode="section"
      >
        <ActivityFeed data={data} mediosHealth={mediosHealth} setActiveView={setActiveView} />
      </CollapsibleWidget>

      {/* Widgets: Top Variaciones + Alarmas Comerciales (side by side) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div variants={fadeInUp} initial="hidden" animate="visible" custom={8}>
          <CollapsibleWidget
            id="widget-top-variaciones"
            title="Top Variaciones"
            icon={TrendingUp}
            status={alertasCom ? 'ok' : 'loading'}
            badge={alertasCom ? `${alertasCom.topVariaciones.personas.length} personas` : undefined}
            targetView="personas-seguimiento"
            onNavigate={setActiveView}
            mode="section"
          >
            {alertasCom ? (
              <TopVariations data={alertasCom.topVariaciones} onNavigate={setActiveView} />
            ) : (
              <Card className="hover:shadow-md transition-all">
                <CardContent className="py-10 text-center">
                  <div className="animate-pulse flex flex-col items-center gap-2 text-muted-foreground">
                    <TrendingUp className="h-5 w-5 opacity-40" />
                    <span className="text-xs">Calculando variaciones...</span>
                  </div>
                </CardContent>
              </Card>
            )}
          </CollapsibleWidget>
        </motion.div>

        <motion.div variants={fadeInUp} initial="hidden" animate="visible" custom={9}>
          <CollapsibleWidget
            id="widget-alarmas-comerciales"
            title="Alarmas Comerciales"
            icon={ShieldAlert}
            status={alertasStatus(alertasCom)}
            badge={alertasCom ? alertasCom.contratosPorVencer.length : undefined}
            badgeLabel="por vencer"
            targetView="contratos"
            onNavigate={setActiveView}
            mode="section"
          >
            {alertasCom ? (
              <ChunkErrorBoundary>
                <AlarmasComerciales
                  contratosPorVencer={alertasCom.contratosPorVencer}
                  solicitudesPendientes={alertasCom.solicitudesPendientes}
                  entregasPendientes={alertasCom.entregasPendientes}
                  onNavigate={setActiveView}
                />
              </ChunkErrorBoundary>
            ) : (
              <Card className="hover:shadow-md transition-all">
                <CardContent className="py-10 text-center">
                  <div className="animate-pulse flex flex-col items-center gap-2 text-muted-foreground">
                    <ShieldAlert className="h-5 w-5 opacity-40" />
                    <span className="text-xs">Cargando alarmas comerciales...</span>
                  </div>
                </CardContent>
              </Card>
            )}
          </CollapsibleWidget>
        </motion.div>
      </div>

      {/* ═══════════════════════════════════════════════════
          ONION200 — Indicadores
          ═══════════════════════════════════════════════════ */}
      <GroupHeader label="ONION200" icon={Package} color="#8B5CF6" />

      {/* Widget: Indicadores (NUEVO 4C) */}
      <ChunkErrorBoundary>
        <IndicadoresWidget onNavigate={setActiveView} />
      </ChunkErrorBoundary>

      {/* ═══════════════════════════════════════════════════
          ALERTAS TEMPRANAS — Menciones criticas/agresivas (NUEVO 4C)
          ═══════════════════════════════════════════════════ */}
      <GroupHeader label="Alertas Tempranas" icon={Bell} color="#EF4444" />

      {/* Widget: Alertas (NUEVO 4C) */}
      <ChunkErrorBoundary>
        <AlertasWidget onNavigate={setActiveView} />
      </ChunkErrorBoundary>

      {/* ═══════════════════════════════════════════════════
          CONFIGURACION — Fuentes + Medios (NUEVO 4C)
          ═══════════════════════════════════════════════════ */}
      <GroupHeader label="Configuracion" icon={Settings} color="#0EA5E9" />

      {/* Widgets: Fuentes + Medios side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChunkErrorBoundary>
          <FuentesWidget onNavigate={setActiveView} />
        </ChunkErrorBoundary>
        <ChunkErrorBoundary>
          <MediosWidget onNavigate={setActiveView} />
        </ChunkErrorBoundary>
      </div>

      {/* ═══════════════════════════════════════════════════
          PERSONAS — Radar de seguimiento (4D)
          ═══════════════════════════════════════════════════ */}
      <GroupHeader label="Personas" icon={UserCircle} color="#F59E0B" />

      <ChunkErrorBoundary>
        <PersonasRadarWidget onNavigate={setActiveView} />
      </ChunkErrorBoundary>

      {/* ═══════════════════════════════════════════════════
          MENCIONES — Capturas recientes (4D)
          ═══════════════════════════════════════════════════ */}
      <GroupHeader label="Menciones" icon={Newspaper} color="#3B82F6" />

      <ChunkErrorBoundary>
        <MencionesRecientesWidget onNavigate={setActiveView} />
      </ChunkErrorBoundary>

      {/* ═══════════════════════════════════════════════════
          EJES TEMATICOS — Marco conceptual (4D)
          ═══════════════════════════════════════════════════ */}
      <GroupHeader label="Ejes Tematicos" icon={Tag} color="#8B5CF6" />

      <ChunkErrorBoundary>
        <EjesTematicosWidget onNavigate={setActiveView} />
      </ChunkErrorBoundary>

      {/* ═══════════════════════════════════════════════════
          ENTREGAS — Boletines & Productos (4D)
          ═══════════════════════════════════════════════════ */}
      <GroupHeader label="Entregas" icon={FileBarChart} color="#06B6D4" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChunkErrorBoundary>
          <BoletinesWidget onNavigate={setActiveView} />
        </ChunkErrorBoundary>
        <ChunkErrorBoundary>
          <ReportesWidget onNavigate={setActiveView} />
        </ChunkErrorBoundary>
      </div>

      {/* ═══════════════════════════════════════════════════
          COMERCIAL — Clientes & Contratos (4D)
          ═══════════════════════════════════════════════════ */}
      <GroupHeader label="Comercial" icon={Package} color="#F59E0B" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChunkErrorBoundary>
          <ClientesWidget onNavigate={setActiveView} />
        </ChunkErrorBoundary>
        <ChunkErrorBoundary>
          <ContratosWidget onNavigate={setActiveView} />
        </ChunkErrorBoundary>
      </div>

      {/* ═══════════════════════════════════════════════════
          SUSCRIPTORES — Crecimiento de audiencia (4D)
          ═══════════════════════════════════════════════════ */}
      <GroupHeader label="Suscriptores" icon={Mail} color="#10B981" />

      <ChunkErrorBoundary>
        <SuscriptoresWidget onNavigate={setActiveView} />
      </ChunkErrorBoundary>

      {/* ═══════════════════════════════════════════════════
          CONFIGURACION — Generadores + Auditoria + Captura (4E)
          ═══════════════════════════════════════════════════ */}
      <GroupHeader label="Configuracion" icon={Settings} color="#0EA5E9" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChunkErrorBoundary>
          <GeneradoresWidget onNavigate={setActiveView} />
        </ChunkErrorBoundary>
        <ChunkErrorBoundary>
          <AuditoriaWidget onNavigate={setActiveView} />
        </ChunkErrorBoundary>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChunkErrorBoundary>
          <CapturasWidget onNavigate={setActiveView} />
        </ChunkErrorBoundary>
        <ChunkErrorBoundary>
          <JobsWidget onNavigate={setActiveView} />
        </ChunkErrorBoundary>
      </div>

      <ChunkErrorBoundary>
        <ConfigWidget onNavigate={setActiveView} />
      </ChunkErrorBoundary>

      {/* ═══════════════════════════════════════════════════
          ESTRATEGIA — Roadmap y hitos (4E)
          ═══════════════════════════════════════════════════ */}
      <GroupHeader label="Estrategia" icon={Rocket} color="#F59E0B" />

      <ChunkErrorBoundary>
        <EstrategiaWidget onNavigate={setActiveView} />
      </ChunkErrorBoundary>

      {/* ═══════════════════════════════════════════════════
          ACCIONES RAPIDAS
          ═══════════════════════════════════════════════════ */}
      <motion.div variants={fadeInUp} initial="hidden" animate="visible" custom={10}>
        <QuickActions sysMetrics={sysMetrics} setActiveView={setActiveView} />
      </motion.div>
    </div>
  );
}
