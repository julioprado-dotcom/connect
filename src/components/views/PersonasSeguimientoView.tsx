'use client';

import { useState, useEffect, useCallback } from 'react';
import { UsersRound, Search, Filter } from 'lucide-react';

// Vista: Personas en seguimiento
// SOLO muestra personas que estan asignadas a al menos un contrato activo
export function PersonasSeguimientoView() {
  const [personas, setPersonas] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const fetchPersonas = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/personas?seguimiento=true');
      if (!res.ok) throw new Error('Error al cargar personas en seguimiento');
      const json = await res.json();
      setPersonas(json.personas || json || []);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPersonas(); }, [fetchPersonas]);

  const filtered = personas.filter((p: Record<string, unknown>) => {
    const nombre = String(p.nombre || '').toLowerCase();
    return nombre.includes(search.toLowerCase());
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
            <UsersRound className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Personas en seguimiento</h2>
            <p className="text-xs text-muted-foreground">
              Personas asignadas a contratos activos ({filtered.length})
            </p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Buscar persona..."
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
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-14 bg-muted rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <UsersRound className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">
            {search ? 'Sin resultados para la busqueda' : 'No hay personas asignadas a contratos activos'}
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Asigna personas desde Gestion Comercial &gt; Contratos
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((p: Record<string, unknown>) => (
            <div
              key={String(p.id)}
              className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:bg-accent/30 transition-colors"
            >
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
                {String(p.nombre || '??').charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">
                  {String(p.nombre || '')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {String(p.partidoSigla || '')} &middot; {String(p.camara || '')} &middot; {String(p.departamento || '')}
                </p>
              </div>
              <div className="text-right shrink-0">
                <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                  En seguimiento
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
