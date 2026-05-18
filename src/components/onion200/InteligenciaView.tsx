'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { fetchWithTimeout } from '@/lib/fetch-utils';
import {
  Sparkles,
  Search,
  UserPlus,
  XCircle,
  CheckCircle,
  Clock,
  AlertTriangle,
  Loader2,
  Eye,
  Trash2,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────

interface Sugerencia {
  id: string;
  tipo: string;
  datoPropuesto: Record<string, unknown>;
  confianza: number;
  estado: string;
  createdAt: string;
  procesadaEn: string | null;
}

interface DiscoveryResult {
  sugerenciasCreadas: number;
  entidadesDetectadas: number;
  entidadesFiltradas: number;
  detalles: string[];
}

// ─── Helpers ────────────────────────────────────────────────────

function parseDato(dato: unknown): Record<string, unknown> {
  if (!dato) return {};
  if (typeof dato === 'object') return dato as Record<string, unknown>;
  try {
    return JSON.parse(String(dato));
  } catch {
    return {};
  }
}

function confianzaColor(c: number): string {
  if (c >= 70) return '#10b981';
  if (c >= 40) return '#f59e0b';
  return '#64748b';
}

function confianzaLabel(c: number): string {
  if (c >= 70) return 'ALTA';
  if (c >= 40) return 'MEDIA';
  return 'BAJA';
}

function tipoBadge(tipo: string): { label: string; color: string } {
  switch (tipo) {
    case 'nueva_persona': return { label: 'NUEVA PERSONA', color: '#06b6d4' };
    case 'nuevo_tema': return { label: 'NUEVO TEMA', color: '#a78bfa' };
    case 'nuevo_medio': return { label: 'NUEVO MEDIO', color: '#f59e0b' };
    default: return { label: tipo.toUpperCase(), color: '#64748b' };
  }
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'ahora mismo';
  if (mins < 60) return `hace ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return `hace ${days}d`;
}

// ─── Component ──────────────────────────────────────────────────

export function InteligenciaView() {
  const [sugerencias, setSugerencias] = useState<Sugerencia[]>([]);
  const [conteos, setConteos] = useState({ pendientes: 0, aprobadas: 0, rechazadas: 0, total: 0 });
  const [filtroEstado, setFiltroEstado] = useState<string>('pendiente');
  const [loading, setLoading] = useState(true);
  const [discovering, setDiscovering] = useState(false);
  const [discoveryLog, setDiscoveryLog] = useState<string[]>([]);
  const [accionando, setAccionando] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [creatingPersona, setCreatingPersona] = useState<string | null>(null);

  const fetchSugerencias = useCallback(async () => {
    try {
      const res = await fetchWithTimeout(`/api/sugerencias?estado=${filtroEstado}&limit=50`, {
        timeoutMs: 10000,
      });
      if (res.ok) {
        const data = await res.json();
        setSugerencias(data.sugerencias || []);
        setConteos(data.conteos || { pendientes: 0, aprobadas: 0, rechazadas: 0, total: 0 });
      }
    } catch {
      // Silent
    }
    setLoading(false);
  }, [filtroEstado]);

  useEffect(() => {
    fetchSugerencias();
  }, [fetchSugerencias]);

  const ejecutarDescubrimiento = async () => {
    setDiscovering(true);
    setDiscoveryLog(['Iniciando motor de descubrimiento...']);
    try {
      const res = await fetchWithTimeout('/api/sugerencias', {
        timeoutMs: 120000,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ejecutar' }),
      });

      const data = await res.json();

      if (res.ok) {
        setDiscoveryLog([
          `Descubrimiento completado en ${data.sugerenciasCreadas} sugerencias`,
          `${data.entidadesDetectadas} entidades detectadas por la IA`,
          `${data.entidadesFiltradas} filtradas (ya existen en DB)`,
          ...(data.detalles || []).slice(0, 10),
        ]);
        await fetchSugerencias();
      } else {
        setDiscoveryLog([`Error: ${data.error || 'Desconocido'}`]);
      }
    } catch (err) {
      setDiscoveryLog([`Error de conexión: ${err instanceof Error ? err.message : 'timeout'}`]);
    }
    setDiscovering(false);
  };

  const aprobar = async (id: string) => {
    setAccionando(id);
    try {
      const res = await fetchWithTimeout(`/api/sugerencias/${id}`, {
        timeoutMs: 15000,
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'aprobar' }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.personaId) {
          setDiscoveryLog(prev => [`Persona creada: ${data.personaId}`, ...prev]);
        }
        await fetchSugerencias();
      }
    } catch { /* silent */ }
    setAccionando(null);
  };

  const rechazar = async (id: string) => {
    setAccionando(id);
    try {
      await fetchWithTimeout(`/api/sugerencias/${id}`, {
        timeoutMs: 10000,
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rechazar' }),
      });
      await fetchSugerencias();
    } catch { /* silent */ }
    setAccionando(null);
  };

  const eliminar = async (id: string) => {
    setAccionando(id);
    try {
      await fetchWithTimeout(`/api/sugerencias/${id}`, {
        timeoutMs: 10000,
        method: 'DELETE',
      });
      await fetchSugerencias();
    } catch { /* silent */ }
    setAccionando(null);
  };

  // ─── Render ──────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* ─── HEADER ─── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center w-8 h-8 rounded-lg"
            style={{
              border: '1px solid rgba(167,139,250,0.3)',
              backgroundColor: 'rgba(167,139,250,0.08)',
            }}
          >
            <Sparkles size={16} className="text-violet-400" />
          </div>
          <div>
            <h2 className="text-sm font-bold tracking-[0.15em] text-violet-300 font-mono uppercase">
              Descubrimiento Inteligente
            </h2>
            <p className="text-[9px] tracking-wider text-slate-600 font-mono">
              DETECCION DE ACTORES Y TEMAS EMERGENTES
            </p>
          </div>
        </div>

        <button
          onClick={ejecutarDescubrimiento}
          disabled={discovering}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold font-mono uppercase tracking-wider transition-all"
          style={{
            backgroundColor: discovering ? 'rgba(167,139,250,0.1)' : 'rgba(167,139,250,0.15)',
            border: '1px solid rgba(167,139,250,0.3)',
            color: discovering ? '#64748b' : '#a78bfa',
            cursor: discovering ? 'not-allowed' : 'pointer',
          }}
        >
          {discovering ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Search size={14} />
          )}
          {discovering ? 'Analizando...' : 'Ejecutar Escaneo'}
        </button>
      </div>

      {/* ─── CONTEOS ─── */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Pendientes', value: conteos.pendientes, color: '#f59e0b' },
          { label: 'Aprobadas', value: conteos.aprobadas, color: '#10b981' },
          { label: 'Rechazadas', value: conteos.rechazadas, color: '#64748b' },
        ].map(item => (
          <div
            key={item.label}
            className="rounded-lg p-3"
            style={{
              backgroundColor: `${item.color}08`,
              border: `1px solid ${item.color}15`,
            }}
          >
            <p className="text-[9px] font-mono uppercase tracking-wider" style={{ color: `${item.color}80` }}>
              {item.label}
            </p>
            <p className="text-xl font-bold font-mono tabular-nums mt-1" style={{ color: item.color }}>
              {item.value}
            </p>
          </div>
        ))}
      </div>

      {/* ─── FILTROS ─── */}
      <div className="flex items-center gap-2">
        {['pendiente', 'aprobada', 'rechazada'].map(estado => (
          <button
            key={estado}
            onClick={() => setFiltroEstado(estado)}
            className="px-3 py-1.5 rounded-md text-[10px] font-bold font-mono uppercase tracking-wider transition-all"
            style={{
              backgroundColor: filtroEstado === estado ? 'rgba(6,182,212,0.1)' : 'transparent',
              border: `1px solid ${filtroEstado === estado ? 'rgba(6,182,212,0.2)' : 'rgba(100,116,139,0.1)'}`,
              color: filtroEstado === estado ? '#06b6d4' : '#64748b',
              cursor: 'pointer',
            }}
          >
            {estado}
          </button>
        ))}
      </div>

      {/* ─── DISCOVERY LOG ─── */}
      {discoveryLog.length > 0 && (
        <div
          className="rounded-lg p-3 overflow-x-auto"
          style={{
            backgroundColor: 'rgba(0,0,0,0.4)',
            border: '1px solid rgba(167,139,250,0.1)',
          }}
        >
          <p className="text-[9px] font-mono uppercase tracking-wider text-violet-500 mb-2">
            Log de Descubrimiento
          </p>
          {discoveryLog.map((line, i) => (
            <p key={i} className="text-[10px] font-mono text-slate-500 leading-relaxed">
              <span className="text-slate-700">{i === 0 ? '>' : ' '} </span>
              {line}
            </p>
          ))}
        </div>
      )}

      {/* ─── SUGERENCIAS GRID ─── */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={20} className="animate-spin text-slate-700" />
        </div>
      ) : sugerencias.length === 0 ? (
        <div className="text-center py-12">
          <Sparkles size={32} className="text-slate-800 mx-auto mb-3" />
          <p className="text-xs font-mono text-slate-600">
            {filtroEstado === 'pendiente'
              ? 'Sin sugerencias pendientes. Ejecuta un escaneo para detectar actores emergentes.'
              : `Sin sugerencias ${filtroEstado}s.`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {sugerencias.map(sug => {
            const dato = parseDato(sug.datoPropuesto);
            const nombre = String(dato.nombre || 'Desconocido');
            const cargo = String(dato.cargo || '');
            const medios: Record<string, unknown> = dato.medios || {};
            const mediosNames = Object.keys(medios);
            const numMedios = Number(dato.numMedios) || mediosNames.length;
            const frecuencia = Number(dato.frecuencia) || 1;
            const contextos: string[] = Array.isArray(dato.contextos) ? dato.contextos : [];
            const badge = tipoBadge(sug.tipo);
            const confColor = confianzaColor(sug.confianza);
            const isExpanded = expandedId === sug.id;
            const isAct = accionando === sug.id;

            return (
              <div
                key={sug.id}
                className="rounded-lg overflow-hidden transition-all"
                style={{
                  backgroundColor: 'rgba(5,5,5,0.9)',
                  border: `1px solid ${confColor}15`,
                }}
              >
                {/* Card header */}
                <div className="p-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        {/* Tipo badge */}
                        <span
                          className="px-2 py-0.5 rounded text-[8px] font-bold font-mono uppercase tracking-wider"
                          style={{
                            backgroundColor: `${badge.color}15`,
                            color: badge.color,
                            border: `1px solid ${badge.color}25`,
                          }}
                        >
                          {badge.label}
                        </span>
                        {/* Confianza */}
                        <span
                          className="px-2 py-0.5 rounded text-[8px] font-bold font-mono uppercase"
                          style={{ color: confColor }}
                        >
                          {confianzaLabel(sug.confianza)} ({sug.confianza}%)
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-slate-200 font-mono truncate">{nombre}</h3>
                      {cargo && (
                        <p className="text-[10px] font-mono text-slate-500 truncate mt-0.5">{cargo}</p>
                      )}
                    </div>

                    {/* Expand button */}
                    {contextos.length > 0 && (
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : sug.id)}
                        className="flex-shrink-0 p-1.5 rounded-md transition-colors"
                        style={{ color: '#64748b' }}
                      >
                        <Eye size={14} />
                      </button>
                    )}
                  </div>

                  {/* Medios info */}
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-[9px] font-mono text-slate-500">
                      {numMedios} medio{numMedios > 1 ? 's' : ''}
                    </span>
                    <span className="text-[9px] font-mono text-slate-600">|</span>
                    <span className="text-[9px] font-mono text-slate-500">
                      {frecuencia} mención{frecuencia > 1 ? 'es' : ''}
                    </span>
                    <span className="text-[9px] font-mono text-slate-600">|</span>
                    <span className="text-[9px] font-mono text-slate-700">
                      {timeAgo(sug.createdAt)}
                    </span>
                  </div>

                  {/* Medios tags */}
                  {mediosNames.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap mb-2">
                      {mediosNames.slice(0, 5).map(m => (
                        <span
                          key={m}
                          className="px-1.5 py-0.5 rounded text-[8px] font-mono"
                          style={{
                            backgroundColor: 'rgba(6,182,212,0.06)',
                            color: '#06b6d480',
                            border: '1px solid rgba(6,182,212,0.08)',
                          }}
                        >
                          {m}
                        </span>
                      ))}
                      {mediosNames.length > 5 && (
                        <span className="text-[8px] font-mono text-slate-600">
                          +{mediosNames.length - 5}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Expanded: contextos */}
                  {isExpanded && contextos.length > 0 && (
                    <div className="mb-3 p-2 rounded-md" style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}>
                      <p className="text-[9px] font-mono uppercase tracking-wider text-slate-600 mb-1">Contexto</p>
                      {contextos.map((ctx, i) => (
                        <p key={i} className="text-[10px] font-mono text-slate-500 leading-relaxed">
                          {String(ctx)}
                        </p>
                      ))}
                    </div>
                  )}

                  {/* Action buttons (solo para pendientes) */}
                  {sug.estado === 'pendiente' && (
                    <div className="flex items-center gap-2 pt-2" style={{ borderTop: '1px solid rgba(100,116,139,0.08)' }}>
                      <button
                        onClick={() => aprobar(sug.id)}
                        disabled={isAct}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[9px] font-bold font-mono uppercase tracking-wider transition-all"
                        style={{
                          backgroundColor: 'rgba(16,185,129,0.1)',
                          border: '1px solid rgba(16,185,129,0.2)',
                          color: isAct ? '#334155' : '#10b981',
                          cursor: isAct ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {isAct ? (
                          <Loader2 size={11} className="animate-spin" />
                        ) : (
                          <UserPlus size={11} />
                        )}
                        Crear Persona
                      </button>
                      <button
                        onClick={() => rechazar(sug.id)}
                        disabled={isAct}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[9px] font-bold font-mono uppercase tracking-wider transition-all"
                        style={{
                          backgroundColor: 'rgba(100,116,139,0.05)',
                          border: '1px solid rgba(100,116,139,0.1)',
                          color: '#64748b',
                          cursor: isAct ? 'not-allowed' : 'pointer',
                        }}
                      >
                        <XCircle size={11} />
                        Ignorar
                      </button>
                      <button
                        onClick={() => eliminar(sug.id)}
                        disabled={isAct}
                        className="ml-auto p-1.5 rounded-md transition-colors"
                        style={{ color: '#475569', cursor: isAct ? 'not-allowed' : 'pointer' }}
                        title="Eliminar"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  )}

                  {/* Estado para aprobadas/rechazadas */}
                  {sug.estado === 'aprobada' && (
                    <div className="flex items-center gap-1.5 pt-2" style={{ borderTop: '1px solid rgba(16,185,129,0.08)' }}>
                      <CheckCircle size={11} style={{ color: '#10b981' }} />
                      <span className="text-[9px] font-mono text-emerald-600">
                        Aprobada {sug.procesadaEn ? `— ${timeAgo(sug.procesadaEn)}` : ''}
                      </span>
                    </div>
                  )}
                  {sug.estado === 'rechazada' && (
                    <div className="flex items-center gap-1.5 pt-2" style={{ borderTop: '1px solid rgba(100,116,139,0.06)' }}>
                      <XCircle size={11} className="text-slate-600" />
                      <span className="text-[9px] font-mono text-slate-600">
                        Rechazada {sug.procesadaEn ? `— ${timeAgo(sug.procesadaEn)}` : ''}
                      </span>
                    </div>
                  )}
                </div>

                {/* Bottom glow */}
                <div
                  className="h-[1px]"
                  style={{ background: `linear-gradient(90deg, transparent, ${confColor}15, transparent)` }}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
