'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { Bell, Crosshair, Terminal, Radio, Activity } from 'lucide-react';
import { PanelShell } from '@/components/onion200/PanelShell';
import { ExportMenu } from '@/components/onion200/ExportMenu';
import { fetchWithTimeout } from '@/lib/fetch-utils';

// ═══════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════

type Severidad = 1 | 2 | 3 | 4 | 5;

interface AlertaOperativa {
  id: string;
  severidad: Severidad;
  categoria: string;
  titulo: string;
  detalle: string;
  timestamp: string;
  fuente: string;
}

interface AlertasData {
  estadoGlobal: Severidad;
  alertas: AlertaOperativa[];
  resumen: string;
  timestamp: string;
  contadorPorSeveridad: Record<string, number>;
}

// ═══════════════════════════════════════════════════════════
// Color System — 5 niveles estilo alertas meteorológicas
// ═══════════════════════════════════════════════════════════

const SEVERIDAD = {
  1: { color: '#3b82f6', label: 'INFORMACIÓN', desc: 'Operación normal' },
  2: { color: '#06b6d4', label: 'AVISO',       desc: 'Atención requerida' },
  3: { color: '#f59e0b', label: 'VIGILANCIA',  desc: 'En observación' },
  4: { color: '#f97316', label: 'ADVERTENCIA', desc: 'Requiere acción' },
  5: { color: '#8b5cf6', label: 'ALERTA',      desc: 'Acción inmediata' },
} as const;

const THEME = {
  bg: '#0a0e17',
  panelBg: '#0d1321',
  border: '#1a2744',
  accentCyan: '#06b6d4',
  textPrimary: '#e2e8f0',
  textSecondary: '#64748b',
  textMuted: '#334155',
};

function sevColor(sev: Severidad): string {
  return SEVERIDAD[sev]?.color || THEME.textSecondary;
}

// ═══════════════════════════════════════════════════════════
// Status Ring — SVG minimal gauge
// ═══════════════════════════════════════════════════════════

function StatusRing({ estado, count }: { estado: Severidad; count: number }) {
  const color = sevColor(estado);
  const cx = 48, cy = 48, r = 36;
  const circumference = 2 * Math.PI * r;
  const fill = Math.min(count / 5, 1) * 0.75; // Max 75% fill
  const arcSweep = circumference * fill;

  return (
    <div className="relative flex flex-col items-center shrink-0">
      <div className="relative" style={{ width: 96, height: 96 }}>
        <svg width="96" height="96" viewBox="0 0 96 96">
          <defs>
            <filter id="ring-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Track */}
          <circle
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={THEME.border}
            strokeWidth="2"
            strokeDasharray={`${circumference * 0.75} ${circumference * 0.25}`}
            transform={`rotate(135, ${cx}, ${cy})`}
            strokeLinecap="round"
          />

          {/* Active arc */}
          {count > 0 && (
            <circle
              cx={cx} cy={cy} r={r}
              fill="none"
              stroke={color}
              strokeWidth="2"
              strokeDasharray={`${arcSweep} ${circumference - arcSweep}`}
              transform={`rotate(135, ${cx}, ${cy})`}
              strokeLinecap="round"
              filter="url(#ring-glow)"
            >
              {estado >= 4 && (
                <animate attributeName="opacity" values="1;0.4;1" dur="2s" repeatCount="indefinite" />
              )}
            </circle>
          )}

          {/* Outer ring */}
          <circle
            cx={cx} cy={cy} r={r + 6}
            fill="none"
            stroke={`${color}15`}
            strokeWidth="0.5"
          />

          {/* Center dot */}
          <circle
            cx={cx} cy={cy}
            r={count >= 4 ? 4 : 3}
            fill={count > 0 ? color : THEME.textMuted}
            opacity={count > 0 ? 0.8 : 0.3}
          >
            {estado >= 4 && (
              <animate attributeName="r" values="3;5;3" dur="1.5s" repeatCount="indefinite" />
            )}
          </circle>
        </svg>

        {/* Count overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="text-lg font-bold leading-none"
            style={{
              color,
              fontFamily: "'JetBrains Mono', monospace",
              textShadow: `0 0 12px ${color}`,
            }}
          >
            {count}
          </span>
        </div>
      </div>

      {/* Severity label */}
      <span
        className="text-[7px] font-bold uppercase tracking-[0.2em] mt-1"
        style={{
          color,
          fontFamily: "'JetBrains Mono', monospace",
          textShadow: `0 0 8px ${color}`,
          opacity: estado <= 2 ? 0.6 : 1,
        }}
      >
        {SEVERIDAD[estado].label}
      </span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Severity Distribution Bar
// ═══════════════════════════════════════════════════════════

function DistributionBar({ contadores }: { contadores: Record<string, number> }) {
  const total = Object.values(contadores).reduce((s, v) => s + v, 0);
  if (total === 0) return null;

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 flex h-2 rounded-full overflow-hidden" style={{ backgroundColor: THEME.border }}>
        {[5, 4, 3, 2, 1].map(sev => {
          const count = contadores[String(sev)] || 0;
          if (count === 0) return null;
          const pct = (count / total) * 100;
          return (
            <motion.div
              key={sev}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              style={{
                backgroundColor: sevColor(sev as Severidad),
                opacity: 0.7,
              }}
            />
          );
        })}
      </div>
      <span
        className="text-[8px] font-mono shrink-0"
        style={{ color: THEME.textMuted }}
      >
        {total}
      </span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Alert Card
// ═══════════════════════════════════════════════════════════

function AlertCard({ alerta, index }: { alerta: AlertaOperativa; index: number }) {
  const color = sevColor(alerta.severidad);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.05 }}
      className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg"
      style={{
        background: `${color}06`,
        borderLeft: `2px solid ${color}`,
      }}
    >
      {/* Severity badge */}
      <div className="shrink-0 mt-0.5 flex flex-col items-center gap-1">
        <span
          className="text-[7px] font-bold uppercase tracking-wider px-1 py-px rounded"
          style={{
            color,
            backgroundColor: `${color}12`,
            fontFamily: "'JetBrains Mono', monospace",
            border: `1px solid ${color}25`,
          }}
        >
          {SEVERIDAD[alerta.severidad].label}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p
          className="text-[11px] font-semibold leading-tight mb-0.5"
          style={{
            color: alerta.severidad >= 4 ? color : THEME.textPrimary,
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          {alerta.titulo}
        </p>
        <p
          className="text-[10px] leading-relaxed"
          style={{
            color: THEME.textSecondary,
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          {alerta.detalle}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <span
            className="text-[8px] uppercase"
            style={{ color: THEME.textMuted, fontFamily: "'JetBrains Mono', monospace" }}
          >
            {alerta.categoria}
          </span>
          <span style={{ color: THEME.textMuted }}>·</span>
          <span
            className="text-[8px]"
            style={{ color: THEME.textMuted, fontFamily: "'JetBrains Mono', monospace" }}
          >
            {alerta.fuente}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════
// Severity Legend
// ═══════════════════════════════════════════════════════════

function SeverityLegend() {
  return (
    <div className="flex items-center gap-3 justify-center">
      {([1, 2, 3, 4, 5] as Severidad[]).map(sev => (
        <div key={sev} className="flex items-center gap-1">
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{
              backgroundColor: SEVERIDAD[sev].color,
              boxShadow: `0 0 4px ${SEVERIDAD[sev].color}60`,
            }}
          />
          <span
            className="text-[7px] uppercase tracking-wider"
            style={{
              color: THEME.textMuted,
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            {SEVERIDAD[sev].label}
          </span>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════

export function AlertasPanel({ onClose }: { onClose?: () => void }) {
  const [data, setData] = useState<AlertasData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastPoll, setLastPoll] = useState<string>('--:--:--');
  const contentRef = useRef<HTMLDivElement>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetchWithTimeout('/api/alertas/estado', { timeoutMs: 10_000 });
      if (res.ok) {
        const json = await res.json();
        if (json.estado === 'ok' && json.data) {
          setData(json.data);
        }
      }
    } catch {
      // silent — usar último dato disponible
    } finally {
      setLoading(false);
      setLastPoll(new Date().toLocaleTimeString('es-BO', {
        timeZone: 'America/La_Paz',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }));
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const estadoGlobal = data?.estadoGlobal ?? 1;
  const alertCount = data?.alertas?.length ?? 0;

  return (
    <PanelShell
      title="ALERTAS OPERATIVAS"
      icon={<Crosshair className="w-4 h-4" />}
      onClose={onClose}
      extra={<ExportMenu targetRef={contentRef} filename={`alertas-decodex-${new Date().toISOString().slice(0, 10)}`} title="Alertas Operativas" />}
    >
      <div ref={contentRef} className="p-4 space-y-4" style={{ background: THEME.bg }}>
        {/* ── Header: Status Ring + Summary ── */}
        <div className="flex items-center gap-5">
          <StatusRing estado={estadoGlobal} count={alertCount} />

          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-2">
              <Bell size={14} style={{ color: sevColor(estadoGlobal) }} />
              <span
                className="text-[11px] font-bold uppercase tracking-widest"
                style={{
                  color: THEME.textPrimary,
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                CENTRO DE MONITOREO
              </span>
            </div>

            {/* Global status badge */}
            <span
              className="inline-block text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded"
              style={{
                color: sevColor(estadoGlobal),
                backgroundColor: `${sevColor(estadoGlobal)}10`,
                border: `1px solid ${sevColor(estadoGlobal)}25`,
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              {SEVERIDAD[estadoGlobal].label} — {SEVERIDAD[estadoGlobal].desc}
            </span>

            {/* Resumen */}
            {data?.resumen && (
              <p
                className="text-[10px] leading-relaxed"
                style={{
                  color: THEME.textSecondary,
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                {data.resumen}
              </p>
            )}
          </div>
        </div>

        {/* ── Severity Distribution Bar ── */}
        {data?.contadorPorSeveridad && (
          <DistributionBar contadores={data.contadorPorSeveridad} />
        )}

        {/* ── Severity Legend ── */}
        <SeverityLegend />

        {/* ── Loading ── */}
        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="flex items-center gap-2">
              <motion.div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: THEME.accentCyan }}
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1.2, repeat: Infinity }}
              />
              <span
                className="text-[10px] animate-pulse"
                style={{ color: THEME.textSecondary, fontFamily: "'JetBrains Mono', monospace" }}
              >
                Escaneando sistema...
              </span>
            </div>
          </div>
        )}

        {/* ── Alert List ── */}
        {!loading && data?.alertas && data.alertas.length > 0 && (
          <div className="space-y-2 max-h-[calc(100vh-420px)] overflow-y-auto custom-scrollbar">
            {data.alertas.map((alerta, i) => (
              <AlertCard key={alerta.id} alerta={alerta} index={i} />
            ))}
          </div>
        )}

        {/* ── Empty state ── */}
        {!loading && (!data?.alertas || data.alertas.length === 0) && (
          <div className="flex flex-col items-center justify-center py-8 space-y-2">
            <Radio size={20} style={{ color: THEME.textMuted }} />
            <p
              className="text-[10px]"
              style={{ color: THEME.textSecondary, fontFamily: "'JetBrains Mono', monospace" }}
            >
              Sin alertas activas
            </p>
            <p
              className="text-[9px] text-center max-w-xs"
              style={{ color: THEME.textMuted, fontFamily: "'JetBrains Mono', monospace" }}
            >
              Todos los sistemas operativos dentro de parámetros normales.
            </p>
          </div>
        )}

        {/* ── Footer ── */}
        <div
          className="flex items-center justify-between pt-2"
          style={{ borderTop: `1px solid ${THEME.border}` }}
        >
          <span
            className="text-[8px]"
            style={{ color: THEME.textMuted, fontFamily: "'JetBrains Mono', monospace" }}
          >
            <Activity size={8} className="inline mr-1" />
            Polling: 60s
          </span>
          <span
            className="text-[8px]"
            style={{ color: THEME.textMuted, fontFamily: "'JetBrains Mono', monospace" }}
          >
            Ultima lectura: {lastPoll}
          </span>
        </div>
      </div>
    </PanelShell>
  );
}

export default AlertasPanel;
