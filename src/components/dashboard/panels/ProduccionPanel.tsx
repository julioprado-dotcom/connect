'use client';

import React, { useState, useCallback } from 'react';
import {
  FileText, CheckCircle, Clock, XCircle, ChevronDown,
  Loader2, Inbox, Play, Eye,
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

interface ProductoItem {
  tipo: string;
  tipoBoletin: string | null;
  nombre: string;
  tipoProducto: 'premium' | 'gratuito';
  frecuencia: 'diario' | 'semanal' | 'bajo_demanda';
  estado: 'generado' | 'en_elaboracion' | 'pendiente' | 'error' | 'sin_datos';
  ultimaEdicion: string | null;
  mencionesUsadas: number;
  totalEdiciones: number;
  edicionesConMenciones: number;
  edicionesSinMenciones: number;
  previewContenido: string | null;
  historial: { fecha: string; estado: string; menciones: number }[];
}

interface ProductosData {
  productos: ProductoItem[];
  resumen: {
    total: number;
    generados: number;
    enElaboracion: number;
    pendientes: number;
    errores: number;
    sinDatos: number;
    premium: number;
    gratuitos: number;
  };
}

// ─── Helpers ──────────────────────────────────────────────────

function EstadoIcon({ estado }: { estado: string }) {
  switch (estado) {
    case 'generado':
      return <CheckCircle className="w-4 h-4" style={{ color: '#00ff88' }} />;
    case 'en_elaboracion':
      return <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#3b82f6' }} />;
    case 'pendiente':
      return <Clock className="w-4 h-4" style={{ color: '#ffaa00' }} />;
    case 'error':
      return <XCircle className="w-4 h-4" style={{ color: '#ff3355' }} />;
    default:
      return <XCircle className="w-4 h-4" style={{ color: '#6b7280' }} />;
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br/>');
}

// ─── Product Row ──────────────────────────────────────────────

function ProductRow({ product }: { product: ProductoItem }) {
  const [expanded, setExpanded] = useState(false);
  const [generando, setGenerando] = useState(false);

  const handleGenerate = () => {
    setGenerando(true);
    setTimeout(() => setGenerando(false), 3000);
  };

  // Construir contenido del iframe preview con datos reales
  const previewSrcDoc = product.previewContenido
    ? `<!DOCTYPE html><html><body style="margin:0;padding:10px;font-family:'Inter',system-ui,sans-serif;background:#080c14;color:#e0e0e0;font-size:11px;line-height:1.6;">
        <p style="color:#00ff88;font-weight:bold;font-size:12px;margin:0 0 6px 0;">${product.nombre}</p>
        ${escapeHtml(product.previewContenido)}
      </body></html>`
    : `<!DOCTYPE html><html><body style="margin:0;padding:10px;font-family:'Inter',system-ui,sans-serif;background:#080c14;color:#6b7280;font-size:11px;display:flex;align-items:center;justify-content:center;height:100%;box-sizing:border-box;">
        <p>Sin contenido generado para este producto.</p>
      </body></html>`;

  return (
    <div style={{ borderBottom: '1px solid rgba(26,26,46,0.5)' }}>
      <div
        className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer transition-colors"
        onClick={() => setExpanded(!expanded)}
        onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(6,182,212,0.04)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 0 10px rgba(6,182,212,0.06)'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'; }}
      >
        {/* Status icon */}
        <EstadoIcon estado={product.estado} />

        {/* Name + badge */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold truncate" style={{ color: '#ffffff' }}>
              {product.nombre}
            </span>
            <span
              className="text-[9px] font-medium px-1.5 py-0.5 rounded-full shrink-0"
              style={{
                background: product.tipoProducto === 'premium' ? 'rgba(255,170,0,0.15)' : 'rgba(255,255,255,0.05)',
                color: product.tipoProducto === 'premium' ? '#ffaa00' : '#6b7280',
                border: `1px solid ${product.tipoProducto === 'premium' ? 'rgba(255,170,0,0.3)' : 'rgba(255,255,255,0.08)'}`,
              }}
            >
              {product.tipoProducto}
            </span>
          </div>
          <div className="flex gap-2 mt-0.5">
            {product.ultimaEdicion && (
              <span className="text-[11px]" style={{ color: '#6b7280', fontFamily: 'JetBrains Mono, monospace' }}>
                {product.ultimaEdicion}
              </span>
            )}
            {product.mencionesUsadas > 0 && (
              <span className="text-[11px]" style={{ color: '#6b7280' }}>
                {product.mencionesUsadas} menciones
              </span>
            )}
          </div>
        </div>

        {/* Generate button */}
        <button
          className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium shrink-0 transition-colors"
          style={{ border: '1px solid rgba(0,255,136,0.3)', color: '#00ff88' }}
          onClick={(e) => { e.stopPropagation(); handleGenerate(); }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,255,136,0.1)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
          disabled={generando}
        >
          {generando ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Play className="w-3 h-3" />
          )}
          {generando ? 'Generando...' : 'Generar ahora'}
        </button>

        {/* Chevron */}
        <motion.span
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.15 }}
          style={{ color: '#6b7280' }}
        >
          <ChevronDown className="w-4 h-4 shrink-0" />
        </motion.span>
      </div>

      {/* ── Expanded content ─────────────────────────────── */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 pt-1 space-y-2.5" style={{ background: `linear-gradient(135deg, rgba(6,182,212,0.03) 0%, rgba(13,19,33,0.5) 100%)` }}>
              {/* Edition history — REAL data */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: THEME.accentCyan, fontFamily: "'JetBrains Mono', monospace" }}>
                  Historial de ediciones
                  {product.totalEdiciones > 0 && (
                    <span style={{ color: '#4b5563' }}> ({product.totalEdiciones} total, {product.edicionesConMenciones} con datos)</span>
                  )}
                </p>
                {product.historial.length > 0 ? (
                  <div className="space-y-0.5">
                    {product.historial.map((ed, i) => (
                      <div key={i} className="flex items-center gap-2 text-[10px]">
                        <span style={{ color: '#6b7280', fontFamily: 'JetBrains Mono, monospace', minWidth: 100 }}>
                          {ed.fecha}
                        </span>
                        <EstadoIcon estado={ed.estado} />
                        <span style={{ color: ed.estado === 'generado' ? '#00ff88' : ed.estado === 'en_elaboracion' ? '#3b82f6' : ed.estado === 'error' ? '#ff3355' : '#ffaa00' }}>
                          {ed.estado}
                        </span>
                        <span style={{ color: '#4b5563' }}>
                          {ed.menciones > 0 ? `${ed.menciones} menc.` : '0 menc.'}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px]" style={{ color: '#4b5563' }}>Sin ediciones registradas</p>
                )}
              </div>

              {/* HTML preview — REAL content */}
              <div>
                <div className="flex items-center gap-1 mb-1.5">
                  <Eye className="w-3 h-3" style={{ color: '#6b7280' }} />
                  <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: THEME.accentCyan, fontFamily: "'JetBrains Mono', monospace" }}>
                    Vista previa
                    {product.previewContenido && (
                      <span style={{ color: '#00ff88', marginLeft: 4 }}>● con datos</span>
                    )}
                  </p>
                </div>
                <div
                  className="rounded-md overflow-hidden"
                  style={{ background: '#080c14', border: '1px solid #1a2744', maxHeight: 280 }}
                >
                  <iframe
                    srcDoc={previewSrcDoc}
                    className="w-full"
                    style={{ height: product.previewContenido ? 260 : 80, border: 'none' }}
                    title={`Preview: ${product.nombre}`}
                  />
                </div>
              </div>

              {/* Edit button */}
              <button
                className="w-full px-3 py-1.5 rounded-md text-[11px] font-medium transition-colors text-center"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid #1a2744', color: '#ffffff' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#00ff88'; (e.currentTarget as HTMLButtonElement).style.color = '#00ff88'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#1a2744'; (e.currentTarget as HTMLButtonElement).style.color = '#ffffff'; }}
              >
                Editar antes de enviar
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────

export function ProduccionPanel({ onClose }: { onClose?: () => void }) {
  const [data, setData] = useState<ProductosData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generandoTodos, setGenerandoTodos] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetchWithTimeout('/api/dashboard/productos', { timeoutMs: 10_000 });
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

  const productos = data?.productos ?? [];

  const handleGenerateAll = () => {
    setGenerandoTodos(true);
    setTimeout(() => setGenerandoTodos(false), 5000);
  };

  return (
    <PanelShell title="Gestión de Producción" icon={<FileText className="w-4 h-4" />} onClose={onClose}>
      <div className="p-4 space-y-3 relative" style={{ background: THEME.bg }}>
        {/* Scan line overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `repeating-linear-gradient(0deg, transparent, transparent 3px, ${THEME.scanLine} 3px, ${THEME.scanLine} 4px)`,
          }}
        />
        <div className="relative z-10 space-y-3">
          {/* ── Header action ─────────────────────────────── */}
          <div className="flex items-center justify-between">
            <span
              className="text-[10px] uppercase tracking-widest"
              style={{ color: THEME.textMuted, fontFamily: "'JetBrains Mono', monospace" }}
            >
              {productos.length} productos
            </span>
            <button
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium transition-colors"
              style={{ border: '1px solid rgba(0,255,136,0.3)', color: '#00ff88' }}
              onClick={handleGenerateAll}
              disabled={generandoTodos}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,255,136,0.1)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
            >
              {generandoTodos ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Play className="w-3 h-3" />
              )}
              Generar todos
            </button>
          </div>

          {/* ── Product list ───────────────────────────────── */}
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#00ff88' }} />
            </div>
          ) : productos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10" style={{ color: '#6b7280' }}>
              <Inbox className="w-5 h-5 mb-1.5 opacity-40" />
              <span className="text-xs">Sin productos configurados</span>
            </div>
          ) : (
            <div className="max-h-[400px] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
              {productos.slice(0, 10).map((p) => (
                <ProductRow key={p.tipo} product={p} />
              ))}
            </div>
          )}

          {/* ── Summary bar ────────────────────────────────── */}
          {data && (
            <div
              className="flex items-center gap-3 px-3 py-2 rounded-lg"
              style={{ background: `linear-gradient(135deg, rgba(6,182,212,0.04) 0%, rgba(13,19,33,0.8) 60%)`, border: '1px solid rgba(6,182,212,0.15)', boxShadow: '0 0 10px rgba(6,182,212,0.05)' }}
            >
              <span className="text-[10px] flex items-center gap-1" style={{ color: '#00ff88' }}>
                <CheckCircle className="w-3 h-3" /> {data.resumen.generados}
              </span>
              <span className="text-[10px] flex items-center gap-1" style={{ color: '#3b82f6' }}>
                <Loader2 className="w-3 h-3" /> {data.resumen.enElaboracion}
              </span>
              <span className="text-[10px] flex items-center gap-1" style={{ color: '#ffaa00' }}>
                <Clock className="w-3 h-3" /> {data.resumen.pendientes}
              </span>
              <span className="text-[10px] flex items-center gap-1" style={{ color: '#ff3355' }}>
                <XCircle className="w-3 h-3" /> {data.resumen.errores}
              </span>
              <span className="text-[10px] ml-auto" style={{ color: '#6b7280' }}>
                {data.resumen.premium} premium · {data.resumen.gratuitos} gratuitos
              </span>
            </div>
          )}
        </div>
      </div>
    </PanelShell>
  );
}
