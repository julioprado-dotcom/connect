'use client';

import { use, useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { fetchWithTimeout } from '@/lib/fetch-utils';
import { PanelShell } from '@/components/onion200/PanelShell';
import { CANAL_LABELS, FRECUENCIA_LABELS } from '@/constants/nav';
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
} from 'lucide-react';
import {
  ContratoDetail,
  EditDialog,
  getProductInfo,
  formatDate,
  formatDateTime,
  truncateId,
  StatusBadge,
  DetailRow,
} from './_components/ContractEditDialog';

// ═══════════════════════════════════════════════════════════════
// Types (page-only)
// ═══════════════════════════════════════════════════════════════

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
// Constants (page-only)
// ═══════════════════════════════════════════════════════════════

const ENTREGA_ESTADO_COLORS: Record<string, string> = {
  enviado: '#10b981',
  pendiente: '#f59e0b',
  fallido: '#ef4444',
};

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
                <div className="h-px" style={{ backgroundColor: 'rgba(6, 182, 212, 0.06)' }}></div>
                <DetailRow icon={<Truck className="w-3.5 h-3.5" />} label="Formato de Entrega">
                  {CANAL_LABELS[contrato.formatoEntrega] || contrato.formatoEntrega}
                </DetailRow>
                <div className="h-px" style={{ backgroundColor: 'rgba(6, 182, 212, 0.06)' }}></div>
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
                <div className="h-px" style={{ backgroundColor: 'rgba(6, 182, 212, 0.06)' }}></div>
                <DetailRow icon={<Clock className="w-3.5 h-3.5" />} label="Fecha Fin">
                  {contrato.fechaFin ? formatDate(contrato.fechaFin) : (
                    <span className="text-amber-400">Indefinido</span>
                  )}
                </DetailRow>
                <div className="h-px" style={{ backgroundColor: 'rgba(6, 182, 212, 0.06)' }}></div>
                <DetailRow icon={<FileCheck className="w-3.5 h-3.5" />} label="Creado">
                  {formatDateTime(contrato.fechaCreacion)}
                </DetailRow>
                {contrato.fechaActualizacion && (
                  <>
                    <div className="h-px" style={{ backgroundColor: 'rgba(6, 182, 212, 0.06)' }}></div>
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
