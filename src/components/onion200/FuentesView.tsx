'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { fetchWithTimeout } from '@/lib/fetch-utils';
import { PanelShell } from './PanelShell';
import {
  Radio,
  Search,
  Save,
  Brain,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Wrench,
  RefreshCw,
  Loader2,
  X,
  Eye,
  Zap,
  Database,
  Newspaper,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

interface Medio {
  id: string;
  nombre: string;
  url: string;
  tipo: string;
  categoria: string;
  nivel: string;
  departamento: string | null;
  plataformas: string;
  notas: string;
  pais: string;
  activo: boolean;
  naturaleza: string;
  ambito: string;
  enfoque: string;
  credibilidad: number;
  ultimaRevisionHumana: string | null;
  ultimoError: string;
  fechaCreacion: string;
  mencionesCount?: number;
}

interface ProbeLogEntry {
  step: string;
  status: 'ok' | 'error' | 'warn';
  message: string;
  ms?: number;
}

interface ProbeResult {
  medioId: string;
  nombre: string;
  url: string;
  logs: ProbeLogEntry[];
  success: boolean;
  estado: string;
}

interface AIAnalysis {
  naturaleza: string;
  ambito: string;
  enfoque: string;
  credibilidad: number;
  razon: string;
}

interface EditForm {
  nombre: string;
  url: string;
  naturaleza: string;
  ambito: string;
  enfoque: string;
  credibilidad: number;
}

type FilterMode = 'todos' | 'errores' | 'inactivos';

// ═══════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════

const NATURALEZA_OPTS = ['ESTATAL', 'PRIVADO', 'COMUNITARIO', 'MIXTO', 'ONG'] as const;
const AMBITO_OPTS = ['NACIONAL', 'REGIONAL', 'LOCAL', 'INTERNACIONAL'] as const;
const ENFOQUE_OPTS = ['GENERALISTA', 'ECONOMICO', 'POLITICO', 'DEPORTIVO', 'CULTURAL'] as const;

const NATURALEZA_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  ESTATICAL: { text: '#06b6d4', bg: 'rgba(6,182,212,0.1)', border: 'rgba(6,182,212,0.25)' },
  ESTATAL: { text: '#06b6d4', bg: 'rgba(6,182,212,0.1)', border: 'rgba(6,182,212,0.25)' },
  PRIVADO: { text: '#94a3b8', bg: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.2)' },
  COMUNITARIO: { text: '#3b82f6', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.2)' },
  MIXTO: { text: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)' },
  ONG: { text: '#a78bfa', bg: 'rgba(167,139,250,0.08)', border: 'rgba(167,139,250,0.2)' },
};

const getEstadoColor = (activo: boolean, ultimoError: string): { text: string; bg: string; border: string; blink?: boolean } => {
  if (ultimoError && ultimoError.length > 0) {
    return { text: '#8b5cf6', bg: 'rgba(139,92,246,0.06)', border: 'rgba(139,92,246,0.2)', blink: true };
  }
  if (!activo) {
    return { text: '#f59e0b', bg: 'rgba(245,158,11,0.06)', border: 'rgba(245,158,11,0.2)' };
  }
  return { text: '#06b6d4', bg: 'rgba(6,182,212,0.06)', border: 'rgba(6,182,212,0.15)' };
};

const getEstadoLabel = (activo: boolean, ultimoError: string): string => {
  if (ultimoError && ultimoError.length > 0) return 'ERROR';
  if (!activo) return 'INACTIVO';
  return 'ACTIVO';
};

// ═══════════════════════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════════════════════

function SkeletonRow() {
  const widths = [75, 50, 40, 60, 55, 45];
  return (
    <tr className="border-b border-slate-800/40">
      {Array.from({ length: 6 }).map((_, i) => (
        <td key={i} className="px-3 py-2.5">
          <div
            className="h-3 rounded-sm animate-pulse"
            style={{
              backgroundColor: 'rgba(6,182,212,0.05)',
              width: widths[i] + '%',
            }}
          />
        </td>
      ))}
    </tr>
  );
}

function StatusBadge({ activo, ultimoError }: { activo: boolean; ultimoError: string }) {
  const { text, bg, border, blink } = getEstadoColor(activo, ultimoError);
  const label = getEstadoLabel(activo, ultimoError);
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase tracking-wider"
      style={{
        color: text,
        backgroundColor: bg,
        border: '1px solid ' + border,
        animation: blink ? 'errorBlink 2s ease-in-out infinite' : undefined,
      }}
    >
      {label}
    </span>
  );
}

function NaturalezaBadge({ naturaleza }: { naturaleza: string }) {
  const colors = NATURALEZA_COLORS[naturaleza] || {
    text: '#64748b',
    bg: 'rgba(100,116,139,0.06)',
    border: 'rgba(100,116,139,0.15)',
  };
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold font-mono uppercase tracking-wider"
      style={{
        color: colors.text,
        backgroundColor: colors.bg,
        border: '1px solid ' + colors.border,
      }}
    >
      {naturaleza || 'SIN CLASIFICAR'}
    </span>
  );
}

function CredibilidadBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  const color = pct >= 70 ? '#06b6d4' : pct >= 40 ? '#f59e0b' : '#8b5cf6';
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div
        className="flex-1 h-1.5 rounded-full overflow-hidden"
        style={{ backgroundColor: 'rgba(6,182,212,0.06)' }}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: pct + '%',
            backgroundColor: color,
            boxShadow: '0 0 6px ' + color + '40',
          }}
        />
      </div>
      <span
        className="text-[10px] font-mono font-bold tabular-nums min-w-[24px] text-right"
        style={{ color }}
      >
        {pct}
      </span>
    </div>
  );
}

function ProbeTerminal({
  logs,
  probing,
}: {
  logs: ProbeLogEntry[];
  probing: boolean;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  if (logs.length === 0 && !probing) return null;

  return (
    <div
      className="rounded-md overflow-hidden mt-2"
      style={{
        backgroundColor: 'rgba(0,0,0,0.5)',
        border: '1px solid rgba(6,182,212,0.08)',
      }}
    >
      <div className="px-3 py-1.5 border-b border-slate-800/60 flex items-center gap-2">
        <Activity className="w-3 h-3 text-cyan-500/60" />
        <span className="text-[9px] font-bold uppercase tracking-widest text-slate-600 font-mono">
          Diagnostico de Conexion
        </span>
        {probing && (
          <span className="ml-auto flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin text-cyan-400" />
            <span className="text-[9px] font-mono text-cyan-400/70">Sondeando...</span>
          </span>
        )}
      </div>
      <div className="max-h-[160px] overflow-y-auto p-2 space-y-0.5 custom-scrollbar">
        {logs.map((log, i) => {
          const color =
            log.status === 'ok'
              ? '#06b6d4'
              : log.status === 'error'
                ? '#8b5cf6'
                : '#f59e0b';
          return (
            <div
              key={i}
              className="text-[9px] font-mono leading-relaxed px-1"
              style={{ color }}
            >
              <span className="text-slate-600">{'>'}</span> {log.message}
              {log.ms !== undefined && (
                <span className="text-slate-600 ml-1">({log.ms}ms)</span>
              )}
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
    </div>
  );
}

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
  const [medioMenciones, setMedioMenciones] = useState<Array<{
    id: string;
    titulo: string;
    fechaCaptura: string;
    sentimiento: string;
    Persona?: { nombre: string } | null;
  }>>([]);
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
        <PanelShell
          title={selectedMedio.nombre}
          icon={<Radio className="w-4 h-4" />}
        >
          {/* Close button */}
          <div className="flex items-center justify-end mb-2">
            <button
              onClick={() => {
                setSelectedId(null);
                setEditForm(null);
                setAiResult(null);
                setSaveResult(null);
                setMedioMenciones([]);
              }}
              className="flex items-center gap-1 px-2 py-1 rounded text-[9px] font-mono text-slate-500 hover:text-red-400 transition-colors"
            >
              <X className="w-3 h-3" />
              CERRAR
            </button>
          </div>

          {/* Quick Stats Bar */}
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-4 py-3 border-y border-slate-800/60">
            <div className="text-center">
              <p className="text-[9px] font-bold uppercase text-slate-600 font-mono">Menciones</p>
              <p className="text-sm font-mono text-cyan-400 tabular-nums">
                {medioMencionesLoading ? <Loader2 className="w-3 h-3 animate-spin inline" /> : medioMencionesTotal}
              </p>
            </div>
            <div className="text-center">
              <p className="text-[9px] font-bold uppercase text-slate-600 font-mono">Estado</p>
              <StatusBadge activo={selectedMedio.activo} ultimoError={selectedMedio.ultimoError} />
            </div>
            <div className="text-center">
              <p className="text-[9px] font-bold uppercase text-slate-600 font-mono">Tipo</p>
              <p className="text-[10px] font-mono text-slate-400">{selectedMedio.tipo || '---'}</p>
            </div>
            <div className="text-center hidden sm:block">
              <p className="text-[9px] font-bold uppercase text-slate-600 font-mono">Depto.</p>
              <p className="text-[10px] font-mono text-slate-400">{selectedMedio.departamento || '---'}</p>
            </div>
            <div className="text-center hidden sm:block">
              <p className="text-[9px] font-bold uppercase text-slate-600 font-mono">Nivel</p>
              <p className="text-[10px] font-mono text-slate-400">{selectedMedio.nivel || '---'}</p>
            </div>
          </div>

          {/* Recent Mentions from this medio */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Newspaper className="w-3.5 h-3.5 text-amber-400/60" />
              <span className="text-[9px] font-bold uppercase tracking-widest text-slate-600 font-mono">
                Ultimas menciones capturadas
              </span>
              {medioMencionesTotal > 5 && (
                <span className="text-[8px] font-mono text-slate-700">({medioMencionesTotal} total, mostrando 5)</span>
              )}
            </div>
            {medioMencionesLoading ? (
              <div className="flex items-center gap-2 py-4 text-slate-600 text-xs font-mono justify-center">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Cargando menciones...
              </div>
            ) : medioMenciones.length === 0 ? (
              <div className="px-3 py-3 rounded-md text-[10px] font-mono text-slate-600" style={{
                backgroundColor: 'rgba(100,116,139,0.03)',
                border: '1px solid rgba(100,116,139,0.06)',
              }}>
                Sin menciones capturadas de esta fuente aun.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-[250px] overflow-y-auto custom-scrollbar">
                {medioMenciones.map((m) => {
                  const sentColor = m.sentimiento?.includes('positivo') ? '#06b6d4' : m.sentimiento?.includes('negativo') ? '#8b5cf6' : '#64748b';
                  return (
                    <div key={m.id} className="flex items-start gap-2 px-3 py-2 rounded-md" style={{
                      backgroundColor: 'rgba(0,0,0,0.3)',
                      border: '1px solid rgba(6,182,212,0.04)',
                    }}>
                      <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: sentColor }} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-mono text-slate-300 leading-snug line-clamp-2">{m.titulo || 'Sin titulo'}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {m.Persona?.nombre && (
                            <span className="text-[8px] font-mono text-cyan-500/70">{m.Persona.nombre}</span>
                          )}
                          <span className="text-[8px] font-mono text-slate-700">
                            {m.fechaCaptura ? new Date(m.fechaCaptura).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' }) : '---'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Editor Form header */}
          <div className="flex items-center gap-2 mb-3">
            <Save className="w-3.5 h-3.5 text-slate-600" />
            <span className="text-[9px] font-bold uppercase tracking-widest text-slate-600 font-mono">
              Editor de Fuente
            </span>
            <span className="text-[9px] font-mono text-slate-700 ml-auto">ID: {selectedMedio.id.slice(0, 8)}...</span>
          </div>

          {/* Form grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* Nombre */}
            <FormInput
              label="Nombre"
              value={editForm.nombre}
              onChange={(v) => setEditForm((f) => f && { ...f, nombre: v })}
            />

            {/* URL */}
            <FormInput
              label="URL"
              value={editForm.url}
              onChange={(v) => setEditForm((f) => f && { ...f, url: v })}
            />

            {/* Naturaleza */}
            <FormSelect
              label="Naturaleza"
              value={editForm.naturaleza}
              options={[...NATURALEZA_OPTS]}
              placeholder="Sin clasificar"
              onChange={(v) => setEditForm((f) => f && { ...f, naturaleza: v })}
            />

            {/* Ambito */}
            <FormSelect
              label="Ambito"
              value={editForm.ambito}
              options={[...AMBITO_OPTS]}
              placeholder="Sin clasificar"
              onChange={(v) => setEditForm((f) => f && { ...f, ambito: v })}
            />

            {/* Enfoque */}
            <FormSelect
              label="Enfoque"
              value={editForm.enfoque}
              options={[...ENFOQUE_OPTS]}
              placeholder="Sin clasificar"
              onChange={(v) => setEditForm((f) => f && { ...f, enfoque: v })}
            />

            {/* Credibilidad */}
            <div>
              <label className="block text-[9px] font-bold uppercase tracking-widest text-slate-600 font-mono mb-2">
                Credibilidad
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={1}
                  max={100}
                  value={editForm.credibilidad}
                  onChange={(e) =>
                    setEditForm((f) => f && { ...f, credibilidad: parseInt(e.target.value, 10) })
                  }
                  className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer"
                  style={{
                    background: 'linear-gradient(90deg, rgba(139,92,246,0.6) 0%, rgba(245,158,11,0.6) 50%, rgba(6,182,212,0.6) 100%)',
                    accentColor: '#06b6d4',
                  }}
                />
                <span
                  className="text-sm font-bold font-mono tabular-nums min-w-[32px] text-right"
                  style={{
                    color:
                      editForm.credibilidad >= 70
                        ? '#06b6d4'
                        : editForm.credibilidad >= 40
                          ? '#f59e0b'
                          : '#8b5cf6',
                  }}
                >
                  {editForm.credibilidad}
                </span>
              </div>
            </div>
          </div>

          {/* AI Analysis result */}
          {aiResult && (
            <div
              className="mb-4 px-3 py-3 rounded-md"
              style={{
                backgroundColor: 'rgba(167,139,250,0.04)',
                border: '1px solid rgba(167,139,250,0.12)',
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <Brain className="w-3.5 h-3.5 text-purple-400/70" />
                <span className="text-[9px] font-bold uppercase tracking-widest text-purple-400/70 font-mono">
                  Sugerencia IA
                </span>
              </div>
              <div className="space-y-1">
                {aiResult.naturaleza && (
                  <p className="text-[9px] font-mono text-slate-400">
                    <span className="text-slate-600">Naturaleza:</span> {aiResult.naturaleza}
                  </p>
                )}
                {aiResult.ambito && (
                  <p className="text-[9px] font-mono text-slate-400">
                    <span className="text-slate-600">Ambito:</span> {aiResult.ambito}
                  </p>
                )}
                {aiResult.enfoque && (
                  <p className="text-[9px] font-mono text-slate-400">
                    <span className="text-slate-600">Enfoque:</span> {aiResult.enfoque}
                  </p>
                )}
                {aiResult.credibilidad > 0 && (
                  <p className="text-[9px] font-mono text-slate-400">
                    <span className="text-slate-600">Credibilidad sugerida:</span>{' '}
                    <span style={{
                      color: aiResult.credibilidad >= 70 ? '#06b6d4' : aiResult.credibilidad >= 40 ? '#f59e0b' : '#8b5cf6',
                    }}>
                      {aiResult.credibilidad}/100
                    </span>
                  </p>
                )}
                {aiResult.razon && (
                  <p className="text-[9px] font-mono text-slate-500 mt-1 italic">
                    {aiResult.razon}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Save result */}
          {saveResult && (
            <div
              className="mb-4 flex items-center gap-2 px-3 py-2 rounded-md text-[10px] font-mono"
              style={{
                color: saveResult.ok ? '#06b6d4' : '#8b5cf6',
                backgroundColor: saveResult.ok ? 'rgba(6,182,212,0.06)' : 'rgba(139,92,246,0.06)',
                border: saveResult.ok ? '1px solid rgba(6,182,212,0.15)' : '1px solid rgba(139,92,246,0.15)',
              }}
            >
              {saveResult.ok ? (
                <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              )}
              {saveResult.msg}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-[10px] font-bold font-mono uppercase tracking-wider transition-all duration-200 hover:scale-[1.02] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
              style={{
                color: saving ? '#64748b' : '#06b6d4',
                backgroundColor: saving ? 'rgba(100,116,139,0.05)' : 'rgba(6,182,212,0.06)',
                border: saving ? '1px solid rgba(100,116,139,0.15)' : '1px solid rgba(6,182,212,0.2)',
                boxShadow: saving ? 'none' : '0 0 12px rgba(6,182,212,0.06)',
              }}
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              {saving ? 'Guardando...' : 'Guardar'}
            </button>

            <button
              onClick={handleAiAnalyze}
              disabled={aiAnalyzing}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-[10px] font-bold font-mono uppercase tracking-wider transition-all duration-200 hover:scale-[1.02] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
              style={{
                color: aiAnalyzing ? '#64748b' : '#a78bfa',
                backgroundColor: aiAnalyzing ? 'rgba(100,116,139,0.05)' : 'rgba(167,139,250,0.06)',
                border: aiAnalyzing ? '1px solid rgba(100,116,139,0.15)' : '1px solid rgba(167,139,250,0.2)',
                boxShadow: aiAnalyzing ? 'none' : '0 0 12px rgba(167,139,250,0.06)',
              }}
            >
              {aiAnalyzing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Brain className="w-3.5 h-3.5" />
              )}
              {aiAnalyzing ? 'Analizando...' : 'Analizar IA'}
            </button>
          </div>
        </PanelShell>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Helper sub-components
// ═══════════════════════════════════════════════════════════════

function StatBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="text-center py-1">
      <p className="text-[9px] font-bold uppercase text-slate-600 font-mono">{label}</p>
      <p className="text-lg font-bold font-mono tabular-nums" style={{ color }}>
        {value}
      </p>
    </div>
  );
}

function FormInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-[9px] font-bold uppercase tracking-widest text-slate-600 font-mono mb-2">
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-md text-[11px] font-mono text-slate-300 outline-none transition-all duration-200"
        style={{
          backgroundColor: 'rgba(0,0,0,0.4)',
          border: '1px solid rgba(6,182,212,0.08)',
        }}
        onFocus={(e) => {
          (e.target as HTMLInputElement).style.borderColor = 'rgba(6,182,212,0.25)';
          (e.target as HTMLInputElement).style.boxShadow = '0 0 8px rgba(6,182,212,0.06)';
        }}
        onBlur={(e) => {
          (e.target as HTMLInputElement).style.borderColor = 'rgba(6,182,212,0.08)';
          (e.target as HTMLInputElement).style.boxShadow = 'none';
        }}
      />
    </div>
  );
}

function FormSelect({
  label,
  value,
  options,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  placeholder: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-[9px] font-bold uppercase tracking-widest text-slate-600 font-mono mb-2">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-md text-[11px] font-mono text-slate-300 outline-none transition-all duration-200 appearance-none cursor-pointer"
        style={{
          backgroundColor: 'rgba(0,0,0,0.4)',
          border: '1px solid rgba(6,182,212,0.08)',
        }}
        onFocus={(e) => {
          (e.target as HTMLSelectElement).style.borderColor = 'rgba(6,182,212,0.25)';
          (e.target as HTMLSelectElement).style.boxShadow = '0 0 8px rgba(6,182,212,0.06)';
        }}
        onBlur={(e) => {
          (e.target as HTMLSelectElement).style.borderColor = 'rgba(6,182,212,0.08)';
          (e.target as HTMLSelectElement).style.boxShadow = 'none';
        }}
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
}
