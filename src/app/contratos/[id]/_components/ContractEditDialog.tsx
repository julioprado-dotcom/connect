'use client';

import { useState } from 'react';
import { fetchWithTimeout } from '@/lib/fetch-utils';
import { ALL_PRODUCTS, CANAL_LABELS, FRECUENCIA_LABELS } from '@/constants/nav';
import { Loader2, X, Save } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export interface ContratoDetail {
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

// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════

export function getProductInfo(tipo: string) {
  return ALL_PRODUCTS.find((p) => p.tipo === tipo);
}

export const ESTADO_COLORS: Record<string, string> = {
  activo: '#10b981',
  pausado: '#f59e0b',
  vencido: '#f97316',
  cancelado: '#ef4444',
};

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '---';
  return new Date(dateStr).toLocaleDateString('es-BO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '---';
  return new Date(dateStr).toLocaleDateString('es-BO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function truncateId(id: string): string {
  return id.length > 12 ? `${id.slice(0, 6)}...${id.slice(-4)}` : id;
}

// ═══════════════════════════════════════════════════════════════
// Status Badge
// ═══════════════════════════════════════════════════════════════

export function StatusBadge({ estado }: { estado: string }) {
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

export function DetailRow({
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

export function EditDialog({
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
