'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
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
import { PanelShell } from '@/components/onion200/PanelShell';
import { ALL_PRODUCTS, FRECUENCIA_LABELS } from '@/constants/nav';
import { fetchWithTimeout } from '@/lib/fetch-utils';
import {
  ArrowLeft,
  Pencil,
  Loader2,
  FileCheck,
  UserCircle,
  Building2,
  Receipt,
  Users,
  Tag,
  XCircle,
  CheckCircle2,
  Eye,
} from 'lucide-react';

/* ─── Constants ──────────────────────────────────────────── */
const SEGMENTOS = [
  { value: 'partido_politico', label: 'Partido Político' },
  { value: 'movimiento_social', label: 'Movimiento Social' },
  { value: 'ong', label: 'ONG' },
  { value: 'embajada', label: 'Embajada / Org. Internacional' },
  { value: 'legislador', label: 'Legislador' },
  { value: 'medio', label: 'Medio de Comunicación' },
  { value: 'academico', label: 'Académico' },
  { value: 'otro', label: 'Otro' },
];

const SEGMENTO_LABELS: Record<string, string> = {};
SEGMENTOS.forEach((s) => { SEGMENTO_LABELS[s.value] = s.label; });

/* ─── Types ──────────────────────────────────────────────── */
interface ContratoRecord {
  id: string;
  tipoProducto: string;
  frecuencia: string;
  formatoEntrega: string;
  montoMensual: number;
  moneda: string;
  estado: string;
  fechaCreacion: string;
  fechaInicio: string;
  fechaFin: string | null;
}

interface ParlamentarioRecord {
  id: string;
  nombre: string;
  camara: string;
  partidoSigla: string;
}

interface EjeRecord {
  id: number;
  clienteId: string;
  nombre: string;
  descripcion: string | null;
  keywords: string;
  activo: boolean;
  _count: { mencion_cliente_eje: number };
}

interface ClienteDetail {
  id: string;
  nombre: string;
  nombreContacto: string;
  email: string;
  telefono: string;
  whatsapp: string;
  organizacion: string;
  segmento: string;
  plan: string;
  estado: string;
  parlamentarios: string;
  ejesContratados: string;
  notas: string;
  ci: string;
  razonSocial: string;
  nit: string;
  fechaCreacion: string;
  fechaActualizacion: string;
  Contrato: ContratoRecord[];
  parlamentariosList: ParlamentarioRecord[];
}

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
function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-BO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatFullDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-BO', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function estadoColor(estado: string): React.CSSProperties {
  switch (estado) {
    case 'activo': return { backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#34d399', borderColor: 'rgba(16, 185, 129, 0.3)', border: '1px solid rgba(16, 185, 129, 0.3)' };
    case 'suspendido': return { backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', borderColor: 'rgba(245, 158, 11, 0.3)', border: '1px solid rgba(245, 158, 11, 0.3)' };
    case 'cancelado': return { backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.3)', border: '1px solid rgba(239, 68, 68, 0.3)' };
    default: return { backgroundColor: 'rgba(100, 116, 139, 0.15)', color: '#94a3b8', borderColor: 'rgba(100, 116, 139, 0.3)', border: '1px solid rgba(100, 116, 139, 0.3)' };
  }
}

function getProductName(tipo: string): string {
  const prod = ALL_PRODUCTS.find((p) => p.tipo === tipo);
  return prod?.nombre || tipo;
}

function parseProducts(tipoProducto: string): string[] {
  try {
    const parsed = JSON.parse(tipoProducto);
    if (Array.isArray(parsed)) return parsed;
  } catch { /* not JSON */ }
  return tipoProducto.split(',').map((s) => s.trim()).filter(Boolean);
}

/* ─── Info Row ───────────────────────────────────────────── */
function InfoRow({ label, value }: { label: string; value: string }) {
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
function EditDialog({
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

/* ─── MAIN COMPONENT ─────────────────────────────────────── */
export default function ClienteDetallePage() {
  const router = useRouter();
  const params = useParams();

  const [cliente, setCliente] = useState<ClienteDetail | null>(null);
  const [ejes, setEjes] = useState<EjeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchCliente = useCallback(async (id: string) => {
    try {
      const res = await fetchWithTimeout(`/api/clientes/${id}`, { timeoutMs: 10000 });
      if (!res.ok) throw new Error('Cliente no encontrado');
      const data = await res.json();
      setCliente(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    }
  }, []);

  const fetchEjes = useCallback(async (id: string) => {
    try {
      const res = await fetchWithTimeout(`/api/clientes/${id}/ejes`, { timeoutMs: 10000 });
      if (!res.ok) return;
      const data = await res.json();
      setEjes(data.ejes || []);
    } catch {
      // Silently fail
    }
  }, []);

  useEffect(() => {
    async function init() {
      setLoading(true);
      // params is a Promise in Next.js 16
      const resolved = await params;
      const id = resolved.id as string;
      if (!id) {
        setError('ID de cliente no proporcionado');
        setLoading(false);
        return;
      }
      await Promise.all([fetchCliente(id), fetchEjes(id)]);
      setLoading(false);
    }
    init();
  }, [params, fetchCliente, fetchEjes]);

  const refreshData = useCallback(() => {
    (async () => {
      const resolved = await params;
      const id = resolved.id as string;
      await Promise.all([fetchCliente(id), fetchEjes(id)]);
    })();
  }, [params, fetchCliente, fetchEjes]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin" style={{ color: '#06b6d4' }} />
        <span className="text-xs ml-2 font-mono" style={{ color: '#64748b' }}>
          Cargando cliente...
        </span>
      </div>
    );
  }

  if (error || !cliente) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div
          className="h-12 w-12 rounded-full flex items-center justify-center mb-3"
          style={{
            backgroundColor: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.15)',
          }}
        >
          <XCircle className="h-5 w-5" style={{ color: '#f87171' }} />
        </div>
        <p className="text-sm font-mono" style={{ color: '#f87171' }}>
          {error || 'Cliente no encontrado'}
        </p>
        <button
          type="button"
          onClick={() => router.push('/clientes')}
          className="mt-4 text-xs font-mono"
          style={{ color: '#06b6d4' }}
        >
          ← Volver a Clientes
        </button>
      </div>
    );
  }

  const products = cliente.Contrato ? parseProducts(cliente.Contrato[0]?.tipoProducto || '') : [];

  return (
    <div className="space-y-4 pb-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => router.push('/clientes')}
            className="mt-1 h-8 w-8 rounded-lg flex items-center justify-center transition-colors flex-shrink-0"
            style={{
              backgroundColor: 'rgba(6, 182, 212, 0.08)',
              border: '1px solid rgba(6, 182, 212, 0.15)',
              color: '#06b6d4',
            }}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1
                className="text-lg font-bold font-mono"
                style={{ color: '#e5e5e5' }}
              >
                {cliente.nombre}
              </h1>
              <span
                className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-medium"
                style={estadoColor(cliente.estado)}
              >
                {cliente.estado}
              </span>
            </div>
            {cliente.organizacion && (
              <p className="text-xs font-mono mt-0.5" style={{ color: '#94a3b8' }}>
                {cliente.organizacion}
              </p>
            )}
            <p className="text-[10px] font-mono mt-1" style={{ color: '#475569' }}>
              Registrado: {formatFullDate(cliente.fechaCreacion)}
            </p>
          </div>
        </div>

        {/* Edit button */}
        <EditDialog cliente={cliente} onSave={refreshData} />
      </div>

      {/* Info cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Datos Generales */}
        <PanelShell
          title="Datos Generales"
          icon={<UserCircle className="h-3.5 w-3.5" />}
        >
          <div className="space-y-3">
            <InfoRow label="Nombre" value={cliente.nombre} />
            <InfoRow label="Persona de Contacto" value={cliente.nombreContacto} />
            <InfoRow label="Email" value={cliente.email} />
            <InfoRow label="Teléfono" value={cliente.telefono} />
            <InfoRow label="WhatsApp" value={cliente.whatsapp} />
            <div>
              <p
                className="text-[10px] font-mono uppercase tracking-wider mb-0.5"
                style={{ color: '#475569' }}
              >
                Segmento
              </p>
              <Badge
                variant="outline"
                className="text-[10px] font-mono px-2 py-0.5"
                style={{
                  borderColor: 'rgba(6, 182, 212, 0.15)',
                  color: '#06b6d4',
                  backgroundColor: 'rgba(6, 182, 212, 0.06)',
                }}
              >
                {SEGMENTO_LABELS[cliente.segmento] || cliente.segmento}
              </Badge>
            </div>
            <div>
              <p
                className="text-[10px] font-mono uppercase tracking-wider mb-0.5"
                style={{ color: '#475569' }}
              >
                Plan
              </p>
              <span
                className="text-xs font-mono capitalize"
                style={{ color: '#e5e5e5' }}
              >
                {cliente.plan}
              </span>
            </div>
            {cliente.notas && (
              <InfoRow label="Notas" value={cliente.notas} />
            )}
          </div>
        </PanelShell>

        {/* Facturación */}
        <PanelShell
          title="Facturación"
          icon={<Receipt className="h-3.5 w-3.5" />}
        >
          <div className="space-y-3">
            <InfoRow label="CI" value={cliente.ci} />
            <InfoRow label="Razón Social" value={cliente.razonSocial} />
            <InfoRow label="NIT" value={cliente.nit} />
            {!cliente.ci && !cliente.razonSocial && !cliente.nit && (
              <p className="text-[11px] font-mono italic" style={{ color: '#475569' }}>
                Sin datos de facturación registrados
              </p>
            )}
          </div>

          {/* Parlamentarios */}
          {cliente.parlamentariosList && cliente.parlamentariosList.length > 0 && (
            <div className="mt-4 pt-4" style={{ borderTop: '1px solid rgba(6, 182, 212, 0.06)' }}>
              <p
                className="text-[10px] font-mono uppercase tracking-wider mb-2 flex items-center gap-1.5"
                style={{ color: '#475569' }}
              >
                <Building2 className="h-3 w-3" />
                Parlamentarios ({cliente.parlamentariosList.length})
              </p>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {cliente.parlamentariosList.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => router.push(`/personas/${p.id}`)}
                    className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors hover:bg-cyan-900/10"
                  >
                    <Users className="h-3 w-3 flex-shrink-0" style={{ color: '#06b6d4' }} />
                    <span className="text-xs font-mono truncate" style={{ color: '#e5e5e5' }}>
                      {p.nombre}
                    </span>
                    <span className="text-[9px] font-mono ml-auto flex-shrink-0" style={{ color: '#475569' }}>
                      {p.camara} · {p.partidoSigla}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </PanelShell>
      </div>

      {/* Contratos section */}
      <PanelShell
        title="Contratos"
        icon={<FileCheck className="h-3.5 w-3.5" />}
        onClose={undefined}
      >
        {!cliente.Contrato || cliente.Contrato.length === 0 ? (
          <p className="text-[11px] font-mono italic" style={{ color: '#475569' }}>
            Sin contratos registrados
          </p>
        ) : (
          <div className="space-y-2">
            {cliente.Contrato.map((c) => {
              const tipos = parseProducts(c.tipoProducto);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => router.push(`/contratos/${c.id}`)}
                  className="w-full text-left rounded-lg p-3 transition-colors hover:bg-cyan-900/10"
                  style={{
                    background: 'rgba(10, 14, 23, 0.6)',
                    border: '1px solid rgba(6, 182, 212, 0.08)',
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      {/* Product badges */}
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {tipos.map((tipo, idx) => {
                          const prod = ALL_PRODUCTS.find((p) => p.tipo === tipo);
                          const Icon = prod?.icon;
                          return (
                            <span
                              key={`${tipo}-${idx}`}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono"
                              style={{
                                backgroundColor: (prod?.color || '#06b6d4') + '15',
                                color: prod?.color || '#06b6d4',
                                border: `1px solid ${(prod?.color || '#06b6d4')}30`,
                              }}
                            >
                              {Icon && <Icon className="h-2.5 w-2.5" />}
                              {prod?.nombre || tipo}
                            </span>
                          );
                        })}
                      </div>

                      {/* Details */}
                      <div className="flex items-center gap-3 flex-wrap">
                        {c.frecuencia && (
                          <span className="text-[10px] font-mono" style={{ color: '#94a3b8' }}>
                            {FRECUENCIA_LABELS[c.frecuencia] || c.frecuencia}
                          </span>
                        )}
                        {c.montoMensual > 0 && (
                          <span
                            className="text-xs font-mono font-medium"
                            style={{ color: '#34d399' }}
                          >
                            {c.moneda} {c.montoMensual.toLocaleString('es-BO', { minimumFractionDigits: 0 })}
                          </span>
                        )}
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-medium"
                          style={estadoColor(c.estado)}
                        >
                          {c.estado}
                        </span>
                      </div>
                    </div>

                    <Eye className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" style={{ color: '#475569' }} />
                  </div>

                  {/* Dates */}
                  <div className="flex gap-4 mt-2">
                    <span className="text-[10px] font-mono" style={{ color: '#475569' }}>
                      Inicio: {formatDate(c.fechaInicio)}
                    </span>
                    {c.fechaFin && (
                      <span className="text-[10px] font-mono" style={{ color: '#475569' }}>
                        Fin: {formatDate(c.fechaFin)}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </PanelShell>

      {/* Ejes Temáticos Personalizados */}
      <PanelShell
        title="Ejes Temáticos Personalizados"
        icon={<Tag className="h-3.5 w-3.5" />}
        onClose={undefined}
      >
        {ejes.length === 0 ? (
          <p className="text-[11px] font-mono italic" style={{ color: '#475569' }}>
            Sin ejes temáticos personalizados configurados
          </p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {ejes.map((eje) => {
              let keywords: string[] = [];
              try {
                keywords = JSON.parse(eje.keywords);
              } catch { /* not JSON */ }

              return (
                <div
                  key={eje.id}
                  className="rounded-lg p-3"
                  style={{
                    background: 'rgba(10, 14, 23, 0.6)',
                    border: '1px solid rgba(6, 182, 212, 0.08)',
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className="text-xs font-mono font-medium"
                          style={{ color: '#e5e5e5' }}
                        >
                          {eje.nombre}
                        </span>
                        <span
                          className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-mono"
                          style={{
                            backgroundColor: eje.activo ? 'rgba(16, 185, 129, 0.15)' : 'rgba(100, 116, 139, 0.15)',
                            color: eje.activo ? '#34d399' : '#64748b',
                          }}
                        >
                          {eje.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </div>

                      {eje.descripcion && (
                        <p className="text-[11px] font-mono mt-1" style={{ color: '#94a3b8' }}>
                          {eje.descripcion}
                        </p>
                      )}

                      {keywords.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {keywords.map((kw, idx) => (
                            <span
                              key={`${kw}-${idx}`}
                              className="text-[9px] font-mono px-1.5 py-0.5 rounded"
                              style={{
                                backgroundColor: 'rgba(6, 182, 212, 0.06)',
                                color: '#06b6d4',
                                border: '1px solid rgba(6, 182, 212, 0.1)',
                              }}
                            >
                              {kw}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {eje._count.mencion_cliente_eje > 0 && (
                      <span
                        className="text-[10px] font-mono flex-shrink-0 px-2 py-0.5 rounded-full"
                        style={{
                          backgroundColor: 'rgba(6, 182, 212, 0.08)',
                          color: '#06b6d4',
                        }}
                      >
                        {eje._count.mencion_cliente_eje} menciones
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </PanelShell>
    </div>
  );
}
