'use client';

import React from 'react';
import {
  FileText, Clock, Loader2, Play, X, CheckCircle2, AlertTriangle, Zap,
} from 'lucide-react';
import { ALL_PRODUCTS } from '@/constants/nav';
import { statusColor, statusBg, statusBorder, statusToken } from '@/constants/colors';
import type { LucideIcon } from 'lucide-react';
import type {
  CatalogProduct,
  EjeItem,
  PersonaItem,
  UltimoProduct,
  Notification,
} from './ProduccionView.types';

// ═══════════════════════════════════════════════════════════════
// Category helpers
// ═══════════════════════════════════════════════════════════════

export const CATEGORY_ORDER = ['premium', 'premium_mid', 'premium_alta', 'gratuito'];

export const CATEGORY_COLORS: Record<string, string> = {
  premium: '#f59e0b',
  premium_mid: '#a78bfa',
  premium_alta: '#f43f5e',
  gratuito: '#10b981',
};

export const CATEGORY_LABELS: Record<string, string> = {
  premium: 'Premium',
  premium_mid: 'Premium Mid',
  premium_alta: 'Premium Alta',
  gratuito: 'Gratuito',
};

export const CATEGORY_BG: Record<string, string> = {
  premium: 'rgba(245,158,11,0.06)',
  premium_mid: 'rgba(167,139,250,0.06)',
  premium_alta: 'rgba(244,63,94,0.06)',
  gratuito: 'rgba(16,185,129,0.06)',
};

// ═══════════════════════════════════════════════════════════════
// getProductMeta helper
// ═══════════════════════════════════════════════════════════════

export function getProductMeta(tipo: string): { icon: LucideIcon; color: string } {
  const found = ALL_PRODUCTS.find((p) => p.tipo === tipo);
  return found
    ? { icon: found.icon, color: found.color }
    : { icon: FileText, color: '#64748b' };
}

// ═══════════════════════════════════════════════════════════════
// InlineToast
// ═══════════════════════════════════════════════════════════════

export function InlineToast({ notif, onDismiss }: { notif: Notification; onDismiss: () => void }) {
  const isError = notif.tipo === 'error';
  const isWarning = notif.tipo === 'warning';
  const statusKey = isError ? 'error' : isWarning ? 'warning' : 'ok';
  const t = statusToken(statusKey);
  const Icon = isError ? AlertTriangle : isWarning ? Zap : CheckCircle2;

  return (
    <div
      className="flex items-start gap-2 px-3 py-2.5 rounded-md animate-in fade-in slide-in-from-top-1 duration-200"
      style={{
        backgroundColor: t.bg,
        border: `1px solid ${t.border}`,
      }}
    >
      <Icon className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: t.color }} />
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-mono" style={{ color: t.color }}>
          {notif.message}
        </p>
        {notif.detail && (
          <p className="text-[9px] font-mono text-slate-500 mt-0.5 truncate">
            {notif.detail}
          </p>
        )}
      </div>
      <button
        onClick={onDismiss}
        className="text-slate-600 hover:text-slate-400 transition-colors shrink-0"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ProductMiniCard
// ═══════════════════════════════════════════════════════════════

export function ProductMiniCard({
  product,
  onGenerate,
  isGenerating,
}: {
  product: CatalogProduct;
  onGenerate: (tipo: string) => void;
  isGenerating: boolean;
}) {
  const { icon: ProductIcon, color } = getProductMeta(product.tipo);
  const isOperativo = product.estado === 'operativo';
  const needsEje = product.tipo === 'EL_FOCO';
  const needsPersona = product.tipo === 'FICHA_LEGISLADOR';
  const catColor = CATEGORY_COLORS[product.categoria] || '#64748b';
  // Show data state in badge (from API), fall back to operational state
  const badgeEstado = product.estadoDatos || product.estado;
  const isBadgeGenerado = badgeEstado === 'generado';

  return (
    <div
      className="rounded-md px-3 py-2.5 transition-all duration-200 group"
      style={{
        backgroundColor: 'rgba(255,255,255,0.015)',
        border: '1px solid rgba(255,255,255,0.04)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = `${catColor}22`;
        e.currentTarget.style.backgroundColor = `${catColor}08`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.04)';
        e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.015)';
      }}
    >
      {/* Header row */}
      <div className="flex items-center gap-2 mb-1.5">
        <span className="shrink-0" style={{ color: `${color}90` }}>
          <ProductIcon className="w-3.5 h-3.5" />
        </span>
        <span className="text-[10px] font-mono text-slate-300 truncate flex-1">
          {product.nombre}
        </span>
      </div>

      {/* Estado badge — shows data state (generado/sin_datos) */}
      <div className="flex items-center gap-1.5 mb-2">
        <span
          className="text-[8px] font-bold uppercase font-mono px-1.5 py-0.5 rounded"
          style={{
            color: statusColor(isBadgeGenerado ? 'ok' : 'idle'),
            backgroundColor: statusBg(isBadgeGenerado ? 'ok' : 'idle'),
            border: `1px solid ${statusBorder(isBadgeGenerado ? 'ok' : 'idle')}`,
          }}
        >
          {badgeEstado}
        </span>
        {product.ultimaEdicion && (
          <span className="text-[8px] font-mono text-slate-600 flex items-center gap-0.5">
            <Clock className="w-2.5 h-2.5" />
            {product.ultimaEdicion}
          </span>
        )}
        {(product.mencionesUsadas !== undefined && product.mencionesUsadas > 0) && (
          <span className="text-[7px] font-mono text-slate-600">
            {product.mencionesUsadas} menc.
          </span>
        )}
      </div>

      {/* Generate button */}
      {isOperativo ? (
        <button
          onClick={() => onGenerate(product.tipo)}
          disabled={isGenerating}
          className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-[9px] font-bold uppercase font-mono transition-all duration-200"
          style={{
            color: isGenerating ? '#64748b' : '#06b6d4',
            backgroundColor: isGenerating ? 'rgba(100,116,139,0.06)' : 'rgba(6,182,212,0.08)',
            border: `1px solid ${isGenerating ? 'rgba(100,116,139,0.1)' : 'rgba(6,182,212,0.15)'}`,
            cursor: isGenerating ? 'not-allowed' : 'pointer',
          }}
          onMouseEnter={(e) => {
            if (!isGenerating) {
              e.currentTarget.style.backgroundColor = 'rgba(6,182,212,0.15)';
              e.currentTarget.style.borderColor = 'rgba(6,182,212,0.3)';
            }
          }}
          onMouseLeave={(e) => {
            if (!isGenerating) {
              e.currentTarget.style.backgroundColor = 'rgba(6,182,212,0.08)';
              e.currentTarget.style.borderColor = 'rgba(6,182,212,0.15)';
            }
          }}
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin" />
              Generando...
            </>
          ) : (
            <>
              <Zap className="w-3 h-3" />
              Generar
              {needsEje && <span className="text-[7px] text-amber-400/70 ml-0.5">*eje</span>}
              {needsPersona && <span className="text-[7px] text-amber-400/70 ml-0.5">*persona</span>}
            </>
          )}
        </button>
      ) : (
        <div className="text-[8px] font-mono text-slate-600 text-center py-1.5 rounded"
          style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}
        >
          No disponible
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ParamModal
// ═══════════════════════════════════════════════════════════════

export function ParamModal({
  tipo,
  ejes,
  personas,
  loading,
  selectedEje,
  setSelectedEje,
  selectedPersona,
  setSelectedPersona,
  onConfirm,
  onCancel,
}: {
  tipo: string;
  ejes: EjeItem[];
  personas: PersonaItem[];
  loading: boolean;
  selectedEje: string;
  setSelectedEje: (v: string) => void;
  selectedPersona: string;
  setSelectedPersona: (v: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const isFoco = tipo === 'EL_FOCO';
  const items = isFoco ? ejes : personas;
  const selected = isFoco ? selectedEje : selectedPersona;
  const setSelected = isFoco ? setSelectedEje : setSelectedPersona;

  const { icon: ProductIcon, color } = getProductMeta(tipo);
  const productName = ALL_PRODUCTS.find((p) => p.tipo === tipo)?.nombre || tipo;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
      />
      {/* Modal */}
      <div
        className="relative rounded-lg w-full max-w-sm overflow-hidden"
        style={{
          background: 'rgba(8, 8, 8, 0.95)',
          border: '1px solid rgba(6, 182, 212, 0.15)',
          boxShadow: '0 0 40px rgba(6, 182, 212, 0.06)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-2 px-4 py-3 border-b"
          style={{ borderColor: 'rgba(6, 182, 212, 0.08)' }}
        >
          <span style={{ color }}>
            <ProductIcon className="w-4 h-4" />
          </span>
          <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-cyan-400/90 font-mono">
            Generar {productName}
          </span>
          <button
            onClick={onCancel}
            className="ml-auto text-slate-500 hover:text-slate-300 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3">
          <p className="text-[10px] font-mono text-slate-400">
            Selecciona {isFoco ? 'un eje tematico' : 'una persona'} para generar el producto:
          </p>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-4 text-slate-500 text-[10px] font-mono">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Cargando opciones...
            </div>
          ) : (
            <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-1">
              {items.length === 0 ? (
                <p className="text-[10px] font-mono text-slate-600 text-center py-3">
                  No hay opciones disponibles
                </p>
              ) : (
                items.map((item) => {
                  const key = isFoco ? (item as EjeItem).slug : (item as PersonaItem).id;
                  const label = isFoco ? (item as EjeItem).nombre : (item as PersonaItem).nombre;
                  const isSelected = selected === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setSelected(key)}
                      className="w-full text-left px-3 py-2 rounded text-[10px] font-mono transition-all duration-150"
                      style={{
                        color: isSelected ? '#06b6d4' : '#94a3b8',
                        backgroundColor: isSelected ? 'rgba(6,182,212,0.08)' : 'transparent',
                        border: `1px solid ${isSelected ? 'rgba(6,182,212,0.2)' : 'rgba(255,255,255,0.03)'}`,
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }
                      }}
                    >
                      {label}
                      {!isFoco && (item as PersonaItem).tipo && (
                        <span className="text-[8px] text-slate-600 ml-1.5">
                          ({(item as PersonaItem).tipo})
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t" style={{ borderColor: 'rgba(6,182,212,0.08)' }}>
          <button
            onClick={onCancel}
            className="px-3 py-1.5 rounded text-[9px] font-bold uppercase font-mono text-slate-400 transition-colors"
            style={{
              backgroundColor: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={!selected || loading}
            className="px-3 py-1.5 rounded text-[9px] font-bold uppercase font-mono flex items-center gap-1.5 transition-all duration-200"
            style={{
              color: !selected || loading ? '#475569' : '#020617',
              backgroundColor: !selected || loading ? 'rgba(100,116,139,0.1)' : '#06b6d4',
              border: `1px solid ${!selected || loading ? 'rgba(100,116,139,0.15)' : '#06b6d4'}`,
              cursor: !selected || loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                Cargando...
              </>
            ) : (
              <>
                <Play className="w-3 h-3" />
                Generar
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ContentPreview — Vista previa del contenido del reporte
// ═══════════════════════════════════════════════════════════════

/**
 * Extrae texto legible del campo `contenido` de un Reporte.
 * El campo puede ser: string plano, objeto JSON con textoCompleto, o null.
 */
function extractContenidoText(contenido: unknown): string | null {
  if (!contenido) return null;
  if (typeof contenido === 'string') return contenido.length > 0 ? contenido : null;
  if (typeof contenido === 'object' && contenido !== null) {
    const obj = contenido as Record<string, unknown>;
    // Priorizar campos de texto del boletín generado
    const texto = obj.textoCompleto || obj.texto || obj.cuerpo || obj.body || null;
    if (typeof texto === 'string' && texto.length > 0) return texto;
    // Fallback: intentar stringify el objeto
    try {
      const str = JSON.stringify(contenido, null, 2);
      return str && str !== '{}' ? str : null;
    } catch {
      return null;
    }
  }
  return null;
}

export function ContentPreview({
  data,
  loading,
}: {
  data: UltimoProduct | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-slate-600 text-[10px] font-mono justify-center">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Cargando contenido...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="py-6 text-slate-600 text-[10px] font-mono text-center space-y-1">
        <FileText className="w-5 h-5 mx-auto text-slate-700" />
        <p>Producto no generado aun</p>
        <p className="text-[8px] text-slate-700">Usa el boton &quot;Generar&quot; en el catalogo para crear el primer reporte</p>
      </div>
    );
  }

  // Extraer texto del contenido (puede ser objeto JSON o string)
  const contenidoText = extractContenidoText(data.contenido);
  // Safely format date
  const fechaStr = data.fechaCreacion
    ? new Date(data.fechaCreacion).toLocaleString('es-BO', { dateStyle: 'short', timeStyle: 'short' })
    : null;
  const periodoStr = [
    data.fechaInicio ? `Desde: ${new Date(data.fechaInicio).toLocaleDateString('es-BO', { dateStyle: 'short' })}` : '',
    data.fechaFin ? `Hasta: ${new Date(data.fechaFin).toLocaleDateString('es-BO', { dateStyle: 'short' })}` : '',
  ].filter(Boolean).join(' | ');

  return (
    <div className="space-y-3 pt-2 border-t" style={{ borderColor: 'rgba(6,182,212,0.08)' }}>
      {/* Header: ID + fecha */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-mono text-slate-400">
          ID: <span className="text-cyan-500/70">{data.id ? data.id.slice(0, 12) : '—'}...</span>
        </p>
        {fechaStr && (
          <p className="text-[9px] font-mono text-slate-600 flex items-center gap-1">
            <Clock className="w-2.5 h-2.5" />
            {fechaStr}
          </p>
        )}
      </div>

      {/* Tipo + menciones */}
      <div className="flex items-center gap-2">
        <span className="text-[8px] font-bold uppercase font-mono px-1.5 py-0.5 rounded"
          style={{
            color: '#a78bfa',
            backgroundColor: 'rgba(167,139,250,0.08)',
            border: '1px solid rgba(167,139,250,0.15)',
          }}
        >
          {data.tipo || 'N/A'}
        </span>
        {data.totalMenciones != null && data.totalMenciones > 0 && (
          <span className="text-[8px] font-mono text-slate-600">
            {data.totalMenciones} menciones
          </span>
        )}
      </div>

      {/* Periodo */}
      {periodoStr && (
        <p className="text-[9px] font-mono text-slate-600">{periodoStr}</p>
      )}

      {/* Resumen */}
      {data.resumen && (
        <div className="rounded px-3 py-2" style={{
          backgroundColor: 'rgba(245,158,11,0.04)',
          border: '1px solid rgba(245,158,11,0.08)',
        }}>
          <p className="text-[9px] font-bold uppercase font-mono text-amber-500/70 mb-1">Resumen</p>
          <p className="text-[10px] font-mono text-slate-400 leading-relaxed">
            {data.resumen}
          </p>
        </div>
      )}

      {/* Temas principales */}
      {data.temasPrincipales && (
        <div className="rounded px-3 py-2" style={{
          backgroundColor: 'rgba(6,182,212,0.04)',
          border: '1px solid rgba(6,182,212,0.08)',
        }}>
          <p className="text-[9px] font-bold uppercase font-mono text-cyan-500/70 mb-1">Temas principales</p>
          <p className="text-[10px] font-mono text-slate-400 leading-relaxed">
            {data.temasPrincipales}
          </p>
        </div>
      )}

      {/* Contenido principal */}
      {contenidoText && (
        <div
          className="text-[10px] font-mono text-slate-400 leading-relaxed max-h-80 overflow-y-auto custom-scrollbar whitespace-pre-wrap"
          style={{ backgroundColor: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '4px' }}
        >
          <pre className="p-3 text-[9px] leading-relaxed">{contenidoText}</pre>
        </div>
      )}

      {/* Si no hay contenido pero sí hay reporte (vacío) */}
      {!contenidoText && !data.resumen && (
        <div className="py-4 text-slate-600 text-[10px] font-mono text-center">
          Reporte generado sin contenido de texto
        </div>
      )}
    </div>
  );
}
