'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Mail, CheckCircle2, XCircle, AlertTriangle, Eye, FileText, RefreshCw } from 'lucide-react';
import { KPICard } from '@/components/shared/KPICard';
import { ALL_PRODUCTS } from '@/constants/nav';
import DOMPurify from 'dompurify';

interface EntregaItem {
  id: string;
  tipoBoletin: string;
  contenido: string;
  fechaProgramada: string | null;
  fechaEnvio: string | null;
  estado: string;
  canal: string;
  destinatarios: string;
  error: string | null;
  fechaCreacion: string;
  contrato: { cliente: { id: string; nombre: string; organizacion: string } } | null;
}

interface PreviewEntrega {
  id: string;
  tipoBoletin: string;
  contenido: string;
  fechaEnvio: string | null;
  canal: string;
  contrato: { cliente: { nombre: string; organizacion: string } } | null;
}

export function BoletinesView() {
  const [entregas, setEntregas] = useState<EntregaItem[] | null>(null);
  const [entregasLoading, setEntregasLoading] = useState(false);
  const [entregasStats, setEntregasStats] = useState<{ enviadasHoy: number; fallidasHoy: number; pendientes: number } | null>(null);
  const [entregasFilterTipo, setEntregasFilterTipo] = useState('todos');
  const [entregasFilterEstado, setEntregasFilterEstado] = useState('todos');
  const [previewEntrega, setPreviewEntrega] = useState<PreviewEntrega | null>(null);

  // Initial load + reload on filter change
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setEntregasLoading(true);
      try {
        const params = new URLSearchParams({ page: '1', limit: '50' });
        if (entregasFilterTipo !== 'todos') params.set('tipoBoletin', entregasFilterTipo);
        if (entregasFilterEstado !== 'todos') params.set('estado', entregasFilterEstado);
        const res = await fetch(`/api/entregas?${params}`);
        const json = await res.json();
        if (!cancelled) {
          setEntregas(json.entregas || []);
          setEntregasStats(json.stats || null);
        }
      } catch {
        // silent
      } finally {
        if (!cancelled) setEntregasLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [entregasFilterTipo, entregasFilterEstado]);

  // Manual refresh
  const refreshEntregas = useCallback(async () => {
    setEntregasLoading(true);
    try {
      const params = new URLSearchParams({ page: '1', limit: '50' });
      if (entregasFilterTipo !== 'todos') params.set('tipoBoletin', entregasFilterTipo);
      if (entregasFilterEstado !== 'todos') params.set('estado', entregasFilterEstado);
      const res = await fetch(`/api/entregas?${params}`);
      const json = await res.json();
      setEntregas(json.entregas || []);
      setEntregasStats(json.stats || null);
    } catch {
      // silent
    } finally {
      setEntregasLoading(false);
    }
  }, [entregasFilterTipo, entregasFilterEstado]);

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPICard icon={<Mail className="h-5 w-5" />} value={ALL_PRODUCTS.length} label="Productos" colorClass="text-primary" />
        <KPICard icon={<CheckCircle2 className="h-5 w-5" />} value={entregasStats?.enviadasHoy || 0} label="Enviadas hoy" colorClass="text-emerald-600 dark:text-emerald-400" />
        <KPICard icon={<XCircle className="h-5 w-5" />} value={entregasStats?.fallidasHoy || 0} label="Fallidas hoy" colorClass="text-red-600 dark:text-red-400" />
        <KPICard icon={<AlertTriangle className="h-5 w-5" />} value={entregasStats?.pendientes || 0} label="Pendientes" colorClass="text-amber-600 dark:text-amber-400" />
      </div>

      {/* Filtros + Lista */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                Historial de Entregas
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                {entregas?.length || 0} entregas registradas
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={entregasFilterTipo}
                onChange={(e) => setEntregasFilterTipo(e.target.value)}
                className="text-xs border border-border rounded-lg px-2.5 py-1.5 bg-background text-foreground"
              >
                <option value="todos">Todos los productos</option>
                {ALL_PRODUCTS.map((p) => (
                  <option key={p.tipo} value={p.tipo}>{p.nombre}</option>
                ))}
              </select>
              <select
                value={entregasFilterEstado}
                onChange={(e) => setEntregasFilterEstado(e.target.value)}
                className="text-xs border border-border rounded-lg px-2.5 py-1.5 bg-background text-foreground"
              >
                <option value="todos">Todos los estados</option>
                <option value="enviado">Enviado</option>
                <option value="pendiente">Pendiente</option>
                <option value="fallido">Fallido</option>
              </select>
              <Button variant="outline" size="sm" onClick={refreshEntregas} className="text-xs gap-1">
                <RefreshCw className="h-3 w-3" /> Actualizar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          {entregasLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : entregas && entregas.length > 0 ? (
            <div className="space-y-2 max-h-[600px] overflow-y-auto custom-scrollbar">
              {entregas.map((e) => {
                const prodInfo = ALL_PRODUCTS.find(p => p.tipo === e.tipoBoletin);
                const ProdIcon = prodInfo?.icon || FileText;
                const clienteNombre = e.contrato?.cliente?.nombre || '—';
                return (
                  <div key={e.id} className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                    <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: (prodInfo?.color || '#6B7280') + '20' }}>
                      <ProdIcon className="h-4 w-4" style={{ color: prodInfo?.color || '#6B7280' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-semibold text-foreground">{prodInfo?.nombre || e.tipoBoletin.replace(/_/g, ' ')}</p>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                          e.estado === 'enviado' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                          : e.estado === 'fallido' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                        }`}>
                          {e.estado === 'enviado' ? '✓ Enviado' : e.estado === 'fallido' ? '✗ Fallido' : '⏳ Pendiente'}
                        </span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium bg-muted text-muted-foreground">
                          {e.canal}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <p className="text-[10px] text-muted-foreground">{clienteNombre}</p>
                        <span className="text-[10px] text-muted-foreground/40">|</span>
                        <p className="text-[10px] text-muted-foreground">
                          {e.fechaEnvio ? new Date(e.fechaEnvio).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Sin fecha'}
                        </p>
                      </div>
                      {e.error && <p className="text-[10px] text-red-500 mt-0.5">{e.error}</p>}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {e.contenido && (
                        <Button variant="ghost" size="sm" onClick={() => setPreviewEntrega(e as unknown as PreviewEntrega)} className="text-[10px] gap-1 h-7 px-2">
                          <Eye className="h-3 w-3" /> Vista previa
                        </Button>
                      )}
                      {e.contenido && (
                        <Button variant="outline" size="sm" onClick={() => {
                          const blob = new Blob([e.contenido], { type: 'text/html;charset=utf-8' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `${e.tipoBoletin.replace(/_/g, '-')}-${e.fechaEnvio ? new Date(e.fechaEnvio).toISOString().slice(0, 10) : 'sin-fecha'}.html`;
                          a.click();
                          URL.revokeObjectURL(url);
                        }} className="text-[10px] gap-1 h-7 px-2">
                          <FileText className="h-3 w-3" /> Descargar
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <Mail className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground">No hay entregas registradas</p>
              <p className="text-xs text-muted-foreground mt-1">Las entregas aparecerán aquí cuando se generen y envíen boletines</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal Vista Previa */}
      {previewEntrega && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setPreviewEntrega(null)}>
          <div className="bg-card rounded-xl shadow-xl border border-border max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  {ALL_PRODUCTS.find(p => p.tipo === previewEntrega.tipoBoletin)?.nombre || previewEntrega.tipoBoletin.replace(/_/g, ' ')}
                </h3>
                <p className="text-[10px] text-muted-foreground">
                  {previewEntrega.contrato?.cliente?.nombre || '—'} · {previewEntrega.canal}
                  {previewEntrega.fechaEnvio && ` · ${new Date(previewEntrega.fechaEnvio).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}`}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setPreviewEntrega(null)} className="h-7 w-7 p-0">
                ✕
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(previewEntrega.contenido, { ALLOWED_TAGS: ['p', 'br', 'strong', 'b', 'em', 'i', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'a', 'span', 'div', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'img'], ALLOWED_ATTR: ['href', 'target', 'rel', 'src', 'alt', 'style', 'class'] }) }} />
            </div>
            <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border">
              <Button variant="outline" size="sm" onClick={() => {
                const blob = new Blob([previewEntrega.contenido], { type: 'text/html;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${previewEntrega.tipoBoletin.replace(/_/g, '-')}-${previewEntrega.fechaEnvio ? new Date(previewEntrega.fechaEnvio).toISOString().slice(0, 10) : 'preview'}.html`;
                a.click();
                URL.revokeObjectURL(url);
              }} className="text-xs gap-1">
                <FileText className="h-3 w-3" /> Descargar HTML
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setPreviewEntrega(null)} className="text-xs">Cerrar</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
