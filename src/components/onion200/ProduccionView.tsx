'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { fetchWithTimeout } from '@/lib/fetch-utils';
import { PanelShell } from './VitalMonitor';
import {
  FileText, TrendingUp, Clock, Loader2, Play, ChevronDown, ChevronUp,
  Eye, X, CheckCircle2, AlertTriangle, Zap, Package,
} from 'lucide-react';
import { ALL_PRODUCTS } from '@/constants/nav';
import type { LucideIcon } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

interface ProductoSummary {
  total: number;
  hoy: number;
  semana: number;
  tipos?: Record<string, number>;
}

interface ProduccionData {
  productos?: ProductoSummary;
  status?: string;
  recientes?: Array<{
    id: string;
    tipo: string;
    titulo: string;
    fechaCreacion: string;
    estado: string;
  }>;
}

interface CatalogProduct {
  tipo: string;
  nombre: string;
  estado: string;
  categoria: string;
  ultimaEdicion: string | null;
  ultimoId: string | null;
}

interface EjeItem {
  slug: string;
  nombre: string;
}

interface PersonaItem {
  id: string;
  nombre: string;
  tipo?: string;
}

interface UltimoProduct {
  id: string;
  tipo: string;
  titulo: string;
  contenido: string;
  resumen: string;
  fechaCreacion: string;
  metadata: Record<string, unknown>;
}

interface Notification {
  id: string;
  tipo: 'success' | 'error';
  message: string;
  detail?: string;
  timestamp: number;
}

// ═══════════════════════════════════════════════════════════════
// Category helpers
// ═══════════════════════════════════════════════════════════════

const CATEGORY_ORDER = ['premium', 'premium_mid', 'premium_alta', 'gratuito'];

const CATEGORY_COLORS: Record<string, string> = {
  premium: '#f59e0b',
  premium_mid: '#a78bfa',
  premium_alta: '#f43f5e',
  gratuito: '#10b981',
};

const CATEGORY_LABELS: Record<string, string> = {
  premium: 'Premium',
  premium_mid: 'Premium Mid',
  premium_alta: 'Premium Alta',
  gratuito: 'Gratuito',
};

const CATEGORY_BG: Record<string, string> = {
  premium: 'rgba(245,158,11,0.06)',
  premium_mid: 'rgba(167,139,250,0.06)',
  premium_alta: 'rgba(244,63,94,0.06)',
  gratuito: 'rgba(16,185,129,0.06)',
};

// Get icon + color from ALL_PRODUCTS for a given tipo
function getProductMeta(tipo: string): { icon: LucideIcon; color: string } {
  const found = ALL_PRODUCTS.find((p) => p.tipo === tipo);
  return found
    ? { icon: found.icon, color: found.color }
    : { icon: FileText, color: '#64748b' };
}

// ═══════════════════════════════════════════════════════════════
// Inline Toast Notification
// ═══════════════════════════════════════════════════════════════

function InlineToast({ notif, onDismiss }: { notif: Notification; onDismiss: () => void }) {
  const isError = notif.tipo === 'error';
  const borderColor = isError ? 'rgba(244,63,94,0.2)' : 'rgba(16,185,129,0.2)';
  const bgColor = isError ? 'rgba(244,63,94,0.06)' : 'rgba(16,185,129,0.06)';
  const iconColor = isError ? '#f43f5e' : '#10b981';
  const Icon = isError ? AlertTriangle : CheckCircle2;

  return (
    <div
      className="flex items-start gap-2 px-3 py-2.5 rounded-md animate-in fade-in slide-in-from-top-1 duration-200"
      style={{
        backgroundColor: bgColor,
        border: `1px solid ${borderColor}`,
      }}
    >
      <Icon className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: iconColor }} />
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-mono" style={{ color: iconColor }}>
          {notif.message}
        </p>
        {notif.detail && (
          <p className="text-[9px] font-mono text-slate-500 mt-0.5 truncate">
            {notif.detail}
          </p>
        )}
      </div>
      <button
        onClick={onDismiss}
        className="text-slate-600 hover:text-slate-400 transition-colors shrink-0"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Product Mini Card
// ═══════════════════════════════════════════════════════════════

function ProductMiniCard({
  product,
  onGenerate,
  isGenerating,
}: {
  product: CatalogProduct;
  onGenerate: (tipo: string) => void;
  isGenerating: boolean;
}) {
  const { icon: ProductIcon, color } = getProductMeta(product.tipo);
  const isOperativo = product.estado === 'operativo';
  const needsEje = product.tipo === 'EL_FOCO';
  const needsPersona = product.tipo === 'FICHA_LEGISLADOR';
  const catColor = CATEGORY_COLORS[product.categoria] || '#64748b';

  return (
    <div
      className="rounded-md px-3 py-2.5 transition-all duration-200 group"
      style={{
        backgroundColor: 'rgba(255,255,255,0.015)',
        border: '1px solid rgba(255,255,255,0.04)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = `${catColor}22`;
        e.currentTarget.style.backgroundColor = `${catColor}08`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.04)';
        e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.015)';
      }}
    >
      {/* Header row */}
      <div className="flex items-center gap-2 mb-1.5">
        <span className="shrink-0" style={{ color: `${color}90` }}>
          <ProductIcon className="w-3.5 h-3.5" />
        </span>
        <span className="text-[10px] font-mono text-slate-300 truncate flex-1">
          {product.nombre}
        </span>
      </div>

      {/* Estado badge */}
      <div className="flex items-center gap-1.5 mb-2">
        <span
          className="text-[8px] font-bold uppercase font-mono px-1.5 py-0.5 rounded"
          style={{
            color: isOperativo ? '#10b981' : '#64748b',
            backgroundColor: isOperativo ? 'rgba(16,185,129,0.1)' : 'rgba(100,116,139,0.1)',
            border: `1px solid ${isOperativo ? 'rgba(16,185,129,0.15)' : 'rgba(100,116,139,0.1)'}`,
          }}
        >
          {product.estado}
        </span>
        {product.ultimaEdicion && (
          <span className="text-[8px] font-mono text-slate-600 flex items-center gap-0.5">
            <Clock className="w-2.5 h-2.5" />
            {new Date(product.ultimaEdicion).toLocaleDateString('es-BO', { day: '2-digit', month: 'short' })}
          </span>
        )}
      </div>

      {/* Generate button */}
      {isOperativo ? (
        <button
          onClick={() => onGenerate(product.tipo)}
          disabled={isGenerating}
          className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-[9px] font-bold uppercase font-mono transition-all duration-200"
          style={{
            color: isGenerating ? '#64748b' : '#06b6d4',
            backgroundColor: isGenerating ? 'rgba(100,116,139,0.06)' : 'rgba(6,182,212,0.08)',
            border: `1px solid ${isGenerating ? 'rgba(100,116,139,0.1)' : 'rgba(6,182,212,0.15)'}`,
            cursor: isGenerating ? 'not-allowed' : 'pointer',
          }}
          onMouseEnter={(e) => {
            if (!isGenerating) {
              e.currentTarget.style.backgroundColor = 'rgba(6,182,212,0.15)';
              e.currentTarget.style.borderColor = 'rgba(6,182,212,0.3)';
            }
          }}
          onMouseLeave={(e) => {
            if (!isGenerating) {
              e.currentTarget.style.backgroundColor = 'rgba(6,182,212,0.08)';
              e.currentTarget.style.borderColor = 'rgba(6,182,212,0.15)';
            }
          }}
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin" />
              Generando...
            </>
          ) : (
            <>
              <Zap className="w-3 h-3" />
              Generar
              {needsEje && <span className="text-[7px] text-amber-400/70 ml-0.5">*eje</span>}
              {needsPersona && <span className="text-[7px] text-amber-400/70 ml-0.5">*persona</span>}
            </>
          )}
        </button>
      ) : (
        <div className="text-[8px] font-mono text-slate-600 text-center py-1.5 rounded"
          style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}
        >
          No disponible
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Param Modal (EL_FOCO / FICHA_LEGISLADOR)
// ═══════════════════════════════════════════════════════════════

function ParamModal({
  tipo,
  ejes,
  personas,
  loading,
  selectedEje,
  setSelectedEje,
  selectedPersona,
  setSelectedPersona,
  onConfirm,
  onCancel,
}: {
  tipo: string;
  ejes: EjeItem[];
  personas: PersonaItem[];
  loading: boolean;
  selectedEje: string;
  setSelectedEje: (v: string) => void;
  selectedPersona: string;
  setSelectedPersona: (v: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const isFoco = tipo === 'EL_FOCO';
  const items = isFoco ? ejes : personas;
  const selected = isFoco ? selectedEje : selectedPersona;
  const setSelected = isFoco ? setSelectedEje : setSelectedPersona;

  const { icon: ProductIcon, color } = getProductMeta(tipo);
  const productName = ALL_PRODUCTS.find((p) => p.tipo === tipo)?.nombre || tipo;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
      />
      {/* Modal */}
      <div
        className="relative rounded-lg w-full max-w-sm overflow-hidden"
        style={{
          background: 'rgba(8, 8, 8, 0.95)',
          border: '1px solid rgba(6, 182, 212, 0.15)',
          boxShadow: '0 0 40px rgba(6, 182, 212, 0.06)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-2 px-4 py-3 border-b"
          style={{ borderColor: 'rgba(6, 182, 212, 0.08)' }}
        >
          <span style={{ color }}>
            <ProductIcon className="w-4 h-4" />
          </span>
          <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-cyan-400/90 font-mono">
            Generar {productName}
          </span>
          <button
            onClick={onCancel}
            className="ml-auto text-slate-500 hover:text-slate-300 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3">
          <p className="text-[10px] font-mono text-slate-400">
            Selecciona {isFoco ? 'un eje tematico' : 'una persona'} para generar el producto:
          </p>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-4 text-slate-500 text-[10px] font-mono">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Cargando opciones...
            </div>
          ) : (
            <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-1">
              {items.length === 0 ? (
                <p className="text-[10px] font-mono text-slate-600 text-center py-3">
                  No hay opciones disponibles
                </p>
              ) : (
                items.map((item) => {
                  const key = isFoco ? (item as EjeItem).slug : (item as PersonaItem).id;
                  const label = isFoco ? (item as EjeItem).nombre : (item as PersonaItem).nombre;
                  const isSelected = selected === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setSelected(key)}
                      className="w-full text-left px-3 py-2 rounded text-[10px] font-mono transition-all duration-150"
                      style={{
                        color: isSelected ? '#06b6d4' : '#94a3b8',
                        backgroundColor: isSelected ? 'rgba(6,182,212,0.08)' : 'transparent',
                        border: `1px solid ${isSelected ? 'rgba(6,182,212,0.2)' : 'rgba(255,255,255,0.03)'}`,
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }
                      }}
                    >
                      {label}
                      {!isFoco && (item as PersonaItem).tipo && (
                        <span className="text-[8px] text-slate-600 ml-1.5">
                          ({(item as PersonaItem).tipo})
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t" style={{ borderColor: 'rgba(6,182,212,0.08)' }}>
          <button
            onClick={onCancel}
            className="px-3 py-1.5 rounded text-[9px] font-bold uppercase font-mono text-slate-400 transition-colors"
            style={{
              backgroundColor: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={!selected || loading}
            className="px-3 py-1.5 rounded text-[9px] font-bold uppercase font-mono flex items-center gap-1.5 transition-all duration-200"
            style={{
              color: !selected || loading ? '#475569' : '#020617',
              backgroundColor: !selected || loading ? 'rgba(100,116,139,0.1)' : '#06b6d4',
              border: `1px solid ${!selected || loading ? 'rgba(100,116,139,0.15)' : '#06b6d4'}`,
              cursor: !selected || loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                Cargando...
              </>
            ) : (
              <>
                <Play className="w-3 h-3" />
                Generar
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Content Preview
// ═══════════════════════════════════════════════════════════════

function ContentPreview({
  data,
  loading,
}: {
  data: UltimoProduct | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-slate-600 text-[10px] font-mono justify-center">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Cargando contenido...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="py-4 text-slate-600 text-[10px] font-mono text-center">
        No hay contenido disponible
      </div>
    );
  }

  return (
    <div className="space-y-3 pt-2 border-t" style={{ borderColor: 'rgba(6,182,212,0.08)' }}>
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-mono text-slate-400">
          ID: <span className="text-cyan-500/70">{data.id.slice(0, 12)}...</span>
        </p>
        <p className="text-[9px] font-mono text-slate-600 flex items-center gap-1">
          <Clock className="w-2.5 h-2.5" />
          {new Date(data.fechaCreacion).toLocaleString('es-BO', { dateStyle: 'short', timeStyle: 'short' })}
        </p>
      </div>
      {data.titulo && (
        <p className="text-[11px] font-mono text-slate-300 font-medium">{data.titulo}</p>
      )}
      {data.resumen && (
        <p className="text-[10px] font-mono text-slate-500 leading-relaxed italic">
          {data.resumen}
        </p>
      )}
      {data.contenido && (
        <div
          className="text-[10px] font-mono text-slate-400 leading-relaxed max-h-72 overflow-y-auto custom-scrollbar whitespace-pre-wrap"
          style={{ backgroundColor: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '4px' }}
        >
          <pre className="p-3 text-[9px] leading-relaxed">{data.contenido}</pre>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ProduccionView — Resumen de produccion de contenidos
// ═══════════════════════════════════════════════════════════════

export function ProduccionView() {
  // ── Core data state ──
  const [data, setData] = useState<ProduccionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Catalog state ──
  const [catalogProducts, setCatalogProducts] = useState<CatalogProduct[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  // ── Generation state ──
  const [generatingTipo, setGeneratingTipo] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // ── Param modal state ──
  const [paramModalTipo, setParamModalTipo] = useState<string | null>(null);
  const [ejes, setEjes] = useState<EjeItem[]>([]);
  const [personas, setPersonas] = useState<PersonaItem[]>([]);
  const [paramLoading, setParamLoading] = useState(false);
  const [selectedEje, setSelectedEje] = useState('');
  const [selectedPersona, setSelectedPersona] = useState('');

  // ── Preview state ──
  const [expandedPreviewTipo, setExpandedPreviewTipo] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<UltimoProduct | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Auto-dismiss notifications
  const notifTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const addNotification = useCallback((tipo: 'success' | 'error', message: string, detail?: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setNotifications((prev) => [...prev.slice(-4), { id, tipo, message, detail, timestamp: Date.now() }]);
    // Auto-dismiss after 6s
    if (notifTimerRef.current) clearTimeout(notifTimerRef.current);
    notifTimerRef.current = setTimeout(() => {
      dismissNotification(id);
    }, 6000);
  }, [dismissNotification]);

  // ── Fetch core data ──
  const fetchData = useCallback(async () => {
    try {
      const [summaryRes, productosRes] = await Promise.all([
        fetchWithTimeout('/api/dashboard/indicadores-summary', { timeoutMs: 8000 }),
        fetchWithTimeout('/api/productos?limit=10&orderBy=fechaCreacion&orderDir=desc', { timeoutMs: 8000 }),
      ]);

      const summary = summaryRes.ok ? await summaryRes.json() : null;
      const productos = productosRes.ok ? await productosRes.json() : null;

      setData({
        productos: summary?.produccion?.productos,
        status: summary?.produccion?.status,
        recientes: productos?.productos || productos || [],
      });
      setError(null);
    } catch {
      setError('Error de conexion');
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Fetch catalog ──
  const fetchCatalog = useCallback(async () => {
    try {
      setCatalogLoading(true);
      const res = await fetchWithTimeout('/api/dashboard/productos', { timeoutMs: 8000 });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setCatalogProducts(json.productos || []);
      setCatalogError(null);
    } catch {
      setCatalogError('Error al cargar catalogo');
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  // ── Initial fetch (all data in parallel) ──
  useEffect(() => {
    let cancelled = false;

    const loadAll = async () => {
      // Fetch core data
      try {
        const [summaryRes, productosRes] = await Promise.all([
          fetchWithTimeout('/api/dashboard/indicadores-summary', { timeoutMs: 8000 }),
          fetchWithTimeout('/api/productos?limit=10&orderBy=fechaCreacion&orderDir=desc', { timeoutMs: 8000 }),
        ]);
        if (cancelled) return;
        const summary = summaryRes.ok ? await summaryRes.json() : null;
        const productos = productosRes.ok ? await productosRes.json() : null;
        setData({
          productos: summary?.produccion?.productos,
          status: summary?.produccion?.status,
          recientes: productos?.productos || productos || [],
        });
        setError(null);
      } catch {
        if (!cancelled) setError('Error de conexion');
      } finally {
        if (!cancelled) setLoading(false);
      }

      // Fetch catalog
      try {
        if (cancelled) return;
        setCatalogLoading(true);
        const res = await fetchWithTimeout('/api/dashboard/productos', { timeoutMs: 8000 });
        if (cancelled) return;
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        setCatalogProducts(json.productos || []);
        setCatalogError(null);
      } catch {
        if (!cancelled) setCatalogError('Error al cargar catalogo');
      } finally {
        if (!cancelled) setCatalogLoading(false);
      }
    };

    loadAll();
    return () => { cancelled = true; };
  }, []);

  // ── Fetch ejes/personas when param modal opens ──
  useEffect(() => {
    if (!paramModalTipo) return;

    const fetchParams = async () => {
      setParamLoading(true);
      setSelectedEje('');
      setSelectedPersona('');

      try {
        if (paramModalTipo === 'EL_FOCO') {
          const res = await fetchWithTimeout('/api/ejes-tematicos', { timeoutMs: 6000 });
          if (res.ok) {
            const json = await res.json();
            setEjes(Array.isArray(json) ? json : json.ejes || json.data || []);
          }
        } else if (paramModalTipo === 'FICHA_LEGISLADOR') {
          const res = await fetchWithTimeout('/api/personas', { timeoutMs: 6000 });
          if (res.ok) {
            const json = await res.json();
            setPersonas(Array.isArray(json) ? json : json.personas || json.data || []);
          }
        }
      } catch {
        // silent fail - modal will show "no options"
      } finally {
        setParamLoading(false);
      }
    };

    fetchParams();
  }, [paramModalTipo]);

  // ── Execute generation ──
  const executeGenerate = useCallback(async (tipo: string, body: Record<string, string>) => {
    setGeneratingTipo(tipo);
    setParamModalTipo(null);

    try {
      const res = await fetchWithTimeout(`/api/dashboard/productos/${tipo}/generar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        timeoutMs: 30000,
      });

      if (!res.ok) {
        const errJson = res.headers.get('content-type')?.includes('json')
          ? await res.json().catch(() => ({}))
          : {};
        throw new Error(errJson.error || errJson.mensaje || `HTTP ${res.status}`);
      }

      const json = await res.json();

      if (json.ok) {
        addNotification('success', `Producto generado exitosamente`, `Job ID: ${json.jobId || '—'}`);
        // Refresh data
        fetchData();
        fetchCatalog();
      } else {
        addNotification('error', json.mensaje || 'Error al generar producto', json.error);
      }
    } catch (err) {
      addNotification(
        'error',
        'Error al generar producto',
        err instanceof Error ? err.message : 'Error desconocido'
      );
    } finally {
      setGeneratingTipo(null);
    }
  }, [fetchData, fetchCatalog, addNotification]);

  // ── Handle generate click ──
  const handleGenerate = useCallback((tipo: string) => {
    if (tipo === 'EL_FOCO' || tipo === 'FICHA_LEGISLADOR') {
      setParamModalTipo(tipo);
    } else {
      executeGenerate(tipo, {});
    }
  }, [executeGenerate]);

  // ── Confirm param modal ──
  const confirmParamModal = useCallback(() => {
    if (!paramModalTipo) return;
    if (paramModalTipo === 'EL_FOCO' && selectedEje) {
      executeGenerate('EL_FOCO', { ejeSlug: selectedEje });
    } else if (paramModalTipo === 'FICHA_LEGISLADOR' && selectedPersona) {
      executeGenerate('FICHA_LEGISLADOR', { personaId: selectedPersona });
    }
  }, [paramModalTipo, selectedEje, selectedPersona, executeGenerate]);

  // ── Toggle preview ──
  const togglePreview = useCallback(async (tipo: string) => {
    if (expandedPreviewTipo === tipo) {
      setExpandedPreviewTipo(null);
      setPreviewData(null);
      return;
    }

    setExpandedPreviewTipo(tipo);
    setPreviewLoading(true);
    setPreviewData(null);

    try {
      const res = await fetchWithTimeout(`/api/dashboard/productos/${tipo}/ultimo`, { timeoutMs: 10000 });
      if (res.ok) {
        const json = await res.json();
        setPreviewData(json);
      } else {
        setPreviewData(null);
      }
    } catch {
      setPreviewData(null);
    } finally {
      setPreviewLoading(false);
    }
  }, [expandedPreviewTipo]);

  // ── Derived ──
  const prod = data?.productos;
  const recientes = data?.recientes as Array<Record<string, unknown>> | undefined;

  // Group catalog by category
  const catalogByCategory = CATEGORY_ORDER.reduce<Record<string, CatalogProduct[]>>((acc, cat) => {
    acc[cat] = catalogProducts.filter((p) => p.categoria === cat);
    return acc;
  }, {});

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* ── Top Row: Stats + Catalog ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
        {/* Left: Stats KPIs + Quick Actions */}
        <div className="lg:col-span-5">
          <PanelShell title="Produccion" icon={<FileText className="w-4 h-4" />}>
            {loading ? (
              <div className="flex items-center gap-2 py-8 text-slate-600 text-xs font-mono justify-center">
                <Loader2 className="w-4 h-4 animate-spin" />
                Cargando datos de produccion...
              </div>
            ) : error ? (
              <div className="flex items-center gap-2 py-4 text-red-400/70 text-xs font-mono">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                {error}
              </div>
            ) : (
              <div className="space-y-4">
                {/* Status */}
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{
                      backgroundColor: prod?.status === 'ok' ? '#10b981' : '#64748b',
                      boxShadow: prod?.status === 'ok' ? '0 0 8px rgba(16,185,129,0.4)' : 'none',
                    }}
                  />
                  <span className="text-[10px] font-bold uppercase font-mono text-slate-500">
                    Motor de Produccion
                  </span>
                </div>

                {/* KPIs */}
                <div className="grid grid-cols-3 gap-3 py-3 border-y border-slate-800/60">
                  <div className="text-center">
                    <p className="text-[9px] font-bold uppercase text-slate-600 font-mono">Total</p>
                    <p className="text-xl font-mono text-emerald-400 tabular-nums">
                      {prod?.total ?? 0}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-[9px] font-bold uppercase text-slate-600 font-mono">Hoy</p>
                    <p className="text-xl font-mono text-cyan-400 tabular-nums">
                      {prod?.hoy ?? 0}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-[9px] font-bold uppercase text-slate-600 font-mono">Semana</p>
                    <p className="text-xl font-mono text-amber-400 tabular-nums">
                      {prod?.semana ?? 0}
                    </p>
                  </div>
                </div>

                {/* Info card */}
                <div className="px-3 py-2.5 rounded-md" style={{
                  backgroundColor: 'rgba(6,182,212,0.04)',
                  border: '1px solid rgba(6,182,212,0.08)',
                }}>
                  <p className="text-[10px] font-mono text-slate-500 leading-relaxed">
                    La produccion incluye: boletines de prensa, fichas de analisis,
                    focos de atencion, radar de medios, saldos y reportes sectoriales.
                    Se generan automaticamente via el Planificador o manualmente.
                  </p>
                </div>

                {/* Quick Actions */}
                <div className="pt-2 border-t border-slate-800/40">
                  <p className="text-[9px] font-bold uppercase font-mono text-slate-600 mb-2 flex items-center gap-1.5">
                    <Zap className="w-3 h-3 text-cyan-500/50" />
                    Acciones Rapidas
                  </p>
                  <div className="space-y-1">
                    {ALL_PRODUCTS.filter((p) => p.estado === 'operativo').slice(0, 4).map((product) => {
                      const Icon = product.icon;
                      const isCurrentGen = generatingTipo === product.tipo;
                      return (
                        <button
                          key={product.tipo}
                          onClick={() => handleGenerate(product.tipo)}
                          disabled={!!generatingTipo}
                          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-[10px] font-mono transition-all duration-150"
                          style={{
                            color: isCurrentGen ? '#475569' : '#94a3b8',
                            backgroundColor: isCurrentGen ? 'rgba(100,116,139,0.04)' : 'transparent',
                            border: '1px solid transparent',
                            cursor: generatingTipo ? 'not-allowed' : 'pointer',
                          }}
                          onMouseEnter={(e) => {
                            if (!generatingTipo) {
                              e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)';
                              e.currentTarget.style.color = '#cbd5e1';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!generatingTipo) {
                              e.currentTarget.style.backgroundColor = 'transparent';
                              e.currentTarget.style.color = '#94a3b8';
                            }
                          }}
                        >
                          <span style={{ color: isCurrentGen ? '#475569' : `${product.color}80` }}>
                            {isCurrentGen ? <Loader2 className="w-3 h-3 animate-spin" /> : <Icon className="w-3 h-3" />}
                          </span>
                          <span className="flex-1 text-left truncate">
                            {isCurrentGen ? 'Generando...' : product.nombre}
                          </span>
                          {!isCurrentGen && (
                            <Play className="w-2.5 h-2.5 text-slate-700" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </PanelShell>
        </div>

        {/* Right: Product Catalog Grid */}
        <div className="lg:col-span-7">
          <PanelShell title="Catalogo de Productos" icon={<Package className="w-4 h-4" />}>
            {/* Notifications */}
            {notifications.length > 0 && (
              <div className="space-y-1.5 mb-3">
                {notifications.map((n) => (
                  <InlineToast key={n.id} notif={n} onDismiss={() => dismissNotification(n.id)} />
                ))}
              </div>
            )}

            {catalogLoading ? (
              <div className="flex items-center gap-2 py-8 text-slate-600 text-xs font-mono justify-center">
                <Loader2 className="w-4 h-4 animate-spin" />
                Cargando catalogo...
              </div>
            ) : catalogError ? (
              <div className="flex items-center gap-2 py-4 text-red-400/70 text-xs font-mono">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                {catalogError}
              </div>
            ) : (
              <div className="space-y-4 max-h-[520px] overflow-y-auto custom-scrollbar pr-1">
                {CATEGORY_ORDER.map((cat) => {
                  const products = catalogByCategory[cat] || [];
                  if (products.length === 0) return null;

                  const catColor = CATEGORY_COLORS[cat];
                  const catLabel = CATEGORY_LABELS[cat];
                  const catBg = CATEGORY_BG[cat];

                  return (
                    <div key={cat}>
                      {/* Category header */}
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className="text-[8px] font-bold uppercase font-mono px-1.5 py-0.5 rounded"
                          style={{
                            color: catColor,
                            backgroundColor: catBg,
                            border: `1px solid ${catColor}15`,
                          }}
                        >
                          {catLabel}
                        </span>
                        <span className="text-[8px] font-mono text-slate-600">
                          {products.length} producto{products.length !== 1 ? 's' : ''}
                        </span>
                        <div className="flex-1 h-px" style={{ backgroundColor: 'rgba(255,255,255,0.03)' }} />
                      </div>

                      {/* Product grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {products.map((product) => (
                          <ProductMiniCard
                            key={product.tipo}
                            product={product}
                            onGenerate={handleGenerate}
                            isGenerating={generatingTipo === product.tipo}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </PanelShell>
        </div>
      </div>

      {/* ── Bottom: Recent Products with Content Preview ── */}
      <PanelShell title="Productos Recientes" icon={<TrendingUp className="w-4 h-4" />}>
        {loading ? (
          <div className="flex items-center gap-2 py-8 text-slate-600 text-xs font-mono justify-center">
            <Loader2 className="w-4 h-4 animate-spin" />
          </div>
        ) : !recientes || (Array.isArray(recientes) && recientes.length === 0) ? (
          <div className="flex flex-col items-center gap-2 py-10 text-slate-600 text-xs font-mono">
            <FileText className="w-6 h-6 text-slate-700" />
            <span>No hay productos generados aun</span>
          </div>
        ) : (
          <div className="space-y-1.5 max-h-[500px] overflow-y-auto custom-scrollbar">
            {Array.isArray(recientes) && (recientes as Array<Record<string, string>>).map((p, i) => {
              const pTipo = p.tipo || '';
              const pId = (p as Record<string, unknown>).id as string || String(i);
              const { icon: ProductIcon, color: pColor } = getProductMeta(pTipo);
              const isExpanded = expandedPreviewTipo === pTipo && expandedPreviewTipo !== null;

              return (
                <div
                  key={pId}
                  className="rounded-md transition-all duration-200"
                  style={{
                    background: isExpanded ? 'rgba(6,182,212,0.04)' : i === 0 ? 'rgba(6,182,212,0.02)' : 'rgba(255,255,255,0.01)',
                    border: `1px solid ${isExpanded ? 'rgba(6,182,212,0.12)' : i === 0 ? 'rgba(6,182,212,0.06)' : 'rgba(255,255,255,0.03)'}`,
                  }}
                >
                  <div className="px-3 py-2.5">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="shrink-0" style={{ color: `${pColor}70` }}>
                        <ProductIcon className="w-3 h-3" />
                      </span>
                      <span
                        className="text-[9px] font-bold uppercase font-mono px-1.5 py-0.5 rounded"
                        style={{
                          color: '#a78bfa',
                          backgroundColor: 'rgba(167,139,250,0.08)',
                          border: '1px solid rgba(167,139,250,0.15)',
                        }}
                      >
                        {pTipo || 'N/A'}
                      </span>
                      {p.estado && (
                        <span
                          className="text-[9px] font-mono px-1.5 py-0.5 rounded"
                          style={{
                            color: p.estado === 'completado' ? '#10b981' : '#f59e0b',
                            backgroundColor: p.estado === 'completado' ? 'rgba(16,185,129,0.08)' : 'rgba(245,158,11,0.08)',
                          }}
                        >
                          {p.estado}
                        </span>
                      )}
                      {/* VER CONTENIDO button */}
                      <button
                        onClick={() => togglePreview(pTipo)}
                        className="ml-auto flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase font-mono transition-all duration-150 shrink-0"
                        style={{
                          color: isExpanded ? '#06b6d4' : '#64748b',
                          backgroundColor: isExpanded ? 'rgba(6,182,212,0.08)' : 'transparent',
                          border: `1px solid ${isExpanded ? 'rgba(6,182,212,0.15)' : 'rgba(255,255,255,0.06)'}`,
                        }}
                        onMouseEnter={(e) => {
                          if (!isExpanded) {
                            e.currentTarget.style.color = '#06b6d4';
                            e.currentTarget.style.borderColor = 'rgba(6,182,212,0.15)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isExpanded) {
                            e.currentTarget.style.color = '#64748b';
                            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
                          }
                        }}
                      >
                        <Eye className="w-2.5 h-2.5" />
                        Ver contenido
                        {isExpanded ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-300 font-mono leading-snug line-clamp-2">
                      {p.titulo || 'Sin titulo'}
                    </p>
                    {p.fechaCreacion && (
                      <p className="text-[9px] font-mono text-slate-700 mt-1 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(p.fechaCreacion).toLocaleString('es-BO', { dateStyle: 'short', timeStyle: 'short' })}
                      </p>
                    )}
                  </div>

                  {/* Content preview (expanded) */}
                  {isExpanded && (
                    <div className="px-3 pb-3">
                      <ContentPreview
                        data={previewData}
                        loading={previewLoading}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </PanelShell>

      {/* ── Param Modal ── */}
      {paramModalTipo && (
        <ParamModal
          tipo={paramModalTipo}
          ejes={ejes}
          personas={personas}
          loading={paramLoading}
          selectedEje={selectedEje}
          setSelectedEje={setSelectedEje}
          selectedPersona={selectedPersona}
          setSelectedPersona={setSelectedPersona}
          onConfirm={confirmParamModal}
          onCancel={() => setParamModalTipo(null)}
        />
      )}
    </div>
  );
}
