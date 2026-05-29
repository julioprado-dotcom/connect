'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { fetchWithTimeout } from '@/lib/fetch-utils';
import { ResumenView } from '@/components/onion200/ResumenView';
import { CapturaView } from '@/components/onion200/CapturaView';
import { ClasificacionView } from '@/components/onion200/ClasificacionView';
import { ProduccionView } from '@/components/onion200/ProduccionView';
import { DistribucionView } from '@/components/onion200/DistribucionView';
import { FuentesView } from '@/components/onion200/FuentesView';
import { InteligenciaView } from '@/components/onion200/InteligenciaView';
import { IndicadoresView } from '@/components/onion200/IndicadoresView';
import { AlertasPanel } from '@/components/dashboard/panels/AlertasPanel';
import Image from 'next/image';
import {
  Crosshair,
  Radio,
  BarChart3,
  FileText,
  Send,
  RefreshCw,
  Monitor,
  Database,
  Sparkles,
  Cpu,
  Bell,
  LogOut,
  Sun,
  Moon,
  TrendingUp,
  LayoutGrid,
  Shield,
  Settings,
  Eye,
  Cog,
  Bot,
  ChevronDown,
} from 'lucide-react';
import { signOut } from 'next-auth/react';
import { useTheme } from '@/components/theme-provider';

// ═══════════════════════════════════════════════════════════════
// Types — Real data from /api/dashboard/indicadores-summary
// ═══════════════════════════════════════════════════════════════

interface PipelineKPIs {
  captura?: {
    menciones?: { total: number; hoy: number; semana: number };
    fuentes?: { activas: number; degradadas: number };
    status?: string;
  };
  clasificacion?: {
    tasas?: { eje: number; lente: number; sentimiento: number };
    status?: string;
  };
  produccion?: {
    productos?: { total: number; hoy: number; semana: number };
    status?: string;
  };
  distribucion?: {
    envios?: { total: number; exitosos: number; fallidos: number };
    status?: string;
  };
}

type TabKey = 'resumen' | 'alertas' | 'indicadores' | 'fuentes' | 'captura' | 'clasificacion' | 'inteligencia' | 'produccion' | 'distribucion';

interface TabConfig {
  key: TabKey;
  label: string;
  icon: React.ReactNode;
  statusKey?: 'captura' | 'clasificacion' | 'produccion' | 'distribucion';
}

const TABS: TabConfig[] = [
  { key: 'resumen', label: 'RESUMEN', icon: <Monitor className="w-3.5 h-3.5" /> },
  { key: 'alertas', label: 'ALERTAS', icon: <Bell className="w-3.5 h-3.5" /> },
  { key: 'indicadores', label: 'INDICADORES', icon: <TrendingUp className="w-3.5 h-3.5" /> },
  { key: 'fuentes', label: 'FUENTES', icon: <Database className="w-3.5 h-3.5" /> },
  { key: 'captura', label: 'CAPTURA', icon: <Radio className="w-3.5 h-3.5" />, statusKey: 'captura' },
  { key: 'clasificacion', label: 'CLASIFICACION', icon: <Crosshair className="w-3.5 h-3.5" />, statusKey: 'clasificacion' },
  { key: 'inteligencia', label: 'INTELIGENCIA', icon: <Sparkles className="w-3.5 h-3.5" /> },
  { key: 'produccion', label: 'PRODUCCION', icon: <FileText className="w-3.5 h-3.5" />, statusKey: 'produccion' },
  { key: 'distribucion', label: 'DISTRIBUCION', icon: <Send className="w-3.5 h-3.5" />, statusKey: 'distribucion' },
];

// ═══════════════════════════════════════════════════════════════
// Profile modes
// ═══════════════════════════════════════════════════════════════

const PROFILES = [
  { key: 'analista', label: 'ANALISTA', icon: <Shield className="w-3 h-3" />, color: '#06b6d4' },
  { key: 'admin', label: 'ADMIN', icon: <Settings className="w-3 h-3" />, color: '#f59e0b' },
  { key: 'periodista', label: 'PERIODISTA', icon: <Eye className="w-3 h-3" />, color: '#a78bfa' },
] as const;

const PROFILE_HIGHLIGHTS: Record<string, TabKey[]> = {
  analista: ['resumen', 'alertas', 'fuentes', 'inteligencia'],
  admin: ['captura', 'clasificacion', 'produccion', 'distribucion'],
  periodista: ['indicadores', 'captura', 'inteligencia', 'resumen'],
};

// ═══════════════════════════════════════════════════════════════
// Theme color palette
// ═══════════════════════════════════════════════════════════════

interface ThemeColors {
  bg: string;
  headerBg: string;
  border: string;
  borderSubtle: string;
  borderSubtle2: string;
  text: string;
  textMuted: string;
  textLabel: string;
  textKpiEmpty: string;
  cyanGlow: string;
  footerBg: string;
  hoverBg: string;
  kpiBase: string;
  kpiActive: string;
  tabHoverClass: string;
  logoBorder: string;
  logoBg: string;
  logoBoxShadow: string;
  btnBorder: string;
  btnColor: string;
}

const DARK_COLORS: ThemeColors = {
  bg: '#020202',
  headerBg: 'linear-gradient(180deg, rgba(6,182,212,0.04) 0%, transparent 100%)',
  border: 'rgba(6,182,212,0.15)',
  borderSubtle: 'rgba(6,182,212,0.1)',
  borderSubtle2: 'rgba(6,182,212,0.08)',
  text: '#e5e5e5',
  textMuted: '#94a3b8',
  textLabel: 'rgb(100 116 139)',
  textKpiEmpty: '#334155',
  cyanGlow: 'rgba(6,182,212,0.12)',
  footerBg: 'rgba(5,5,5,0.9)',
  hoverBg: 'rgba(6,182,212,0.1)',
  kpiBase: 'rgba(5,5,5,0.9)',
  kpiActive: 'rgba(5,5,5,0.9)',
  tabHoverClass: 'hover:bg-white/[0.02]',
  logoBorder: 'rgba(6,182,212,0.25)',
  logoBg: 'rgba(6,182,212,0.08)',
  logoBoxShadow: '0 0 16px rgba(6,182,212,0.12)',
  btnBorder: 'rgba(100,116,139,0.15)',
  btnColor: '#64748b',
};

const LIGHT_COLORS: ThemeColors = {
  bg: '#f8fafc',
  headerBg: 'linear-gradient(180deg, rgba(6,182,212,0.08) 0%, transparent 100%)',
  border: 'rgba(6,182,212,0.25)',
  borderSubtle: 'rgba(6,182,212,0.1)',
  borderSubtle2: 'rgba(6,182,212,0.06)',
  text: '#1e293b',
  textMuted: '#64748b',
  textLabel: 'rgb(100 116 139)',
  textKpiEmpty: '#cbd5e1',
  cyanGlow: 'rgba(6,182,212,0.15)',
  footerBg: 'rgba(248,250,252,0.95)',
  hoverBg: 'rgba(6,182,212,0.08)',
  kpiBase: 'rgba(255,255,255,0.9)',
  kpiActive: 'rgba(255,255,255,0.9)',
  tabHoverClass: 'hover:bg-black/[0.02]',
  logoBorder: 'rgba(6,182,212,0.35)',
  logoBg: 'rgba(6,182,212,0.12)',
  logoBoxShadow: '0 0 16px rgba(6,182,212,0.15)',
  btnBorder: 'rgba(100,116,139,0.25)',
  btnColor: '#475569',
};

// ═══════════════════════════════════════════════════════════════
// KPI Card — Real data, zero hardcode
// ═══════════════════════════════════════════════════════════════

function KPICard({
  icon,
  label,
  value,
  sub,
  color,
  status,
  onClick,
  active,
  colors,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number | null;
  sub?: string;
  color: string;
  status?: string;
  onClick?: () => void;
  active?: boolean;
  colors: ThemeColors;
}) {
  const statusColor =
    status === 'error'
      ? '#8b5cf6'
      : status === 'warning'
        ? '#f59e0b'
        : status === 'ok'
          ? '#06b6d4'
          : '#64748b';

  return (
    <button
      onClick={onClick}
      className="rounded-lg p-3 relative overflow-hidden transition-all duration-300 text-left cursor-pointer hover:scale-[1.02]"
      style={{
        background: active
          ? 'linear-gradient(135deg, ' + color + '10 0%, ' + colors.kpiActive + ' 60%)'
          : 'linear-gradient(135deg, ' + color + '06 0%, ' + colors.kpiBase + ' 60%)',
        border: '1px solid ' + (active ? color + '30' : color + '15'),
        boxShadow: active ? '0 0 16px ' + color + '10' : '0 0 12px ' + color + '06',
      }}
    >
      {/* Scan line */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(6,182,212,0.01) 3px, rgba(6,182,212,0.01) 4px)',
        }}
      />
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-1.5">
          <span style={{ color: color + '90' }}>{icon}</span>
          {status && status !== 'idle' && (
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{
                backgroundColor: statusColor,
                boxShadow: '0 0 6px ' + statusColor + '60',
              }}
            />
          )}
        </div>
        <p
          className="text-[9px] font-bold uppercase tracking-[0.12em] font-mono mb-1"
          style={{ color: colors.textLabel }}
        >
          {label}
        </p>
        <p
          className="text-xl font-bold font-mono tabular-nums leading-none"
          style={{ color: value !== null ? colors.text : colors.textKpiEmpty }}
        >
          {value !== null ? value : '---'}
        </p>
        {sub && (
          <p
            className="text-[9px] font-mono mt-1 truncate"
            style={{ color: colors.textMuted }}
          >
            {sub}
          </p>
        )}
        {/* Bottom glow */}
        <div
          className="absolute bottom-0 left-0 right-0 h-[1px]"
          style={{
            background: 'linear-gradient(90deg, transparent, ' + color + '20, transparent)',
          }}
        />
      </div>
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════
// Pipeline Status Bar — clickable tabs with real status
// ═══════════════════════════════════════════════════════════════

function PipelineStatusBar({
  pipeline,
  activeTab,
  onTabChange,
  colors,
  activeProfile,
}: {
  pipeline: PipelineKPIs;
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  colors: ThemeColors;
  activeProfile: string;
}) {
  const colorForStatus = (s?: string) =>
    s === 'error'
      ? '#8b5cf6'
      : s === 'warning'
        ? '#f59e0b'
        : s === 'ok'
          ? '#06b6d4'
          : '#334155';

  const highlightedTabs = PROFILE_HIGHLIGHTS[activeProfile] || [];

  return (
    <div
      className="flex items-center gap-1 sm:gap-2 overflow-x-auto py-2 px-3"
      style={{ borderBottom: '1px solid ' + colors.borderSubtle }}
    >
      {TABS.map((tab) => {
        const isActive = activeTab === tab.key;
        const status = tab.statusKey ? pipeline[tab.statusKey]?.status : undefined;
        const isHighlighted = highlightedTabs.includes(tab.key);
        const textColor = isActive
          ? '#06b6d4'
          : isHighlighted
            ? '#e2e8f0'
            : colors.textMuted;

        return (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            className={'flex items-center gap-1.5 flex-shrink-0 px-2 py-1 rounded-md transition-all duration-200 cursor-pointer ' + colors.tabHoverClass}
            style={{
              backgroundColor: isActive ? colors.hoverBg : 'transparent',
              boxShadow: isActive ? '0 0 8px rgba(6,182,212,0.15)' : isHighlighted ? '0 0 4px rgba(6,182,212,0.06)' : 'none',
            }}
          >
            <span style={{ color: textColor + '90' }}>{tab.icon}</span>
            <span
              className="text-[9px] font-bold tracking-wider font-mono whitespace-nowrap"
              style={{ color: textColor }}
            >
              {tab.label}
            </span>
            {status && (
              <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{
                  backgroundColor: colorForStatus(status),
                  boxShadow: '0 0 4px ' + colorForStatus(status) + '50',
                }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Live Clock Component
// ═══════════════════════════════════════════════════════════════

function LiveClock({ now }: { now: Date }) {
  // suppressHydrationWarning: los timestamps difieren entre SSR y client hydration
  return (
    <div className="flex flex-col items-end">
      <span
        className="text-xs font-mono text-cyan-400 tabular-nums"
        style={{ textShadow: '0 0 8px rgba(6,182,212,0.4)' }}
        suppressHydrationWarning
      >
        {now.toLocaleTimeString('es-BO', { hour12: false })}
      </span>
      <span className="text-[8px] font-mono text-cyan-500/60" suppressHydrationWarning>
        {now.toLocaleDateString('es-BO', { weekday: 'long', day: 'numeric', month: 'short' })}
      </span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Profile Selector Component
// ═══════════════════════════════════════════════════════════════

function ProfileSelector({
  activeProfile,
  onProfileChange,
}: {
  activeProfile: string;
  onProfileChange: (key: string) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      {PROFILES.map((profile) => {
        const isActive = activeProfile === profile.key;
        return (
          <button
            key={profile.key}
            onClick={() => onProfileChange(profile.key)}
            className="flex items-center gap-1 px-2 py-1 rounded text-[8px] font-bold font-mono uppercase tracking-wider transition-all duration-200 cursor-pointer"
            style={{
              color: isActive ? profile.color : '#64748b',
              border: '1px solid ' + (isActive ? profile.color + '40' : 'rgba(100,116,139,0.15)'),
              backgroundColor: isActive ? profile.color + '10' : 'transparent',
              boxShadow: isActive ? '0 0 8px ' + profile.color + '15' : 'none',
              textShadow: isActive ? '0 0 6px ' + profile.color + '40' : 'none',
            }}
          >
            {profile.icon}
            <span className="hidden sm:inline">{profile.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ONION200 Dashboard — Main orchestrator with navigation
// ═══════════════════════════════════════════════════════════════

export default function ONION200Dashboard() {
  const [activeTab, setActiveTab] = useState<TabKey>('resumen');
  const [kpis, setKpis] = useState<PipelineKPIs | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [now, setNow] = useState<Date>(new Date());
  const [activeProfile, setActiveProfile] = useState<string>('analista');
  const { theme, setTheme } = useTheme();

  const colors: ThemeColors = theme === 'dark' ? DARK_COLORS : LIGHT_COLORS;

  // Live clock — tick every second
  useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(iv);
  }, []);

  const fetchKPIs = useCallback(async () => {
    try {
      const res = await fetchWithTimeout('/api/dashboard/indicadores-summary', {
        timeoutMs: 8000,
      });
      if (res.ok) {
        const data = await res.json();
        setKpis(data);
        setLastUpdate(
          new Date().toLocaleTimeString('es-BO', { hour12: false })
        );
      }
    } catch {
      // Silent — KPI cards will show "---"
    }
  }, []);

  useEffect(() => {
    fetchKPIs();
    const iv = setInterval(fetchKPIs, 60000); // Refresh KPIs every 60s
    return () => clearInterval(iv);
  }, [fetchKPIs]);

  const captura = kpis?.captura;
  const clasif = kpis?.clasificacion;
  const prod = kpis?.produccion;
  const dist = kpis?.distribucion;

  // AI Usage KPI data
  const [aiUsageKPI, setAiUsageKPI] = useState<{ llamadas: number; totalTokens: number; costoUSD: number } | null>(null);
  useEffect(() => {
    const fetchAI = async () => {
      try {
        const res = await fetchWithTimeout('/api/dashboard/ai/usage?dias=1', { timeoutMs: 8000 });
        if (res.ok) {
          const data = await res.json();
          setAiUsageKPI(data.hoy);
        }
      } catch {}
    };
    fetchAI();
    const interval = setInterval(fetchAI, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab);
  };

  return (
    <div
      className="min-h-screen flex flex-col overflow-hidden"
      style={{ backgroundColor: colors.bg }}
    >
      {/* ═══ HEADER — ONION200 Branding ═══ */}
      <header
        className="flex-shrink-0 px-3 sm:px-5 py-2 flex items-center justify-between"
        style={{
          borderBottom: '1px solid ' + colors.border,
          background: colors.headerBg,
        }}
      >
        <div className="flex items-center gap-2.5">
          {/* Logo DECODEX */}
          <div
            className="flex items-center justify-center w-[48px] h-[48px] rounded-xl overflow-hidden"
            style={{
              border: '1px solid ' + colors.logoBorder,
              backgroundColor: colors.logoBg,
              boxShadow: colors.logoBoxShadow,
            }}
          >
            <Image src="/decodex-logo.png" alt="DECODEX" width={36} height={36} className="object-contain" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-[0.2em] text-cyan-300 font-mono uppercase">
              DECODEX
            </h1>
            <p className="text-[10px] tracking-wider text-slate-600 font-mono">
              PUENTE DE MANDO · ONION200
            </p>
          </div>
        </div>

        {/* Profile Selector */}
        <ProfileSelector activeProfile={activeProfile} onProfileChange={setActiveProfile} />

        {/* Right side: clock + status + nav */}
        <div className="flex items-center gap-3">
          {/* Live Clock */}
          <LiveClock now={now} />

          <div className="flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-full bg-emerald-500 animate-glow-pulse"
              style={{
                boxShadow: '0 0 6px rgba(16,185,129,0.5)',
              }}
            />
            <span className="text-[9px] font-bold uppercase text-emerald-500/60 font-mono">
              En línea
            </span>
          </div>
          {/* Clientes nav link */}
          <Link
            href="/clientes"
            className="flex items-center gap-1.5 px-2 py-1 rounded text-[9px] font-mono uppercase tracking-wider transition-all hover:bg-cyan-500/10"
            style={{ color: colors.btnColor, border: '1px solid ' + colors.btnBorder }}
            title="Gestión Comercial"
          >
            <LayoutGrid className="w-3 h-3" />
            <span className="hidden sm:inline">Clientes</span>
          </Link>
          {/* Entregas nav link */}
          <Link
            href="/entregas"
            className="flex items-center gap-1.5 px-2 py-1 rounded text-[9px] font-mono uppercase tracking-wider transition-all hover:bg-cyan-500/10"
            style={{ color: colors.btnColor, border: '1px solid ' + colors.btnBorder }}
            title="Gestión de Entregas"
          >
            <Send className="w-3 h-3" />
            <span className="hidden sm:inline">Entregas</span>
          </Link>
          {/* Configuración nav link */}
          <Link
            href="/configuracion/marco-conceptual"
            className="flex items-center gap-1.5 px-2 py-1 rounded text-[9px] font-mono uppercase tracking-wider transition-all hover:bg-cyan-500/10"
            style={{ color: colors.btnColor, border: '1px solid ' + colors.btnBorder }}
            title="Configuración del sistema"
          >
            <Cog className="w-3 h-3" />
            <span className="hidden sm:inline">Config</span>
          </Link>
          {/* Agente nav link */}
          <Link
            href="/agente"
            className="flex items-center gap-1.5 px-2 py-1 rounded text-[9px] font-mono uppercase tracking-wider transition-all hover:bg-cyan-500/10"
            style={{ color: colors.btnColor, border: '1px solid ' + colors.btnBorder }}
            title="Agente IA - Asistente inteligente"
          >
            <Bot className="w-3 h-3" />
            <span className="hidden sm:inline">Agente</span>
          </Link>
          {/* Theme toggle */}
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="flex items-center gap-1.5 px-2 py-1 rounded text-[9px] font-mono uppercase tracking-wider transition-all hover:bg-white/5"
            style={{ color: colors.btnColor, border: '1px solid ' + colors.btnBorder }}
            title={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
          >
            {theme === 'dark' ? <Sun className="w-3 h-3" /> : <Moon className="w-3 h-3" />}
            <span className="hidden md:inline">{theme === 'dark' ? 'Claro' : 'Oscuro'}</span>
          </button>
          {/* Logout */}
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="flex items-center gap-1.5 px-2 py-1 rounded text-[9px] font-mono uppercase tracking-wider transition-all hover:bg-red-500/10"
            style={{ color: colors.btnColor, border: '1px solid ' + colors.btnBorder }}
            title="Cerrar sesión"
          >
            <LogOut className="w-3 h-3" />
          </button>
        </div>
      </header>

      {/* ═══ PIPELINE STATUS BAR — Clickable navigation ═══ */}
      <PipelineStatusBar
        pipeline={kpis || {}}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        colors={colors}
        activeProfile={activeProfile}
      />

      {/* ═══ KPI CARDS — Real data row ═══ */}
      <div
        className="flex-shrink-0 px-4 sm:px-6 py-3 grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-3"
        style={{ borderBottom: '1px solid ' + colors.borderSubtle2 }}
      >
        <KPICard
          icon={<Radio className="w-4 h-4" />}
          label="Menciones Hoy"
          value={captura?.menciones?.hoy ?? null}
          sub={
            captura
              ? (captura.menciones?.total ?? 0) + ' total · ' + (captura.fuentes?.activas ?? 0) + ' fuentes'
              : undefined
          }
          color="#10b981"
          status={captura?.status}
          onClick={() => handleTabChange('captura')}
          active={activeTab === 'captura'}
          colors={colors}
        />
        <KPICard
          icon={<Crosshair className="w-4 h-4" />}
          label="Clasificacion"
          value={
            clasif?.tasas?.eje !== undefined
              ? clasif.tasas.eje + '%'
              : null
          }
          sub={clasif ? 'con eje tematico' : undefined}
          color="#06b6d4"
          status={clasif?.status}
          onClick={() => handleTabChange('clasificacion')}
          active={activeTab === 'clasificacion'}
          colors={colors}
        />
        <KPICard
          icon={<BarChart3 className="w-4 h-4" />}
          label="Productos Semana"
          value={prod?.productos?.semana ?? null}
          sub={
            prod ? (prod.productos?.hoy ?? 0) + ' hoy' : undefined
          }
          color="#f59e0b"
          status={prod?.status}
          onClick={() => handleTabChange('produccion')}
          active={activeTab === 'produccion'}
          colors={colors}
        />
        <KPICard
          icon={<Send className="w-4 h-4" />}
          label="Envios"
          value={
            dist?.envios?.total !== undefined
              ? dist.envios.total
              : null
          }
          sub={
            dist
              ? (dist.envios?.exitosos ?? 0) + ' OK · ' + (dist.envios?.fallidos ?? 0) + ' fallidos'
              : undefined
          }
          color="#a78bfa"
          status={dist?.status}
          onClick={() => handleTabChange('distribucion')}
          active={activeTab === 'distribucion'}
          colors={colors}
        />
        <KPICard
          icon={<Cpu className="w-4 h-4" />}
          label="IA Tokens"
          value={aiUsageKPI ? (aiUsageKPI.totalTokens >= 1000 ? (aiUsageKPI.totalTokens / 1000).toFixed(1) + 'K' : String(aiUsageKPI.totalTokens)) : null}
          sub={aiUsageKPI ? aiUsageKPI.llamadas + ' llamadas · $' + aiUsageKPI.costoUSD.toFixed(2) : undefined}
          color="#f43f5e"
          onClick={() => handleTabChange('resumen')}
          active={activeTab === 'resumen'}
          colors={colors}
        />
      </div>

      {/* ═══ MAIN CONTENT AREA — Conditional rendering per tab ═══ */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6">
        <div className="max-w-[1400px] mx-auto">
          {activeTab === 'resumen' && <ResumenView onNavigateTab={handleTabChange} />}
          {activeTab === 'alertas' && <AlertasPanel />}
          {activeTab === 'indicadores' && <IndicadoresView onNavigateTab={handleTabChange} />}
          {activeTab === 'fuentes' && <FuentesView />}
          {activeTab === 'captura' && <CapturaView />}
          {activeTab === 'clasificacion' && <ClasificacionView />}
          {activeTab === 'inteligencia' && <InteligenciaView />}
          {activeTab === 'produccion' && <ProduccionView />}
          {activeTab === 'distribucion' && <DistribucionView />}
        </div>
      </div>

      {/* ═══ FOOTER BAR ═══ */}
      <footer
        className="flex-shrink-0 px-4 sm:px-6 py-1.5 flex items-center justify-between"
        style={{
          borderTop: '1px solid ' + colors.borderSubtle,
          background: colors.footerBg,
        }}
      >
        <span className="text-[9px] font-mono" style={{ color: colors.textMuted }} suppressHydrationWarning>
          ONION200 v2.0 · DECODEX Bolivia · {now.toLocaleDateString('es-BO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </span>
        <span className="text-[9px] font-mono text-cyan-500/70" suppressHydrationWarning>
          {now.toLocaleTimeString('es-BO', { hour12: false })} Bolivia
        </span>
      </footer>
    </div>
  );
}
