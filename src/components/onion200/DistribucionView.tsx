'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { fetchWithTimeout } from '@/lib/fetch-utils';
import { PanelShell } from './VitalMonitor';
import {
  Send,
  CheckCircle2,
  AlertTriangle,
  Users,
  Clock,
  Loader2,
  Mail,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

interface DistribucionData {
  envios?: {
    total: number;
    exitosos: number;
    fallidos: number;
  };
  status?: string;
  suscriptores?: {
    total: number;
    activos: number;
  };
  recientes?: Array<{
    id: string;
    tipo: string;
    destinatario: string;
    fechaEnvio: string;
    estado: string;
    canal: string;
  }>;
}

// ═══════════════════════════════════════════════════════════════
// DistribucionView — Panel de distribucion y envios
// ═══════════════════════════════════════════════════════════════

export function DistribucionView() {
  const [data, setData] = useState<DistribucionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [summaryRes, distribucionRes, suscriptoresRes] = await Promise.all([
        fetchWithTimeout('/api/dashboard/indicadores-summary', { timeoutMs: 8000 }),
        fetchWithTimeout('/api/dashboard/distribucion', { timeoutMs: 8000 }),
        fetchWithTimeout('/api/dashboard/suscriptores-summary', { timeoutMs: 6000 }),
      ]);

      const summary = summaryRes.ok ? await summaryRes.json() : null;
      const distribucion = distribucionRes.ok ? await distribucionRes.json() : null;
      const suscriptores = suscriptoresRes.ok ? await suscriptoresRes.json() : null;

      setData({
        envios: summary?.distribucion?.envios,
        status: summary?.distribucion?.status,
        suscriptores: suscriptores?.activos != null
          ? { total: suscriptores.total ?? 0, activos: suscriptores.activos }
          : undefined,
        recientes: distribucion?.envios || [],
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

  const envios = data?.envios;
  const tasaExito = envios && envios.total > 0
    ? Math.round((envios.exitosos / envios.total) * 100)
    : 0;
  const tasaFallo = envios && envios.total > 0
    ? Math.round((envios.fallidos / envios.total) * 100)
    : 0;
  const recientes = data?.recientes;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
      {/* Left: Stats */}
      <div className="lg:col-span-5">
        <PanelShell title="Distribucion" icon={<Send className="w-4 h-4" />}>
          {loading ? (
            <div className="flex items-center gap-2 py-8 text-slate-600 text-xs font-mono justify-center">
              <Loader2 className="w-4 h-4 animate-spin" />
              Cargando datos de distribucion...
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
                    backgroundColor: data?.status === 'ok' ? '#10b981' : '#64748b',
                    boxShadow: data?.status === 'ok' ? '0 0 8px rgba(16,185,129,0.4)' : 'none',
                  }}
                />
                <span className="text-[10px] font-bold uppercase font-mono text-slate-500">
                  Canales de Distribucion
                </span>
              </div>

              {/* Envios KPIs */}
              <div className="grid grid-cols-3 gap-3 py-3 border-y border-slate-800/60">
                <div className="text-center">
                  <p className="text-[9px] font-bold uppercase text-slate-600 font-mono">Total</p>
                  <p className="text-xl font-mono text-violet-400 tabular-nums">
                    {envios?.total ?? 0}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-[9px] font-bold uppercase text-slate-600 font-mono">Exitosos</p>
                  <p className="text-xl font-mono text-emerald-400 tabular-nums">
                    {envios?.exitosos ?? 0}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-[9px] font-bold uppercase text-slate-600 font-mono">Fallidos</p>
                  <p className="text-xl font-mono text-red-400 tabular-nums">
                    {envios?.fallidos ?? 0}
                  </p>
                </div>
              </div>

              {/* Success rate bar */}
              {(tasaExito > 0 || tasaFallo > 0) && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-mono text-slate-500">Tasa de exito</span>
                    <span className="text-[10px] font-mono text-emerald-400 tabular-nums">{tasaExito}%</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(6,182,212,0.08)' }}>
                    <div className="h-full rounded-full transition-all duration-500" style={{
                      width: `${tasaExito}%`,
                      background: 'linear-gradient(90deg, #10b981, #06b6d4)',
                    }} />
                  </div>
                </div>
              )}

              {/* Suscriptores */}
              {data?.suscriptores && (
                <div className="px-3 py-2.5 rounded-md flex items-center gap-3" style={{
                  backgroundColor: 'rgba(167,139,250,0.04)',
                  border: '1px solid rgba(167,139,250,0.08)',
                }}>
                  <Users className="w-4 h-4 text-violet-400/60" />
                  <div>
                    <p className="text-[10px] font-mono text-slate-500">
                      {data.suscriptores.activos} suscriptores activos de {data.suscriptores.total} totales
                    </p>
                  </div>
                </div>
              )}

              {/* Info */}
              <div className="px-3 py-2.5 rounded-md" style={{
                backgroundColor: 'rgba(6,182,212,0.04)',
                border: '1px solid rgba(6,182,212,0.08)',
              }}>
                <p className="text-[10px] font-mono text-slate-500 leading-relaxed">
                  La distribucion entrega productos (boletines, reportes, fichas) a los suscriptores
                  configurados. Los canales disponibles incluyen email y notificaciones push.
                </p>
              </div>
            </div>
          )}
        </PanelShell>
      </div>

      {/* Right: Recent deliveries */}
      <div className="lg:col-span-7">
        <PanelShell title="Envios Recientes" icon={<Mail className="w-4 h-4" />}>
          {loading ? (
            <div className="flex items-center gap-2 py-8 text-slate-600 text-xs font-mono justify-center">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
          ) : !recientes || (Array.isArray(recientes) && recientes.length === 0) ? (
            <div className="flex flex-col items-center gap-2 py-10 text-slate-600 text-xs font-mono">
              <Send className="w-6 h-6 text-slate-700" />
              <span>No hay envios registrados aun</span>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[500px] overflow-y-auto custom-scrollbar">
              {Array.isArray(recientes) && recientes.map((e, i) => (
                <div
                  key={(e as Record<string, unknown>).id as string || i}
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
                      {e.tipo || 'N/A'}
                    </span>
                    {e.estado && (
                      <span className="flex items-center gap-1 text-[9px] font-mono">
                        {e.estado === 'entregado' || e.estado === 'exitoso' ? (
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                        ) : (
                          <AlertTriangle className="w-3 h-3 text-amber-500" />
                        )}
                        <span style={{
                          color: e.estado === 'entregado' || e.estado === 'exitoso' ? '#10b981' : '#f59e0b',
                        }}>
                          {e.estado}
                        </span>
                      </span>
                    )}
                    {e.canal && (
                      <span className="text-[9px] font-mono text-slate-700 ml-auto">{e.canal}</span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-300 font-mono leading-snug">
                    {e.destinatario || 'Sin destinatario'}
                  </p>
                  {e.fechaEnvio && (
                    <p className="text-[9px] font-mono text-slate-700 mt-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(e.fechaEnvio).toLocaleString('es-BO', { dateStyle: 'short', timeStyle: 'short' })}
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
