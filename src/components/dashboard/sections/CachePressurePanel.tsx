'use client'

// CachePressurePanel — Panel "Contenedor & Cache" del dashboard
// Muestra gauges de presión, estado del Container Guardian, mini gráfica
// de tendencia cgroup y acciones de purga incluyendo drop_caches del SO

import React, { useState, useCallback, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { HardDrive, Trash2, Database, Cpu, Gauge, RefreshCw, Shield, Zap, Save } from 'lucide-react'

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
  guardian: {
    active: boolean
    level: string
    currentPct: number
    trendMB: number
    trendPctPerHour: number
    lastAction: string
    lastActionTime: string | null
    lastActionMessage: string | null
    actionsExecuted: number
    emergencyCount: number
    workerPaused: boolean
    schedulerPaused: boolean
    snapshots: Array<{
      timestamp: string
      cgroupPct: number
      level: string
      action: string
    }>
  }
  backup: {
    config: { archivo: string; tamanio: string; fecha: string } | null
    operacional: { archivo: string; tamanio: string; fecha: string } | null
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
  nota?: string
}

// ── Gauge Component ───────────────────────────────────────────────────

function PressureGauge({ value, label, color }: { value: number; label: string; color: string }) {
  const circumference = 2 * Math.PI * 40
  const offset = circumference - (Math.min(100, value) / 100) * circumference

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
          <span className="text-lg font-bold" style={{ color }}>{Math.round(value)}%</span>
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

function guardianLevelColor(level: string): string {
  switch (level) {
    case 'emergency': return '#ef4444'
    case 'critical': return '#f97316'
    case 'warn': return '#f59e0b'
    case 'watch': return '#3b82f6'
    default: return '#22c55e'
  }
}

// ── Metric Row ────────────────────────────────────────────────────────

function MetricRow({ icon: Icon, label, value, unit, warn }: { icon: React.ElementType; label: string; value: string | number; unit: string; warn?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1 border-b border-border/50 last:border-0">
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <span className={`text-xs font-medium font-mono ${warn ? 'text-red-500' : ''}`}>{value} {unit}</span>
    </div>
  )
}

// ── Mini Trend Sparkline ──────────────────────────────────────────────

function TrendSparkline({ snapshots }: { snapshots: CacheData['guardian']['snapshots'] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || snapshots.length < 2) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const w = canvas.width
    const h = canvas.height
    const pcts = snapshots.map(s => s.cgroupPct)
    const min = Math.max(0, Math.min(...pcts) - 5)
    const max = Math.min(100, Math.max(...pcts) + 5)
    const range = max - min || 1

    ctx.clearRect(0, 0, w, h)

    // Zona de peligro (70%+)
    const dangerY = h - ((70 - min) / range) * h
    ctx.fillStyle = 'rgba(239, 68, 68, 0.08)'
    ctx.fillRect(0, 0, w, dangerY)

    // Línea de 70%
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.3)'
    ctx.setLineDash([3, 3])
    ctx.beginPath()
    ctx.moveTo(0, dangerY)
    ctx.lineTo(w, dangerY)
    ctx.stroke()
    ctx.setLineDash([])

    // Línea de tendencia
    const gradient = ctx.createLinearGradient(0, 0, 0, h)
    gradient.addColorStop(0, 'rgba(59, 130, 246, 0.6)')
    gradient.addColorStop(1, 'rgba(34, 197, 94, 0.3)')

    ctx.strokeStyle = gradient
    ctx.lineWidth = 1.5
    ctx.beginPath()
    pcts.forEach((pct, i) => {
      const x = (i / (pcts.length - 1)) * w
      const y = h - ((pct - min) / range) * h
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.stroke()

    // Área bajo la línea
    const lastIdx = pcts.length - 1
    const lastX = w
    const areaGradient = ctx.createLinearGradient(0, 0, 0, h)
    areaGradient.addColorStop(0, 'rgba(59, 130, 246, 0.15)')
    areaGradient.addColorStop(1, 'rgba(59, 130, 246, 0.02)')
    ctx.fillStyle = areaGradient
    ctx.lineTo(lastX, h)
    ctx.lineTo(0, h)
    ctx.closePath()
    ctx.fill()
  }, [snapshots])

  if (snapshots.length < 2) return null

  return (
    <canvas
      ref={canvasRef}
      width={200}
      height={40}
      className="w-full h-10 rounded"
    />
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
        setTimeout(fetchMetrics, 2000)
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
  const gColor = guardianLevelColor(data.guardian.level)

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

        {/* ── Guardian Status Bar ─────────────────────────────────── */}
        <div className="flex items-center justify-between px-2 py-1.5 rounded-md text-[10px]"
          style={{ backgroundColor: gColor + '10' }}>
          <div className="flex items-center gap-1.5">
            <Shield className="h-3 w-3" style={{ color: gColor }} />
            <span className="font-medium" style={{ color: gColor }}>
              GUARDIAN {data.guardian.level.toUpperCase()}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {data.guardian.workerPaused && (
              <span className="text-red-500 font-medium">WORKER ⏸</span>
            )}
            {data.guardian.schedulerPaused && (
              <span className="text-amber-500 font-medium">SCHED ⏸</span>
            )}
            <span className="text-muted-foreground">
              {data.guardian.currentPct}%
            </span>
          </div>
        </div>

        {/* ── Gauges ─────────────────────────────────────────────── */}
        <div className="flex justify-around">
          <PressureGauge value={Math.round(data.memory.heapPct)} label="Heap" color={gaugeColor(data.memory.heapPct)} />
          <PressureGauge value={Math.round(data.container.pct)} label="Contenedor" color={gaugeColor(data.container.pct)} />
          <PressureGauge value={data.pressure.score} label="Presión" color={mainPressureColor} />
        </div>

        {/* ── Trend Sparkline ────────────────────────────────────── */}
        {data.guardian.snapshots.length >= 2 && (
          <div>
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[9px] text-muted-foreground">Tendencia cgroup (últimos ~10 min)</span>
              <span className="text-[9px] font-mono text-muted-foreground">
                {data.guardian.trendPctPerHour >= 0 ? '+' : ''}{data.guardian.trendPctPerHour}%/h
              </span>
            </div>
            <TrendSparkline snapshots={data.guardian.snapshots} />
          </div>
        )}

        {/* ── Metrics ────────────────────────────────────────────── */}
        <div className="space-y-0">
          <MetricRow icon={Cpu} label="RSS" value={data.memory.rss} unit="MB" />
          <MetricRow icon={HardDrive} label="Cache Next.js" value={data.cache.nextCacheSizeMB} unit="MB" />
          <MetricRow icon={HardDrive} label="Turbopack" value={data.cache.turbopackCacheSizeMB} unit="MB" />
          <MetricRow icon={Database} label="DB" value={data.cache.dbSizeMB} unit="MB" />
          <MetricRow icon={Database} label="Backups" value={`${data.cache.backupCount} (${data.cache.backupTotalMB})`} unit="MB" />
          {data.guardian.actionsExecuted > 0 && (
            <MetricRow icon={Shield} label="Acciones auto" value={data.guardian.actionsExecuted} unit="" warn={data.guardian.emergencyCount > 0} />
          )}
        </div>

        {/* ── Last Action ────────────────────────────────────────── */}
        {data.guardian.lastActionMessage && (
          <div className="text-[10px] px-2 py-1.5 rounded bg-muted/50 text-muted-foreground">
            <span className="font-medium">Última auto-acción:</span>{' '}
            {data.guardian.lastActionMessage}
            {data.guardian.lastActionTime && (
              <span className="ml-1 opacity-60">
                ({new Date(data.guardian.lastActionTime).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })})
              </span>
            )}
          </div>
        )}

        {/* ── Backup Diferencial por Dominio ──────────────────────────── */}
        {(data.backup?.config || data.backup?.operacional) && (
          <div className="px-2 py-1.5 rounded-md bg-muted/30 border border-border/50">
            <p className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Save className="h-3 w-3" />
              Backup Diferencial
            </p>
            <div className="space-y-1">
              {data.backup.config && (
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-muted-foreground">CONFIG <span className="text-muted-foreground/60">(24h)</span></span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400">
                    {data.backup.config.tamanio}
                    <span className="text-muted-foreground/60 ml-1">
                      {new Date(data.backup.config.fecha).toLocaleString('es-BO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </span>
                </div>
              )}
              {data.backup.operacional && (
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-muted-foreground">OPERACIONAL <span className="text-muted-foreground/60">(7d)</span></span>
                  <span className="font-mono text-blue-600 dark:text-blue-400">
                    {data.backup.operacional.tamanio}
                    <span className="text-muted-foreground/60 ml-1">
                      {new Date(data.backup.operacional.fecha).toLocaleString('es-BO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Purge result toast ─────────────────────────────────── */}
        {purgeResult && (
          <div className={`text-[10px] px-2 py-1.5 rounded ${purgeResult.exito ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'}`}>
            {purgeResult.exito
              ? `Liberado: ${purgeResult.totalLiberado}${purgeResult.nota ? '. ' + purgeResult.nota : ''}`
              : 'Error en purga'}
          </div>
        )}

        {/* ── Actions ────────────────────────────────────────────── */}
        <div className="flex gap-1.5 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-[10px] px-2"
            disabled={purging}
            onClick={() => handlePurge('drop_cache')}
          >
            <Zap className="h-3 w-3 mr-1" />
            Page Cache
          </Button>
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

        {/* ── Uptime footer ──────────────────────────────────────── */}
        <div className="text-[9px] text-muted-foreground text-right flex items-center justify-between">
          <span>Guardian: {data.guardian.active ? 'ACTIVO' : 'INACTIVO'} · {data.guardian.currentPct}% cgroup</span>
          <span>Uptime: {data.uptime.formatted}</span>
        </div>
      </CardContent>
    </Card>
  )
}
