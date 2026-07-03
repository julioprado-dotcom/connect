'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft, Printer, Download, Calendar, Hash, TrendingUp, Send, Loader2,
} from 'lucide-react';
import { ProductoRichContent } from '@/components/producto/ProductoRichContent';
import { ALL_PRODUCTS, PRODUCT_CATEGORIES } from '@/constants/nav';

interface ReporteData {
  id: string;
  tipo: string;
  contenido: string;
  resumen: string;
  totalMenciones: number;
  sentimientoPromedio: number;
  fechaCreacion: string;
  fechaInicio: string;
  fechaFin: string;
  temasPrincipales: string;
  enviado: boolean;
  Persona?: { nombre: string; partidoSigla: string } | null;
}

function parseContenido(reporte: ReporteData): string | null {
  const raw = reporte.contenido;
  if (!raw) return null;
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return parsed.textoCompleto || parsed.texto || parsed.contenido || null;
  } catch {
    return typeof raw === 'string' ? raw : null;
  }
}

export default function ReportePage() {
  const params = useParams();
  const router = useRouter();
  const [reporte, setReporte] = useState<ReporteData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!params.id) return;
    (async () => {
      try {
        const res = await fetch(`/api/reportes/${params.id}`);
        if (res.ok) {
          const data = await res.json();
          setReporte(data);
        }
      } catch { /* silent */ }
      finally { setLoading(false); }
    })();
  }, [params.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!reporte) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-sm text-muted-foreground">Reporte no encontrado</p>
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-3.5 w-3.5 mr-1.5" /> Volver
        </Button>
      </div>
    );
  }

  const tipo = reporte.tipo;
  const prod = ALL_PRODUCTS.find(p => p.tipo === tipo);
  const cat = PRODUCT_CATEGORIES.find(c => c.id === prod?.categoria);
  const productColor = prod?.color || '#1284BA';
  const contenido = parseContenido(reporte);

  let temas: string[] = [];
  try { temas = JSON.parse(reporte.temasPrincipales || '[]'); } catch { /* */ }

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadHTML = () => {
    if (!contenido) return;
    const html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><title>${prod?.nombre || 'Reporte'} — DECODEX</title>
<style>body{font-family:'Roboto',Arial,sans-serif;max-width:700px;margin:0 auto;padding:40px 20px;color:#1A1A1A;line-height:1.7;font-size:14px}h1{font-family:'Montserrat',sans-serif;font-size:22px;border-bottom:2px solid ${productColor};padding-bottom:8px}h2{font-family:'Montserrat',sans-serif;font-size:16px;border-left:3px solid ${productColor};padding-left:10px;margin:24px 0 12px}h3{font-family:'Montserrat',sans-serif;font-size:13px;color:${productColor};text-transform:uppercase}p{margin:0 0 12px;text-align:justify}strong{font-weight:600}ul,ol{padding-left:24px;margin:8px 0 12px}li{margin-bottom:4px}blockquote{border-left:3px solid ${productColor};padding:10px 14px;background:#f4f8fc;margin:16px 0;font-style:italic}hr{border:none;border-top:1px solid #ddd;margin:24px 0}table{width:100%;border-collapse:collapse;margin:12px 0}th{background:${productColor};color:#fff;padding:8px 12px;text-align:left;font-size:11px;text-transform:uppercase}td{padding:8px 12px;border-bottom:1px solid #eee}tr:nth-child(even) td{background:#f9f9f9}</style></head>
<body>${contenido}</body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(tipo || 'reporte').replace(/_/g, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* ── Top Bar ── */}
      <div className="sticky top-0 z-30 bg-card/80 backdrop-blur-md border-b border-border print:hidden">
        <div className="max-w-4xl mx-auto px-4 h-12 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => router.back()} className="text-xs gap-1.5">
            <ArrowLeft className="h-3.5 w-3.5" /> Volver
          </Button>
          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="sm" onClick={handlePrint} className="text-xs gap-1.5">
              <Printer className="h-3.5 w-3.5" /> Imprimir
            </Button>
            <Button variant="ghost" size="sm" onClick={handleDownloadHTML} className="text-xs gap-1.5">
              <Download className="h-3.5 w-3.5" /> Descargar
            </Button>
          </div>
        </div>
      </div>

      {/* ── Product Header ── */}
      <div className="max-w-4xl mx-auto px-4 pt-8 pb-6 print:pt-4 print:pb-2">
        {/* Brand */}
        <div className="flex items-center gap-3 mb-6">
          {prod && (
            <div
              className="h-12 w-12 rounded-2xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: productColor + '15' }}
            >
              <prod.icon className="h-6 w-6" style={{ color: productColor }} />
            </div>
          )}
          <div>
            <h1 className="text-xl font-bold text-foreground font-[var(--font-heading)]">
              {prod?.nombre || tipo.replace(/_/g, ' ')}
            </h1>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              DECODEX — Inteligencia de Medios Bolivia
            </p>
          </div>
        </div>

        {/* Accent bar */}
        <div className="h-0.5 rounded-full mb-6" style={{ background: `linear-gradient(90deg, ${productColor}, transparent)` }} />

        {/* Metadata grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <MetaItem
            icon={<Calendar className="h-3.5 w-3.5" />}
            label="Fecha"
            value={new Date(reporte.fechaCreacion).toLocaleDateString('es-BO', { day: '2-digit', month: 'long', year: 'numeric' })}
          />
          <MetaItem
            icon={<Hash className="h-3.5 w-3.5" />}
            label="Menciones"
            value={String(reporte.totalMenciones || '—')}
          />
          <MetaItem
            icon={<TrendingUp className="h-3.5 w-3.5" />}
            label="Sentimiento"
            value={reporte.sentimientoPromedio > 0 ? `${reporte.sentimientoPromedio.toFixed(1)}/5` : '—'}
          />
          <MetaItem
            icon={<Send className="h-3.5 w-3.5" />}
            label="Estado"
            value={reporte.enviado ? 'Enviado' : 'Borrador'}
            valueClass={reporte.enviado ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}
          />
        </div>

        {/* Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          {cat && (
            <span className={`text-[9px] px-2 py-0.5 rounded-full font-medium ${cat.color}`}>{cat.label}</span>
          )}
          {reporte.Persona?.nombre && (
            <Badge variant="outline" className="text-[9px]">{reporte.Persona.nombre}</Badge>
          )}
          {temas.slice(0, 5).map((t, i) => (
            <span
              key={i}
              className="text-[9px] px-2 py-0.5 rounded-full font-medium"
              style={{ background: productColor + '10', color: productColor }}
            >
              {typeof t === 'string' ? t : (t as Record<string, string>)?.nombre || String(t)}
            </span>
          ))}
        </div>

        {/* Resumen */}
        {reporte.resumen && (
          <div
            className="mt-5 rounded-xl px-4 py-3 text-sm text-foreground/85 leading-relaxed"
            style={{ background: productColor + '06', borderLeft: `3px solid ${productColor}` }}
          >
            {reporte.resumen.replace(/\\n/g, '\n')}
          </div>
        )}
      </div>

      {/* ── Separator ── */}
      <div className="max-w-4xl mx-auto px-4">
        <div className="border-t border-border" />
      </div>

      {/* ── Content ── */}
      <div className="max-w-4xl mx-auto px-4 py-8 print:py-4">
        {contenido ? (
          <ProductoRichContent contenido={contenido} tipo={tipo} />
        ) : (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <p className="text-sm">Sin contenido disponible.</p>
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <div className="max-w-4xl mx-auto px-4 pb-8 print:pb-4">
        <div className="border-t border-border pt-4 flex items-center justify-between text-[10px] text-muted-foreground">
          <span className="font-semibold tracking-wider" style={{ color: productColor }}>DECODEX</span>
          <span>Inteligencia de Medios Bolivia</span>
          {contenido && <span>{contenido.split(/\s+/).filter(Boolean).length} palabras</span>}
        </div>
      </div>
    </div>
  );
}

// ─── Meta Item ──────────────────────────────────────────────────────

function MetaItem({
  icon,
  label,
  value,
  valueClass = 'text-foreground',
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <div className="mt-0.5 text-muted-foreground">{icon}</div>
      <div>
        <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className={`text-xs font-medium ${valueClass}`}>{value}</p>
      </div>
    </div>
  );
}