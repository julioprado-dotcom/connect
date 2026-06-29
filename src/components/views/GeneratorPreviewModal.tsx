'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, Printer, Download, Maximize2, Minimize2, Calendar, Hash, TrendingUp, Send, ExternalLink } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { ProductoRichContent } from '@/components/producto/ProductoRichContent';
import { ALL_PRODUCTS, PRODUCT_CATEGORIES } from '@/constants/nav';

// ─── Types ─────────────────────────────────────────────────────────

interface GeneratorPreviewModalProps {
  open: boolean;
  onClose: () => void;
  reporte: Record<string, unknown> | null;
}

// ─── Helpers ───────────────────────────────────────────────────────

function parseContenido(reporte: Record<string, unknown>): string | null {
  const raw = reporte.contenido;
  if (!raw) return null;
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return parsed.textoCompleto || parsed.texto || parsed.contenido || null;
  } catch {
    return typeof raw === 'string' ? raw : null;
  }
}

function formatResumen(resumen: string): string {
  return resumen.replace(/\\n/g, '\n');
}

function getProductMeta(tipo: string) {
  const prod = ALL_PRODUCTS.find(p => p.tipo === tipo);
  const cat = PRODUCT_CATEGORIES.find(c => c.id === prod?.categoria);
  return { prod, cat };
}

// ─── Component ─────────────────────────────────────────────────────

export function GeneratorPreviewModal({ open, onClose, reporte }: GeneratorPreviewModalProps) {
  const [expanded, setExpanded] = useState(false);
  const router = useRouter();

  if (!open || !reporte) return null;

  const tipo = (reporte.tipo as string) || '';
  const { prod, cat } = getProductMeta(tipo);
  const resumen = (reporte.resumen as string) || '';
  const contenidoCompleto = parseContenido(reporte);
  const totalMenciones = reporte.totalMenciones as number || 0;
  const sentimiento = reporte.sentimientoPromedio as number || 0;
  const fecha = reporte.fechaCreacion as string;
  const enviado = reporte.enviado as boolean;
  const fechaInicio = reporte.fechaInicio as string;
  const fechaFin = reporte.fechaFin as string;
  const temasPrincipales = reporte.temasPrincipales as string || '[]';

  // Parse temas
  let temas: string[] = [];
  try { temas = JSON.parse(temasPrincipales); } catch { temas = []; }

  const productColor = prod?.color || '#1284BA';

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow || !contenidoCompleto) return;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html><head><title>${prod?.nombre || 'Reporte'} — DECODEX</title>
      <style>
        body { font-family: 'Roboto', Arial, sans-serif; max-width: 700px; margin: 0 auto; padding: 40px 20px; color: #1A1A1A; line-height: 1.7; font-size: 13px; }
        h1 { font-family: 'Montserrat', sans-serif; font-size: 20px; border-bottom: 2px solid ${productColor}; padding-bottom: 8px; margin-bottom: 20px; }
        h2 { font-family: 'Montserrat', sans-serif; font-size: 15px; border-left: 3px solid ${productColor}; padding-left: 10px; margin: 24px 0 12px; }
        h3 { font-family: 'Montserrat', sans-serif; font-size: 13px; color: ${productColor}; text-transform: uppercase; margin: 18px 0 8px; }
        p { margin: 0 0 12px; text-align: justify; }
        strong { font-weight: 600; }
        ul, ol { padding-left: 24px; margin: 8px 0 12px; }
        li { margin-bottom: 4px; }
        blockquote { border-left: 3px solid ${productColor}; padding: 10px 14px; background: #f4f8fc; margin: 16px 0; font-style: italic; border-radius: 0 6px 6px 0; }
        hr { border: none; border-top: 1px solid #e0e0e0; margin: 24px 0; }
        table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 12px; }
        th { background: ${productColor}; color: #fff; padding: 6px 10px; text-align: left; font-size: 10px; text-transform: uppercase; }
        td { padding: 6px 10px; border-bottom: 1px solid #e0e0e0; }
        tr:nth-child(even) td { background: #f9f9f9; }
        .header { margin-bottom: 30px; }
        .header .brand { font-family: 'Montserrat', sans-serif; font-weight: 700; font-size: 24px; color: #0F2027; }
        .header .sub { font-size: 10px; color: #FF862F; letter-spacing: 2px; text-transform: uppercase; }
        .header .meta { font-size: 11px; color: #666; margin-top: 8px; }
        .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e0e0e0; font-size: 10px; color: #999; text-align: center; }
        @media print { body { padding: 20px; } }
      </style></head><body>
      <div class="header">
        <div class="brand">DECODEX</div>
        <div class="sub">Inteligencia de Medios Bolivia</div>
        <div class="meta">${prod?.nombre || 'Reporte'} · ${fecha ? new Date(fecha).toLocaleDateString('es-BO', { day: '2-digit', month: 'long', year: 'numeric' }) : ''}${totalMenciones > 0 ? ` · ${totalMenciones} menciones` : ''}</div>
      </div>
      <div id="content">${contenidoCompleto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/### (.+)/g, '<h3>$1</h3>').replace(/## (.+)/g, '<h2>$1</h2>').replace(/# (.+)/g, '<h1>$1</h1>').replace(/\n\n/g, '</p><p>').replace(/^- (.+)/gm, '<li>$1</li>').replace(/\n/g, '<br>')}</div>
      <div class="footer">DECODEX — Inteligencia de Medios Bolivia · Documento generado automaticamente</div>
      </body></html>
    `);
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); }, 500);
  };

  const handleDownloadHTML = () => {
    if (!contenidoCompleto) return;
    const html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${prod?.nombre || 'Reporte'} — DECODEX</title>
<style>body{font-family:'Roboto',Arial,sans-serif;max-width:700px;margin:0 auto;padding:40px 20px;color:#1A1A1A;line-height:1.7;font-size:14px}h1{font-family:'Montserrat',sans-serif;font-size:22px;border-bottom:2px solid ${productColor};padding-bottom:8px}h2{font-family:'Montserrat',sans-serif;font-size:16px;border-left:3px solid ${productColor};padding-left:10px;margin:24px 0 12px}h3{font-family:'Montserrat',sans-serif;font-size:13px;color:${productColor};text-transform:uppercase}p{margin:0 0 12px;text-align:justify}strong{font-weight:600}ul,ol{padding-left:24px;margin:8px 0 12px}li{margin-bottom:4px}blockquote{border-left:3px solid ${productColor};padding:10px 14px;background:#f4f8fc;margin:16px 0;font-style:italic}hr{border:none;border-top:1px solid #ddd;margin:24px 0}table{width:100%;border-collapse:collapse;margin:12px 0}th{background:${productColor};color:#fff;padding:8px 12px;text-align:left;font-size:11px;text-transform:uppercase}td{padding:8px 12px;border-bottom:1px solid #eee}tr:nth-child(even) td{background:#f9f9f9}</style></head>
<body>${contenidoCompleto}</body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(tipo || 'reporte').replace(/_/g, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className={`${expanded ? 'max-w-5xl w-[95vw]' : 'max-w-4xl w-full mx-4'} bg-card rounded-2xl shadow-2xl border border-border flex flex-col transition-all duration-300`}
        style={{ maxHeight: expanded ? '95vh' : '88vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Branded Header ── */}
        <div className="shrink-0">
          {/* Top accent bar */}
          <div className="h-1 rounded-t-2xl" style={{ background: `linear-gradient(90deg, ${productColor}, ${productColor}88)` }} />

          <div className="flex items-start justify-between px-5 py-4 gap-4">
            <div className="flex items-start gap-3 min-w-0">
              {/* Product icon */}
              {prod && (
                <div
                  className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                  style={{ backgroundColor: productColor + '18' }}
                >
                  <prod.icon className="h-5 w-5" style={{ color: productColor }} />
                </div>
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base font-bold text-foreground font-[var(--font-heading)]">
                    {prod?.nombre || tipo.replace(/_/g, ' ')}
                  </h2>
                  {cat && (
                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-medium ${cat.color}`}>
                      {cat.label}
                    </span>
                  )}
                  {enviado && (
                    <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/25 text-[9px] gap-1">
                      <Send className="h-2.5 w-2.5" /> Enviado
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground flex-wrap">
                  {fecha && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(fecha).toLocaleDateString('es-BO', {
                        day: '2-digit', month: 'long', year: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </span>
                  )}
                  {totalMenciones > 0 && (
                    <span className="flex items-center gap-1">
                      <Hash className="h-3 w-3" />
                      {totalMenciones} menciones
                    </span>
                  )}
                  {sentimiento > 0 && (
                    <span className="flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" />
                      Sentimiento: {sentimiento.toFixed(1)}/5
                    </span>
                  )}
                </div>
                {/* Date range */}
                {(fechaInicio || fechaFin) && (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Ventana: {fechaInicio ? new Date(fechaInicio).toLocaleDateString('es-BO') : '?'}
                    {' → '}
                    {fechaFin ? new Date(fechaFin).toLocaleDateString('es-BO') : '?'}
                  </p>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpanded(!expanded)}
                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                title={expanded ? 'Reducir' : 'Expandir'}
              >
                {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
              {contenidoCompleto && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { onClose(); router.push(`/reportes/${reporte.id}`); }}
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                    title="Ver completo"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handlePrint}
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                    title="Imprimir"
                  >
                    <Printer className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDownloadHTML}
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                    title="Descargar HTML"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </>
              )}
              <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Resumen bar */}
          {resumen && (
            <div className="px-5 pb-3">
              <div
                className="rounded-lg px-3.5 py-2.5 text-xs text-foreground/80 leading-relaxed"
                style={{ background: productColor + '08', borderLeft: `3px solid ${productColor}` }}
              >
                {formatResumen(resumen)}
              </div>
            </div>
          )}

          {/* Temas tags */}
          {temas.length > 0 && (
            <div className="px-5 pb-3 flex flex-wrap gap-1.5">
              {temas.slice(0, 8).map((t, i) => (
                <span
                  key={i}
                  className="text-[9px] px-2 py-0.5 rounded-full font-medium"
                  style={{ background: productColor + '12', color: productColor }}
                >
                  {typeof t === 'string' ? t : (t as Record<string, string>)?.nombre || String(t)}
                </span>
              ))}
            </div>
          )}

          <div className="border-t border-border" />
        </div>

        {/* ── Content ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 custom-scrollbar">
          {contenidoCompleto ? (
            <ProductoRichContent
              contenido={contenidoCompleto}
              tipo={tipo}
            />
          ) : resumen ? (
            <ProductoRichContent contenido={formatResumen(resumen)} tipo={tipo} />
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <p className="text-sm">Sin contenido disponible para este reporte.</p>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="shrink-0 border-t border-border px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold tracking-wider" style={{ color: productColor }}>
              DECODEX
            </span>
            <span className="text-[10px] text-muted-foreground">
              Inteligencia de Medios Bolivia
            </span>
          </div>
          {contenidoCompleto && (
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-muted-foreground">
                {contenidoCompleto.split(/\s+/).filter(Boolean).length} palabras
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}