'use client';

import {
  Send,
  MessageSquare,
  Mail,
  Globe,
  FileDown,
  Package,
  ChevronRight,
} from 'lucide-react';
import { ALL_PRODUCTS, CANAL_LABELS } from '@/constants/nav';

/* ─── Types ───────────────────────────────────────────────── */
export interface EntregaCliente {
  id: string;
  nombre: string;
  organizacion: string;
}

export interface EntregaContrato {
  id: string;
  clienteId: string;
  tipoProducto: string;
  estado: string;
  Cliente: EntregaCliente;
}

export interface EntregaRecord {
  id: string;
  contratoId: string;
  tipoBoletin: string;
  contenido: string;
  fechaProgramada: string | null;
  fechaEnvio: string | null;
  estado: 'pendiente' | 'enviado' | 'fallido';
  canal: string;
  destinatarios: string;
  error: string | null;
  fechaCreacion: string;
  Contrato: EntregaContrato | null;
}

export interface EntregasStats {
  enviadasHoy: number;
  fallidasHoy: number;
  pendientes: number;
}

export interface EntregasResponse {
  entregas: EntregaRecord[];
  total: number;
  page: number;
  limit: number;
  stats: EntregasStats;
}

/* ─── Helpers ──────────────────────────────────────────────── */
export function getProductName(tipo: string): string {
  const prod = ALL_PRODUCTS.find((p) => p.tipo === tipo);
  return prod?.nombre || tipo;
}

export function getProductColor(tipo: string): string {
  const prod = ALL_PRODUCTS.find((p) => p.tipo === tipo);
  return prod?.color || '#64748b';
}

export function getCanalIcon(canal: string) {
  switch (canal) {
    case 'whatsapp':
      return <MessageSquare className="w-3.5 h-3.5" />;
    case 'email':
      return <Mail className="w-3.5 h-3.5" />;
    case 'web':
      return <Globe className="w-3.5 h-3.5" />;
    case 'pdf':
      return <FileDown className="w-3.5 h-3.5" />;
    default:
      return <Send className="w-3.5 h-3.5" />;
  }
}

export function getEstadoColor(estado: string): string {
  switch (estado) {
    case 'pendiente':
      return '#f59e0b';
    case 'enviado':
      return '#10b981';
    case 'fallido':
      return '#ef4444';
    default:
      return '#64748b';
  }
}

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return '---';
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-BO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function toDateInputValue(dateStr: string): string {
  return dateStr.slice(0, 10);
}

export function truncateId(id: string): string {
  if (id.length <= 8) return id;
  return `${id.slice(0, 4)}...${id.slice(-4)}`;
}

/* ─── Estado badge component ───────────────────────────────── */
export function EstadoBadge({ estado }: { estado: string }) {
  const color = getEstadoColor(estado);
  const label = estado.charAt(0).toUpperCase() + estado.slice(1);

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider font-mono"
      style={{
        backgroundColor: `${color}15`,
        color: color,
        border: `1px solid ${color}30`,
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{
          backgroundColor: color,
          boxShadow: `0 0 4px ${color}60`,
        }}
      />
      {label}
    </span>
  );
}

/* ─── Stat KPI card ────────────────────────────────────────── */
export function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div
      className="rounded-lg p-3 relative overflow-hidden"
      style={{
        background: `linear-gradient(135deg, ${color}08 0%, rgba(5,5,5,0.9) 60%)`,
        border: `1px solid ${color}18`,
        boxShadow: `0 0 12px ${color}06`,
      }}
    >
      {/* Scan line */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(6,182,212,0.01) 3px, rgba(6,182,212,0.01) 4px)',
        }}
      />
      <div className="relative z-10">
        <div className="flex items-center gap-1.5 mb-1.5">
          <span style={{ color: `${color}90` }}>{icon}</span>
          <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-600 font-mono">
            {label}
          </span>
        </div>
        <p
          className="text-2xl font-bold font-mono tabular-nums leading-none"
          style={{ color: '#e5e5e5' }}
        >
          {value}
        </p>
      </div>
      {/* Bottom glow */}
      <div
        className="absolute bottom-0 left-0 right-0 h-[1px]"
        style={{
          background: `linear-gradient(90deg, transparent, ${color}25, transparent)`,
        }}
      />
    </div>
  );
}

/* ─── Entrega row (desktop table row) ──────────────────────── */
export function EntregaRow({ entrega, onClick }: { entrega: EntregaRecord; onClick: () => void }) {
  const productColor = getProductColor(entrega.tipoBoletin);
  const productName = getProductName(entrega.tipoBoletin);
  const canalLabel = CANAL_LABELS[entrega.canal] || entrega.canal;
  const displayDate = entrega.fechaEnvio || entrega.fechaProgramada;

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left px-4 py-3 transition-all duration-200 hover:bg-white/[0.02] cursor-pointer group"
      style={{ borderBottom: '1px solid rgba(6,182,212,0.06)' }}
    >
      <div className="grid grid-cols-12 gap-3 items-center">
        {/* Producto */}
        <div className="col-span-3 md:col-span-2 flex items-center gap-2 min-w-0">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{
              backgroundColor: productColor,
              boxShadow: `0 0 4px ${productColor}50`,
            }}
          />
          <span
            className="text-xs font-medium font-mono truncate"
            style={{ color: productColor }}
          >
            {productName}
          </span>
        </div>

        {/* Cliente */}
        <div className="col-span-3 md:col-span-2 min-w-0">
          <span className="text-xs font-mono truncate block" style={{ color: '#e5e5e5' }}>
            {entrega.Contrato?.Cliente?.nombre || 'N/A'}
          </span>
        </div>

        {/* Contrato ID */}
        <div className="hidden md:block col-span-2 min-w-0">
          <span className="text-[10px] font-mono text-slate-600">
            {truncateId(entrega.contratoId)}
          </span>
        </div>

        {/* Estado */}
        <div className="col-span-2 md:col-span-1">
          <EstadoBadge estado={entrega.estado} />
        </div>

        {/* Canal */}
        <div className="hidden sm:flex col-span-2 md:col-span-1 items-center gap-1.5">
          <span className="text-slate-600">{getCanalIcon(entrega.canal)}</span>
          <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
            {canalLabel}
          </span>
        </div>

        {/* Fecha */}
        <div className="hidden lg:block col-span-2 min-w-0">
          <span className="text-[10px] font-mono text-slate-600">
            {formatDate(displayDate)}
          </span>
        </div>

        {/* Error indicator */}
        <div className="hidden lg:flex col-span-1 items-center justify-end">
          {entrega.estado === 'fallido' && entrega.error && (
            <span className="text-[10px] font-mono text-red-400 truncate max-w-[120px]" title={entrega.error}>
              {entrega.error}
            </span>
          )}
          <ChevronRight className="w-3 h-3 text-slate-700 group-hover:text-cyan-500 transition-colors ml-auto flex-shrink-0" />
        </div>
      </div>

      {/* Error row (visible below on md when fallido) */}
      {entrega.estado === 'fallido' && entrega.error && (
        <div className="lg:hidden mt-2 pl-4">
          <span className="text-[10px] font-mono text-red-400">
            Error: {entrega.error}
          </span>
        </div>
      )}
    </button>
  );
}

/* ─── Entrega card (mobile) ────────────────────────────────── */
export function EntregaCard({ entrega, onClick }: { entrega: EntregaRecord; onClick: () => void }) {
  const productColor = getProductColor(entrega.tipoBoletin);
  const productName = getProductName(entrega.tipoBoletin);
  const canalLabel = CANAL_LABELS[entrega.canal] || entrega.canal;
  const displayDate = entrega.fechaEnvio || entrega.fechaProgramada;

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-lg p-4 transition-all duration-200 hover:bg-white/[0.02] cursor-pointer"
      style={{
        background: 'rgba(5,5,5,0.6)',
        border: '1px solid rgba(6,182,212,0.08)',
      }}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        {/* Producto badge */}
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{
              backgroundColor: productColor,
              boxShadow: `0 0 4px ${productColor}50`,
            }}
          />
          <span
            className="text-xs font-bold font-mono"
            style={{ color: productColor }}
          >
            {productName}
          </span>
        </div>
        <EstadoBadge estado={entrega.estado} />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-600 font-mono">
            Cliente
          </span>
        </div>
        <p className="text-xs font-mono" style={{ color: '#e5e5e5' }}>
          {entrega.Contrato?.Cliente?.nombre || 'N/A'}
        </p>

        <div className="flex items-center gap-3 mt-2">
          {/* Canal */}
          <div className="flex items-center gap-1">
            <span className="text-slate-600">{getCanalIcon(entrega.canal)}</span>
            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
              {canalLabel}
            </span>
          </div>
          {/* Fecha */}
          <span className="text-[10px] font-mono text-slate-600">
            {formatDate(displayDate)}
          </span>
        </div>

        {/* Error */}
        {entrega.estado === 'fallido' && entrega.error && (
          <div
            className="mt-2 rounded px-2 py-1.5"
            style={{
              backgroundColor: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.15)',
            }}
          >
            <span className="text-[10px] font-mono text-red-400">
              {entrega.error}
            </span>
          </div>
        )}
      </div>
    </button>
  );
}

/* ─── Empty state ──────────────────────────────────────────── */
export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Package className="w-8 h-8 text-slate-700 mb-3" />
      <p className="text-sm font-mono text-slate-500">
        No hay entregas con los filtros seleccionados
      </p>
    </div>
  );
}
