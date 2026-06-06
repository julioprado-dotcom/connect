'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Eye, Bell, Database, FileBarChart, UserCircle, Activity, Zap, Shield,
} from 'lucide-react';
import type { SystemMetrics } from '@/types/dashboard';

// ─── Types ────────────────────────────────────────────────────

interface GuardianInfo {
  active: boolean
  level: string
  currentPct: number
}

// ─── Props ────────────────────────────────────────────────────

interface QuickActionsProps {
  sysMetrics: SystemMetrics | null;
  setActiveView: (viewId: string) => void;
}

// ─── Component ────────────────────────────────────────────────

export function QuickActions({ sysMetrics, setActiveView }: QuickActionsProps) {
  const [guardian, setGuardian] = useState<GuardianInfo | null>(null)

  useEffect(() => {
    // Poll guardian status cada 30s
    const fetchGuardian = async () => {
      try {
        const res = await fetch('/api/admin/cache')
        if (res.ok) {
          const data = await res.json()
          setGuardian(data.guardian ? {
            active: data.guardian.active,
            level: data.guardian.level,
            currentPct: data.guardian.currentPct,
          } : null)
        }
      } catch { /* silent */ }
    }
    fetchGuardian()
    const interval = setInterval(fetchGuardian, 30_000)
    return () => clearInterval(interval)
  }, [])

  const guardianColor = guardian
    ? guardian.level === 'emergency' ? 'text-red-500'
      : guardian.level === 'critical' ? 'text-orange-500'
      : guardian.level === 'warn' ? 'text-amber-500'
      : guardian.level === 'watch' ? 'text-blue-500'
      : 'text-green-500'
    : 'text-muted-foreground'

  return (
    <>
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
              onClick={() => setActiveView('clientes')}
            >
              <UserCircle className="h-3.5 w-3.5" />
              Contratos
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

      {/* System info footer */}
      {sysMetrics && (
        <div className="flex items-center justify-between text-[10px] text-muted-foreground/60 px-1 pb-2">
          <span>Node {sysMetrics.nodeVersion} · {sysMetrics.environment}</span>
          <span className="flex items-center gap-1.5">
            {guardian && (
              <>
                <Shield className={`h-3 w-3 ${guardianColor}`} />
                <span className={guardianColor}>
                  Guardian {guardian.active ? 'ON' : 'OFF'} {guardian.currentPct}%
                </span>
                <span className="text-muted-foreground/40">|</span>
              </>
            )}
            <span>Heap {sysMetrics.memoryUsage.heapUsed} MB · Contenedor {sysMetrics.memoryUsage.cgroupUsage}/{sysMetrics.memoryUsage.cgroupLimit} MB</span>
          </span>
          <span>DB: {sysMetrics.dbSize} MB · {sysMetrics.uptimeFormatted}</span>
        </div>
      )}
    </>
  );
}
