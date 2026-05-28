'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { fetchWithTimeout } from '@/lib/fetch-utils';
import { VitalMonitor } from '@/components/onion200/VitalMonitor';
import { LiveFeed } from '@/components/onion200/LiveFeed';
import { SystemStatus } from '@/components/onion200/SystemStatus';
import { CommandCenter } from '@/components/onion200/CommandCenter';
import { MiniCharts } from '@/components/onion200/MiniCharts';
import { PanelShell } from '@/components/onion200/PanelShell';
import { UserCircle, Send, Users, ChevronRight, LayoutGrid } from 'lucide-react';

type TabKey = 'resumen' | 'alertas' | 'fuentes' | 'captura' | 'clasificacion' | 'inteligencia' | 'produccion' | 'distribucion';

interface ResumenViewProps {
  onNavigateTab?: (tab: TabKey) => void;
}

// Minimal type for the data we need from indicadores-summary
interface ChartData {
  captura?: {
    porNivel?: Array<{ nivel: number; total: number }>;
    porSentimiento?: Array<{ sentimiento: string; total: number }>;
    porTipoMencion?: Array<{ tipoMencion: string; total: number }>;
    menciones?: { total: number };
  };
}

/**
 * ResumenView — Vista por defecto del puente de mando.
 * Muestra los 4 paneles principales: VitalMonitor, SystemStatus, CommandCenter, LiveFeed.
 * Incluye MiniCharts para analisis grafico de menciones.
 */
export function ResumenView({ onNavigateTab }: ResumenViewProps) {
  const [chartData, setChartData] = useState<ChartData | null>(null);

  const fetchChartData = useCallback(async () => {
    try {
      const res = await fetchWithTimeout('/api/dashboard/indicadores-summary', { timeoutMs: 8000 });
      if (res.ok) {
        const data: ChartData = await res.json();
        setChartData(data);
      }
    } catch {
      // Silent — MiniCharts will show "Sin datos"
    }
  }, []);

  useEffect(() => {
    fetchChartData();
    const iv = setInterval(fetchChartData, 60000); // Refresh every 60s
    return () => clearInterval(iv);
  }, [fetchChartData]);

  // Quick access navigation cards
  const quickLinks = [
    {
      href: '/clientes',
      label: 'Clientes',
      icon: <UserCircle className="w-5 h-5" />,
      color: '#f59e0b',
      bgStyle: 'linear-gradient(135deg, #f59e0b06 0%, rgba(5,5,5,0.9) 60%)',
      borderStyle: '1px solid #f59e0b15',
      iconBgStyle: 'rgba(245, 158, 11, 0.08)',
      iconBorderStyle: '1px solid #f59e0b25',
      labelColor: '#f59e0bdd',
      description: 'Gestion de clientes, contratos y suscripciones',
    },
    {
      href: '/entregas',
      label: 'Entregas',
      icon: <Send className="w-5 h-5" />,
      color: '#a78bfa',
      bgStyle: 'linear-gradient(135deg, #a78bfa06 0%, rgba(5,5,5,0.9) 60%)',
      borderStyle: '1px solid #a78bfa15',
      iconBgStyle: 'rgba(167, 139, 250, 0.08)',
      iconBorderStyle: '1px solid #a78bfa25',
      labelColor: '#a78bfadd',
      description: 'Historial de entregas y distribucion de productos',
    },
    {
      href: '/agente',
      label: 'Portal Agente',
      icon: <Users className="w-5 h-5" />,
      color: '#06b6d4',
      bgStyle: 'linear-gradient(135deg, #06b6d406 0%, rgba(5,5,5,0.9) 60%)',
      borderStyle: '1px solid #06b6d415',
      iconBgStyle: 'rgba(6, 182, 212, 0.08)',
      iconBorderStyle: '1px solid #06b6d425',
      labelColor: '#06b6d4dd',
      description: 'Panel del agente comercial con registros y operaciones',
    },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
      {/* Vital Monitor (4 cols) */}
      <div className="lg:col-span-4">
        <VitalMonitor />
      </div>

      {/* System Status (4 cols) */}
      <div className="lg:col-span-4">
        <SystemStatus onNavigateTab={onNavigateTab} />
      </div>

      {/* MiniCharts (4 cols) */}
      <div className="lg:col-span-4">
        <MiniCharts
          porNivel={chartData?.captura?.porNivel}
          porSentimiento={chartData?.captura?.porSentimiento}
          porTipoMencion={chartData?.captura?.porTipoMencion}
          totalMenciones={chartData?.captura?.menciones?.total}
        />
      </div>

      {/* Live Feed (3 cols) */}
      <div className="lg:col-span-3">
        <LiveFeed onNavigateTab={onNavigateTab} />
      </div>

      {/* Command Center (9 cols, next to LiveFeed) */}
      <div className="lg:col-span-9">
        <CommandCenter />
      </div>

      {/* Acceso Rapido — Gestion Comercial (full width) */}
      <div className="lg:col-span-12">
        <PanelShell title="Acceso Rapido" icon={<LayoutGrid className="w-3.5 h-3.5" />}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {quickLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="group flex items-center gap-3 p-3 rounded-lg transition-all duration-200 cursor-pointer"
                style={{
                  background: link.bgStyle,
                  border: link.borderStyle,
                }}
              >
                <div
                  className="flex items-center justify-center w-10 h-10 rounded-lg flex-shrink-0 transition-all duration-200"
                  style={{
                    backgroundColor: link.iconBgStyle,
                    border: link.iconBorderStyle,
                  }}
                >
                  <span style={{ color: link.color }}>{link.icon}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className="text-[11px] font-bold uppercase tracking-wider font-mono"
                    style={{ color: link.labelColor }}
                  >
                    {link.label}
                  </p>
                  <p className="text-[9px] font-mono text-slate-500 mt-0.5 truncate">
                    {link.description}
                  </p>
                </div>
                <ChevronRight
                  className="w-4 h-4 text-slate-700 group-hover:text-slate-400 transition-colors flex-shrink-0"
                />
              </Link>
            ))}
          </div>
        </PanelShell>
      </div>
    </div>
  );
}
