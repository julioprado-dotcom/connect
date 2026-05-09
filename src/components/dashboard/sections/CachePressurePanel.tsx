'use client'

// CachePressurePanel — Panel "Contenedor & Cache" del dashboard
// Muestra gauges de presión de memoria, contenedor y cache con acciones de purga

import React, { useState, useCallback, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { HardDrive, Trash2, Database, Cpu, Gauge, RefreshCw } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────

interface CacheData {
  memory: {
    rss: number
    heapUsed: number
    heapLimit: number
    heapPct: number
  }
  container: {
    usageMB: number
    limitMB: number
    pct: number
    availableMB: number
  }
  cache: {
    nextCacheSizeMB: number
    turbopackCacheSizeMB: number
    dbSizeMB: number
    backupCount: number
    backupTotalMB: number
  }
  pressure: {
    score: number
    label: string
  }
  uptime: {
    seconds: number
    formatted: string
  }
  timestamp: string
}

interface PurgeResult {
  exito: boolean
  totalLiberado: string
  resultados: Array<{ target: string; exito: boolean; liberado: string }>
}

// ── Gauge Component ───────────────────────────────────────────────────

function PressureGauge({ value, label, color }: { value: number; label: string; color: string }) {
  const circumference = 2 * Math.PI * 40
  const offset = circumference - (value / 100) * circumference

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-24 h-24">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="6" className="text-muted/20" />
          <circle
            cx="50" cy="50" r="40" fill="none"
            stroke={color}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-bold" style={{ color }}>{value}%</span>
        </div>
      </div>
      <span className="text-[10px] text-muted-foreground text-center leading-tight">{label}</span>
    </div>
  )
}

function gaugeColor(value: number): string {
  if (value > 80) return '#ef4444'
  if (value > 60) return '#f59e0b'
  if (value > 40) return '#3b82f6'
  return '#22c55e'
}

// ── Metric Row ────────────────────────────────────────────────────────

function MetricRow({ icon: Icon, label, value, unit }: { icon: React.ElementType; label: string; value: string | number; unit: string }) {
  return (
    <div className="flex items-center justify-between py-1 border-b border-border/50 last:border-0">
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <span className="text-xs font-medium font-mono">{value} {unit}</span>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────

export function CachePressurePanel() {
  const [data, setData] = useState<CacheData | null>(null)
  const [loading, setLoading] = useState(true)
  const [purging, setPurging] = useState(false)
  const [purgeResult, setPurgeResult] = useState<PurgeResult | null>(null)

  const fetchMetrics = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/cache')
      if (res.ok) setData(await res.json())
    } catch { /* silent */ }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchMetrics()
    const interval = setInterval(fetchMetrics, 30_000)
    return () => clearInterval(interval)
  }, [fetchMetrics])

  const handlePurge = useCallback(async (accion: string) => {
    setPurging(true)
    setPurgeResult(null)
    try {
      const res = await fetch('/api/admin/cache', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion }),
      })
      if (res.ok) {
        const result = await res.json()
        setPurgeResult(result)
        // Refresh metrics after purge
        setTimeout(fetchMetrics, 1000)
      }
    } catch { /* silent */ }
    setPurging(false)
  }, [fetchMetrics])

  if (loading || !data) {
    return (
      <Card className="border">
        <CardHeader className="pb-2 pt-3 px-4">
          <CardTitle className="text-xs font-medium flex items-center gap-2">
            <Gauge className="h-3.5 w-3.5" />
            Contenedor & Cache
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3">
          <div className="flex items-center justify-center py-4">
            <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    )
  }

  const mainPressureColor = gaugeColor(data.pressure.score)

  return (
    <Card className="border hover:shadow-md transition-all">
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xs font-medium flex items-center gap-2">
            <Gauge className="h-3.5 w-3.5" />
            Contenedor & Cache
          </CardTitle>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
            style={{ backgroundColor: mainPressureColor + '20', color: mainPressureColor }}>
            {data.pressure.label.toUpperCase()}
          </span>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-3 space-y-3">
        {/* Gauges */}
        <div className="flex justify-around">
          <PressureGauge value={Math.round(data.memory.heapPct)} label="Heap" color={gaugeColor(data.memory.heapPct)} />
          <PressureGauge value={Math.round(data.container.pct)} label="Contenedor" color={gaugeColor(data.container.pct)} />
          <PressureGauge value={data.pressure.score} label="Presión" color={mainPressureColor} />
        </div>

        {/* Metrics */}
        <div className="space-y-0">
          <MetricRow icon={Cpu} label="RSS" value={data.memory.rss} unit="MB" />
          <MetricRow icon={HardDrive} label="Cache Next.js" value={data.cache.nextCacheSizeMB} unit="MB" />
          <MetricRow icon={HardDrive} label="Turbopack" value={data.cache.turbopackCacheSizeMB} unit="MB" />
          <MetricRow icon={Database} label="DB" value={data.cache.dbSizeMB} unit="MB" />
          <MetricRow icon={Database} label="Backups" value={`${data.cache.backupCount} (${data.cache.backupTotalMB})`} unit="MB" />
        </div>

        {/* Purge result toast */}
        {purgeResult && (
          <div className={`text-[10px] px-2 py-1.5 rounded ${purgeResult.exito ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'}`}>
            {purgeResult.exito
              ? `Liberado: ${purgeResult.totalLiberado}`
              : 'Error en purga'}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-1.5 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-[10px] px-2"
            disabled={purging}
            onClick={() => handlePurge('purge_next')}
          >
            <Trash2 className="h-3 w-3 mr-1" />
            Cache Dev
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-[10px] px-2"
            disabled={purging}
            onClick={() => handlePurge('purge_turbopack')}
          >
            <Trash2 className="h-3 w-3 mr-1" />
            Turbopack
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-[10px] px-2"
            disabled={purging}
            onClick={() => handlePurge('purge_backups')}
          >
            <Trash2 className="h-3 w-3 mr-1" />
            Backups
          </Button>
          <Button
            size="sm"
            variant="destructive"
            className="h-7 text-[10px] px-2"
            disabled={purging}
            onClick={() => handlePurge('purge_all')}
          >
            <Trash2 className="h-3 w-3 mr-1" />
            Todo
          </Button>
        </div>

        {/* Uptime footer */}
        <div className="text-[9px] text-muted-foreground text-right">
          Uptime: {data.uptime.formatted}
        </div>
      </CardContent>
    </Card>
  )
}
