'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { fetchWithTimeout } from '@/lib/fetch-utils';

// ─── Types ────────────────────────────────────────────────

type NodeStatus = 'ok' | 'warning' | 'error' | 'idle';
type NodeKey = 'captura' | 'clasificacion' | 'produccion' | 'distribucion';

interface PipelineNode {
  key: NodeKey;
  label: string;
  icon: string;
  status: NodeStatus;
  lastActivity: string;
  count: string;
  detail: string;
}

interface PipelineSource {
  timestamp: string;
  horaBolivia: string;
  diaSemana: string;
  pasado: {
    completados: Array<{ id: string; tipo: string; prioridad: number; duracionSegundos: number | null; hace: string; fecha: string; resultado: Record<string, unknown> }>;
    fallidos: Array<{ id: string; tipo: string; prioridad: number; error: string; intentos: number; maxIntentos: number; puedeReintentar: boolean; duracionSegundos: number | null; hace: string; fecha: string; fuente: string | null; cliente: string | null; canal: string | null }>;
    entregas: { total: number; enviadas: number; pendientes: number; fallidas: number };
    productosIA: Array<{ id: string; tipo: string; menciones: number; enlacesRotos: number; fecha: string; hace: string }>;
  };
  presente: {
    enEjecucion: Array<Record<string, unknown>>;
    fuentes: Array<{
      id: string; medioId: string; nombre: string; url: string;
      tipo: string; categoria: string; activo: boolean;
      esDegradado: boolean; estaMuerto: boolean;
      ultimoCheck: string | null; ultimoCheckHace: string;
      totalChecks: number; totalCambios: number; checksSinCambio: number;
      totalMenciones?: number; error: string | null;
    }>;
    worker: { running: boolean; lastJobHace: string; jobsCompleted: number; jobsFailed: number };
  };
  futuro: {
    boletines: Array<{ tipo: string; hora: number; minuto: number; minutosHasta: number; prioridad: number; estado: string }>;
    entregasProgramadas: Array<{ id: string; tipoBoletin: string; canal: string; clienteNombre: string; fechaProgramada: string | null; minutosHasta: number | null }>;
  };
}

// Datos reales del pipeline — complementan al PipelineSource
interface IndicadoresData {
  captura: {
    menciones: { total: number; hoy: number; semana: number };
    medios: number;
    fuentes: { activas: number; degradadas: number };
    ultimaCapturaHace: string;
    status: string;
  };
  clasificacion: {
    lentes: number;
    ejes: number;
    mencionesClasificadas: { conLente: number; conEje: number; conSentimiento: number; total: number };
    tasas: { lente: number; eje: number; sentimiento: number };
    status: string;
  };
  produccion: {
    productos: { total: number; hoy: number; semana: number };
    porTipo: Array<{ tipo: string; total: number }>;
    ultimoProductoHace: string;
    status: string;
  };
  distribucion: {
    envios: { total: number; exitosos: number; fallidos: number; tasaExito: number };
    suscriptores: number;
    ultimoEnvioHace: string;
    status: string;
  };
  sistema: {
    jobs24h: { completados: number; fallidos: number };
    status: string;
  };
}

// ─── Color Constants ─────────────────────────────────────

const COLORS = {
  bg: '#080c14',
  panel: '#0d1321',
  border: '#1a2744',
  accent: '#00ff88',
  accentCyan: '#06b6d4',
  warning: '#ffaa00',
  error: '#ff3355',
  idle: '#334155',
  textWhite: '#e2e8f0',
  textGray: '#64748b',
};

const STATUS_COLORS: Record<NodeStatus, { dot: string; glow: string; border: string }> = {
  ok: { dot: COLORS.accent, glow: 'none', border: COLORS.border },
  warning: { dot: COLORS.warning, glow: 'none', border: `${COLORS.warning}66` },
  error: { dot: COLORS.error, glow: COLORS.error, border: `${COLORS.error}88` },
  idle: { dot: COLORS.idle, glow: 'none', border: COLORS.border },
};

const STATUS_LABELS: Record<NodeStatus, string> = {
  ok: 'OK',
  warning: 'WARN',
  error: 'ERROR',
  idle: 'IDLE',
};

// ─── Helpers ─────────────────────────────────────────────

function toNodeStatus(s: string | undefined): NodeStatus {
  if (s === 'ok') return 'ok';
  if (s === 'warn' || s === 'warning') return 'warning';
  if (s === 'error') return 'error';
  return 'idle';
}

function deriveNodes(pipeline: PipelineSource, indicadores: IndicadoresData | null): PipelineNode[] {
  const { pasado, presente, futuro } = pipeline;
  const fuentes = presente.fuentes || [];

  // ── CAPTURA ──
  // Usa datos reales de indicadores si están disponibles, si no fallback al pipeline
  const capturaStatus = toNodeStatus(indicadores?.captura.status);
  const capturaCount = indicadores
    ? `${indicadores.captura.menciones.total} menciones`
    : `${fuentes.reduce((s, f) => s + (f.totalMenciones || 0), 0)} menciones`;
  const capturaDetail = indicadores
    ? `${indicadores.captura.fuentes.activas} fuentes · ${indicadores.captura.medios} medios`
    : `${fuentes.filter(f => f.activo).length} fuentes`;
  const capturaLast = indicadores?.captura.ultimaCapturaHace || 'sin datos';

  // ── CLASIFICACIÓN ──
  const clasifStatus = toNodeStatus(indicadores?.clasificacion.status);
  let clasifCount = 'sin datos';
  let clasifDetail = '';
  if (indicadores) {
    const { conEje, conLente, total } = indicadores.clasificacion.mencionesClasificadas;
    const pctEje = indicadores.clasificacion.tasas.eje;
    clasifCount = `${pctEje}% clasificado`;
    clasifDetail = `${conEje}/${total} con eje · ${indicadores.clasificacion.ejes} ejes`;
  }
  const clasifLast = pasado.completados.length > 0 ? pasado.completados[0].hace : 'sin datos';

  // ── PRODUCCIÓN ──
  const prodStatus = toNodeStatus(indicadores?.produccion.status);
  let prodCount = '0 productos';
  let prodDetail = '';
  if (indicadores) {
    const { total, hoy } = indicadores.produccion.productos;
    const tipos = indicadores.produccion.porTipo.map(p => p.tipo.replace(/_/g, ' '));
    prodCount = `${total} productos`;
    prodDetail = hoy > 0 ? `${hoy} hoy · ${tipos.length} tipos` : `${tipos.length} tipos`;
  }
  const prodLast = indicadores?.produccion.ultimoProductoHace || 'sin datos';

  // ── DISTRIBUCIÓN ──
  const distStatus = toNodeStatus(indicadores?.distribucion.status);
  let distCount = 'sin envíos';
  let distDetail = '';
  if (indicadores) {
    const { total, exitosos, fallidos } = indicadores.distribucion.envios;
    if (total > 0) {
      distCount = `${exitosos}/${total} enviados`;
      distDetail = fallidos > 0 ? `${fallidos} fallidos` : '100% éxito';
    } else {
      distCount = 'sin envíos';
      distDetail = `${indicadores.distribucion.suscriptores} suscriptores`;
    }
  }
  const distLast = indicadores?.distribucion.ultimoEnvioHace ||
    (futuro.entregasProgramadas.length > 0
      ? `próximo en ${futuro.entregasProgramadas[0].minutosHasta}m`
      : 'sin datos');

  return [
    {
      key: 'captura',
      label: 'CAPTURA',
      icon: '📡',
      status: capturaStatus,
      lastActivity: capturaLast,
      count: capturaCount,
      detail: capturaDetail,
    },
    {
      key: 'clasificacion',
      label: 'CLASIFICACIÓN',
      icon: '🏷️',
      status: clasifStatus,
      lastActivity: clasifLast,
      count: clasifCount,
      detail: clasifDetail,
    },
    {
      key: 'produccion',
      label: 'PRODUCCIÓN',
      icon: '⚡',
      status: prodStatus,
      lastActivity: prodLast,
      count: prodCount,
      detail: prodDetail,
    },
    {
      key: 'distribucion',
      label: 'DISTRIBUCIÓN',
      icon: '📤',
      status: distStatus,
      lastActivity: distLast,
      count: distCount,
      detail: distDetail,
    },
  ];
}

// ─── Arrow Component ────────────────────────────────────

function FlowArrow({ active, broken }: { active: boolean; broken: boolean }) {
  return (
    <div className="flex items-center justify-center w-8 sm:w-12 md:w-16 lg:w-20 shrink-0">
      <div className="relative w-full h-[2px]">
        {/* Animated gradient background */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: broken
              ? 'repeating-linear-gradient(90deg, #1a1a2e 0px, #1a1a2e 4px, transparent 4px, transparent 8px)'
              : active
                ? 'linear-gradient(90deg, #1a1a2e, #00ff88, #1a1a2e)'
                : '#1a1a2e',
            opacity: broken ? 0.5 : active ? 1 : 0.3,
            animation: active && !broken ? 'arrowFlow 2s linear infinite' : 'none',
            backgroundSize: '200% 100%',
          }}
        />
        {/* Static gradient overlay for glow effect */}
        {active && !broken && (
          <div
            className="absolute inset-0 rounded-full blur-[2px]"
            style={{
              background: 'linear-gradient(90deg, transparent, #00ff8866, transparent)',
              backgroundSize: '200% 100%',
              animation: 'arrowFlow 2s linear infinite',
            }}
          />
        )}
      </div>
    </div>
  );
}

// ─── Node Component ─────────────────────────────────────

function PipelineNodeCard({
  node,
  isActive,
  onClick,
}: {
  node: PipelineNode;
  isActive: boolean;
  onClick: () => void;
}) {
  const colors = STATUS_COLORS[node.status];

  return (
    <motion.button
      onClick={onClick}
      className="relative flex-shrink-0 w-[130px] sm:w-[145px] md:w-[160px] rounded-xl p-3 text-left transition-transform duration-200 cursor-pointer focus:outline-none"
      style={{
        background: COLORS.panel,
        border: `1px solid ${isActive ? COLORS.accent : colors.border}`,
        transformOrigin: 'center',
      }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      animate={
        node.status === 'error'
          ? {
              boxShadow: [
                `0 0 8px ${COLORS.error}33, inset 0 0 8px ${COLORS.error}11`,
                `0 0 20px ${COLORS.error}55, inset 0 0 12px ${COLORS.error}22`,
                `0 0 8px ${COLORS.error}33, inset 0 0 8px ${COLORS.error}11`,
              ],
            }
          : isActive
            ? {
                boxShadow: `0 0 12px ${COLORS.accent}44, inset 0 0 8px ${COLORS.accent}11`,
              }
            : {
                boxShadow: `0 0 0px transparent, inset 0 0 0px transparent`,
              }
      }
      transition={
        node.status === 'error'
          ? { boxShadow: { duration: 1.2, repeat: Infinity, ease: 'easeInOut' } }
          : { duration: 0.3 }
      }
    >
      {/* Glassmorphism gradient border overlay */}
      <div
        className="absolute inset-0 rounded-xl pointer-events-none"
        style={{
          background: isActive
            ? 'linear-gradient(135deg, #00ff8822 0%, transparent 50%, #00ff8811 100%)'
            : 'linear-gradient(135deg, #ffffff06 0%, transparent 50%, #ffffff03 100%)',
          borderRadius: 'inherit',
        }}
      />

      {/* Content */}
      <div className="relative z-10 space-y-1.5">
        {/* Icon + Name */}
        <div className="flex items-center gap-1.5">
          <span className="text-base leading-none">{node.icon}</span>
          <span
            className="font-semibold text-[12px] leading-tight tracking-wide"
            style={{ color: COLORS.textWhite, fontFamily: 'Inter, system-ui, sans-serif' }}
          >
            {node.label}
          </span>
        </div>

        {/* Status badge */}
        <div className="flex items-center gap-1.5">
          <motion.span
            className="inline-block rounded-full w-2 h-2"
            style={{ backgroundColor: colors.dot }}
            animate={
              node.status === 'error'
                ? { opacity: [1, 0.3, 1] }
                : node.status === 'ok'
                  ? { opacity: [0.6, 1, 0.6] }
                  : {}
            }
            transition={
              node.status !== 'warning'
                ? { duration: 1.2, repeat: Infinity, ease: 'easeInOut' }
                : {}
            }
          />
          <span
            className="text-[10px] font-semibold uppercase tracking-wider"
            style={{
              color: colors.dot,
              fontFamily: 'Inter, system-ui, sans-serif',
            }}
          >
            {STATUS_LABELS[node.status]}
          </span>
        </div>

        {/* Count — dato real principal */}
        <p
          className="text-[12px] font-bold truncate"
          style={{
            color: COLORS.textWhite,
            fontFamily: 'JetBrains Mono, ui-monospace, monospace',
          }}
        >
          {node.count}
        </p>

        {/* Detail — dato secundario real */}
        <p
          className="text-[10px] truncate"
          style={{
            color: COLORS.textGray,
            fontFamily: 'JetBrains Mono, ui-monospace, monospace',
          }}
        >
          {node.detail}
        </p>

        {/* Last activity */}
        <p
          className="text-[9px] truncate"
          style={{
            color: `${COLORS.textGray}99`,
            fontFamily: 'JetBrains Mono, ui-monospace, monospace',
          }}
        >
          {node.lastActivity}
        </p>
      </div>
    </motion.button>
  );
}

// ─── CSS Keyframes ──────────────────────────────────────

function PipelineStyles() {
  return (
    <style jsx global>{`
      @keyframes arrowFlow {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }
    `}</style>
  );
}

// ─── Main Component ─────────────────────────────────────

interface PipelineFlowProps {
  /** Optional: externally controlled active node */
  activeNode?: NodeKey | null;
  /** Called when user clicks a node */
  onNodeSelect?: (node: NodeKey) => void;
  /** Optional refresh interval in ms (default: 30000) */
  refreshInterval?: number;
}

export function PipelineFlow({
  activeNode: externalActive,
  onNodeSelect,
  refreshInterval = 30000,
}: PipelineFlowProps) {
  const [pipelineData, setPipelineData] = useState<PipelineSource | null>(null);
  const [indicadoresData, setIndicadoresData] = useState<IndicadoresData | null>(null);
  const [internalActive, setInternalActive] = useState<NodeKey | null>(null);
  const [loading, setLoading] = useState(true);

  // Active node: external override or internal state
  const activeNode = externalActive ?? internalActive;

  // Fetch pipeline data
  useEffect(() => {
    let cancelled = false;

    async function loadPipeline() {
      try {
        const res = await fetchWithTimeout('/api/dashboard/pipeline', { timeoutMs: 10000 });
        if (res.ok && !cancelled) {
          const json = await res.json();
          setPipelineData(json);
        }
      } catch (err) {
        console.error('[PipelineFlow] pipeline fetch error:', err);
      }
    }

    async function loadIndicadores() {
      try {
        const res = await fetchWithTimeout('/api/dashboard/indicadores-summary', { timeoutMs: 10000 });
        if (res.ok && !cancelled) {
          const json = await res.json();
          setIndicadoresData(json);
        }
      } catch (err) {
        console.error('[PipelineFlow] indicadores fetch error:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    // Cargar ambas APIs en paralelo
    loadPipeline();
    loadIndicadores();

    const interval = setInterval(() => {
      loadPipeline();
      loadIndicadores();
    }, refreshInterval);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [refreshInterval]);

  const handleNodeClick = useCallback(
    (key: NodeKey) => {
      setInternalActive(prev => (prev === key ? null : key));
      onNodeSelect?.(key);
    },
    [onNodeSelect],
  );

  const nodes = pipelineData ? deriveNodes(pipelineData, indicadoresData) : null;

  // Check if chain is broken (any node before current is error)
  const isChainBroken = (index: number): boolean => {
    if (!nodes) return false;
    return nodes.slice(0, index).some(n => n.status === 'error');
  };

  // Data flowing: worker running or jobs in execution
  const isDataFlowing = pipelineData?.presente?.worker?.running ?? false;

  return (
    <>
      <PipelineStyles />
      <div
        className="w-full overflow-x-auto"
        style={{ background: COLORS.bg }}
      >
        <div className="flex items-center justify-center gap-0 min-w-[600px] py-3 px-4">
          {loading || !nodes ? (
            // Skeleton
            <div className="flex items-center gap-2">
              {[0, 1, 2, 3].map(i => (
                <React.Fragment key={i}>
                  {i > 0 && (
                    <div className="w-8 sm:w-12 md:w-16 h-[2px] bg-[#1a1a2e] rounded-full" />
                  )}
                  <div
                    className="w-[130px] sm:w-[145px] md:w-[160px] h-[90px] rounded-xl animate-pulse"
                    style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}` }}
                  />
                </React.Fragment>
              ))}
            </div>
          ) : (
            nodes.map((node, i) => (
              <React.Fragment key={node.key}>
                {i > 0 && (
                  <FlowArrow
                    active={isDataFlowing}
                    broken={isChainBroken(i)}
                  />
                )}
                <PipelineNodeCard
                  node={node}
                  isActive={activeNode === node.key}
                  onClick={() => handleNodeClick(node.key)}
                />
              </React.Fragment>
            ))
          )}
        </div>

        {/* Subtle bottom border glow */}
        <div
          className="h-[1px]"
          style={{
            background: `linear-gradient(90deg, transparent, ${COLORS.border}, ${COLORS.border}, transparent)`,
          }}
        />
      </div>
    </>
  );
}

export default PipelineFlow;
