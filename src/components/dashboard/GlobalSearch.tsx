'use client';

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  X,
  Tag,
  User,
  FileText,
  Radio,
  GitBranch,
  Eye,
  Package,
  Loader2,
  Zap,
  ChevronRight,
} from 'lucide-react';

// ─── Tipos ──────────────────────────────────────────────────

interface SearchResultItem {
  id: string;
  nombre: string;
  tipo: string;
  partidoSigla?: string;
  mencionesCount?: number;
  url?: string;
  estado?: string;
  mencionesHoy?: number;
  titulo?: string;
  medioNombre?: string;
  fechaCaptura?: string;
  snippet?: string;
  ultimaEdicion?: string | null;
}

interface SearchResultCategory {
  key: string;
  label: string;
  icon: React.ElementType;
  items: SearchResultItem[];
}

interface CompositeAnalysis {
  terminos: string[];
  mencionesCount: number;
  fuentesCount: number;
  ejePredominante?: string;
}

interface SearchResults {
  keywords: SearchResultItem[];
  personas: SearchResultItem[];
  menciones: SearchResultItem[];
  fuentes: SearchResultItem[];
  productos: SearchResultItem[];
  compositeAnalysis?: CompositeAnalysis;
}

// ─── Mapa de iconos por categoría ──────────────────────────

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  keywords: Tag,
  personas: User,
  menciones: FileText,
  fuentes: Radio,
  productos: Package,
  lentes: Eye,
  ejes: GitBranch,
};

const CATEGORY_LABELS: Record<string, string> = {
  keywords: 'Keywords',
  personas: 'Personas',
  menciones: 'Menciones',
  fuentes: 'Fuentes',
  productos: 'Productos',
  lentes: 'Lentes',
  ejes: 'Ejes',
};

// ─── Helper: Formatear metadata ────────────────────────────

function formatMetadata(item: SearchResultItem, categoryKey: string): string {
  switch (categoryKey) {
    case 'keywords':
    case 'ejes':
    case 'lentes': {
      const parts: string[] = [];
      if (item.tipo === 'eje' || item.tipo === 'lente') parts.push(`Tipo: ${item.tipo}`);
      if (item.mencionesCount !== undefined && item.mencionesCount > 0)
        parts.push(`${item.mencionesCount} menciones`);
      return parts.join(', ') || item.tipo;
    }
    case 'personas': {
      const parts: string[] = [];
      if (item.partidoSigla) parts.push(item.partidoSigla);
      if (item.mencionesCount !== undefined) parts.push(`${item.mencionesCount} menciones`);
      return parts.join(', ') || item.tipo;
    }
    case 'menciones': {
      const parts: string[] = [];
      if (item.medioNombre) parts.push(`Fuente: ${item.medioNombre}`);
      if (item.fechaCaptura) {
        const d = new Date(item.fechaCaptura);
        parts.push(d.toLocaleDateString('es-BO', { day: 'numeric', month: 'short' }));
      }
      return parts.join(', ');
    }
    case 'fuentes': {
      const parts: string[] = [];
      if (item.estado) parts.push(item.estado);
      if (item.mencionesHoy !== undefined) parts.push(`${item.mencionesHoy} hoy`);
      return parts.join(', ');
    }
    case 'productos': {
      if (item.ultimaEdicion) {
        const d = new Date(item.ultimaEdicion);
        return `Última: ${d.toLocaleDateString('es-BO', { day: 'numeric', month: 'short' })}`;
      }
      return item.tipo || 'Producto';
    }
    default:
      return '';
  }
}

// ─── Debounce hook ─────────────────────────────────────────

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

// ─── Componente principal ──────────────────────────────────

export function GlobalSearch() {
  const [query, setQuery] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [results, setResults] = useState<SearchResults | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [error, setError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const debouncedQuery = useDebounce(query, 300);

  // ─── Click outside ────────────────────────────────────
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsExpanded(false);
        setSelectedIndex(-1);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ─── Ctrl+K / Cmd+K shortcut ──────────────────────────
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        if (isExpanded && document.activeElement === inputRef.current) {
          setIsExpanded(false);
          inputRef.current?.blur();
        } else {
          setIsExpanded(true);
          setTimeout(() => inputRef.current?.focus(), 50);
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isExpanded]);

  // ─── Ejecutar búsqueda cuando debouncedQuery cambia ──
  // Ref-based approach to avoid lint cascading-render warning
  const fetchResultsRef = useRef<(q: string) => void>(() => {});

  useEffect(() => {
    fetchResultsRef.current = (searchQuery: string) => {
      if (!searchQuery.trim()) {
        setResults(null);
        return;
      }
      // Cancelar petición anterior
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      let cancelled = false;

      setIsLoading(true);
      setError(null);

      fetch(`/api/dashboard/search?q=${encodeURIComponent(searchQuery)}`, {
        signal: controller.signal,
      })
        .then(async (res) => {
          if (cancelled) return;
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || 'Error en la búsqueda');
          }
          const data: SearchResults = await res.json();
          if (cancelled) return;
          setResults(data);
          setSelectedIndex(-1);
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          if (err instanceof DOMException && err.name === 'AbortError') return;
          setError(err instanceof Error ? err.message : 'Error desconocido');
          setResults(null);
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false);
        });

      return () => {
        cancelled = true;
      };
    };
  });

  // Effect that runs on debouncedQuery change
  useEffect(() => {
    fetchResultsRef.current(debouncedQuery);
  }, [debouncedQuery]);

  // ─── Agrupar resultados por categoría ─────────────────
  const categories = useMemo((): SearchResultCategory[] => {
    if (!results) return [];

    const cats: SearchResultCategory[] = [];

    // Ejes (subset of keywords)
    const ejes = results.keywords.filter(k => k.tipo === 'eje');
    if (ejes.length > 0) {
      cats.push({ key: 'ejes', label: 'Ejes', icon: GitBranch, items: ejes });
    }

    // Lentes (subset of keywords)
    const lentes = results.keywords.filter(k => k.tipo === 'lente');
    if (lentes.length > 0) {
      cats.push({ key: 'lentes', label: 'Lentes', icon: Eye, items: lentes });
    }

    // Remaining keywords
    const rawKeywords = results.keywords.filter(k => k.tipo !== 'eje' && k.tipo !== 'lente');
    if (rawKeywords.length > 0) {
      cats.push({ key: 'keywords', label: 'Keywords', icon: Tag, items: rawKeywords });
    }

    if (results.personas.length > 0) {
      cats.push({ key: 'personas', label: 'Personas', icon: User, items: results.personas });
    }
    if (results.menciones.length > 0) {
      cats.push({ key: 'menciones', label: 'Menciones', icon: FileText, items: results.menciones });
    }
    if (results.fuentes.length > 0) {
      cats.push({ key: 'fuentes', label: 'Fuentes', icon: Radio, items: results.fuentes });
    }
    if (results.productos.length > 0) {
      cats.push({ key: 'productos', label: 'Productos', icon: Package, items: results.productos });
    }

    return cats;
  }, [results]);

  // ─── Total de resultados para navegación ──────────────
  const totalItems = useMemo(
    () => categories.reduce((sum, cat) => sum + cat.items.length, 0),
    [categories]
  );

  // ─── Navegación con teclado ───────────────────────────
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsExpanded(false);
        inputRef.current?.blur();
        setSelectedIndex(-1);
        return;
      }

      if (!isExpanded || categories.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev < totalItems - 1 ? prev + 1 : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : totalItems - 1));
      } else if (e.key === 'Enter' && selectedIndex >= 0) {
        e.preventDefault();
        // Seleccionar resultado (podría navegar, por ahora solo cerrar)
        setIsExpanded(false);
        inputRef.current?.blur();
      }
    },
    [isExpanded, categories, totalItems, selectedIndex]
  );

  // ─── Construir lista plana para índice global ─────────
  const flatItems = useMemo(() => {
    const items: Array<{ item: SearchResultItem; categoryKey: string }> = [];
    for (const cat of categories) {
      for (const item of cat.items) {
        items.push({ item, categoryKey: cat.key });
      }
    }
    return items;
  }, [categories]);

  // ─── Renderizar ítem de resultado ─────────────────────
  const renderResultItem = useCallback(
    (item: SearchResultItem, catKey: string, globalIdx: number) => {
      const isSelected = globalIdx === selectedIndex;
      const Icon = CATEGORY_ICONS[catKey] || FileText;
      const metadata = formatMetadata(item, catKey);

      return (
        <div
          key={`${catKey}-${item.id}`}
          className={`
            flex items-center gap-3 px-3 py-2 cursor-pointer rounded-md
            transition-colors duration-100
            ${isSelected ? 'bg-[#1a1a2e]' : 'hover:bg-[#1a1a2e]/60'}
          `}
          onClick={() => {
            setIsExpanded(false);
            inputRef.current?.blur();
          }}
          onMouseEnter={() => setSelectedIndex(globalIdx)}
        >
          {/* Icono de tipo */}
          <div
            className={`
              flex items-center justify-center h-7 w-7 rounded-md shrink-0
              ${isSelected ? 'bg-[#00ff88]/20' : 'bg-white/5'}
            `}
          >
            <Icon
              className={`h-3.5 w-3.5 ${isSelected ? 'text-[#00ff88]' : 'text-white/50'}`}
            />
          </div>

          {/* Contenido */}
          <div className="flex-1 min-w-0">
            <p
              className={`text-sm font-semibold truncate ${
                isSelected ? 'text-white' : 'text-white/90'
              }`}
            >
              {item.titulo || item.nombre}
            </p>
            {metadata && (
              <p className="text-[11px] text-white/40 truncate mt-0.5">{metadata}</p>
            )}
          </div>

          {/* Snippet para menciones */}
          {catKey === 'menciones' && item.snippet && (
            <p className="hidden lg:block text-[11px] text-white/30 max-w-[200px] truncate">
              {item.snippet}
            </p>
          )}
        </div>
      );
    },
    [selectedIndex]
  );

  // ─── Detectar si es búsqueda compuesta ─────────────────
  const isCompositeSearch = query.includes(' más ');
  const compositeTerms = isCompositeSearch
    ? query.split(/\s+más\s+/).map(t => t.trim()).filter(Boolean)
    : [];

  // ─── Conteo total por tipo para el label ──────────────
  const categoryCount = useCallback(
    (key: string) => {
      switch (key) {
        case 'ejes':
          return results?.keywords.filter(k => k.tipo === 'eje').length ?? 0;
        case 'lentes':
          return results?.keywords.filter(k => k.tipo === 'lente').length ?? 0;
        case 'keywords':
          return (
            results?.keywords.filter(k => k.tipo !== 'eje' && k.tipo !== 'lente').length ?? 0
          );
        case 'personas':
          return results?.personas.length ?? 0;
        case 'menciones':
          return results?.menciones.length ?? 0;
        case 'fuentes':
          return results?.fuentes.length ?? 0;
        case 'productos':
          return results?.productos.length ?? 0;
        default:
          return 0;
      }
    },
    [results]
  );

  return (
    <div ref={containerRef} className="relative flex items-center">
      {/* ─── Input de búsqueda ────────────────────────── */}
      <div className="relative flex items-center">
        <AnimatePresence>
          {(isExpanded || query) && (
            <motion.div
              initial={{ width: 48, opacity: 0.5 }}
              animate={{ width: 320, opacity: 1 }}
              exit={{ width: 48, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="overflow-hidden"
              style={{ minWidth: 48 }}
            >
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onFocus={() => setIsExpanded(true)}
                onKeyDown={handleKeyDown}
                placeholder="Buscar... (Ctrl+K)"
                className="
                  w-full h-9 pl-9 pr-9 text-sm text-white
                  bg-transparent outline-none
                  placeholder:text-white/30
                  border-b border-[#1a1a2e]
                  focus:border-[#00ff88]/50
                  transition-colors duration-200
                "
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Ícono de búsqueda (siempre visible) */}
        <button
          onClick={() => {
            if (!isExpanded) {
              setIsExpanded(true);
              setTimeout(() => inputRef.current?.focus(), 50);
            } else {
              setIsExpanded(false);
              inputRef.current?.blur();
            }
          }}
          className="
            absolute left-0 top-1/2 -translate-y-1/2
            h-9 w-9 flex items-center justify-center
            text-white/40 hover:text-[#00ff88]
            transition-colors duration-150
            cursor-pointer
          "
          aria-label="Buscar"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
        </button>

        {/* Botón limpiar */}
        {query && (
          <button
            onClick={() => {
              setQuery('');
              setResults(null);
              setError(null);
              inputRef.current?.focus();
            }}
            className="
              absolute right-0 top-1/2 -translate-y-1/2
              h-9 w-9 flex items-center justify-center
              text-white/30 hover:text-white/70
              transition-colors duration-150
            "
            aria-label="Limpiar búsqueda"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}

        {/* Placeholder cuando está colapsado */}
        {!isExpanded && !query && (
          <button
            onClick={() => {
              setIsExpanded(true);
              setTimeout(() => inputRef.current?.focus(), 50);
            }}
            className="
              h-9 px-3 flex items-center gap-2
              text-xs text-white/30 hover:text-white/50
              border border-[#1a1a2e] rounded-md
              hover:border-[#1a1a2e]/80
              transition-all duration-200
              cursor-pointer
            "
          >
            <Search className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Buscar...</span>
            <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-white/5 text-[10px] text-white/25 font-mono">
              Ctrl+K
            </kbd>
          </button>
        )}
      </div>

      {/* ─── Dropdown de resultados ───────────────────── */}
      <AnimatePresence>
        {isExpanded && (debouncedQuery || results || isLoading || error) && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="
              absolute top-full mt-2 left-0 right-0 sm:right-auto sm:left-0
              w-[min(420px,calc(100vw-2rem))]
              rounded-lg border border-[#1a1a2e]
              bg-[#12121a] shadow-2xl shadow-black/50
              z-50 overflow-hidden
            "
          >
            {/* Scrollable results */}
            <div className="max-h-[400px] overflow-y-auto custom-scrollbar p-2">
              {/* Estado de carga */}
              {isLoading && !results && (
                <div className="flex items-center justify-center gap-2 py-8 text-white/40 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Buscando...</span>
                </div>
              )}

              {/* Error */}
              {error && !isLoading && (
                <div className="px-3 py-4 text-center">
                  <p className="text-[#ff3355] text-sm">{error}</p>
                </div>
              )}

              {/* Sin resultados */}
              {results && !isLoading && totalItems === 0 && !error && (
                <div className="px-3 py-8 text-center">
                  <Search className="h-8 w-8 text-white/10 mx-auto mb-2" />
                  <p className="text-white/40 text-sm">
                    No se encontraron resultados para &quot;{debouncedQuery}&quot;
                  </p>
                </div>
              )}

              {/* Grupos de resultados */}
              {results &&
                !isLoading &&
                categories.map((cat) => {
                  const catItems = cat.items;
                  const count = categoryCount(cat.key);
                  const startIdx = flatItems.findIndex(
                    fi => fi.categoryKey === cat.key && fi.item.id === catItems[0]?.id
                  );

                  return (
                    <div key={cat.key} className="mb-1 last:mb-0">
                      {/* Header de categoría */}
                      <div className="flex items-center gap-2 px-3 py-1.5">
                        <cat.icon className="h-3 w-3 text-white/30" />
                        <span className="text-[11px] font-semibold text-white/40 uppercase tracking-wider">
                          {CATEGORY_LABELS[cat.key]} ({count})
                        </span>
                      </div>

                      {/* Items */}
                      {catItems.map((item, idx) =>
                        renderResultItem(item, cat.key, startIdx + idx)
                      )}
                    </div>
                  );
                })}

              {/* Análisis compuesto */}
              {results?.compositeAnalysis && isCompositeSearch && (
                <div className="mt-2 pt-2 border-t border-[#1a1a2e]">
                  <div className="px-3 py-2.5 rounded-md bg-[#00ff88]/5 border border-[#00ff88]/10">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Zap className="h-3.5 w-3.5 text-[#00ff88]" />
                      <span className="text-xs font-semibold text-[#00ff88]">
                        Análisis de convergencia
                      </span>
                    </div>
                    <p className="text-[11px] text-white/60 leading-relaxed">
                      Estos {compositeTerms.length} términos aparecen juntos en{' '}
                      <span className="text-white font-semibold">
                        {results.compositeAnalysis.mencionesCount} menciones
                      </span>{' '}
                      de{' '}
                      <span className="text-white font-semibold">
                        {results.compositeAnalysis.fuentesCount} fuentes
                      </span>
                      .
                      {results.compositeAnalysis.ejePredominante && (
                        <>
                          {' '}Eje predominante:{' '}
                          <span className="text-[#ffaa00] font-semibold">
                            {results.compositeAnalysis.ejePredominante}
                          </span>
                          .
                        </>
                      )}
                    </p>
                    <button
                      className="
                        mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-md
                        bg-[#00ff88]/10 hover:bg-[#00ff88]/20
                        text-[11px] text-[#00ff88] font-semibold
                        transition-colors duration-150
                      "
                      onClick={() => {
                        setIsExpanded(false);
                        inputRef.current?.blur();
                      }}
                    >
                      Crear Boletín Express con estos términos
                      <ChevronRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Footer con hint */}
            <div className="border-t border-[#1a1a2e] px-3 py-2 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-white/20">
                  <kbd className="px-1 py-0.5 rounded bg-white/5 text-[10px] font-mono">↑↓</kbd>{' '}
                  navegar
                </span>
                <span className="text-[10px] text-white/20">
                  <kbd className="px-1 py-0.5 rounded bg-white/5 text-[10px] font-mono">↵</kbd>{' '}
                  seleccionar
                </span>
                <span className="text-[10px] text-white/20">
                  <kbd className="px-1 py-0.5 rounded bg-white/5 text-[10px] font-mono">esc</kbd>{' '}
                  cerrar
                </span>
              </div>
              {isCompositeSearch && (
                <span className="text-[10px] text-[#00ff88]/40">
                  Búsqueda compuesta ({compositeTerms.length} términos)
                </span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default GlobalSearch;
