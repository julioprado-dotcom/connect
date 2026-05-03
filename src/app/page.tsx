'use client';

import { useEffect, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { useDashboardStore } from '@/stores/useDashboardStore';
import { DashboardShell, LoadingScreen } from '@/components/dashboard/DashboardShell';

/* ═══════════════════════════════════════════════════════════
   Lazy-loaded views — code splitting via next/dynamic
   ═══════════════════════════════════════════════════════════ */

const loading = () => <ViewSkeleton />;

const ResumenView = dynamic(() => import('@/components/views/ResumenView').then(m => ({ default: m.ResumenView })), { ssr: false, loading });
const MencionesView = dynamic(() => import('@/components/views/MencionesView').then(m => ({ default: m.MencionesView })), { ssr: false, loading });
const ClientesView = dynamic(() => import('@/components/views/ClientesView').then(m => ({ default: m.ClientesView })), { ssr: false, loading });
const ContratosView = dynamic(() => import('@/components/views/ContratosView').then(m => ({ default: m.ContratosView })), { ssr: false, loading });
const PersonasView = dynamic(() => import('@/components/views/PersonasView').then(m => ({ default: m.PersonasView })), { ssr: false, loading });
const MediosView = dynamic(() => import('@/components/views/MediosView').then(m => ({ default: m.MediosView })), { ssr: false, loading });
const ClasificadoresView = dynamic(() => import('@/components/views/ClasificadoresView').then(m => ({ default: m.ClasificadoresView })), { ssr: false, loading });
const GeneradoresView = dynamic(() => import('@/components/views/GeneradoresView').then(m => ({ default: m.GeneradoresView })), { ssr: false, loading });
const ReportesView = dynamic(() => import('@/components/views/ReportesView').then(m => ({ default: m.ReportesView })), { ssr: false, loading });
const CapturaView = dynamic(() => import('@/components/views/CapturaView').then(m => ({ default: m.CapturaView })), { ssr: false, loading });
const BoletinesView = dynamic(() => import('@/components/views/BoletinesView').then(m => ({ default: m.BoletinesView })), { ssr: false, loading });
const AlertasView = dynamic(() => import('@/components/views/AlertasView').then(m => ({ default: m.AlertasView })), { ssr: false, loading });
const EstrategiaView = dynamic(() => import('@/components/views/EstrategiaView').then(m => ({ default: m.EstrategiaView })), { ssr: false, loading });
const IndicadoresView = dynamic(() => import('@/components/views/IndicadoresView').then(m => ({ default: m.IndicadoresView })), { ssr: false, loading });
const ProductosView = dynamic(() => import('@/components/views/ProductosView').then(m => ({ default: m.ProductosView })), { ssr: false, loading });
const ConfiguracionView = dynamic(() => import('@/components/views/ConfiguracionView').then(m => ({ default: m.ConfiguracionView })), { ssr: false, loading });
const SuscriptoresView = dynamic(() => import('@/components/views/SuscriptoresView').then(m => ({ default: m.SuscriptoresView })), { ssr: false, loading });

/* ═══════════════════════════════════════════════════════════
   View skeleton — shown during lazy loading
   ═══════════════════════════════════════════════════════════ */

function ViewSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-4 bg-muted rounded w-48" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-20 bg-muted rounded-lg" />
        ))}
      </div>
      <div className="h-48 bg-muted rounded-lg" />
      <div className="h-48 bg-muted rounded-lg" />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Main page — slim orchestrator
   ═══════════════════════════════════════════════════════════ */

export default function Dashboard() {
  const { loading, activeView, initialize } = useDashboardStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  if (loading) return <LoadingScreen />;

  const views: Record<string, ReactNode> = {
    resumen: <ResumenView />,
    menciones: <MencionesView />,
    clientes: <ClientesView />,
    contratos: <ContratosView />,
    suscriptores: <SuscriptoresView />,
    personas: <PersonasView />,
    medios: <MediosView />,
    clasificadores: <ClasificadoresView />,
    generadores: <GeneradoresView />,
    reportes: <ReportesView />,
    captura: <CapturaView />,
    boletines: <BoletinesView />,
    alertas: <AlertasView />,
    estrategia: <EstrategiaView />,
    indicadores: <IndicadoresView />,
    productos: <ProductosView />,
    configuracion: <ConfiguracionView />,
  };

  return (
    <DashboardShell>
      {views[activeView] || <ResumenView />}
    </DashboardShell>
  );
}
