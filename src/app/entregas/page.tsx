'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { fetchWithTimeout } from '@/lib/fetch-utils';
import { PanelShell } from '@/components/onion200/PanelShell';
import { ALL_PRODUCTS, CANAL_LABELS } from '@/constants/nav';
import {
  ArrowLeft,
  Send,
  AlertCircle,
  Clock,
  Package,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MessageSquare,
  Mail,
  Globe,
  FileDown,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

/* ─── Types ───────────────────────────────────────────────── */
interface EntregaCliente {
  id: string;
  nombre: string;
  organizacion: string;
}

interface EntregaContrato {
  id: string;
  clienteId: string;
  tipoProducto: string;
  estado: string;
  Cliente: EntregaCliente;
}

interface EntregaRecord {
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

interface EntregasStats {
  enviadasHoy: number;
  fallidasHoy: number;
  pendientes: number;
}

interface EntregasResponse {
  entregas: EntregaRecord[];
  total: number;
  page: number;
  limit: number;
  stats: EntregasStats;
}

/* ─── Helpers ──────────────────────────────────────────────── */
function getProductName(tipo: string): string {
  const prod = ALL_PRODUCTS.find((p) => p.tipo === tipo);
  return prod?.nombre || tipo;
}

function getProductColor(tipo: string): string {
  const prod = ALL_PRODUCTS.find((p) => p.tipo === tipo);
  return prod?.color || '#64748b';
}

function getCanalIcon(canal: string) {
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

function getEstadoColor(estado: string): string {
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

function formatDate(dateStr: string | null): string {
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

function toDateInputValue(dateStr: string): string {
  return dateStr.slice(0, 10);
}

function truncateId(id: string): string {
  if (id.length <= 8) return id;
  return `${id.slice(0, 4)}...${id.slice(-4)}`;
}

/* ─── Estado badge component ───────────────────────────────── */
function EstadoBadge({ estado }: { estado: string }) {
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
function StatCard({
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
function EntregaRow({ entrega, onClick }: { entrega: EntregaRecord; onClick: () => void }) {
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
function EntregaCard({ entrega, onClick }: { entrega: EntregaRecord; onClick: () => void }) {
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
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Package className="w-8 h-8 text-slate-700 mb-3" />
      <p className="text-sm font-mono text-slate-500">
        No hay entregas con los filtros seleccionados
      </p>
    </div>
  );
}

/* ─── MAIN PAGE ────────────────────────────────────────────── */
export default function EntregasPage() {
  const router = useRouter();

  // Data state
  const [entregas, setEntregas] = useState<EntregaRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<EntregasStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filter state
  const [search, setSearch] = useState('');
  const [estadoFilter, setEstadoFilter] = useState('');
  const [canalFilter, setCanalFilter] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');

  // Pagination state
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  // Build API query
  const buildQuery = useCallback(() => {
    const params = new URLSearchParams();
    if (estadoFilter && estadoFilter !== 'todos') params.set('estado', estadoFilter);
    if (canalFilter && canalFilter !== 'todos') params.set('canal', canalFilter);
    if (fechaDesde) params.set('fechaDesde', fechaDesde);
    if (fechaHasta) params.set('fechaHasta', fechaHasta);
    params.set('page', String(page));
    params.set('limit', String(limit));
    return params.toString();
  }, [estadoFilter, canalFilter, fechaDesde, fechaHasta, page, limit]);

  // Fetch entregas
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError('');
      try {
        const query = buildQuery();
        const res = await fetchWithTimeout(`/api/entregas?${query}`, { timeoutMs: 12000 });
        if (!res.ok) throw new Error('Error al cargar entregas');
        const data: EntregasResponse = await res.json();
        if (!cancelled) {
          setEntregas(data.entregas || []);
          setTotal(data.total || 0);
          setStats(data.stats || null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Error desconocido');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, [buildQuery]);

  // Client-side filtering by search text
  const filteredEntregas = useMemo(() => {
    if (!search.trim()) return entregas;
    const q = search.toLowerCase().trim();
    return entregas.filter((e) => {
      const clientName = (e.Contrato?.Cliente?.nombre || '').toLowerCase();
      const tipo = (e.tipoBoletin || '').toLowerCase();
      return clientName.includes(q) || tipo.includes(q);
    });
  }, [entregas, search]);

  // Pagination bounds
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const fromItem = (page - 1) * limit + 1;
  const toItem = Math.min(page * limit, total);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [estadoFilter, canalFilter, fechaDesde, fechaHasta, limit]);

  // Clear all filters
  function clearFilters() {
    setSearch('');
    setEstadoFilter('');
    setCanalFilter('');
    setFechaDesde('');
    setFechaHasta('');
    setPage(1);
  }

  const hasActiveFilters = estadoFilter || canalFilter || fechaDesde || fechaHasta || search;

  // Navigate to contrato
  function goToContrato(contratoId: string) {
    router.push(`/contratos/${contratoId}`);
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: '#020202' }}
    >
      {/* Scan lines overlay */}
      <div
        className="fixed inset-0 pointer-events-none opacity-20"
        style={{
          background:
            'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(6,182,212,0.012) 3px, rgba(6,182,212,0.012) 4px)',
        }}
      />

      {/* ═══ HEADER ═══ */}
      <header
        className="relative z-10 flex-shrink-0 px-4 sm:px-6 py-4 flex items-center justify-between"
        style={{
          borderBottom: '1px solid rgba(6,182,212,0.08)',
          background: 'linear-gradient(180deg, rgba(6,182,212,0.04) 0%, transparent 100%)',
        }}
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push('/')}
            className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-mono uppercase tracking-wider transition-all hover:bg-white/5"
            style={{ color: '#64748b' }}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Dashboard
          </button>
          <div
            className="w-px h-5"
            style={{ backgroundColor: 'rgba(6,182,212,0.12)' }}
          />
          <div>
            <h1 className="text-sm font-bold tracking-[0.15em] text-cyan-400/90 font-mono uppercase">
              Gestion de Entregas
            </h1>
            <p className="text-[10px] tracking-wider text-slate-600 font-mono">
              Seguimiento de entregas de productos ONION200
            </p>
          </div>
        </div>

        {/* Live indicator */}
        <div className="hidden sm:flex items-center gap-1.5">
          <span
            className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"
            style={{ boxShadow: '0 0 6px rgba(16,185,129,0.5)' }}
          />
          <span className="text-[9px] font-bold uppercase text-emerald-500/60 font-mono">
            en vivo
          </span>
        </div>
      </header>

      {/* ═══ MAIN CONTENT ═══ */}
      <main className="relative z-10 flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6">
        <div className="max-w-[1400px] mx-auto space-y-4">

          {/* ═══ STATS BAR ═══ */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard
              icon={<Send className="w-4 h-4" />}
              label="Enviadas Hoy"
              value={stats?.enviadasHoy ?? 0}
              color="#10b981"
            />
            <StatCard
              icon={<AlertCircle className="w-4 h-4" />}
              label="Fallidas Hoy"
              value={stats?.fallidasHoy ?? 0}
              color="#ef4444"
            />
            <StatCard
              icon={<Clock className="w-4 h-4" />}
              label="Pendientes"
              value={stats?.pendientes ?? 0}
              color="#f59e0b"
            />
            <StatCard
              icon={<Package className="w-4 h-4" />}
              label="Total"
              value={total}
              color="#06b6d4"
            />
          </div>

          {/* ═══ FILTERS ═══ */}
          <PanelShell title="Filtros" icon={<Search className="w-3.5 h-3.5" />}>
            <div className="space-y-3">
              {/* Search row */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600" />
                <Input
                  type="text"
                  placeholder="Buscar por cliente o producto..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-8 text-xs font-mono bg-transparent border-slate-800 text-slate-300 placeholder:text-slate-700 focus:border-cyan-500/40"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Filter controls row */}
              <div className="flex flex-wrap gap-2 items-end">
                {/* Estado filter */}
                <div className="flex-1 min-w-[130px]">
                  <label className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-600 font-mono block mb-1">
                    Estado
                  </label>
                  <select
                    value={estadoFilter}
                    onChange={(e) => setEstadoFilter(e.target.value)}
                    className="w-full h-8 rounded-md text-xs font-mono bg-transparent border border-slate-800 text-slate-300 px-2 focus:outline-none focus:border-cyan-500/40"
                  >
                    <option value="" className="bg-slate-900">Todos</option>
                    <option value="pendiente" className="bg-slate-900">Pendiente</option>
                    <option value="enviado" className="bg-slate-900">Enviado</option>
                    <option value="fallido" className="bg-slate-900">Fallido</option>
                  </select>
                </div>

                {/* Canal filter */}
                <div className="flex-1 min-w-[130px]">
                  <label className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-600 font-mono block mb-1">
                    Canal
                  </label>
                  <select
                    value={canalFilter}
                    onChange={(e) => setCanalFilter(e.target.value)}
                    className="w-full h-8 rounded-md text-xs font-mono bg-transparent border border-slate-800 text-slate-300 px-2 focus:outline-none focus:border-cyan-500/40"
                  >
                    <option value="" className="bg-slate-900">Todos</option>
                    <option value="whatsapp" className="bg-slate-900">WhatsApp</option>
                    <option value="email" className="bg-slate-900">Email</option>
                    <option value="web" className="bg-slate-900">Web</option>
                    <option value="pdf" className="bg-slate-900">PDF</option>
                  </select>
                </div>

                {/* Fecha desde */}
                <div className="flex-1 min-w-[140px]">
                  <label className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-600 font-mono block mb-1">
                    Desde
                  </label>
                  <Input
                    type="date"
                    value={fechaDesde}
                    onChange={(e) => setFechaDesde(e.target.value)}
                    className="h-8 text-xs font-mono bg-transparent border-slate-800 text-slate-300 focus:border-cyan-500/40"
                  />
                </div>

                {/* Fecha hasta */}
                <div className="flex-1 min-w-[140px]">
                  <label className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-600 font-mono block mb-1">
                    Hasta
                  </label>
                  <Input
                    type="date"
                    value={fechaHasta}
                    onChange={(e) => setFechaHasta(e.target.value)}
                    className="h-8 text-xs font-mono bg-transparent border-slate-800 text-slate-300 focus:border-cyan-500/40"
                  />
                </div>

                {/* Clear filters */}
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="h-8 flex items-center gap-1.5 px-3 rounded-md text-[10px] font-mono uppercase tracking-wider transition-all hover:bg-white/5"
                    style={{
                      color: '#64748b',
                      border: '1px solid rgba(100,116,139,0.2)',
                    }}
                  >
                    <X className="w-3 h-3" />
                    Limpiar
                  </button>
                )}
              </div>
            </div>
          </PanelShell>

          {/* ═══ ENTREGAS LIST ═══ */}
          <PanelShell
            title={`Entregas (${total})`}
            icon={<Package className="w-3.5 h-3.5" />}
            onClose={loading ? undefined : undefined}
          >
            {/* Loading */}
            {loading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-cyan-500" />
                <span className="text-xs font-mono text-slate-500 ml-2">
                  Cargando entregas...
                </span>
              </div>
            )}

            {/* Error */}
            {error && !loading && (
              <div
                className="rounded-md px-3 py-2 text-xs font-mono"
                style={{
                  backgroundColor: 'rgba(239,68,68,0.08)',
                  border: '1px solid rgba(239,68,68,0.15)',
                  color: '#ef4444',
                }}
              >
                {error}
              </div>
            )}

            {/* Content */}
            {!loading && !error && (
              <>
                {/* Desktop table header */}
                <div
                  className="hidden lg:grid grid-cols-12 gap-3 items-center px-4 py-2 text-[9px] font-bold uppercase tracking-[0.12em] text-slate-600 font-mono"
                  style={{ borderBottom: '1px solid rgba(6,182,212,0.06)' }}
                >
                  <span className="col-span-2">Producto</span>
                  <span className="col-span-2">Cliente</span>
                  <span className="col-span-2">Contrato</span>
                  <span className="col-span-1">Estado</span>
                  <span className="col-span-1">Canal</span>
                  <span className="col-span-2">Fecha</span>
                  <span className="col-span-2 text-right">Detalle</span>
                </div>

                {/* List */}
                <div className="max-h-[600px] overflow-y-auto custom-scrollbar">
                  {filteredEntregas.length === 0 ? (
                    <EmptyState />
                  ) : (
                    <>
                      {/* Mobile cards */}
                      <div className="lg:hidden space-y-2">
                        {filteredEntregas.map((entrega) => (
                          <EntregaCard
                            key={entrega.id}
                            entrega={entrega}
                            onClick={() => goToContrato(entrega.contratoId)}
                          />
                        ))}
                      </div>

                      {/* Desktop rows */}
                      <div className="hidden lg:block">
                        {filteredEntregas.map((entrega) => (
                          <EntregaRow
                            key={entrega.id}
                            entrega={entrega}
                            onClick={() => goToContrato(entrega.contratoId)}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* Pagination */}
                {total > 0 && (
                  <div
                    className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-3"
                    style={{ borderTop: '1px solid rgba(6,182,212,0.06)' }}
                  >
                    {/* Showing indicator */}
                    <span className="text-[10px] font-mono text-slate-600">
                      Mostrando {fromItem}-{toItem} de {total}
                    </span>

                    <div className="flex items-center gap-2">
                      {/* Page size */}
                      <select
                        value={limit}
                        onChange={(e) => setLimit(Number(e.target.value))}
                        className="h-7 rounded text-[10px] font-mono bg-transparent border border-slate-800 text-slate-400 px-2 focus:outline-none focus:border-cyan-500/40"
                      >
                        <option value="20" className="bg-slate-900">20</option>
                        <option value="50" className="bg-slate-900">50</option>
                        <option value="100" className="bg-slate-900">100</option>
                      </select>

                      {/* Prev / Next */}
                      <button
                        type="button"
                        disabled={page <= 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono uppercase tracking-wider transition-all hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed"
                        style={{
                          color: '#64748b',
                          border: '1px solid rgba(100,116,139,0.15)',
                        }}
                      >
                        <ChevronLeft className="w-3 h-3" />
                        Anterior
                      </button>

                      <span className="text-[10px] font-mono text-slate-500 px-1">
                        {page} / {totalPages}
                      </span>

                      <button
                        type="button"
                        disabled={page >= totalPages}
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono uppercase tracking-wider transition-all hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed"
                        style={{
                          color: '#64748b',
                          border: '1px solid rgba(100,116,139,0.15)',
                        }}
                      >
                        Siguiente
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </PanelShell>
        </div>
      </main>

      {/* ═══ FOOTER ═══ */}
      <footer
        className="relative z-10 flex-shrink-0 px-4 sm:px-6 py-1.5 flex items-center justify-between"
        style={{
          borderTop: '1px solid rgba(6,182,212,0.06)',
          background: 'rgba(5,5,5,0.9)',
        }}
      >
        <span className="text-[9px] font-mono text-slate-700">
          ONION200 v2.0 · Gestion de Entregas
        </span>
        <span className="text-[9px] font-mono text-slate-700">
          DECODEX Bolivia · Inteligencia de Senales · 2025-2030
        </span>
      </footer>
    </div>
  );
}
