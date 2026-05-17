'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { fetchWithTimeout } from '@/lib/fetch-utils';
import { PanelShell } from './VitalMonitor';
import { FileText, TrendingUp, Clock, Loader2 } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

interface ProductoSummary {
  total: number;
  hoy: number;
  semana: number;
  tipos?: Record<string, number>;
}

interface ProduccionData {
  productos?: ProductoSummary;
  status?: string;
  recientes?: Array<{
    id: string;
    tipo: string;
    titulo: string;
    fechaCreacion: string;
    estado: string;
  }>;
}

// ═══════════════════════════════════════════════════════════════
// ProduccionView — Resumen de produccion de contenidos
// ═══════════════════════════════════════════════════════════════

export function ProduccionView() {
  const [data, setData] = useState<ProduccionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      // Fetch summary data
      const [summaryRes, productosRes] = await Promise.all([
        fetchWithTimeout('/api/dashboard/indicadores-summary', { timeoutMs: 8000 }),
        fetchWithTimeout('/api/productos?limit=10&orderBy=fechaCreacion&orderDir=desc', { timeoutMs: 8000 }),
      ]);

      const summary = summaryRes.ok ? await summaryRes.json() : null;
      const productos = productosRes.ok ? await productosRes.json() : null;

      setData({
        productos: summary?.produccion?.productos,
        status: summary?.produccion?.status,
        recientes: productos?.productos || productos || [],
      });
      setError(null);
    } catch {
      setError('Error de conexion');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const prod = data?.productos;
  const recientes = data?.recientes as Array<Record<string, unknown>> | undefined;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
      {/* Left: Stats */}
      <div className="lg:col-span-5">
        <PanelShell title="Produccion" icon={<FileText className="w-4 h-4" />}>
          {loading ? (
            <div className="flex items-center gap-2 py-8 text-slate-600 text-xs font-mono justify-center">
              <Loader2 className="w-4 h-4 animate-spin" />
              Cargando datos de produccion...
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 py-4 text-red-400/70 text-xs font-mono">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              {error}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Status */}
              <div className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{
                    backgroundColor: prod?.status === 'ok' ? '#10b981' : '#64748b',
                    boxShadow: prod?.status === 'ok' ? '0 0 8px rgba(16,185,129,0.4)' : 'none',
                  }}
                />
                <span className="text-[10px] font-bold uppercase font-mono text-slate-500">
                  Motor de Produccion
                </span>
              </div>

              {/* KPIs */}
              <div className="grid grid-cols-3 gap-3 py-3 border-y border-slate-800/60">
                <div className="text-center">
                  <p className="text-[9px] font-bold uppercase text-slate-600 font-mono">Total</p>
                  <p className="text-xl font-mono text-emerald-400 tabular-nums">
                    {prod?.total ?? 0}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-[9px] font-bold uppercase text-slate-600 font-mono">Hoy</p>
                  <p className="text-xl font-mono text-cyan-400 tabular-nums">
                    {prod?.hoy ?? 0}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-[9px] font-bold uppercase text-slate-600 font-mono">Semana</p>
                  <p className="text-xl font-mono text-amber-400 tabular-nums">
                    {prod?.semana ?? 0}
                  </p>
                </div>
              </div>

              {/* Info card */}
              <div className="px-3 py-2.5 rounded-md" style={{
                backgroundColor: 'rgba(6,182,212,0.04)',
                border: '1px solid rgba(6,182,212,0.08)',
              }}>
                <p className="text-[10px] font-mono text-slate-500 leading-relaxed">
                  La produccion incluye: boletines de prensa, fichas de analisis,
                  focos de atencion, radar de medios, saldos y reportes sectoriales.
                  Se generan automaticamente via el Planificador o manualmente.
                </p>
              </div>
            </div>
          )}
        </PanelShell>
      </div>

      {/* Right: Recent products */}
      <div className="lg:col-span-7">
        <PanelShell title="Productos Recientes" icon={<TrendingUp className="w-4 h-4" />}>
          {loading ? (
            <div className="flex items-center gap-2 py-8 text-slate-600 text-xs font-mono justify-center">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
          ) : !recientes || (Array.isArray(recientes) && recientes.length === 0) ? (
            <div className="flex flex-col items-center gap-2 py-10 text-slate-600 text-xs font-mono">
              <FileText className="w-6 h-6 text-slate-700" />
              <span>No hay productos generados aun</span>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[500px] overflow-y-auto custom-scrollbar">
              {Array.isArray(recientes) && (recientes as Array<Record<string, string>>).map((p, i) => (
                <div
                  key={(p as Record<string, unknown>).id as string || i}
                  className="rounded-md px-3 py-2.5 transition-all duration-200"
                  style={{
                    background: i === 0 ? 'rgba(6,182,212,0.04)' : 'rgba(255,255,255,0.01)',
                    border: `1px solid ${i === 0 ? 'rgba(6,182,212,0.1)' : 'rgba(255,255,255,0.03)'}`,
                  }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="text-[9px] font-bold uppercase font-mono px-1.5 py-0.5 rounded"
                      style={{
                        color: '#a78bfa',
                        backgroundColor: 'rgba(167,139,250,0.08)',
                        border: '1px solid rgba(167,139,250,0.15)',
                      }}
                    >
                      {p.tipo || 'N/A'}
                    </span>
                    {p.estado && (
                      <span
                        className="text-[9px] font-mono px-1.5 py-0.5 rounded"
                        style={{
                          color: p.estado === 'completado' ? '#10b981' : '#f59e0b',
                          backgroundColor: p.estado === 'completado' ? 'rgba(16,185,129,0.08)' : 'rgba(245,158,11,0.08)',
                        }}
                      >
                        {p.estado}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-300 font-mono leading-snug line-clamp-2">
                    {p.titulo || 'Sin titulo'}
                  </p>
                  {p.fechaCreacion && (
                    <p className="text-[9px] font-mono text-slate-700 mt-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(p.fechaCreacion).toLocaleString('es-BO', { dateStyle: 'short', timeStyle: 'short' })}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </PanelShell>
      </div>
    </div>
  );
}
