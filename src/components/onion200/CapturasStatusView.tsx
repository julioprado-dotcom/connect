'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { fetchWithTimeout } from '@/lib/fetch-utils';
import { PanelShell } from './PanelShell';
import {
  Radio,
  RefreshCw,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Newspaper,
  MessageSquare,
  FileText,
  Database,
  Eye,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

interface FuenteScrapingStatus {
  medioId: string;
  medioNombre: string;
  medioUrl: string;
  medioTipo: string;
  medioNivel: string;
  medioCategoria: string;
  medioActivo: boolean;
  estado: string;
  ultimoCheck: string | null;
  ultimoCheckFecha: string | null;
  ultimoCheckHace: string;
  ultimoCheckOk: string | null;
  ultimoCheckOkFecha: string | null;
  ultimoCheckOkHace: string;
  ultimoCambio: string | null;
  ultimoCambioFecha: string | null;
  ultimoHeadline: string | null;
  ultimoHeadlineFecha: string | null;
  ultimoHeadlineHace: string;
  ultimoTexto: string | null;
  ultimoTextoFecha: string | null;
  ultimoMencion: string | null;
  ultimoMencionFecha: string | null;
  ultimoMencionHace: string;
  totalChecks: number;
  totalCambios: number;
  totalHeadlines: number;
  totalTexto: number;
  totalMenciones: number;
  fallosConsecutivos: number;
  checksSinCambio: number;
  error: string;
  responseTime: number;
  capaActual: number;
  frecuenciaActual: string;
  strategyValid: string;
  strategyScrape: string;
  notaRawTotal: number;
  notaRawPendientes: number;
  algunaVezScrapeada: boolean;
}

interface ScrapingResumen {
  totalFuentes: number;
  conEstado: number;
  sinEstado: number;
  algunaVezScrapeadas: number;
  nuncaScrapeadas: number;
  activas: number;
  degradadas: number;
  caidas: number;
  pausadas: number;
  conNotasRaw: number;
  notasRawTotal: number;
  notasRawPendientes: number;
  mencionesTotal: number;
}

type CapturaFilter = 'todas' | 'scrapeadas' | 'nunca' | 'activas' | 'problemas';

// ═══════════════════════════════════════════════════════════════
// Color helpers
// ═══════════════════════════════════════════════════════════════

const ESTADO_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  activa: { text: '#06b6d4', bg: 'rgba(6,182,212,0.06)', border: 'rgba(6,182,212,0.15)' },
  degradada: { text: '#f59e0b', bg: 'rgba(245,158,11,0.06)', border: 'rgba(245,158,11,0.15)' },
  caida: { text: '#ef4444', bg: 'rgba(239,68,68,0.06)', border: 'rgba(239,68,68,0.15)' },
  pausada: { text: '#64748b', bg: 'rgba(100,116,139,0.06)', border: 'rgba(100,116,139,0.15)' },
  sin_estado: { text: '#475569', bg: 'rgba(71,85,105,0.06)', border: 'rgba(71,85,105,0.15)' },
};

const ESTADO_LABELS: Record<string, string> = {
  activa: 'ACTIVA',
  degradada: 'DEGRADADA',
  caida: 'CAIDA',
  pausada: 'PAUSADA',
  sin_estado: 'SIN ESTADO',
};

function getTimeColor(hace: string): string {
  if (hace === 'nunca') return '#475569';
  if (hace === 'ahora' || hace.startsWith('hace 1') || hace.startsWith('hace 2')) return '#06b6d4';
  if (hace.includes('h') && !hace.includes('d')) {
    const num = parseInt(hace.replace(/\D/g, ''));
    if (num <= 6) return '#06b6d4';
    if (num <= 24) return '#f59e0b';
  }
  if (hace.includes('d')) {
    const num = parseInt(hace.replace(/\D/g, ''));
    if (num <= 2) return '#f59e0b';
    return '#ef4444';
  }
  return '#475569';
}

// ═══════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════

export function CapturasStatusView() {
  const [fuentes, setFuentes] = useState<FuenteScrapingStatus[]>([]);
  const [resumen, setResumen] = useState<ScrapingResumen | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<CapturaFilter>('todas');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetchWithTimeout('/api/dashboard/fuentes/scraping-status', { timeoutMs: 15000 });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setFuentes(data.fuentes || []);
      setResumen(data.resumen || null);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error de conexion');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter logic
  const filtered = fuentes.filter((f) => {
    switch (filter) {
      case 'scrapeadas': return f.algunaVezScrapeada;
      case 'nunca': return !f.algunaVezScrapeada;
      case 'activas': return f.estado === 'activa';
      case 'problemas': return f.estado === 'caida' || f.estado === 'degradada';
      default: return true;
    }
  });

  const filters: { key: CapturaFilter; label: string; count: number }[] = [
    { key: 'todas', label: 'Todas', count: fuentes.length },
    { key: 'scrapeadas', label: 'Scrapeadas', count: fuentes.filter(f => f.algunaVezScrapeada).length },
    { key: 'nunca', label: 'Nunca', count: fuentes.filter(f => !f.algunaVezScrapeada).length },
    { key: 'activas', label: 'Activas', count: fuentes.filter(f => f.estado === 'activa').length },
    { key: 'problemas', label: 'Problemas', count: fuentes.filter(f => f.estado === 'caida' || f.estado === 'degradada').length },
  ];

  return (
    <div className="space-y-4">
      {/* ── Summary Stats ── */}
      {resumen && (
        <PanelShell title="Resumen de Capturas" icon={<Newspaper className="w-4 h-4" />}>
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            <MiniStat label="Total Fuentes" value={resumen.totalFuentes} color="#06b6d4" />
            <MiniStat label="Scrapeadas" value={resumen.algunaVezScrapeadas} color="#06b6d4" sub={`${resumen.nuncaScrapeadas} nunca`} />
            <MiniStat label="Notas Raw" value={resumen.notasRawTotal} color="#06b6d4" sub={`${resumen.notasRawPendientes} pend.`} />
            <MiniStat label="Menciones" value={resumen.mencionesTotal} color="#06b6d4" />
            <MiniStat label="Activas" value={resumen.activas} color="#06b6d4" />
            <MiniStat label="Degradadas" value={resumen.degradadas} color="#f59e0b" />
            <MiniStat label="Caidas" value={resumen.caidas} color="#ef4444" />
          </div>
        </PanelShell>
      )}

      {/* ── Fuentes Table ── */}
      <PanelShell title="Capturas por Fuente" icon={<Radio className="w-4 h-4" />}>
        {/* Filter buttons */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className="text-[9px] font-bold uppercase tracking-widest text-slate-600 font-mono mr-1">
            Filtro:
          </span>
          {filters.map((f) => {
            const active = filter === f.key;
            const accent = f.key === 'problemas' ? '#ef4444' : f.key === 'nunca' ? '#475569' : f.key === 'scrapeadas' ? '#06b6d4' : '#06b6d4';
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[10px] font-bold font-mono uppercase tracking-wider transition-all duration-200"
                style={{
                  color: active ? accent : '#64748b',
                  backgroundColor: active ? accent + '10' : 'transparent',
                  border: active
                    ? '1px solid ' + accent + '25'
                    : '1px solid rgba(100,116,139,0.1)',
                }}
              >
                {f.label}
                <span
                  className="ml-0.5 text-[9px] tabular-nums"
                  style={{ color: active ? accent + '90' : '#475569' }}
                >
                  [{f.count}]
                </span>
              </button>
            );
          })}
          <button
            onClick={fetchData}
            className="ml-auto flex items-center gap-1.5 px-2 py-1.5 rounded text-[9px] font-mono text-slate-500 hover:text-cyan-400 transition-colors"
            title="Refrescar datos"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>

        {/* Error */}
        {error && !loading && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-md text-[10px] font-mono mb-3" style={{
            color: '#8b5cf6',
            backgroundColor: 'rgba(139,92,246,0.06)',
            border: '1px solid rgba(139,92,246,0.15)',
          }}>
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            Error al cargar datos de capturas: {error}
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto rounded-md" style={{ border: '1px solid rgba(6,182,212,0.06)' }}>
          <table className="w-full text-[10px] font-mono">
            <thead>
              <tr className="border-b border-slate-800/60" style={{ backgroundColor: 'rgba(6,182,212,0.02)' }}>
                <th className="px-3 py-2 text-left text-[9px] font-bold uppercase tracking-widest text-slate-600">Fuente</th>
                <th className="px-3 py-2 text-left text-[9px] font-bold uppercase tracking-widest text-slate-600">Estado</th>
                <th className="px-3 py-2 text-left text-[9px] font-bold uppercase tracking-widest text-slate-600">Ult. Check</th>
                <th className="px-3 py-2 text-left text-[9px] font-bold uppercase tracking-widest text-slate-600 hidden lg:table-cell">Ult. Headline</th>
                <th className="px-3 py-2 text-left text-[9px] font-bold uppercase tracking-widest text-slate-600 hidden lg:table-cell">Ult. Mencion</th>
                <th className="px-3 py-2 text-center text-[9px] font-bold uppercase tracking-widest text-slate-600 hidden md:table-cell">Notas Raw</th>
                <th className="px-3 py-2 text-center text-[9px] font-bold uppercase tracking-widest text-slate-600 hidden md:table-cell">Checks</th>
                <th className="px-3 py-2 text-center text-[9px] font-bold uppercase tracking-widest text-slate-600 hidden xl:table-cell">Cambios</th>
                <th className="px-3 py-2 text-center text-[9px] font-bold uppercase tracking-widest text-slate-600 hidden sm:table-cell">Menciones</th>
                <th className="px-3 py-2 text-right text-[9px] font-bold uppercase tracking-widest text-slate-600">Detalle</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-slate-800/40">
                    {Array.from({ length: 10 }).map((_, j) => (
                      <td key={j} className="px-3 py-2.5">
                        <div
                          className="h-3 rounded-sm animate-pulse"
                          style={{ backgroundColor: 'rgba(6,182,212,0.05)', width: '60%' }}
                        />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-3 py-8 text-center text-slate-600 text-[10px] font-mono">
                    <Eye className="w-4 h-4 mx-auto mb-2 opacity-40" />
                    Sin fuentes que coincidan con el filtro seleccionado
                  </td>
                </tr>
              ) : (
                filtered.map((fuente) => {
                  const isExpanded = expandedId === fuente.medioId;
                  const estadoColor = ESTADO_COLORS[fuente.estado] || ESTADO_COLORS.sin_estado;

                  return (
                    <React.Fragment key={fuente.medioId}>
                      <tr
                        className="border-b border-slate-800/30 cursor-pointer transition-all duration-150"
                        style={{
                          backgroundColor: isExpanded ? 'rgba(6,182,212,0.04)' : 'transparent',
                        }}
                        onMouseEnter={(e) => {
                          if (!isExpanded) {
                            (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(6,182,212,0.02)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isExpanded) {
                            (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                          }
                        }}
                        onClick={() => setExpandedId(isExpanded ? null : fuente.medioId)}
                      >
                        {/* Fuente name */}
                        <td className="px-3 py-2.5">
                          <div className="min-w-0">
                            <p className="truncate max-w-[180px] font-bold" style={{ color: '#cbd5e1' }}>
                              {fuente.medioNombre}
                            </p>
                            <p className="text-[8px] text-slate-600 truncate max-w-[180px]">
                              {fuente.medioUrl || 'sin URL'}
                            </p>
                          </div>
                        </td>

                        {/* Estado */}
                        <td className="px-3 py-2.5">
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold font-mono uppercase tracking-wider"
                            style={{
                              color: estadoColor.text,
                              backgroundColor: estadoColor.bg,
                              border: '1px solid ' + estadoColor.border,
                            }}
                          >
                            {ESTADO_LABELS[fuente.estado] || fuente.estado.toUpperCase()}
                          </span>
                        </td>

                        {/* Ultimo Check */}
                        <td className="px-3 py-2.5">
                          <div>
                            <p className="font-bold" style={{ color: getTimeColor(fuente.ultimoCheckHace), fontSize: '10px' }}>
                              {fuente.ultimoCheckHace}
                            </p>
                            <p className="text-[8px] text-slate-600">
                              {fuente.ultimoCheckFecha || '---'}
                            </p>
                          </div>
                        </td>

                        {/* Ultimo Headline (hidden on mobile) */}
                        <td className="px-3 py-2.5 hidden lg:table-cell">
                          <div>
                            <p className="font-bold" style={{ color: getTimeColor(fuente.ultimoHeadlineHace), fontSize: '10px' }}>
                              {fuente.ultimoHeadlineHace}
                            </p>
                            <p className="text-[8px] text-slate-600">
                              {fuente.ultimoHeadlineFecha || '---'}
                            </p>
                          </div>
                        </td>

                        {/* Ultimo Mencion (hidden on mobile) */}
                        <td className="px-3 py-2.5 hidden lg:table-cell">
                          <div>
                            <p className="font-bold" style={{ color: getTimeColor(fuente.ultimoMencionHace), fontSize: '10px' }}>
                              {fuente.ultimoMencionHace}
                            </p>
                            <p className="text-[8px] text-slate-600">
                              {fuente.ultimoMencionFecha || '---'}
                            </p>
                          </div>
                        </td>

                        {/* Notas Raw (hidden on mobile) */}
                        <td className="px-3 py-2.5 text-center hidden md:table-cell">
                          <div>
                            <span className="font-bold" style={{ color: fuente.notaRawTotal > 0 ? '#06b6d4' : '#475569', fontSize: '11px' }}>
                              {fuente.notaRawTotal}
                            </span>
                            {fuente.notaRawPendientes > 0 && (
                              <span className="ml-1 text-[8px] font-bold" style={{ color: '#f59e0b' }}>
                                ({fuente.notaRawPendientes} pend.)
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Checks (hidden on mobile) */}
                        <td className="px-3 py-2.5 text-center hidden md:table-cell">
                          <span className="font-bold tabular-nums" style={{ color: fuente.totalChecks > 0 ? '#cbd5e1' : '#475569', fontSize: '11px' }}>
                            {fuente.totalChecks}
                          </span>
                        </td>

                        {/* Cambios (hidden on tablet) */}
                        <td className="px-3 py-2.5 text-center hidden xl:table-cell">
                          <span className="font-bold tabular-nums" style={{ color: fuente.totalCambios > 0 ? '#06b6d4' : '#475569', fontSize: '11px' }}>
                            {fuente.totalCambios}
                          </span>
                        </td>

                        {/* Menciones (hidden on small mobile) */}
                        <td className="px-3 py-2.5 text-center hidden sm:table-cell">
                          <span className="font-bold tabular-nums" style={{ color: fuente.totalMenciones > 0 ? '#06b6d4' : '#475569', fontSize: '11px' }}>
                            {fuente.totalMenciones}
                          </span>
                        </td>

                        {/* Detalle button */}
                        <td className="px-3 py-2.5 text-right">
                          <span
                            className="text-[9px] font-mono"
                            style={{
                              color: isExpanded ? '#06b6d4' : '#475569',
                              transition: 'color 0.2s',
                            }}
                          >
                            {isExpanded ? '▲' : '▼'}
                          </span>
                        </td>
                      </tr>

                      {/* Expanded detail row */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={10} className="px-4 py-3" style={{ backgroundColor: 'rgba(6,182,212,0.02)' }}>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-[10px] font-mono">
                              {/* Column 1: Fechas */}
                              <div className="space-y-2">
                                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-2">Fechas de Captura</p>
                                <DetailRow icon={<Clock className="w-3 h-3" />} label="Ultimo Check" value={fuente.ultimoCheckFecha} sub={fuente.ultimoCheckHace} />
                                <DetailRow icon={<CheckCircle2 className="w-3 h-3" />} label="Check OK" value={fuente.ultimoCheckOkFecha} sub={fuente.ultimoCheckOkHace} />
                                <DetailRow icon={<RefreshCw className="w-3 h-3" />} label="Ultimo Cambio" value={fuente.ultimoCambioFecha} sub={null} />
                                <DetailRow icon={<Newspaper className="w-3 h-3" />} label="Ult. Headline" value={fuente.ultimoHeadlineFecha} sub={fuente.ultimoHeadlineHace} />
                                <DetailRow icon={<FileText className="w-3 h-3" />} label="Ult. Texto" value={fuente.ultimoTextoFecha} sub={null} />
                                <DetailRow icon={<MessageSquare className="w-3 h-3" />} label="Ult. Mencion" value={fuente.ultimoMencionFecha} sub={fuente.ultimoMencionHace} />
                              </div>

                              {/* Column 2: Contadores */}
                              <div className="space-y-2">
                                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-2">Contadores</p>
                                <DetailRow label="Total Checks" value={String(fuente.totalChecks)} />
                                <DetailRow label="Total Cambios" value={String(fuente.totalCambios)} />
                                <DetailRow label="Total Headlines" value={String(fuente.totalHeadlines)} />
                                <DetailRow label="Total Texto" value={String(fuente.totalTexto)} />
                                <DetailRow label="Total Menciones" value={String(fuente.totalMenciones)} />
                                <DetailRow label="Checks sin Cambio" value={String(fuente.checksSinCambio)} />
                              </div>

                              {/* Column 3: Tecnico */}
                              <div className="space-y-2">
                                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-2">Tecnico</p>
                                <DetailRow label="Fallos Consec." value={String(fuente.fallosConsecutivos)} />
                                <DetailRow label="Response Time" value={fuente.responseTime > 0 ? `${fuente.responseTime}ms` : '---'} />
                                <DetailRow label="Capa Actual" value={String(fuente.capaActual)} />
                                <DetailRow label="Frecuencia" value={fuente.frecuenciaActual} />
                                <DetailRow label="Strategy Valid" value={fuente.strategyValid || '---'} />
                                <DetailRow label="Strategy Scrape" value={fuente.strategyScrape || '---'} />
                                {fuente.error && (
                                  <div className="mt-2 px-2 py-1.5 rounded text-[9px]" style={{
                                    color: '#ef4444',
                                    backgroundColor: 'rgba(239,68,68,0.06)',
                                    border: '1px solid rgba(239,68,68,0.15)',
                                  }}>
                                    <span className="font-bold">ERROR:</span> {fuente.error.slice(0, 150)}
                                    {fuente.error.length > 150 && '...'}
                                  </div>
                                )}
                              </div>

                              {/* Column 4: Notas Raw */}
                              <div className="space-y-2">
                                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-2">Notas Raw</p>
                                <DetailRow label="Total Notas Raw" value={String(fuente.notaRawTotal)} />
                                <DetailRow label="Pendientes" value={String(fuente.notaRawPendientes)} />
                                <DetailRow label="Procesadas" value={String(fuente.notaRawTotal - fuente.notaRawPendientes)} />
                                <div className="mt-3 pt-2" style={{ borderTop: '1px solid rgba(6,182,212,0.06)' }}>
                                  <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-2">Metadata</p>
                                  <DetailRow label="Medio ID" value={fuente.medioId.slice(0, 12) + '...'} />
                                  <DetailRow label="Tipo" value={fuente.medioTipo} />
                                  <DetailRow label="Nivel" value={fuente.medioNivel} />
                                  <DetailRow label="Categoria" value={fuente.medioCategoria} />
                                  <DetailRow label="Alguna Vez" value={fuente.algunaVezScrapeada ? 'SI' : 'NO'} />
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table footer */}
        {!loading && filtered.length > 0 && (
          <div className="mt-3 flex items-center justify-between text-[9px] font-mono text-slate-600">
            <span>
              Mostrando {filtered.length} de {fuentes.length} fuentes
            </span>
            {resumen && (
              <span>
                <span className="text-cyan-500">{resumen.algunaVezScrapeadas} scrapeadas</span>
                {' / '}
                <span className="text-red-400">{resumen.nuncaScrapeadas} nunca scrapeadas</span>
              </span>
            )}
          </div>
        )}
      </PanelShell>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════════════════════

function MiniStat({ label, value, color, sub }: { label: string; value: number; color: string; sub?: string }) {
  return (
    <div className="text-center py-1">
      <p className="text-[9px] font-bold uppercase text-slate-600 font-mono">{label}</p>
      <p className="text-lg font-bold font-mono tabular-nums" style={{ color }}>{value}</p>
      {sub && <p className="text-[8px] font-mono text-slate-500">{sub}</p>}
    </div>
  );
}

function DetailRow({ icon, label, value, sub }: { icon?: React.ReactNode; label: string; value: string | null; sub?: string | null }) {
  return (
    <div className="flex items-center gap-2">
      {icon && <span style={{ color: '#475569' }}>{icon}</span>}
      <span className="text-slate-500 min-w-[100px]">{label}:</span>
      <span className="font-bold" style={{ color: value ? '#cbd5e1' : '#475569' }}>
        {value || '---'}
      </span>
      {sub && (
        <span className="text-[8px]" style={{ color: getTimeColor(sub) }}>
          {sub}
        </span>
      )}
    </div>
  );
}
