'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { fetchWithTimeout } from '@/lib/fetch-utils';
import {
  Radio,
  Newspaper,
  RefreshCw,
  X,
  ExternalLink,
  Loader2,
  User,
  Building2,
  Calendar,
  Tag,
  MessageSquare,
  Eye,
  ChevronLeft,
} from 'lucide-react';
import { PanelShell } from './PanelShell';
import { sentimentColor, sentimentBg } from '@/constants/colors';

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

interface MencionReciente {
  id: string;
  titulo: string;
  fechaCaptura: string;
  sentimiento: string;
  tipoMencion: string;
  Persona?: { nombre: string; partidoSigla: string; camara: string } | null;
  Medio?: { nombre: string; tipo: string } | null;
}

interface MencionDetail {
  id: string;
  titulo: string;
  contenido: string;
  url: string | null;
  fechaCaptura: string;
  sentimiento: string;
  tipoMencion: string;
  tratamientoPeriodistico: string | null;
  Persona: { id: string; nombre: string; partidoSigla: string; camara: string; departamento?: string } | null;
  Medio: { id: string; nombre: string; tipo: string } | null;
}

interface Comentario {
  id: string;
  autor: string;
  texto: string;
  sentimiento: string;
  fechaComentario: string;
}

// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════

function sentimentLabel(s: string): string {
  if (s.includes('positivo')) return 'POSITIVO';
  if (s.includes('negativo')) return 'NEGATIVO';
  if (s.includes('neutro')) return 'NEUTRO';
  return 'SIN CLASIFICAR';
}

function tiempoRelativo(fechaStr: string): string {
  const fecha = new Date(fechaStr);
  const ms = Date.now() - fecha.getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'ahora mismo';
  if (mins < 60) return `hace ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs}h`;
  const dias = Math.floor(hrs / 24);
  return `hace ${dias}d`;
}

function formatFechaBolivia(fechaStr: string): string {
  return new Date(fechaStr).toLocaleString('es-BO', {
    timeZone: 'America/La_Paz',
    dateStyle: 'full',
    timeStyle: 'short',
  });
}

// ═══════════════════════════════════════════════════════════════
// Mention Detail Modal
// ═══════════════════════════════════════════════════════════════

export function MencionDetailModal({
  mencionId,
  onClose,
}: {
  mencionId: string;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<MencionDetail | null>(null);
  const [comentarios, setComentarios] = useState<Comentario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchDetail() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchWithTimeout(`/api/menciones/${mencionId}`, { timeoutMs: 8000 });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setDetail(data.mencion || data);
        setComentarios(data.comentarios || []);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al cargar');
      } finally {
        setLoading(false);
      }
    }
    fetchDetail();
  }, [mencionId]);

  // Close on Escape
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  // Close on backdrop click
  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === modalRef.current) onClose();
  };

  const sColor = detail ? sentimentColor(detail.sentimiento) : '#64748b';
  const sLabel = detail ? sentimentLabel(detail.sentimiento) : '---';
  const sBg = detail ? sentimentBg(detail.sentimiento) : 'transparent';

  return (
    <div
      ref={modalRef}
      onClick={handleBackdrop}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
    >
      <div
        className="relative w-full max-w-2xl max-h-[85vh] rounded-xl overflow-hidden flex flex-col"
        style={{
          backgroundColor: '#0a0a0a',
          border: '1px solid rgba(6,182,212,0.12)',
          boxShadow: '0 0 60px rgba(6,182,212,0.06), 0 25px 50px rgba(0,0,0,0.5)',
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-800/60">
          <div
            className="w-1 h-8 rounded-full"
            style={{ backgroundColor: sColor, boxShadow: `0 0 8px ${sColor}40` }}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span
                className="text-[9px] font-bold font-mono px-2 py-0.5 rounded"
                style={{ color: sColor, backgroundColor: sBg, border: `1px solid ${sColor}25` }}
              >
                {sLabel}
              </span>
              {detail?.tipoMencion && (
                <span className="text-[9px] font-mono text-slate-600 uppercase">
                  {detail.tipoMencion.replace(/_/g, ' ')}
                </span>
              )}
            </div>
            <h2 className="text-sm font-mono text-slate-200 font-bold mt-1 leading-snug line-clamp-2">
              {detail?.titulo || 'Cargando...'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 p-1.5 rounded-lg transition-all hover:bg-slate-800/60"
            style={{ color: '#64748b' }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-4 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-slate-600 text-xs font-mono">
              <Loader2 className="w-4 h-4 animate-spin" />
              Cargando detalle de la mencion...
            </div>
          ) : error ? (
            <div className="flex items-center justify-center gap-2 py-8 text-red-400/70 text-xs font-mono">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              {error}
            </div>
          ) : detail ? (
            <>
              {/* Metadata row */}
              <div className="grid grid-cols-2 gap-3">
                {/* Persona */}
                {detail.Persona?.nombre ? (
                  <div className="rounded-lg px-3 py-2.5" style={{
                    backgroundColor: 'rgba(16,185,129,0.04)',
                    border: '1px solid rgba(16,185,129,0.1)',
                  }}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <User className="w-3 h-3 text-emerald-500/60" />
                      <span className="text-[9px] font-bold uppercase text-slate-600 font-mono">Persona</span>
                    </div>
                    <p className="text-[11px] font-mono text-emerald-400 font-bold">
                      {detail.Persona.nombre}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {detail.Persona.partidoSigla && (
                        <span className="text-[9px] font-mono text-slate-500">
                          {detail.Persona.partidoSigla}
                        </span>
                      )}
                      {detail.Persona.camara && (
                        <span className="text-[9px] font-mono text-slate-600">
                          {detail.Persona.camara}
                        </span>
                      )}
                      {detail.Persona.departamento && (
                        <span className="text-[9px] font-mono text-slate-700">
                          {detail.Persona.departamento}
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg px-3 py-2.5" style={{
                    backgroundColor: 'rgba(100,116,139,0.04)',
                    border: '1px solid rgba(100,116,139,0.1)',
                  }}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <User className="w-3 h-3 text-slate-600" />
                      <span className="text-[9px] font-bold uppercase text-slate-600 font-mono">Persona</span>
                    </div>
                    <p className="text-[11px] font-mono text-slate-600 italic">
                      Sin persona asociada
                    </p>
                  </div>
                )}

                {/* Medio */}
                {detail.Medio?.nombre ? (
                  <div className="rounded-lg px-3 py-2.5" style={{
                    backgroundColor: 'rgba(167,139,250,0.04)',
                    border: '1px solid rgba(167,139,250,0.1)',
                  }}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Building2 className="w-3 h-3 text-violet-500/60" />
                      <span className="text-[9px] font-bold uppercase text-slate-600 font-mono">Medio</span>
                    </div>
                    <p className="text-[11px] font-mono text-violet-400 font-bold">
                      {detail.Medio.nombre}
                    </p>
                    {detail.Medio.tipo && (
                      <p className="text-[9px] font-mono text-slate-500 mt-0.5">
                        {detail.Medio.tipo}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="rounded-lg px-3 py-2.5" style={{
                    backgroundColor: 'rgba(100,116,139,0.04)',
                    border: '1px solid rgba(100,116,139,0.1)',
                  }}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Building2 className="w-3 h-3 text-slate-600" />
                      <span className="text-[9px] font-bold uppercase text-slate-600 font-mono">Medio</span>
                    </div>
                    <p className="text-[11px] font-mono text-slate-600 italic">
                      Medio desconocido
                    </p>
                  </div>
                )}

                {/* Fecha */}
                <div className="rounded-lg px-3 py-2.5" style={{
                  backgroundColor: 'rgba(6,182,212,0.04)',
                  border: '1px solid rgba(6,182,212,0.08)',
                }}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Calendar className="w-3 h-3 text-cyan-500/60" />
                    <span className="text-[9px] font-bold uppercase text-slate-600 font-mono">Fecha Captura</span>
                  </div>
                  <p className="text-[10px] font-mono text-cyan-300">
                    {formatFechaBolivia(detail.fechaCaptura)}
                  </p>
                  <p className="text-[9px] font-mono text-slate-600 mt-0.5">
                    {tiempoRelativo(detail.fechaCaptura)}
                  </p>
                </div>

                {/* Tratamiento periodístico */}
                <div className="rounded-lg px-3 py-2.5" style={{
                  backgroundColor: 'rgba(245,158,11,0.04)',
                  border: '1px solid rgba(245,158,11,0.08)',
                }}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Eye className="w-3 h-3 text-amber-500/60" />
                    <span className="text-[9px] font-bold uppercase text-slate-600 font-mono">Lente</span>
                  </div>
                  <p className="text-[10px] font-mono text-amber-300">
                    {detail.tratamientoPeriodistico || 'Sin clasificar'}
                  </p>
                </div>
              </div>

              {/* Contenido */}
              {detail.contenido && (
                <div className="rounded-lg px-4 py-3" style={{
                  backgroundColor: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.05)',
                }}>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Tag className="w-3 h-3 text-slate-600" />
                    <span className="text-[9px] font-bold uppercase text-slate-600 font-mono">Contenido Completo</span>
                  </div>
                  <p className="text-[11px] font-mono text-slate-300 leading-relaxed whitespace-pre-wrap">
                    {detail.contenido}
                  </p>
                </div>
              )}

              {/* URL original */}
              {detail.url && (
                <a
                  href={detail.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-lg px-3 py-2.5 transition-all hover:scale-[1.01]"
                  style={{
                    backgroundColor: 'rgba(6,182,212,0.06)',
                    border: '1px solid rgba(6,182,212,0.12)',
                    color: '#06b6d4',
                    textDecoration: 'none',
                  }}
                >
                  <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="text-[10px] font-mono truncate flex-1">
                    {detail.url}
                  </span>
                  <span className="text-[9px] font-mono text-cyan-600 flex-shrink-0">
                    ABRIR
                  </span>
                </a>
              )}

              {/* Comentarios */}
              {comentarios.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <MessageSquare className="w-3 h-3 text-slate-600" />
                    <span className="text-[9px] font-bold uppercase text-slate-600 font-mono">
                      Comentarios ({comentarios.length})
                    </span>
                  </div>
                  <div className="space-y-2">
                    {comentarios.map((c) => (
                      <div
                        key={c.id}
                        className="rounded-md px-3 py-2"
                        style={{
                          backgroundColor: 'rgba(255,255,255,0.02)',
                          border: '1px solid rgba(255,255,255,0.04)',
                        }}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[9px] font-bold font-mono text-slate-400">{c.autor}</span>
                          {c.sentimiento && (
                            <span
                              className="text-[8px] font-mono px-1 py-0.5 rounded"
                              style={{
                                color: sentimentColor(c.sentimiento),
                                backgroundColor: `${sentimentColor(c.sentimiento)}10`,
                              }}
                            >
                              {c.sentimiento}
                            </span>
                          )}
                          <span className="text-[8px] font-mono text-slate-700 ml-auto">
                            {c.fechaComentario ? new Date(c.fechaComentario).toLocaleDateString('es-BO') : ''}
                          </span>
                        </div>
                        <p className="text-[10px] font-mono text-slate-400 leading-relaxed">
                          {c.texto}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ID */}
              <div className="flex items-center gap-2 pt-2 border-t border-slate-800/40">
                <span className="text-[8px] font-mono text-slate-800">ID: {detail.id.slice(0, 8)}...</span>
              </div>
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-5 py-3 border-t border-slate-800/60">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[10px] font-bold font-mono uppercase tracking-wider transition-all hover:scale-[1.01]"
            style={{
              color: '#64748b',
              backgroundColor: 'rgba(100,116,139,0.08)',
              border: '1px solid rgba(100,116,139,0.15)',
            }}
          >
            <ChevronLeft className="w-3 h-3" />
            Cerrar
          </button>
          {detail?.url && (
            <a
              href={detail.url}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto flex items-center gap-1.5 px-4 py-2 rounded-lg text-[10px] font-bold font-mono uppercase tracking-wider transition-all hover:scale-[1.01]"
              style={{
                color: '#06b6d4',
                backgroundColor: 'rgba(6,182,212,0.08)',
                border: '1px solid rgba(6,182,212,0.2)',
                textDecoration: 'none',
              }}
            >
              <ExternalLink className="w-3 h-3" />
              Nota Original
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// LiveFeed — Real-time mention ticker (clickeable)
// ═══════════════════════════════════════════════════════════════

type TabKey = 'resumen' | 'alertas' | 'fuentes' | 'captura' | 'clasificacion' | 'inteligencia' | 'produccion' | 'distribucion';

interface LiveFeedProps {
  onNavigateTab?: (tab: TabKey) => void;
}

export function LiveFeed({ onNavigateTab }: LiveFeedProps) {
  const [menciones, setMenciones] = useState<MencionReciente[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalToday, setTotalToday] = useState<number | null>(null);
  const [selectedMencionId, setSelectedMencionId] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetchWithTimeout(
        '/api/menciones?limit=5&orderBy=fechaCaptura&orderDir=desc',
        { timeoutMs: 8000 }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (Array.isArray(data.menciones)) {
        setMenciones(data.menciones);
        setTotalToday(data.total ?? null);
        setError(null);
      } else if (Array.isArray(data)) {
        setMenciones(data.slice(0, 5));
        setError(null);
      }
      setLoading(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error de conexion');
      setLoading(false);
    }
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setTimeout(() => setRefreshing(false), 500);
  };

  useEffect(() => {
    fetchData();
    intervalRef.current = setInterval(fetchData, 15000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchData]);

  return (
    <>
      <PanelShell title="Flujo en Vivo" icon={<Radio className="w-4 h-4" />} className="relative">
        {/* Refresh button */}
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="absolute top-3 right-3 z-10 flex items-center gap-1 px-2 py-1 rounded text-[9px] font-mono uppercase tracking-wider transition-all hover:bg-slate-800/40 disabled:opacity-40"
          style={{ color: '#06b6d4', border: '1px solid rgba(6,182,212,0.15)' }}
          title="Refrescar menciones"
        >
          <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
        </button>

        {loading && menciones.length === 0 ? (
          <div className="flex items-center gap-2 py-6 text-slate-600 text-xs font-mono justify-center">
            <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
            Escaneando frecuencias...
          </div>
        ) : error && menciones.length === 0 ? (
          <div className="flex items-center gap-2 py-4 text-red-400/70 text-xs font-mono">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            Sin señal — {error}
          </div>
        ) : menciones.length === 0 ? (
          <div className="flex items-center gap-2 py-6 text-slate-600 text-xs font-mono justify-center">
            <Newspaper className="w-4 h-4" />
            Sin menciones capturadas aun
          </div>
        ) : (
          <div className="space-y-2">
            {/* Total counter */}
            {totalToday !== null && (
              <div className="flex items-center gap-2 mb-2 px-1">
                <span className="text-[9px] font-bold uppercase text-slate-600 font-mono">
                  Total en BD:
                </span>
                <span className="text-xs font-mono text-cyan-400 tabular-nums">
                  {totalToday}
                </span>
              </div>
            )}

            {/* Mention cards — CLICKABLE */}
            <div className="space-y-1.5">
              {menciones.map((m, i) => (
                <button
                  key={m.id}
                  onClick={() => setSelectedMencionId(m.id)}
                  className="group relative w-full text-left rounded-md px-3 py-2.5 transition-all duration-200 hover:scale-[1.01] cursor-pointer"
                  style={{
                    background:
                      i === 0
                        ? 'rgba(6, 182, 212, 0.06)'
                        : 'rgba(255, 255, 255, 0.01)',
                    border: `1px solid ${
                      i === 0
                        ? 'rgba(6, 182, 212, 0.15)'
                        : 'rgba(255, 255, 255, 0.04)'
                    }`,
                  }}
                  title="Click para ver detalle completo"
                >
                  {/* Top row: persona + medio */}
                  <div className="flex items-center gap-2 mb-1">
                    {m.Persona?.nombre ? (
                      <span className="text-[10px] font-bold font-mono text-emerald-400 truncate max-w-[120px]">
                        {m.Persona.nombre}
                        {m.Persona.partidoSigla && (
                          <span className="text-slate-600 ml-1">
                            ({m.Persona.partidoSigla})
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono text-slate-600 italic">
                        Sin persona
                      </span>
                    )}
                    <span className="text-slate-700">·</span>
                    <span className="text-[10px] font-mono text-slate-500 truncate max-w-[120px]">
                      {m.Medio?.nombre || 'Medio desconocido'}
                    </span>
                    {/* Sentiment badge */}
                    <span
                      className="ml-auto text-[9px] font-bold font-mono px-1.5 py-0.5 rounded"
                      style={{
                        color: sentimentColor(m.sentimiento),
                        backgroundColor: `${sentimentColor(m.sentimiento)}12`,
                        border: `1px solid ${sentimentColor(m.sentimiento)}25`,
                      }}
                    >
                      {sentimentLabel(m.sentimiento)}
                    </span>
                  </div>

                  {/* Title */}
                  <p className="text-[11px] text-slate-300 font-mono leading-snug line-clamp-2">
                    {m.titulo || 'Sin titulo'}
                  </p>

                  {/* Bottom row: time + type */}
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[9px] font-mono text-slate-600">
                      {tiempoRelativo(m.fechaCaptura)}
                    </span>
                    <span className="text-slate-800">·</span>
                    <span className="text-[9px] font-mono text-slate-700 uppercase">
                      {m.tipoMencion?.replace(/_/g, ' ') || '---'}
                    </span>
                    {/* Click hint */}
                    <span className="ml-auto text-[8px] font-mono text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity">
                      VER DETALLE →
                    </span>
                  </div>

                  {/* Latest indicator */}
                  {i === 0 && (
                    <div
                      className="absolute left-0 top-1 bottom-1 w-[2px] rounded-full"
                      style={{
                        background:
                          'linear-gradient(180deg, #06b6d4, transparent)',
                      }}
                    />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
        {/* Footer: navigate to Captura */}
        {onNavigateTab && menciones.length > 0 && (
          <div className="px-4 pb-3 pt-1">
            <button
              onClick={() => onNavigateTab('captura')}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[9px] font-mono uppercase tracking-wider transition-all hover:bg-cyan-500/5"
              style={{ color: '#06b6d480', border: '1px solid rgba(6,182,212,0.06)' }}
            >
              Ver todas las menciones →
            </button>
          </div>
        )}
      </PanelShell>

      {/* Detail Modal */}
      {selectedMencionId && (
        <MencionDetailModal
          mencionId={selectedMencionId}
          onClose={() => setSelectedMencionId(null)}
        />
      )}
    </>
  );
}
