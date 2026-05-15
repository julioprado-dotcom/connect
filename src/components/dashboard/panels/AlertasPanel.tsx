'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Crosshair, Terminal, Shield, Activity, TrendingUp, Radio } from 'lucide-react';
import { PanelShell } from './PanelShell';
import { fetchWithTimeout } from '@/lib/fetch-utils';

// ═══════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════

interface EjeEstado {
  nombre: string;
  slug: string;
  estado: 'VERDE' | 'AMARILLO' | 'ROJO';
  alertas: Array<{
    nivel: 'AMARILLO' | 'ROJO';
    mensaje: string;
    indicador: string;
    valor: number;
    umbral: number;
  }>;
}

interface SemaforoData {
  estadoGlobal: 'VERDE' | 'AMARILLO' | 'ROJO';
  ejes: EjeEstado[];
  cruces: Array<{
    ejes: string[];
    tipo: string;
    severidad: 'moderada' | 'alta' | 'critica';
    descripcion: string;
  }>;
  recomendacion: string;
  resumen: string;
  timestamp: string;
  alertas: Array<{
    nivel: 'AMARILLO' | 'ROJO';
    mensaje: string;
    indicador: string;
    valor: number;
    umbral: number;
  }>;
}

// ═══════════════════════════════════════════════════════════
// Color System
// ═══════════════════════════════════════════════════════════

const SEMAFORO_COLORS = {
  VERDE: '#00ff88',
  AMARILLO: '#ffaa00',
  ROJO: '#ff3355',
} as const;

const THEME = {
  bg: '#0a0e17',
  panelBg: '#0d1321',
  border: '#1a2744',
  borderGlow: '#0ea5e9',
  accentCyan: '#06b6d4',
  accentGreen: '#00ff88',
  accentAmber: '#ffaa00',
  accentRed: '#ff3355',
  textPrimary: '#e2e8f0',
  textSecondary: '#64748b',
  textMuted: '#334155',
  scanLine: 'rgba(6, 182, 212, 0.03)',
};

function estadoColor(estado: string): string {
  return SEMAFORO_COLORS[estado as keyof typeof SEMAFORO_COLORS] || THEME.textSecondary;
}

function estadoGlow(estado: string): string {
  switch (estado) {
    case 'VERDE': return `0 0 20px rgba(0, 255, 136, 0.3)`;
    case 'AMARILLO': return `0 0 20px rgba(255, 170, 0, 0.3)`;
    case 'ROJO': return `0 0 20px rgba(255, 51, 85, 0.4)`;
    default: return 'none';
  }
}

function severidadColor(sev: string): string {
  switch (sev) {
    case 'critica': return THEME.accentRed;
    case 'alta': return THEME.accentAmber;
    default: return THEME.accentCyan;
  }
}

// ═══════════════════════════════════════════════════════════
// Semaforo SVG Component
// ═══════════════════════════════════════════════════════════

function SemaforoSVG({ estado }: { estado: string }) {
  const color = estadoColor(estado);

  return (
    <div className="relative flex flex-col items-center">
      <svg width="40" height="100" viewBox="0 0 40 100" className="drop-shadow-lg">
        {/* Body */}
        <rect x="4" y="4" width="32" height="92" rx="6" fill="#0d1321" stroke={THEME.border} strokeWidth="1.5" />
        {/* Red light */}
        <circle cx="20" cy="24" r="9" fill={estado === 'ROJO' ? THEME.accentRed : '#1a1a2e'} stroke="#1a2744" strokeWidth="1" />
        {estado === 'ROJO' && (
          <>
            <circle cx="20" cy="24" r="9" fill={THEME.accentRed} opacity="0.6">
              <animate attributeName="r" values="9;12;9" dur="1.5s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.6;0.2;0.6" dur="1.5s" repeatCount="indefinite" />
            </circle>
          </>
        )}
        {/* Yellow light */}
        <circle cx="20" cy="50" r="9" fill={estado === 'AMARILLO' ? THEME.accentAmber : '#1a1a2e'} stroke="#1a2744" strokeWidth="1" />
        {estado === 'AMARILLO' && (
          <>
            <circle cx="20" cy="50" r="9" fill={THEME.accentAmber} opacity="0.5">
              <animate attributeName="r" values="9;12;9" dur="2s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.5;0.15;0.5" dur="2s" repeatCount="indefinite" />
            </circle>
          </>
        )}
        {/* Green light */}
        <circle cx="20" cy="76" r="9" fill={estado === 'VERDE' ? THEME.accentGreen : '#1a1a2e'} stroke="#1a2744" strokeWidth="1" />
        {estado === 'VERDE' && (
          <circle cx="20" cy="76" r="9" fill={THEME.accentGreen} opacity="0.4">
            <animate attributeName="opacity" values="0.4;0.2;0.4" dur="3s" repeatCount="indefinite" />
          </circle>
        )}
      </svg>
      {/* Glow underneath */}
      <div
        className="absolute -bottom-2 w-12 h-2 rounded-full blur-sm"
        style={{
          backgroundColor: color,
          opacity: 0.4,
          boxShadow: `0 0 20px ${color}`,
        }}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Eje Card Component
// ═══════════════════════════════════════════════════════════

function EjeCard({ eje, index }: { eje: EjeEstado; index: number }) {
  const color = estadoColor(eje.estado);
  const hasAlertas = eje.alertas.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.08 }}
      className="relative overflow-hidden rounded-lg cursor-default"
      style={{
        background: `linear-gradient(135deg, ${color}08 0%, ${THEME.panelBg} 40%)`,
        border: `1px solid ${hasAlertas ? `${color}40` : THEME.border}`,
        boxShadow: hasAlertas ? `0 0 15px ${color}15, inset 0 0 15px ${color}08` : 'none',
      }}
    >
      {/* Scan line effect */}
      <div
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{
          background: `repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            ${THEME.scanLine} 2px,
            ${THEME.scanLine} 4px
          )`,
        }}
      />

      {/* Header */}
      <div className="relative z-10 flex items-center gap-2 px-3 py-2.5" style={{ borderBottom: `1px solid ${THEME.border}` }}>
        {/* Status dot */}
        <motion.span
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}` }}
          animate={eje.estado === 'ROJO' ? { opacity: [1, 0.4, 1] } : {}}
          transition={eje.estado === 'ROJO' ? { duration: 1, repeat: Infinity } : {}}
        />
        <span
          className="text-[11px] font-bold uppercase tracking-wider flex-1 truncate"
          style={{ color: THEME.textPrimary, fontFamily: "'JetBrains Mono', monospace" }}
        >
          {eje.nombre}
        </span>
        <span
          className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded"
          style={{
            color,
            backgroundColor: `${color}15`,
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          {eje.estado}
        </span>
      </div>

      {/* Body: Alertas */}
      <div className="relative z-10 px-3 py-2 min-h-[40px]">
        {hasAlertas ? (
          <div className="space-y-1">
            {eje.alertas.map((alerta, i) => (
              <div key={i} className="flex items-start gap-1.5">
                <Activity
                  size={10}
                  className="shrink-0 mt-0.5"
                  style={{ color: estadoColor(alerta.nivel) }}
                />
                <span
                  className="text-[10px] leading-snug"
                  style={{ color: THEME.textSecondary, fontFamily: "'JetBrains Mono', monospace" }}
                >
                  {alerta.mensaje}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <Shield size={10} style={{ color: THEME.accentGreen, opacity: 0.6 }} />
            <span
              className="text-[10px]"
              style={{ color: THEME.textMuted, fontFamily: "'JetBrains Mono', monospace" }}
            >
              Sin alertas activas
            </span>
          </div>
        )}
      </div>

      {/* Bottom glow line */}
      <div
        className="h-[1px] w-full"
        style={{
          background: `linear-gradient(90deg, transparent, ${color}40, transparent)`,
        }}
      />
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════
// Cruce Sistemico Card
// ═══════════════════════════════════════════════════════════

function CruceCard({ cruce, index }: { cruce: SemaforoData['cruces'][0]; index: number }) {
  const color = severidadColor(cruce.severidad);

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25, delay: 0.3 + index * 0.1 }}
      className="flex items-start gap-2.5 px-3 py-2 rounded-lg"
      style={{
        background: `${color}08`,
        border: `1px solid ${color}25`,
      }}
    >
      <Crosshair size={14} className="shrink-0 mt-0.5" style={{ color }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span
            className="text-[10px] font-bold uppercase tracking-wider"
            style={{ color, fontFamily: "'JetBrains Mono', monospace" }}
          >
            CRUCE: {cruce.ejes.join(' x ')}
          </span>
          <span
            className="text-[8px] px-1 py-px rounded font-bold uppercase"
            style={{ color, backgroundColor: `${color}20`, fontFamily: "'JetBrains Mono', monospace" }}
          >
            {cruce.severidad}
          </span>
        </div>
        <p
          className="text-[10px] leading-snug"
          style={{ color: THEME.textSecondary, fontFamily: "'JetBrains Mono', monospace" }}
        >
          {cruce.descripcion}
        </p>
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════
// Tactical Header
// ═══════════════════════════════════════════════════════════

function TacticalHeader({ data }: { data: SemaforoData | null }) {
  const estado = data?.estadoGlobal || 'VERDE';
  const color = estadoColor(estado);
  const now = new Date().toLocaleTimeString('es-BO', {
    timeZone: 'America/La_Paz',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  return (
    <div className="relative overflow-hidden rounded-xl p-4" style={{
      background: `linear-gradient(135deg, ${color}10 0%, ${THEME.panelBg} 50%, ${color}05 100%)`,
      border: `1px solid ${color}30`,
      boxShadow: `0 0 30px ${color}10, inset 0 0 30px ${color}05`,
    }}>
      {/* Scan lines */}
      <div className="absolute inset-0 pointer-events-none opacity-30" style={{
        background: `repeating-linear-gradient(0deg, transparent, transparent 2px, ${THEME.scanLine} 2px, ${THEME.scanLine} 4px)`,
      }} />

      <div className="relative z-10 flex items-center gap-5">
        {/* Semaforo */}
        <SemaforoSVG estado={estado} />

        {/* Info */}
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-2">
            <Bell size={16} style={{ color }} />
            <h2
              className="text-sm font-bold uppercase tracking-widest"
              style={{ color: THEME.textPrimary, fontFamily: "'JetBrains Mono', monospace" }}
            >
              CENTRO DE ALERTAS TEMPRANAS
            </h2>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <motion.span
              className="text-[11px] font-bold uppercase tracking-widest px-2 py-1 rounded"
              style={{
                color,
                backgroundColor: `${color}15`,
                border: `1px solid ${color}30`,
                fontFamily: "'JetBrains Mono', monospace",
                boxShadow: `0 0 10px ${color}15`,
              }}
              animate={estado === 'ROJO' ? { scale: [1, 1.02, 1] } : {}}
              transition={estado === 'ROJO' ? { duration: 1.5, repeat: Infinity } : {}}
            >
              ESTADO: {estado}
            </motion.span>

            <span
              className="text-[10px]"
              style={{ color: THEME.textSecondary, fontFamily: "'JetBrains Mono', monospace" }}
            >
              ONION200
            </span>

            <span
              className="text-[10px] ml-auto"
              style={{ color: THEME.textMuted, fontFamily: "'JetBrains Mono', monospace" }}
            >
              <Terminal size={10} className="inline mr-1" style={{ color: THEME.textMuted }} />
              {now} BST
            </span>
          </div>

          {/* Resumen */}
          {data?.resumen && (
            <p
              className="text-[11px] leading-relaxed"
              style={{ color: THEME.textSecondary, fontFamily: "'JetBrains Mono', monospace" }}
            >
              {data.resumen}
            </p>
          )}
        </div>
      </div>

      {/* Bottom glow */}
      <div className="absolute bottom-0 left-0 right-0 h-[1px]" style={{
        background: `linear-gradient(90deg, transparent, ${color}50, transparent)`,
      }} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Stats Bar
// ═══════════════════════════════════════════════════════════

function StatsBar({ data }: { data: SemaforoData | null }) {
  const totalAlertas = data?.alertas?.length || 0;
  const rojas = data?.alertas?.filter(a => a.nivel === 'ROJO').length || 0;
  const amarillas = data?.alertas?.filter(a => a.nivel === 'AMARILLO').length || 0;
  const cruces = data?.cruces?.length || 0;

  const stats = [
    { label: 'ALERTAS TOTALES', value: totalAlertas, color: totalAlertas > 0 ? THEME.accentCyan : THEME.textMuted },
    { label: 'ROJAS', value: rojas, color: rojas > 0 ? THEME.accentRed : THEME.textMuted },
    { label: 'AMARILLAS', value: amarillas, color: amarillas > 0 ? THEME.accentAmber : THEME.textMuted },
    { label: 'CRUCES', value: cruces, color: cruces > 0 ? '#a855f7' : THEME.textMuted },
    { label: 'EJES', value: data?.ejes?.length || 0, color: THEME.accentGreen },
  ];

  return (
    <div className="grid grid-cols-5 gap-2">
      {stats.map((s) => (
        <div
          key={s.label}
          className="text-center py-2 rounded-lg"
          style={{
            background: `${s.color}08`,
            border: `1px solid ${s.color}20`,
          }}
        >
          <p
            className="text-lg font-bold leading-none mb-0.5"
            style={{ color: s.color, fontFamily: "'JetBrains Mono', monospace" }}
          >
            {s.value}
          </p>
          <p
            className="text-[8px] uppercase tracking-widest"
            style={{ color: THEME.textMuted, fontFamily: "'JetBrains Mono', monospace" }}
          >
            {s.label}
          </p>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════

export function AlertasPanel({ onClose }: { onClose?: () => void }) {
  const [data, setData] = useState<SemaforoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastPoll, setLastPoll] = useState<string>('--:--:--');

  const fetchData = useCallback(async () => {
    try {
      const res = await fetchWithTimeout('/api/alertas/estado', { timeoutMs: 10_000 });
      if (res.ok) {
        const json = await res.json();
        if (json.estado === 'ok' && json.data) {
          setData(json.data);
        } else if (json.estado === 'sin_datos') {
          // No hay datos - mostrar estado vacío
          setData(null);
        }
      }
    } catch {
      // silent - usar último dato disponible
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

  // Poll every 60 seconds
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  return (
    <PanelShell
      title="ALERTAS TEMPRANAS"
      icon={<Crosshair className="w-4 h-4" />}
      onClose={onClose}
    >
      <div className="p-4 space-y-4" style={{ background: THEME.bg }}>
        {/* ── Tactical Header with Semaforo ── */}
        <TacticalHeader data={data} />

        {/* ── Stats Bar ── */}
        <StatsBar data={data} />

        {/* ── Loading skeleton ── */}
        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="flex items-center gap-2">
              <motion.div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: THEME.accentCyan }}
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1.2, repeat: Infinity }}
              />
              <span
                className="text-[11px] animate-pulse"
                style={{ color: THEME.textSecondary, fontFamily: "'JetBrains Mono', monospace" }}
              >
                Escaneando indicadores...
              </span>
            </div>
          </div>
        )}

        {/* ── Ejes Grid ── */}
        {data?.ejes && data.ejes.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp size={12} style={{ color: THEME.accentCyan }} />
              <span
                className="text-[10px] font-bold uppercase tracking-widest"
                style={{ color: THEME.textSecondary, fontFamily: "'JetBrains Mono', monospace" }}
              >
                EJES DE RIESGO
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {data.ejes.map((eje, i) => (
                <EjeCard key={eje.slug} eje={eje} index={i} />
              ))}
            </div>
          </div>
        )}

        {/* ── No data message ── */}
        {!loading && !data && (
          <div className="flex flex-col items-center justify-center py-8 space-y-2">
            <Radio size={24} style={{ color: THEME.textMuted }} />
            <p className="text-[11px]" style={{ color: THEME.textSecondary, fontFamily: "'JetBrains Mono', monospace" }}>
              Sin indicadores configurados
            </p>
            <p className="text-[10px] text-center max-w-xs" style={{ color: THEME.textMuted, fontFamily: "'JetBrains Mono', monospace" }}>
              Configure indicadores economicos y umbrales para activar el semaforo de alertas tempranas.
            </p>
          </div>
        )}

        {/* ── Cruces Sistemicos ── */}
        {data?.cruces && data.cruces.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Crosshair size={12} style={{ color: '#a855f7' }} />
              <span
                className="text-[10px] font-bold uppercase tracking-widest"
                style={{ color: THEME.textSecondary, fontFamily: "'JetBrains Mono', monospace" }}
              >
                CRUCES SISTEMICOS
              </span>
              <span
                className="text-[8px] px-1 py-px rounded font-bold"
                style={{
                  color: data.cruces.some(c => c.severidad === 'critica') ? THEME.accentRed : THEME.accentAmber,
                  backgroundColor: `${data.cruces.some(c => c.severidad === 'critica') ? THEME.accentRed : THEME.accentAmber}15`,
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                {data.cruces.length} ACTIVO{data.cruces.length > 1 ? 'S' : ''}
              </span>
            </div>
            <div className="space-y-2">
              {data.cruces.map((cruce, i) => (
                <CruceCard key={i} cruce={cruce} index={i} />
              ))}
            </div>
          </div>
        )}

        {/* ── Recomendacion ── */}
        {data?.recomendacion && (
          <div
            className="rounded-lg p-3"
            style={{
              background: `${THEME.accentCyan}08`,
              border: `1px solid ${THEME.accentCyan}25`,
            }}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <Terminal size={10} style={{ color: THEME.accentCyan }} />
              <span
                className="text-[9px] font-bold uppercase tracking-widest"
                style={{ color: THEME.accentCyan, fontFamily: "'JetBrains Mono', monospace" }}
              >
                RECOMENDACION ONION200
              </span>
            </div>
            <p
              className="text-[11px] leading-relaxed"
              style={{ color: THEME.textSecondary, fontFamily: "'JetBrains Mono', monospace" }}
            >
              {data.recomendacion}
            </p>
          </div>
        )}

        {/* ── Footer: Poll timestamp ── */}
        <div className="flex items-center justify-between pt-2" style={{ borderTop: `1px solid ${THEME.border}` }}>
          <span
            className="text-[9px]"
            style={{ color: THEME.textMuted, fontFamily: "'JetBrains Mono', monospace" }}
          >
            <Activity size={9} className="inline mr-1" style={{ color: THEME.accentGreen }} />
            Polling: 60s
          </span>
          <span
            className="text-[9px]"
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
