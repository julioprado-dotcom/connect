'use client';

import React, { useState, useCallback } from 'react';
import { Tags, Loader2, Search, Plus, X, Trash2, Power, PowerOff } from 'lucide-react';
import { PanelShell } from './PanelShell';
import { fetchWithTimeout } from '@/lib/fetch-utils';
import { usePolling } from '../hooks/usePolling';

// ─── Tactical Theme ──────────────────────────────────────────
const THEME = {
  bg: '#0a0e17',
  panelBg: '#0d1321',
  border: '#1a2744',
  accentCyan: '#06b6d4',
  accentGreen: '#00ff88',
  accentAmber: '#ffaa00',
  accentRed: '#ff3355',
  textPrimary: '#e2e8f0',
  textSecondary: '#64748b',
  textMuted: '#334155',
  scanLine: 'rgba(6, 182, 212, 0.03)',
};

// ─── Types ────────────────────────────────────────────────────

interface LenteItem {
  id: string;
  nombre: string;
  slug: string;
  menciones: number;
  clasificadas: number;
  porcentaje: number;
}

interface EjeItem {
  id: string;
  nombre: string;
  slug: string;
  menciones: number;
  porcentaje: number;
}

interface PendienteItem {
  id: string;
  titulo: string;
  medioNombre: string;
  fechaCaptura: string;
}

interface KeywordItem {
  id: string;
  term: string;
  lente: string;
  eje: string;
  matchCount: number;
  weight: number;
  activo: boolean;
}

interface ClasificacionData {
  lentes: LenteItem[];
  ejes: EjeItem[];
  pendientes: number;
  pendientesList: PendienteItem[];
  resumen: {
    totalLentes: number;
    totalEjes: number;
    totalPendientes: number;
  };
}

// ─── Helpers ──────────────────────────────────────────────────

function timeAgoHuman(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'ahora mismo';
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return `hace ${days}d`;
}

function barColor(pct: number): string {
  if (pct >= 90) return '#00ff88';
  if (pct >= 70) return '#ffaa00';
  return '#ff3355';
}

// ─── Mock keywords (API would provide this) ───────────────────

function generateMockKeywords(lentes: LenteItem[], ejes: EjeItem[]): KeywordItem[] {
  const terms = [
    'minería', 'litio', 'gas natural', 'exportaciones', 'hidrocarburos',
    'economía', 'inflación', 'tipo de cambio', 'reservas', 'PIB',
  ];
  return terms.map((term, i) => ({
    id: `kw-${i}`,
    term,
    lente: lentes[i % lentes.length]?.nombre || 'Economía',
    eje: ejes[i % ejes.length]?.nombre || 'General',
    matchCount: Math.floor(Math.random() * 50),
    weight: 0.5 + Math.random() * 0.5,
    activo: i !== 7,
  }));
}

// ─── Coverage Card ────────────────────────────────────────────

function CoverageCard({ name, count, percentage }: { name: string; count: number; percentage: number }) {
  const color = barColor(percentage);
  return (
    <div
      className="rounded-lg p-3"
      style={{ background: 'linear-gradient(135deg, rgba(6,182,212,0.04) 0%, rgba(13,19,33,0.8) 60%)', border: '1px solid rgba(6,182,212,0.15)', boxShadow: '0 0 10px rgba(6,182,212,0.05)' }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold truncate" style={{ color: '#ffffff' }}>
          {name}
        </span>
        <span className="text-[11px] font-mono tabular-nums" style={{ color }}>
          {percentage}%
        </span>
      </div>
      <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: '#1a2744' }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${percentage}%`, background: color }}
        />
      </div>
      <p className="text-[10px] mt-1" style={{ color: '#6b7280' }}>
        {count.toLocaleString()} menciones
      </p>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────

export function ClasificacionPanel({ onClose }: { onClose?: () => void }) {
  const [data, setData] = useState<ClasificacionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPendientes, setSelectedPendientes] = useState<Set<string>>(new Set());
  const [showAssignDropdown, setShowAssignDropdown] = useState(false);
  const [keywordSearch, setKeywordSearch] = useState('');
  const [showNewKeyword, setShowNewKeyword] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetchWithTimeout('/api/dashboard/clasificacion', { timeoutMs: 10_000 });
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  usePolling(fetchData, 30_000);

  const lentes = data?.lentes ?? [];
  const ejes = data?.ejes ?? [];
  const pendientesList = data?.pendientesList ?? [];
  const totalPendientes = data?.pendientes ?? 0;
  const keywords = data ? generateMockKeywords(lentes, ejes) : [];

  const filteredKeywords = keywordSearch
    ? keywords.filter((kw) => kw.term.toLowerCase().includes(keywordSearch.toLowerCase()))
    : keywords;

  const togglePendiente = (id: string) => {
    const next = new Set(selectedPendientes);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedPendientes(next);
  };

  return (
    <PanelShell title="Gestión de Clasificación" icon={<Tags className="w-4 h-4" />} onClose={onClose}>
      <div className="p-4 space-y-5 relative" style={{ background: THEME.bg }}>
      {/* Scan line overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `repeating-linear-gradient(0deg, transparent, transparent 3px, ${THEME.scanLine} 3px, ${THEME.scanLine} 4px)`,
        }}
      />
      <div className="relative z-10 space-y-5">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10">
            <Loader2 className="w-5 h-5 animate-spin" style={{ color: THEME.accentGreen }} />
            <span className="text-[11px]" style={{ color: THEME.textSecondary, fontFamily: "'JetBrains Mono', monospace" }}>
              Cargando…
            </span>
          </div>
        ) : (
          <>
            {/* ── Section A: Cobertura por Lentes ────────── */}
            <section>
              <div className="flex items-center gap-2 mb-2.5">
                <Tags size={12} style={{ color: THEME.accentCyan }} />
                <h3
                  className="text-[10px] font-bold uppercase tracking-widest"
                  style={{ color: THEME.accentCyan, fontFamily: "'JetBrains Mono', monospace" }}
                >
                  Cobertura por Lentes
                </h3>
              </div>
              {lentes.length === 0 ? (
                <p className="text-[11px] py-3 text-center" style={{ color: '#6b7280' }}>Sin lentes configurados</p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {lentes.slice(0, 9).map((l) => (
                    <CoverageCard
                      key={l.id}
                      name={l.nombre}
                      count={l.clasificadas}
                      percentage={l.porcentaje}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* ── Section B: Ejes Temáticos ───────────────── */}
            <section>
              <div className="flex items-center gap-2 mb-2.5">
                <Tags size={12} style={{ color: THEME.accentCyan }} />
                <h3
                  className="text-[10px] font-bold uppercase tracking-widest"
                  style={{ color: THEME.accentCyan, fontFamily: "'JetBrains Mono', monospace" }}
                >
                  Ejes Temáticos
                </h3>
              </div>
              {ejes.length === 0 ? (
                <p className="text-[11px] py-3 text-center" style={{ color: '#6b7280' }}>Sin ejes temáticos</p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {ejes.slice(0, 9).map((e) => (
                    <CoverageCard
                      key={e.id}
                      name={e.nombre}
                      count={e.menciones}
                      percentage={e.porcentaje}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* ── Section C: Menciones sin clasificar ─────── */}
            {/* Glow separator */}
            <div className="h-[1px]" style={{ background: 'linear-gradient(90deg, transparent, rgba(6,182,212,0.2), transparent)' }} />
            <section style={{ borderTop: '1px solid #1a2744' }} className="pt-4">
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2">
                  <Tags size={12} style={{ color: THEME.accentCyan }} />
                  <h3
                    className="text-[10px] font-bold uppercase tracking-widest"
                    style={{ color: THEME.accentCyan, fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    Menciones sin clasificar
                  </h3>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: `rgba(255,170,0,0.1)`, color: THEME.accentAmber, fontFamily: "'JetBrains Mono', monospace" }}>
                  {totalPendientes} pendientes
                </span>
              </div>
              {pendientesList.length === 0 ? (
                <p className="text-[11px] py-3 text-center" style={{ color: '#6b7280' }}>Sin menciones pendientes</p>
              ) : (
                <>
                  <div className="space-y-0.5 max-h-[200px] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
                    {pendientesList.slice(0, 8).map((p) => (
                      <label
                        key={p.id}
                        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors"
                        style={{ background: selectedPendientes.has(p.id) ? 'rgba(0,255,136,0.05)' : 'transparent' }}
                        onMouseEnter={(e) => { if (!selectedPendientes.has(p.id)) (e.currentTarget as HTMLLabelElement).style.background = 'rgba(255,255,255,0.02)'; }}
                        onMouseLeave={(e) => { if (!selectedPendientes.has(p.id)) (e.currentTarget as HTMLLabelElement).style.background = 'transparent'; }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedPendientes.has(p.id)}
                          onChange={() => togglePendiente(p.id)}
                          className="accent-emerald-500"
                          style={{ width: 14, height: 14 }}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] truncate" style={{ color: '#ffffff' }}>{p.titulo}</p>
                          <p className="text-[10px] flex gap-2" style={{ color: '#6b7280' }}>
                            <span>{p.medioNombre}</span>
                            <span>{timeAgoHuman(p.fechaCaptura)}</span>
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                  <div className="flex items-center justify-between mt-2.5">
                    <span className="text-[10px]" style={{ color: '#6b7280' }}>
                      {selectedPendientes.size} seleccionadas
                    </span>
                    <div className="relative">
                      <button
                        disabled={selectedPendientes.size === 0}
                        className="px-3 py-1.5 rounded-md text-[11px] font-medium transition-colors disabled:opacity-30"
                        style={{
                          background: selectedPendientes.size > 0 ? 'rgba(0,255,136,0.1)' : 'transparent',
                          border: `1px solid ${selectedPendientes.size > 0 ? 'rgba(0,255,136,0.3)' : '#1a2744'}`,
                          color: selectedPendientes.size > 0 ? '#00ff88' : '#6b7280',
                        }}
                        onClick={() => setShowAssignDropdown(!showAssignDropdown)}
                      >
                        Asignar
                      </button>
                      {showAssignDropdown && (
                        <div
                          className="absolute right-0 top-full mt-1 rounded-lg p-2 z-10 min-w-[180px]"
                          style={{ background: '#1a2744', border: '1px solid #252540' }}
                        >
                          <select
                            className="w-full px-2 py-1 rounded text-[11px] mb-1.5 outline-none"
                            style={{ background: '#080c14', border: '1px solid #252540', color: '#ffffff' }}
                            defaultValue=""
                          >
                            <option value="" disabled>Seleccionar lente…</option>
                            {lentes.map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
                          </select>
                          <select
                            className="w-full px-2 py-1 rounded text-[11px] mb-2 outline-none"
                            style={{ background: '#080c14', border: '1px solid #252540', color: '#ffffff' }}
                            defaultValue=""
                          >
                            <option value="" disabled>Seleccionar eje…</option>
                            {ejes.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                          </select>
                          <button
                            className="w-full px-2 py-1 rounded text-[11px] font-medium"
                            style={{ background: 'rgba(0,255,136,0.15)', color: '#00ff88' }}
                            onClick={() => {
                              setShowAssignDropdown(false);
                              setSelectedPendientes(new Set());
                            }}
                          >
                            Confirmar
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </section>

            {/* ── Section D: Keywords ─────────────────────── */}
            {/* Glow separator */}
            <div className="h-[1px]" style={{ background: 'linear-gradient(90deg, transparent, rgba(6,182,212,0.2), transparent)' }} />
            <section style={{ borderTop: '1px solid #1a2744' }} className="pt-4">
              <div className="flex items-center gap-2 mb-2.5">
                <Tags size={12} style={{ color: THEME.accentCyan }} />
                <h3
                  className="text-[10px] font-bold uppercase tracking-widest"
                  style={{ color: THEME.accentCyan, fontFamily: "'JetBrains Mono', monospace" }}
                >
                  Keywords
                </h3>
              </div>
              <div className="flex gap-2 mb-2.5">
                <div className="flex-1 flex items-center gap-1.5 rounded-md px-2.5 py-1.5" style={{ background: '#080c14', border: '1px solid #1a2744' }}>
                  <Search className="w-3 h-3 shrink-0" style={{ color: '#6b7280' }} />
                  <input
                    placeholder="Buscar keyword…"
                    className="flex-1 bg-transparent text-[11px] outline-none"
                    style={{ color: '#ffffff' }}
                    value={keywordSearch}
                    onChange={(e) => setKeywordSearch(e.target.value)}
                  />
                </div>
                {!showNewKeyword ? (
                  <button
                    onClick={() => setShowNewKeyword(true)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-medium shrink-0"
                    style={{ border: '1px solid #1a2744', color: '#6b7280' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#00ff88'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#00ff88'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#6b7280'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#1a2744'; }}
                  >
                    <Plus className="w-3 h-3" />
                    Crear
                  </button>
                ) : (
                  <div className="flex gap-1 shrink-0">
                    <input
                      placeholder="nuevo term"
                      className="px-2 py-1.5 rounded-md text-[11px] outline-none w-28"
                      style={{ background: '#080c14', border: '1px solid #00ff88', color: '#ffffff' }}
                      autoFocus
                    />
                    <button
                      className="px-2 py-1.5 rounded-md text-[10px] font-medium"
                      style={{ background: 'rgba(0,255,136,0.15)', color: '#00ff88' }}
                      onClick={() => setShowNewKeyword(false)}
                    >
                      OK
                    </button>
                    <button
                      className="px-1.5 py-1.5 rounded-md"
                      style={{ color: '#6b7280' }}
                      onClick={() => setShowNewKeyword(false)}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-1 max-h-[220px] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
                {filteredKeywords.slice(0, 10).map((kw) => (
                  <div
                    key={kw.id}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg"
                    style={{ background: 'rgba(255,255,255,0.02)', opacity: kw.activo ? 1 : 0.4 }}
                  >
                    <span className="text-[11px] font-medium min-w-[90px] truncate" style={{ color: '#ffffff', fontFamily: 'JetBrains Mono, monospace' }}>
                      {kw.term}
                    </span>
                    <span className="text-[10px] truncate" style={{ color: '#6b7280' }}>
                      {kw.lente} → {kw.eje}
                    </span>
                    <span className="text-[10px] font-mono ml-auto tabular-nums" style={{ color: '#6b7280' }}>
                      {kw.matchCount}
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={1}
                      step={0.1}
                      value={kw.weight.toFixed(1)}
                      className="w-10 text-center rounded px-1 py-0.5 text-[10px] outline-none"
                      style={{ background: '#080c14', border: '1px solid #1a2744', color: '#ffffff', fontFamily: 'JetBrains Mono, monospace' }}
                    />
                    <button
                      className="flex items-center justify-center rounded transition-colors"
                      style={{ width: 22, height: 22, color: kw.activo ? '#00ff88' : '#ff3355' }}
                      title={kw.activo ? 'Desactivar' : 'Activar'}
                    >
                      {kw.activo ? <Power className="w-3 h-3" /> : <PowerOff className="w-3 h-3" />}
                    </button>
                    <button
                      className="flex items-center justify-center rounded transition-colors"
                      style={{ width: 22, height: 22, color: '#6b7280' }}
                      title="Eliminar"
                      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#ff3355'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#6b7280'; }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
    </PanelShell>
  );
}
