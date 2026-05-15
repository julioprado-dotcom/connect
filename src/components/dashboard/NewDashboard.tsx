'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchWithTimeout } from '@/lib/fetch-utils';
import {
  Activity,
  BarChart3,
  Zap,
  Radio,
  Tags,
  FileText,
  Send,
  Bell,
} from 'lucide-react';

import { StatusBar } from './StatusBar';
import { PipelineFlow } from './PipelineFlow';
import { SideNav } from './SideNav';
import { LiveLog } from './LiveLog';
import { GlobalSearch } from './GlobalSearch';
import { AIAssistantPanel } from './AIAssistantPanel';
import { CapturaPanel } from './panels/CapturaPanel';
import { ClasificacionPanel } from './panels/ClasificacionPanel';
import { ProduccionPanel } from './panels/ProduccionPanel';
import { DistribucionPanel } from './panels/DistribucionPanel';
import { BoletinExpressPanel } from './panels/BoletinExpressPanel';
import AlertasView from '@/components/views/AlertasView';

// ═══════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════

type NodeKey = 'captura' | 'clasificacion' | 'produccion' | 'distribucion' | 'boletin-express' | 'alertas';

// ═══════════════════════════════════════════════════════════
// Animation variants
// ═══════════════════════════════════════════════════════════

const panelSlideVariants = {
  hidden: {
    opacity: 0,
    y: 12,
    transition: { duration: 0.18, ease: 'easeIn' },
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: { duration: 0.12, ease: 'easeIn' },
  },
};

// ═══════════════════════════════════════════════════════════
// Mini stat card (for overview)
// ═══════════════════════════════════════════════════════════

function MiniStatCard({
  icon,
  label,
  value,
  subValue,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subValue?: string;
  color: string;
}) {
  return (
    <div
      className="rounded-xl p-4 transition-colors duration-150"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.1)',
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <div
          className="flex items-center justify-center rounded-lg"
          style={{ width: 32, height: 32, backgroundColor: `${color}15` }}
        >
          <span style={{ color }}>{icon}</span>
        </div>
        <span className="text-[11px] font-medium font-mono" style={{ color: '#64748b' }}>
          {label}
        </span>
      </div>
      <p
        className="text-xl font-bold leading-none"
        style={{ color: '#ffffff', fontFamily: 'JetBrains Mono, monospace' }}
      >
        {value}
      </p>
      {subValue && (
        <p className="text-[10px] mt-1" style={{ color: '#64748b' }}>
          {subValue}
        </p>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Quick Actions
// ═══════════════════════════════════════════════════════════

function QuickActions({ onBoletinExpress }: { onBoletinExpress: () => void }) {
  const [generando, setGenerando] = useState(false);

  const handleGenerateAll = () => {
    setGenerando(true);
    setTimeout(() => setGenerando(false), 4000);
  };

  return (
    <div className="space-y-2">
      <h3
        className="text-[11px] font-medium uppercase tracking-wider font-mono"
        style={{ color: '#64748b' }}
      >
        Acciones rápidas
      </h3>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleGenerateAll}
          disabled={generando}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-medium transition-all duration-200"
          style={{
            background: generando
              ? 'rgba(0,255,136,0.05)'
              : 'rgba(0,255,136,0.08)',
            border: '1px solid rgba(0,255,136,0.25)',
            color: '#00ff88',
          }}
        >
          {generando ? (
            <motion.span
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              className="inline-block"
            >
              <Zap className="w-3.5 h-3.5" />
            </motion.span>
          ) : (
            <Zap className="w-3.5 h-3.5" />
          )}
          {generando ? 'Generando productos...' : 'Generar todos los productos'}
        </button>
        <button
          onClick={onBoletinExpress}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-medium transition-all duration-200"
          style={{
            background: 'rgba(255,170,0,0.06)',
            border: '1px solid rgba(255,170,0,0.2)',
            color: '#ffaa00',
          }}
        >
          <Activity className="w-3.5 h-3.5" />
          Crear Boletín Express
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Overview (default when no node selected)
// ═══════════════════════════════════════════════════════════

interface OverviewStats {
  mencionesHoy: number;
  clasificacionPct: number;
  productosSemana: number;
  mencionesTotal: number;
  productosHoy: number;
  fuentesActivas: number;
}

function OverviewContent({
  onBoletinExpress,
}: {
  onBoletinExpress: () => void;
}) {
  const [stats, setStats] = useState<OverviewStats | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetchWithTimeout('/api/dashboard/indicadores-summary', { timeoutMs: 8000 });
        if (res.ok && !cancelled) {
          const d = await res.json();
          setStats({
            mencionesHoy: d.captura?.menciones?.hoy ?? 0,
            clasificacionPct: d.clasificacion?.tasas?.eje ?? 0,
            productosSemana: d.produccion?.productos?.semana ?? 0,
            mencionesTotal: d.captura?.menciones?.total ?? 0,
            productosHoy: d.produccion?.productos?.hoy ?? 0,
            fuentesActivas: d.captura?.fuentes?.activas ?? 0,
          });
        }
      } catch { /* silent */ }
    }
    load();
    const iv = setInterval(load, 60000);
    return () => { cancelled = true; clearInterval(iv); };
  }, []);

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* ── Stats + Search Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left: Mini stats */}
        <div className="space-y-3">
          <h3
            className="text-[11px] font-medium uppercase tracking-wider font-mono"
            style={{ color: '#64748b' }}
          >
            Resumen rápido
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <MiniStatCard
              icon={<Radio className="w-4 h-4" />}
              label="Menciones"
              value={stats ? stats.mencionesTotal : '...'}
              subValue={stats ? `${stats.mencionesHoy} hoy · ${stats.fuentesActivas} fuentes` : 'Cargando...'}
              color="#00ff88"
            />
            <MiniStatCard
              icon={<Tags className="w-4 h-4" />}
              label="Clasificación"
              value={stats ? `${stats.clasificacionPct}%` : '...'}
              subValue={stats ? 'con eje temático' : 'Cargando...'}
              color="#ffaa00"
            />
            <MiniStatCard
              icon={<FileText className="w-4 h-4" />}
              label="Productos"
              value={stats ? stats.productosSemana : '...'}
              subValue={stats ? `${stats.productosHoy} hoy` : 'Cargando...'}
              color="#6b7280"
            />
          </div>
        </div>

        {/* Right: GlobalSearch */}
        <div className="space-y-3">
          <h3
            className="text-[11px] font-medium uppercase tracking-wider font-mono"
            style={{ color: '#64748b' }}
          >
            Búsqueda global
          </h3>
          <div
            className="rounded-xl p-4"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <GlobalSearch />
          </div>
        </div>
      </div>

      {/* ── Quick Actions ── */}
      <QuickActions onBoletinExpress={onBoletinExpress} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Active Panel (based on selected node)
// ═══════════════════════════════════════════════════════════

function ActivePanel({
  activeNode,
  onClose,
}: {
  activeNode: NodeKey;
  onClose: () => void;
}) {
  const panels: Record<string, React.ReactNode> = {
    captura: <CapturaPanel onClose={onClose} />,
    clasificacion: <ClasificacionPanel onClose={onClose} />,
    produccion: <ProduccionPanel onClose={onClose} />,
    distribucion: <DistribucionPanel onClose={onClose} />,
    'boletin-express': <BoletinExpressPanel onClose={onClose} />,
    alertas: <AlertasView />,
  };

  return (
    <div className="p-4 sm:p-6">
      <AnimatePresence mode="wait">
        <motion.div
          key={activeNode}
          variants={panelSlideVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          {panels[activeNode] || null}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Mobile bottom nav bar (for screens <768px)
// ═══════════════════════════════════════════════════════════

function MobileBottomNav({
  activeView,
  onNavigate,
}: {
  activeView: string;
  onNavigate: (viewId: string) => void;
}) {
  const items = [
    { id: 'resumen', icon: BarChart3, label: 'Inicio' },
    { id: 'captura', icon: Radio, label: 'Captura' },
    { id: 'clasificacion', icon: Tags, label: 'Clasif.' },
    { id: 'produccion', icon: FileText, label: 'Prod.' },
    { id: 'distribucion', icon: Send, label: 'Dist.' },
    { id: 'alertas', icon: Bell, label: 'Alertas' },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around md:hidden"
      style={{
        backgroundColor: '#0f172a',
        borderTop: '1px solid rgba(255,255,255,0.1)',
        height: 56,
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {items.map((item) => {
        const isActive = activeView === item.id;
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full"
          >
            <Icon
              size={18}
              style={{ color: isActive ? '#00ff88' : '#64748b' }}
            />
            <span
              className="text-[9px] font-medium"
              style={{ color: isActive ? '#00ff88' : '#64748b' }}
            >
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

// ═══════════════════════════════════════════════════════════
// NewDashboard — Main orchestrator
// ═══════════════════════════════════════════════════════════

export function NewDashboard() {
  const [activeNode, setActiveNode] = useState<NodeKey | null>(null);

  // Map pipeline node keys to our activeNode type
  const handleNodeSelect = useCallback((nodeKey: string) => {
    setActiveNode((prev) => {
      if (prev === nodeKey) return null; // Toggle off
      return nodeKey as NodeKey;
    });
  }, []);

  // Map SideNav navigation to our system
  const handleSideNavNavigate = useCallback((viewId: string) => {
    const pipelineNodes: NodeKey[] = [
      'captura',
      'clasificacion',
      'produccion',
      'distribucion',
    ];

    if (pipelineNodes.includes(viewId as NodeKey)) {
      setActiveNode((prev) => {
        if (prev === viewId) return null; // Toggle off
        return viewId as NodeKey;
      });
    } else if (viewId === 'resumen') {
      setActiveNode(null);
    } else if (viewId === 'alertas') {
      setActiveNode((prev) => {
        if (prev === 'alertas') return null;
        return 'alertas';
      });
    } else if (viewId === 'configuracion') {
      // Keep active node as-is (config could open a modal in future)
    }
  }, []);

  // Handle Boletin Express from QuickActions
  const handleBoletinExpress = useCallback(() => {
    setActiveNode('boletin-express');
  }, []);

  // Close active panel
  const closePanel = useCallback(() => {
    setActiveNode(null);
  }, []);

  // Global keyboard shortcut: Escape to close panel
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && activeNode) {
        setActiveNode(null);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeNode]);

  return (
    <div
      className="flex h-screen overflow-hidden bg-slate-950 font-mono text-slate-200"
    >
      {/* ── SideNav (desktop only, 60px) ── */}
      <div className="hidden md:flex">
        <SideNav
          activeView={activeNode || 'resumen'}
          onNavigate={handleSideNavNavigate}
        />
      </div>

      {/* ── Main content area ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* ── StatusBar (PASO 1) ── */}
        <StatusBar />

        {/* ── PipelineFlow (PASO 2A) ── */}
        <div className="border-b border-white/10">
          <PipelineFlow
            activeNode={
              activeNode && activeNode !== 'boletin-express' && activeNode !== 'alertas'
                ? activeNode
                : null
            }
            onNodeSelect={handleNodeSelect}
          />
        </div>

        {/* ── Scrollable content ── */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {activeNode ? (
            <ActivePanel
              activeNode={activeNode}
              onClose={closePanel}
            />
          ) : (
            <OverviewContent onBoletinExpress={handleBoletinExpress} />
          )}
        </div>

        {/* ── LiveLog (PASO 6) — bottom bar ── */}
        <LiveLog />
      </div>

      {/* ── AIAssistantPanel (PASO 7) — floating widget ── */}
      <AIAssistantPanel />

      {/* ── Mobile bottom nav ── */}
      <MobileBottomNav
        activeView={activeNode || 'resumen'}
        onNavigate={handleSideNavNavigate}
      />
    </div>
  );
}

export default NewDashboard;
