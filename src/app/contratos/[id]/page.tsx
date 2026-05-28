'use client';

import { use, useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { fetchWithTimeout } from '@/lib/fetch-utils';
import { PanelShell } from '@/components/onion200/PanelShell';
import { ALL_PRODUCTS, CANAL_LABELS, FRECUENCIA_LABELS } from '@/constants/nav';
import {
  ArrowLeft,
  Pencil,
  Loader2,
  Package,
  Radio,
  Users,
  Send,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  UserCircle,
  FileCheck,
  Calendar,
  Banknote,
  Repeat,
  Truck,
  StickyNote,
  X,
  Save,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

interface ContratoDetail {
  id: string;
  clienteId: string;
  tipoProducto: string;
  mediosAsignados: string;
  ejesTematicos: string;
  parlamentarios: string;
  frecuencia: string;
  formatoEntrega: string;
  fechaInicio: string;
  fechaFin: string | null;
  montoMensual: number;
  moneda: string;
  estado: string;
  notas: string;
  fechaCreacion: string;
  fechaActualizacion: string;
  Cliente: { id: string; nombre: string; email: string; plan: string };
  productosList: string[];
  mediosList: Array<{ id: string; nombre: string; activo: boolean; tipo: string }>;
  parlamentariosList: Array<{ id: string; nombre: string; camara: string; partidoSigla: string }>;
}

interface Entrega {
  id: string;
  contratoId: string;
  tipoBoletin: string;
  contenido: string;
  fechaProgramada: string;
  fechaEnvio: string;
  estado: 'pendiente' | 'enviado' | 'fallido';
  canal: string;
  destinatarios: string;
  error: string | null;
  fechaCreacion: string;
  Contrato: { Cliente: { id: string; nombre: string; organizacion: string } };
}

interface EntregasResponse {
  entregas: Entrega[];
  total: number;
  stats: { enviadasHoy: number; fallidasHoy: number; pendientes: number };
}

// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════

function getProductInfo(tipo: string) {
  return ALL_PRODUCTS.find((p) => p.tipo === tipo);
}

const ESTADO_COLORS: Record<string, string> = {
  activo: '#10b981',
  pausado: '#f59e0b',
  vencido: '#f97316',
  cancelado: '#ef4444',
};

const ENTREGA_ESTADO_COLORS: Record<string, string> = {
  enviado: '#10b981',
  pendiente: '#f59e0b',
  fallido: '#ef4444',
};

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '---';
  return new Date(dateStr).toLocaleDateString('es-BO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '---';
  return new Date(dateStr).toLocaleDateString('es-BO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function truncateId(id: string): string {
  return id.length > 12 ? `${id.slice(0, 6)}...${id.slice(-4)}` : id;
}

// ═══════════════════════════════════════════════════════════════
// Status Badge
// ═══════════════════════════════════════════════════════════════

function StatusBadge({ estado }: { estado: string }) {
  const color = ESTADO_COLORS[estado] || '#64748b';
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider font-mono"
      style={{
        backgroundColor: `${color}15`,
        color: color,
        border: `1px solid ${color}30`,
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      {estado}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════
// Detail Row — label + value pair
// ═══════════════════════════════════════════════════════════════

function DetailRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-2">
      <span className="text-cyan-600 mt-0.5 flex-shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-600 font-mono mb-0.5">
          {label}
        </p>
        <div className="text-sm font-mono text-slate-200">{children}</div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Edit Dialog
// ═══════════════════════════════════════════════════════════════

function EditDialog({
  contrato,
  open,
  onClose,
  onSaved,
}: {
  contrato: ContratoDetail;
  open: boolean;
  onClose: () => void;
  onSaved: (updated: ContratoDetail) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  // Form is initialized from contrato props; parent passes key to reset on open
  const [form, setForm] = useState(() => ({
    tipoProducto: contrato.productosList,
    frecuencia: contrato.frecuencia,
    formatoEntrega: contrato.formatoEntrega,
    fechaInicio: contrato.fechaInicio ? contrato.fechaInicio.slice(0, 10) : '',
    fechaFin: contrato.fechaFin ? contrato.fechaFin.slice(0, 10) : '',
    montoMensual: contrato.montoMensual,
    moneda: contrato.moneda,
    estado: contrato.estado,
    notas: contrato.notas || '',
  }));

  const handleProductToggle = (tipo: string) => {
    setForm((prev) => ({
      ...prev,
      tipoProducto: prev.tipoProducto.includes(tipo)
        ? prev.tipoProducto.filter((t) => t !== tipo)
        : [...prev.tipoProducto, tipo],
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await fetchWithTimeout(`/api/contratos/${contrato.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipoProducto: form.tipoProducto,
          frecuencia: form.frecuencia,
          formatoEntrega: form.formatoEntrega,
          fechaInicio: form.fechaInicio || null,
          fechaFin: form.fechaFin || null,
          montoMensual: Number(form.montoMensual) || 0,
          moneda: form.moneda,
          estado: form.estado,
          notas: form.notas,
        }),
        timeoutMs: 15000,
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Error al guardar');
      }
      await res.json();
      // Re-fetch the full contrato to get enriched data
      const fullRes = await fetchWithTimeout(`/api/contratos/${contrato.id}`, {
        timeoutMs: 10000,
      });
      if (fullRes.ok) {
        const updated = await fullRes.json();
        onSaved(updated);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      />
      {/* Dialog */}
      <div
        className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-lg"
        style={{
          backgroundColor: '#0a0e17',
          border: '1px solid rgba(6, 182, 212, 0.15)',
          boxShadow: '0 0 40px rgba(6, 182, 212, 0.08)',
        }}
      >
        {/* Header */}
        <div
          className="sticky top-0 flex items-center justify-between px-4 py-3 z-10"
          style={{
            backgroundColor: '#0a0e17',
            borderBottom: '1px solid rgba(6, 182, 212, 0.1)',
          }}
        >
          <div>
            <h2 className="text-sm font-bold text-cyan-400 font-mono uppercase tracking-wider">
              Editar Contrato
            </h2>
            <p className="text-[10px] font-mono text-slate-600 mt-0.5">
              ID: {truncateId(contrato.id)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-slate-800/60 transition-colors"
          >
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          {/* Error */}
          {error && (
            <div
              className="rounded px-3 py-2 text-xs font-mono"
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                color: '#fca5a5',
              }}
            >
              {error}
            </div>
          )}

          {/* Productos contratados — multi-select */}
          <div>
            <label className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500 font-mono block mb-2">
              Productos Contratados
            </label>
            <div className="flex flex-wrap gap-1.5">
              {ALL_PRODUCTS.map((prod) => {
                const selected = form.tipoProducto.includes(prod.tipo);
                return (
                  <button
                    key={prod.tipo}
                    type="button"
                    onClick={() => handleProductToggle(prod.tipo)}
                    className="flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-mono transition-all"
                    style={{
                      backgroundColor: selected ? `${prod.color}20` : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${selected ? `${prod.color}40` : 'rgba(255,255,255,0.06)'}`,
                      color: selected ? prod.color : '#64748b',
                    }}
                  >
                    <prod.icon className="w-3 h-3" />
                    {prod.nombre}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Frecuencia + Formato row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500 font-mono block mb-1.5">
                Frecuencia
              </label>
              <select
                value={form.frecuencia}
                onChange={(e) => setForm((prev) => ({ ...prev, frecuencia: e.target.value }))}
                className="w-full rounded px-3 py-2 text-xs font-mono text-slate-200 outline-none"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(6, 182, 212, 0.12)',
                }}
              >
                {Object.entries(FRECUENCIA_LABELS).map(([key, label]) => (
                  <option key={key} value={key} style={{ backgroundColor: '#0a0e17' }}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500 font-mono block mb-1.5">
                Formato de Entrega
              </label>
              <select
                value={form.formatoEntrega}
                onChange={(e) => setForm((prev) => ({ ...prev, formatoEntrega: e.target.value }))}
                className="w-full rounded px-3 py-2 text-xs font-mono text-slate-200 outline-none"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(6, 182, 212, 0.12)',
                }}
              >
                {Object.entries(CANAL_LABELS).map(([key, label]) => (
                  <option key={key} value={key} style={{ backgroundColor: '#0a0e17' }}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Estado */}
          <div>
            <label className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500 font-mono block mb-1.5">
              Estado
            </label>
            <div className="flex gap-2">
              {(['activo', 'pausado', 'vencido', 'cancelado'] as const).map((est) => {
                const color = ESTADO_COLORS[est];
                const selected = form.estado === est;
                return (
                  <button
                    key={est}
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, estado: est }))}
                    className="flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider font-mono transition-all"
                    style={{
                      backgroundColor: selected ? `${color}20` : 'transparent',
                      border: `1px solid ${selected ? `${color}40` : 'rgba(255,255,255,0.06)'}`,
                      color: selected ? color : '#475569',
                    }}
                  >
                    {est}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Fechas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500 font-mono block mb-1.5">
                Fecha Inicio
              </label>
              <input
                type="date"
                value={form.fechaInicio}
                onChange={(e) => setForm((prev) => ({ ...prev, fechaInicio: e.target.value }))}
                className="w-full rounded px-3 py-2 text-xs font-mono text-slate-200 outline-none"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(6, 182, 212, 0.12)',
                  colorScheme: 'dark',
                }}
              />
            </div>
            <div>
              <label className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500 font-mono block mb-1.5">
                Fecha Fin
              </label>
              <input
                type="date"
                value={form.fechaFin}
                onChange={(e) => setForm((prev) => ({ ...prev, fechaFin: e.target.value }))}
                className="w-full rounded px-3 py-2 text-xs font-mono text-slate-200 outline-none"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(6, 182, 212, 0.12)',
                  colorScheme: 'dark',
                }}
              />
            </div>
          </div>

          {/* Monto + Moneda */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500 font-mono block mb-1.5">
                Monto Mensual
              </label>
              <input
                type="number"
                value={form.montoMensual}
                onChange={(e) => setForm((prev) => ({ ...prev, montoMensual: Number(e.target.value) }))}
                className="w-full rounded px-3 py-2 text-xs font-mono text-slate-200 outline-none"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(6, 182, 212, 0.12)',
                  colorScheme: 'dark',
                }}
              />
            </div>
            <div>
              <label className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500 font-mono block mb-1.5">
                Moneda
              </label>
              <select
                value={form.moneda}
                onChange={(e) => setForm((prev) => ({ ...prev, moneda: e.target.value }))}
                className="w-full rounded px-3 py-2 text-xs font-mono text-slate-200 outline-none"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(6, 182, 212, 0.12)',
                }}
              >
                <option value="Bs" style={{ backgroundColor: '#0a0e17' }}>Bs (Bolivianos)</option>
                <option value="USD" style={{ backgroundColor: '#0a0e17' }}>USD (Dolares)</option>
              </select>
            </div>
          </div>

          {/* Notas */}
          <div>
            <label className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500 font-mono block mb-1.5">
              Notas
            </label>
            <textarea
              value={form.notas}
              onChange={(e) => setForm((prev) => ({ ...prev, notas: e.target.value }))}
              rows={3}
              placeholder="Notas adicionales..."
              className="w-full rounded px-3 py-2 text-xs font-mono text-slate-200 outline-none resize-none"
              style={{
                backgroundColor: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(6, 182, 212, 0.12)',
              }}
            />
          </div>
        </div>

        {/* Footer */}
        <div
          className="sticky bottom-0 flex items-center justify-end gap-2 px-4 py-3"
          style={{
            backgroundColor: '#0a0e17',
            borderTop: '1px solid rgba(6, 182, 212, 0.1)',
          }}
        >
          <button
            onClick={onClose}
            className="px-4 py-2 rounded text-xs font-mono text-slate-400 transition-colors"
            style={{ border: '1px solid rgba(255,255,255,0.08)' }}
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 rounded text-xs font-mono font-bold text-cyan-950 transition-all"
            style={{
              backgroundColor: saving ? 'rgba(6, 182, 212, 0.3)' : '#06b6d4',
            }}
          >
            {saving ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Save className="w-3 h-3" />
            )}
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════

export default function DetalleContratoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [contrato, setContrato] = useState<ContratoDetail | null>(null);
  const [entregas, setEntregas] = useState<EntregasResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [editKey, setEditKey] = useState(0);

  const openEdit = () => {
    setEditKey((prev) => prev + 1);
    setEditOpen(true);
  };

  const fetchContrato = useCallback(async () => {
    try {
      const res = await fetchWithTimeout(`/api/contratos/${id}`, { timeoutMs: 10000 });
      if (!res.ok) {
        if (res.status === 404) throw new Error('Contrato no encontrado');
        throw new Error('Error al cargar el contrato');
      }
      return await res.json();
    } catch (err) {
      throw err;
    }
  }, [id]);

  const fetchEntregas = useCallback(async () => {
    try {
      const res = await fetchWithTimeout(`/api/entregas?contratoId=${id}&limit=50`, {
        timeoutMs: 12000,
      });
      if (!res.ok) throw new Error('Error al cargar entregas');
      return await res.json();
    } catch (err) {
      throw err;
    }
  }, [id]);

  useEffect(() => {
    let cancelled = false;

    Promise.all([fetchContrato(), fetchEntregas()])
      .then(([contratoData, entregasData]) => {
        if (!cancelled) {
          setContrato(contratoData);
          setEntregas(entregasData);
          setLoading(false);
          setError('');
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Error desconocido');
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [fetchContrato, fetchEntregas]);

  const handleContratoSaved = (updated: ContratoDetail) => {
    setContrato(updated);
  };

  // ─── Loading state ────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-cyan-500" />
            <span className="text-xs font-mono text-slate-500">Cargando contrato...</span>
          </div>
    );
  }

  // ─── Error state ─────────────────────────────────────────
  if (error || !contrato) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
          <div className="text-center space-y-3 max-w-md">
            <XCircle className="w-10 h-10 mx-auto text-red-500/60" />
            <p className="text-sm font-mono text-red-400">{error || 'Contrato no encontrado'}</p>
            <Link
              href="/clientes"
              className="inline-flex items-center gap-1.5 text-xs font-mono text-cyan-500 hover:text-cyan-400 transition-colors"
            >
              <ArrowLeft className="w-3 h-3" />
              Volver a Clientes
            </Link>
          </div>
    );
  }

  // ─── Compute entrega stats ───────────────────────────────
  const entregasList = entregas?.entregas || [];
  const entregasTotal = entregas?.total || 0;
  const enviadasCount = entregasList.filter((e) => e.estado === 'enviado').length;
  const fallidasCount = entregasList.filter((e) => e.estado === 'fallido').length;
  const pendientesCount = entregasList.filter((e) => e.estado === 'pendiente').length;

  // ─── Main render ─────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* ═══ HEADER BAR ═══ */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-sm font-bold text-cyan-400 font-mono uppercase tracking-wider">
              Contrato
            </h1>
            <span className="text-[10px] font-mono text-slate-600">
              {truncateId(contrato.id)}
            </span>
            <StatusBadge estado={contrato.estado} />
          </div>
          <p className="text-[10px] font-mono text-slate-600 mt-0.5 truncate">
            {contrato.Cliente?.nombre || 'Sin cliente'}
          </p>
        </div>
        <button
          onClick={openEdit}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider transition-all flex-shrink-0"
          style={{
            backgroundColor: 'rgba(6, 182, 212, 0.08)',
            border: '1px solid rgba(6, 182, 212, 0.15)',
            color: '#06b6d4',
          }}
        >
          <Pencil className="w-3 h-3" />
          <span className="hidden sm:inline">Editar</span>
        </button>
      </div>
        <div className="max-w-4xl mx-auto space-y-4">

          {/* ═══ CLIENTE INFO ═══ */}
          <PanelShell title="Cliente" icon={<UserCircle className="w-4 h-4" />}>
            <div className="flex items-center gap-4">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{
                  backgroundColor: 'rgba(6, 182, 212, 0.08)',
                  border: '1px solid rgba(6, 182, 212, 0.15)',
                }}
              >
                <UserCircle className="w-5 h-5 text-cyan-500" />
              </div>
              <div className="min-w-0 flex-1">
                <Link
                  href={`/clientes/${contrato.clienteId}`}
                  className="text-sm font-bold text-cyan-400 hover:text-cyan-300 transition-colors font-mono truncate block"
                >
                  {contrato.Cliente?.nombre || 'Sin nombre'}
                </Link>
                <p className="text-xs font-mono text-slate-500 truncate">
                  {contrato.Cliente?.email || '---'}
                </p>
                {contrato.Cliente?.plan && (
                  <span
                    className="inline-flex items-center mt-1 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider font-mono"
                    style={{
                      backgroundColor: 'rgba(6, 182, 212, 0.08)',
                      color: '#06b6d4',
                      border: '1px solid rgba(6, 182, 212, 0.12)',
                    }}
                  >
                    {contrato.Cliente.plan}
                  </span>
                )}
              </div>
            </div>
          </PanelShell>

          {/* ═══ CONTRACT DETAILS GRID ═══ */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left column */}
            <div className="space-y-4">
              {/* Productos contratados */}
              <PanelShell title="Productos Contratados" icon={<Package className="w-4 h-4" />}>
                <div className="flex flex-wrap gap-1.5">
                  {contrato.productosList && contrato.productosList.length > 0 ? (
                    contrato.productosList.map((tipo) => {
                      const prod = getProductInfo(tipo);
                      if (!prod) return null;
                      return (
                        <span
                          key={tipo}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono"
                          style={{
                            backgroundColor: `${prod.color}15`,
                            border: `1px solid ${prod.color}25`,
                            color: prod.color,
                          }}
                        >
                          <prod.icon className="w-3 h-3" />
                          {prod.nombre}
                        </span>
                      );
                    })
                  ) : (
                    <span className="text-xs font-mono text-slate-600">Sin productos</span>
                  )}
                </div>
              </PanelShell>

              {/* Frecuencia + Formato + Monto */}
              <PanelShell title="Parametros" icon={<FileCheck className="w-4 h-4" />}>
                <div>
                  <DetailRow icon={<Repeat className="w-3.5 h-3.5" />} label="Frecuencia">
                    {FRECUENCIA_LABELS[contrato.frecuencia] || contrato.frecuencia}
                  </DetailRow>
                  <div className="h-px" style={{ backgroundColor: 'rgba(6, 182, 212, 0.06)' }} />
                  <DetailRow icon={<Truck className="w-3.5 h-3.5" />} label="Formato de Entrega">
                    {CANAL_LABELS[contrato.formatoEntrega] || contrato.formatoEntrega}
                  </DetailRow>
                  <div className="h-px" style={{ backgroundColor: 'rgba(6, 182, 212, 0.06)' }} />
                  <DetailRow icon={<Banknote className="w-3.5 h-3.5" />} label="Monto Mensual">
                    <span className="text-emerald-400">
                      {contrato.montoMensual.toLocaleString('es-BO')} {contrato.moneda}
                    </span>
                  </DetailRow>
                </div>
              </PanelShell>
            </div>

            {/* Right column */}
            <div className="space-y-4">
              {/* Vigencia */}
              <PanelShell title="Vigencia" icon={<Calendar className="w-4 h-4" />}>
                <div>
                  <DetailRow icon={<Clock className="w-3.5 h-3.5" />} label="Fecha Inicio">
                    {formatDate(contrato.fechaInicio)}
                  </DetailRow>
                  <div className="h-px" style={{ backgroundColor: 'rgba(6, 182, 212, 0.06)' }} />
                  <DetailRow icon={<Clock className="w-3.5 h-3.5" />} label="Fecha Fin">
                    {contrato.fechaFin ? formatDate(contrato.fechaFin) : (
                      <span className="text-amber-400">Indefinido</span>
                    )}
                  </DetailRow>
                  <div className="h-px" style={{ backgroundColor: 'rgba(6, 182, 212, 0.06)' }} />
                  <DetailRow icon={<FileCheck className="w-3.5 h-3.5" />} label="Creado">
                    {formatDateTime(contrato.fechaCreacion)}
                  </DetailRow>
                  {contrato.fechaActualizacion && (
                    <>
                      <div className="h-px" style={{ backgroundColor: 'rgba(6, 182, 212, 0.06)' }} />
                      <DetailRow icon={<Pencil className="w-3.5 h-3.5" />} label="Actualizado">
                        {formatDateTime(contrato.fechaActualizacion)}
                      </DetailRow>
                    </>
                  )}
                </div>
              </PanelShell>

              {/* Notas */}
              {contrato.notas && (
                <PanelShell title="Notas" icon={<StickyNote className="w-4 h-4" />}>
                  <p className="text-xs font-mono text-slate-300 whitespace-pre-wrap">
                    {contrato.notas}
                  </p>
                </PanelShell>
              )}
            </div>
          </div>

          {/* ═══ MEDIOS ASIGNADOS ═══ */}
          <PanelShell title="Medios Asignados" icon={<Radio className="w-4 h-4" />}>
            {contrato.mediosList && contrato.mediosList.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                {contrato.mediosList.map((medio) => (
                  <div
                    key={medio.id}
                    className="flex items-center justify-between px-3 py-2 rounded"
                    style={{
                      backgroundColor: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.04)',
                    }}
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-mono text-slate-200 truncate">{medio.nombre}</p>
                      <p className="text-[9px] font-mono text-slate-600">{medio.tipo}</p>
                    </div>
                    <span
                      className="flex-shrink-0 w-2 h-2 rounded-full"
                      style={{
                        backgroundColor: medio.activo ? '#10b981' : '#64748b',
                        boxShadow: medio.activo ? '0 0 4px rgba(16, 185, 129, 0.4)' : 'none',
                      }}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs font-mono text-slate-600">Sin medios asignados</p>
            )}
          </PanelShell>

          {/* ═══ PARLAMENTARIOS ═══ */}
          <PanelShell title="Parlamentarios" icon={<Users className="w-4 h-4" />}>
            {contrato.parlamentariosList && contrato.parlamentariosList.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                {contrato.parlamentariosList.map((parl) => (
                  <div
                    key={parl.id}
                    className="flex items-center justify-between px-3 py-2 rounded"
                    style={{
                      backgroundColor: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.04)',
                    }}
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-mono text-slate-200 truncate">{parl.nombre}</p>
                      <p className="text-[9px] font-mono text-slate-600">
                        {parl.camara} {parl.partidoSigla ? `· ${parl.partidoSigla}` : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs font-mono text-slate-600">Sin parlamentarios asignados</p>
            )}
          </PanelShell>

          {/* ═══ ENTREGAS ═══ */}
          <PanelShell title="Entregas" icon={<Send className="w-4 h-4" />}>
            {/* Stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
              <div
                className="text-center px-3 py-2 rounded"
                style={{
                  backgroundColor: 'rgba(6, 182, 212, 0.06)',
                  border: '1px solid rgba(6, 182, 212, 0.1)',
                }}
              >
                <p className="text-lg font-bold font-mono text-cyan-400">{entregasTotal}</p>
                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500 font-mono">
                  Total
                </p>
              </div>
              <div
                className="text-center px-3 py-2 rounded"
                style={{
                  backgroundColor: 'rgba(16, 185, 129, 0.06)',
                  border: '1px solid rgba(16, 185, 129, 0.1)',
                }}
              >
                <p className="text-lg font-bold font-mono text-emerald-400">{enviadasCount}</p>
                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500 font-mono">
                  Enviadas
                </p>
              </div>
              <div
                className="text-center px-3 py-2 rounded"
                style={{
                  backgroundColor: 'rgba(245, 158, 11, 0.06)',
                  border: '1px solid rgba(245, 158, 11, 0.1)',
                }}
              >
                <p className="text-lg font-bold font-mono text-amber-400">{pendientesCount}</p>
                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500 font-mono">
                  Pendientes
                </p>
              </div>
              <div
                className="text-center px-3 py-2 rounded"
                style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.06)',
                  border: '1px solid rgba(239, 68, 68, 0.1)',
                }}
              >
                <p className="text-lg font-bold font-mono text-red-400">{fallidasCount}</p>
                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500 font-mono">
                  Fallidas
                </p>
              </div>
            </div>

            {/* Timeline */}
            {entregasList.length > 0 ? (
              <div className="space-y-0 max-h-96 overflow-y-auto">
                {entregasList.map((entrega, idx) => {
                  const estadoColor = ENTREGA_ESTADO_COLORS[entrega.estado] || '#64748b';
                  const prod = getProductInfo(entrega.tipoBoletin);
                  return (
                    <div key={entrega.id} className="relative flex gap-3">
                      {/* Timeline line */}
                      <div className="flex flex-col items-center flex-shrink-0">
                        <div
                          className="w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0"
                          style={{
                            backgroundColor: estadoColor,
                            boxShadow: `0 0 6px ${estadoColor}40`,
                          }}
                        />
                        {idx < entregasList.length - 1 && (
                          <div
                            className="w-px flex-1 min-h-8"
                            style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}
                          />
                        )}
                      </div>

                      {/* Content */}
                      <div
                        className="flex-1 pb-3 min-w-0"
                        style={{
                          backgroundColor: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                          borderLeft: '1px solid transparent',
                        }}
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Product badge */}
                          {prod ? (
                            <span
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono"
                              style={{
                                backgroundColor: `${prod.color}12`,
                                border: `1px solid ${prod.color}20`,
                                color: prod.color,
                              }}
                            >
                              <prod.icon className="w-2.5 h-2.5" />
                              {prod.nombre}
                            </span>
                          ) : (
                            <span className="text-[9px] font-mono text-slate-600">
                              {entrega.tipoBoletin}
                            </span>
                          )}

                          {/* Estado badge */}
                          <span
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase font-mono"
                            style={{
                              backgroundColor: `${estadoColor}15`,
                              color: estadoColor,
                            }}
                          >
                            {entrega.estado === 'enviado' && <CheckCircle2 className="w-2.5 h-2.5" />}
                            {entrega.estado === 'pendiente' && <Clock className="w-2.5 h-2.5" />}
                            {entrega.estado === 'fallido' && <AlertTriangle className="w-2.5 h-2.5" />}
                            {entrega.estado}
                          </span>

                          {/* Canal */}
                          <span className="text-[9px] font-mono text-slate-600">
                            {CANAL_LABELS[entrega.canal] || entrega.canal}
                          </span>
                        </div>

                        <p className="text-[10px] font-mono text-slate-500 mt-0.5">
                          {formatDateTime(entrega.fechaEnvio || entrega.fechaCreacion)}
                        </p>

                        {/* Error message for fallidos */}
                        {entrega.estado === 'fallido' && entrega.error && (
                          <p className="text-[10px] font-mono text-red-400/80 mt-1 flex items-center gap-1">
                            <AlertTriangle className="w-2.5 h-2.5 flex-shrink-0" />
                            {entrega.error}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-6">
                <Send className="w-6 h-6 text-slate-700 mb-2" />
                <p className="text-xs font-mono text-slate-600">
                  Sin entregas registradas para este contrato.
                </p>
              </div>
            )}
          </PanelShell>
        </div>
      </main>

      {/* ═══ FOOTER ═══ */}
      <footer
        className="flex-shrink-0 px-4 sm:px-6 py-1.5 flex items-center justify-between"
        style={{
          borderTop: '1px solid rgba(6, 182, 212, 0.06)',
          backgroundColor: '#0a0e17',
        }}
      >
        <Link
          href="/clientes"
          className="flex items-center gap-1 text-[9px] font-mono text-slate-600 hover:text-cyan-500 transition-colors"
        >
          <ArrowLeft className="w-3 h-3" />
          Clientes
        </Link>
        <span className="text-[9px] font-mono text-slate-700">
          DECODEX Bolivia &middot; ONION200
        </span>
      </footer>

      {/* ═══ EDIT DIALOG ═══ */}
      {editOpen && contrato && (
        <EditDialog
          key={editKey}
          contrato={contrato}
          open={editOpen}
          onClose={() => setEditOpen(false)}
          onSaved={handleContratoSaved}
        />
      )}
    </div>
  );
}
