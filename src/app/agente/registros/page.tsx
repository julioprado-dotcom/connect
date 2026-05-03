'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, UserCircle, FileCheck, Loader2 } from 'lucide-react';
import { ALL_PRODUCTS } from '@/constants/nav';

/* ─── Types ───────────────────────────────────────────────── */
interface ClienteRecord {
  id: string;
  nombre: string;
  email: string;
  organizacion: string;
  segmento: string;
  estado: string;
  fechaCreacion: string;
  contratosActivos?: number;
}

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
  cliente: { id: string; nombre: string; email: string };
}

type FilterType = 'hoy' | 'semana' | 'todos';

/* ─── Date helpers ────────────────────────────────────────── */
function isToday(dateStr: string): boolean {
  const d = new Date(dateStr);
  const today = new Date();
  return (
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  );
}

function isThisWeek(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  return d >= startOfWeek;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-BO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/* ─── Filter buttons ──────────────────────────────────────── */
function FilterBar({
  active,
  onChange,
}: {
  active: FilterType;
  onChange: (f: FilterType) => void;
}) {
  const filters: { key: FilterType; label: string }[] = [
    { key: 'hoy', label: 'Hoy' },
    { key: 'semana', label: 'Esta semana' },
    { key: 'todos', label: 'Todos' },
  ];

  return (
    <div className="flex gap-2">
      {filters.map((f) => (
        <button
          key={f.key}
          type="button"
          onClick={() => onChange(f.key)}
          className={`h-7 rounded-lg text-xs font-medium px-3 transition-colors ${
            active === f.key
              ? 'bg-emerald-600 text-white'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}

/* ─── Empty state ─────────────────────────────────────────── */
function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

/* ─── MAIN COMPONENT ──────────────────────────────────────── */
export default function RegistrosPage() {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterType>('todos');
  const [clientes, setClientes] = useState<ClienteRecord[]>([]);
  const [contratos, setContratos] = useState<ContratoRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError('');

      try {
        const [clientRes, contractRes] = await Promise.all([
          fetch('/api/clientes?limit=10'),
          fetch('/api/contratos?limit=10'),
        ]);

        if (!clientRes.ok || !contractRes.ok) {
          throw new Error('Error al cargar registros');
        }

        const clientData = await clientRes.json();
        const contractData = await contractRes.json();

        if (!cancelled) {
          setClientes(clientData.clientes || []);
          setContratos(contractData.contratos || []);
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

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredClientes = clientes.filter((c) => {
    if (filter === 'hoy') return isToday(c.fechaCreacion);
    if (filter === 'semana') return isThisWeek(c.fechaCreacion);
    return true;
  });

  const filteredContratos = contratos.filter((c) => {
    if (filter === 'hoy') return isToday(c.fechaCreacion);
    if (filter === 'semana') return isThisWeek(c.fechaCreacion);
    return true;
  });

  const getProductName = (tipo: string) => {
    const prod = ALL_PRODUCTS.find((p) => p.tipo === tipo);
    return prod?.nombre || tipo;
  };

  return (
    <div className="space-y-4 pb-4">
      {/* Back to home */}
      <button
        type="button"
        onClick={() => router.push('/agente')}
        className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
      >
        <ArrowLeft className="h-3 w-3" />
        Volver al portal
      </button>

      <div>
        <h1 className="text-base font-bold text-foreground">Mis Registros</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          &Uacute;ltimos clientes y contratos registrados.
        </p>
      </div>

      {/* Filter */}
      <FilterBar active={filter} onChange={setFilter} />

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground ml-2">Cargando...</span>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2 text-xs text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Clients */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <UserCircle className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">
                Clientes
                <span className="text-xs font-normal text-muted-foreground ml-1.5">
                  ({filteredClientes.length})
                </span>
              </h2>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {filteredClientes.length === 0 ? (
                <EmptyState message="No hay clientes registrados con este filtro." />
              ) : (
                filteredClientes.map((c) => (
                  <Card key={c.id} size="sm">
                    <CardContent className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {c.nombre}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {c.email}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <Badge
                            variant={c.estado === 'activo' ? 'default' : 'secondary'}
                            className="text-[10px] px-1.5 py-0"
                          >
                            {c.estado}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">
                            {formatDate(c.fechaCreacion)}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>

          {/* Contracts */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <FileCheck className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">
                Contratos
                <span className="text-xs font-normal text-muted-foreground ml-1.5">
                  ({filteredContratos.length})
                </span>
              </h2>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {filteredContratos.length === 0 ? (
                <EmptyState message="No hay contratos registrados con este filtro." />
              ) : (
                filteredContratos.map((c) => (
                  <Card key={c.id} size="sm">
                    <CardContent className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-foreground">
                            {getProductName(c.tipoProducto)}
                          </p>
                          <Badge
                            variant={c.estado === 'activo' ? 'default' : 'secondary'}
                            className="text-[10px] px-1.5 py-0"
                          >
                            {c.estado}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Cliente: {c.cliente?.nombre || 'N/A'}
                        </p>
                        <div className="flex items-center gap-3 mt-1.5">
                          {c.montoMensual > 0 && (
                            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                              Bs {c.montoMensual.toLocaleString('es-BO', { minimumFractionDigits: 0 })}
                            </span>
                          )}
                          <span className="text-[10px] text-muted-foreground">
                            {formatDate(c.fechaCreacion)}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
