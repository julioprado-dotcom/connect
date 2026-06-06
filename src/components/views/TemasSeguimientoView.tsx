'use client';

import { useState, useEffect, useCallback } from 'react';
import { Tag, Search } from 'lucide-react';

// Vista: Temas en seguimiento
// SOLO muestra ejes tematicos que estan asignados a al menos un contrato activo
export function TemasSeguimientoView() {
  const [temas, setTemas] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const fetchTemas = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/ejes?seguimiento=true');
      if (!res.ok) throw new Error('Error al cargar temas en seguimiento');
      const json = await res.json();
      setTemas(json.ejes || json || []);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTemas(); }, [fetchTemas]);

  const filtered = temas.filter((t: Record<string, unknown>) => {
    const nombre = String(t.nombre || '').toLowerCase();
    const slug = String(t.slug || '').toLowerCase();
    return nombre.includes(search.toLowerCase()) || slug.includes(search.toLowerCase());
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
            <Tag className="h-5 w-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Temas en seguimiento</h2>
            <p className="text-xs text-muted-foreground">
              Ejes tematicos asignados a contratos activos ({filtered.length})
            </p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Buscar tema..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="space-y-3 animate-pulse">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-14 bg-muted rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <Tag className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">
            {search ? 'Sin resultados para la busqueda' : 'No hay temas asignados a contratos activos'}
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Asigna ejes tematicos desde Gestion Comercial &gt; Contratos
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((t: Record<string, unknown>) => {
            const color = String(t.color || '#6366f1');
            return (
              <div
                key={String(t.id)}
                className="p-3 rounded-lg border border-border bg-card hover:bg-accent/30 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className="h-3 w-3 rounded-full shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {String(t.nombre || '')}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {String(t.slug || '')}
                    </p>
                  </div>
                </div>
                {String(t.descripcion || '').length > 0 && (
                  <p className="text-xs text-muted-foreground/70 mt-2 line-clamp-2">
                    {String(t.descripcion)}
                  </p>
                )}
                <div className="mt-2">
                  <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                    En seguimiento
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
