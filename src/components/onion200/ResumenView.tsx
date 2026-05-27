'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { fetchWithTimeout } from '@/lib/fetch-utils';
import { VitalMonitor } from '@/components/onion200/VitalMonitor';
import { LiveFeed } from '@/components/onion200/LiveFeed';
import { SystemStatus } from '@/components/onion200/SystemStatus';
import { CommandCenter } from '@/components/onion200/CommandCenter';
import { MiniCharts } from '@/components/onion200/MiniCharts';

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
    </div>
  );
}
