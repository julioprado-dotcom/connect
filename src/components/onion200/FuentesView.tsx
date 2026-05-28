'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { fetchWithTimeout } from '@/lib/fetch-utils';
import { PanelShell } from './PanelShell';
import {
  Radio,
  Search,
  AlertTriangle,
  CheckCircle2,
  Wrench,
  RefreshCw,
  Loader2,
  Eye,
  Zap,
  Database,
} from 'lucide-react';
import type {
  Medio,
  ProbeLogEntry,
  ProbeResult,
  AIAnalysis,
  EditForm,
  FilterMode,
  MedioMencion,
} from './FuentesView.types';
import {
  SkeletonRow,
  StatusBadge,
  NaturalezaBadge,
  CredibilidadBar,
  StatBox,
} from './FuentesView.helpers';
import { ProbeTerminal } from './FuentesView.probe';
import { MedioDetailPanel } from './FuentesView.edit-modal';

// ═══════════════════════════════════════════════════════════════
// FuentesView — Main Component
// ═══════════════════════════════════════════════════════════════

export function FuentesView() {
  // ── State ──
  const [medios, setMedios] = useState<Medio[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterMode>('todos');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState<AIAnalysis | null>(null);
  const [probeLogs, setProbeLogs] = useState<Record<string, ProbeLogEntry[]>>({});
  const [probingIds, setProbingIds] = useState<Set<string>>(new Set());
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchResult, setBatchResult] = useState<{ fixed: number; details: string } | null>(null);
  const [medioMenciones, setMedioMenciones] = useState<MedioMencion[]>([]);
  const [medioMencionesLoading, setMedioMencionesLoading] = useState(false);
  const [medioMencionesTotal, setMedioMencionesTotal] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(null);
  const detailRef = useRef<HTMLDivElement>(null);

  // ── Fetch medios ──
  const fetchMedios = useCallback(async () => {
    try {
      const res = await fetchWithTimeout('/api/medios', { timeoutMs: 12000 });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setMedios(Array.isArray(data) ? data : data.medios ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error de conexion');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMedios();
    intervalRef.current = setInterval(fetchMedios, 60000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchMedios]);

  // ── Filtered list ──
  const filtered = medios.filter((m) => {
    if (filter === 'errores') return m.ultimoError && m.ultimoError.length > 0;
    if (filter === 'inactivos') return !m.activo;
    return true;
  });

  const selectedMedio = medios.find((m) => m.id === selectedId) ?? null;

  // ── Fetch menciones per medio ──
  const fetchMedioMenciones = useCallback(async (medioId: string) => {
    setMedioMencionesLoading(true);
    try {
      const res = await fetchWithTimeout(`/api/menciones?medioId=${medioId}&limit=5&orderBy=fechaCaptura&orderDir=desc`, { timeoutMs: 8000 });
      if (res.ok) {
        const data = await res.json();
        setMedioMenciones(data.menciones || []);
        setMedioMencionesTotal(data.total || 0);
      }
    } catch { /* silent */ } finally {
      setMedioMencionesLoading(false);
    }
  }, []);

  // ── Handlers ──
  const handleSelectRow = (medio: Medio) => {
    if (selectedId === medio.id) {
      setSelectedId(null);
      setEditForm(null);
      setAiResult(null);
      setSaveResult(null);
      setMedioMenciones([]);
      return;
    }
    setSelectedId(medio.id);
    setEditForm({
      nombre: medio.nombre,
      url: medio.url,
      naturaleza: medio.naturaleza || '',
      ambito: medio.ambito || '',
      enfoque: medio.enfoque || '',
      credibilidad: medio.credibilidad ?? 50,
    });
    setAiResult(null);
    setSaveResult(null);
    fetchMedioMenciones(medio.id);
    // Scroll to detail panel
    setTimeout(() => {
      detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const handleCloseDetail = () => {
    setSelectedId(null);
    setEditForm(null);
    setAiResult(null);
    setSaveResult(null);
    setMedioMenciones([]);
  };

  const handleProbe = async (medio: Medio) => {
    if (probingIds.has(medio.id)) return;

    setProbingIds((prev) => new Set(prev).add(medio.id));
    setProbeLogs((prev) => ({ ...prev, [medio.id]: [] }));

    try {
      const res = await fetchWithTimeout(`/api/medios/${medio.id}/probe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        timeoutMs: 30000,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setProbeLogs((prev) => ({
          ...prev,
          [medio.id]: [
            { step: 'error', status: 'error', message: `ERROR: ${errData.error || res.statusText}` },
          ],
        }));
        return;
      }

      const data: ProbeResult = await res.json();

      // Show logs appearing one by one with a slight delay
      const logs = data.logs || [];
      for (let i = 0; i < logs.length; i++) {
        await new Promise((resolve) => setTimeout(resolve, 150));
        setProbeLogs((prev) => ({
          ...prev,
          [medio.id]: logs.slice(0, i + 1),
        }));
      }

      // If success, add final line
      if (data.success) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        setProbeLogs((prev) => ({
          ...prev,
          [medio.id]: [
            ...logs,
            {
              step: 'done',
              status: 'ok',
              message: `Completado — estado: ${data.estado}`,
            },
          ],
        }));
      } else {
        await new Promise((resolve) => setTimeout(resolve, 100));
        setProbeLogs((prev) => ({
          ...prev,
          [medio.id]: [
            ...logs,
            {
              step: 'done',
              status: 'error',
              message: `Fallo — estado: ${data.estado}`,
            },
          ],
        }));
      }

      // Refresh medios to get updated status
      setTimeout(fetchMedios, 500);
    } catch (e) {
      setProbeLogs((prev) => ({
        ...prev,
        [medio.id]: [
          {
            step: 'timeout',
            status: 'error',
            message: `ERROR: ${e instanceof Error ? e.message : 'Sin respuesta del servidor'}`,
          },
        ],
      }));
    } finally {
      setProbingIds((prev) => {
        const next = new Set(prev);
        next.delete(medio.id);
        return next;
      });
    }
  };

  const handleSave = async () => {
    if (!selectedId || !editForm) return;
    setSaving(true);
    setSaveResult(null);
    try {
      const res = await fetchWithTimeout(`/api/medios/${selectedId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
        timeoutMs: 10000,
      });
      if (res.ok) {
        setSaveResult({ ok: true, msg: 'Medio actualizado correctamente' });
        fetchMedios();
      } else {
        const errData = await res.json().catch(() => ({}));
        setSaveResult({ ok: false, msg: errData.error || `Error HTTP ${res.status}` });
      }
    } catch (e) {
      setSaveResult({ ok: false, msg: e instanceof Error ? e.message : 'Error de conexion' });
    } finally {
      setSaving(false);
    }
  };

  const handleAiAnalyze = async () => {
    if (!selectedId || !selectedMedio) return;
    setAiAnalyzing(true);
    setAiResult(null);
    try {
      const res = await fetchWithTimeout(`/api/medios/${selectedId}/ai-analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        timeoutMs: 30000,
      });
      if (res.ok) {
        const data: AIAnalysis = await res.json();
        setAiResult(data);
        // Auto-fill edit form with AI suggestions
        setEditForm((prev) =>
          prev
            ? {
                ...prev,
                naturaleza: data.naturaleza || prev.naturaleza,
                ambito: data.ambito || prev.ambito,
                enfoque: data.enfoque || prev.enfoque,
                credibilidad: data.credibilidad ?? prev.credibilidad,
              }
            : prev,
        );
      } else {
        const errData = await res.json().catch(() => ({}));
        setAiResult({
          naturaleza: '',
          ambito: '',
          enfoque: '',
          credibilidad: 0,
          razon: `Error: ${errData.error || 'No se pudo obtener analisis'}`,
        });
      }
    } catch (e) {
      setAiResult({
        naturaleza: '',
        ambito: '',
        enfoque: '',
        credibilidad: 0,
        razon: `Error de conexion: ${e instanceof Error ? e.message : 'Desconocido'}`,
      });
    } finally {
      setAiAnalyzing(false);
    }
  };

  const handleBatchFix = async () => {
    setBatchLoading(true);
    setBatchResult(null);
    try {
      const res = await fetchWithTimeout('/api/medios/batch-fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        timeoutMs: 30000,
      });
      if (res.ok) {
        const data = await res.json();
        setBatchResult({
          fixed: data.fixed ?? 0,
          details: data.message || `${data.fixed ?? 0} medios corregidos`,
        });
        fetchMedios();
      } else {
        const errData = await res.json().catch(() => ({}));
        setBatchResult({
          fixed: 0,
          details: `Error: ${errData.error || 'Operacion fallida'}`,
        });
      }
    } catch (e) {
      setBatchResult({
        fixed: 0,
        details: `Error de conexion: ${e instanceof Error ? e.message : 'Desconocido'}`,
      });
    } finally {
      setBatchLoading(false);
    }
  };

  // ── Stats ──
  const totalMedios = medios.length;
  const activosCount = medios.filter((m) => m.activo && !m.ultimoError).length;
  const erroresCount = medios.filter((m) => m.ultimoError && m.ultimoError.length > 0).length;
  const inactivosCount = medios.filter((m) => !m.activo).length;

  // ── Render ──
  return (
    <div className="space-y-4 sm:space-y-6">
      {/* ── Inline keyframes for ERROR blink ── */}
      <style jsx global>{`
        @keyframes errorBlink {
          0%, 100% { border-color: rgba(139,92,246,0.2); }
          50% { border-color: rgba(139,92,246,0.6); }
        }
      `}</style>

      {/* Top bar: summary + batch action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <PanelShell title="" icon={<Database className="w-4 h-4" />} className="flex-1 min-w-0">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatBox label="Total Flota" value={totalMedios} color="#06b6d4" />
              <StatBox label="Activos" value={activosCount} color="#06b6d4" />
              <StatBox label="Con Error" value={erroresCount} color="#8b5cf6" />
              <StatBox label="Inactivos" value={inactivosCount} color="#f59e0b" />
            </div>
          </PanelShell>
        </div>
        <button
          onClick={handleBatchFix}
          disabled={batchLoading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-[10px] font-bold font-mono uppercase tracking-wider transition-all duration-200 hover:scale-[1.02] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 whitespace-nowrap"
          style={{
            color: batchLoading ? '#64748b' : '#f59e0b',
            backgroundColor: batchLoading ? 'rgba(100,116,139,0.05)' : 'rgba(245,158,11,0.06)',
            border: batchLoading ? '1px solid rgba(100,116,139,0.15)' : '1px solid rgba(245,158,11,0.2)',
          }}
        >
          {batchLoading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Wrench className="w-3.5 h-3.5" />
          )}
          {batchLoading ? 'Corrigiendo...' : 'Autocorregir Fallos'}
        </button>
      </div>

      {/* Batch result inline */}
      {batchResult && (
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-md text-[10px] font-mono"
          style={{
            color: batchResult.fixed > 0 ? '#06b6d4' : '#8b5cf6',
            backgroundColor: batchResult.fixed > 0 ? 'rgba(6,182,212,0.06)' : 'rgba(139,92,246,0.06)',
            border: batchResult.fixed > 0 ? '1px solid rgba(6,182,212,0.15)' : '1px solid rgba(139,92,246,0.15)',
          }}
        >
          {batchResult.fixed > 0 ? (
            <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
          ) : (
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
          )}
          {batchResult.details}
        </div>
      )}

      {/* Fleet Table Panel */}
      <PanelShell title="Estado de Flota" icon={<Radio className="w-4 h-4" />}>
        {/* Filter buttons */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className="text-[9px] font-bold uppercase tracking-widest text-slate-600 font-mono mr-1">
            Filtro:
          </span>
          {(
            [
              { key: 'todos', label: 'Todos', count: totalMedios },
              { key: 'errores', label: 'Solo con errores', count: erroresCount },
              { key: 'inactivos', label: 'Solo inactivos', count: inactivosCount },
            ] as const
          ).map((f) => {
            const active = filter === f.key;
            const accent =
              f.key === 'errores' ? '#8b5cf6' : f.key === 'inactivos' ? '#f59e0b' : '#06b6d4';
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
            onClick={fetchMedios}
            className="ml-auto flex items-center gap-1.5 px-2 py-1.5 rounded text-[9px] font-mono text-slate-500 hover:text-cyan-400 transition-colors"
            title="Refrescar datos"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>

        {/* Error banner */}
        {error && !loading && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-md text-[10px] font-mono mb-3" style={{
            color: '#8b5cf6',
            backgroundColor: 'rgba(139,92,246,0.06)',
            border: '1px solid rgba(139,92,246,0.15)',
          }}>
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            Error al cargar flota: {error}
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto rounded-md" style={{ border: '1px solid rgba(6,182,212,0.06)' }}>
          <table className="w-full text-[10px] font-mono">
            <thead>
              <tr className="border-b border-slate-800/60" style={{ backgroundColor: 'rgba(6,182,212,0.02)' }}>
                <th className="px-3 py-2 text-left text-[9px] font-bold uppercase tracking-widest text-slate-600">Nombre</th>
                <th className="px-3 py-2 text-left text-[9px] font-bold uppercase tracking-widest text-slate-600">Naturaleza</th>
                <th className="px-3 py-2 text-left text-[9px] font-bold uppercase tracking-widest text-slate-600">Estado Tecnico</th>
                <th className="px-3 py-2 text-left text-[9px] font-bold uppercase tracking-widest text-slate-600 hidden md:table-cell">Ultima Revision</th>
                <th className="px-3 py-2 text-left text-[9px] font-bold uppercase tracking-widest text-slate-600 hidden sm:table-cell">Credibilidad</th>
                <th className="px-3 py-2 text-right text-[9px] font-bold uppercase tracking-widest text-slate-600">Accion</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-slate-600 text-[10px] font-mono">
                    <Search className="w-4 h-4 mx-auto mb-2 opacity-40" />
                    Sin medios que coincidan con el filtro seleccionado
                  </td>
                </tr>
              ) : (
                filtered.map((medio) => {
                  const isSelected = selectedId === medio.id;
                  const isProbing = probingIds.has(medio.id);
                  const showProbe = probeLogs[medio.id] && probeLogs[medio.id].length > 0;

                  return (
                    <React.Fragment key={medio.id}>
                      <tr
                        onClick={() => handleSelectRow(medio)}
                        className="border-b border-slate-800/30 cursor-pointer transition-all duration-150 group"
                        style={{
                          backgroundColor: isSelected ? 'rgba(6,182,212,0.04)' : 'transparent',
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) {
                            (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(6,182,212,0.02)';
                            (e.currentTarget as HTMLElement).style.boxShadow = 'inset 2px 0 0 rgba(6,182,212,0.3)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) {
                            (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                            (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                          }
                        }}
                      >
                        {/* Nombre */}
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <Eye className="w-3 h-3 text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                            <div className="min-w-0">
                              <p
                                className="truncate max-w-[200px] font-bold"
                                style={{
                                  color: isSelected ? '#06b6d4' : '#cbd5e1',
                                }}
                              >
                                {medio.nombre}
                              </p>
                              <p className="text-[8px] text-slate-600 truncate max-w-[200px]">
                                {medio.url}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Naturaleza */}
                        <td className="px-3 py-2.5">
                          <NaturalezaBadge naturaleza={medio.naturaleza} />
                        </td>

                        {/* Estado Tecnico */}
                        <td className="px-3 py-2.5">
                          <StatusBadge activo={medio.activo} ultimoError={medio.ultimoError} />
                        </td>

                        {/* Ultima Revision */}
                        <td className="px-3 py-2.5 hidden md:table-cell">
                          <span className="text-slate-500">
                            {medio.ultimaRevisionHumana
                              ? new Date(medio.ultimaRevisionHumana).toLocaleDateString('es-BO', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                })
                              : '---'}
                          </span>
                        </td>

                        {/* Credibilidad */}
                        <td className="px-3 py-2.5 hidden sm:table-cell">
                          <CredibilidadBar value={medio.credibilidad ?? 0} />
                        </td>

                        {/* Accion */}
                        <td className="px-3 py-2.5 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleProbe(medio);
                            }}
                            disabled={isProbing}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[9px] font-bold font-mono uppercase tracking-wider transition-all duration-200 disabled:opacity-40"
                            style={{
                              color: isProbing ? '#64748b' : '#06b6d4',
                              backgroundColor: isProbing ? 'rgba(100,116,139,0.05)' : 'rgba(6,182,212,0.06)',
                              border: isProbing
                                ? '1px solid rgba(100,116,139,0.15)'
                                : '1px solid rgba(6,182,212,0.15)',
                            }}
                          >
                            {isProbing ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Zap className="w-3 h-3" />
                            )}
                            {isProbing ? 'SONDEANDO' : 'SONDEAR'}
                          </button>
                        </td>
                      </tr>

                      {/* Inline probe terminal */}
                      {(showProbe || isProbing) && (
                        <tr>
                          <td colSpan={6} className="px-3 pb-2 pt-0">
                            <ProbeTerminal
                              logs={probeLogs[medio.id] || []}
                              probing={isProbing}
                            />
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
              Mostrando {filtered.length} de {totalMedios} medios
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: '#06b6d4' }} />
              Auto-refresco cada 60s
            </span>
          </div>
        )}
      </PanelShell>

      {/* ── Detail / Edit Panel (inline, below table) ── */}
      <div ref={detailRef} />
      {selectedMedio && editForm && (
        <MedioDetailPanel
          selectedMedio={selectedMedio}
          editForm={editForm}
          setEditForm={setEditForm}
          saving={saving}
          saveResult={saveResult}
          aiAnalyzing={aiAnalyzing}
          aiResult={aiResult}
          medioMenciones={medioMenciones}
          medioMencionesLoading={medioMencionesLoading}
          medioMencionesTotal={medioMencionesTotal}
          onSave={handleSave}
          onAiAnalyze={handleAiAnalyze}
          onClose={handleCloseDetail}
        />
      )}
    </div>
  );
}
