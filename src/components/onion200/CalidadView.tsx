'use client';
import { tratamientoToSentimiento } from '@/lib/utils/sentimiento';

import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  GitMerge,
  Trash2,
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Copy,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Star,
  FileText,
  Zap,
  XCircle,
  Brain,
  BarChart3,
} from 'lucide-react';
import { fetchWithTimeout } from '@/lib/fetch-utils';
import { PanelShell } from './PanelShell';

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

interface DupItem {
  id: string;
  titulo: string;
  medio: string;
  medioId: string;
  persona: string | null;
  personaId: string | null;
  sentimiento: string;
  eje: string | null;
  ejeId: string | null;
  tipo: string;
  tratamiento: string | null;
  confianza: string | null;
  fechaCaptura: string | null;
  fechaClasificacion: string | null;
  tieneTextoOriginal: boolean;
  textoLength: number;
  esDuplicado: boolean;
  mencionOriginalId: string | null;
  dedupLog: string | null;
  score: number;
  url?: string;
  tituloOriginal?: string;
}

interface DupGroup {
  tipo: 'url' | 'titulo';
  url?: string;
  titulo?: string;
  total: number;
  mejorId: string;
  items: DupItem[];
}

interface QualityStats {
  total: number;
  clasificadas: number;
  sinClasificar: number;
  conEje: number;
  conTratamiento: number;
  conConfianza: number;
  conPersona: number;
  conTextoOriginal: number;
  marcadosDuplicado: number;
  pctClasificadas: number;
  pctConEje: number;
  pctConTratamiento: number;
  pctConTextoOriginal: number;
  pctDuplicados: number;
}

type QualityTab = 'stats' | 'duplicados_url' | 'duplicados_titulo';

// ═══════════════════════════════════════════════════════════════
// CalidadView — Quality Control Panel
// ═══════════════════════════════════════════════════════════════

export function CalidadView() {
  const [activeTab, setActiveTab] = useState<QualityTab>('stats');
  const [stats, setStats] = useState<QualityStats | null>(null);
  const [grupos, setGrupos] = useState<DupGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLog, setActionLog] = useState<Array<{ msg: string; tipo: 'ok' | 'error' | 'info' }>>([]);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [operando, setOperando] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetchWithTimeout('/api/dashboard/quality/stats', { timeoutMs: 10000 });
      if (res.ok) {
        const data = await res.json();
        setStats(data.calidad);
      }
    } catch { /* silent */ }
  }, []);

  const fetchDuplicados = useCallback(async (metodo: 'url' | 'titulo') => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithTimeout(`/api/dashboard/quality/duplicates?metodo=${metodo}&limite=50`, { timeoutMs: 15000 });
      if (res.ok) {
        const data = await res.json();
        setGrupos(Array.isArray(data.grupos) ? data.grupos : []);
      } else {
        setError('Error cargando duplicados');
      }
    } catch {
      setError('Error de conexion');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchStats();
    const iv = setInterval(fetchStats, 30000);
    return () => clearInterval(iv);
  }, [fetchStats]);

  useEffect(() => {
    if (activeTab === 'duplicados_url') fetchDuplicados('url');
    if (activeTab === 'duplicados_titulo') fetchDuplicados('titulo');
  }, [activeTab, fetchDuplicados]);

  const addLog = (msg: string, tipo: 'ok' | 'error' | 'info') => {
    setActionLog(prev => [{ msg, tipo }, ...prev].slice(0, 20));
  };

  // ── Actions ──
  const handleFusionar = async (grupo: DupGroup) => {
    setOperando(`merge-${grupo.url || grupo.titulo}`);
    const allIds = grupo.items.map(i => i.id);
    try {
      const res = await fetchWithTimeout('/api/dashboard/quality/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grupoIds: allIds, mantenerId: grupo.mejorId }),
        timeoutMs: 15000,
      });
      const data = await res.json();
      if (data.success) {
        addLog(`Fusionados ${data.eliminados.length} en ${data.mantenido} (datos: ${data.datosTransferidos.join(', ')})`, 'ok');
        fetchStats();
        if (activeTab === 'duplicados_url') fetchDuplicados('url');
        if (activeTab === 'duplicados_titulo') fetchDuplicados('titulo');
      } else {
        addLog(`Error fusionando: ${data.error}`, 'error');
      }
    } catch (e) {
      addLog(`Error: ${e instanceof Error ? e.message : 'desconocido'}`, 'error');
    }
    setOperando(null);
  };

  const handleEliminar = async (grupo: DupGroup) => {
    if (!confirm(`Eliminar ${grupo.total - 1} duplicados, mantener el mejor?`)) return;
    setOperando(`del-${grupo.url || grupo.titulo}`);
    try {
      const res = await fetchWithTimeout('/api/dashboard/quality/duplicates', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: grupo.items.map(i => i.id), mantenerId: grupo.mejorId }),
        timeoutMs: 15000,
      });
      const data = await res.json();
      if (data.success) {
        addLog(`Eliminados ${data.eliminadas} duplicados`, 'ok');
        fetchStats();
        if (activeTab === 'duplicados_url') fetchDuplicados('url');
        if (activeTab === 'duplicados_titulo') fetchDuplicados('titulo');
      } else {
        addLog(`Error: ${data.error}`, 'error');
      }
    } catch (e) {
      addLog(`Error: ${e instanceof Error ? e.message : 'desconocido'}`, 'error');
    }
    setOperando(null);
  };

  const handleReclasificar = async (mencionId: string) => {
    setOperando(`reclass-${mencionId}`);
    try {
      const res = await fetchWithTimeout('/api/dashboard/quality/reclassify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mencionId, accion: 'reclasificar_auto' }),
        timeoutMs: 30000,
      });
      const data = await res.json();
      if (data.success) {
        addLog(`Reclasificada ${mencionId.substring(0, 8)}: ${data.mencion?.sentimiento} / ${data.mencion?.ejeEstructuralId}`, 'ok');
        fetchStats();
      } else {
        addLog(`Error reclasificando: ${data.error}`, 'error');
      }
    } catch (e) {
      addLog(`Error: ${e instanceof Error ? e.message : 'desconocido'}`, 'error');
    }
    setOperando(null);
  };

  // ── Helpers ──
  const sentimientoColor = (s: string) => {
    switch (s) {
      case 'positivo': case 'elogioso': return '#10b981';
      case 'negativo': case 'critico': case 'agresivo': return '#ef4444';
      case 'neutro': case 'informativo': return '#64748b';
      case 'mixto': case 'ambiguo': return '#f59e0b';
      default: return '#06b6d4';
    }
  };

  const scoreColor = (s: number) => {
    if (s >= 15) return '#10b981';
    if (s >= 10) return '#06b6d4';
    if (s >= 5) return '#f59e0b';
    return '#ef4444';
  };

  const isOperando = (key: string) => operando === key;

  // ═══════════════════════════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════════════════════════

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
      {/* ═══ LEFT: Stats + Controls ═══ */}
      <div className="lg:col-span-5 space-y-4">
        {/* Stats Panel */}
        <PanelShell title="Control de Calidad" icon={<ShieldCheck className="w-4 h-4" />}>
          {stats && (
            <div className="space-y-3">
              {/* Quality score bar */}
              <div className="px-3 py-2.5 rounded-md" style={{
                backgroundColor: 'rgba(6,182,212,0.04)',
                border: '1px solid rgba(6,182,212,0.08)',
              }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono text-slate-500">Calidad general</span>
                  <span className="text-[10px] font-mono text-cyan-400">{stats.total} menciones</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(6,182,212,0.1)' }}>
                  <div className="h-full rounded-full transition-all duration-500" style={{
                    width: `${Math.round((stats.pctClasificadas + stats.pctConEje + stats.pctConTratamiento + stats.pctConTextoOriginal) / 4)}%`,
                    background: 'linear-gradient(90deg, #10b981, #06b6d4, #a78bfa)',
                    boxShadow: '0 0 8px rgba(6,182,212,0.3)',
                  }} />
                </div>
              </div>

              {/* Quality metrics grid */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Clasificadas', value: stats.clasificadas, pct: stats.pctClasificadas, color: '#06b6d4', icon: <Brain className="w-3 h-3" /> },
                  { label: 'Con Eje', value: stats.conEje, pct: stats.pctConEje, color: '#10b981', icon: <Zap className="w-3 h-3" /> },
                  { label: 'Con Tratamiento', value: stats.conTratamiento, pct: stats.pctConTratamiento, color: '#f59e0b', icon: <FileText className="w-3 h-3" /> },
                  { label: 'Texto Original', value: stats.conTextoOriginal, pct: stats.pctConTextoOriginal, color: '#a78bfa', icon: <FileText className="w-3 h-3" /> },
                ].map(m => (
                  <div key={m.label} className="px-2.5 py-2 rounded" style={{
                    backgroundColor: 'rgba(255,255,255,0.01)',
                    border: '1px solid rgba(255,255,255,0.04)',
                  }}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <span style={{ color: m.color + '80' }}>{m.icon}</span>
                      <span className="text-[8px] font-bold uppercase text-slate-600 font-mono">{m.label}</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-sm font-mono tabular-nums" style={{ color: m.color }}>{m.value}</span>
                      <span className="text-[8px] font-mono" style={{ color: m.color + '60' }}>({m.pct}%)</span>
                    </div>
                    <div className="mt-1 h-1 rounded-full overflow-hidden" style={{ backgroundColor: m.color + '15' }}>
                      <div className="h-full rounded-full" style={{
                        width: `${m.pct}%`,
                        backgroundColor: m.color,
                        opacity: 0.7,
                      }} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Alert badges */}
              <div className="flex items-center gap-2 flex-wrap">
                {stats.sinClasificar > 0 && (
                  <span className="text-[8px] font-mono px-1.5 py-0.5 rounded" style={{
                    color: '#f59e0b',
                    backgroundColor: 'rgba(245,158,11,0.08)',
                    border: '1px solid rgba(245,158,11,0.15)',
                  }}>
                    {stats.sinClasificar} sin clasificar
                  </span>
                )}
                {stats.marcadosDuplicado > 0 && (
                  <span className="text-[8px] font-mono px-1.5 py-0.5 rounded" style={{
                    color: '#ef4444',
                    backgroundColor: 'rgba(239,68,68,0.08)',
                    border: '1px solid rgba(239,68,68,0.15)',
                  }}>
                    {stats.marcadosDuplicado} duplicados
                  </span>
                )}
                {stats.conTextoOriginal < stats.total && (
                  <span className="text-[8px] font-mono px-1.5 py-0.5 rounded" style={{
                    color: '#a78bfa',
                    backgroundColor: 'rgba(167,139,250,0.08)',
                    border: '1px solid rgba(167,139,250,0.15)',
                  }}>
                    {stats.total - stats.conTextoOriginal} sin texto original
                  </span>
                )}
              </div>
            </div>
          )}
        </PanelShell>

        {/* Dedup Info */}
        <PanelShell title="Dedup en Origen" icon={<Copy className="w-4 h-4" />}>
          <div className="space-y-2">
            <div className="px-3 py-2 rounded-md" style={{
              backgroundColor: 'rgba(16,185,129,0.04)',
              border: '1px solid rgba(16,185,129,0.08)',
            }}>
              <p className="text-[10px] font-mono text-emerald-400 font-bold mb-1">Protecciones activas contra duplicados:</p>
              <ul className="space-y-1">
                {[
                  { label: 'Capa 0', desc: 'NotaRaw pendiente con misma URL — skip antes de LLM', color: '#10b981' },
                  { label: 'Capa 1', desc: 'URL ya existe en Mencion (cross-medio) — skip + enriquecer', color: '#06b6d4' },
                  { label: 'Capa 2', desc: 'Persona+Medio+URL duplicado — skip individual', color: '#f59e0b' },
                  { label: 'Capa 3', desc: 'Cross-medio LLM dedup — verificar si mismo evento', color: '#a78bfa' },
                  { label: 'Batch', desc: 'Filtrar NotaRaw duplicadas antes de enviar al LLM', color: '#f43f5e' },
                ].map(l => (
                  <li key={l.label} className="flex items-start gap-2">
                    <span className="text-[8px] font-bold font-mono px-1 rounded flex-shrink-0" style={{
                      color: l.color,
                      backgroundColor: l.color + '10',
                      border: `1px solid ${l.color}20`,
                    }}>{l.label}</span>
                    <span className="text-[9px] font-mono text-slate-500">{l.desc}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="px-3 py-2 rounded-md" style={{
              backgroundColor: 'rgba(245,158,11,0.04)',
              border: '1px solid rgba(245,158,11,0.08)',
            }}>
              <p className="text-[10px] font-mono text-amber-400 font-bold mb-1">Texto original:</p>
              <p className="text-[9px] font-mono text-slate-500 leading-relaxed">
                El texto completo de NotaRaw se guarda en <code className="text-cyan-400">textoCompleto</code> para
                preservar la nota original. Si se detecta un duplicado con mejor texto, se enriquece el original.
              </p>
            </div>
          </div>
        </PanelShell>

        {/* Action Log */}
        {actionLog.length > 0 && (
          <PanelShell title="Log de Acciones" icon={<BarChart3 className="w-4 h-4" />}>
            <div className="space-y-1 max-h-[200px] overflow-y-auto custom-scrollbar">
              {actionLog.map((log, i) => (
                <div key={i} className="flex items-start gap-2 px-2 py-1 rounded" style={{
                  backgroundColor: log.tipo === 'ok' ? 'rgba(16,185,129,0.04)' : log.tipo === 'error' ? 'rgba(239,68,68,0.04)' : 'rgba(100,116,139,0.04)',
                }}>
                  <span className="text-[8px] mt-0.5">
                    {log.tipo === 'ok' ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> :
                     log.tipo === 'error' ? <XCircle className="w-3 h-3 text-red-400" /> :
                     <AlertTriangle className="w-3 h-3 text-amber-400" />}
                  </span>
                  <span className="text-[9px] font-mono" style={{
                    color: log.tipo === 'ok' ? '#10b981' : log.tipo === 'error' ? '#ef4444' : '#f59e0b',
                  }}>{log.msg}</span>
                </div>
              ))}
            </div>
          </PanelShell>
        )}
      </div>

      {/* ═══ RIGHT: Duplicates Management ═══ */}
      <div className="lg:col-span-7 space-y-4">
        {/* Tab selector */}
        <div className="flex items-center gap-1">
          {[
            { key: 'stats' as QualityTab, label: 'Resumen', color: '#06b6d4' },
            { key: 'duplicados_url' as QualityTab, label: 'Dup. por URL', color: '#f59e0b' },
            { key: 'duplicados_titulo' as QualityTab, label: 'Dup. por Titulo', color: '#a78bfa' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="flex items-center gap-1.5 px-3 py-2 rounded text-[10px] font-bold font-mono uppercase tracking-wider transition-all"
              style={{
                color: activeTab === tab.key ? tab.color : '#64748b',
                backgroundColor: activeTab === tab.key ? tab.color + '08' : 'transparent',
                border: `1px solid ${activeTab === tab.key ? tab.color + '20' : 'rgba(255,255,255,0.03)'}`,
              }}
            >
              {tab.label}
            </button>
          ))}
          <button
            onClick={() => { if (activeTab === 'duplicados_url') fetchDuplicados('url'); if (activeTab === 'duplicados_titulo') fetchDuplicados('titulo'); fetchStats(); }}
            className="ml-auto flex items-center gap-1 px-2 py-1 rounded text-[9px] font-mono uppercase tracking-wider transition-all hover:bg-slate-800/40"
            style={{ color: '#06b6d4', border: '1px solid rgba(6,182,212,0.15)' }}
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            Refrescar
          </button>
        </div>

        {/* ═══ TAB: Stats ═══ */}
        {activeTab === 'stats' && (
          <PanelShell title="Resumen de Calidad" icon={<ShieldCheck className="w-4 h-4" />}>
            {stats ? (
              <div className="space-y-4">
                {/* Quality ring */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center py-3 rounded-lg" style={{
                    backgroundColor: 'rgba(16,185,129,0.04)',
                    border: '1px solid rgba(16,185,129,0.1)',
                  }}>
                    <p className="text-2xl font-mono tabular-nums text-emerald-400">{stats.pctClasificadas}%</p>
                    <p className="text-[9px] font-bold uppercase text-slate-600 font-mono">Clasificadas</p>
                    <p className="text-[8px] font-mono text-slate-600">{stats.clasificadas}/{stats.total}</p>
                  </div>
                  <div className="text-center py-3 rounded-lg" style={{
                    backgroundColor: 'rgba(6,182,212,0.04)',
                    border: '1px solid rgba(6,182,212,0.1)',
                  }}>
                    <p className="text-2xl font-mono tabular-nums text-cyan-400">{stats.pctConEje}%</p>
                    <p className="text-[9px] font-bold uppercase text-slate-600 font-mono">Con Eje</p>
                    <p className="text-[8px] font-mono text-slate-600">{stats.conEje}/{stats.total}</p>
                  </div>
                  <div className="text-center py-3 rounded-lg" style={{
                    backgroundColor: 'rgba(167,139,250,0.04)',
                    border: '1px solid rgba(167,139,250,0.1)',
                  }}>
                    <p className="text-2xl font-mono tabular-nums text-purple-400">{stats.pctConTextoOriginal}%</p>
                    <p className="text-[9px] font-bold uppercase text-slate-600 font-mono">Texto Orig.</p>
                    <p className="text-[8px] font-mono text-slate-600">{stats.conTextoOriginal}/{stats.total}</p>
                  </div>
                </div>

                {/* Gaps analysis */}
                <div>
                  <p className="text-[10px] font-bold uppercase text-slate-600 font-mono mb-2">Brechas de calidad</p>
                  <div className="space-y-2">
                    {stats.pctClasificadas < 100 && (
                      <div className="flex items-center gap-3 px-3 py-2 rounded" style={{
                        backgroundColor: 'rgba(245,158,11,0.04)',
                        border: '1px solid rgba(245,158,11,0.08)',
                      }}>
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                        <span className="text-[10px] font-mono text-slate-400">
                          <span className="text-amber-400 font-bold">{stats.sinClasificar}</span> menciones sin clasificar
                          ({100 - stats.pctClasificadas}%)
                        </span>
                      </div>
                    )}
                    {stats.total - stats.conTextoOriginal > 0 && (
                      <div className="flex items-center gap-3 px-3 py-2 rounded" style={{
                        backgroundColor: 'rgba(167,139,250,0.04)',
                        border: '1px solid rgba(167,139,250,0.08)',
                      }}>
                        <AlertTriangle className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                        <span className="text-[10px] font-mono text-slate-400">
                          <span className="text-purple-400 font-bold">{stats.total - stats.conTextoOriginal}</span> menciones sin texto original
                          ({100 - stats.pctConTextoOriginal}%)
                        </span>
                      </div>
                    )}
                    {stats.pctConEje < 100 && (
                      <div className="flex items-center gap-3 px-3 py-2 rounded" style={{
                        backgroundColor: 'rgba(6,182,212,0.04)',
                        border: '1px solid rgba(6,182,212,0.08)',
                      }}>
                        <AlertTriangle className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                        <span className="text-[10px] font-mono text-slate-400">
                          <span className="text-cyan-400 font-bold">{stats.total - stats.conEje}</span> menciones sin eje tematico
                        </span>
                      </div>
                    )}
                    {stats.sinClasificar === 0 && stats.total - stats.conTextoOriginal === 0 && stats.pctConEje === 100 && (
                      <div className="flex items-center gap-3 px-3 py-2 rounded" style={{
                        backgroundColor: 'rgba(16,185,129,0.04)',
                        border: '1px solid rgba(16,185,129,0.08)',
                      }}>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                        <span className="text-[10px] font-mono text-emerald-400 font-bold">Sin brechas de calidad detectadas</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 py-8 text-slate-600 text-xs font-mono justify-center">
                <Loader2 className="w-4 h-4 animate-spin" />
                Cargando estadisticas...
              </div>
            )}
          </PanelShell>
        )}

        {/* ═══ TAB: Duplicados ═══ */}
        {(activeTab === 'duplicados_url' || activeTab === 'duplicados_titulo') && (
          <PanelShell
            title={activeTab === 'duplicados_url' ? 'Duplicados por URL' : 'Duplicados por Titulo'}
            icon={<Copy className="w-4 h-4" />}
          >
            {loading && grupos.length === 0 ? (
              <div className="flex items-center gap-2 py-8 text-slate-600 text-xs font-mono justify-center">
                <Loader2 className="w-4 h-4 animate-spin" />
                Buscando duplicados...
              </div>
            ) : error ? (
              <div className="flex items-center gap-2 py-4 text-red-400/70 text-xs font-mono">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                {error}
              </div>
            ) : grupos.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-slate-600 text-xs font-mono">
                <CheckCircle2 className="w-6 h-6 text-emerald-500/50" />
                <span>No se encontraron duplicados</span>
                <span className="text-[9px] text-slate-700">El sistema esta limpio</span>
              </div>
            ) : (
              <div className="space-y-2 max-h-[600px] overflow-y-auto custom-scrollbar pr-1">
                <p className="text-[9px] font-mono text-slate-600 mb-2">
                  {grupos.length} grupos con duplicados encontrados
                </p>
                {grupos.map((grupo, gi) => {
                  const groupKey = grupo.url || grupo.titulo || `${gi}`;
                  const isExpanded = expandedGroup === groupKey;
                  const isOpMerge = isOperando(`merge-${groupKey}`);
                  const isOpDel = isOperando(`del-${groupKey}`);

                  return (
                    <div key={groupKey} className="rounded-lg overflow-hidden" style={{
                      border: '1px solid rgba(245,158,11,0.12)',
                      backgroundColor: 'rgba(245,158,11,0.02)',
                    }}>
                      {/* Group header */}
                      <button
                        onClick={() => setExpandedGroup(isExpanded ? null : groupKey)}
                        className="w-full text-left px-3 py-2.5 flex items-center gap-2 transition-all"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-3 h-3 text-amber-400 flex-shrink-0" />
                        ) : (
                          <ChevronRight className="w-3 h-3 text-amber-400 flex-shrink-0" />
                        )}
                        <Copy className="w-3.5 h-3.5 text-amber-400/60 flex-shrink-0" />
                        <span className="text-[10px] font-mono text-amber-300 font-bold truncate flex-1">
                          {grupo.tipo === 'url' ? grupo.url?.substring(0, 60) : grupo.titulo?.substring(0, 60)}
                          ...
                        </span>
                        <span className="text-[8px] font-bold font-mono px-1.5 py-0.5 rounded" style={{
                          color: '#f59e0b',
                          backgroundColor: 'rgba(245,158,11,0.1)',
                          border: '1px solid rgba(245,158,11,0.2)',
                        }}>
                          x{grupo.total}
                        </span>

                        {/* Quick action buttons */}
                        <div className="flex items-center gap-1 ml-2" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => handleFusionar(grupo)}
                            disabled={isOpMerge || isOpDel}
                            className="flex items-center gap-1 px-2 py-1 rounded text-[8px] font-mono font-bold uppercase transition-all hover:bg-emerald-500/10 disabled:opacity-30"
                            style={{ color: '#10b981', border: '1px solid rgba(16,185,129,0.2)' }}
                            title="Fusionar: mantener mejor, transferir datos"
                          >
                            {isOpMerge ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <GitMerge className="w-2.5 h-2.5" />}
                            Fusionar
                          </button>
                          <button
                            onClick={() => handleEliminar(grupo)}
                            disabled={isOpMerge || isOpDel}
                            className="flex items-center gap-1 px-2 py-1 rounded text-[8px] font-mono font-bold uppercase transition-all hover:bg-red-500/10 disabled:opacity-30"
                            style={{ color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}
                            title="Eliminar duplicados, mantener el mejor"
                          >
                            {isOpDel ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Trash2 className="w-2.5 h-2.5" />}
                            Eliminar
                          </button>
                        </div>
                      </button>

                      {/* Expanded items */}
                      {isExpanded && (
                        <div className="px-3 pb-3 space-y-1.5 border-t border-amber-500/10 mt-0.5">
                          {/* Score legend */}
                          <div className="flex items-center gap-3 mt-2 mb-1">
                            <span className="text-[8px] font-mono text-slate-600">Score de calidad:</span>
                            {[
                              { label: 'Completo', min: 15, color: '#10b981' },
                              { label: 'Bueno', min: 10, color: '#06b6d4' },
                              { label: 'Parcial', min: 5, color: '#f59e0b' },
                              { label: 'Minimo', min: 0, color: '#ef4444' },
                            ].map(l => (
                              <span key={l.label} className="text-[7px] font-mono px-1 rounded" style={{
                                color: l.color, border: `1px solid ${l.color}20`,
                              }}>
                                &#8805;{l.min} {l.label}
                              </span>
                            ))}
                          </div>

                          {grupo.items.map((item, ii) => {
                            const isMejor = item.id === grupo.mejorId;
                            return (
                              <div
                                key={item.id}
                                className="rounded px-3 py-2 transition-all"
                                style={{
                                  backgroundColor: isMejor ? 'rgba(16,185,129,0.04)' : 'rgba(255,255,255,0.01)',
                                  border: `1px solid ${isMejor ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.04)'}`,
                                }}
                              >
                                <div className="flex items-center gap-2 mb-1">
                                  {isMejor && (
                                    <span className="flex items-center gap-0.5 text-[7px] font-bold font-mono px-1 rounded" style={{
                                      color: '#10b981',
                                      backgroundColor: 'rgba(16,185,129,0.1)',
                                      border: '1px solid rgba(16,185,129,0.2)',
                                    }}>
                                      <Star className="w-2 h-2" /> MEJOR
                                    </span>
                                  )}
                                  <span className="text-[9px] font-mono font-bold" style={{ color: scoreColor(item.score) }}>
                                    S:{item.score}
                                  </span>
                                  <span className="text-[9px] font-mono text-slate-500 truncate flex-1">
                                    {item.titulo || item.tituloOriginal || 'Sin titulo'}
                                  </span>
                                  {item.url && (
                                    <a href={item.url} target="_blank" rel="noopener" className="text-slate-700 hover:text-blue-400 transition-colors">
                                      <ExternalLink className="w-3 h-3" />
                                    </a>
                                  )}
                                </div>

                                {/* Metadata row */}
                                <div className="flex items-center gap-2 flex-wrap text-[8px] font-mono">
                                  <span className="text-slate-500">{item.medio}</span>
                                  {item.persona && (
                                    <>
                                      <span className="text-slate-700">·</span>
                                      <span className="text-emerald-400/80">{item.persona}</span>
                                    </>
                                  )}
                                  {tratamientoToSentimiento(item.tratamientoPeriodistico) && tratamientoToSentimiento(item.tratamientoPeriodistico) !== 'no_clasificado' && (
                                    <>
                                      <span className="text-slate-700">·</span>
                                      <span style={{ color: sentimientoColor(tratamientoToSentimiento(item.tratamientoPeriodistico)) }}>{tratamientoToSentimiento(item.tratamientoPeriodistico)}</span>
                                    </>
                                  )}
                                  {item.eje && (
                                    <>
                                      <span className="text-slate-700">·</span>
                                      <span className="text-cyan-400/80">{item.eje}</span>
                                    </>
                                  )}
                                  {item.tratamiento && (
                                    <>
                                      <span className="text-slate-700">·</span>
                                      <span className="text-amber-400/80">{item.tratamiento}</span>
                                    </>
                                  )}
                                  {item.tieneTextoOriginal && (
                                    <span className="px-1 rounded" style={{
                                      color: '#a78bfa',
                                      backgroundColor: 'rgba(167,139,250,0.06)',
                                      border: '1px solid rgba(167,139,250,0.1)',
                                    }}>
                                      TXT:{item.textoLength}
                                    </span>
                                  )}
                                </div>

                                {/* Action buttons per item */}
                                <div className="flex items-center gap-1 mt-1.5">
                                  <button
                                    onClick={() => handleReclasificar(item.id)}
                                    disabled={isOperando(`reclass-${item.id}`)}
                                    className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[7px] font-mono uppercase transition-all hover:bg-cyan-500/10 disabled:opacity-30"
                                    style={{ color: '#06b6d4', border: '1px solid rgba(6,182,212,0.12)' }}
                                    title="Re-clasificar con IA"
                                  >
                                    {isOperando(`reclass-${item.id}`) ? <Loader2 className="w-2 h-2 animate-spin" /> : <Brain className="w-2 h-2" />}
                                    Reclasificar
                                  </button>
                                  {item.fechaCaptura && (
                                    <span className="text-[7px] font-mono text-slate-700 ml-auto">
                                      {new Date(item.fechaCaptura).toLocaleDateString('es-BO')}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </PanelShell>
        )}
      </div>
    </div>
  );
}
