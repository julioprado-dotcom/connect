'use client';

import React, { useState, useCallback } from 'react';
import {
  Send, Mail, MessageSquare, Phone, CheckCircle, XCircle,
  Loader2, Plus, X, RefreshCw, AlertTriangle, Trash2,
  Zap,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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

interface CanalItem {
  canal: 'email' | 'telegram' | 'whatsapp';
  conectado: boolean;
}

interface SuscriptorItem {
  id: string;
  producto: string;
  canal: string;
  destinatario: string;
  activo: boolean;
}

interface EnvioItem {
  id: string;
  producto: string;
  destinatario: string;
  canal: string;
  timestamp: string;
  estado: string;
  error?: string;
}

interface DistribucionData {
  suscriptores: SuscriptorItem[];
  canales: CanalItem[];
  ultimosEnvios: EnvioItem[];
  resumen: {
    totalSuscriptores: number;
    suscriptoresActivos: number;
    canalesConectados: number;
    enviosTotales: number;
    enviosExitosos: number;
    enviosFallidos: number;
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

const CANAL_ICONS: Record<string, React.ReactNode> = {
  email: <Mail className="w-5 h-5" />,
  telegram: <MessageSquare className="w-5 h-5" />,
  whatsapp: <Phone className="w-5 h-5" />,
};

const CANAL_LABELS: Record<string, string> = {
  email: 'Email',
  telegram: 'Telegram',
  whatsapp: 'WhatsApp',
};

function diagnosticSuggestion(error: string): { cause: string; suggestion: string } {
  const lower = error.toLowerCase();
  if (lower.includes('timeout') || lower.includes('expirado')) {
    return {
      cause: 'El servidor de destino no respondió a tiempo',
      suggestion: 'Verificar conectividad y reintentar en unos minutos',
    };
  }
  if (lower.includes('auth') || lower.includes('credencial') || lower.includes('401')) {
    return {
      cause: 'Credenciales expiradas o inválidas para el canal',
      suggestion: 'Regenerar token/API key en la configuración del canal',
    };
  }
  if (lower.includes('rate') || lower.includes('429')) {
    return {
      cause: 'Rate limit alcanzado en el canal de destino',
      suggestion: 'Esperar el período de cooldown antes de reintentar',
    };
  }
  return {
    cause: 'Error de entrega no categorizado',
    suggestion: 'Verificar logs del worker y configuración del canal',
  };
}

// ─── Component ────────────────────────────────────────────────

export function DistribucionPanel({ onClose }: { onClose?: () => void }) {
  const [data, setData] = useState<DistribucionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddSuscriptor, setShowAddSuscriptor] = useState(false);
  const [newSuscriptor, setNewSuscriptor] = useState({ producto: '', canal: 'email', destinatario: '' });
  const [diagnosticOpen, setDiagnosticOpen] = useState<string | null>(null);
  const [testingCanal, setTestingCanal] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetchWithTimeout('/api/dashboard/distribucion', { timeoutMs: 10_000 });
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

  const canales = data?.canales ?? [];
  const suscriptores = data?.suscriptores ?? [];
  const envios = data?.ultimosEnvios ?? [];

  const handleTestConnection = (canal: string) => {
    setTestingCanal(canal);
    setTimeout(() => setTestingCanal(null), 2500);
  };

  const PRODUCTO_LABELS: Record<string, string> = {
    termometro: 'El Termómetro',
    saldo_del_dia: 'Saldo del Día',
    el_foco: 'El Foco',
    el_especializado: 'El Especializado',
    el_informe_cerrado: 'El Informe Cerrado',
    ficha_legislador: 'Ficha Legislador',
    el_radar: 'El Radar',
    el_hilo: 'El Hilo',
    boletin_del_grano: 'Boletín del Grano',
    informe_mineria: 'Informe de Minería',
  };

  const readableProducto = (tipo: string) => PRODUCTO_LABELS[tipo] || tipo;

  return (
    <PanelShell title="Gestión de Distribución" icon={<Send className="w-4 h-4" />} onClose={onClose}>
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
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#00ff88' }} />
          </div>
        ) : (
          <>
            {/* ── Section A: Canales ─────────────────────── */}
            <section>
              <div className="flex items-center gap-2 mb-2.5">
                <Send size={12} style={{ color: THEME.accentCyan }} />
                <h3
                  className="text-[10px] font-bold uppercase tracking-widest"
                  style={{ color: THEME.accentCyan, fontFamily: "'JetBrains Mono', monospace" }}
                >
                  Canales
                </h3>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {canales.map((canal) => (
                  <div
                    key={canal.canal}
                    className="rounded-lg p-3 text-center"
                    style={{ background: `linear-gradient(135deg, ${canal.conectado ? 'rgba(0,255,136,0.04)' : 'rgba(255,51,85,0.04)'} 0%, rgba(13,19,33,0.8) 60%)`, border: `1px solid ${canal.conectado ? 'rgba(0,255,136,0.2)' : 'rgba(255,51,85,0.2)'}`, boxShadow: `0 0 10px ${canal.conectado ? 'rgba(0,255,136,0.06)' : 'rgba(255,51,85,0.06)'}` }}
                  >
                    <div className="flex justify-center mb-1.5" style={{ color: canal.conectado ? '#00ff88' : '#ff3355' }}>
                      {CANAL_ICONS[canal.canal]}
                    </div>
                    <p className="text-xs font-medium mb-1" style={{ color: '#ffffff' }}>
                      {CANAL_LABELS[canal.canal]}
                    </p>
                    <span className="flex items-center justify-center gap-1 text-[10px]" style={{ color: canal.conectado ? '#00ff88' : '#ff3355' }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: canal.conectado ? '#00ff88' : '#ff3355' }} />
                      {canal.conectado ? 'Conectado' : 'Desconectado'}
                    </span>
                    <button
                      className="mt-2 w-full px-2 py-1 rounded text-[10px] font-medium transition-colors"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid #1a2744', color: '#6b7280' }}
                      onClick={() => handleTestConnection(canal.canal)}
                      disabled={testingCanal === canal.canal}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#00ff88'; (e.currentTarget as HTMLButtonElement).style.color = '#00ff88'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#1a2744'; (e.currentTarget as HTMLButtonElement).style.color = '#6b7280'; }}
                    >
                      {testingCanal === canal.canal ? (
                        <span className="flex items-center justify-center gap-1">
                          <Loader2 className="w-3 h-3 animate-spin" /> Testeando…
                        </span>
                      ) : (
                        'Testear conexión'
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </section>

            {/* Glow separator */}
            <div className="h-[1px]" style={{ background: 'linear-gradient(90deg, transparent, rgba(6,182,212,0.2), transparent)' }} />
            {/* ── Section B: Suscriptores ────────────────── */}
            <section style={{ borderTop: '1px solid #1a2744' }} className="pt-4">
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2">
                  <Send size={12} style={{ color: THEME.accentCyan }} />
                  <h3
                    className="text-[10px] font-bold uppercase tracking-widest"
                    style={{ color: THEME.accentCyan, fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    Suscriptores
                  </h3>
                </div>
                <button
                  onClick={() => setShowAddSuscriptor(!showAddSuscriptor)}
                  className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium"
                  style={{ border: '1px solid #1a2744', color: '#6b7280' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#00ff88'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#00ff88'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#6b7280'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#1a2744'; }}
                >
                  <Plus className="w-3 h-3" />
                  Añadir
                </button>
              </div>

              {/* Add suscriptor form */}
              {showAddSuscriptor && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="rounded-lg p-3 mb-2.5 space-y-2"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid #1a2744' }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-medium" style={{ color: '#ffffff' }}>Nuevo suscriptor</span>
                    <button onClick={() => setShowAddSuscriptor(false)} style={{ color: '#6b7280' }}>
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  <select
                    className="w-full px-2 py-1.5 rounded-md text-[11px] outline-none"
                    style={{ background: '#080c14', border: '1px solid #1a2744', color: '#ffffff' }}
                    value={newSuscriptor.producto}
                    onChange={(e) => setNewSuscriptor({ ...newSuscriptor, producto: e.target.value })}
                  >
                    <option value="" disabled>Producto…</option>
                    {Object.entries(PRODUCTO_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <select
                      className="flex-1 px-2 py-1.5 rounded-md text-[11px] outline-none"
                      style={{ background: '#080c14', border: '1px solid #1a2744', color: '#ffffff' }}
                      value={newSuscriptor.canal}
                      onChange={(e) => setNewSuscriptor({ ...newSuscriptor, canal: e.target.value })}
                    >
                      <option value="email">Email</option>
                      <option value="telegram">Telegram</option>
                      <option value="whatsapp">WhatsApp</option>
                    </select>
                    <input
                      placeholder="destinatario@email.com"
                      className="flex-[2] px-2 py-1.5 rounded-md text-[11px] outline-none"
                      style={{ background: '#080c14', border: '1px solid #1a2744', color: '#ffffff' }}
                      value={newSuscriptor.destinatario}
                      onChange={(e) => setNewSuscriptor({ ...newSuscriptor, destinatario: e.target.value })}
                    />
                  </div>
                  <button
                    className="w-full px-2 py-1.5 rounded-md text-[11px] font-medium"
                    style={{ background: 'rgba(0,255,136,0.1)', color: '#00ff88', border: '1px solid rgba(0,255,136,0.3)' }}
                    onClick={() => {
                      setShowAddSuscriptor(false);
                      setNewSuscriptor({ producto: '', canal: 'email', destinatario: '' });
                    }}
                  >
                    Guardar suscriptor
                  </button>
                </motion.div>
              )}

              {/* Suscriptores table */}
              {suscriptores.length === 0 ? (
                <p className="text-[11px] py-3 text-center" style={{ color: '#6b7280' }}>Sin suscriptores</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr style={{ color: '#6b7280' }}>
                        <th className="text-left py-1 font-medium">Producto</th>
                        <th className="text-left py-1 font-medium">Canal</th>
                        <th className="text-left py-1 font-medium">Destinatario</th>
                        <th className="text-center py-1 font-medium">Activo</th>
                        <th className="text-right py-1 font-medium"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {suscriptores.slice(0, 8).map((s) => (
                        <tr key={s.id} style={{ borderTop: '1px solid rgba(26,26,46,0.5)' }}>
                          <td className="py-1.5 pr-2" style={{ color: '#ffffff', maxWidth: 100 }}>
                            <span className="truncate block">{readableProducto(s.producto) || s.producto}</span>
                          </td>
                          <td className="py-1.5 pr-2" style={{ color: '#6b7280' }}>
                            {CANAL_LABELS[s.canal] || s.canal}
                          </td>
                          <td className="py-1.5 pr-2" style={{ color: '#6b7280', fontFamily: 'JetBrains Mono, monospace', maxWidth: 140 }}>
                            <span className="truncate block">{s.destinatario}</span>
                          </td>
                          <td className="py-1.5 text-center">
                            <span
                              className="inline-block w-3 h-3 rounded-full cursor-pointer"
                              style={{ background: s.activo ? '#00ff88' : '#ff3355' }}
                              title={s.activo ? 'Activo — click para desactivar' : 'Inactivo — click para activar'}
                            />
                          </td>
                          <td className="py-1.5 text-right">
                            <button
                              className="transition-colors"
                              style={{ color: '#6b7280' }}
                              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#ff3355'; }}
                              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#6b7280'; }}
                              title="Eliminar"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Glow separator */}
            <div className="h-[1px]" style={{ background: 'linear-gradient(90deg, transparent, rgba(6,182,212,0.2), transparent)' }} />
            {/* ── Section C: Últimos envíos ───────────────── */}
            <section style={{ borderTop: '1px solid #1a2744' }} className="pt-4">
              <div className="flex items-center gap-2 mb-2.5">
                <Send size={12} style={{ color: THEME.accentCyan }} />
                <h3
                  className="text-[10px] font-bold uppercase tracking-widest"
                  style={{ color: THEME.accentCyan, fontFamily: "'JetBrains Mono', monospace" }}
                >
                  Últimos envíos
                </h3>
              </div>
              {envios.length === 0 ? (
                <p className="text-[11px] py-3 text-center" style={{ color: '#6b7280' }}>Sin envíos registrados</p>
              ) : (
                <div className="space-y-1 max-h-[280px] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
                  {envios.slice(0, 15).map((envio) => {
                    const isError = envio.estado === 'fallido';
                    const diag = isError ? diagnosticSuggestion(envio.error || '') : null;
                    const isOpen = diagnosticOpen === envio.id;

                    return (
                      <div key={envio.id}>
                        <div
                          className="flex items-center gap-2 px-2.5 py-2 rounded-lg transition-colors"
                          style={{ background: 'rgba(255,255,255,0.02)' }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(6,182,212,0.04)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 0 8px rgba(6,182,212,0.06)'; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.02)'; (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'; }}
                        >
                          {/* Status badge */}
                          {isError ? (
                            <XCircle className="w-3.5 h-3.5 shrink-0" style={{ color: '#ff3355' }} />
                          ) : (
                            <CheckCircle className="w-3.5 h-3.5 shrink-0" style={{ color: '#00ff88' }} />
                          )}

                          {/* Info */}
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-medium truncate" style={{ color: '#ffffff' }}>
                              {readableProducto(envio.producto) || envio.producto}
                            </p>
                            <p className="text-[10px] flex gap-2" style={{ color: '#6b7280' }}>
                              <span>{envio.destinatario}</span>
                              <span>· {CANAL_LABELS[envio.canal] || envio.canal}</span>
                            </p>
                          </div>

                          {/* Timestamp */}
                          <span className="text-[10px] shrink-0" style={{ color: '#6b7280', fontFamily: 'JetBrains Mono, monospace' }}>
                            {timeAgoHuman(envio.timestamp)}
                          </span>

                          {/* Estado badge */}
                          <span
                            className="text-[9px] px-1.5 py-0.5 rounded-full font-medium shrink-0"
                            style={{
                              background: isError ? 'rgba(255,51,85,0.1)' : 'rgba(0,255,136,0.1)',
                              color: isError ? '#ff3355' : '#00ff88',
                              border: `1px solid ${isError ? 'rgba(255,51,85,0.2)' : 'rgba(0,255,136,0.2)'}`,
                            }}
                          >
                            {isError ? 'fallido' : 'enviado'}
                          </span>

                          {/* Error actions */}
                          {isError && (
                            <div className="flex items-center gap-0.5 shrink-0">
                              <button
                                className="flex items-center justify-center rounded p-1 transition-colors"
                                style={{ color: '#ffaa00' }}
                                title="Reintentar"
                              >
                                <RefreshCw className="w-3 h-3" />
                              </button>
                              <button
                                className="flex items-center justify-center rounded p-1 transition-colors"
                                style={{ color: '#6b7280' }}
                                title="Diagnosticar"
                                onClick={() => setDiagnosticOpen(isOpen ? null : envio.id)}
                              >
                                <Zap className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Diagnostic inline expansion */}
                        <AnimatePresence>
                          {isOpen && diag && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <div
                                className="mx-2.5 mb-1.5 rounded-lg p-2.5 space-y-1.5"
                                style={{ background: 'rgba(255,51,85,0.05)', border: '1px solid rgba(255,51,85,0.15)' }}
                              >
                                <div className="flex items-center gap-1.5">
                                  <AlertTriangle className="w-3 h-3" style={{ color: '#ff3355' }} />
                                  <span className="text-[10px] font-medium" style={{ color: '#ff3355' }}>
                                    Diagnóstico
                                  </span>
                                </div>
                                <p className="text-[10px]" style={{ color: '#ffffff' }}>
                                  <span style={{ color: '#ffaa00' }}>Causa probable:</span> {diag.cause}
                                </p>
                                <p className="text-[10px]" style={{ color: '#ffffff' }}>
                                  <span style={{ color: '#00ff88' }}>Sugerencia:</span> {diag.suggestion}
                                </p>
                                <button
                                  className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium mt-1"
                                  style={{ background: 'rgba(255,170,0,0.1)', color: '#ffaa00', border: '1px solid rgba(255,170,0,0.2)' }}
                                >
                                  <RefreshCw className="w-3 h-3" />
                                  Reintentar envío
                                </button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Summary */}
              {data && (
                <div
                  className="flex items-center gap-3 px-3 py-2 rounded-lg mt-2.5"
                  style={{ background: `linear-gradient(135deg, rgba(6,182,212,0.04) 0%, rgba(13,19,33,0.8) 60%)`, border: '1px solid rgba(6,182,212,0.15)', boxShadow: '0 0 10px rgba(6,182,212,0.05)' }}
                >
                  <span className="text-[10px]" style={{ color: '#00ff88' }}>
                    ✓ {data.resumen.enviosExitosos} exitosos
                  </span>
                  <span className="text-[10px]" style={{ color: '#ff3355' }}>
                    ✗ {data.resumen.enviosFallidos} fallidos
                  </span>
                  <span className="text-[10px] ml-auto" style={{ color: '#6b7280' }}>
                    {data.resumen.totalSuscriptores} suscriptores · {data.resumen.canalesConectados} canales
                  </span>
                </div>
              )}
            </section>
          </>
        )}
      </div>
      </div>
    </PanelShell>
  );
}
