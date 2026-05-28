'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { PanelShell } from '@/components/onion200/PanelShell';
import { ALL_PRODUCTS } from '@/constants/nav';
import { fetchWithTimeout } from '@/lib/fetch-utils';
import {
  Users,
  UserCheck,
  FileCheck,
  Search,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Filter,
} from 'lucide-react';

/* ─── Segmentos ──────────────────────────────────────────── */
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

const ESTADO_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'activo', label: 'Activo' },
  { value: 'suspendido', label: 'Suspendido' },
  { value: 'cancelado', label: 'Cancelado' },
];

/* ─── Types ──────────────────────────────────────────────── */
interface ClienteRecord {
  id: string;
  nombre: string;
  nombreContacto: string;
  email: string;
  organizacion: string;
  segmento: string;
  plan: string;
  estado: string;
  fechaCreacion: string;
  parlamentariosList: Array<{ id: string; nombre: string; camara: string }>;
  parlamentariosCount: number;
  contratosActivos: number;
}

interface PageData {
  clientes: ClienteRecord[];
  total: number;
  page: number;
  limit: number;
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

/* ─── Stat Card ──────────────────────────────────────────── */
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
      className="rounded-lg p-4 flex items-center gap-3"
      style={{
        background: 'rgba(5, 5, 5, 0.8)',
        border: '1px solid rgba(6, 182, 212, 0.12)',
      }}
    >
      <div
        className="h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{
          backgroundColor: color,
          border: '1px solid rgba(6, 182, 212, 0.2)',
        }}
      >
        {icon}
      </div>
      <div>
        <p
          className="text-[10px] font-mono uppercase tracking-wider"
          style={{ color: '#64748b' }}
        >
          {label}
        </p>
        <p
          className="text-xl font-bold font-mono leading-tight"
          style={{ color: '#e5e5e5' }}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

/* ─── Empty state ────────────────────────────────────────── */
function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div
        className="h-12 w-12 rounded-full flex items-center justify-center mb-3"
        style={{
          backgroundColor: 'rgba(6, 182, 212, 0.08)',
          border: '1px solid rgba(6, 182, 212, 0.15)',
        }}
      >
        <Users className="h-5 w-5" style={{ color: '#06b6d4' }} />
      </div>
      <p className="text-sm" style={{ color: '#64748b' }}>
        {message}
      </p>
    </div>
  );
}

/* ─── MAIN COMPONENT ─────────────────────────────────────── */
export default function ClientesListPage() {
  const router = useRouter();

  // Filters
  const [search, setSearch] = useState('');
  const [estadoFilter, setEstadoFilter] = useState('');
  const [segmentoFilter, setSegmentoFilter] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  // Data
  const [data, setData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Stats
  const [stats, setStats] = useState({ total: 0, activos: 0, conContratos: 0 });

  // Debounced fetch
  const fetchData = useCallback(async (p: number, s: string, e: string, seg: string) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('page', String(p));
      params.set('limit', String(limit));
      if (s) params.set('search', s);
      if (e) params.set('estado', e);
      if (seg) params.set('segmento', seg);

      const res = await fetchWithTimeout(`/api/clientes?${params.toString()}`, { timeoutMs: 15000 });
      if (!res.ok) throw new Error('Error al cargar clientes');

      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, [limit]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetchWithTimeout('/api/clientes?limit=1000', { timeoutMs: 15000 });
      if (!res.ok) return;
      const json = await res.json();
      const all = json.clientes || [];
      setStats({
        total: json.total || all.length,
        activos: all.filter((c: ClienteRecord) => c.estado === 'activo').length,
        conContratos: all.filter((c: ClienteRecord) => c.contratosActivos > 0).length,
      });
    } catch {
      // Silently fail stats
    }
  }, []);

  useEffect(() => {
    fetchData(page, search, estadoFilter, segmentoFilter);
  }, [fetchData, page, search, estadoFilter, segmentoFilter]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Reset page on filter change
  useEffect(() => {
    setPage(1);
  }, [search, estadoFilter, segmentoFilter]);

  const totalPages = data ? Math.ceil(data.total / limit) : 0;

  return (
    <div className="space-y-4 pb-4">
      {/* Page title */}
      <div>
        <h1
          className="text-lg font-bold font-mono uppercase tracking-wider"
          style={{ color: '#06b6d4' }}
        >
          Clientes
        </h1>
        <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>
          Gestión comercial · Directorio de clientes
        </p>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard
          icon={<Users className="h-4 w-4" style={{ color: '#06b6d4' }} />}
          label="Total Clientes"
          value={stats.total}
          color="rgba(6, 182, 212, 0.1)"
        />
        <StatCard
          icon={<UserCheck className="h-4 w-4" style={{ color: '#34d399' }} />}
          label="Activos"
          value={stats.activos}
          color="rgba(16, 185, 129, 0.1)"
        />
        <StatCard
          icon={<FileCheck className="h-4 w-4" style={{ color: '#fbbf24' }} />}
          label="Con Contratos"
          value={stats.conContratos}
          color="rgba(245, 158, 11, 0.1)"
        />
      </div>

      {/* Search + Filters */}
      <PanelShell
        title="Filtros de Búsqueda"
        icon={<Filter className="h-3.5 w-3.5" />}
      >
        <div className="space-y-3">
          {/* Search */}
          <div className="relative">
            <Search
              className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5"
              style={{ color: '#475569' }}
            />
            <Input
              placeholder="Buscar por nombre, email, organización..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs font-mono"
              style={{
                backgroundColor: '#0a0e17',
                borderColor: 'rgba(6, 182, 212, 0.12)',
                color: '#e5e5e5',
              }}
            />
          </div>

          {/* Filter row */}
          <div className="flex flex-col sm:flex-row gap-2">
            {/* Estado */}
            <div className="flex-1">
              <p
                className="text-[10px] font-mono uppercase tracking-wider mb-1"
                style={{ color: '#475569' }}
              >
                Estado
              </p>
              <div className="flex gap-1.5">
                {ESTADO_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setEstadoFilter(opt.value)}
                    className="h-7 rounded-lg text-[10px] font-mono px-2.5 transition-all"
                    style={{
                      backgroundColor: estadoFilter === opt.value
                        ? 'rgba(6, 182, 212, 0.15)'
                        : 'rgba(15, 23, 42, 0.6)',
                      border: estadoFilter === opt.value
                        ? '1px solid rgba(6, 182, 212, 0.3)'
                        : '1px solid rgba(6, 182, 212, 0.06)',
                      color: estadoFilter === opt.value ? '#06b6d4' : '#64748b',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Segmento */}
            <div className="flex-1">
              <p
                className="text-[10px] font-mono uppercase tracking-wider mb-1"
                style={{ color: '#475569' }}
              >
                Segmento
              </p>
              <select
                value={segmentoFilter}
                onChange={(e) => setSegmentoFilter(e.target.value)}
                className="h-7 w-full rounded-lg text-[10px] font-mono px-2.5 appearance-none cursor-pointer"
                style={{
                  backgroundColor: '#0a0e17',
                  border: segmentoFilter
                    ? '1px solid rgba(6, 182, 212, 0.3)'
                    : '1px solid rgba(6, 182, 212, 0.06)',
                  color: segmentoFilter ? '#06b6d4' : '#64748b',
                }}
              >
                <option value="">Todos los segmentos</option>
                {SEGMENTOS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </PanelShell>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin" style={{ color: '#06b6d4' }} />
          <span className="text-xs ml-2 font-mono" style={{ color: '#64748b' }}>
            Cargando clientes...
          </span>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div
          className="rounded-lg px-4 py-3 text-xs font-mono"
          style={{
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            color: '#f87171',
          }}
        >
          {error}
        </div>
      )}

      {/* Results */}
      {!loading && !error && (
        <>
          {/* Results count */}
          {data && data.total > 0 && (
            <p className="text-[10px] font-mono" style={{ color: '#475569' }}>
              {data.total} cliente{data.total !== 1 ? 's' : ''} encontrado{data.total !== 1 ? 's' : ''}
            </p>
          )}

          {/* Empty state */}
          {data && data.clientes.length === 0 && (
            <EmptyState message="No se encontraron clientes con los filtros seleccionados." />
          )}

          {/* Desktop table */}
          {data && data.clientes.length > 0 && (
            <>
              {/* Desktop: table view */}
              <div className="hidden md:block">
                <div
                  className="rounded-lg overflow-hidden"
                  style={{
                    background: 'rgba(5, 5, 5, 0.8)',
                    border: '1px solid rgba(6, 182, 212, 0.12)',
                  }}
                >
                  {/* Table header */}
                  <div
                    className="grid grid-cols-[1fr_1.2fr_0.8fr_0.7fr_0.7fr_0.7fr_0.5fr_0.7fr] gap-2 px-4 py-2.5 text-[10px] font-mono uppercase tracking-wider"
                    style={{
                      backgroundColor: '#0d1321',
                      borderBottom: '1px solid rgba(6, 182, 212, 0.08)',
                      color: '#475569',
                    }}
                  >
                    <span>Nombre</span>
                    <span>Email</span>
                    <span>Organización</span>
                    <span>Segmento</span>
                    <span>Plan</span>
                    <span>Estado</span>
                    <span>Contratos</span>
                    <span>Registro</span>
                  </div>

                  {/* Table rows */}
                  {data.clientes.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => router.push(`/clientes/${c.id}`)}
                      className="w-full text-left grid grid-cols-[1fr_1.2fr_0.8fr_0.7fr_0.7fr_0.7fr_0.5fr_0.7fr] gap-2 px-4 py-3 items-center transition-colors hover:bg-cyan-900/10"
                      style={{
                        borderBottom: '1px solid rgba(6, 182, 212, 0.04)',
                      }}
                    >
                      <span
                        className="text-xs font-mono truncate"
                        style={{ color: '#e5e5e5' }}
                        title={c.nombre}
                      >
                        {c.nombre}
                      </span>
                      <span
                        className="text-[11px] font-mono truncate"
                        style={{ color: '#94a3b8' }}
                        title={c.email}
                      >
                        {c.email}
                      </span>
                      <span
                        className="text-[11px] font-mono truncate"
                        style={{ color: '#94a3b8' }}
                        title={c.organizacion}
                      >
                        {c.organizacion || '—'}
                      </span>
                      <span>
                        <Badge
                          variant="outline"
                          className="text-[9px] font-mono px-1.5 py-0"
                          style={{
                            borderColor: 'rgba(6, 182, 212, 0.15)',
                            color: '#06b6d4',
                            backgroundColor: 'rgba(6, 182, 212, 0.06)',
                          }}
                        >
                          {SEGMENTO_LABELS[c.segmento] || c.segmento}
                        </Badge>
                      </span>
                      <span
                        className="text-[11px] font-mono capitalize"
                        style={{ color: '#94a3b8' }}
                      >
                        {c.plan}
                      </span>
                      <span>
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-medium"
                          style={estadoColor(c.estado)}
                        >
                          {c.estado}
                        </span>
                      </span>
                      <span
                        className="text-xs font-mono text-center"
                        style={{
                          color: c.contratosActivos > 0 ? '#34d399' : '#475569',
                        }}
                      >
                        {c.contratosActivos}
                      </span>
                      <span
                        className="text-[10px] font-mono"
                        style={{ color: '#475569' }}
                      >
                        {formatDate(c.fechaCreacion)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Mobile: card view */}
              <div className="md:hidden space-y-2">
                {data.clientes.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => router.push(`/clientes/${c.id}`)}
                    className="w-full text-left rounded-lg p-3 transition-colors"
                    style={{
                      background: 'rgba(5, 5, 5, 0.8)',
                      border: '1px solid rgba(6, 182, 212, 0.12)',
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-sm font-mono font-medium truncate"
                          style={{ color: '#e5e5e5' }}
                        >
                          {c.nombre}
                        </p>
                        <p
                          className="text-[11px] font-mono truncate mt-0.5"
                          style={{ color: '#64748b' }}
                        >
                          {c.email}
                        </p>
                      </div>
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-medium flex-shrink-0"
                        style={estadoColor(c.estado)}
                      >
                        {c.estado}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      {c.organizacion && (
                        <span
                          className="text-[10px] font-mono"
                          style={{ color: '#94a3b8' }}
                        >
                          {c.organizacion}
                        </span>
                      )}
                      <Badge
                        variant="outline"
                        className="text-[9px] font-mono px-1.5 py-0"
                        style={{
                          borderColor: 'rgba(6, 182, 212, 0.15)',
                          color: '#06b6d4',
                          backgroundColor: 'rgba(6, 182, 212, 0.06)',
                        }}
                      >
                        {SEGMENTO_LABELS[c.segmento] || c.segmento}
                      </Badge>
                      {c.contratosActivos > 0 && (
                        <span
                          className="text-[10px] font-mono"
                          style={{ color: '#34d399' }}
                        >
                          {c.contratosActivos} contrato{c.contratosActivos > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                  <p
                    className="text-[10px] font-mono"
                    style={{ color: '#475569' }}
                  >
                    Página {data.page} de {totalPages}
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      className="h-7 px-3 rounded-lg text-[10px] font-mono transition-colors disabled:opacity-30"
                      style={{
                        backgroundColor: 'rgba(6, 182, 212, 0.08)',
                        border: '1px solid rgba(6, 182, 212, 0.15)',
                        color: '#06b6d4',
                      }}
                    >
                      <ChevronLeft className="h-3 w-3 inline mr-1" />
                      Anterior
                    </button>
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                      className="h-7 px-3 rounded-lg text-[10px] font-mono transition-colors disabled:opacity-30"
                      style={{
                        backgroundColor: 'rgba(6, 182, 212, 0.08)',
                        border: '1px solid rgba(6, 182, 212, 0.15)',
                        color: '#06b6d4',
                      }}
                    >
                      Siguiente
                      <ChevronRight className="h-3 w-3 inline ml-1" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
