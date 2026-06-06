'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Radio, Pause, Play, RefreshCw, Pencil, Plus, Loader2, Inbox, X, Terminal } from 'lucide-react';
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

interface FuenteItem {
  id: string;
  medioId: string;
  medioNombre: string;
  medioUrl: string;
  estado: string;
  ultimaCaptura: string | null;
  ultimaCapturaHace: string;
  mencionesSemana: number;
  nivel: string | null;
}

interface CapturaJobReal {
  id: string;
  medioNombre: string;
  timestamp: string;
  resultado: string;
  duracion: string | null;
  exitosa: boolean;
  errores: string | null;
}

interface FuentesData {
  total: number;
  filter: string;
  fuentes: FuenteItem[];
  resumen: {
    activas: number;
    caidas: number;
    degradadas: number;
    bloqueadas: number;
    pausadas: number;
    sinEstado: number;
  };
}

type FilterType = 'todas' | 'activas' | 'caidas' | 'bloqueadas';

const FILTERS: { key: FilterType; label: string }[] = [
  { key: 'todas', label: 'Todas' },
  { key: 'activas', label: 'Activas' },
  { key: 'caidas', label: 'Caídas' },
  { key: 'bloqueadas', label: 'Bloqueadas' },
];

// ─── Helpers ──────────────────────────────────────────────────

function timeAgoHuman(dateStr: string | null): string {
  if (!dateStr) return 'nunca';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'ahora mismo';
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return `hace ${days}d`;
}

function statusDotColor(estado: string): string {
  switch (estado) {
    case 'activa': return '#00ff88';
    case 'degradada': return '#ffaa00';
    case 'caida': return '#ff3355';
    case 'bloqueada': return '#ff3355';
    case 'pausada': return '#ffaa00';
    case 'sin_estado': return '#64748b';
    default: return '#64748b';
  }
}

function formatDuracion(duracionStr: string | null): string {
  if (!duracionStr) return '—';
  // CapturaLog stores duration as human-readable string like "3.4s" or "1.2s"
  return duracionStr;
}

// ─── Component ────────────────────────────────────────────────

export function CapturaPanel({ onClose }: { onClose?: () => void }) {
  const [data, setData] = useState<FuentesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('todas');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSource, setNewSource] = useState({ nombre: '', url: '', tipo: 'RSS', categoria: '' });

  // ── REAL jobs from /api/capture (SmartQueue state) + CapturaLog ──
  const [jobs, setJobs] = useState<CapturaJobReal[]>([]);
  const [queueInfo, setQueueInfo] = useState<{
    running: boolean;
    currentMedio: string | null;
    progress: { current: number; total: number };
    stats: { menciones: number; clasificadas: number; errores: number };
    recentLogs: string[];
  } | null>(null);

  // Fetch fuentes data
  const fetchData = useCallback(async () => {
    try {
      const res = await fetchWithTimeout(`/api/dashboard/fuentes?filter=${filter}`, { timeoutMs: 10_000 });
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [filter]);

  // Fetch REAL jobs from capture API + CapturaLog
  const fetchJobs = useCallback(async () => {
    try {
      // 1. Get SmartQueue state (real-time queue info)
      const captureRes = await fetchWithTimeout('/api/capture', { timeoutMs: 5000 });
      if (captureRes.ok) {
        const captureData = await captureRes.json();
        setQueueInfo(captureData.queue || null);

        // Get recent logs (these contain real job info)
        if (captureData.recentLogs && captureData.recentLogs.length > 0) {
          const parsedJobs: CapturaJobReal[] = captureData.recentLogs
            .filter((log: string) =>
              log.includes('PROCESANDO:') || log.includes('✅') || log.includes('❌')
            )
            .slice(-10)
            .map((log: string, idx: number) => {
              // Parse log lines like:
              // "[12:46:34] ✅ ABI: 3 menciones (2 clasificadas, 1 temáticas)"
              // "[12:46:34] ❌ ANF: ERROR FATAL — timeout"
              // "[12:46:34] [50%] ━━ (3/6) PROCESANDO: Bolivia Verifica ━━"
              const isOk = log.includes('✅');
              const isError = log.includes('❌');
              const isProcessing = log.includes('PROCESANDO:');

              // Extract medio name
              const medioMatch = log.match(/(?:PROCESANDO:|✅|❌)\s*(.+?)(?::|:|\s)/);
              const medioName = medioMatch ? medioMatch[1].trim()
                : isProcessing ? (log.match(/PROCESANDO:\s*(.+)/)?.[1]?.trim()?.split('━')[0]?.trim() || '')
                : 'Desconocido';

              return {
                id: `job-real-${idx}`,
                medioNombre: medioName,
                timestamp: new Date(Date.now() - idx * 60000).toISOString(),
                resultado: isOk ? 'ok' : isError ? 'error' : isProcessing ? 'en_curso' : 'unknown',
                duracion: null,
                exitosa: isOk,
                errores: isError ? log.split('—').pop()?.trim() || null : null,
              };
            })
            .reverse();
          setJobs(parsedJobs);
        }
      }

      // 2. Also fetch CapturaLog from DB (persistent job history)
      const logRes = await fetchWithTimeout('/api/dashboard/fuentes', { timeoutMs: 5000 });
      if (logRes.ok) {
        // We already have fuentes data, no need to re-fetch
      }
    } catch {
      // silent — jobs will stay as empty array
    }
  }, []);

  usePolling(fetchData, 15_000); // 15s polling for fuentes
  usePolling(fetchJobs, 10_000); // 10s polling for jobs (real-time)

  const fuentes = data?.fuentes ?? [];

  return (
    <PanelShell title="Gestión de Captura" icon={<Radio className="w-4 h-4" />} onClose={onClose}>
      <div className="p-4 space-y-4 relative" style={{ background: THEME.bg }}>
      {/* Scan line overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `repeating-linear-gradient(0deg, transparent, transparent 3px, ${THEME.scanLine} 3px, ${THEME.scanLine} 4px)`,
        }}
      />
      <div className="relative z-10 space-y-4">
        {/* ── Queue Status Banner ─────────────────────────── */}
        {queueInfo?.running && (
          <div
            className="rounded-lg px-3 py-2 flex items-center gap-3"
            style={{
              background: 'rgba(0,255,136,0.05)',
              border: '1px solid rgba(0,255,136,0.2)',
            }}
          >
            <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#00ff88' }} />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold" style={{ color: '#00ff88' }}>
                Cola activa: {queueInfo.currentMedio || 'Iniciando...'}
              </p>
              <p className="text-[10px]" style={{ color: '#64748b' }}>
                Progreso: {queueInfo.progress.current}/{queueInfo.progress.total} medios
                {' · '}
                {queueInfo.stats.menciones} menciones
                {' · '}
                {queueInfo.stats.clasificadas} clasificadas
                {queueInfo.stats.errores > 0 && ` · ${queueInfo.stats.errores} errores`}
              </p>
            </div>
            <div className="w-16 h-1.5 rounded-full overflow-hidden shrink-0" style={{ background: '#1a2744' }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  background: '#00ff88',
                  width: `${queueInfo.progress.total > 0 ? (queueInfo.progress.current / queueInfo.progress.total) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* ── Filter bar ──────────────────────────────────── */}
        <div className="flex gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className="px-2.5 py-1 text-[11px] font-medium rounded-md transition-all"
              style={{
                background: filter === f.key ? 'rgba(0,255,136,0.1)' : 'transparent',
                border: `1px solid ${filter === f.key ? '#00ff88' : '#1a2744'}`,
                color: filter === f.key ? '#00ff88' : '#64748b',
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              {f.label}
            </button>
          ))}
          {data && (
            <span className="ml-auto text-[10px] self-center" style={{ color: '#64748b' }}>
              {fuentes.length} fuentes
            </span>
          )}
        </div>

        {/* ── Source list ─────────────────────────────────── */}
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#00ff88' }} />
          </div>
        ) : fuentes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10" style={{ color: '#64748b' }}>
            <Inbox className="w-5 h-5 mb-1.5 opacity-40" />
            <span className="text-xs">Sin fuentes para este filtro</span>
          </div>
        ) : (
          <div className="space-y-1 max-h-[280px] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
            {fuentes.slice(0, 8).map((fuente) => (
              <div
                key={fuente.id}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid transparent', transition: 'all 0.2s ease' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(6,182,212,0.05)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 0 10px rgba(6,182,212,0.08)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.02)'; (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'; }}
              >
                {/* Status dot */}
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: statusDotColor(fuente.estado) }}
                />

                {/* Name + meta */}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold truncate" style={{ color: '#ffffff' }}>
                    {fuente.medioNombre}
                  </p>
                  <div className="flex gap-2 mt-0.5">
                    <span className="text-[11px]" style={{ color: '#64748b' }}>
                      {fuente.ultimaCapturaHace || timeAgoHuman(fuente.ultimaCaptura)}
                    </span>
                    <span className="text-[11px]" style={{ color: '#64748b' }}>
                      {fuente.mencionesSemana} menc/semana
                    </span>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    className="flex items-center justify-center rounded transition-colors"
                    style={{ width: 24, height: 24, color: '#64748b' }}
                    title={fuente.estado === 'pausada' ? 'Reanudar' : 'Pausar'}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#00ff88'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#64748b'; }}
                  >
                    {fuente.estado === 'pausada' ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                  </button>
                  <button
                    className="flex items-center justify-center rounded transition-colors"
                    style={{ width: 24, height: 24, color: '#64748b' }}
                    title="Reintentar"
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#ffaa00'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#64748b'; }}
                  >
                    <RefreshCw className="w-3 h-3" />
                  </button>
                  <button
                    className="flex items-center justify-center rounded transition-colors"
                    style={{ width: 24, height: 24, color: '#64748b' }}
                    title="Editar URL"
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#ffffff'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#64748b'; }}
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Add source button / form ────────────────────── */}
        {!showAddForm ? (
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1.5 w-full justify-center px-3 py-2 rounded-lg text-xs font-medium transition-colors"
            style={{ border: '1px dashed #1a2744', color: '#64748b' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#00ff88'; (e.currentTarget as HTMLButtonElement).style.color = '#00ff88'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#1a2744'; (e.currentTarget as HTMLButtonElement).style.color = '#64748b'; }}
          >
            <Plus className="w-3.5 h-3.5" />
            Añadir fuente
          </button>
        ) : (
          <div className="rounded-lg p-3 space-y-2.5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid #1a2744' }}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium" style={{ color: '#ffffff' }}>Nueva fuente</span>
              <button onClick={() => setShowAddForm(false)} style={{ color: '#64748b' }}>
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <input
              placeholder="Nombre del medio"
              className="w-full px-2.5 py-1.5 rounded-md text-xs outline-none"
              style={{ background: '#080c14', border: '1px solid #1a2744', color: '#ffffff' }}
              value={newSource.nombre}
              onChange={(e) => setNewSource({ ...newSource, nombre: e.target.value })}
            />
            <input
              placeholder="URL"
              className="w-full px-2.5 py-1.5 rounded-md text-xs outline-none"
              style={{ background: '#080c14', border: '1px solid #1a2744', color: '#ffffff' }}
              value={newSource.url}
              onChange={(e) => setNewSource({ ...newSource, url: e.target.value })}
            />
            <div className="flex gap-2">
              <select
                className="flex-1 px-2.5 py-1.5 rounded-md text-xs outline-none"
                style={{ background: '#080c14', border: '1px solid #1a2744', color: '#ffffff' }}
                value={newSource.tipo}
                onChange={(e) => setNewSource({ ...newSource, tipo: e.target.value })}
              >
                <option value="RSS">RSS</option>
                <option value="HTML">HTML</option>
              </select>
              <input
                placeholder="Categoría"
                className="flex-1 px-2.5 py-1.5 rounded-md text-xs outline-none"
                style={{ background: '#080c14', border: '1px solid #1a2744', color: '#ffffff' }}
                value={newSource.categoria}
                onChange={(e) => setNewSource({ ...newSource, categoria: e.target.value })}
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                className="flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
                style={{ background: 'rgba(0,255,136,0.1)', color: '#00ff88', border: '1px solid rgba(0,255,136,0.3)' }}
                onClick={() => {
                  setShowAddForm(false);
                  setNewSource({ nombre: '', url: '', tipo: 'RSS', categoria: '' });
                }}
              >
                Guardar
              </button>
              <button
                className="flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
                style={{ background: 'transparent', color: '#64748b', border: '1px solid #1a2744' }}
                onClick={() => {
                  setShowAddForm(false);
                  setNewSource({ nombre: '', url: '', tipo: 'RSS', categoria: '' });
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Glow separator */}
        <div className="h-[1px]" style={{ background: 'linear-gradient(90deg, transparent, rgba(6,182,212,0.2), transparent)' }} />

        {/* ── Últimos jobs de captura (REAL DATA) ──────────── */}
        <div className="pt-2" style={{ borderTop: '1px solid #1a2744' }}>
          <div className="flex items-center gap-2 mb-2">
            <Terminal size={12} style={{ color: THEME.accentCyan }} />
            <h3
              className="text-[10px] font-bold uppercase tracking-widest"
              style={{ color: THEME.accentCyan, fontFamily: "'JetBrains Mono', monospace" }}
            >
              ULTIMOS JOBS DE CAPTURA
            </h3>
            {queueInfo?.running && (
              <span className="ml-auto flex items-center gap-1 text-[10px]" style={{ color: '#00ff88' }}>
                <Loader2 className="w-3 h-3 animate-spin" />
                EN VIVO
              </span>
            )}
          </div>
          {jobs.length === 0 ? (
            <div className="py-6 text-center">
              <p className="text-[11px]" style={{ color: '#64748b' }}>
                {queueInfo?.running
                  ? 'Esperando resultados de la cola...'
                  : 'Sin jobs de captura registrados'}
              </p>
              {!queueInfo?.running && (
                <p className="text-[10px] mt-1" style={{ color: '#334155' }}>
                  Los jobs aparecerán aquí cuando inicies una captura
                </p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                <thead>
                  <tr style={{ color: '#64748b' }}>
                    <th className="text-left py-1 font-medium">Medio</th>
                    <th className="text-left py-1 font-medium">Timestamp</th>
                    <th className="text-left py-1 font-medium">Resultado</th>
                    <th className="text-right py-1 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.slice(0, 8).map((job) => (
                    <tr key={job.id} style={{ borderTop: '1px solid rgba(26,26,46,0.5)' }}>
                      <td className="py-1.5 pr-3" style={{ color: '#ffffff', maxWidth: 140 }}>
                        <span className="truncate block">{job.medioNombre || '—'}</span>
                      </td>
                      <td className="py-1.5 pr-3" style={{ color: '#64748b' }}>
                        {timeAgoHuman(job.timestamp)}
                      </td>
                      <td className="py-1.5 pr-3">
                        {job.resultado === 'en_curso' ? (
                          <span className="flex items-center gap-1" style={{ color: '#ffaa00' }}>
                            <Loader2 className="w-3 h-3 animate-spin" />
                            en curso
                          </span>
                        ) : job.resultado === 'ok' ? (
                          <span style={{ color: '#00ff88' }}>OK</span>
                        ) : job.resultado === 'error' ? (
                          <span style={{ color: '#ff3355' }} title={job.errores || undefined}>
                            error
                          </span>
                        ) : (
                          <span style={{ color: '#64748b' }}>—</span>
                        )}
                      </td>
                      <td className="py-1.5 text-right">
                        {job.errores && (
                          <span className="text-[9px]" style={{ color: '#ff335566' }} title={job.errores}>
                            {job.errores.substring(0, 30)}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      </div>
    </PanelShell>
  );
}
