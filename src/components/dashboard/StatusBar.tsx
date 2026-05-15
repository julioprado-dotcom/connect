'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, Wrench, RefreshCw, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { OrbGlow, type OrbStatus } from './status-bar/OrbGlow';

// ═══════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════

interface StatusData {
  captura: {
    hoy: number;
    promedioDiario: number;
    sinCapturaHoras: number | null;
    fuentes: Array<{
      id: string;
      nombre: string;
      estado: string;
      ultimaCaptura: string;
      mencionesSemana: number;
    }>;
  };
  clasificacion: {
    total: number;
    clasificadas: number;
    porcentaje: number;
    lentes: Array<{
      nombre: string;
      total: number;
      clasificadas: number;
      porcentaje: number;
    }>;
    pendientes: number;
  };
  produccion: {
    semana: Array<{
      nombre: string;
      tipo: string;
      estado: string;
      ultimaEdicion: string | null;
      mencionesUsadas: number;
      total: number;
    }>;
  };
  distribucion: {
    ultimos: Array<{
      id: string;
      producto: string;
      destinatario: string;
      canal: string;
      timestamp: string;
      estado: string;
      error?: string;
    }>;
    errores: number;
  };
}

type ExpandedPanel = 'captura' | 'clasificacion' | 'produccion' | 'distribucion' | null;

// ═══════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════

function getCapturaStatus(data: StatusData['captura']): { status: OrbStatus; value: number; problem?: string } {
  const { hoy, promedioDiario, sinCapturaHoras } = data;
  if (sinCapturaHoras !== null && sinCapturaHoras >= 6) {
    return { status: 'error', value: hoy, problem: `Sin captura hace ${sinCapturaHoras}h` };
  }
  if (hoy >= promedioDiario && promedioDiario > 0) {
    return { status: 'ok', value: hoy };
  }
  if (hoy === 0) {
    return { status: 'error', value: hoy, problem: 'Sin menciones hoy' };
  }
  return { status: 'warning', value: hoy, problem: `Debajo del promedio (${promedioDiario}/dia)` };
}

function getClasificacionStatus(data: StatusData['clasificacion']): { status: OrbStatus; value: number; problem?: string } {
  if (data.porcentaje > 90) return { status: 'ok', value: data.porcentaje };
  if (data.porcentaje >= 70) return { status: 'warning', value: data.porcentaje, problem: `${data.pendientes} menciones sin clasificar` };
  return { status: 'error', value: data.porcentaje, problem: `${data.pendientes} pendientes (${data.porcentaje}%)` };
}

function getProduccionStatus(data: StatusData['produccion']): { status: OrbStatus; value: string; problem?: string } {
  const total = data.semana.length;
  const ok = data.semana.filter(p => p.estado === 'ok').length;
  const failed = data.semana.filter(p => p.estado === 'error').length;
  const pending = data.semana.filter(p => p.estado === 'pending').length;

  if (failed > 0) return { status: 'error', value: `${ok}/${total}`, problem: `${failed} producto(s) fallidos` };
  if (pending > 0) return { status: 'warning', value: `${ok}/${total}`, problem: `${pending} pendiente(s)` };
  if (total === 0) return { status: 'warning', value: '0/0', problem: 'Sin produccion esta semana' };
  return { status: 'ok', value: `${ok}/${total}` };
}

function getDistribucionStatus(data: StatusData['distribucion']): { status: OrbStatus; value: string; problem?: string } {
  if (data.errores > 0) return { status: 'error', value: `${data.errores}`, problem: `${data.errores} entrega(s) fallida(s)` };
  return { status: 'ok', value: 'OK' };
}

function formatTimeBolivia(): string {
  const now = new Date();
  return now.toLocaleTimeString('es-BO', {
    timeZone: 'America/La_Paz',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function formatDateTimeBolivia(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('es-BO', {
    timeZone: 'America/La_Paz',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatRelativeTime(iso: string): string {
  const now = Date.now();
  const ms = now - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'ahora';
  if (mins < 60) return `hace ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `hace ${days}d`;
}

function estadoColor(estado: string): string {
  switch (estado) {
    case 'ok': case 'enviado': return '#00ff88';
    case 'warning': case 'pendiente': case 'pending': return '#ffaa00';
    case 'error': case 'fallido': case 'inactivo': return '#ff3355';
    default: return '#ffaa00';
  }
}

function estadoIcon(estado: string) {
  if (estado === 'ok' || estado === 'enviado') return <CheckCircle className="w-3 h-3" style={{ color: '#00ff88' }} />;
  if (estado === 'error' || estado === 'fallido' || estado === 'inactivo') return <XCircle className="w-3 h-3" style={{ color: '#ff3355' }} />;
  return <AlertTriangle className="w-3 h-3" style={{ color: '#ffaa00' }} />;
}

// ═══════════════════════════════════════════════════════════
// Panel animation variants
// ═══════════════════════════════════════════════════════════

const panelVariants = {
  collapsed: {
    height: 0,
    opacity: 0,
    transition: { duration: 0.25, ease: 'easeInOut' },
  },
  expanded: {
    height: 200,
    opacity: 1,
    transition: { duration: 0.3, ease: 'easeOut' },
  },
};

// ═══════════════════════════════════════════════════════════
// StatusBar Component
// ═══════════════════════════════════════════════════════════

export function StatusBar() {
  const [data, setData] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<ExpandedPanel>(null);
  const [timestamp, setTimestamp] = useState(formatTimeBolivia());
  const panelRef = useRef<HTMLDivElement>(null);

  // Live clock
  useEffect(() => {
    const interval = setInterval(() => {
      setTimestamp(formatTimeBolivia());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch data
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    async function load() {
      try {
        const res = await fetch('/api/dashboard/status');
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch (err) {
        console.error('[StatusBar] Fetch error:', err);
      } finally {
        setLoading(false);
      }
    }

    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  // Click outside to collapse
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setExpanded(null);
      }
    }
    if (expanded) {
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }
  }, [expanded]);

  // Status derivations
  const captura = data ? getCapturaStatus(data.captura) : { status: 'ok' as OrbStatus, value: 0 };
  const clasif = data ? getClasificacionStatus(data.clasificacion) : { status: 'ok' as OrbStatus, value: 0 };
  const prod = data ? getProduccionStatus(data.produccion) : { status: 'ok' as OrbStatus, value: '--' };
  const dist = data ? getDistribucionStatus(data.distribucion) : { status: 'ok' as OrbStatus, value: 'OK' };

  const toggle = (panel: ExpandedPanel) => {
    setExpanded(prev => prev === panel ? null : panel);
  };

  return (
    <div
      ref={panelRef}
      className="relative w-full"
      style={{ backgroundColor: '#080c14' }}
    >
      {/* ── Main bar ── */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-2 max-h-[80px] border-b" style={{ borderColor: '#1a2744' }}>
        {/* Orbs */}
        <div className="flex items-center gap-4 sm:gap-8 overflow-x-auto no-scrollbar">
          {/* CAPTURA */}
          <OrbGlow
            status={captura.status}
            label="CAPTURA"
            value={captura.value}
            pulseError={captura.status === 'error'}
            onClick={() => toggle('captura')}
          />
          {/* CLASIFICACION */}
          <OrbGlow
            status={clasif.status}
            label="CLASIFICACION"
            value={clasif.value}
            pulseError={clasif.status === 'error'}
            onClick={() => toggle('clasificacion')}
          />
          {/* PRODUCCION */}
          <OrbGlow
            status={prod.status}
            label="PRODUCCION"
            value={prod.value}
            pulseError={prod.status === 'error'}
            onClick={() => toggle('produccion')}
          />
          {/* DISTRIBUCION */}
          <OrbGlow
            status={dist.status}
            label="DISTRIBUCION"
            value={dist.value}
            pulseError={dist.status === 'error'}
            onClick={() => toggle('distribucion')}
          />
        </div>

        {/* Right: timestamp */}
        <div className="hidden sm:flex flex-col items-end shrink-0 ml-4">
          <span
            className="text-xs text-gray-500 font-mono tabular-nums tracking-wide"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            {timestamp}
          </span>
          <span className="text-[9px] text-gray-600">
            America/La_Paz
          </span>
        </div>
      </div>

      {/* ── Actions bar (problem text + buttons) ── */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-1 min-h-[28px] border-b" style={{ borderColor: '#1a2744' }}>
        <div className="flex items-center gap-3 overflow-x-auto no-scrollbar">
          {captura.problem && (
            <span className="text-[11px] whitespace-nowrap" style={{ color: estadoColor(captura.status) }}>
              <AlertTriangle className="w-3 h-3 inline mr-1 -mt-px" />
              {captura.problem}
              <button className="ml-2 inline-flex items-center justify-center w-6 h-6 rounded hover:bg-white/5 transition-colors" title="Ver detalle">
                <Eye className="w-3.5 h-3.5" style={{ color: estadoColor(captura.status) }} />
              </button>
              <button className="ml-1 inline-flex items-center justify-center w-6 h-6 rounded hover:bg-white/5 transition-colors" title="Forzar captura">
                <Wrench className="w-3.5 h-3.5" style={{ color: estadoColor(captura.status) }} />
              </button>
            </span>
          )}
          {clasif.problem && (
            <span className="text-[11px] whitespace-nowrap" style={{ color: estadoColor(clasif.status) }}>
              <AlertTriangle className="w-3 h-3 inline mr-1 -mt-px" />
              {clasif.problem}
              <button className="ml-2 inline-flex items-center justify-center w-6 h-6 rounded hover:bg-white/5 transition-colors" title="Ver pendientes">
                <Eye className="w-3.5 h-3.5" style={{ color: estadoColor(clasif.status) }} />
              </button>
              <button className="ml-1 inline-flex items-center justify-center w-6 h-6 rounded hover:bg-white/5 transition-colors" title="Reclasificar">
                <Wrench className="w-3.5 h-3.5" style={{ color: estadoColor(clasif.status) }} />
              </button>
            </span>
          )}
          {prod.problem && (
            <span className="text-[11px] whitespace-nowrap" style={{ color: estadoColor(prod.status) }}>
              <AlertTriangle className="w-3 h-3 inline mr-1 -mt-px" />
              {prod.problem}
              <button className="ml-2 inline-flex items-center justify-center w-6 h-6 rounded hover:bg-white/5 transition-colors" title="Ver productos">
                <Eye className="w-3.5 h-3.5" style={{ color: estadoColor(prod.status) }} />
              </button>
              <button className="ml-1 inline-flex items-center justify-center w-6 h-6 rounded hover:bg-white/5 transition-colors" title="Generar">
                <Wrench className="w-3.5 h-3.5" style={{ color: estadoColor(prod.status) }} />
              </button>
            </span>
          )}
          {dist.problem && (
            <span className="text-[11px] whitespace-nowrap" style={{ color: estadoColor(dist.status) }}>
              <AlertTriangle className="w-3 h-3 inline mr-1 -mt-px" />
              {dist.problem}
              <button className="ml-2 inline-flex items-center justify-center w-6 h-6 rounded hover:bg-white/5 transition-colors" title="Ver entregas">
                <Eye className="w-3.5 h-3.5" style={{ color: estadoColor(dist.status) }} />
              </button>
              <button className="ml-1 inline-flex items-center justify-center w-6 h-6 rounded hover:bg-white/5 transition-colors" title="Reintentar">
                <Wrench className="w-3.5 h-3.5" style={{ color: estadoColor(dist.status) }} />
              </button>
            </span>
          )}
          {!captura.problem && !clasif.problem && !prod.problem && !dist.problem && data && (
            <span className="text-[11px] text-gray-500 flex items-center gap-1.5">
              <CheckCircle className="w-3 h-3" style={{ color: '#00ff88' }} />
              Todos los sistemas operativos
            </span>
          )}
          {loading && !data && (
            <span className="text-[11px] text-gray-500 animate-pulse">Cargando indicadores...</span>
          )}
        </div>
      </div>

      {/* ── Expandable panels ── */}
      <AnimatePresence>
        {expanded && data && (
          <motion.div
            initial="collapsed"
            animate="expanded"
            exit="collapsed"
            variants={panelVariants}
            className="overflow-hidden border-b"
            style={{ borderColor: '#1a2744', backgroundColor: '#080c14' }}
          >
            {/* CAPTURA expanded */}
            {expanded === 'captura' && (
              <div className="h-[200px] overflow-hidden flex flex-col">
                <div className="flex items-center justify-between px-4 sm:px-6 py-1.5 shrink-0">
                  <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                    Fuentes ({data.captura.fuentes.length})
                  </span>
                  <button className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors">
                    Ver todas
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto px-4 sm:px-6 custom-scrollbar">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="text-gray-500 border-b" style={{ borderColor: '#1a2744' }}>
                        <th className="text-left py-1 font-medium">Fuente</th>
                        <th className="text-left py-1 font-medium w-24">Estado</th>
                        <th className="text-right py-1 font-medium w-20">Semana</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.captura.fuentes.slice(0, 20).map(f => (
                        <tr key={f.id} className="border-b" style={{ borderColor: '#1a274422' }}>
                          <td className="py-1.5 text-gray-300 truncate max-w-[200px]" title={f.nombre}>
                            {f.nombre}
                          </td>
                          <td className="py-1.5">
                            <span className="flex items-center gap-1.5">
                              {estadoIcon(f.estado)}
                              <span style={{ color: estadoColor(f.estado) }}>{f.ultimaCaptura}</span>
                            </span>
                          </td>
                          <td className="py-1.5 text-right text-gray-400" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                            {f.mencionesSemana}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* CLASIFICACION expanded */}
            {expanded === 'clasificacion' && (
              <div className="h-[200px] overflow-hidden flex flex-col">
                <div className="flex items-center justify-between px-4 sm:px-6 py-1.5 shrink-0">
                  <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                    Lentes ({data.clasificacion.lentes.length})
                  </span>
                  <span className="text-[10px] text-gray-500">
                    {data.clasificacion.pendientes} pendientes
                  </span>
                </div>
                <div className="flex-1 overflow-y-auto px-4 sm:px-6 custom-scrollbar">
                  {/* Mini horizontal bars for each lente */}
                  <div className="space-y-2 pb-2">
                    {data.clasificacion.lentes.map(l => {
                      const barColor = l.porcentaje > 90 ? '#00ff88' : l.porcentaje >= 70 ? '#ffaa00' : '#ff3355';
                      return (
                        <div key={l.nombre} className="flex items-center gap-2">
                          <span className="text-[11px] text-gray-400 w-28 truncate shrink-0">{l.nombre}</span>
                          <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: '#1a2744' }}>
                            <motion.div
                              className="h-full rounded-full"
                              style={{ backgroundColor: barColor, opacity: 0.8 }}
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.min(l.porcentaje, 100)}%` }}
                              transition={{ duration: 0.5, ease: 'easeOut' }}
                            />
                          </div>
                          <span
                            className="text-[11px] font-mono w-10 text-right shrink-0"
                            style={{ fontFamily: "'JetBrains Mono', monospace", color: barColor }}
                          >
                            {l.porcentaje}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  {/* Pending mentions info */}
                  {data.clasificacion.pendientes > 0 && (
                    <div className="mt-2 pt-2 border-t flex items-center justify-between" style={{ borderColor: '#1a2744' }}>
                      <span className="text-[11px] text-gray-500">
                        {data.clasificacion.pendientes} menciones sin tratamiento periodistico
                      </span>
                      <button className="text-[10px] px-2 py-1 rounded text-gray-300 hover:bg-white/5 transition-colors" style={{ border: '1px solid #1a2744' }}>
                        Asignar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* PRODUCCION expanded */}
            {expanded === 'produccion' && (
              <div className="h-[200px] overflow-hidden flex flex-col">
                <div className="flex items-center justify-between px-4 sm:px-6 py-1.5 shrink-0">
                  <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                    Productos Semana
                  </span>
                </div>
                <div className="flex-1 overflow-y-auto px-4 sm:px-6 custom-scrollbar">
                  <div className="space-y-1">
                    {data.produccion.semana.map(p => (
                      <div key={p.tipo} className="flex items-center justify-between py-1 border-b" style={{ borderColor: '#1a274422' }}>
                        <div className="flex items-center gap-2 min-w-0">
                          {estadoIcon(p.estado)}
                          <span className="text-[11px] text-gray-300 truncate">{p.nombre}</span>
                          {p.total > 0 && (
                            <span className="text-[9px] text-gray-500">({p.total})</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {p.ultimaEdicion && (
                            <span className="text-[10px] text-gray-500">
                              {formatDateTimeBolivia(p.ultimaEdicion)}
                            </span>
                          )}
                          {(p.estado === 'pending' || p.estado === 'error') && (
                            <button className="text-[9px] px-1.5 py-0.5 rounded text-gray-300 hover:bg-white/5 transition-colors flex items-center gap-1" style={{ border: '1px solid #1a2744' }}>
                              <RefreshCw className="w-2.5 h-2.5" />
                              Generar
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* DISTRIBUCION expanded */}
            {expanded === 'distribucion' && (
              <div className="h-[200px] overflow-hidden flex flex-col">
                <div className="flex items-center justify-between px-4 sm:px-6 py-1.5 shrink-0">
                  <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                    Ultimas Entregas
                  </span>
                  {data.distribucion.errores > 0 && (
                    <span className="text-[10px] flex items-center gap-1" style={{ color: '#ff3355' }}>
                      <XCircle className="w-3 h-3" />
                      {data.distribucion.errores} error(es)
                    </span>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto px-4 sm:px-6 custom-scrollbar">
                  <div className="space-y-1">
                    {data.distribucion.ultimos.map(e => (
                      <div key={e.id} className="flex items-center justify-between py-1.5 border-b" style={{ borderColor: '#1a274422' }}>
                        <div className="flex items-center gap-2 min-w-0">
                          {estadoIcon(e.estado)}
                          <div className="min-w-0">
                            <span className="text-[11px] text-gray-300 block truncate">{e.producto}</span>
                            <span className="text-[9px] text-gray-500">
                              {e.destinatario} &middot; {e.canal}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] text-gray-500">{formatRelativeTime(e.timestamp)}</span>
                          {e.estado === 'fallido' && (
                            <div className="flex items-center gap-1">
                              <button className="text-[9px] px-1.5 py-0.5 rounded text-gray-300 hover:bg-white/5 transition-colors flex items-center gap-1" style={{ border: '1px solid #1a2744' }} title={e.error}>
                                <Wrench className="w-2.5 h-2.5" />
                                Diagnosticar
                              </button>
                              <button className="text-[9px] px-1.5 py-0.5 rounded text-gray-300 hover:bg-white/5 transition-colors flex items-center gap-1" style={{ border: '1px solid #1a2744' }}>
                                <RefreshCw className="w-2.5 h-2.5" />
                                Reintentar
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    {data.distribucion.ultimos.length === 0 && (
                      <div className="text-[11px] text-gray-500 py-4 text-center">
                        Sin entregas registradas
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default StatusBar;
