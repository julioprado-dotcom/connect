'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { PanelShell } from '@/components/onion200/PanelShell';
import { ALL_PRODUCTS, FRECUENCIA_LABELS } from '@/constants/nav';
import { fetchWithTimeout } from '@/lib/fetch-utils';
import {
  ArrowLeft,
  Loader2,
  FileCheck,
  UserCircle,
  Building2,
  Receipt,
  Users,
  Tag,
  XCircle,
  Eye,
} from 'lucide-react';
import {
  SEGMENTOS,
  formatDate,
  formatFullDate,
  estadoColor,
  parseProducts,
  InfoRow,
  EditDialog,
} from './_components/ClientEditDialog';

/* ─── Types ──────────────────────────────────────────────── */
export interface ContratoRecord {
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

export interface ParlamentarioRecord {
  id: string;
  nombre: string;
  camara: string;
  partidoSigla: string;
}

export interface EjeRecord {
  id: number;
  clienteId: string;
  nombre: string;
  descripcion: string | null;
  keywords: string;
  activo: boolean;
  _count: { mencion_cliente_eje: number };
}

export interface ClienteDetail {
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

/* ─── Constants ──────────────────────────────────────────── */
const SEGMENTO_LABELS: Record<string, string> = {};
SEGMENTOS.forEach((s) => { SEGMENTO_LABELS[s.value] = s.label; });

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
