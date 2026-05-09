'use client';

import React, { useState, useCallback, Component, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { BarChart3, TrendingUp, ShieldAlert, Loader2 } from 'lucide-react';
import { useDashboardStore } from '@/stores/useDashboardStore';
import { TopVariations } from '@/components/dashboard/TopVariations';
import { fetchWithTimeout } from '@/lib/fetch-utils';
import { usePolling } from './hooks/usePolling';
import type { SystemMetrics } from '@/types/dashboard';
import type { AiHealthData } from './sections/SystemStatusOrbs';
import type { EntregasHoyData } from './sections/EntregasHoy';

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
    // Solo log ChunkLoadError, no spam la consola con otros errores
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

// ─── Already-dynamic heavy sub-components ─────────────────────

// Dynamic imports con cache-bust para evitar ChunkLoadError por HMR stale refs
// Turbopack regenera chunk IDs al cambiar el loader, limpiando cache del navegador
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

// ─── Animation variants ──────────────────────────────────────

/** Skeleton reutilizable para secciones lazy-loaded */
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

  return (
    <div className="space-y-6">

      {/* ═══ Section 1: Diagnostico del Sistema + StatusOrbs ═══ */}
      <motion.div variants={stagger} initial="hidden" animate="visible" className="grid grid-cols-1 gap-3 sm:gap-4">
        <motion.div custom={0} variants={fadeInUp}>
          <SystemStatusOrbs
            sysMetrics={sysMetrics}
            entregasHoy={entregasHoy}
            aiHealth={aiHealth}
            mcResumen={mcResumen}
            setActiveView={setActiveView}
          />
        </motion.div>
        <motion.div custom={1} variants={fadeInUp}>
          <EntregasHoy entregasHoy={entregasHoy} setActiveView={setActiveView} />
        </motion.div>
        <motion.div custom={2} variants={fadeInUp}>
          <ChunkErrorBoundary>
            <PipelineMonitor data={pipelineData} onRefresh={fetchPipelineStats} />
          </ChunkErrorBoundary>
        </motion.div>
        <motion.div custom={3} variants={fadeInUp}>
          <ChunkErrorBoundary>
            <ScrapingPhaseControl />
          </ChunkErrorBoundary>
        </motion.div>
      </motion.div>

      {/* ═══ Section 2: Category Cards ═══ */}
      <CategoryCardsGrid data={data} mediosHealth={mediosHealth} setActiveView={setActiveView} />

      {/* ═══ Section 3: Activity Feed ═══ */}
      <ActivityFeed data={data} mediosHealth={mediosHealth} setActiveView={setActiveView} />

      {/* ═══ Section 4: Top Variaciones + Alarmas Comerciales ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div variants={fadeInUp} initial="hidden" animate="visible" custom={8}>
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
        </motion.div>
        <motion.div variants={fadeInUp} initial="hidden" animate="visible" custom={9}>
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
        </motion.div>
      </div>

      {/* ═══ Section 5: Quick Actions ═══ */}
      <motion.div variants={fadeInUp} initial="hidden" animate="visible" custom={10}>
        <QuickActions sysMetrics={sysMetrics} setActiveView={setActiveView} />
      </motion.div>
    </div>
  );
}
