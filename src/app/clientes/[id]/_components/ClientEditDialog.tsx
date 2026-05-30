'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ALL_PRODUCTS } from '@/constants/nav';
import { fetchWithTimeout } from '@/lib/fetch-utils';
import { Pencil, Loader2, XCircle, CheckCircle2 } from 'lucide-react';
import type { ClienteDetail } from '../page';

/* ─── Constants ──────────────────────────────────────────── */
export const SEGMENTOS = [
  { value: 'partido_politico', label: 'Partido Político' },
  { value: 'movimiento_social', label: 'Movimiento Social' },
  { value: 'ong', label: 'ONG' },
  { value: 'embajada', label: 'Embajada / Org. Internacional' },
  { value: 'legislador', label: 'Legislador' },
  { value: 'medio', label: 'Medio de Comunicación' },
  { value: 'academico', label: 'Académico' },
  { value: 'otro', label: 'Otro' },
];

/* ─── Types ──────────────────────────────────────────────── */
interface EditForm {
  nombre: string;
  nombreContacto: string;
  email: string;
  telefono: string;
  whatsapp: string;
  organizacion: string;
  segmento: string;
  plan: string;
  estado: string;
  notas: string;
  ci: string;
  razonSocial: string;
  nit: string;
}

/* ─── Helpers ────────────────────────────────────────────── */
export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-BO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatFullDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-BO', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function estadoColor(estado: string): React.CSSProperties {
  switch (estado) {
    case 'activo': return { backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#34d399', borderColor: 'rgba(16, 185, 129, 0.3)', border: '1px solid rgba(16, 185, 129, 0.3)' };
    case 'suspendido': return { backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', borderColor: 'rgba(245, 158, 11, 0.3)', border: '1px solid rgba(245, 158, 11, 0.3)' };
    case 'cancelado': return { backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.3)', border: '1px solid rgba(239, 68, 68, 0.3)' };
    default: return { backgroundColor: 'rgba(100, 116, 139, 0.15)', color: '#94a3b8', borderColor: 'rgba(100, 116, 139, 0.3)', border: '1px solid rgba(100, 116, 139, 0.3)' };
  }
}

export function getProductName(tipo: string): string {
  const prod = ALL_PRODUCTS.find((p) => p.tipo === tipo);
  return prod?.nombre || tipo;
}

export function parseProducts(tipoProducto: string): string[] {
  try {
    const parsed = JSON.parse(tipoProducto);
    if (Array.isArray(parsed)) return parsed;
  } catch { /* not JSON */ }
  return tipoProducto.split(',').map((s) => s.trim()).filter(Boolean);
}

/* ─── Info Row ───────────────────────────────────────────── */
export function InfoRow({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div>
      <p
        className="text-[10px] font-mono uppercase tracking-wider mb-0.5"
        style={{ color: '#475569' }}
      >
        {label}
      </p>
      <p
        className="text-xs font-mono"
        style={{ color: '#e5e5e5' }}
      >
        {value}
      </p>
    </div>
  );
}

/* ─── Edit Dialog ────────────────────────────────────────── */
export function EditDialog({
  cliente,
  onSave,
}: {
  cliente: ClienteDetail;
  onSave: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<EditForm>({
    nombre: cliente.nombre,
    nombreContacto: cliente.nombreContacto,
    email: cliente.email,
    telefono: cliente.telefono,
    whatsapp: cliente.whatsapp,
    organizacion: cliente.organizacion,
    segmento: cliente.segmento,
    plan: cliente.plan,
    estado: cliente.estado,
    notas: cliente.notas,
    ci: cliente.ci,
    razonSocial: cliente.razonSocial,
    nit: cliente.nit,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const update = (field: keyof EditForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setError('');
    setSaving(true);
    try {
      const res = await fetchWithTimeout(`/api/clientes/${cliente.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
        timeoutMs: 10000,
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al guardar');
      }
      setSuccess(true);
      onSave();
      setTimeout(() => {
        setOpen(false);
        setSuccess(false);
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button
            type="button"
            className="h-8 px-3 rounded-lg text-[10px] font-mono transition-colors flex items-center gap-1.5"
            style={{
              backgroundColor: 'rgba(6, 182, 212, 0.1)',
              border: '1px solid rgba(6, 182, 212, 0.2)',
              color: '#06b6d4',
            }}
          >
            <Pencil className="h-3 w-3" />
            Editar
          </button>
        }
      />
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle
            className="text-sm font-mono uppercase tracking-wider"
            style={{ color: '#06b6d4' }}
          >
            Editar Cliente
          </DialogTitle>
        </DialogHeader>

        {/* Error */}
        {error && (
          <div
            className="rounded-lg px-3 py-2 text-xs font-mono flex items-center gap-2"
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              color: '#f87171',
            }}
          >
            <XCircle className="h-3.5 w-3.5 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Success */}
        {success && (
          <div
            className="rounded-lg px-3 py-2 text-xs font-mono flex items-center gap-2"
            style={{
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.2)',
              color: '#34d399',
            }}
          >
            <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" />
            Cliente actualizado correctamente
          </div>
        )}

        <div className="space-y-3">
          {/* Nombre */}
          <div>
            <label className="text-[10px] font-mono uppercase tracking-wider block mb-1" style={{ color: '#475569' }}>
              Nombre / Razón Social
            </label>
            <Input
              value={form.nombre}
              onChange={(e) => update('nombre', e.target.value)}
              className="h-8 text-xs font-mono"
              style={{
                backgroundColor: '#0a0e17',
                borderColor: 'rgba(6, 182, 212, 0.12)',
                color: '#e5e5e5',
              }}
            />
          </div>

          {/* Organización */}
          <div>
            <label className="text-[10px] font-mono uppercase tracking-wider block mb-1" style={{ color: '#475569' }}>
              Organización
            </label>
            <Input
              value={form.organizacion}
              onChange={(e) => update('organizacion', e.target.value)}
              className="h-8 text-xs font-mono"
              style={{
                backgroundColor: '#0a0e17',
                borderColor: 'rgba(6, 182, 212, 0.12)',
                color: '#e5e5e5',
              }}
            />
          </div>

          {/* Contacto + Email */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-mono uppercase tracking-wider block mb-1" style={{ color: '#475569' }}>
                Persona de Contacto
              </label>
              <Input
                value={form.nombreContacto}
                onChange={(e) => update('nombreContacto', e.target.value)}
                className="h-8 text-xs font-mono"
                style={{
                  backgroundColor: '#0a0e17',
                  borderColor: 'rgba(6, 182, 212, 0.12)',
                  color: '#e5e5e5',
                }}
              />
            </div>
            <div>
              <label className="text-[10px] font-mono uppercase tracking-wider block mb-1" style={{ color: '#475569' }}>
                Email
              </label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => update('email', e.target.value)}
                className="h-8 text-xs font-mono"
                style={{
                  backgroundColor: '#0a0e17',
                  borderColor: 'rgba(6, 182, 212, 0.12)',
                  color: '#e5e5e5',
                }}
              />
            </div>
          </div>

          {/* Teléfono + WhatsApp */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-mono uppercase tracking-wider block mb-1" style={{ color: '#475569' }}>
                Teléfono
              </label>
              <Input
                value={form.telefono}
                onChange={(e) => update('telefono', e.target.value)}
                className="h-8 text-xs font-mono"
                style={{
                  backgroundColor: '#0a0e17',
                  borderColor: 'rgba(6, 182, 212, 0.12)',
                  color: '#e5e5e5',
                }}
              />
            </div>
            <div>
              <label className="text-[10px] font-mono uppercase tracking-wider block mb-1" style={{ color: '#475569' }}>
                WhatsApp
              </label>
              <Input
                value={form.whatsapp}
                onChange={(e) => update('whatsapp', e.target.value)}
                className="h-8 text-xs font-mono"
                style={{
                  backgroundColor: '#0a0e17',
                  borderColor: 'rgba(6, 182, 212, 0.12)',
                  color: '#e5e5e5',
                }}
              />
            </div>
          </div>

          {/* Segmento + Estado */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-mono uppercase tracking-wider block mb-1" style={{ color: '#475569' }}>
                Segmento
              </label>
              <select
                value={form.segmento}
                onChange={(e) => update('segmento', e.target.value)}
                className="h-8 w-full rounded-lg text-xs font-mono px-2.5 appearance-none cursor-pointer"
                style={{
                  backgroundColor: '#0a0e17',
                  borderColor: 'rgba(6, 182, 212, 0.12)',
                  color: '#e5e5e5',
                }}
              >
                {SEGMENTOS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-mono uppercase tracking-wider block mb-1" style={{ color: '#475569' }}>
                Estado
              </label>
              <select
                value={form.estado}
                onChange={(e) => update('estado', e.target.value)}
                className="h-8 w-full rounded-lg text-xs font-mono px-2.5 appearance-none cursor-pointer"
                style={{
                  backgroundColor: '#0a0e17',
                  borderColor: 'rgba(6, 182, 212, 0.12)',
                  color: '#e5e5e5',
                }}
              >
                <option value="activo">Activo</option>
                <option value="suspendido">Suspendido</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </div>
          </div>

          {/* Facturación */}
          <div
            className="pt-3"
            style={{ borderTop: '1px solid rgba(6, 182, 212, 0.06)' }}
          >
            <p
              className="text-[10px] font-mono uppercase tracking-wider mb-2"
              style={{ color: '#475569' }}
            >
              Datos de Facturación
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-mono uppercase tracking-wider block mb-1" style={{ color: '#475569' }}>
                  CI
                </label>
                <Input
                  value={form.ci}
                  onChange={(e) => update('ci', e.target.value)}
                  className="h-8 text-xs font-mono"
                  style={{
                    backgroundColor: '#0a0e17',
                    borderColor: 'rgba(6, 182, 212, 0.12)',
                    color: '#e5e5e5',
                  }}
                />
              </div>
              <div>
                <label className="text-[10px] font-mono uppercase tracking-wider block mb-1" style={{ color: '#475569' }}>
                  Razón Social
                </label>
                <Input
                  value={form.razonSocial}
                  onChange={(e) => update('razonSocial', e.target.value)}
                  className="h-8 text-xs font-mono"
                  style={{
                    backgroundColor: '#0a0e17',
                    borderColor: 'rgba(6, 182, 212, 0.12)',
                    color: '#e5e5e5',
                  }}
                />
              </div>
              <div>
                <label className="text-[10px] font-mono uppercase tracking-wider block mb-1" style={{ color: '#475569' }}>
                  NIT
                </label>
                <Input
                  value={form.nit}
                  onChange={(e) => update('nit', e.target.value)}
                  className="h-8 text-xs font-mono"
                  style={{
                    backgroundColor: '#0a0e17',
                    borderColor: 'rgba(6, 182, 212, 0.12)',
                    color: '#e5e5e5',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Notas */}
          <div>
            <label className="text-[10px] font-mono uppercase tracking-wider block mb-1" style={{ color: '#475569' }}>
              Notas
            </label>
            <Textarea
              value={form.notas}
              onChange={(e) => update('notas', e.target.value)}
              rows={3}
              className="text-xs font-mono resize-none"
              style={{
                backgroundColor: '#0a0e17',
                borderColor: 'rgba(6, 182, 212, 0.12)',
                color: '#e5e5e5',
              }}
            />
          </div>

          {/* Save button */}
          <Button
            onClick={handleSave}
            disabled={saving || success}
            className="w-full h-9 text-xs font-mono"
            style={{
              backgroundColor: success ? 'rgba(16, 185, 129, 0.2)' : 'rgba(6, 182, 212, 0.2)',
              border: success ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(6, 182, 212, 0.3)',
              color: success ? '#34d399' : '#06b6d4',
            }}
          >
            {saving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                Guardando...
              </>
            ) : success ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                Guardado
              </>
            ) : (
              'Guardar Cambios'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
