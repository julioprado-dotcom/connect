'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Play, Square, ChevronRight, ChevronLeft, RotateCcw, CheckCircle2,
  XCircle, Loader2, AlertTriangle, Pause,
  Globe, BarChart3, Check, ListChecks,
  RefreshCw, ShieldAlert, Info,
} from 'lucide-react'
import { fetchWithTimeout } from '@/lib/fetch-utils'

// ── Types ──────────────────────────────────────────────────────────

interface FaseConfig {
  id: number
  nombre: string
  descripcion: string
  maxFuentes: number
  criterioExito: string
}

interface ScrapeResultado {
  fuenteId: string
  nombre: string
  estado: 'pendiente' | 'scrapeando' | 'completado' | 'error' | 'pausado'
  menciones: number
  error?: string
  detalle?: string
  duracionMs?: number
}

interface FaseFuente {
  id: string
  nombre: string
  nivel: string
  tipoCheck: string
  ultimoCheck: string | null
  totalCambios: number
  activo: boolean
  seleccionado: boolean
}

interface ScrapingPhaseState {
  faseActual: number
  estadoFase: 'inactivo' | 'listo' | 'ejecutando' | 'pausado' | 'detenido'
  faseConfig: FaseConfig | null
  fasesDisponibles: FaseConfig[]
  fuentesActivas: number
  fuentesTotales: number
  monitoreoActivas: number
  scrapeEnProgreso: boolean
  scrapePausado: boolean
  scrapeProgreso: { actual: number; total: number } | null
  scrapeResultados: ScrapeResultado[]
  ultimoScrapeInicio: string | null
  fuentesIncluidas: FaseFuente[]
}

// ── Component ──────────────────────────────────────────────────────

export function ScrapingPhaseControl() {
  const [state, setState] = useState<ScrapingPhaseState | null>(null)
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [seleccionando, setSeleccionando] = useState(false)
  const [fuentesSeleccionadas, setFuentesSeleccionadas] = useState<Set<string>>(new Set())

  const fetchState = useCallback(async () => {
    try {
      const res = await fetchWithTimeout('/api/scraping/phase')
      if (!res.ok) throw new Error('Error fetching phase state')
      const data = await res.json()
      setState(data)
      // Sync selección con servidor
      if (data.fuentesIncluidas) {
        setFuentesSeleccionadas(new Set(
          (data.fuentesIncluidas as FaseFuente[]).filter((f: FaseFuente) => f.seleccionado || f.activo).map((f: FaseFuente) => f.id)
        ))
      }
      setError(null)
    } catch {
      // Silencioso
    }
  }, [])

  useEffect(() => {
    fetchState()
    const interval = setInterval(fetchState, 5000)
    return () => clearInterval(interval)
  }, [fetchState])

  const accion = useCallback(async (acc: string, body: Record<string, unknown> = {}) => {
    setLoading(acc)
    setError(null)
    try {
      const res = await fetchWithTimeout('/api/scraping/phase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: acc, ...body }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Error desconocido')
      } else {
        await fetchState()
      }
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(null)
    }
  }, [fetchState])

  // Toggle selección de fuente
  const toggleFuente = useCallback((fuenteId: string) => {
    setFuentesSeleccionadas(prev => {
      const next = new Set(prev)
      if (next.has(fuenteId)) next.delete(fuenteId)
      else next.add(fuenteId)
      return next
    })
  }, [])

  // Seleccionar todas / ninguna
  const seleccionarTodas = useCallback((seleccionar: boolean) => {
    if (!state?.fuentesIncluidas) return
    if (seleccionar) {
      setFuentesSeleccionadas(new Set(state.fuentesIncluidas.map(f => f.id)))
    } else {
      setFuentesSeleccionadas(new Set())
    }
  }, [state])

  // Aplicar selección al servidor
  const aplicarSeleccion = useCallback(async () => {
    if (fuentesSeleccionadas.size === 0) {
      setError('Selecciona al menos una fuente')
      return
    }
    await accion('seleccionar_fuentes', { fuenteIds: Array.from(fuentesSeleccionadas) })
    setSeleccionando(false)
  }, [fuentesSeleccionadas, accion])

  if (!state) {
    return (
      <Card className="border-slate-200 dark:border-slate-700">
        <CardContent className="p-4 flex items-center gap-3">
          <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
          <span className="text-sm text-slate-500">Cargando control de scraping...</span>
        </CardContent>
      </Card>
    )
  }

  // Detectar errores reales: tanto por estado como por patrones en error/detalle
  const ERROR_PATTERNS = [/HTTP \d{3}/i, /fetch failed/i, /timeout/i, /forbidden/i, /empty|vacío|vacio/i, /no parseable/i, /Error:/i]
  const isRealError = (r: typeof state.scrapeResultados[0]) => {
    if (r.estado === 'error') return true
    if (r.error && ERROR_PATTERNS.some(p => p.test(r.error ?? ''))) return true
    if (r.detalle && ERROR_PATTERNS.some(p => p.test(r.detalle ?? '')) && r.menciones === 0) return true
    return false
  }
  const completados = state.scrapeResultados.filter(r => r.estado === 'completado' && !isRealError(r) && r.menciones > 0).length
  const sinCambios = state.scrapeResultados.filter(r => r.estado === 'completado' && !isRealError(r) && r.menciones === 0).length
  const errores = state.scrapeResultados.filter(r => isRealError(r)).length
  const pausados = state.scrapeResultados.filter(r => r.estado === 'pausado').length
  const totalMenciones = state.scrapeResultados.filter(r => !isRealError(r)).reduce((sum, r) => sum + r.menciones, 0)
  const progresoPct = state.scrapeProgreso
    ? Math.round((state.scrapeProgreso.actual / state.scrapeProgreso.total) * 100)
    : 0

  const isRunning = state.estadoFase === 'ejecutando'
  const isPaused = state.estadoFase === 'pausado'
  const isReady = state.estadoFase === 'listo'
  const isStopped = state.estadoFase === 'detenido'
  const isInactive = state.estadoFase === 'inactivo'

  return (
    <Card className={`border-2 transition-colors ${
      isInactive
        ? 'border-slate-200 dark:border-slate-700'
        : isRunning
          ? 'border-blue-400 dark:border-blue-500 shadow-blue-100 dark:shadow-blue-900/20'
          : isPaused
            ? 'border-amber-400 dark:border-amber-500 shadow-amber-100 dark:shadow-amber-900/20'
            : 'border-emerald-400 dark:border-emerald-500'
    }`}>
      <CardHeader className="pb-3 px-4 pt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-blue-500" />
            <CardTitle className="text-sm font-semibold">Control de Scraping</CardTitle>
            {state.faseActual > 0 && (
              <Badge variant="outline" className="text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800">
                Fase {state.faseActual}: {state.faseConfig?.nombre}
              </Badge>
            )}
            {isRunning && (
              <Badge variant="outline" className="text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800 animate-pulse">
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                Ejecutando
              </Badge>
            )}
            {isPaused && (
              <Badge variant="outline" className="text-xs font-medium bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800">
                <Pause className="h-3 w-3 mr-1" />
                Pausado
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)} className="h-7 px-2 text-xs">
              {expanded ? 'Compactar' : 'Expandir'}
            </Button>
            <span className="text-[10px] text-slate-400">
              {state.faseActual > 0 ? `${state.fuentesActivas}/${state.fuentesTotales} fuentes` : `${state.fuentesTotales} disponibles`}
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-4 space-y-3">
        {/* ── Error ──────────────────────────── */}
        {error && (
          <div className="flex items-start gap-2 p-2 bg-red-50 dark:bg-red-900/20 rounded-md text-xs text-red-700 dark:text-red-300">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            BARRA DE CONTROL PRINCIPAL (siempre visible)
        ══════════════════════════════════════════════════════ */}
        <div className="flex items-center gap-1.5 flex-wrap">

          {/* ── INACTIVO: Solo botón de iniciar fases ── */}
          {isInactive && (
            <div className="flex items-center gap-1.5">
              {state.fasesDisponibles.map((fase) => (
                <Button
                  key={fase.id}
                  size="sm"
                  onClick={() => accion('iniciar_fase', { faseId: fase.id })}
                  disabled={loading === 'iniciar_fase'}
                  className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {loading === 'iniciar_fase' ? (
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  ) : (
                    <Play className="h-3 w-3 mr-1" />
                  )}
                  Fase {fase.id}
                </Button>
              ))}
            </div>
          )}

          {/* ── LISTO / DETENIDO: Ejecutar + Navegar + Reset ── */}
          {(isReady || isStopped) && (
            <>
              <Button
                size="sm"
                onClick={() => accion('ejecutar')}
                disabled={loading === 'ejecutar'}
                className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {loading === 'ejecutar' ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <Play className="h-3 w-3 mr-1" />
                )}
                Ejecutar
              </Button>

              {/* Navegación de fases */}
              <div className="flex items-center gap-0.5 border-l border-slate-200 dark:border-slate-600 pl-1.5 ml-0.5">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => accion('retroceder_fase')}
                  disabled={state.faseActual <= 1 || loading === 'retroceder_fase'}
                  className="h-8 px-2 text-xs text-slate-600 dark:text-slate-300"
                  title="Fase anterior"
                >
                  <ChevronLeft className="h-3.5 w-3.5 mr-0.5" />
                  {state.faseActual > 1 ? `${state.faseActual - 1}` : '—'}
                </Button>
                <span className="text-xs font-medium text-slate-500 px-1">
                  Fase {state.faseActual}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => accion('avanzar_fase')}
                  disabled={state.faseActual >= 3 || loading === 'avanzar_fase'}
                  className="h-8 px-2 text-xs text-slate-600 dark:text-slate-300"
                  title="Siguiente fase"
                >
                  {state.faseActual < 3 ? `${state.faseActual + 1}` : '—'}
                  <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
                </Button>
              </div>

              {/* Seleccionar medios */}
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSeleccionando(true)}
                className="h-8 px-2.5 text-xs"
              >
                <ListChecks className="h-3 w-3 mr-1" />
                Medios
              </Button>

              {/* Reset */}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => accion('reiniciar')}
                disabled={loading === 'reiniciar'}
                className="h-8 px-2 text-xs text-red-500"
                title="Reiniciar todo"
              >
                <RotateCcw className="h-3 w-3" />
              </Button>
            </>
          )}

          {/* ── EJECUTANDO: Pausar + Detener ── */}
          {isRunning && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => accion('pausar')}
                disabled={loading === 'pausar'}
                className="h-8 px-3 text-xs border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-600 dark:text-amber-300 dark:hover:bg-amber-900/20"
              >
                {loading === 'pausar' ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <Pause className="h-3 w-3 mr-1" />
                )}
                Pausar
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => accion('detener')}
                disabled={loading === 'detener'}
                className="h-8 px-3 text-xs"
              >
                <Square className="h-3 w-3 mr-1" />
                Detener
              </Button>
            </>
          )}

          {/* ── PAUSADO: Reanudar + Detener + Navegar + Medios ── */}
          {isPaused && (
            <>
              <Button
                size="sm"
                onClick={() => accion('ejecutar')}
                disabled={loading === 'ejecutar'}
                className="h-8 px-3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {loading === 'ejecutar' ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <Play className="h-3 w-3 mr-1" />
                )}
                Reanudar
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => accion('detener')}
                disabled={loading === 'detener'}
                className="h-8 px-3 text-xs"
              >
                <Square className="h-3 w-3 mr-1" />
                Detener
              </Button>

              {/* Navegación de fases (permite cambiar mientras está pausado) */}
              <div className="flex items-center gap-0.5 border-l border-slate-200 dark:border-slate-600 pl-1.5 ml-0.5">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => accion('retroceder_fase')}
                  disabled={state.faseActual <= 1 || loading === 'retroceder_fase'}
                  className="h-8 px-2 text-xs text-slate-600 dark:text-slate-300"
                  title="Fase anterior"
                >
                  <ChevronLeft className="h-3.5 w-3.5 mr-0.5" />
                  {state.faseActual > 1 ? `${state.faseActual - 1}` : '—'}
                </Button>
                <span className="text-xs font-medium text-slate-500 px-1">
                  Fase {state.faseActual}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => accion('avanzar_fase')}
                  disabled={state.faseActual >= 3 || loading === 'avanzar_fase'}
                  className="h-8 px-2 text-xs text-slate-600 dark:text-slate-300"
                  title="Siguiente fase"
                >
                  {state.faseActual < 3 ? `${state.faseActual + 1}` : '—'}
                  <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
                </Button>
              </div>

              {/* Seleccionar medios (mientras pausado) */}
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSeleccionando(true)}
                className="h-8 px-2.5 text-xs"
              >
                <ListChecks className="h-3 w-3 mr-1" />
                Medios
              </Button>
            </>
          )}
        </div>

        {/* ── Barra de progreso ──────────────── */}
        {(isRunning || isPaused) && state.scrapeProgreso && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className={isPaused ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500'}>
                {isPaused ? '⏸ Pausado — ' : ''}
                {state.scrapeProgreso.actual}/{state.scrapeProgreso.total} fuentes
              </span>
              <span className="font-medium">{progresoPct}%</span>
            </div>
            <div className={`h-2 rounded-full overflow-hidden ${isPaused ? 'bg-amber-100 dark:bg-amber-900/40' : 'bg-slate-100 dark:bg-slate-700'}`}>
              <div
                className={`h-full rounded-full transition-all duration-500 ${isPaused ? 'bg-amber-500' : 'bg-blue-500'}`}
                style={{ width: `${progresoPct}%` }}
              />
            </div>
          </div>
        )}

        {/* ── Mini-resumen de resultados ─────── */}
        {state.scrapeResultados.length > 0 && (
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1 text-emerald-600">
              <CheckCircle2 className="h-3 w-3" /> {completados}
            </span>
            {sinCambios > 0 && completados > 0 && (
              <span className="flex items-center gap-1 text-slate-400">
                <Info className="h-3 w-3" /> {sinCambios} sin camb.
              </span>
            )}
            {pausados > 0 && (
              <span className="flex items-center gap-1 text-amber-600">
                <Pause className="h-3 w-3" /> {pausados}
              </span>
            )}
            {errores > 0 && (
              <span className="flex items-center gap-1 text-red-600">
                <XCircle className="h-3 w-3" /> {errores}
              </span>
            )}
            {totalMenciones > 0 && (
              <span className="flex items-center gap-1 text-blue-600">
                <BarChart3 className="h-3 w-3" /> {totalMenciones} menciones
              </span>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            PANEL DE SELECCIÓN DE MEDIOS (modal overlay)
        ══════════════════════════════════════════════════════ */}
        {seleccionando && (
          <div className="border border-blue-200 dark:border-blue-800 rounded-lg p-3 bg-blue-50/50 dark:bg-blue-900/10 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                Seleccionar Medios para Fase {state.faseActual}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => seleccionarTodas(true)}
                  className="h-6 px-2 text-[10px] text-blue-600"
                >
                  Todas
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => seleccionarTodas(false)}
                  className="h-6 px-2 text-[10px] text-slate-500"
                >
                  Ninguna
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSeleccionando(false)}
                  className="h-6 px-2 text-[10px] text-slate-400"
                >
                  Cerrar
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-slate-500 mb-1">
              <span>{fuentesSeleccionadas.size} seleccionadas</span>
              {state.faseConfig && (
                <span>de {state.faseConfig.maxFuentes > 0 ? state.faseConfig.maxFuentes + ' máx.' : 'sin límite'}</span>
              )}
            </div>
            <div className="max-h-36 overflow-y-auto space-y-0.5">
              {state.fuentesIncluidas.map((f) => (
                <label
                  key={f.id}
                  className={`flex items-center gap-2 py-1 px-2 rounded cursor-pointer transition-colors ${
                    fuentesSeleccionadas.has(f.id)
                      ? 'bg-blue-100 dark:bg-blue-900/30'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={fuentesSeleccionadas.has(f.id)}
                    onChange={() => toggleFuente(f.id)}
                    className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <Badge variant="outline" className="h-4 px-1 text-[9px] bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 shrink-0">
                    N{f.nivel}
                  </Badge>
                  <span className="text-[11px] text-slate-700 dark:text-slate-300 flex-1 truncate">{f.nombre}</span>
                  {f.totalCambios > 0 && (
                    <span className="text-[9px] text-emerald-500 shrink-0">{f.totalCambios}c</span>
                  )}
                </label>
              ))}
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Button
                size="sm"
                onClick={aplicarSeleccion}
                disabled={fuentesSeleccionadas.size === 0 || loading === 'seleccionar_fuentes'}
                className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white"
              >
                {loading === 'seleccionar_fuentes' ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <Check className="h-3 w-3 mr-1" />
                )}
                Aplicar ({fuentesSeleccionadas.size})
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSeleccionando(false)}
                className="h-7 text-xs text-slate-500"
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            VISTA EXPANDIDA: Resultados + Timeline
        ══════════════════════════════════════════════════════ */}
        {expanded && (
          <div className="space-y-3 border-t border-slate-100 dark:border-slate-700 pt-3">

            {/* Timeline de fases */}
            <div className="space-y-1.5">
              {state.fasesDisponibles.map((fase) => {
                const isActive = state.faseActual === fase.id
                const isPast = state.faseActual > fase.id
                return (
                  <div
                    key={fase.id}
                    className={`flex items-start gap-2.5 p-2 rounded-md transition-colors ${
                      isActive
                        ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                        : isPast
                          ? 'bg-emerald-50 dark:bg-emerald-900/10'
                          : 'bg-slate-50 dark:bg-slate-800/50'
                    }`}
                  >
                    <div className="mt-0.5">
                      {isPast ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      ) : isActive ? (
                        <div className="h-4 w-4 rounded-full bg-blue-500 flex items-center justify-center">
                          <div className={`h-1.5 w-1.5 rounded-full bg-white ${isRunning ? 'animate-pulse' : ''}`} />
                        </div>
                      ) : (
                        <div className="h-4 w-4 rounded-full border-2 border-slate-300 dark:border-slate-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className={`text-xs font-medium ${isActive ? 'text-blue-700 dark:text-blue-300' : 'text-slate-700 dark:text-slate-300'}`}>
                        Fase {fase.id}: {fase.nombre}
                      </span>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{fase.descripcion}</p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 italic">
                        Éxito: {fase.criterioExito}
                      </p>
                    </div>
                    {!isActive && state.faseActual > 0 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => accion('iniciar_fase', { faseId: fase.id })}
                        disabled={loading === 'iniciar_fase' || isRunning}
                        className="h-6 px-2 text-[10px] text-blue-600 shrink-0"
                      >
                        Ir
                      </Button>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Resultados detallados */}
            {state.scrapeResultados.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-600 dark:text-slate-300">Resultados</span>
                  <div className="flex items-center gap-2 text-[10px]">
                    <span className="text-emerald-600">{completados} OK</span>
                    {sinCambios > 0 && <span className="text-slate-400">{sinCambios} sin camb.</span>}
                    {pausados > 0 && <span className="text-amber-600">{pausados} paus.</span>}
                    {errores > 0 && <span className="text-red-600">{errores} err</span>}
                    {totalMenciones > 0 && <span className="text-blue-600">{totalMenciones} menc.</span>}
                  </div>
                </div>
                {state.scrapeResultados.map((r) => {
                  const errorFlag = isRealError(r)
                  return (
                  <div
                    key={r.fuenteId}
                    className={`py-1.5 px-2 rounded text-xs ${
                      errorFlag
                        ? 'bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30'
                        : r.estado === 'completado' && r.menciones > 0
                          ? 'bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/30'
                          : r.estado === 'scrapeando'
                            ? 'bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/30'
                            : 'bg-slate-50 dark:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        {r.estado === 'pendiente' && (
                          <div className="h-2.5 w-2.5 rounded-full border border-slate-300 shrink-0" />
                        )}
                        {r.estado === 'scrapeando' && (
                          <Loader2 className="h-3 w-3 text-blue-500 animate-spin shrink-0" />
                        )}
                        {r.estado === 'completado' && !errorFlag && r.menciones > 0 && (
                          <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                        )}
                        {r.estado === 'completado' && !errorFlag && r.menciones === 0 && (
                          <CheckCircle2 className="h-3 w-3 text-emerald-500 opacity-40 shrink-0" />
                        )}
                        {errorFlag && (
                          <XCircle className="h-3 w-3 text-red-500 shrink-0" />
                        )}
                        {r.estado === 'pausado' && (
                          <Pause className="h-3 w-3 text-amber-500 shrink-0" />
                        )}
                        <span className={`truncate ${r.estado === 'scrapeando' ? 'font-medium' : ''}`}>
                          {r.nombre}
                        </span>
                        {r.duracionMs && (
                          <span className="text-[10px] text-slate-400 shrink-0">{(r.duracionMs / 1000).toFixed(1)}s</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {r.menciones > 0 && (
                          <Badge variant="outline" className="h-4 px-1 text-[10px] bg-blue-50 text-blue-600 border-blue-200">
                            {r.menciones} menc.
                          </Badge>
                        )}
                        {!isRunning && r.estado !== 'scrapeando' && r.estado !== 'pendiente' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => accion('ejecutar_uno', { fuenteId: r.fuenteId })}
                            className="h-5 w-5 p-0"
                            title="Re-ejecutar"
                          >
                            <RotateCcw className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                    {/* Línea de detalle: error o sin cambios */}
                    {errorFlag && (r.error || r.detalle) && (
                      <div className="flex items-start gap-1 mt-0.5 pl-5">
                        {(r.error?.includes('Rotación') || r.error?.includes('FAIL') || r.detalle?.includes('Rotación')) ? (
                          <RefreshCw className="h-2.5 w-2.5 text-red-400 mt-0.5 shrink-0" />
                        ) : (
                          <ShieldAlert className="h-2.5 w-2.5 text-red-400 mt-0.5 shrink-0" />
                        )}
                        <span className="text-[10px] text-red-600 dark:text-red-400 leading-tight break-all">
                          {r.error || r.detalle}
                        </span>
                      </div>
                    )}
                    {!errorFlag && r.detalle && r.estado === 'completado' && r.menciones === 0 && (
                      <div className="flex items-start gap-1 mt-0.5 pl-5">
                        <Info className="h-2.5 w-2.5 text-slate-400 mt-0.5 shrink-0" />
                        <span className="text-[10px] text-slate-400 truncate" title={r.detalle}>
                          {r.detalle}
                        </span>
                      </div>
                    )}
                  </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

      </CardContent>
    </Card>
  )
}
