'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { fetchWithTimeout } from '@/lib/fetch-utils';
import { PanelShell } from './PanelShell';
import {
  FileText, TrendingUp, Clock, Loader2, Play, ChevronDown, ChevronUp,
  Eye, Zap, Package,
} from 'lucide-react';
import { ALL_PRODUCTS } from '@/constants/nav';

import type {
  ProduccionData,
  CatalogProduct,
  EjeItem,
  PersonaItem,
  UltimoProduct,
  Notification,
} from './ProduccionView.types';
import {
  CATEGORY_ORDER,
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  CATEGORY_BG,
  getProductMeta,
  InlineToast,
  ProductMiniCard,
  ParamModal,
  ContentPreview,
} from './ProduccionView.subcomponents';

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
          const res = await fetchWithTimeout('/api/ejes', { timeoutMs: 6000 });
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
