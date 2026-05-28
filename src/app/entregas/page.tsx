'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { fetchWithTimeout } from '@/lib/fetch-utils';
import { PanelShell } from '@/components/onion200/PanelShell';
import { usePageColors } from '@/components/sub-page-shell';
import {
  Send,
  AlertCircle,
  Clock,
  Package,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import type {
  EntregaRecord,
  EntregasStats,
  EntregasResponse,
} from './_components/EntregaComponents';
import {
  StatCard,
  EntregaRow,
  EntregaCard,
  EmptyState,
} from './_components/EntregaComponents';

/* ─── MAIN PAGE ────────────────────────────────────────────── */
export default function EntregasPage() {
  const router = useRouter();
  const colors = usePageColors();

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
    <div className="space-y-4">
      {/* ═══ Page title ═══ */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-sm font-bold tracking-[0.15em] font-mono uppercase" style={{ color: colors.text }}>
            Gestion de Entregas
          </h1>
          <p className="text-[10px] tracking-wider font-mono" style={{ color: colors.textMuted }}>
            Seguimiento de entregas de productos ONION200
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-1.5">
          <span
            className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"
            style={{ boxShadow: '0 0 6px rgba(16,185,129,0.5)' }}
          />
          <span className="text-[9px] font-bold uppercase text-emerald-500/60 font-mono">
            en vivo
          </span>
        </div>
      </div>

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
  );
}
