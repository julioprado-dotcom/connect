'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { fetchWithTimeout } from '@/lib/fetch-utils';
import { PanelShell } from './PanelShell';
import {
  Send,
  CheckCircle2,
  AlertTriangle,
  Users,
  Clock,
  Loader2,
  Mail,
  RefreshCw,
  MessageCircle,
  UserPlus,
  ChevronDown,
  ChevronUp,
  Wifi,
} from 'lucide-react';
import { ALL_PRODUCTS } from '@/constants/nav';

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
    tipo?: string;
    producto?: string;
    destinatario: string;
    fechaEnvio?: string;
    timestamp?: string;
    estado: string;
    canal: string;
    error?: string;
  }>;
}

type DeliveryFilter = 'todos' | 'exitosos' | 'fallidos' | 'pendientes';

type TestResult = {
  loading: boolean;
  ok: boolean;
  mensaje: string;
} | null;

type RetryState = {
  loading: boolean;
  ok: boolean;
  error: string;
} | null;

// ═══════════════════════════════════════════════════════════════
// DistribucionView — Panel de distribucion y envios
// ═══════════════════════════════════════════════════════════════

export function DistribucionView() {
  const [data, setData] = useState<DistribucionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Feature 1: Retry state per delivery id
  const [retryStates, setRetryStates] = useState<Record<string, RetryState>>({});

  // Feature 2: Test channel results
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});

  // Feature 3: Subscriber form
  const [showSubForm, setShowSubForm] = useState(false);
  const [subForm, setSubForm] = useState({
    nombre: '',
    destinatario: '',
    canal: 'email' as 'email' | 'whatsapp',
    producto: '',
  });
  const [subSubmitting, setSubSubmitting] = useState(false);
  const [subResult, setSubResult] = useState<{ ok: boolean; mensaje: string } | null>(null);

  // Feature 4: Delivery filter tabs
  const [deliveryFilter, setDeliveryFilter] = useState<DeliveryFilter>('todos');

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
        recientes: Array.isArray(distribucion?.ultimosEnvios) ? distribucion.ultimosEnvios : [],
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

  // ── Feature 1: Retry failed delivery ──────────────────────
  const handleRetry = async (envioId: string) => {
    setRetryStates(prev => ({ ...prev, [envioId]: { loading: true, ok: false, error: '' } }));
    try {
      const res = await fetchWithTimeout(
        `/api/dashboard/distribucion/envios/${envioId}/reintentar`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, timeoutMs: 12000 },
      );
      const json = await res.json();
      if (json.ok) {
        setRetryStates(prev => ({ ...prev, [envioId]: { loading: false, ok: true, error: '' } }));
        // Refresh data after short delay
        setTimeout(() => fetchData(), 1500);
      } else {
        setRetryStates(prev => ({
          ...prev,
          [envioId]: { loading: false, ok: false, error: json.mensaje || 'Error al reintentar' },
        }));
      }
    } catch {
      setRetryStates(prev => ({
        ...prev,
        [envioId]: { loading: false, ok: false, error: 'Error de conexion' },
      }));
    }
  };

  // ── Feature 2: Test channel ───────────────────────────────
  const handleTestChannel = async (canal: 'email' | 'whatsapp' | 'telegram') => {
    setTestResults(prev => ({ ...prev, [canal]: { loading: true, ok: false, mensaje: '' } }));
    try {
      const res = await fetchWithTimeout(
        '/api/dashboard/distribucion/canales/testear',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ canal }),
          timeoutMs: 15000,
        },
      );
      const json = await res.json();
      setTestResults(prev => ({
        ...prev,
        [canal]: { loading: false, ok: json.conectado, mensaje: json.mensaje || (json.conectado ? 'Conectado' : 'Sin conexion') },
      }));
    } catch {
      setTestResults(prev => ({
        ...prev,
        [canal]: { loading: false, ok: false, mensaje: 'Error de conexion' },
      }));
    }
  };

  // ── Feature 3: Add subscriber ─────────────────────────────
  const handleSubmitSubscriber = async () => {
    if (!subForm.destinatario.trim()) return;
    setSubSubmitting(true);
    setSubResult(null);
    try {
      const body: Record<string, string> = {
        canal: subForm.canal,
        destinatario: subForm.destinatario.trim(),
      };
      if (subForm.nombre.trim()) body.nombre = subForm.nombre.trim();
      if (subForm.producto) body.producto = subForm.producto;

      const res = await fetchWithTimeout(
        '/api/dashboard/distribucion/suscriptores/nueva',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          timeoutMs: 10000,
        },
      );
      const json = await res.json();
      if (json.ok) {
        setSubResult({ ok: true, mensaje: json.mensaje || 'Suscriptor agregado' });
        setSubForm({ nombre: '', destinatario: '', canal: 'email', producto: '' });
        fetchData();
      } else {
        setSubResult({ ok: false, mensaje: json.mensaje || 'Error al agregar suscriptor' });
      }
    } catch {
      setSubResult({ ok: false, mensaje: 'Error de conexion' });
    } finally {
      setSubSubmitting(false);
    }
  };

  // ── Computed values ───────────────────────────────────────
  const envios = data?.envios;
  const tasaExito = envios && envios.total > 0
    ? Math.round((envios.exitosos / envios.total) * 100)
    : 0;
  const tasaFallo = envios && envios.total > 0
    ? Math.round((envios.fallidos / envios.total) * 100)
    : 0;
  const recientes = data?.recientes;

  // ── Feature 4: Filtered deliveries ────────────────────────
  const filteredDeliveries = recientes && Array.isArray(recientes)
    ? recientes.filter(e => {
        if (deliveryFilter === 'todos') return true;
        if (deliveryFilter === 'exitosos') return e.estado === 'entregado' || e.estado === 'exitoso';
        if (deliveryFilter === 'fallidos') return e.estado === 'fallido';
        if (deliveryFilter === 'pendientes') return e.estado === 'pendiente' || e.estado === 'en cola';
        return true;
      })
    : [];

  // ── Shared styles ─────────────────────────────────────────
  const filterTabs: { key: DeliveryFilter; label: string }[] = [
    { key: 'todos', label: 'Todos' },
    { key: 'exitosos', label: 'Exitosos' },
    { key: 'fallidos', label: 'Fallidos' },
    { key: 'pendientes', label: 'Pendientes' },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
      {/* ═══ Left: Stats + Test Canales + Add Subscriber ═══ */}
      <div className="lg:col-span-5 space-y-4 sm:space-y-6">
        {/* Main stats panel */}
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

        {/* ═══ Feature 2: TEST CANALES ═══ */}
        <PanelShell title="Test Canales" icon={<Wifi className="w-4 h-4" />}>
          <div className="space-y-3">
            <p className="text-[10px] font-mono text-slate-600 leading-relaxed">
              Verifica la conectividad de cada canal de distribucion antes de enviar.
            </p>
            <div className="flex flex-col gap-2">
              {([
                { canal: 'email' as const, label: 'Email / SMTP', Icon: Mail, accentColor: '#06b6d4' },
                { canal: 'whatsapp' as const, label: 'WhatsApp', Icon: MessageCircle, accentColor: '#10b981' },
                { canal: 'telegram' as const, label: 'Telegram', Icon: Send, accentColor: '#a78bfa' },
              ]).map(({ canal, label, Icon, accentColor }) => {
                const result = testResults[canal];
                return (
                  <div
                    key={canal}
                    className="rounded-md px-3 py-2.5 transition-all duration-200"
                    style={{
                      backgroundColor: 'rgba(255,255,255,0.01)',
                      border: '1px solid rgba(255,255,255,0.03)',
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="w-3.5 h-3.5" style={{ color: accentColor }} />
                      <span className="text-[11px] font-mono text-slate-400 flex-1">{label}</span>
                      <button
                        onClick={() => handleTestChannel(canal)}
                        disabled={result?.loading}
                        className="text-[9px] font-bold uppercase font-mono px-2.5 py-1 rounded transition-all duration-200 disabled:opacity-40"
                        style={{
                          color: accentColor,
                          backgroundColor: `${accentColor}10`,
                          border: `1px solid ${accentColor}20`,
                        }}
                      >
                        {result?.loading ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          'TEST'
                        )}
                      </button>
                    </div>
                    {/* Test result inline */}
                    {result && !result.loading && (
                      <div className="flex items-center gap-1.5 mt-1.5 ml-6">
                        {result.ok ? (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                            <span className="text-[9px] font-mono text-emerald-400">{result.mensaje}</span>
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="w-3 h-3 text-red-400" />
                            <span className="text-[9px] font-mono text-red-400">{result.mensaje}</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </PanelShell>

        {/* ═══ Feature 3: ADD SUBSCRIBER ═══ */}
        <PanelShell
          title="Agregar Suscriptor"
          icon={<UserPlus className="w-4 h-4" />}
        >
          {/* Toggle */}
          <button
            onClick={() => setShowSubForm(prev => !prev)}
            className="w-full flex items-center justify-between rounded-md px-3 py-2.5 transition-all duration-200 text-left"
            style={{
              backgroundColor: showSubForm ? 'rgba(167,139,250,0.06)' : 'rgba(255,255,255,0.01)',
              border: `1px solid ${showSubForm ? 'rgba(167,139,250,0.12)' : 'rgba(255,255,255,0.03)'}`,
            }}
          >
            <span className="text-[11px] font-mono text-slate-400 flex items-center gap-2">
              <UserPlus className="w-3.5 h-3.5 text-violet-400/60" />
              Nuevo suscriptor
            </span>
            {showSubForm ? (
              <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
            )}
          </button>

          {/* Collapsible form */}
          {showSubForm && (
            <div className="mt-3 space-y-2.5">
              {/* Nombre */}
              <div>
                <label className="text-[9px] font-bold uppercase font-mono text-slate-600 block mb-1">
                  Nombre <span className="text-slate-700 normal-case">(opcional)</span>
                </label>
                <input
                  type="text"
                  value={subForm.nombre}
                  onChange={e => setSubForm(prev => ({ ...prev, nombre: e.target.value }))}
                  placeholder="Juan Perez"
                  className="w-full rounded-md px-3 py-2 text-[11px] font-mono text-slate-300 placeholder:text-slate-700 outline-none transition-all duration-200 focus:ring-1"
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    focusRingColor: 'rgba(167,139,250,0.3)',
                  }}
                />
              </div>

              {/* Destinatario */}
              <div>
                <label className="text-[9px] font-bold uppercase font-mono text-slate-600 block mb-1">
                  Destinatario <span className="text-red-500/60">*</span>
                </label>
                <input
                  type="text"
                  value={subForm.destinatario}
                  onChange={e => setSubForm(prev => ({ ...prev, destinatario: e.target.value }))}
                  placeholder={
                    subForm.canal === 'email'
                      ? 'correo@ejemplo.com'
                      : '+591 70000000'
                  }
                  className="w-full rounded-md px-3 py-2 text-[11px] font-mono text-slate-300 placeholder:text-slate-700 outline-none transition-all duration-200 focus:ring-1"
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}
                />
              </div>

              {/* Canal + Producto row */}
              <div className="grid grid-cols-2 gap-2">
                {/* Canal */}
                <div>
                  <label className="text-[9px] font-bold uppercase font-mono text-slate-600 block mb-1">
                    Canal <span className="text-red-500/60">*</span>
                  </label>
                  <select
                    value={subForm.canal}
                    onChange={e => setSubForm(prev => ({ ...prev, canal: e.target.value as 'email' | 'whatsapp' }))}
                    className="w-full rounded-md px-3 py-2 text-[11px] font-mono text-slate-300 outline-none transition-all duration-200 appearance-none cursor-pointer"
                    style={{
                      backgroundColor: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.06)',
                    }}
                  >
                    <option value="email" style={{ background: '#0a0a0a' }}>Email</option>
                    <option value="whatsapp" style={{ background: '#0a0a0a' }}>WhatsApp</option>
                  </select>
                </div>

                {/* Producto */}
                <div>
                  <label className="text-[9px] font-bold uppercase font-mono text-slate-600 block mb-1">
                    Producto
                  </label>
                  <select
                    value={subForm.producto}
                    onChange={e => setSubForm(prev => ({ ...prev, producto: e.target.value }))}
                    className="w-full rounded-md px-3 py-2 text-[11px] font-mono text-slate-300 outline-none transition-all duration-200 appearance-none cursor-pointer"
                    style={{
                      backgroundColor: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.06)',
                    }}
                  >
                    <option value="" style={{ background: '#0a0a0a' }}>Todos</option>
                    {ALL_PRODUCTS.map(p => (
                      <option key={p.tipo} value={p.tipo} style={{ background: '#0a0a0a' }}>
                        {p.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Submit button */}
              <button
                onClick={handleSubmitSubscriber}
                disabled={subSubmitting || !subForm.destinatario.trim()}
                className="w-full rounded-md px-3 py-2.5 text-[11px] font-bold uppercase font-mono transition-all duration-200 disabled:opacity-40 flex items-center justify-center gap-2"
                style={{
                  color: '#fff',
                  background: 'linear-gradient(135deg, rgba(167,139,250,0.2), rgba(6,182,212,0.2))',
                  border: '1px solid rgba(167,139,250,0.15)',
                }}
              >
                {subSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Agregando...
                  </>
                ) : (
                  <>
                    <UserPlus className="w-3.5 h-3.5" />
                    Agregar Suscriptor
                  </>
                )}
              </button>

              {/* Result message */}
              {subResult && (
                <div className="flex items-center gap-1.5 px-1">
                  {subResult.ok ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="text-[10px] font-mono text-emerald-400">{subResult.mensaje}</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                      <span className="text-[10px] font-mono text-red-400">{subResult.mensaje}</span>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </PanelShell>
      </div>

      {/* ═══ Right: Delivery list with filters + retry buttons ═══ */}
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
            <>
              {/* Feature 4: Filter tabs */}
              <div
                className="flex gap-1 p-1 rounded-md mb-3"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.03)',
                }}
              >
                {filterTabs.map(tab => {
                  const isActive = deliveryFilter === tab.key;
                  const count =
                    tab.key === 'todos'
                      ? recientes.length
                      : tab.key === 'exitosos'
                        ? recientes.filter(e => e.estado === 'entregado' || e.estado === 'exitoso').length
                        : tab.key === 'fallidos'
                          ? recientes.filter(e => e.estado === 'fallido').length
                          : recientes.filter(e => e.estado === 'pendiente' || e.estado === 'en cola').length;

                  return (
                    <button
                      key={tab.key}
                      onClick={() => setDeliveryFilter(tab.key)}
                      className="flex-1 text-[9px] font-bold uppercase font-mono px-2 py-1.5 rounded transition-all duration-200 flex items-center justify-center gap-1.5"
                      style={{
                        color: isActive ? '#e2e8f0' : '#475569',
                        backgroundColor: isActive ? 'rgba(6,182,212,0.08)' : 'transparent',
                        border: isActive ? '1px solid rgba(6,182,212,0.15)' : '1px solid transparent',
                      }}
                    >
                      {tab.label}
                      <span
                        className="text-[8px] px-1 py-0.5 rounded-full"
                        style={{
                          color: isActive ? '#94a3b8' : '#334155',
                          backgroundColor: isActive ? 'rgba(148,163,184,0.08)' : 'rgba(51,65,85,0.1)',
                        }}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Delivery list */}
              <div className="space-y-1.5 max-h-[500px] overflow-y-auto custom-scrollbar">
                {filteredDeliveries.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-10 text-slate-600 text-xs font-mono">
                    <Clock className="w-5 h-5 text-slate-700" />
                    <span>No hay envios con filtro &quot;{deliveryFilter}&quot;</span>
                  </div>
                ) : (
                  filteredDeliveries.map((e, i) => {
                    const isFailed = e.estado === 'fallido';
                    const envioId = String(e.id ?? i);
                    const retryState = retryStates[envioId];
                    const canalLower = (e.canal || '').toLowerCase();
                    const isWhatsapp = canalLower.includes('whatsapp') || canalLower.includes('wa');
                    const isTelegram = canalLower.includes('telegram') || canalLower.includes('tg');

                    return (
                      <div
                        key={envioId}
                        className="rounded-md px-3 py-2.5 transition-all duration-200"
                        style={{
                          background: i === 0 ? 'rgba(6,182,212,0.04)' : 'rgba(255,255,255,0.01)',
                          border: `1px solid ${isFailed ? 'rgba(239,68,68,0.15)' : i === 0 ? 'rgba(6,182,212,0.1)' : 'rgba(255,255,255,0.03)'}`,
                          borderLeft: isFailed ? '3px solid rgba(239,68,68,0.5)' : undefined,
                        }}
                      >
                        {/* Top row: type badge + status + canal icon */}
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className="text-[9px] font-bold uppercase font-mono px-1.5 py-0.5 rounded"
                            style={{
                              color: isFailed ? '#f87171' : '#a78bfa',
                              backgroundColor: isFailed ? 'rgba(239,68,68,0.08)' : 'rgba(167,139,250,0.08)',
                              border: `1px solid ${isFailed ? 'rgba(239,68,68,0.15)' : 'rgba(167,139,250,0.15)'}`,
                            }}
                          >
                            {e.tipo || e.producto || 'N/A'}
                          </span>

                          {/* Status indicator */}
                          {e.estado && (
                            <span className="flex items-center gap-1 text-[9px] font-mono">
                              {e.estado === 'entregado' || e.estado === 'exitoso' ? (
                                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                              ) : e.estado === 'fallido' ? (
                                <AlertTriangle className="w-3 h-3 text-red-400" />
                              ) : (
                                <Clock className="w-3 h-3 text-amber-500" />
                              )}
                              <span style={{
                                color: e.estado === 'entregado' || e.estado === 'exitoso'
                                  ? '#10b981'
                                  : e.estado === 'fallido'
                                    ? '#f87171'
                                    : '#f59e0b',
                              }}>
                                {e.estado}
                              </span>
                            </span>
                          )}

                          {/* Canal icon */}
                          <span className="ml-auto flex items-center gap-1 text-[9px] font-mono text-slate-600">
                            {isWhatsapp ? (
                              <MessageCircle className="w-3 h-3 text-emerald-500/60" />
                            ) : isTelegram ? (
                              <Send className="w-3 h-3 text-violet-400/60" />
                            ) : (
                              <Mail className="w-3 h-3 text-cyan-400/60" />
                            )}
                            {e.canal}
                          </span>
                        </div>

                        {/* Recipient */}
                        <p className="text-[11px] text-slate-300 font-mono leading-snug">
                          {e.destinatario || 'Sin destinatario'}
                        </p>

                        {/* Date + retry row */}
                        <div className="flex items-center justify-between mt-1.5">
                          {(e.fechaEnvio || e.timestamp) ? (
                            <p className="text-[9px] font-mono text-slate-700 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(e.fechaEnvio || e.timestamp || '').toLocaleString('es-BO', { dateStyle: 'short', timeStyle: 'short' })}
                            </p>
                          ) : (
                            <span />
                          )}

                          {/* Feature 1: Retry button for failed deliveries */}
                          {isFailed && (
                            <div className="flex items-center gap-1.5">
                              {/* Retry success message */}
                              {retryState && !retryState.loading && retryState.ok && (
                                <span className="flex items-center gap-1 text-[9px] font-mono text-emerald-400">
                                  <CheckCircle2 className="w-3 h-3" />
                                  En cola
                                </span>
                              )}

                              {/* Retry error message */}
                              {retryState && !retryState.loading && !retryState.ok && retryState.error && (
                                <span className="text-[9px] font-mono text-red-400">
                                  {retryState.error}
                                </span>
                              )}

                              {/* Retry button */}
                              <button
                                onClick={() => handleRetry(envioId)}
                                disabled={retryState?.loading}
                                className="flex items-center gap-1 text-[9px] font-bold uppercase font-mono px-2 py-1 rounded transition-all duration-200 disabled:opacity-40"
                                style={{
                                  color: '#f87171',
                                  backgroundColor: 'rgba(239,68,68,0.08)',
                                  border: '1px solid rgba(239,68,68,0.15)',
                                }}
                              >
                                {retryState?.loading ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <RefreshCw className="w-3 h-3" />
                                )}
                                Reintentar
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </PanelShell>
      </div>
    </div>
  );
}
