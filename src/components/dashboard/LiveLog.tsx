'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, ChevronUp, ChevronDown } from 'lucide-react';

// ═══════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════

export interface LogEvent {
  timestamp: string;  // ISO
  tipo: 'captura' | 'clasificacion' | 'produccion' | 'distribucion' | 'error' | 'sistema';
  mensaje: string;
  detalle?: string;
}

// ═══════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════

function formatTimeBolivia(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('es-BO', {
    timeZone: 'America/La_Paz',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function tipoColor(tipo: LogEvent['tipo']): string {
  switch (tipo) {
    case 'captura':
    case 'clasificacion':
    case 'produccion':
    case 'distribucion':
      return '#00ff88';
    case 'error':
      return '#ff3355';
    case 'sistema':
    default:
      return '#6b7280';
  }
}

function tipoLabel(tipo: LogEvent['tipo']): string {
  switch (tipo) {
    case 'captura':       return 'Captura';
    case 'clasificacion': return 'Clasif.';
    case 'produccion':    return 'Prod.';
    case 'distribucion':  return 'Dist.';
    case 'error':         return 'Error';
    case 'sistema':       return 'Sistema';
    default:              return 'Info';
  }
}

function truncateText(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + '...';
}

// ═══════════════════════════════════════════════════════════
// Animation variants
// ═══════════════════════════════════════════════════════════

const logVariants = {
  collapsed: {
    height: 32,
    transition: { duration: 0.25, ease: 'easeInOut' },
  },
  expanded: {
    height: 240,
    transition: { duration: 0.3, ease: 'easeOut' },
  },
};

// ═══════════════════════════════════════════════════════════
// LiveLog Component
// ═══════════════════════════════════════════════════════════

export function LiveLog() {
  const [expanded, setExpanded] = useState(false);
  const [events, setEvents] = useState<LogEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(0);

  // Fetch log events every 30 seconds
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch('/api/dashboard/log');
        if (res.ok && !cancelled) {
          const data: LogEvent[] = await res.json();
          setEvents(data);
        }
      } catch (err) {
        console.error('[LiveLog] Fetch error:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const interval = setInterval(load, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    if (expanded && events.length > prevCountRef.current) {
      requestAnimationFrame(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      });
    }
    prevCountRef.current = events.length;
  }, [events, expanded]);

  const toggleExpanded = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  // Most recent event for collapsed state
  const latestEvent = events.length > 0 ? events[0] : null;

  return (
    <motion.div
      initial="collapsed"
      animate={expanded ? 'expanded' : 'collapsed'}
      variants={logVariants}
      className="relative overflow-hidden shrink-0"
      style={{
        backgroundColor: '#080c14',
        borderTop: '1px solid #1a2744',
      }}
    >
      {/* ── Collapsed bar (always visible) ── */}
      <button
        onClick={toggleExpanded}
        className="absolute inset-0 flex items-center justify-between px-3 cursor-pointer z-10
                   hover:bg-white/[0.02] transition-colors duration-150"
        style={{ height: 32 }}
        aria-label={expanded ? 'Colapsar log' : 'Expandir log'}
      >
        {/* Left: terminal icon + last event */}
        <div className="flex items-center gap-2 min-w-0">
          <Terminal
            size={14}
            className="shrink-0"
            style={{ color: '#6b7280' }}
          />
          {loading ? (
            <span
              className="text-[11px] animate-pulse"
              style={{
                color: '#6b7280',
                fontFamily: "'Geist Mono', monospace",
              }}
            >
              Cargando eventos...
            </span>
          ) : latestEvent ? (
            <span
              className="text-[11px] truncate"
              style={{
                color: '#9ca3af',
                fontFamily: "'Geist Mono', monospace",
                letterSpacing: '0.01em',
              }}
            >
              <span style={{ color: '#6b7280' }}>
                {formatTimeBolivia(latestEvent.timestamp)}
              </span>
              {' — '}
              <span style={{ color: tipoColor(latestEvent.tipo) }}>
                {latestEvent.mensaje}
              </span>
            </span>
          ) : (
            <span
              className="text-[11px]"
              style={{
                color: '#6b7280',
                fontFamily: "'Geist Mono', monospace",
              }}
            >
              Sin eventos recientes
            </span>
          )}
        </div>

        {/* Right: toggle icon */}
        <div className="shrink-0 ml-2">
          {expanded ? (
            <ChevronDown size={14} style={{ color: '#6b7280' }} />
          ) : (
            <ChevronUp size={14} style={{ color: '#6b7280' }} />
          )}
        </div>
      </button>

      {/* ── Expanded content (below the collapsed bar) ── */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, delay: 0.05 }}
            className="absolute left-0 right-0 bottom-0"
            style={{ top: 32 }}
          >
            {/* Event list */}
            <div
              ref={scrollRef}
              className="h-full overflow-y-auto px-3 py-2 custom-scrollbar"
              style={{
                scrollbarWidth: 'thin',
                scrollbarColor: '#1a2744 #080c14',
              }}
            >
              {events.length === 0 && !loading && (
                <div className="flex items-center justify-center h-full">
                  <span className="text-[11px]" style={{ color: '#6b7280' }}>
                    Sin eventos del sistema
                  </span>
                </div>
              )}

              <div className="space-y-px">
                {events.map((event, index) => (
                  <motion.div
                    key={`${event.timestamp}-${index}`}
                    initial={index < 5 ? { opacity: 0, x: -4 } : false}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.15, delay: index * 0.02 }}
                    className="flex items-start gap-2 py-0.5"
                  >
                    {/* Timestamp */}
                    <span
                      className="text-[11px] shrink-0 tabular-nums"
                      style={{
                        color: '#6b7280',
                        fontFamily: "'Geist Mono', monospace",
                        minWidth: '42px',
                      }}
                    >
                      {formatTimeBolivia(event.timestamp)}
                    </span>

                    {/* Type badge */}
                    <span
                      className="text-[9px] font-medium uppercase tracking-wider shrink-0 px-1.5 py-px rounded"
                      style={{
                        color: tipoColor(event.tipo),
                        backgroundColor: `${tipoColor(event.tipo)}10`,
                        fontFamily: "'Geist Mono', monospace",
                        minWidth: '52px',
                        textAlign: 'center',
                      }}
                    >
                      {tipoLabel(event.tipo)}
                    </span>

                    {/* Message */}
                    <span
                      className="text-[11px] leading-snug"
                      style={{
                        color: '#d1d5db',
                        fontFamily: "'Geist Sans', sans-serif",
                      }}
                    >
                      {truncateText(event.mensaje, 120)}
                      {event.detalle && (
                        <span
                          className="ml-1.5"
                          style={{
                            color: '#4b5563',
                            fontFamily: "'Geist Mono', monospace",
                            fontSize: '10px',
                          }}
                        >
                          — {truncateText(event.detalle, 60)}
                        </span>
                      )}
                    </span>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default LiveLog;
